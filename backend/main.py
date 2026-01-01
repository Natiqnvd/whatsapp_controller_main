from backend.paths import setup_directories
setup_directories()
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles
import pandas as pd
import random
import asyncio
import math
from datetime import datetime
import json
import os
from typing import List, Optional
from threading import Event
import asyncio
from pydantic import BaseModel
import uvicorn
from backend.whatsapp_controler import (number_search, open_whatsapp, send_message, check_whatsapp_focus,
                                send_defaulters_to_admin, send_image_attachments, send_pdf_attachments,
                                close_whatsapp)
from backend.whatsapp_controller_after_update import open_chat_with_number, send_message_clipboard, send_attachment_clipboard
from backend.helper import clean_number, random_sleep, save_uploaded_file, remove_file
from backend.config import Settings

stop_event = Event()

app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"]
)

# CSP Middleware
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; "
        "img-src 'self' data: https://fastapi.tiangolo.com; "
        "media-src 'self' blob:; "
        "script-src 'self' https://cdn.jsdelivr.net; "
        "style-src 'self' https://cdn.jsdelivr.net; "
        "connect-src 'self' http://localhost:{Settings.FRONTEND_PORT} http://localhost:{Settings.BACKEND_PORT}; "
        "font-src 'self' https://cdn.jsdelivr.net; "
        "object-src 'none'; "
        "frame-ancestors 'none'; "
        "base-uri 'self'; "
        "form-action 'self';"
    )
    return response

app.mount("/uploads", StaticFiles(directory=Settings.UPLOAD_DIR), name="uploads")
app.mount("/thumbnails", StaticFiles(directory=Settings.THUMBNAIL_DIR), name="thumbnails")


@app.post("/upload-csv-balances/")
async def upload_csv_balances(file: UploadFile = File(...)):
    try:
        contents = await file.read()
        df = pd.read_csv(pd.io.common.BytesIO(contents), header=None)
        if df.shape[1] < 3:
            raise HTTPException(status_code=400, detail="CSV must have at least three columns: Name, Number, and Balance")
        
        data = []
        for _, row in df.iterrows():
            name = str(row[0]).strip().upper()
            balance_str = str(row[1]).strip()
            number = str(row[2]).strip()
            
            number = clean_number(number)
            
            try:
                balance = int(float(balance_str))
            except ValueError:
                raise HTTPException(status_code=400, detail=f"Invalid balance value: {balance_str}")
            
            data.append({
                "name": name,
                "balance": balance,
                "number": number
            })
            
        return {"data": data}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/send-balances/")
