// app/(components)/tutorial-form.tsx
'use client'; // This component interacts with browser APIs (fetch, File)

import React, { useState, useRef, useEffect } from 'react';
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
  const [includePatterns, setIncludePatterns] = useState('');
  const [excludePatterns, setExcludePatterns] = useState('');
  const [maxFileSize, setMaxFileSize] = useState<number | string>('');
  const [language, setLanguage] = useState('english');

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [downloadFilename, setDownloadFilename] = useState<string | null>(null);
  
  // Safely initialize state values after component mounts to prevent hydration issues
  useEffect(() => {
    setIncludePatterns(DEFAULT_INCLUDE_PATTERNS.join(', '));
    setExcludePatterns(DEFAULT_EXCLUDE_PATTERNS.join(', '));
    setMaxFileSize(DEFAULT_MAX_FILE_SIZE);
  }, []);

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

    console.log("Submitting form...");
    try {
      const response = await fetch('/api/generate-tutorial', {
        method: 'POST',
        body: formData, // Send form data
      });

      console.log("Response status:", response.status);
      
      if (!response.ok) {
        // Handle non-OK responses more carefully
        let errorMessage = `HTTP error! Status: ${response.status}`;
        try {
          // Try to parse as JSON, but have fallback if it's not valid JSON
          const contentType = response.headers.get('content-type');
          console.log("Content-Type:", contentType);
          
          if (contentType && contentType.includes('application/json')) {
            const errorData = await response.json();
            errorMessage = errorData.error || errorMessage;
          } else {
            // Not JSON, just get text
            const errorText = await response.text();
            console.error("Non-JSON error response:", errorText.substring(0, 500));
          }
        } catch (parseError) {
          console.error("Error parsing error response:", parseError);
        }
        throw new Error(errorMessage);
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
    <form onSubmit={handleSubmit} className="space-y-6 p-6 bg-gray-800 rounded-lg shadow-md max-w-2xl mx-auto border border-gray-700">
      <h2 className="text-2xl font-semibold text-gray-200 mb-4">Generate Codebase Tutorial</h2>

      {/* Source Type Selection - Button Style */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setSourceType('repo')}
          className={`flex-1 py-2 px-3 rounded-md transition-all duration-200 text-sm font-medium border-2 ${
            sourceType === 'repo'
              ? 'bg-purple-900/30 border-purple-500 text-white shadow-[0_0_8px_0_rgba(168,85,247,0.6)]'
              : 'border-purple-500/40 text-gray-300 hover:border-purple-400 hover:bg-purple-900/10'
          }`}
        >
          GitHub Repo URL
        </button>
        <button
          type="button"
          onClick={() => setSourceType('upload')}
          className={`flex-1 py-2 px-3 rounded-md transition-all duration-200 text-sm font-medium border-2 ${
            sourceType === 'upload'
              ? 'bg-purple-900/30 border-purple-500 text-white shadow-[0_0_8px_0_rgba(168,85,247,0.6)]'
              : 'border-purple-500/40 text-gray-300 hover:border-purple-400 hover:bg-purple-900/10'
          }`}
        >
          Upload Local Directory (.zip)
        </button>
      </div>

      {/* Hidden radio inputs for form submission */}
      <input 
        type="radio" 
        name="sourceType" 
        value="repo" 
        checked={sourceType === 'repo'} 
        onChange={() => {}} 
        className="hidden" 
      />
      <input 
        type="radio" 
        name="sourceType" 
        value="upload" 
        checked={sourceType === 'upload'} 
        onChange={() => {}} 
        className="hidden" 
      />

      {/* Conditional Inputs */}
      {sourceType === 'repo' && (
        <div>
          <label htmlFor="repoUrl" className="block text-sm font-medium text-gray-300">
            GitHub Repository URL
          </label>
          <input
            type="url"
            id="repoUrl"
            value={repoUrl}
            onChange={(e) => setRepoUrl(e.target.value)}
            placeholder="e.g., https://github.com/owner/repo/tree/main/src"
            required={sourceType === 'repo'}
            className="mt-1 block w-full px-3 py-2 border border-gray-600 bg-gray-700 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500 text-white sm:text-sm"
          />
        </div>
      )}

      {sourceType === 'upload' && (
        <div>
          <label htmlFor="fileUpload" className="block text-sm font-medium text-gray-300">
            Upload Zip File
          </label>
          <input
            type="file"
            id="fileUpload"
            accept=".zip,application/zip,application/x-zip-compressed"
            onChange={handleFileChange}
            ref={fileInputRef}
            required={sourceType === 'upload'}
            className="mt-1 block w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-gray-700 file:text-purple-300 hover:file:bg-gray-600"
          />
          {uploadedFile && <p className="text-xs text-gray-400 mt-1">Selected: {uploadedFile.name}</p>}
        </div>
      )}

      {/* Optional Fields */}
       <div>
          <label htmlFor="projectName" className="block text-sm font-medium text-gray-300">
            Project Name (Optional)
          </label>
          <input
            type="text"
            id="projectName"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            placeholder="Defaults to repo/zip name"
            className="mt-1 block w-full px-3 py-2 border border-gray-600 bg-gray-700 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500 text-white sm:text-sm"
          />
       </div>

       {sourceType === 'repo' && (
        <div className="bg-gray-700 border-l-4 border-purple-400 p-3">
            <label htmlFor="githubToken" className="block text-sm font-medium text-gray-300 mb-1">
                GitHub Token (Optional)
            </label>
            <input
            type="password"
            id="githubToken"
            value={githubToken}
            onChange={(e) => setGithubToken(e.target.value)}
            placeholder="Enter token for private repos or rate limits"
            className="mt-1 block w-full px-3 py-2 border border-gray-600 bg-gray-700 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500 text-white sm:text-sm"
            />
             <p className="text-xs text-gray-300 mt-1">Needed for private repositories or to avoid API rate limits. Token is sent to the server but not stored long-term.</p>
        </div>
       )}

        <div>
            <label htmlFor="language" className="block text-sm font-medium text-gray-300">
                Tutorial Language
            </label>
            <select
                id="language"
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-600 bg-gray-700 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500 text-white sm:text-sm"
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
       <details className="group border border-gray-600 rounded-md p-3">
            <summary className="text-sm font-medium text-gray-300 cursor-pointer group-open:mb-2">Advanced Options</summary>
            <div className="space-y-4">
                 <div>
                    <label htmlFor="includePatterns" className="block text-sm font-medium text-gray-300">
                        Include Patterns (comma-separated)
                    </label>
                    <input
                        type="text"
                        id="includePatterns"
                        value={includePatterns}
                        onChange={(e) => setIncludePatterns(e.target.value)}
                        className="mt-1 block w-full px-3 py-2 border border-gray-600 bg-gray-700 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500 text-white sm:text-sm"
                    />
                    <p className="text-xs text-gray-400 mt-1">
                        File patterns to include in the analysis (e.g., *.js, src/*.ts)
                    </p>
                </div>

                <div>
                    <label htmlFor="excludePatterns" className="block text-sm font-medium text-gray-300">
                        Exclude Patterns (comma-separated)
                    </label>
                    <input
                        type="text"
                        id="excludePatterns"
                        value={excludePatterns}
                        onChange={(e) => setExcludePatterns(e.target.value)}
                        className="mt-1 block w-full px-3 py-2 border border-gray-600 bg-gray-700 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500 text-white sm:text-sm"
                    />
                    <p className="text-xs text-gray-400 mt-1">
                        File patterns to exclude from the analysis (e.g., node_modules/*, *.test.js)
                    </p>
                </div>

                <div>
                    <label htmlFor="maxFileSize" className="block text-sm font-medium text-gray-300">
                        Max File Size (KB)
                    </label>
                    <input
                        type="number"
                        id="maxFileSize"
                        value={maxFileSize}
                        onChange={(e) => setMaxFileSize(e.target.value)}
                        className="mt-1 block w-full px-3 py-2 border border-gray-600 bg-gray-700 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500 text-white sm:text-sm"
                    />
                    <p className="text-xs text-gray-400 mt-1">
                        Maximum file size to include in the analysis (in KB)
                    </p>
                </div>
            </div>
       </details>

      {/* Action Buttons */}
      <div className="mt-6 flex items-center justify-between space-x-4">
        {downloadUrl && downloadFilename ? (
          <a
            href={downloadUrl}
            download={downloadFilename}
            className="inline-block w-full py-2 px-4 text-center text-white font-medium bg-green-600 hover:bg-green-700 rounded-md shadow transition-colors"
          >
            Download Tutorial
          </a>
        ) : (
          <button
            type="submit"
            disabled={isLoading}
            className="inline-block w-full py-2 px-4 text-white font-medium rounded-md shadow transition-colors bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? <LoadingSpinner /> : 'Generate Tutorial'}
          </button>
        )}
      </div>

      {/* Error display */}
      {error && <ErrorMessage message={error} />}
    </form>
  );
};

export default TutorialForm;