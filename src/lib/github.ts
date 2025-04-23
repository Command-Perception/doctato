// lib/github.ts
import { Octokit } from "octokit";
import { FileData, FetchedFilesResult } from "./types";
import { shouldIncludeFile } from "./utils";
import { RequestError } from "@octokit/request-error"; // Import RequestError for specific error handling

// Rate limit handling (basic)
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;

async function fetchWithRetry(url: string, options: RequestInit, retries = MAX_RETRIES): Promise<Response> {
    try {
        const response = await fetch(url, options);
        if (response.status === 403 && response.headers.get('X-RateLimit-Remaining') === '0') {
            if (retries > 0) {
                const resetTime = parseInt(response.headers.get('X-RateLimit-Reset') || '0', 10);
                const waitTime = Math.max(resetTime * 1000 - Date.now(), 0) + 1000; // Wait 1s past reset
                console.warn(`GitHub Rate Limit hit. Retrying in ${waitTime / 1000}s...`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
                return fetchWithRetry(url, options, retries - 1);
            } else {
                throw new Error("GitHub Rate Limit exceeded after multiple retries.");
            }
        }
         if (!response.ok && response.status !== 404) { // Allow 404 to propagate
             throw new Error(`GitHub API Error: ${response.status} ${response.statusText} for URL ${url}`);
         }
        return response;
    } catch (error) {
        if (retries > 0) {
            console.warn(`Fetch failed for ${url}. Retrying in ${RETRY_DELAY_MS / 1000}s... Error: ${error}`);
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
            return fetchWithRetry(url, options, retries - 1);
        }
        throw error; // Rethrow after max retries
    }
}


export async function crawlGitHubFiles(
    repoUrl: string,
    token: string | undefined,
    includePatterns: string[] | undefined,
    excludePatterns: string[] | undefined,
    maxFileSize: number
): Promise<FetchedFilesResult> {
    const files: FileData[] = [];
    const skippedFiles: { path: string; reason: string }[] = [];
    let projectName = '';

    try {
        // 1. Parse URL
        const parsedUrl = new URL(repoUrl);
        const pathParts = parsedUrl.pathname.slice(1).split('/');
        if (pathParts.length < 2 || parsedUrl.hostname !== 'github.com') {
            throw new Error("Invalid GitHub repository URL format.");
        }
        const owner = pathParts[0];
        const repo = pathParts[1];
        projectName = repo; // Default project name

        let ref = "main"; // Default branch
        let repoSubdir = "";

        const treeIndex = pathParts.indexOf("tree");
        if (treeIndex !== -1 && treeIndex + 1 < pathParts.length) {
            ref = pathParts[treeIndex + 1];
            repoSubdir = pathParts.slice(treeIndex + 2).join('/');
        } else if (pathParts.length > 2 && pathParts[2] !== 'tree') {
             // If no 'tree', assume rest is path from root, default branch (less common URL structure)
             repoSubdir = pathParts.slice(2).join('/');
        }

        // 2. Setup Octokit or Fetch Headers
        const headers: HeadersInit = {
            "Accept": "application/vnd.github.v3+json",
            "X-GitHub-Api-Version": "2022-11-28" // Recommended header
        };
        if (token) {
            headers["Authorization"] = `Bearer ${token}`;
        }

        // 3. Get Tree Recursively
        // Note: Recursive fetch can be large. Consider pagination for huge repos.
        const apiUrl = `https://api.github.com/repos/${owner}/${repo}/git/trees/${ref}?recursive=1`;
        console.log(`Fetching tree: ${apiUrl}`);
        const treeResponse = await fetchWithRetry(apiUrl, { headers });

        if (treeResponse.status === 404) {
             return { files: [], projectName, error: `Repository, branch, or commit '${ref}' not found. Check URL and token permissions.` };
        }
         if (!treeResponse.ok) {
             throw new Error(`Failed to fetch repository tree: ${treeResponse.statusText}`);
         }

        const treeData = await treeResponse.json();

        if (treeData.truncated) {
            console.warn(`Warning: GitHub tree data was truncated for ${repoUrl}. Some files might be missing.`);
            // Potentially implement pagination here if needed
        }

        // 4. Filter and Fetch Blobs
        const filesToFetch: { path: string; url: string; size: number }[] = [];
        for (const item of treeData.tree) {
            if (item.type === "blob") {
                 // Check if file is within the target subdirectory (if specified)
                if (repoSubdir && !item.path.startsWith(repoSubdir + '/')) {
                    if (item.path !== repoSubdir) { // Allow fetching single file at subdir path
                        continue;
                    }
                }

                // Use relative path within the subdir for pattern matching
                const relativePath = repoSubdir ? item.path.substring(repoSubdir.length).replace(/^\//, '') : item.path;

                // Check patterns
                if (!shouldIncludeFile(relativePath, includePatterns, excludePatterns)) {
                   // console.log(`Skipping ${relativePath} due to patterns`);
                    skippedFiles.push({ path: relativePath, reason: "Pattern exclusion/inclusion" });
                    continue;
                }

                // Check size
                if (item.size > maxFileSize) {
                    console.log(`Skipping ${relativePath} due to size (${item.size} > ${maxFileSize})`);
                    skippedFiles.push({ path: relativePath, reason: `Size limit (${item.size} bytes)` });
                    continue;
                }

                // Base64 content is not directly available in tree, need to fetch blob
                // We use the git/blobs endpoint which returns base64 content
                const blobApiUrl = `https://api.github.com/repos/${owner}/${repo}/git/blobs/${item.sha}`;
                 filesToFetch.push({ path: relativePath, url: blobApiUrl, size: item.size });
            }
        }

        // 5. Fetch file contents in parallel (with concurrency limit)
        const concurrencyLimit = 10; // Adjust as needed
        let activeFetches = 0;
        let fetchIndex = 0;
        const totalFiles = filesToFetch.length;
        console.log(`Fetching content for ${totalFiles} files...`);

        const processFetch = async (fileInfo: { path: string; url: string; size: number }) => {
            try {
                const blobResponse = await fetchWithRetry(fileInfo.url, { headers });
                if (!blobResponse.ok) {
                    throw new Error(`Failed to fetch blob ${fileInfo.path}: ${blobResponse.statusText}`);
                }
                const blobData = await blobResponse.json();

                if (blobData.encoding !== 'base64') {
                    console.warn(`Skipping ${fileInfo.path}: Unexpected encoding '${blobData.encoding}'`);
                     skippedFiles.push({ path: fileInfo.path, reason: `Unexpected encoding: ${blobData.encoding}` });
                    return; // Skip non-base64 encoded files
                }

                // Decode base64 content
                const content = Buffer.from(blobData.content, 'base64').toString('utf-8');

                // Final check if decoded size is reasonable (optional, approximate)
                // const estimatedDecodedSize = Buffer.byteLength(content, 'utf8');
                // if (estimatedDecodedSize > maxFileSize * 1.1) { // Allow some leeway
                //     console.warn(`Skipping ${fileInfo.path}: Decoded size potentially exceeds limit.`);
                //     return;
                // }

                files.push({ path: fileInfo.path, content, size: fileInfo.size });
                // console.log(`Fetched: ${fileInfo.path} (${fileInfo.size} bytes)`);

            } catch (error: any) {
                console.error(`Error fetching ${fileInfo.path}: ${error.message}`);
                skippedFiles.push({ path: fileInfo.path, reason: `Fetch error: ${error.message}` });
            } finally {
                activeFetches--;
                // Trigger next fetch if available
                 /* eslint-disable no-use-before-define */
                triggerNext();
                 /* eslint-enable no-use-before-define */
            }
        };

        const triggerNext = () => {
            while (activeFetches < concurrencyLimit && fetchIndex < totalFiles) {
                activeFetches++;
                const currentIndex = fetchIndex++;
                // Show progress
                if(currentIndex % 50 === 0 || currentIndex === totalFiles -1){
                     console.log(`Fetching file ${currentIndex + 1}/${totalFiles}...`);
                }
                processFetch(filesToFetch[currentIndex]);
            }
            // Resolve promise when all fetches are complete
             if (fetchIndex === totalFiles && activeFetches === 0) {
                 /* eslint-disable no-use-before-define */
                 allFetchesDone();
                 /* eslint-enable no-use-before-define */
             }
        };

        let allFetchesDone: () => void;
        const completionPromise = new Promise<void>(resolve => {
            allFetchesDone = resolve;
        });


        triggerNext(); // Start the fetching process
        await completionPromise; // Wait for all parallel fetches to complete


        console.log(`Finished fetching files. Got ${files.length}, skipped ${skippedFiles.length}.`);

        return { files, projectName, skippedFiles };

    } catch (error: any) {
        console.error("Error crawling GitHub repository:", error);
        // Handle specific Octokit/fetch errors if possible
        if (error instanceof RequestError && error.status === 404) {
            return { files: [], projectName, error: "Repository not found or invalid token." };
        }
        if (error.message.includes("Rate Limit")) {
            return { files: [], projectName, error: "GitHub API Rate Limit exceeded." };
        }
        return { files: [], projectName, error: `Failed to crawl repository: ${error.message}` };
    }
}