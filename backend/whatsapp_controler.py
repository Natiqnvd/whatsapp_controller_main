import uiautomation as auto
from time import sleep
import sys
import pandas as pd
from backend.config import Settings
import pyperclip
from backend.helper import random_sleep, human_typing
from backend.whatsapp_controller_after_update import send_message_clipboard, open_chat_with_number

def open_whatsapp():
    try:
        auto.SendKeys('{LWIN}')
        random_sleep(0.5, 1.0)
        auto.SendKeys('WhatsAppp')
        random_sleep(0.5, 1.0)
        auto.SendKeys('{ENTER}')
        random_sleep(2.0, 3.0)
        window = auto.WindowControl(searchDepth=1, ClassName="ApplicationFrameWindow", Name="WhatsApp")
        return window
    except Exception as e:
        print(f"[ERROR]: Unable to launch WhatsApp: {e}")
        sys.exit(1)

def check_whatsapp_focus(window):
    """Check if WhatsApp window is in focus"""
    try:
        if window.Exists(5) and window.HasKeyboardFocus or window.IsKeyboardFocusable:
            window.SetFocus()
            random_sleep(0.5, 1.0)
            return True
        else:
            print("[ERROR]: WhatsApp window is not in focus.")
            return False
    
    except Exception as e:
        print(f"[ERROR]: Failed to check window focus: {e}")
        return False

def number_search(window, number):
    try:
        # Open new chat
        new_chat_button = window.ButtonControl(AutomationId="NewConvoButton")
        if new_chat_button.Exists(5) and check_whatsapp_focus(window):
            random_sleep(0.6, 1.4)
            new_chat_button.Click()
            random_sleep(0.8, 1.8)
        else:
            print("[ERROR]: Could not find 'New Chat' button.")
            return False

        # Open phone number input
        dial_pad_button = window.ButtonControl(Name="Phone number")
        if dial_pad_button.Exists(5):
            random_sleep(0.5, 1.0)
            dial_pad_button.Click()
            random_sleep(0.5, 1.0)
        else:
            print("[ERROR]: Could not find dial pad button.")
            return False
        
        # Enter phone number (human typing)
        phone_number_textbox = window.EditControl(AutomationId="PhoneNumberTextBox")
        if phone_number_textbox.Exists(5):
            phone_number_textbox.SetFocus()
            random_sleep(0.3, 0.6)

            human_typing(phone_number_textbox, number)
            random_sleep(0.7, 1.0)
        else:
            print("[ERROR]: Could not find phone number text box.")
            return False

        # Click chat
        chat_button = window.ButtonControl(Name="Chat")
        if chat_button.Exists(5):
            random_sleep(0.6, 1.4)
            chat_button.Click()
            random_sleep(1.2, 1.8)
            return True
        else:
            print(f"[ERROR]: Could not find or initiate chat with {number}.")
            auto.SendKeys('{ESC}' * 2)
            random_sleep(0.8, 1.3)
            return "Invalid Number"
                
    except Exception as e:
        print(f"[ERROR]: Unable to search for number: {e}")
        return False


def send_message(window, message):
    try:
        message_field = window.EditControl(AutomationId="InputBarTextBox")
        if message_field.Exists(5) and check_whatsapp_focus(window):
            message_field.SetFocus()
            message_field.SendKeys('{CTRL}a')
            random_sleep(0.2, 0.4)
            message_field.SendKeys('{DELETE}')
            random_sleep(0.3, 0.6)
            
            for line in message.split('\n'):
                if not line.strip():
                    continue
                human_typing(message_field, line)
                random_sleep(0.2, 0.5)
                message_field.SendKeys('{SHIFT}{ENTER}')
                random_sleep(0.3, 0.9)
        else:
            print("[ERROR]: Could not find message text field.")
            return False
        
        send_button = window.ButtonControl(AutomationId="RightButton", Name="Send message")
        if send_button.Exists(5):
            random_sleep(0.6, 1.3)
            send_button.GetPattern(10000).Invoke()
            random_sleep(0.8, 1.3)
            return True
        else:
            print("[ERROR]: Could not find 'Send' button.")
            return False

    except Exception as e:
        print(f"[ERROR]: Unable to send message: {e}")
        return False