async def send_balances(request: dict):
    try:
        admin_no = request.get("admin_no", "")
        data = request.get("data", [])
        
        if not admin_no or not admin_no.strip():
            raise HTTPException(status_code=400, detail="Admin number is required.")
        
        no_number = []
        invalid_number = []
        
        async def balances_sender():
            pause_after = random.randint(12, 20)

            try:
                for index, entry in enumerate(data):
                    await asyncio.sleep(random.uniform(0.6, 1.4))

                    if int(float(str(entry["balance"]))) < 500:
                        yield json.dumps({
                            "name": entry["name"],
                            "number": entry["number"],
                            "balance": float(entry["balance"]),
                            "status": "Skipped Insufficient Balance",
                            "message": "Insufficient balance",
                            "timestamp": datetime.now().strftime("%d-%m-%Y %H:%M:%S")
                        }) + "\n"
                        await asyncio.sleep(random.uniform(0.5, 1.0))
                        continue
                    
                    if int(str(entry["number"])) == 0:
                        yield json.dumps({
                            "name": entry["name"],
                            "number": entry["number"],
                            "balance": float(entry["balance"]),
                            "status": "Skipped No Number",
                            "message": "No number entered",
                            "timestamp": datetime.now().strftime("%d-%m-%Y %H:%M:%S")
                        }) + "\n"
                        no_number.append((entry["name"], entry["balance"]))
                        await asyncio.sleep(random.uniform(0.5, 1.0))
                        continue
                    
                    try:
                        clean_number_entry = clean_number(entry["number"])
                        number_searching = open_chat_with_number(clean_number_entry)
                        # number_searching = number_search(window, entry["number"])
                        await asyncio.sleep(random.uniform(0.8, 1.3))

                        if number_searching is True:
                            message_template = entry.get("messageTemplate", "")
                            message = message_template.format(
                                name=entry["name"].upper(), 
                                balance=int(float(entry["balance"]))
                            )

                            random_sleep(1.0, 2.0)

                            # if send_message(window, message):
                            if send_message_clipboard(message):
                                yield json.dumps({
                                    "name": entry["name"],
                                    "number": entry["number"],
                                    "balance": float(entry["balance"]),
                                    "status": "success",
                                    "message": "Message sent successfully",
                                    "timestamp": datetime.now().strftime("%d-%m-%Y %H:%M:%S")
                                }) + "\n"
                                
                                if random.random() < 0.15:
                                    await random_sleep(2, 4)
                                
                            else:
                                yield json.dumps({
                                    "name": entry["name"],
                                    "number": entry["number"],
                                    "balance": float(entry["balance"]),
                                    "status": "error",
                                    "message": "Failed to send message",
                                    "timestamp": datetime.now().strftime("%d-%m-%Y %H:%M:%S")
                                }) + "\n"
                                
                        elif number_searching == "Invalid Number":
                            invalid_number.append((entry["name"], entry["balance"]))
                            yield json.dumps({
                                "name": entry["name"],
                                "number": entry["number"],
                                "balance": float(entry["balance"]),
                                "status": "Skipped Invalid Number",
                                "message": "Number is Invalid",
                                "timestamp": datetime.now().strftime("%d-%m-%Y %H:%M:%S")
                            }) + "\n"

                        random_sleep(1.0, 2.0)

                        # Extra rest every few messages (VERY IMPORTANT)
                        if index > 0 and index % pause_after == 0:
                            await asyncio.sleep(random.uniform(80, 100))
                            print(f"Taking a longer break after sending {index} messages.")
                            pause_after = random.randint(12, 20)
                            print(f"New pause after: {pause_after} messages.")
                            
                    except Exception as e:
                        yield json.dumps({
                            "name": entry["name"],
                            "number": entry["number"],
                            "balance": float(entry["balance"]),
                            "status": "error",
                            "message": str(e),
                            "timestamp": datetime.now().strftime("%d-%m-%Y %H:%M:%S")
                        }) + "\n"

            finally:
                send_defaulters_to_admin(
                    no_number,
                    invalid_number,
                    batch_no=None,
                    admin_no=clean_number(admin_no)
                )
                close_whatsapp()
            
        return StreamingResponse(balances_sender(), media_type="application/json")
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/preview-message/")
async def preview_message(data: List[dict]):
    try:
        previews = []
        for entry in data:
            message_template = entry.get("messageTemplate", "")
            preview = message_template.format(
                name=entry["name"], 
                balance=int(float(entry["balance"]))
            )
            previews.append({
                "name": entry["name"],
                "number": entry["number"],
                "preview": preview
            })
        return {"previews": previews}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    

