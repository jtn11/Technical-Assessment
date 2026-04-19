import os
from groq import Groq

# Create a small dummy m4a file
with open("dummy.m4a", "wb") as f:
    f.write(b"NOT A REAL AUDIO FILE")

client = Groq(api_key=os.environ.get("GROQ_API_KEY", ""))

try:
    with open("dummy.m4a", "rb") as file:
        transcription = client.audio.transcriptions.create(
          file=("dummy.m4a", file.read()),
          model="whisper-large-v3",
          response_format="verbose_json",
        )
        print(transcription.text)
except Exception as e:
    print("Exception:", e)
