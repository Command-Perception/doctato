// lib/utils.ts
import micromatch from 'micromatch';

/**
 * Basic sanitization for filenames. Replace non-alphanumeric chars with underscores.
 */
export function sanitizeFilename(name: string): string {
  if (!name) return 'untitled';
  // Remove potentially problematic characters, replace spaces/symbols with underscore
  // Keep basic alphanumeric, underscore, hyphen
  const sanitized = name.replace(/[^a-zA-Z0-9_.-]/g, '_');
  // Avoid leading/trailing underscores/dots and multiple consecutive underscores
  return sanitized.replace(/^[_.-]+|[_.-]+$/g, '').replace(/__+/g, '_');
}


/**
 * Checks if a file path should be included based on include/exclude patterns.
 */
export function shouldIncludeFile(
    filePath: string,
    includePatterns: string[] | undefined | null,
    excludePatterns: string[] | undefined | null
): boolean {
    const effectiveInclude = includePatterns && includePatterns.length > 0 ? includePatterns : ['**/*']; // Include all if no specific includes
    const effectiveExclude = excludePatterns || [];

    // Check exclusion first
    if (micromatch.isMatch(filePath, effectiveExclude)) {
        return false;
    }

    // Check inclusion
    return micromatch.isMatch(filePath, effectiveInclude);
}

// --- Helper to get content for specific file indices ---
// filesData is expected to be an array of { path: string; content: string }
export function getContentForIndices(filesData: { path: string; content: string }[], indices: number[]): Record<string, string> {
    const contentMap: Record<string, string> = {};
    const validIndices = new Set(indices); // Use Set for efficient lookup

    filesData.forEach((file, i) => {
        if (validIndices.has(i)) {
            // Use index + path as key for context, matching Python script
            contentMap[`${i} # ${file.path}`] = file.content;
        }
    });
    return contentMap;
}