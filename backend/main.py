import os
import uuid
import io
from typing import List
from fastapi import FastAPI, HTTPException, File, UploadFile
from pypdf import PdfReader
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

# Optional local embeddings with very low memory footprint
from fastembed import TextEmbedding

# Pinecone & Groq clients
from pinecone import Pinecone, ServerlessSpec
from groq import Groq

load_dotenv()

app = FastAPI(title="RAG Chatbot API")

# Setup CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load configuration matching the expected keys
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
PINECONE_API_KEY = os.getenv("PINECONE_API_KEY", "")
PINECONE_INDEX_NAME = os.getenv("PINECONE_INDEX_NAME", "rag-index")

# Initialize Clients
groq_client = None
if GROQ_API_KEY:
    groq_client = Groq(api_key=GROQ_API_KEY)

pc = None
pinecone_index = None

if PINECONE_API_KEY:
    pc = Pinecone(api_key=PINECONE_API_KEY)
    # Check if index exists, else try to configure one
    if PINECONE_INDEX_NAME not in pc.list_indexes().names():
        try:
            pc.create_index(
                name=PINECONE_INDEX_NAME, 
                dimension=384, # all-MiniLM-L6-v2 dimension
                metric='cosine',
                spec=ServerlessSpec(
                    cloud='aws',
                    region='us-east-1'
                )
            )
        except Exception as e:
            print("Failed to auto-create Pinecone index. Ensure you create it manually:", e)
    
    try:
        pinecone_index = pc.Index(PINECONE_INDEX_NAME)
        
        # Clear the database completely on initial server startup
        pinecone_index.delete(delete_all=True)
        print(f"Pinecone Index '{PINECONE_INDEX_NAME}' bound and fully cleared on startup.")
    except Exception as e:
        print("Failed to bind or clear Pinecone Index on startup:", e)

# Initialize light-weight embedding model
# all-MiniLM-L6-v2 produces 384-dimensional embeddings and takes < 100MB RAM
print("Loading Embedding Model...")
embedding_model = TextEmbedding("BAAI/bge-small-en-v1.5") # Dimension 384
print("Model Loaded!")


class IngestRequest(BaseModel):
    text: str

class ChatRequest(BaseModel):
    message: str


def chunk_text(text: str, chunk_size=500, overlap=50) -> List[str]:
    # Very simple chunking
    words = text.split()
    chunks = []
    for i in range(0, len(words), chunk_size - overlap):
        chunk = " ".join(words[i:i + chunk_size])
        if chunk:
            chunks.append(chunk)
    return chunks

@app.get("/")
def home():
    return {"message": "API is running 🚀"}   

@app.post("/ingest")
def ingest_text(req: IngestRequest):
    if not pinecone_index:
        raise HTTPException(status_code=500, detail="Pinecone not configured")
        
    try:
        pinecone_index.delete(delete_all=True)
    except Exception as e:
        print("Warning: Failed to clear Pinecone index:", e)
        
    chunks = chunk_text(req.text)
    
    # Generate embeddings
    embeddings = list(embedding_model.embed(chunks))
    
    vectors = []
    for i, (chunk, emb) in enumerate(zip(chunks, embeddings)):
        vector_id = str(uuid.uuid4())
        vectors.append({
            "id": vector_id,
            "values": emb.tolist(),
            "metadata": {"text": chunk}
        })
        
    # Upsert in batches of 50
    for i in range(0, len(vectors), 50):
        pinecone_index.upsert(vectors=vectors[i:i+50])
        
    return {"message": f"Successfully ingested {len(chunks)} chunks"}


@app.post("/upload-pdf")
async def upload_pdf(file: UploadFile = File(...)):
    if not pinecone_index:
        raise HTTPException(status_code=500, detail="Pinecone not configured")
    
    if not file.filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")
        
    try:
        pinecone_index.delete(delete_all=True)
    except Exception as e:
        print("Warning: Failed to clear Pinecone index:", e)
        
    try:
        contents = await file.read()
        pdf_file = io.BytesIO(contents)
        reader = PdfReader(pdf_file)
        
        extracted_text = ""
        for page in reader.pages:
            extracted_text += page.extract_text() + "\n"
            
        if not extracted_text.strip():
            raise HTTPException(status_code=400, detail="Could not extract any text from the PDF")
            
        # Re-use the chunking logic
        chunks = chunk_text(extracted_text)
        embeddings = list(embedding_model.embed(chunks))
        
        vectors = []
        for i, (chunk, emb) in enumerate(zip(chunks, embeddings)):
            vector_id = str(uuid.uuid4())
            vectors.append({
                "id": vector_id,
                "values": emb.tolist(),
                "metadata": {"text": chunk, "source": file.filename}
            })
            
        for i in range(0, len(vectors), 50):
            pinecone_index.upsert(vectors=vectors[i:i+50])
            
        return {"message": f"Successfully processed '{file.filename}' into {len(chunks)} chunks"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/upload-audio")
async def upload_audio(file: UploadFile = File(...)):
    if not groq_client:
        raise HTTPException(status_code=500, detail="Groq API Key not configured")
    if not pinecone_index:
        raise HTTPException(status_code=500, detail="Pinecone Configured")
        
    try:
        pinecone_index.delete(delete_all=True)
    except Exception as e:
        print("Warning: Failed to clear Pinecone index:", e)

    try:
        contents = await file.read()
        
        # 1. Transcribe audio using Groq Whisper API
        transcription = groq_client.audio.transcriptions.create(
          file=(file.filename, contents),
          model="whisper-large-v3",
          response_format="verbose_json",
        )
        extracted_text = transcription.text
        
        if not extracted_text or not extracted_text.strip():
            raise HTTPException(status_code=400, detail="Could not extract speech from audio file")
            
        # 2. Re-use chunking logic for Pinecone
        chunks = chunk_text(extracted_text)
        embeddings = list(embedding_model.embed(chunks))
        
        vectors = []
        for i, (chunk, emb) in enumerate(zip(chunks, embeddings)):
            vector_id = str(uuid.uuid4())
            vectors.append({
                "id": vector_id,
                "values": emb.tolist(),
                "metadata": {"text": chunk, "source": file.filename}
            })
            
        for i in range(0, len(vectors), 50):
            pinecone_index.upsert(vectors=vectors[i:i+50])
            
        return {"message": f"Successfully transcribed '{file.filename}' into {len(chunks)} chunks"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/chat")
def chat(req: ChatRequest):
    if not groq_client:
        raise HTTPException(status_code=500, detail="Groq API Key not configured")
        
    context_text = ""
    
    # 1. Embed query and search Pinecone
    if pinecone_index:
        query_emb = list(embedding_model.embed([req.message]))[0]
        try:
            search_res = pinecone_index.query(
                vector=query_emb.tolist(),
                top_k=3,
                include_metadata=True
            )
            # 2. Extract Context
            contexts = [match["metadata"]["text"] for match in search_res["matches"] if "text" in match["metadata"]]
            context_text = "\n\n".join(contexts)
        except Exception as e:
            print("Warning: Pinecone search failed:", e)

    # 3. Construct prompt
    system_prompt = "You are a helpful and clear AI assistant. Keep responses clean and concise."
    if context_text:
        system_prompt += f"\n\nPlease use the following context to answer the user's question:\n{context_text}"
        
    # 4. Generate with Groq
    try:
        completion = groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": req.message}
            ],
            temperature=0.3,
            max_tokens=1024,
            stream=False
        )
        return {"response": completion.choices[0].message.content}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/health")
def health():
    return {"status": "ok"}
