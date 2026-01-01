# backend/helper.py
import hashlib
from typing import Dict, Optional
from pathlib import Path
from fastapi import UploadFile, HTTPException
import string
import random
from time import sleep
import cv2
from fastapi import HTTPException
from collections import deque
from backend.config import Settings

def clean_number(number):
    number = str(int(float(number)))
    
def clean_number(number):
    number = str(int(float(number)))  # Convert to string and remove decimals

    if number.startswith("+92"):
        return number
    elif number.startswith("92"):
        return "+" + number
    elif number.startswith("0"):
        return "+92" + number[1:]
    else:
        return "+92" + number



cleanup_queue = deque(maxlen=20)
# Dictionary to store file hashes and their corresponding filenames
file_hash_map: Dict[str, str] = {}
# Reverse mapping to quickly find hash by filename
filename_to_hash: Dict[str, str] = {}

def calculate_file_hash(content: bytes) -> str:
    """Calculate SHA-256 hash of file content."""
    return hashlib.sha256(content).hexdigest()

def get_existing_file_by_hash(file_hash: str) -> Optional[str]:
    """Get existing filename for a given hash if it exists."""
    return file_hash_map.get(file_hash)

def generate_unique_filename(original_extension: str, upload_dir: Path, length: int = 2) -> str:
    """Generate a unique short filename and ensure it doesn't exist in the upload directory."""
    chars = string.ascii_lowercase + string.digits
    
    while True:
        random_name = ''.join(random.choices(chars, k=length))
        new_filename = f"{random_name}{original_extension}"
        file_path = upload_dir / new_filename
        
        if not file_path.exists():
            return new_filename

def generate_video_thumbnail(video_path: str, thumbnail_path: str) -> str:
    """
    Generates a high-quality JPEG thumbnail for the given video.
    Picks a representative frame (10s or middle), resizes if needed.
    """
    try:
        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            print(f"Could not open video file: {video_path}")
            return f"{Settings.BASE_URL}thumbnails/default.jpg"

        fps = cap.get(cv2.CAP_PROP_FPS)
        frame_count = cap.get(cv2.CAP_PROP_FRAME_COUNT)
        duration = frame_count / max(fps, 1)

        # Target time: 10s or 20% in, fallback to middle
        if duration > 15:
            target_time = 10.0
        else:
            target_time = duration * 0.2 if duration > 2 else duration / 2

        cap.set(cv2.CAP_PROP_POS_MSEC, target_time * 1000)
        ret, frame = cap.read()

        if not ret or frame is None or frame.size == 0:
            # Fallback: middle
            cap.set(cv2.CAP_PROP_POS_MSEC, (duration / 2) * 1000)
            ret, frame = cap.read()

        if not ret or frame is None or frame.size == 0:
            # Fallback: first frame
            cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
            ret, frame = cap.read()

        if ret and frame is not None and frame.size > 0:
            # Optional: resize to standard thumbnail size (e.g., 320x180)
            height, width, _ = frame.shape
            aspect_ratio = width / height
            target_width = 320
            target_height = int(target_width / aspect_ratio)
            resized_frame = cv2.resize(frame, (target_width, target_height), interpolation=cv2.INTER_AREA)

            # Save with better JPEG quality
            thumbnail_dir = Path(thumbnail_path).parent
            thumbnail_dir.mkdir(parents=True, exist_ok=True)
            thumbnail_path = str(Path(thumbnail_path).with_suffix('.jpg'))

            cv2.imwrite(thumbnail_path, resized_frame, [int(cv2.IMWRITE_JPEG_QUALITY), 95])

            cap.release()
            thumbnail_url = f"{Settings.BASE_URL}thumbnails/{Path(thumbnail_path).name}"
            return thumbnail_url

        cap.release()
        print(f"Could not extract frame: {video_path}")
        return f"{Settings.BASE_URL}thumbnails/default.jpg"

    except Exception as e:
        print(f"Error generating thumbnail: {e}")
        return f"{Settings.BASE_URL}thumbnails/default.jpg"
    