def send_defaulters_to_admin(no_number, invalid_number, batch_no, admin_no):
    if open_chat_with_number(admin_no):
        if no_number:
            no_number_message = f"No Number Report (Total: {len(no_number)}):"
            for i, (name, balance) in enumerate(no_number, start=1):
                no_number_message += f"\n{i}. {name}: {balance}"
            if batch_no:    
                invalid_number_message += f"\nBatch {batch_no}"
            
            send_message_clipboard(no_number_message)

        if invalid_number:
            invalid_number_message = f"Invalid Number Report (Total: {len(invalid_number)}):"
            for i, (name, balance) in enumerate(invalid_number, start=1):
                invalid_number_message += f"\n{i}. {name}: {balance}"
            if batch_no:
                invalid_number_message += f"\nBatch {batch_no}"

            send_message_clipboard(invalid_number_message)
            
        if not no_number and not invalid_number:
            message = f"All Processed and No Defaulters were found!\nBatch {batch_no}"
            
            send_message_clipboard(message)
            return True

    else:
        print("[ERROR]: Could not find admin number.")
        
def load_numbers_from_csv_due_bill(file_path):
    try:
        df = pd.read_csv(file_path, header=None)
        if df.shape[1] < 3:
            print("[ERROR]: CSV file must have at least three columns: Name, Number, and Balance!")
            sys.exit(1)
        names = df[0].tolist()
        balances = df[1].astype(int).tolist()
        numbers = df[2].astype(str).tolist()

        return names, numbers, balances
    except Exception as e:
        print(f"[ERROR]: Unable to read CSV file: {e}")
        sys.exit(1)
        

def read_numbers_from_csv_attachment(numbers_file_path):
    try:
        df = pd.read_csv(numbers_file_path, dtype={"Number": str}, header=0)
        numbers = df["Number"].astype(str).tolist()
        names = df["Name"].tolist()
        
        names = [name if name else f"Name_{i+1}" for i, name in enumerate(names)]
        
        def clean_number(number):
            if number.startswith("+92"):
                return number[3:]
            elif number.startswith("92"):
                return number[2:]
            if number.startswith("0"):
                number = number[1:]
            return number

        numbers = [clean_number(number) for number in numbers]
        
        return numbers, names

    except Exception as e:
        print(f"[ERROR]: Unable to read CSV file: {e}")
        sys.exit(1)


def file_dialog_controller(attachment_paths_string):
    try:
        file_dialog = auto.WindowControl(searchDepth=2)
        if Settings.FILE_DIALOG_INITIAL_STEP:
            add_folder_address(Settings.UPLOAD_DIR)
            Settings.FILE_DIALOG_INITIAL_STEP = False
            
        sleep(1)
        if file_dialog.Exists(5):
            file_input = file_dialog.EditControl(AutomationId="1148")
            if file_input.Exists(5):
                file_input.SetFocus()
                file_input.SendKeys(attachment_paths_string)
                random_sleep(0.5, 1.3)
                
                # Locate and click the "Open" button
                open_button = file_dialog.ButtonControl(Name="Open", AutomationId="1")
                if open_button.Exists(5):
                    open_button.GetPattern(10000).Invoke()
                    random_sleep(1.5, 2.5)
                    return True
                else:
                    print("[ERROR]: Could not find the 'Open' button in the file dialog.")
                    return False
            else:
                print("[ERROR]: Could not find the file input field in the file dialog.")
                return False
        else:
            print("[ERROR]: File selection dialog did not appear.")
            return False
        
    except Exception as e:
        print(f"[ERROR]: An error occurred: {e}")

def close_file_dialog():
    try:
        file_dialog = auto.WindowControl(searchDepth=2)
        random_sleep(1.0, 1.5)

        if file_dialog.Exists(5):
            cancel_button = file_dialog.ButtonControl(Name="Cancel")
            if cancel_button.Exists(2):
                cancel_button.Click()
                random_sleep(1.0, 1.5)
                print("[INFO]: File dialog closed using 'Cancel' button.")
                return True

            # If "Cancel" is not available, try closing with the 'X' button
            close_button = file_dialog.ButtonControl(Name="Close")
            if close_button.Exists(2):
                close_button.Click()
                random_sleep(1.0, 1.5)
                return True
            
            print("[ERROR]: Could not find 'Cancel' or 'Close' button.")
            return False
        else:
            print("[ERROR]: File dialog is not open.")
            return False

    except Exception as e:
        print(f"[ERROR]: An error occurred while closing the file dialog: {e}")
        return False
    
def add_folder_address(folder_path):
    try:
        file_dialog = auto.WindowControl(Name="Open", searchDepth=2)
        if not file_dialog.Exists(5):
            print("[ERROR]: File dialog not found")
            return False

        file_dialog.SetActive()
        sleep(0.2)

        # Focus and select address bar content
        auto.SendKeys("{Alt}d")
        sleep(0.3)
        auto.SendKeys("{CTRL}a")
        auto.SendKeys("{CTRL}c")

        # Get current clipboard content
        current_path = pyperclip.paste().strip().replace("\\", "/")
        target_path = str(folder_path).strip().replace("\\", "/")

        if current_path.lower() == target_path.lower():
            return True  # No need to change address

        # Address doesn't match, update it
        auto.SendKeys("{DEL}")
        sleep(0.3)
        auto.SendKeys(str(folder_path))
        sleep(0.3)
        auto.SendKeys("{Enter}")
        return True

    except Exception as e:
        print(f"[ERROR]: An error occurred while adding folder address: {e}")
        return False

