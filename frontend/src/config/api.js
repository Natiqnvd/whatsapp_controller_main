// API Configuration
const API_BASE_URL = process.env.NODE_ENV === 'production' 
  ? 'http://127.0.0.1:5690'  // Production URL for Electron app
  : 'http://127.0.0.1:5690'; // Development URL

export const API_ENDPOINTS = {
  // Contact Management
  CONTACTS: {
    BASE: `${API_BASE_URL}/api/contacts`,
    SAVED_LISTS: `${API_BASE_URL}/api/contacts/saved-lists`,
    UPLOAD_CSV: `${API_BASE_URL}/api/contacts/upload-csv`,
    SAVE_LIST: `${API_BASE_URL}/api/contacts/save-list`,
    LOAD_LIST: (listId) => `${API_BASE_URL}/api/contacts/load-list/${listId}`,
    DELETE_LIST: (listId) => `${API_BASE_URL}/api/contacts/delete-list/${listId}`,
    ADMIN_NUMBER: `${API_BASE_URL}/admin-number`,
  },
  
  // Existing endpoints
  UPLOAD_CSV_BALANCES: `${API_BASE_URL}/upload-csv-balances/`,
  SEND_BALANCES: `${API_BASE_URL}/send-balances/`,
  PREVIEW_MESSAGE: `${API_BASE_URL}/preview-message/`,
  SEND_ATTACHMENTS: `${API_BASE_URL}/send-attachments/`,
  MEDIA: {
    UPLOAD: `${API_BASE_URL}/media/upload`,
    REMOVE: (filename) => `${API_BASE_URL}/media/remove?filename=${filename}`,
  },
  PDF: {
    UPLOAD: `${API_BASE_URL}/pdf/upload`,
    REMOVE: (filename) => `${API_BASE_URL}/pdf/remove?filename=${filename}`,
  },
  STOP: `${API_BASE_URL}/stop/`,
};

export default API_BASE_URL;
