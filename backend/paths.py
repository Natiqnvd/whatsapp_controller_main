# paths.py
import os
import sys
from pathlib import Path

def get_persistent_storage():
    """Get a persistent storage location based on OS"""
    if getattr(sys, 'frozen', False):
        # When packaged as executable
        if sys.platform == "win32":
            # Windows: Use AppData/Local
            return Path(os.getenv('LOCALAPPDATA')) / "WhatsApp Controller"
        elif sys.platform == "darwin":
            # macOS: Use Application Support
            return Path.home() / "Library" / "Application Support" / "WhatsApp Controller"
        else:
            # Linux: Use .config
            return Path.home() / ".config" / "WhatsApp Controller"
    else:
        # Development: Use project directory
        return Path(__file__).resolve().parent

def setup_directories():
    """Set up persistent directories and environment variables"""
    # Create persistent directories
    PERSISTENT_DIR = get_persistent_storage()
    UPLOADS_DIR = PERSISTENT_DIR / "uploads"
    THUMBNAILS_DIR = PERSISTENT_DIR / "thumbnails"
    CONTACTS_DIR = PERSISTENT_DIR / "contacts"
    ADMIN_NUMBER_FILE = CONTACTS_DIR / "admin_number.json"

    # Create directories if they don't exist
    UPLOADS_DIR.mkdir(exist_ok=True, parents=True)
    THUMBNAILS_DIR.mkdir(exist_ok=True, parents=True)
    CONTACTS_DIR.mkdir(exist_ok=True, parents=True)
    ADMIN_NUMBER_FILE.touch(exist_ok=True)

    # Set environment variables as strings (from Path objects)
    os.environ["UPLOADS_DIR"] = str(UPLOADS_DIR.resolve())
    os.environ["THUMBNAIL_DIR"] = str(THUMBNAILS_DIR.resolve())
    os.environ["CONTACTS_DIR"] = str(CONTACTS_DIR.resolve())
    os.environ["ADMIN_NUMBER_FILE"] = str(ADMIN_NUMBER_FILE.resolve())
    
    return {
        'uploads_dir': UPLOADS_DIR,
        'thumbnails_dir': THUMBNAILS_DIR,
        'contacts_dir': CONTACTS_DIR,
        'admin_number_file': ADMIN_NUMBER_FILE
    }

if __name__ == "__main__":
    setup_directories()