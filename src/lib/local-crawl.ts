// lib/local-crawl.ts
import JSZip from 'jszip';
import { FileData, FetchedFilesResult } from './types';
import { shouldIncludeFile } from './utils';
import path from 'path'; // Use path for potential normalization

export async function processUploadedZip(
    zipFile: File,
    projectNameOverride: string | undefined,
    includePatterns: string[] | undefined,
    excludePatterns: string[] | undefined,
    maxFileSize: number
): Promise<FetchedFilesResult> {
    const files: FileData[] = [];
    const skippedFiles: { path: string; reason: string }[] = [];
    let projectName = projectNameOverride || zipFile.name.replace(/\.zip$/i, ''); // Derive from filename if not provided

    try {
        console.log(`Processing uploaded zip: ${zipFile.name} (${(zipFile.size / 1024).toFixed(1)} KB)`);
        const zip = await JSZip.loadAsync(await zipFile.arrayBuffer());
        const filePromises: Promise<void>[] = [];

        // Find common root directory if it exists (e.g., user zips a folder)
        let commonPrefix: string | null = null;
        zip.forEach((relativePath) => {
             if (!zip.files[relativePath].dir) { // Only consider files
                 if (commonPrefix === null) {
                     commonPrefix = relativePath.includes('/') ? relativePath.substring(0, relativePath.lastIndexOf('/') + 1) : '';
                 } else {
                     while (commonPrefix && !relativePath.startsWith(commonPrefix)) {
                         commonPrefix = commonPrefix.substring(0, commonPrefix.lastIndexOf('/'));
                         if (commonPrefix.includes('/')) {
                            commonPrefix = commonPrefix.substring(0, commonPrefix.lastIndexOf('/') + 1);
                         } else {
                            commonPrefix = '';
                         }
                     }
                 }
             }
        });
        const rootDir = commonPrefix || '';
        if (rootDir) {
            console.log(`Detected common root directory in zip: '${rootDir}'`);
            // Optionally adjust project name if a single folder was zipped
             if (!projectNameOverride && rootDir.endsWith('/') && rootDir.length > 1) {
                 const folderName = rootDir.substring(0, rootDir.length - 1).split('/').pop();
                 if (folderName) projectName = folderName;
             }
        }


        zip.forEach((relativePath, zipEntry) => {
            // Skip directories explicitly
            if (zipEntry.dir) {
                return;
            }

             // Normalize path separators to '/'
             const normalizedPath = relativePath.replace(/\\/g, '/');

             // Determine path relative to the detected root for matching/output
             const pathForMatching = normalizedPath.startsWith(rootDir)
                 ? normalizedPath.substring(rootDir.length)
                 : normalizedPath;

             // Skip empty paths (can happen with root dir detection)
             if (!pathForMatching) return;


            filePromises.push(
                (async () => {
                    try {
                         // Check patterns against relative path inside zip
                         if (!shouldIncludeFile(pathForMatching, includePatterns, excludePatterns)) {
                             // console.log(`Skipping ${pathForMatching} due to patterns`);
                             skippedFiles.push({ path: pathForMatching, reason: "Pattern exclusion/inclusion" });
                             return;
                         }

                        // Check file size *before* reading content if possible (async might not give size upfront)
                        // We'll re-check after reading
                        const fileContent = await zipEntry.async('string');
                        const fileSize = Buffer.byteLength(fileContent, 'utf8'); // Get actual size

                        if (fileSize > maxFileSize) {
                            console.log(`Skipping ${pathForMatching} due to size (${fileSize} > ${maxFileSize})`);
                            skippedFiles.push({ path: pathForMatching, reason: `Size limit (${fileSize} bytes)` });
                            return;
                        }

                        files.push({ path: pathForMatching, content: fileContent, size: fileSize });
                        // console.log(`Processed: ${pathForMatching} (${fileSize} bytes)`);
                    } catch (readError: any) {
                        console.error(`Error reading file ${relativePath} from zip: ${readError.message}`);
                         skippedFiles.push({ path: pathForMatching, reason: `Read error: ${readError.message}` });
                    }
                })()
            );
        });

        await Promise.all(filePromises);

        console.log(`Finished processing zip. Got ${files.length} files, skipped ${skippedFiles.length}.`);
        return { files, projectName, skippedFiles };

    } catch (error: any) {
        console.error("Error processing zip file:", error);
        return { files: [], projectName, error: `Failed to process zip file: ${error.message}` };
    }
}