// app/(components)/tutorial-form.tsx
'use client'; // This component interacts with browser APIs (fetch, File)

import React, { useState, useRef } from 'react';
import LoadingSpinner from './loading-spinner';
import ErrorMessage from './error-message';
import { DEFAULT_INCLUDE_PATTERNS, DEFAULT_EXCLUDE_PATTERNS, DEFAULT_MAX_FILE_SIZE } from '@/lib/patterns'; // Import defaults

const TutorialForm: React.FC = () => {
  const [sourceType, setSourceType] = useState<'repo' | 'upload'>('repo');
  const [repoUrl, setRepoUrl] = useState('');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [projectName, setProjectName] = useState('');
  const [githubToken, setGithubToken] = useState('');
  const [includePatterns, setIncludePatterns] = useState(DEFAULT_INCLUDE_PATTERNS.join(', '));
  const [excludePatterns, setExcludePatterns] = useState(DEFAULT_EXCLUDE_PATTERNS.join(', '));
  const [maxFileSize, setMaxFileSize] = useState<number | string>(DEFAULT_MAX_FILE_SIZE);
  const [language, setLanguage] = useState('english');

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [downloadFilename, setDownloadFilename] = useState<string | null>(null);


  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.type === 'application/zip' || file.type === 'application/x-zip-compressed') {
          setUploadedFile(file);
          setError(null); // Clear previous errors
      } else {
          setError('Invalid file type. Please upload a ZIP file.');
          setUploadedFile(null);
          if(fileInputRef.current) fileInputRef.current.value = ""; // Reset input
      }
    } else {
      setUploadedFile(null);
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    setDownloadUrl(null); // Clear previous download link
    setDownloadFilename(null);

    // Basic Validation
    if (sourceType === 'repo' && !repoUrl) {
      setError("Please enter a GitHub repository URL.");
      setIsLoading(false);
      return;
    }
    if (sourceType === 'upload' && !uploadedFile) {
      setError("Please upload a ZIP file.");
      setIsLoading(false);
      return;
    }

    const formData = new FormData();
    formData.append('sourceType', sourceType);
    if (sourceType === 'repo' && repoUrl) formData.append('repoUrl', repoUrl);
    if (sourceType === 'upload' && uploadedFile) formData.append('uploadedFile', uploadedFile, uploadedFile.name);
    if (projectName) formData.append('projectName', projectName);
    if (githubToken) formData.append('githubToken', githubToken); // Sending token (server needs to handle securely)
    if (includePatterns) formData.append('includePatterns', includePatterns); // Send as comma-separated string
    if (excludePatterns) formData.append('excludePatterns', excludePatterns); // Send as comma-separated string
    if (maxFileSize) formData.append('maxFileSize', maxFileSize.toString());
    if (language) formData.append('language', language);

    try {
      const response = await fetch('/api/generate-tutorial', {
        method: 'POST',
        body: formData, // Send form data
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! Status: ${response.status}`);
      }

      // Handle successful response (ZIP file)
      const blob = await response.blob();
      const contentDisposition = response.headers.get('content-disposition');
      let filename = "tutorial.zip"; // Default filename
        if (contentDisposition) {
            const filenameMatch = contentDisposition.match(/filename="?(.+)"?/i);
            if (filenameMatch && filenameMatch.length > 1) {
                filename = filenameMatch[1];
            }
        }

      const url = window.URL.createObjectURL(blob);
      setDownloadUrl(url);
      setDownloadFilename(filename);

    } catch (err: any) {
        console.error("Form submission error:", err);
        setError(err.message || 'An unexpected error occurred.');
        // Clean up any potentially created blob URL if error occurs after creation
        if (downloadUrl) {
             window.URL.revokeObjectURL(downloadUrl);
             setDownloadUrl(null);
             setDownloadFilename(null);
        }
    } finally {
      setIsLoading(false);
    }
  };

  // Clean up blob URL on component unmount
  React.useEffect(() => {
      return () => {
          if (downloadUrl) {
              window.URL.revokeObjectURL(downloadUrl);
          }
      };
  }, [downloadUrl]);

  return (
    <form onSubmit={handleSubmit} className="space-y-6 p-6 bg-white rounded-lg shadow-md max-w-2xl mx-auto">
      <h2 className="text-2xl font-semibold text-gray-800 mb-4">Generate Codebase Tutorial</h2>

      {/* Source Type Selection */}
      <div className="flex gap-4">
        <label className="flex items-center space-x-2 cursor-pointer">
          <input
            type="radio"
            name="sourceType"
            value="repo"
            checked={sourceType === 'repo'}
            onChange={() => setSourceType('repo')}
            className="form-radio text-blue-600"
          />
          <span>GitHub Repo URL</span>
        </label>
        <label className="flex items-center space-x-2 cursor-pointer">
          <input
            type="radio"
            name="sourceType"
            value="upload"
            checked={sourceType === 'upload'}
            onChange={() => setSourceType('upload')}
            className="form-radio text-blue-600"
          />
          <span>Upload Local Directory (.zip)</span>
        </label>
      </div>

      {/* Conditional Inputs */}
      {sourceType === 'repo' && (
        <div>
          <label htmlFor="repoUrl" className="block text-sm font-medium text-gray-700">
            GitHub Repository URL
          </label>
          <input
            type="url"
            id="repoUrl"
            value={repoUrl}
            onChange={(e) => setRepoUrl(e.target.value)}
            placeholder="e.g., https://github.com/owner/repo/tree/main/src"
            required={sourceType === 'repo'}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
          />
        </div>
      )}

      {sourceType === 'upload' && (
        <div>
          <label htmlFor="fileUpload" className="block text-sm font-medium text-gray-700">
            Upload Zip File
          </label>
          <input
            type="file"
            id="fileUpload"
            accept=".zip,application/zip,application/x-zip-compressed"
            onChange={handleFileChange}
            ref={fileInputRef}
            required={sourceType === 'upload'}
            className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
          />
          {uploadedFile && <p className="text-xs text-gray-500 mt-1">Selected: {uploadedFile.name}</p>}
        </div>
      )}

      {/* Optional Fields */}
       <div>
          <label htmlFor="projectName" className="block text-sm font-medium text-gray-700">
            Project Name (Optional)
          </label>
          <input
            type="text"
            id="projectName"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            placeholder="Defaults to repo/zip name"
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
          />
       </div>

       {sourceType === 'repo' && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-3">
            <label htmlFor="githubToken" className="block text-sm font-medium text-gray-700 mb-1">
                GitHub Token (Optional)
            </label>
            <input
            type="password"
            id="githubToken"
            value={githubToken}
            onChange={(e) => setGithubToken(e.target.value)}
            placeholder="Enter token for private repos or rate limits"
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            />
             <p className="text-xs text-yellow-700 mt-1">Needed for private repositories or to avoid API rate limits. Token is sent to the server but not stored long-term.</p>
        </div>
       )}

        <div>
            <label htmlFor="language" className="block text-sm font-medium text-gray-700">
                Tutorial Language
            </label>
            <select
                id="language"
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            >
                <option value="english">English</option>
                <option value="spanish">Spanish</option>
                <option value="french">French</option>
                <option value="german">German</option>
                <option value="japanese">Japanese</option>
                <option value="chinese">Chinese</option>
                <option value="korean">Korean</option>
                 <option value="portuguese">Portuguese</option>
                 <option value="italian">Italian</option>
                 <option value="russian">Russian</option>
                {/* Add more languages as needed */}
            </select>
        </div>

       {/* Advanced Options (Collapsible?) */}
       <details className="group border border-gray-200 rounded-md p-3">
            <summary className="text-sm font-medium text-gray-600 cursor-pointer group-open:mb-2">Advanced Options</summary>
            <div className="space-y-4">
                 <div>
                    <label htmlFor="includePatterns" className="block text-sm font-medium text-gray-700">
                        Include Patterns (comma-separated)
                    </label>
                    <textarea
                        id="includePatterns"
                        rows={3}
                        value={includePatterns}
                        onChange={(e) => setIncludePatterns(e.target.value)}
                        placeholder={DEFAULT_INCLUDE_PATTERNS.slice(0, 5).join(', ') + '...'}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm font-mono text-xs"
                    />
                    <p className="text-xs text-gray-500 mt-1">Uses glob patterns. Defaults to common code/config files.</p>
                </div>
                <div>
                    <label htmlFor="excludePatterns" className="block text-sm font-medium text-gray-700">
                        Exclude Patterns (comma-separated)
                    </label>
                    <textarea
                        id="excludePatterns"
                        rows={3}
                        value={excludePatterns}
                        onChange={(e) => setExcludePatterns(e.target.value)}
                        placeholder={DEFAULT_EXCLUDE_PATTERNS.slice(0, 5).join(', ') + '...'}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm font-mono text-xs"
                    />
                     <p className="text-xs text-gray-500 mt-1">Uses glob patterns. Defaults to common test/build/vendor dirs.</p>
                </div>
                 <div>
                    <label htmlFor="maxFileSize" className="block text-sm font-medium text-gray-700">
                        Max File Size (Bytes)
                    </label>
                    <input
                        type="number"
                        id="maxFileSize"
                        value={maxFileSize}
                        onChange={(e) => setMaxFileSize(e.target.value ? parseInt(e.target.value, 10) : '')}
                        min="0"
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    />
                     <p className="text-xs text-gray-500 mt-1">Skip files larger than this size. Default: {DEFAULT_MAX_FILE_SIZE} bytes (~100KB).</p>
                </div>
            </div>
       </details>


      {/* Submit Button & Feedback */}
      <div className="pt-4">
        {isLoading ? (
          <LoadingSpinner />
        ) : (
          <button
            type="submit"
            disabled={isLoading}
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
          >
            Generate Tutorial
          </button>
        )}
      </div>

      <ErrorMessage message={error || ''} />

      {downloadUrl && downloadFilename && (
        <div className="mt-4 p-4 bg-green-100 border border-green-400 rounded-md text-center">
          <p className="text-green-800 font-semibold mb-2">Tutorial Ready!</p>
          <a
            href={downloadUrl}
            download={downloadFilename}
            className="inline-block py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
          >
            Download {downloadFilename}
          </a>
        </div>
      )}
    </form>
  );
};

export default TutorialForm;