async def save_uploaded_file(file: UploadFile, allowed_extensions: tuple) -> dict:
    """Handle single file upload with duplicate detection."""
    extension = Path(file.filename).suffix.lower()
    if not extension.endswith(allowed_extensions):
        raise HTTPException(
            status_code=400,
            detail=f"Only {', '.join(allowed_extensions)} files are allowed"
        )
    
    # Read file content and calculate hash
    content = await file.read()
    file_hash = calculate_file_hash(content)
    
    # Check if this file has been uploaded before
    existing_filename = get_existing_file_by_hash(file_hash)

    if existing_filename:
        if extension in ['.mp4', '.avi', '.mov', '.mkv']:
            existing_thumbnail_url = f"{Settings.BASE_URL}thumbnails/{Path(existing_filename).stem}.jpg"
        else:
            existing_thumbnail_url = f"{Settings.BASE_URL_UPLOAD}/{existing_filename}"
            
        return {
            "original_name": file.filename,
            "saved_name": existing_filename,
            "thumbnail": existing_thumbnail_url,
            "path": str(Settings.UPLOAD_DIR / existing_filename),
            "url": f"{Settings.BASE_URL_UPLOAD}/{existing_filename}",
            "is_duplicate": True
        }
    
    # Generate new filename and save file
    filename = generate_unique_filename(extension, Settings.UPLOAD_DIR)
    file_path = Settings.UPLOAD_DIR / filename
    
    with open(file_path, "wb") as f:
        f.write(content)

    # If the file is a video, generate a thumbnail
    if extension in ['.mp4', '.avi', '.mov', '.mkv']:
        thumbnail_filename = f"{Path(filename).stem}.jpg" # Thumbnail saved with .jpg extension
        thumbnail_path = str(Settings.THUMBNAIL_DIR / thumbnail_filename)
        thumbnail_url = generate_video_thumbnail(str(file_path), (thumbnail_path))

    else:
        thumbnail_url = f"{Settings.BASE_URL_UPLOAD}/{filename}"
        
    # Store hash mappings
    file_hash_map[file_hash] = filename
    filename_to_hash[filename] = file_hash
    
    cleanup_queue.append(file_hash)

    # Cleanup hash maps if they exceed the limit (20 entries)
    if len(cleanup_queue) > cleanup_queue.maxlen:
        # Remove the oldest file entry
        oldest_hash = cleanup_queue.popleft()
        oldest_filename = file_hash_map.pop(oldest_hash, None)
        filename_to_hash.pop(oldest_filename, None)

    return {
        "original_name": file.filename,
        "saved_name": filename,
        "thumbnail": thumbnail_url,
        "path": str(file_path),
        "url": f"{Settings.BASE_URL_UPLOAD}/{filename}",
        "is_duplicate": False
    }

async def remove_file(filename: str, file_type: str = "file") -> dict:
    """
    Remove a file and update hash mappings.
    
    Args:
        filename: Name of the file to remove
        file_type: Type of file for error messages (e.g., "Media" or "PDF")
    """
    try:
        extension = Path(filename).suffix.lower()
        file_path = Settings.UPLOAD_DIR / filename
        if extension in ['.mp4', '.avi', '.mov', '.mkv']:
            thumbnail_path = Settings.THUMBNAIL_DIR / f"{Path(filename).stem}.jpg"
            thumbnail_path.unlink(missing_ok=True)  # Remove thumbnail if it exists

        if not file_path.exists():
            raise HTTPException(
                status_code=404, 
                detail=f"{file_type} not found"
            )

        # Remove hash mappings before deleting file
        if filename in filename_to_hash:
            file_hash = filename_to_hash[filename]
            del file_hash_map[file_hash]
            del filename_to_hash[filename]

        # Delete the file
        file_path.unlink()

        return {
            "status": "success",
            "message": f"{file_type} '{filename}' removed successfully"
        }

    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"An error occurred while removing the {file_type.lower()}: {str(e)}"
        )


def random_sleep(min_s=0.8, max_s=2.5):
    duration = random.uniform(min_s, max_s)
    print(f"Sleeping for {duration:.2f} seconds")
    sleep(duration)

from PIL import Image
import win32clipboard
import io

def copy_file_to_clipboard(file_path):
    # Open image
    img = Image.open(file_path)

    # Convert to DIB format
    output = io.BytesIO()
    img.convert("RGB").save(output, "BMP")
    data = output.getvalue()[14:]  # skip BMP header
    output.close()

    # Copy to clipboard
    win32clipboard.OpenClipboard()
    win32clipboard.EmptyClipboard()
    win32clipboard.SetClipboardData(win32clipboard.CF_DIB, data)
    win32clipboard.CloseClipboard()

def human_typing():
    ...