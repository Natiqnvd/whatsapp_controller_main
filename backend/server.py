# backend/server.py
from fastapi.staticfiles import StaticFiles
import uvicorn
from main import app
from config import Settings

# Mount static files with correct relative path handling
app.mount("/uploads", StaticFiles(directory=Settings.UPLOAD_DIR), name="uploads")
app.mount("/thumbnails", StaticFiles(directory=Settings.THUMBNAIL_DIR), name="thumbnails")

if __name__ == "__main__":
    print("Starting FastAPI server...")
    uvicorn.run(app, host="127.0.0.1", port=Settings.BACKEND_PORT)  # Change to 0.0.0.0 for broader access