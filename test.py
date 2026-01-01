from PIL import Image
import win32clipboard
import io

def copy_image_to_clipboard(image_path):
    # Open image
    img = Image.open(image_path)

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

if __name__ == "__main__":

    copy_image_to_clipboard(r"E:\Programs\whatsapp_controller_main\backend\uploads\m4.png")
    
    