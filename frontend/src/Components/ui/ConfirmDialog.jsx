import React from 'react';
import { AlertCircle } from 'lucide-react';
import { Button } from './button';

const ConfirmDialog = ({
  open,
  title = 'Confirm',
  description = '',
  onConfirm,
  onCancel,
  confirmText = 'Delete',
  cancelText = 'Cancel',
  danger = false,
}) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
      <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-sm">
        <div className="mb-4 flex items-center space-x-2">
          <AlertCircle className={`h-6 w-6 ${danger ? 'text-red-600' : 'text-yellow-500'}`} />
          <span className="font-semibold text-lg">{title}</span>
        </div>
        <div className="mb-6">{description}</div>
        <div className="flex justify-end space-x-2">
          <Button variant="outline" onClick={onCancel}>{cancelText}</Button>
          <Button
            className={danger ? 'bg-red-600 hover:bg-red-700 text-white' : ''}
            onClick={onConfirm}
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog; 