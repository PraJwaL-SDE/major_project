# main.py
import os
import uuid
import sqlite3
import json
from datetime import datetime
from typing import List
from contextlib import contextmanager
import threading
from fastapi import FastAPI, UploadFile, Form, HTTPException
from fastapi.responses import JSONResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
import google.generativeai as genai
import tempfile
import shutil

# Configure Gemini API
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "AIzaSyBiXjj_Y36CbTechinj_RV_XWSsV5nMjvE")
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)
    gemini_model = genai.GenerativeModel('gemini-2.5-flash')
else:
    gemini_model = None
    print("⚠ Warning: GEMINI_API_KEY not set. Upload and query will fail.")

# Create necessary directories
os.makedirs("pdf_storage", exist_ok=True)
os.makedirs("database", exist_ok=True)

app = FastAPI()

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["*"],
    expose_headers=["*"],
    max_age=3600,
)

# SQLite Database
DB_PATH = "database/chat_history4.db"
db_lock = threading.Lock()

@contextmanager
def get_db_connection():
    """Context manager for database connections"""
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH, timeout=30.0, check_same_thread=False)
        conn.execute("PRAGMA journal_mode=WAL")
        conn.execute("PRAGMA busy_timeout=30000")
        yield conn
        conn.commit()
    except Exception:
        if conn:
            conn.rollback()
        raise
    finally:
        if conn:
            conn.close()

def init_database():
    """Initialize database schema"""
    with get_db_connection() as conn:
        cursor = conn.cursor()

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS chat_history (
                id TEXT PRIMARY KEY,
                chat_id TEXT NOT NULL,
                pdf_id TEXT,
                pdf_filename TEXT NOT NULL,
                num_pages INTEGER,
                file_size_mb REAL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                last_accessed TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS qa_interactions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                message_id TEXT NOT NULL UNIQUE,
                chat_id TEXT NOT NULL,
                question TEXT NOT NULL,
                answer TEXT NOT NULL,
                token_usage TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (chat_id) REFERENCES chat_history(chat_id)
            )
        """)

        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_chat_id ON qa_interactions(chat_id)
        """)
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_message_id ON qa_interactions(message_id)
        """)
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_last_accessed ON chat_history(last_accessed)
        """)

init_database()

def get_days_since_last_access(chat_id: str) -> int:
    """Calculate days since last access"""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT last_accessed FROM chat_history WHERE chat_id = ?", (chat_id,))
        result = cursor.fetchone()
    if result and result[0]:
        last_accessed = datetime.fromisoformat(result[0])
        return (datetime.now() - last_accessed).days
    return 0

def update_last_accessed(chat_id: str):
    """Update last accessed timestamp"""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("UPDATE chat_history SET last_accessed = CURRENT_TIMESTAMP WHERE chat_id = ?", (chat_id,))

def upload_file_to_gemini(file_path: str, mime_type: str = "application/pdf"):
    """Upload file to Gemini API and return file object"""
    try:
        uploaded_file = genai.upload_file(file_path, mime_type=mime_type)
        print(f"✅ Uploaded file to Gemini: {uploaded_file.name}")
        return uploaded_file
    except Exception as e:
        print(f"❌ Error uploading to Gemini: {str(e)}")
        raise

def generate_gemini_response_with_pdf(uploaded_file, question: str, chat_history: List[dict] = None) -> dict:
    """Generate response using Gemini with uploaded PDF file"""
    try:
        if not gemini_model:
            raise RuntimeError("Gemini model not configured (GEMINI_API_KEY missing).")

        # Build conversation history
        contents = []
        
        # Add chat history if exists
        if chat_history:
            for msg in chat_history[-5:]:  # Last 5 messages for context
                contents.append({"role": "user", "parts": [msg["question"]]})
                contents.append({"role": "model", "parts": [msg["answer"]]})
        
        # Add current question with PDF
        current_parts = [uploaded_file, question]
        contents.append({"role": "user", "parts": current_parts})

        # Generate response
        response = gemini_model.generate_content(contents)
        
        text = ""
        usage = {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0}
        
        if response and hasattr(response, "text"):
            text = response.text.strip()
            
            # Get token usage
            if hasattr(response, "usage_metadata"):
                u = response.usage_metadata
                usage = {
                    "prompt_tokens": getattr(u, "prompt_token_count", 0),
                    "completion_tokens": getattr(u, "candidates_token_count", 0),
                    "total_tokens": getattr(u, "total_token_count", 0),
                }
        else:
            text = "I couldn't generate a response. Please try again."
        
        return {"text": text, "token_usage": usage}
        
    except Exception as e:
        print(f"❌ LLM error: {str(e)}")
        return {
            "text": f"Error calling Gemini API: {str(e)}", 
            "token_usage": {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0}
        }

