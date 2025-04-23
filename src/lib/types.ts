// lib/types.ts
export interface CrawledFile {
    path: string;
    content: string;
    size: number;
  }
  
  export interface Abstraction {
    name: string;
    description: string;
    files: number[]; // Indices referencing the files array
  }
  
  export interface Relationship {
    from: number; // Index of source abstraction
    to: number; // Index of target abstraction
    label: string;
  }
  
  export interface RelationshipData {
    summary: string;
    details: Relationship[];
  }
  
  export interface ChapterInfo {
    index: number; // Original abstraction index
    num: number;   // Sequential chapter number (1-based)
    name: string;
    filename: string;
  }
  
  export interface GenerationInput {
    sourceType: 'repo' | 'upload';
    repoUrl?: string;
    uploadedFile?: File; // Used if sourceType is 'upload'
    projectName?: string;
    githubToken?: string;
    includePatterns?: string[];
    excludePatterns?: string[];
    maxFileSize?: number;
    language?: string;
  }
  
  export interface GenerationResult {
    success: boolean;
    outputBlob?: Blob; // The generated zip file
    fileName?: string; // e.g., "tutorial.zip"
    error?: string;
    finalOutputDir?: string; // Only relevant if saving server-side (less common for web)
  }
  
  export interface FileData {
      path: string;
      content: string;
  }
  
  export interface FetchedFilesResult {
      files: FileData[];
      projectName: string;
      skippedFiles?: { path: string; reason: string }[]; // Optional: Track skipped files
      error?: string;
  }
  
  export interface LlmLlmCallResult {
      success: boolean;
      text?: string;
      error?: string;
  }