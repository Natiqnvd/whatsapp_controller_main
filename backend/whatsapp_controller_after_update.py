import uiautomation as auto
from backend.helper import random_sleep, copy_file_to_clipboard
import os
import pyperclip


def number_validity(wa_window):
    ok_btn = wa_window.ButtonControl(Name='OK')
    if ok_btn.Exists(3):
        random_sleep(0.3, 0.6)
        ok_btn.Click()
        random_sleep(0.3, 0.6)
        return False
    
    return True

def open_chat_with_number(number):

    url = f"whatsapp://send?phone={number}"
    os.startfile(url)
    random_sleep(1.0, 2.0)

    # Detect WhatsApp window
    wa_window = auto.WindowControl(ClassName='WinUIDesktopWin32WindowClass', Name='WhatsApp')
    if not wa_window.Exists(10):
        return "WhatsApp not detected"

    random_sleep(0.5, 1.0)

    if not number_validity(wa_window):
        return "Invalid Number"
 
    return True

def send_message_clipboard(message):
    random_sleep(1.0, 2.5)

    # Copy message to clipboard
    pyperclip.copy(message)
    random_sleep(0.2, 0.5)

    # Paste from clipboard
    auto.SendKeys('{CTRL}v')
    random_sleep(1.0, 2.5)

    # Send message
    auto.SendKeys('{ENTER}')
    random_sleep(1.0, 2.5)

    return True

def send_attachment_clipboard(file_paths):
    random_sleep(1.0, 2.5)
    
    for file_path in file_paths:
        copy_file_to_clipboard(file_path)
        random_sleep(1.0, 2.0)
        auto.SendKeys('{CTRL}v')
        random_sleep(2.7, 4.0)
        auto.SendKeys('{ENTER}')
        random_sleep(1.5, 3.0)

    return True
    