@app.post("/upload_pdf/")
async def upload_pdf(files: List[UploadFile]):
    """
    Upload PDF(s) and create chat session.
    Files are stored locally and uploaded to Gemini API.
    """
    try:
        if not gemini_model:
            raise HTTPException(status_code=500, detail="Gemini API not configured. Set GEMINI_API_KEY.")
        
        pdf_id = str(uuid.uuid4())
        chat_id = f"chat_{pdf_id}"
        pdf_filenames = []
        saved_file_paths = []
        total_size_mb = 0

        # Save uploaded files
        for file in files:
            pdf_filenames.append(file.filename)
            file_path = f"pdf_storage/{pdf_id}_{file.filename}"
            saved_file_paths.append(file_path)
            
            content = await file.read()
            with open(file_path, "wb") as f:
                f.write(content)
            
            # Calculate file size
            file_size = len(content) / (1024 * 1024)  # MB
            total_size_mb += file_size
            
            # Upload to Gemini (only first file for now, can be extended)
            if len(saved_file_paths) == 1:
                try:
                    uploaded_file = upload_file_to_gemini(file_path, mime_type="application/pdf")
                except Exception as e:
                    raise HTTPException(status_code=500, detail=f"Failed to upload to Gemini: {str(e)}")

        # Save to database
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO chat_history (id, chat_id, pdf_id, pdf_filename, num_pages, file_size_mb)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (pdf_id, chat_id, pdf_id, ", ".join(pdf_filenames), 0, round(total_size_mb, 2)))

        return {
            "success": True,
            "chat_id": chat_id,
            "pdf_id": pdf_id,
            "message": f"✅ Successfully uploaded {len(files)} file(s) ({total_size_mb:.2f} MB) to Gemini",
            "details": {
                "filenames": pdf_filenames,
                "total_size_mb": round(total_size_mb, 2),
                "gemini_file_uploaded": True
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing PDF: {str(e)}")

@app.post("/ask_question/")
async def ask_question(chat_id: str = Form(...), question: str = Form(...)):
    """
    Ask a question about the uploaded PDF.
    Sends PDF and question directly to Gemini API.
    """
    try:
        if not gemini_model:
            raise HTTPException(status_code=500, detail="Gemini API not configured.")
        
        pdf_id = chat_id.replace("chat_", "")
        
        # Get chat metadata
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT pdf_filename, file_size_mb FROM chat_history WHERE chat_id = ?
            """, (chat_id,))
            result = cursor.fetchone()
        
        if not result:
            raise HTTPException(status_code=404, detail="Chat session not found. Please upload PDF first.")
        
        pdf_filename, file_size = result
        days_ago = get_days_since_last_access(chat_id)
        
        # Get PDF file path (use first file)
        filenames = [n.strip() for n in pdf_filename.split(",") if n.strip()]
        if not filenames:
            raise HTTPException(status_code=404, detail="No filename recorded for this chat")
        
        pdf_path = f"pdf_storage/{pdf_id}_{filenames[0]}"
        if not os.path.exists(pdf_path):
            raise HTTPException(status_code=404, detail="PDF file not found on disk")
        
        # Upload PDF to Gemini
        uploaded_file = upload_file_to_gemini(pdf_path)
        
        # Get chat history for context
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT question, answer FROM qa_interactions 
                WHERE chat_id = ? 
                ORDER BY created_at DESC 
                LIMIT 5
            """, (chat_id,))
            history_rows = cursor.fetchall()
        
        chat_history = [{"question": row[0], "answer": row[1]} for row in reversed(history_rows)]
        
        # Generate response with Gemini
        print(f"🤖 Asking Gemini about PDF: {question}")
        gemini_resp = generate_gemini_response_with_pdf(uploaded_file, question, chat_history)
        response_text = gemini_resp.get("text", "").strip()
        token_usage = gemini_resp.get("token_usage", {})
        
        # Personalized message
        days_message = ""
        if days_ago == 0:
            days_message = "Welcome back! "
        elif days_ago == 1:
            days_message = "Great to see you again after a day! "
        elif days_ago > 1:
            days_message = f"Welcome back after {days_ago} days! "
        
        enhanced_answer = (
            f"{days_message}I've analyzed your document '{pdf_filename}' to answer your question.\n\n"
            f"📝 Answer: {response_text}\n\n"
            f"💡 This answer is based on the content of your uploaded PDF."
        )
        
        # Save interaction
        message_id = str(uuid.uuid4())
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO qa_interactions (message_id, chat_id, question, answer, token_usage)
                VALUES (?, ?, ?, ?, ?)
            """, (message_id, chat_id, question, response_text, json.dumps(token_usage)))
        
        update_last_accessed(chat_id)
        
        return {
            "success": True,
            "chat_id": chat_id,
            "message_id": message_id,
            "question": question,
            "answer": enhanced_answer,
            "token_usage": token_usage,
            "metadata": {
                "pdf_filename": pdf_filename,
                "pdf_id": pdf_id,
                "file_size_mb": file_size,
                "days_since_last_access": days_ago,
                "context_messages": len(chat_history)
            }
        }
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing question: {str(e)}")

@app.get("/get_pdf/{pdf_id}")
async def get_pdf(pdf_id: str, filename: str = None):
    print("\n========== GET_PDF DEBUG ==========")
    print("📥 Requested pdf_id:", pdf_id)

    storage_dir = "pdf_storage"
    print("📂 Storage exists:", os.path.exists(storage_dir))
    print("📂 Files in storage:", os.listdir(storage_dir))

    try:
        matches = [f for f in os.listdir(storage_dir) if f.startswith(f"{pdf_id}_")]
        print("🔍 Matched files:", matches)

        if not matches:
            print("❌ ERROR: No PDF file starts with:", f"{pdf_id}_")
            raise HTTPException(status_code=404, detail="PDF not found")

        file_path = os.path.join(storage_dir, matches[0])
        print("📄 Serving file:", file_path)

        return FileResponse(file_path, media_type="application/pdf")

    except Exception as e:
        print("💥 SERVER ERROR:", str(e))
        raise HTTPException(status_code=500, detail=f"Error retrieving PDF: {str(e)}")


@app.get("/chat_history/{chat_id}")
async def get_chat_history(chat_id: str):
    """Get complete chat history"""
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT pdf_id, pdf_filename, file_size_mb, created_at, last_accessed
                FROM chat_history 
                WHERE chat_id = ?
            """, (chat_id,))
            chat_data = cursor.fetchone()
            
            if not chat_data:
                raise HTTPException(status_code=404, detail="Chat not found")
            
            cursor.execute("""
                SELECT message_id, question, answer, token_usage, created_at
                FROM qa_interactions
                WHERE chat_id = ?
                ORDER BY created_at DESC
            """, (chat_id,))
            interactions = cursor.fetchall()

        days_ago = get_days_since_last_access(chat_id)
        
        return {
            "chat_id": chat_id,
            "pdf_id": chat_data[0],
            "pdf_filename": chat_data[1],
            "file_size_mb": chat_data[2],
            "created_at": chat_data[3],
            "last_accessed": chat_data[4],
            "days_since_last_access": days_ago,
            "total_interactions": len(interactions),
            "interactions": [
                {
                    "message_id": row[0],
                    "question": row[1],
                    "answer": row[2],
                    "token_usage": json.loads(row[3]) if row[3] else {},
                    "asked_at": row[4]
                }
                for row in interactions
            ]
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving history: {str(e)}")

@app.get("/all_chats/")
async def get_all_chats():
    """Get list of all chat sessions"""
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT chat_id, pdf_id, pdf_filename, file_size_mb, created_at, last_accessed
                FROM chat_history
                ORDER BY last_accessed DESC
            """)
            chats = cursor.fetchall()
        
        result = []
        for chat in chats:
            days_ago = (datetime.now() - datetime.fromisoformat(chat[5])).days
            result.append({
                "chat_id": chat[0],
                "pdf_id": chat[1],
                "pdf_filename": chat[2],
                "file_size_mb": chat[3],
                "created_at": chat[4],
                "last_accessed": chat[5],
                "days_since_last_access": days_ago
            })
        
        return {"total_chats": len(result), "chats": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving chats: {str(e)}")

@app.delete("/delete_chat/{chat_id}")
async def delete_chat(chat_id: str):
    """Delete a chat session and its associated files"""
    try:
        pdf_id = chat_id.replace("chat_", "")
        
        # Get filenames before deletion
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT pdf_filename FROM chat_history WHERE chat_id = ?", (chat_id,))
            result = cursor.fetchone()
            
            if not result:
                raise HTTPException(status_code=404, detail="Chat not found")
            
            # Delete from database
            cursor.execute("DELETE FROM qa_interactions WHERE chat_id = ?", (chat_id,))
            cursor.execute("DELETE FROM chat_history WHERE chat_id = ?", (chat_id,))
        
        # Delete PDF files
        storage_dir = "pdf_storage"
        if os.path.exists(storage_dir):
            matches = [f for f in os.listdir(storage_dir) if f.startswith(f"{pdf_id}_")]
            for fname in matches:
                try:
                    os.remove(os.path.join(storage_dir, fname))
                except:
                    pass
        
        return {
            "success": True,
            "message": f"Chat {chat_id} and associated files deleted successfully"
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error deleting chat: {str(e)}")

@app.get("/")
async def root():
    """Health check and API info"""
    return {
        "status": "online",
        "message": "PDF RAG System with Gemini Vision API",
        "model": "gemini-1.5-flash",
        "features": [
            "Direct PDF upload to Gemini",
            "Multi-turn conversation context",
            "No vector embeddings needed",
            "Full document understanding"
        ],
        "endpoints": {
            "upload": "/upload_pdf/",
            "ask": "/ask_question/",
            "get_pdf": "/get_pdf/{pdf_id}",
            "history": "/chat_history/{chat_id}",
            "all_chats": "/all_chats/",
            "delete": "/delete_chat/{chat_id}"
        }
    }

@app.options("/{full_path:path}")
async def options_handler(full_path: str):
    """Handle OPTIONS requests for CORS preflight"""
    return JSONResponse(
        content={"message": "OK"},
        headers={
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS, PATCH",
            "Access-Control-Allow-Headers": "*",
            "Access-Control-Max-Age": "3600",
        }
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)