import React, { useState, useEffect } from 'react';
import { Database, Upload, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { API_ENDPOINTS } from '../../config/api';

const SavedContactSelector = ({ onContactsSelected, updateState }) => {
  const [savedLists, setSavedLists] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedListId, setSelectedListId] = useState('');

  useEffect(() => {
    loadSavedLists();
  }, []);

  const loadSavedLists = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(API_ENDPOINTS.CONTACTS.SAVED_LISTS);
      if (response.ok) {
        const lists = await response.json();
        setSavedLists(lists);
      }
    } catch (err) {
      console.error('Error loading saved lists:', err);
      updateState({ error: 'Failed to load saved contact lists' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoadList = async (listId) => {
    if (!listId) return;

    try {
      setIsLoading(true);
      updateState({ error: '' });

      const response = await fetch(API_ENDPOINTS.CONTACTS.LOAD_LIST(listId));
      if (!response.ok) throw new Error(await response.text());

      const result = await response.json();
      onContactsSelected(result.contacts);
      updateState({ success: `Loaded "${result.name}" with ${result.contacts.length} contacts` });
    } catch (err) {
      updateState({ error: `Failed to load contact list: ${err.message}` });
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
        <span>Loading saved lists...</span>
      </div>
    );
  }

  if (savedLists.length === 0) {
    return (
      <div className="text-center py-8">
        <Database className="h-12 w-12 mx-auto mb-4 text-gray-300" />
        <p className="text-gray-500 mb-2">No saved contact lists found</p>
        <p className="text-sm text-gray-400">
          Use the Contact Manager to create and save contact lists
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3">
        {savedLists.map((list) => (
          <div key={list.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50">
            <div className="flex-1">
              <h3 className="font-medium text-gray-900">{list.name}</h3>
              <p className="text-sm text-gray-500">
                {list.contact_count} contacts • Created {new Date(list.created_at).toLocaleDateString()}
              </p>
            </div>
            <Button
              onClick={() => handleLoadList(list.id)}
              disabled={isLoading}
              className="flex items-center space-x-2"
            >
              <Upload className="h-4 w-4" />
              <span>Use This List</span>
            </Button>
          </div>
        ))}
      </div>
      
      <div className="text-center">
        <Button
          variant="outline"
          onClick={loadSavedLists}
          disabled={isLoading}
          className="flex items-center space-x-2"
        >
          <Database className="h-4 w-4" />
          <span>Refresh Lists</span>
        </Button>
      </div>
    </div>
  );
};

export default SavedContactSelector;