def send_image_attachments(window, image_attachment_paths):
    image_attachment_paths_string = ''
    is_video_present = False  # Flag to determine if any file is a video

    for image in image_attachment_paths:
        image_attachment_paths_string += f' "{image}"'
        if image.lower().endswith(('.mp4', '.mkv', '.avi', '.mov')):
            is_video_present = True
                
            
    try:
        attachment_field = window.ButtonControl(AutomationId="AttachButton", Name="Add attachment")
        if attachment_field.Exists(5) and check_whatsapp_focus(window):
            attachment_field.Click()
            random_sleep(0.8, 1.6)
        else:
            print("[ERROR]: Could not find attachment field.")
            return False
        
        image_attachment_field = window.TextControl(Name="Photos & videos", AutomationId="TextBlock")    
        if image_attachment_field.Exists(5):
            image_attachment_field.Click()
            random_sleep(0.3, 0.6)
            image_attachment_field.Click()
        random_sleep(0.8, 1.5)

        file_dialog = file_dialog_controller(image_attachment_paths_string)
        if file_dialog is True:
            random_sleep(1.5, 2.5)

            send_button = window.ButtonControl(AutomationId="SubmitButton", Name="Send message")
            if send_button.Exists(5):
                random_sleep(0.7, 1.4)
                send_button.GetPattern(10000).Invoke()
                
                if is_video_present:
                    random_sleep(5.0, 8.0) 
                else:
                    random_sleep(1.0, 2.0)
                
                return True
                
            else:
                print("[ERROR]: Could not find image attachment field.")
                return False
        else:
            close_file_dialog()
            return False
        
    except Exception as e:
        print(f"[ERROR]: Unable to send image attachments: {e}")
        return False
    
def send_pdf_attachments(window, pdf_attachment_paths):
    pdf_attachment_paths_string = ''
    for pdf in pdf_attachment_paths:
        pdf_attachment_paths_string += f' "{pdf}"'

    try:
        attachment_field = window.ButtonControl(
            AutomationId="AttachButton",
            Name="Add attachment"
        )

        if attachment_field.Exists(5) and check_whatsapp_focus(window):
            attachment_field.Click()
            random_sleep(0.8, 1.6)
        else:
            print("[ERROR]: Could not find attachment field.")
            return False

        file_attachment_field = window.TextControl(
            Name="Document",
            AutomationId="TextBlock"
        )

        if file_attachment_field.Exists(5):
            file_attachment_field.Click()
            random_sleep(0.3, 0.6)
            file_attachment_field.Click()
            random_sleep(0.8, 1.5)
        else:
            print("[ERROR]: Could not find document option.")
            return False

        file_dialog = file_dialog_controller(pdf_attachment_paths_string)
        if file_dialog:
            random_sleep(1.5, 2.5)

            send_button = window.ButtonControl(
                AutomationId="SubmitButton",
                Name="Send message"
            )

            if send_button.Exists(5):
                random_sleep(0.7, 1.4)
                send_button.GetPattern(10000).Invoke()
                random_sleep(2.0, 4.0)
                return True
            else:
                print("[ERROR]: Could not find send button.")
                return False

        close_file_dialog()
        return False

    except Exception as e:
        print(f"[ERROR]: Unable to send pdf attachments: {e}")
        return False

def close_whatsapp():
    try:
        window = auto.WindowControl(ClassName='WinUIDesktopWin32WindowClass', Name='WhatsApp')
        close_whatsapp_button = window.ButtonControl(AutomationId="Close", Name="Close")
        if close_whatsapp_button.Exists(5) and check_whatsapp_focus(window):
            close_whatsapp_button.Click()
            window = None
            return window
    except Exception as e:
        print(f"[ERROR]: Unable to close WhatsApp: {e}")
        return False

# def start_sending_dues(window, file_path):
#     names, numbers, balances = load_numbers_from_csv_due_bill(file_path)
#     no_number = []
#     invalid_number = []
#     counter = 0
#     for name, number, balance in zip(names, numbers, balances):
#         counter += 1
#         message = ""
#         name = name.upper()
#         try:
#             if int(number) == 0:
#                 no_number.append((name, balance))
#                 print(f"[INFO]:{counter}. Skipping {name} due to No Number entered")
#                 continue  
#             # balance_int = int(float(balance))
#             if balance >= 500:
#                 message = f"{name}\nCurrent balance: Rs. {balance}\n*بقایا رقم*: Rs. {balance}\n*نوید سنز* بابو بازار صدر\n*NAVEED SONS* - Babu Bazaar, Saddar"
                
