// app/(components)/loading-spinner.tsx
import React from 'react';

const LoadingSpinner: React.FC = () => {
  return (
    <div className="flex justify-center items-center space-x-2">
      <div className="spinner-border animate-spin inline-block w-6 h-6 border-4 rounded-full border-blue-500 border-t-transparent" role="status">
      </div>
      <span>Generating Tutorial...</span>
    </div>
  );
};

export default LoadingSpinner;