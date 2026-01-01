import React from 'react';
import { AlertCircle } from 'lucide-react';

const ErrorCard = ({ error }) => {
  if (!error) return null;
  return (
    <div className="bg-red-50 border border-red-200 text-red-800 rounded-lg p-4 flex items-center space-x-3 mb-4">
      <AlertCircle className="h-5 w-5 text-red-500" />
      <span className="text-sm font-medium">{error}</span>
    </div>
  );
};

export default ErrorCard; 