#                 number_searching = number_search(window, number)
                    
#                 if number_searching is True:
#                     send_message(window, message)
#                     print(f"[SUCCESS]:{counter}. Message sent to {number} ({name}) successfully!")
                    
#                 elif number_searching == "Invalid Number":
#                     invalid_number.append((name, balance))
#                     print(f"[INFO]:{counter}. Skipping {name} ({number}) due to Invalid Number entered")
                    
#                 else:
#                     print(f"[ERROR]:{counter}. Failed to send message to {number} ({name})")
#                     continue
#             else:
#                 print(f"[INFO]:{counter}. Skipping {name} ({number}) due to insufficient balance.")
#             sleep(3)
            
#         except Exception as e:
#             print(f"[ERROR]:{counter}. Failed to process {name} ({number}): {e}")
            
#     send_defaulters_to_admin(window, no_number, invalid_number)

# def start_sending_attachments_messages(window, numbers_file_path, image_attachment_paths, pdf_attachment_paths, message):
#     numbers, names = read_numbers_from_csv_attachment(numbers_file_path)
#     invalid_number = []
#     processed_contacts = set()
#     counter = 0
#     batch_size = 40  # Batch size for processing
#     batch_counter = 0  # To count the number of batches processed

#     try:
#         for number, name in zip(numbers, names):
#             contact_key = (name, number)  # Unique identifier for each contact

#             # Skip the contact if it has already been processed
#             if contact_key in processed_contacts:
#                 print(f"[INFO]: Skipping {name} ({number}) as it has already been processed.")
#                 continue

#             number_searching = number_search(window, number)
#             if number_searching is True:
#                 if image_attachment_paths:
#                     send_image_attachments(window, image_attachment_paths)
#                 if pdf_attachment_paths:
#                     send_pdf_attachments(window, pdf_attachment_paths)
#                 if message:
#                     send_message(window, message)

#                 counter += 1
#                 print(f"[SUCCESS]: {counter}. Message sent to {number} ({name}) successfully!")

#                 processed_contacts.add(contact_key)

#             elif number_searching == "Invalid Number":
#                 invalid_number.append((name, number))
#                 print(f"[INFO]: Skipping {name} ({number}) due to Invalid Number entered")
#             else:
#                 print(f"[ERROR]: Failed to send message to {number} ({name})")
#                 continue

#             # Check if the batch size has been reached, and if so, close and reopen WhatsApp
#             if counter % batch_size == 0:
#                 batch_counter += 1
#                 print(f"[INFO]: Reached batch {batch_counter}. Cooling down...")
#                 # send_defaulters_to_admin(window, None, invalid_number)
                
#                 # Close WhatsApp and reopen it after cooldown
#                 close_whatsapp(window)
#                 sleep(60)  # Wait for 60 seconds as cooldown period (adjust as needed)
#                 window = open_whatsapp()  # Reopen WhatsApp (implement this function as needed)
#                 print("[INFO]: WhatsApp reopened. Continuing message sending...")
#                 # invalid_number = []  # Reset invalid numbers for the next batch

#             sleep(3)  # Sleep for a few seconds between messages to avoid rate-limiting

#         send_defaulters_to_admin(window, None, invalid_number)
#         window = close_whatsapp(window)

#     except Exception as e:
#         print(f"[ERROR]: An error occurred while sending attachments: {e}")
#         window = close_whatsapp(window)
    
if __name__ == "__main__":
    file_dialog_controller("E:/Programs/whatsapp_controller_main/backend/uploads")
    # try:
    #     csv_file_path = "numbers1.csv"
    #     image_file_path = ["vf.jpg"]
    #     pdf_file_path = ["My Contacts.pdf"]
    #     message = "Hello Testing"
    #     window = open_whatsapp()
        
    #     read_numbers_from_csv_attachment(csv_file_path)
    #     # load_numbers_from_csv_due_bill(csv_file_path)
    #     # close_whatsapp(window)
    #     start_sending_attachments_messages(window, csv_file_path, image_attachment_paths=image_file_path, pdf_attachment_paths=pdf_file_path,  message=None)
    #     # send_image_attachments(window, image_file_path)
    #     # send_message(window, message)
    #     # start_sending_dues(window, file_path=csv_file_path)
        
    # except Exception as e:
    #     print(f"[ERROR]: An error occurred: {e}")
    #     sys.exit(1)
        