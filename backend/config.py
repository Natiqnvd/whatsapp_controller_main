# config.py
from pathlib import Path
import os

class Settings:
    FILE_DIALOG_INITIAL_STEP = True  # This is used for adding the upload directory address to the file dialog initially
    BACKEND_PORT = 5690 # Change this to the port you want to run the server on
    BACKEND_HOST = "localhost"
    FRONTEND_PORT = 3434
    
    UPLOAD_DIR = Path(os.environ.get("UPLOADS_DIR", "./uploads")).resolve()
    THUMBNAIL_DIR = Path(os.environ.get("THUMBNAIL_DIR", "./thumbnails")).resolve()
    CONTACTS_DIR = Path(os.environ.get("CONTACTS_DIR", "./contacts")).resolve()
    ADMIN_NUMBER_FILE = CONTACTS_DIR / "admin_number.json"  # Rebuild it from CONTACTS_DIR
    
    print(f"Uploads Directory: {UPLOAD_DIR}")
    print(f"Thumbnail Directory: {THUMBNAIL_DIR}")
    print(f"Contacts Directory: {CONTACTS_DIR}")
    print(f"Admin Number File: {ADMIN_NUMBER_FILE}")

    BASE_URL = f"http://localhost:{BACKEND_PORT}/"
    BASE_URL_UPLOAD = f"http://localhost:{BACKEND_PORT}/uploads"

    MAX_FILE_SIZE = 100 * 1024 * 1024  # 100 MB