@app.post("/send-attachments/")
async def send_attachments(
    data: str = Form(...),
    media_paths: str = Form(None),
    pdf_paths: str = Form(None),
    message: str = Form(None),
    admin_no: str = Form(...),
    min_batch_size: int = Form(15),
    max_batch_size: int = Form(35),
    min_batch_delay: int = Form(60),
    max_batch_delay: int = Form(120)
):
    try:
        # Settings.FILE_DIALOG_INITIAL_STEP = True  # This is used for adding the upload directory to the file dialog initially when the endpoint is called

        if not admin_no or not admin_no.strip():
            raise HTTPException(status_code=400, detail="Admin number is required.")
        stop_event.clear()
        processed_numbers = set()
        
        data = json.loads(data)
        media_paths = json.loads(media_paths) if media_paths and media_paths != "[]" else []
        pdf_paths = json.loads(pdf_paths) if pdf_paths and pdf_paths != "[]" else []
        if message:
            for entry in data:
                entry["messageTemplate"] = message
                
        batch_size = random.randint(min_batch_size, max_batch_size)
        batches = [data[i:i + batch_size] for i in range(0, len(data), batch_size)]
        total_batches = math.ceil(len(data) / batch_size)
        
        async def sender():
            for batch_index, batch in enumerate(batches):
                invalid_number = []
                # window = open_whatsapp()
                # if not window:
                #     yield json.dumps({"status": "error", "message": "Failed to open WhatsApp"}) + "\n"
                #     return
                
                await asyncio.sleep(random.uniform(1, 2))
                
                for entry in batch:
                    number = clean_number(entry.get("number"))
                    name = entry.get("name")
                    # if stop_event.is_set() or not check_whatsapp_focus(window):
                    #     stop_event.set()
                    #     yield json.dumps({
                    #         "name": name,
                    #         "number": number,
                    #         "status": "stopped",
                    #         "message": "Operation stopped",
                    #         "timestamp": datetime.now().strftime("%d-%m-%Y %H:%M:%S")
                    #     }) + "\n"
                    #     return

                    if number in processed_numbers:
                            yield json.dumps({
                                "name": name,
                                "number": number,
                                "status": "error",
                                "message": "Already Processed (Duplicate Entry)",
                                "timestamp": datetime.now().strftime("%d-%m-%Y %H:%M:%S")
                            }) + "\n"
                            continue
                    try:
                        # number_searching = number_search(window, number)
                        number_searching = open_chat_with_number(number)
                        random_sleep(2.0, 3.0)
                        
                        if number_searching == "Invalid Number":
                            invalid_number.append((name, number))
                            yield json.dumps({
                                "name": name,
                                "number": number,
                                "status": "skipped",
                                "message": "invalid number",
                                "timestamp": datetime.now().strftime("%d-%m-%Y %H:%M:%S")
                            }) + "\n"
                            continue
                        
                        # Initialize all status as None (not attempted)
                        message_sent = None
                        pdf_sent = None
                        media_sent = None
                        
                        if number_searching is True:
                            # Send media if it exists
                            if media_paths:
                                # media_sent = send_image_attachments(window, media_paths)
                                full_media_paths = [
                                    str(Settings.UPLOAD_DIR / filename)
                                    for filename in media_paths
                                ]
                                media_sent = send_attachment_clipboard(full_media_paths)
                                random_sleep(1.4, 2.0)
                                    
                            # Send PDF if it exists
                            if pdf_paths:
                                # pdf_sent = send_pdf_attachments(window, pdf_paths)
                                full_pdf_paths = [
                                    str(Settings.UPLOAD_DIR / filename)
                                    for filename in pdf_paths
                                ]
                                pdf_sent = send_attachment_clipboard(full_pdf_paths)
                                await asyncio.sleep(random.uniform(1.4, 2.0))
                                    
                            # Send message if it exists
                            message_template = entry.get("messageTemplate", "")
                            if message_template:
                                if "{name}" in message_template:
                                    formatted_message = message_template.format(name=name)
                                else:
                                    formatted_message = message_template
                                    
                                # message_sent = send_message(window, formatted_message)
                                message_sent = send_message_clipboard(formatted_message)
                                random_sleep(1.4, 2.0)
                                
                                
                            # Determine status and summary message
                            # Only consider operations that were attempted (not None)
                            attempted_results = []
                            attempted_names = []
                            
                            if message_sent is not None:
                                attempted_results.append(message_sent)
                                attempted_names.append("message")
                            if media_sent is not None:
                                attempted_results.append(media_sent)
                                attempted_names.append("media")
                            if pdf_sent is not None:
                                attempted_results.append(pdf_sent)
                                attempted_names.append("pdf")
                            
                            # Handle case where nothing was attempted
                            if not attempted_results:
                                status = "skipped"
                                summary = "Nothing to send"
                            else:
                                # Calculate success/failure
                                failed_ops = [name for name, result in zip(attempted_names, attempted_results) if not result]
                                succeeded_ops = [name for name, result in zip(attempted_names, attempted_results) if result]
                                
                                if all(attempted_results):
                                    status = "success"
                                    summary = "All operations completed successfully"
                                elif not any(attempted_results):
                                    status = "error"
                                    summary = "All operations failed"
                                else:
                                    status = "partial"
                                    summary = f"{' and '.join(succeeded_ops).capitalize()} sent, but {' and '.join(failed_ops)} failed"
                            
                            yield json.dumps({
                                "name": name,
                                "number": number,
                                "status": status,
                                "message_sent": message_sent,
                                "media_sent": media_sent,
                                "pdf_sent": pdf_sent,
                                "message": summary,
                                "timestamp": datetime.now().strftime("%d-%m-%Y %H:%M:%S")
                            }) + "\n"
                            
                            # Add to processed numbers if any operation succeeded
                            if attempted_results and any(attempted_results):
                                processed_numbers.add(number)
                                
                    except Exception as e: 
                        yield json.dumps({
                            "name": name,
                            "number": number,
                            "status": "error",
                            "message": f"An exception occurred: {str(e)}",
                            "timestamp": datetime.now().strftime("%d-%m-%Y %H:%M:%S")
                        }) + "\n"
                        
                batch_no = f"{batch_index + 1}/{total_batches}"
                send_defaulters_to_admin(None, invalid_number, batch_no, clean_number(admin_no))
                # close_whatsapp(window)
                # window = None

                # If there are more batches remaining, wait before processing next batch
                if batch_index < len(batches) - 1:
                    yield json.dumps({
                        "status": "batch_complete",
                        "message": f"Completed batch {batch_index + 1}/{len(batches)}. Waiting longer before next batch.",
                        "timestamp": datetime.now().strftime("%d-%m-%Y %H:%M:%S")
                    }) + "\n"
                    await random_sleep(min_batch_delay, max_batch_delay)
                    
            close_whatsapp()
                
        return StreamingResponse(sender(), media_type="application/json")
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    

