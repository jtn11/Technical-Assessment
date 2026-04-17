# Indika Technical Assessment: Lightweight RAG Chatbot 🚀

A modern, highly optimized Retrieval-Augmented Generation (RAG) web application engineered to operate comfortably within Strict memory limitations (such as Render's 512MB RAM free tier). The application enables users to upload PDF documents or paste raw text and dynamically chat with their data using incredibly fast LLM inference.

## 🏗️ Architecture

The monorepo is divided into two distinct services:

1. **Backend (`/backend`)**: A minimal footprint Python REST API built with **FastAPI**.
   - **Embeddings**: Utilizes strict ONNX-runtime `fastembed` (`BAAI/bge-small-en-v1.5`) over heavy frameworks like PyTorch to keep memory usages generally `<150MB`.
   - **Vector Database**: **Pinecone** Serverless for lightning-fast vectorized semantic retrieval.
   - **LLM Engine**: **Groq API** (`llama-3.3-70b-versatile`) for immediate, low-latency generation.
   - **Ingestion Pipeline**: Processes PDF documents utilizing `pypdf` built-in handlers.

2. **Frontend (`/frontend`)**: A premium Client application built with **Next.js 15+ (App Router)**.
   - **Design Stack**: Vanilla Tailwind CSS v4 featuring pure glassmorphism, native dark mode, and dynamic micro-animations.
   - **API Interaction**: Type-safe Axios abstraction with centralized `NEXT_PUBLIC_API_URL` environment configuration to bypass CORS seamlessly.

## ⚙️ Features

- **Real-Time Contextual Chat**: Chat directly with embedded documents using Groq's high-speed inference.
- **Knowledge Base Ingestion**: 
  - **PDF Upload**: Extracts text, chunks algorithms automatically, and upserts dense vectors individually tagged to the document.
  - **Raw Text Upload**: Quick, direct data-to-vector pipeline for notes or unformatted strings.
- **Whisper API Pipeline Mock**: Configured frontend modal layout ready to support Audio/Video Media transcription routes upon expansion.
- **Double-Slash URL Resilience**: Frontend automatically serializes routing parameters to prevent common Vercel API routing mismatches (404 errors).

## 🚀 Local Development

### 1. Backend Setup

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Install dependencies (Using Python 3.11 is recommended):
   ```bash
   pip install -r requirements.txt
   ```
3. Set your environment variables locally in `backend/.env`:
   ```env
   GROQ_API_KEY="gsk_your_key_here"
   PINECONE_API_KEY="pcsk_your_key_here"
   PINECONE_INDEX_NAME="rag-index"
   ```
4. Start the FastAPI server on port 8000:
   ```bash
   uvicorn main:app --reload
   ```

### 2. Frontend Setup

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install node dependencies:
   ```bash
   npm install
   ```
3. You do *not* need an environment variable locally (it maps to `:8000` automatically), but if required, create `frontend/.env.local`:
   ```env
   NEXT_PUBLIC_API_URL="http://localhost:8000"
   ```
4. Start the Next.js development server:
   ```bash
   npm run dev
   ```
You can now access the full application on `http://localhost:3000`!

## 🌍 CI/CD & Deployment

This application features a fully configured **GitHub Actions** deployment pipeline (`.github/workflows/ci.yml`).

- **Frontend (Vercel)**: Connect your repository directly to Vercel and set `NEXT_PUBLIC_API_URL` to your live backend domain without trailing slashes. Vercel tracks your commits seamlessly.
- **Backend (Render)**: Set Render to track your Python backend natively. Included is a `render.yaml` Blueprint which automatically assigns proper commands to sidestep default filesystem issues on Render (`pip install -r backend/requirements.txt`).
- **Important**: Be sure to configure Render's `PYTHON_VERSION` Environment Variable to `3.11.8` manually in your dashboard so it can fetch the pre-compiled dependency wheels!
