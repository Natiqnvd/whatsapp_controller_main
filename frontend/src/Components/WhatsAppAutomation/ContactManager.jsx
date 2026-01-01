import React, { useState, useRef, useEffect } from 'react';
import { 
  Users, Plus, Upload, Save, Download, Trash2, Edit3, Check, X, 
  FileText, Search, UserPlus, Database, AlertCircle, CheckCircle
} from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tab';
import ErrorCard from '../ui/ErrorCard';
import { API_ENDPOINTS } from '../../config/api';
import ConfirmDialog from '../ui/ConfirmDialog';

const ContactManager = ({ state, updateState }) => {
  const csvInputRef = useRef();
  const contactListRef = useRef(null);
  const [editingIndex, setEditingIndex] = useState(-1);
  const [tempContact, setTempContact] = useState({ name: '', number: '' });
  const [newContact, setNewContact] = useState({ name: '', number: '' });
  const [searchTerm, setSearchTerm] = useState('');
  const [savedLists, setSavedLists] = useState([]);
  const [listName, setListName] = useState('');
  const [phonePrefix, setPhonePrefix] = useState('+92');
  const [listToDelete, setListToDelete] = useState(null);
  const [activeTab, setActiveTab] = useState('manage');
  const [deleteRangeStart, setDeleteRangeStart] = useState('');
  const [deleteRangeEnd, setDeleteRangeEnd] = useState('');
  const [showRangeDeleteConfirm, setShowRangeDeleteConfirm] = useState(false);
  const [showRangeInputs, setShowRangeInputs] = useState(false);

  const {
    contacts,
    isLoading,
    error,
    success
  } = state;

  // Generate unique ID for contact
  const generateUniqueId = () => {
    return `contact_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  };

  // Load saved contact lists on component mount
  useEffect(() => {
    loadSavedLists();
  }, []);

  const loadSavedLists = async () => {
    try {
      const response = await fetch(API_ENDPOINTS.CONTACTS.SAVED_LISTS);
      if (response.ok) {
        const lists = await response.json();
        setSavedLists(lists);
      }
    } catch (err) {
      console.error('Error loading saved lists:', err);
    }
  };

  const handleCSVUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      updateState({ isLoading: true, error: '', success: '' });
      const response = await fetch(API_ENDPOINTS.CONTACTS.UPLOAD_CSV, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) throw new Error(await response.text());

      const result = await response.json();
      
      // Detect duplicates by number
      const existingNumbers = new Set(contacts.map(c => c.number));
      const duplicates = [];
      const newContacts = [];
      
      result.contacts.forEach((contact, index) => {
        // Assign default name if missing
        if (!contact.name || contact.name.trim() === '' || contact.name.toUpperCase() === 'NAN') {
          contact.name = `Contact_${contacts.length + newContacts.length + 1}`;
        }
        
        // Ensure each contact has a unique ID
        contact.id = generateUniqueId();
        
        if (existingNumbers.has(contact.number)) {
          duplicates.push(contact);
        } else {
          newContacts.push(contact);
          existingNumbers.add(contact.number);
        }
      });
      
      let successMessage = `Successfully imported ${newContacts.length} contacts`;
      if (duplicates.length > 0) {
        successMessage += ` (${duplicates.length} duplicates skipped by number)`;
      }
      
      updateState({
        contacts: [...contacts, ...newContacts],
        isLoading: false,
        success: successMessage
      });
    } catch (err) {
      updateState({
        error: `CSV Upload Error: ${err.message}`,
        isLoading: false
      });
    }
  };

  const addContact = () => {
    if (!newContact.number.trim()) {
      updateState({ error: 'Please enter a phone number' });
      return;
    }
    
    const numberToAdd = newContact.number.trim();
    
    const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
    if (!phoneRegex.test(numberToAdd.replace(/\s/g, ''))) {
      updateState({ error: 'Please enter a valid phone number' });
      return;
    }

    // Assign default name if empty
    const contactName = newContact.name.trim() || `Contact_${contacts.length + 1}`;
    
    const updatedContacts = [...contacts, { 
      ...newContact, 
      name: contactName, 
      number: numberToAdd, 
      id: generateUniqueId() 
    }];
    updateState({ 
      contacts: updatedContacts,
      success: 'Contact added successfully',
      error: ''
    });
    setNewContact({ name: '', number: '' });
  };

  const editContact = (index) => {
    setEditingIndex(index);
    setTempContact({ ...contacts[index] });
  };

  const saveEdit = () => {
    if (!tempContact.name.trim() || !tempContact.number.trim()) {
      updateState({ error: 'Please enter both name and number' });
      return;
    }

    const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
    if (!phoneRegex.test(tempContact.number.replace(/\s/g, ''))) {
      updateState({ error: 'Please enter a valid phone number' });
      return;
    }

    const updatedContacts = [...contacts];
    updatedContacts[editingIndex] = { ...tempContact };
    
    updateState({ 
      contacts: updatedContacts,
      success: 'Contact updated successfully',
      error: ''
    });
    setEditingIndex(-1);
    setTempContact({ name: '', number: '' });
  };

  const cancelEdit = () => {
    setEditingIndex(-1);
    setTempContact({ name: '', number: '' });
  };

  const deleteContact = (index) => {
    const updatedContacts = contacts.filter((_, i) => i !== index);
    updateState({ 
      contacts: updatedContacts,
      success: 'Contact deleted successfully'
    });
  };

  const handleDeleteRangeClick = () => {
    const start = parseInt(deleteRangeStart, 10) - 1;
    const end = parseInt(deleteRangeEnd, 10) - 1;
    if (
      isNaN(start) || isNaN(end) ||
      start < 0 || end < 0 ||
      start > end ||
      end >= contacts.length
    ) {
      updateState({ error: 'Invalid range. Please enter valid start and end indices.' });
      return;
    }
    setShowRangeDeleteConfirm(true);
  };

  const deleteContactRange = () => {
    const start = parseInt(deleteRangeStart, 10) - 1;
    const end = parseInt(deleteRangeEnd, 10) - 1;
    const updatedContacts = contacts.filter((_, idx) => idx < start || idx > end);
    updateState({
      contacts: updatedContacts,
      success: `Deleted contacts ${start + 1} to ${end + 1}`,
      error: ''
    });
    setDeleteRangeStart('');
    setDeleteRangeEnd('');
    setShowRangeDeleteConfirm(false);
  };

  const saveContactList = async () => {
    if (!listName.trim()) {
      updateState({ error: 'Please enter a name for the contact list' });
      return;
    }

    if (contacts.length === 0) {
      updateState({ error: 'No contacts to save' });
      return;
    }

    try {
      updateState({ isLoading: true, error: '', success: '' });
      
      const response = await fetch(API_ENDPOINTS.CONTACTS.SAVE_LIST, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: listName,
          contacts: contacts
        })
      });

      if (!response.ok) throw new Error(await response.text());

      const result = await response.json();
      
      updateState({
        contacts: [], // Clear current contact list after saving
        isLoading: false,
        success: result.message
      });
      setListName('');
      loadSavedLists(); // Reload the saved lists
    } catch (err) {
      updateState({
        error: `Save Error: ${err.message}`,
        isLoading: false
      });
    }
  };

  const loadSavedList = async (listId) => {
    try {
      updateState({ isLoading: true, error: '', success: '' });
      const response = await fetch(API_ENDPOINTS.CONTACTS.LOAD_LIST(listId));
      if (!response.ok) throw new Error(await response.text());
      const result = await response.json();
      
      // Ensure all loaded contacts have unique IDs
      const contactsWithIds = result.contacts.map(contact => ({
        ...contact,
        id: contact.id || generateUniqueId()
      }));
      
      updateState({
        contacts: contactsWithIds,
        isLoading: false,
        success: `Loaded "${result.name}" with ${result.contacts.length} contacts`
      });
      setActiveTab('manage');
      setTimeout(() => {
        if (contactListRef.current) {
          contactListRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 200);
    } catch (err) {
      updateState({
        error: `Load Error: ${err.message}`,
        isLoading: false
      });
    }
  };

  const deleteSavedList = async (listId) => {
    try {
      const response = await fetch(API_ENDPOINTS.CONTACTS.DELETE_LIST(listId), {
        method: 'DELETE'
      });
      
      if (!response.ok) throw new Error(await response.text());
      
      updateState({ success: 'Contact list deleted successfully' });
      loadSavedLists();
    } catch (err) {
      updateState({ error: `Delete Error: ${err.message}` });
    }
  };

  const exportContacts = () => {
    if (contacts.length === 0) {
      updateState({ error: 'No contacts to export' });
      return;
    }

    const csvContent = "data:text/csv;charset=utf-8," 
      + "Name,Number\n"
      + contacts.map(contact => `${contact.name},${contact.number}`).join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `contacts_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportSavedListAsCSV = async (list) => {
    try {
      updateState({ isLoading: true, error: '', success: '' });
      
      const response = await fetch(API_ENDPOINTS.CONTACTS.LOAD_LIST(list.id));
      if (!response.ok) throw new Error(await response.text());

      const result = await response.json();
      
      const csvContent = "data:text/csv;charset=utf-8," 
        + "Number,Name\n"
        + result.contacts.map(contact => `${contact.number},${contact.name}`).join("\n");
      
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `${list.name}_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      updateState({
        isLoading: false,
        success: `Exported "${list.name}" with ${result.contacts.length} contacts`
      });
    } catch (err) {
      updateState({
        error: `Export Error: ${err.message}`,
        isLoading: false
      });
    }
  };

  // Filter contacts based on search term
  const filteredContacts = contacts.filter(contact =>
    contact.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    contact.number.includes(searchTerm)
  );

  const isValidRange = () => {
    const start = parseInt(deleteRangeStart, 10);
    const end = parseInt(deleteRangeEnd, 10);
    return (
      !isNaN(start) &&
      !isNaN(end) &&
      start >= 1 &&
      end >= 1 &&
      start <= end &&
      end <= contacts.length &&
      contacts.length > 0
    );
  };

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="w-full flex flex-col items-center mb-8">
        <h1 className="text-4xl font-extrabold">Contact Manager</h1>
        <p className="text-gray-400 text-sm mt-2">Manage your contact lists for WhatsApp automation</p>
      </div>

      {error && <ErrorCard error={error} />}
      
      {success && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center space-x-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <span className="text-green-800">{success}</span>
          </div>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-2 gap-4 mb-6">
          <TabsTrigger value="manage" className="flex items-center space-x-2">
            <Users className="h-4 w-4" />
            <span>Manage Contacts</span>
          </TabsTrigger>
          <TabsTrigger value="saved" className="flex items-center space-x-2">
            <Database className="h-4 w-4" />
            <span>Saved Lists</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="manage">
          <div className="space-y-6">

            {/* CSV Import in Manage Contacts */}
            <Card>
              <CardHeader>
                <CardTitle>Import from CSV</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-center w-full">
                    <label className="flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-lg cursor-pointer hover:bg-gray-50">
                      <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        <Upload className="w-8 h-8 mb-4 text-gray-500" />
                        <p className="mb-2 text-sm text-gray-500">
                          <span className="font-semibold">Click to upload</span> or drag and drop
                        </p>
                        <p className="text-xs text-gray-500">CSV file with Name and Number columns</p>
                      </div>
                      <input 
                        ref={csvInputRef} 
                        type="file" 
                        className="hidden" 
                        accept=".csv" 
                        onChange={handleCSVUpload} 
                      />
                    </label>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Add New Contact */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <UserPlus className="h-5 w-5" />
                  <span>Add New Contact</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex space-x-4">
                  <div className="flex-1">
                    <input
                      type="text"
                      placeholder="Contact Name"
                      value={newContact.name}
                      onChange={(e) => setNewContact({ ...newContact, name: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-transparent"
                    />
                  </div>
                  <div className="flex-1 flex">
                    <input
                      type="text"
                      value={phonePrefix}
                      onChange={e => setPhonePrefix(e.target.value)}
                      className="w-20 px-2 py-2 border border-gray-300 rounded-l-lg focus:ring-2 focus:ring-blue-400 focus:border-transparent text-center"
                      style={{ maxWidth: '70px' }}
                    />
                    <input
                      type="tel"
                      placeholder="Phone Number (3123456789)"
                      value={newContact.number}
                      onChange={(e) => setNewContact({ ...newContact, number: e.target.value })}
                      className="flex-1 px-4 py-2 border-t border-b border-r border-gray-300 rounded-r-lg focus:ring-2 focus:ring-blue-400 focus:border-transparent"
                    />
                  </div>
                  <Button onClick={addContact} className="flex items-center space-x-2">
                    <Plus className="h-4 w-4" />
                    <span>Add</span>
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Contact List */}
            {/* Delete Range Controls */}
            <div className="mb-2">
              {!showRangeInputs ? (
                <Button
                  variant="destructive"
                  onClick={() => setShowRangeInputs(true)}
                  disabled={contacts.length === 0}
                >
                  Delete Contacts from Range
                </Button>
              ) : (
                <div className="flex items-center space-x-2">
                  <input
                    type="number"
                    min="1"
                    max={contacts.length}
                    placeholder="Start"
                    value={deleteRangeStart}
                    onChange={e => setDeleteRangeStart(e.target.value)}
                    className="w-24 px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-400 focus:border-transparent"
                  />
                  <span>-</span>
                  <input
                    type="number"
                    min="1"
                    max={contacts.length}
                    placeholder="End"
                    value={deleteRangeEnd}
                    onChange={e => setDeleteRangeEnd(e.target.value)}
                    className="w-24 px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-400 focus:border-transparent"
                  />
                  <Button
                    variant="destructive"
                    onClick={handleDeleteRangeClick}
                    disabled={!isValidRange()}
                  >
                    Delete Range
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowRangeInputs(false);
                      setDeleteRangeStart('');
                      setDeleteRangeEnd('');
                    }}
                  >
                    Cancel
                  </Button>
                  {!isValidRange() && (deleteRangeStart || deleteRangeEnd) && (
                    <span className="text-xs text-red-500 ml-2">Invalid range</span>
                  )}
                </div>
              )}
            </div>
            <Card ref={contactListRef}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center space-x-2">
                    <Users className="h-5 w-5" />
                    <span>Contact List ({contacts.length})</span>
                  </CardTitle>
                  <div className="flex items-center space-x-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Search contacts..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-transparent"
                      />
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {filteredContacts.length > 0 ? (
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {filteredContacts.map((contact, index) => {
                      // Create a unique key for each contact, ensuring it's always unique
                      const uniqueKey = contact.id || `contact-${contact.number}-${index}`;
                      // Find the original index in the full contacts array for display
                      const originalIndex = contacts.findIndex(c => c === contact);
                      
                      return (
                        <div key={uniqueKey} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div className="w-8 text-gray-400 font-mono text-center select-none">{originalIndex + 1}</div>
                          {editingIndex === originalIndex ? (
                            <div className="flex items-center space-x-2 flex-1">
                              <input
                                type="text"
                                value={tempContact.name}
                                onChange={(e) => setTempContact({ ...tempContact, name: e.target.value })}
                                className="flex-1 px-3 py-1 border border-gray-300 rounded"
                              />
                              <input
                                type="tel"
                                value={tempContact.number}
                                onChange={(e) => setTempContact({ ...tempContact, number: e.target.value })}
                                className="flex-1 px-3 py-1 border border-gray-300 rounded"
                              />
                              <Button
                                size="sm"
                                onClick={saveEdit}
                                className="bg-green-600 hover:bg-green-700"
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={cancelEdit}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          ) : (
                            <>
                              <div className="flex-1">
                                <div className="font-medium">{contact.name}</div>
                                <div className="text-sm text-gray-600">{contact.number}</div>
                              </div>
                              <div className="flex items-center space-x-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => editContact(originalIndex)}
                                >
                                  <Edit3 className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => deleteContact(originalIndex)}
                                  className="text-red-600 hover:text-red-700"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    {contacts.length === 0 ? 'No contacts added yet' : 'No contacts match your search'}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Save Current List in Manage Contacts */}
            <Card>
              <CardHeader>
                <CardTitle>Save Current Contact List</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex space-x-4">
                    <input
                      type="text"
                      placeholder="Enter list name..."
                      value={listName}
                      onChange={(e) => setListName(e.target.value)}
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-transparent"
                    />
                    <Button 
                      onClick={saveContactList}
                      disabled={contacts.length === 0 || !listName.trim() || isLoading}
                      className="flex items-center space-x-2"
                    >
                      <Save className="h-4 w-4" />
                      <span>Save List ({contacts.length} contacts)</span>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

          </div>
        </TabsContent>

        <TabsContent value="saved">
          <div className="space-y-6">
            
            {/* Saved Lists */}
            <Card>
              <CardHeader>
                <CardTitle>Saved Contact Lists</CardTitle>
              </CardHeader>
              <CardContent>
                {savedLists.length > 0 ? (
                  <div className="space-y-2">
                    {savedLists.map((list) => (
                      <div key={list.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                        <div className="flex-1">
                          <div className="font-medium">{list.name}</div>
                          <div className="text-sm text-gray-600">
                            {list.contact_count} contacts • Saved {new Date(list.created_at).toLocaleDateString()}
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Button
                            size="sm"
                            onClick={() => loadSavedList(list.id)}
                            className="flex items-center space-x-1"
                          >
                            <Upload className="h-4 w-4" />
                            <span>Load</span>
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => exportSavedListAsCSV(list)}
                            className="flex items-center space-x-1"
                          >
                            <Download className="h-4 w-4" />
                            <span>Export CSV</span>
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setListToDelete(list)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <Database className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <p>No saved contact lists yet</p>
                    <p className="text-sm">Save your current list to access it later</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
      <ConfirmDialog
        open={!!listToDelete}
        title="Delete Contact List"
        description={listToDelete ? (<span>Are you sure you want to delete <span className="font-bold">"{listToDelete.name}"</span>? This action cannot be undone.</span>) : ''}
        onCancel={() => setListToDelete(null)}
        onConfirm={async () => {
          await deleteSavedList(listToDelete.id);
          setListToDelete(null);
        }}
        confirmText="Delete"
        danger
      />
      <ConfirmDialog
        open={showRangeDeleteConfirm}
        title="Delete Contacts Range"
        description={<span>Are you sure you want to delete contacts from <span className="font-bold">{deleteRangeStart} to {deleteRangeEnd}</span>? This action cannot be undone.</span>}
        onCancel={() => setShowRangeDeleteConfirm(false)}
        onConfirm={() => {
          deleteContactRange();
          setShowRangeInputs(false);
        }}
        confirmText="Delete"
        danger
      />
    </div>
  );
};

export default ContactManager;