@app.post("/media/upload")
async def upload_media(media: List[UploadFile] = File(...)):
    try:
        allowed_extensions = (".jpg", ".jpeg", ".png", ".mp4", ".mkv", ".avi", ".mov", ".wmv", ".3gp")
        saved_media = []

        for file in media:
            # Check file size
            file_size = 0
            for chunk in file.file:
                file_size += len(chunk)
                if file_size > Settings.MAX_FILE_SIZE:
                    raise HTTPException(
                        status_code=413,
                        detail=f"File {file.filename} is too large. Max size is 100MB"
                    )
            
            # Reset file pointer after checking size
            await file.seek(0)
            
            # Continue with your existing processing
            result = await save_uploaded_file(file, allowed_extensions)
            saved_media.append(result)

        return {
            "status": "success",
            "message": f"Successfully processed {len(saved_media)} files",
            "media": saved_media,
        }

    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"An error occurred: {str(e)}")


@app.post("/pdf/upload")
async def upload_pdf(pdfs: List[UploadFile] = File(...)):
    try:
        allowed_extensions = (".pdf",)
        saved_pdfs = []

        for pdf in pdfs:
            result = await save_uploaded_file(pdf, allowed_extensions)
            saved_pdfs.append(result)

        return {
            "status": "success",
            "message": "PDFs processed successfully",
            "pdfs": saved_pdfs
        }

    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"An error occurred: {str(e)}")

@app.delete("/media/remove")
async def remove_media(filename: str):
    return await remove_file(filename, "media")

@app.delete("/pdf/remove")
async def remove_pdf(filename: str):
    return await remove_file(filename, "PDF")

@app.post("/stop/")
async def stop_operation():
    try:
        stop_event.set()
        return {"message": "Stop signal sent. Running operations will be stopped."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Contact Management Models
class Contact(BaseModel):
    name: str = None
    number: str
    id: Optional[str] = None 

class ContactList(BaseModel):
    name: str
    contacts: List[Contact]

@app.post("/api/contacts/upload-csv")
async def upload_csv_contacts(file: UploadFile = File(...)):
    """Upload and parse CSV file for contacts"""
    try:
        contents = await file.read()
        df = pd.read_csv(pd.io.common.BytesIO(contents))
        
        # Check if Number column exists (Name is optional)
        if 'Number' not in df.columns:
            raise HTTPException(
                status_code=400, 
                detail="CSV must have 'Number' column"
            )
        
        has_name_column = 'Name' in df.columns
        
        contacts = []
        for i, row in df.iterrows():
            number = str(row['Number']).strip()
            
            # Handle name (optional)
            if has_name_column:
                name = str(row['Name']).strip()
                if name.upper() == "NAN" or pd.isna(row['Name']) or name == "":
                    name = f"Contact_{i+1}"
            else:
                name = f"Contact_{i+1}"
            
            # Clean and validate the number
            cleaned_number = clean_number(number)
            
            contacts.append({
                "name": name,
                "number": cleaned_number,
                "id": i + 1
            })
        
        return {"contacts": contacts}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/api/contacts/saved-lists")
async def get_saved_contact_lists():
    """Get all saved contact lists"""
    try:
        if not os.path.exists(Settings.CONTACTS_DIR):
            return []

        files = [f for f in os.listdir(Settings.CONTACTS_DIR) if f.endswith('.json')]
        contacts_lists = []
        
        for file in files:
            if file == Settings.ADMIN_NUMBER_FILE.name:
                continue
            file_path = os.path.join(Settings.CONTACTS_DIR, file)
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    
                contacts_lists.append({
                    "id": file,
                    "name": data.get("name", "Unknown List"),
                    "contact_count": len(data.get("contacts", [])),
                    "created_at": data.get("created_at", "1970-01-01T00:00:00")
                })
            except (json.JSONDecodeError, IOError):
                # Skip corrupted files
                continue
                
        # Sort by creation date (newest first)
        contacts_lists.sort(key=lambda x: x['created_at'], reverse=True)
        return contacts_lists
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/contacts/save-list")
async def save_contact_list(contact_list: ContactList):
    """Save a contact list to JSON file"""
    try:
        # Sanitize filename
        filename = "".join(c for c in contact_list.name if c.isalnum() or c in (' ', '-', '_')).rstrip()
        filename = filename.replace(' ', '_')
        
        if not filename:
            filename = f"contact_list_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
            
        file_path = os.path.join(Settings.CONTACTS_DIR, f"{filename}.json")
        
        # If file exists, add timestamp to make it unique
        counter = 1
        original_path = file_path
        while os.path.exists(file_path):
            base_name = filename
            file_path = os.path.join(Settings.CONTACTS_DIR, f"{base_name}_{counter}.json")
            counter += 1
        
        unique_contacts = []
        seen_numbers = set()
        duplicates = []
        
        for contact in contact_list.contacts:
            number = contact.number
            name = contact.name if contact.name else f'Contact_{len(unique_contacts) + 1}'
            if number not in seen_numbers:
                seen_numbers.add(number)
                unique_contacts.append({"name": name, "number": number})
            else:
                duplicates.append({"name": name, "number": number})

        data = {
            "name": contact_list.name,
            "contacts": unique_contacts,
            "created_at": datetime.now().isoformat(),
            "contact_count": len(unique_contacts)
        }
        
        with open(file_path, "w", encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)

        duplicate_info = f", {len(duplicates)} duplicates removed" if duplicates else ""
        return {"message": f"Contact list saved successfully{duplicate_info}", "filename": os.path.basename(file_path)}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/contacts/load-list/{list_id}")
async def load_contact_list(list_id: str):
    """Load a specific contact list"""
    try:
        file_path = os.path.join(Settings.CONTACTS_DIR, list_id)

        if not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail="Contact list not found")
            
        with open(file_path, "r", encoding='utf-8') as f:
            data = json.load(f)
            
        return data
        
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Contact list not found")
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid contact list file")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/contacts/delete-list/{list_id}")
async def delete_contact_list(list_id: str):
    """Delete a saved contact list"""
    try:
        file_path = os.path.join(Settings.CONTACTS_DIR, list_id)

        if not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail="Contact list not found")
            
        os.remove(file_path)
        return {"message": "Contact list deleted successfully"}
        
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Contact list not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/admin-number")
def get_admin_number():
    try:
        if not Settings.ADMIN_NUMBER_FILE.exists() or Settings.ADMIN_NUMBER_FILE.stat().st_size == 0:
            return {"admin_number": ""}
        with Settings.ADMIN_NUMBER_FILE.open("r", encoding="utf-8") as f:
            data = json.load(f)
            return {"admin_number": data.get("admin_number", "")}
    except (json.JSONDecodeError, IOError) as e:
        print(f"Error reading admin number file: {e}")
        return {"admin_number": ""}

@app.post("/admin-number")
def save_admin_number(data: dict):
    if "admin_number" not in data:
        raise HTTPException(status_code=400, detail="Key 'admin_number' is required")

    number = data["admin_number"]

    try:
        with Settings.ADMIN_NUMBER_FILE.open("w", encoding="utf-8") as f:
            json.dump({"admin_number": number}, f)
        return {"message": "Admin number saved"}
    except IOError as e:
        raise HTTPException(status_code=500, detail=f"Failed to write to file: {str(e)}")

@app.get("/api/health")
async def health_check():
    """Health check endpoint"""
    try:
        return {
            "status": "healthy",
            "timestamp": datetime.now().isoformat(),
            "version": "1.0.0"
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "timestamp": datetime.now().isoformat(),
            "error": str(e)
        }

@app.get("/api/health/simple")
async def simple_health_check():
    """Simple health check"""
    return {
        "status": "ok",
        "timestamp": datetime.now().isoformat()
    }

if __name__ == "__main__":
    print("Starting FastAPI server...")
    uvicorn.run(app, host="127.0.0.1", port=5690)  # Change to 0.0.0.0 for broader access