// app/api/generate-tutorial/route.ts
import { NextRequest, NextResponse } from 'next/server';
import {
    GenerationInput, Abstraction, RelationshipData, CrawledFile,
    ChapterInfo, FileData, FetchedFilesResult
} from '@/lib/types';
import { DEFAULT_INCLUDE_PATTERNS, DEFAULT_EXCLUDE_PATTERNS, DEFAULT_MAX_FILE_SIZE } from '@/lib/patterns';
import { crawlGitHubFiles } from '@/lib/github';
import { processUploadedZip } from '@/lib/local-crawl';
import { callLlm } from '@/lib/llm';
import {
    getIdentifyAbstractionsPrompt, getAnalyzeRelationshipsPrompt,
    getOrderChaptersPrompt, getWriteChapterPrompt
} from '@/lib/prompts';
import { getContentForIndices, sanitizeFilename } from '@/lib/utils';
import YAML from 'yaml';
import JSZip from 'jszip';

// Increase max duration for Vercel (adjust as needed, check plan limits)
// See: https://vercel.com/docs/functions/configuring-functions/duration
export const maxDuration = 300; // 5 minutes (Pro plan typical max)

// Helper Function for LLM calls with retry and validation
async function callLlmWithRetry<T>(
    promptGenerator: () => string,
    parser: (text: string) => T,
    validator: (parsed: T) => boolean | string, // Return true or error message string
    maxRetries = 3,
    useCache = true
): Promise<{ success: boolean; data?: T; error?: string }> {
    let lastError: string = "Failed after multiple retries.";
    for (let i = 0; i < maxRetries; i++) {
        try {
            const prompt = promptGenerator();
            const llmResult = await callLlm(prompt, useCache);

            if (!llmResult.success || !llmResult.text) {
                lastError = llmResult.error || "LLM call failed to return text.";
                console.error(`LLM attempt ${i + 1} failed: ${lastError}`);
                if (i < maxRetries - 1) await new Promise(res => setTimeout(res, 2000 * (i + 1))); // Exponential backoff
                continue;
            }

            // Attempt parsing (extract YAML/JSON etc.)
            let parsedData: T;
            try {
                 // Extract content within ```yaml ... ```
                 const match = llmResult.text.match(/```yaml\s*([\s\S]*?)\s*```/);
                 if (!match || !match[1]) {
                     throw new Error("Could not find YAML block in LLM response.");
                 }
                 parsedData = parser(match[1]);
            } catch (parseError: any) {
                 lastError = `Failed to parse LLM response: ${parseError.message}. Response:\n${llmResult.text.substring(0,500)}...`;
                 console.error(`Parse attempt ${i + 1} failed: ${lastError}`);
                 if (i < maxRetries - 1) await new Promise(res => setTimeout(res, 1000)); // Shorter delay for parsing errors
                 continue; // Retry LLM call
            }

            // Attempt validation
            const validationResult = validator(parsedData);
            if (validationResult === true) {
                return { success: true, data: parsedData }; // Success!
            } else {
                lastError = `LLM response validation failed: ${validationResult}. Parsed:\n${JSON.stringify(parsedData).substring(0,500)}...`;
                console.error(`Validation attempt ${i + 1} failed: ${lastError}`);
                 if (i < maxRetries - 1) await new Promise(res => setTimeout(res, 1000));
                 continue; // Retry LLM call
            }

        } catch (error: any) {
            lastError = `Error during LLM interaction (attempt ${i + 1}): ${error.message}`;
            console.error(lastError, error);
            if (i < maxRetries - 1) await new Promise(res => setTimeout(res, 2000 * (i + 1)));
        }
    }
    return { success: false, error: lastError };
}


export async function POST(request: NextRequest) {
    console.log("API route /api/generate-tutorial hit");
    let requestBody: GenerationInput;

    try {
        // Handle multipart/form-data for file uploads
        const formData = await request.formData();
        const data: Record<string, any> = {};
        let uploadedFile: File | undefined = undefined;

        formData.forEach((value, key) => {
            if (key === 'uploadedFile' && value instanceof File && value.size > 0) {
                uploadedFile = value;
                data[key] = value; // Keep file object
                 console.log(`Received file: ${value.name}, size: ${value.size}`);
            } else if (key === 'includePatterns' || key === 'excludePatterns') {
                 // Assume comma-separated strings from basic textarea
                 data[key] = typeof value === 'string' && value.trim() ? value.split(',').map(s => s.trim()).filter(Boolean) : [];
            } else if (key === 'maxFileSize') {
                 data[key] = typeof value === 'string' ? parseInt(value, 10) : undefined;
            } else if (typeof value === 'string') {
                 data[key] = value;
            }
        });

         // Basic type assertion after parsing form data
         requestBody = data as unknown as GenerationInput;
         if (uploadedFile) {
            requestBody.uploadedFile = uploadedFile; // Ensure file object is set correctly
         }

        console.log("Parsed request body:", { ...requestBody, uploadedFile: requestBody.uploadedFile ? { name: requestBody.uploadedFile.name, size: requestBody.uploadedFile.size, type: requestBody.uploadedFile.type } : undefined });

        // --- Validation ---
        if (!requestBody.sourceType || (requestBody.sourceType === 'repo' && !requestBody.repoUrl) || (requestBody.sourceType === 'upload' && !requestBody.uploadedFile)) {
            return NextResponse.json({ success: false, error: "Missing required fields: sourceType and either repoUrl or uploadedFile." }, { status: 400 });
        }

    } catch (error: any) {
        console.error("Error parsing request:", error);
        return NextResponse.json({ success: false, error: `Invalid request format: ${error.message}` }, { status: 400 });
    }

    const {
        sourceType,
        repoUrl,
        uploadedFile,
        projectName: projectNameInput,
        githubToken, // User might provide this
        includePatterns: includeInput,
        excludePatterns: excludeInput,
        maxFileSize: maxFileSizeInput,
        language = "english"
    } = requestBody;

    const effectiveInclude = includeInput && includeInput.length > 0 ? includeInput : DEFAULT_INCLUDE_PATTERNS;
    const effectiveExclude = excludeInput && excludeInput.length > 0 ? excludeInput : DEFAULT_EXCLUDE_PATTERNS;
    const effectiveMaxSize = typeof maxFileSizeInput === 'number' && !isNaN(maxFileSizeInput) ? maxFileSizeInput : DEFAULT_MAX_FILE_SIZE;
    const token = githubToken || process.env.GITHUB_TOKEN; // Prioritize user input, fallback to env

    try {
        // --- 1. Fetch Files ---
        console.log(`Starting file fetching (${sourceType})...`);
        let fetchResult: FetchedFilesResult;
        if (sourceType === 'repo' && repoUrl) {
            fetchResult = await crawlGitHubFiles(repoUrl, token, effectiveInclude, effectiveExclude, effectiveMaxSize);
        } else if (sourceType === 'upload' && uploadedFile) {
            fetchResult = await processUploadedZip(uploadedFile, projectNameInput, effectiveInclude, effectiveExclude, effectiveMaxSize);
        } else {
            throw new Error("Invalid source type or missing data."); // Should be caught by initial validation
        }

        if (fetchResult.error || fetchResult.files.length === 0) {
            return NextResponse.json({ success: false, error: fetchResult.error || "No files found or fetched. Check patterns, path, token, and size limits." }, { status: 400 });
        }

        const fetchedFiles: FileData[] = fetchResult.files;
        const projectName = projectNameInput || fetchResult.projectName; // Use derived name if not provided
        console.log(`Fetched ${fetchedFiles.length} files for project: ${projectName}`);
         if(fetchResult.skippedFiles && fetchResult.skippedFiles.length > 0){
             console.log(`Skipped ${fetchResult.skippedFiles.length} files during fetch.`);
             // Optionally log skipped file details here if needed
         }

        // --- 2. Identify Abstractions ---
        console.log("Identifying abstractions...");
        const filesContext = fetchedFiles.map((f, i) => `--- File Index ${i}: ${f.path} ---\n${f.content}`).join('\n\n');
        const fileListingForPrompt = fetchedFiles.map((f, i) => `- ${i} # ${f.path}`).join('\n');

        const abstractionsResult = await callLlmWithRetry<Abstraction[]>(
            () => getIdentifyAbstractionsPrompt(projectName, filesContext, fileListingForPrompt, language),
            (text) => YAML.parse(text) as Abstraction[],
             (parsed) => {
                 if (!Array.isArray(parsed)) return "Expected a list of abstractions.";
                 for (const item of parsed) {
                     if (!item || typeof item !== 'object' || !item.name || !item.description || !item.file_indices) return `Invalid item structure: ${JSON.stringify(item).substring(0,100)}`;
                     if (typeof item.name !== 'string' || typeof item.description !== 'string' || !Array.isArray(item.file_indices)) return `Invalid types in item: ${item.name}`;
                     // Validate indices format (can be int or "int # path")
                     const indices: number[] = [];
                     for (const idxEntry of item.file_indices) {
                         try {
                             let idx: number;
                             if (typeof idxEntry === 'number') idx = idxEntry;
                             else if (typeof idxEntry === 'string' && idxEntry.includes('#')) idx = parseInt(idxEntry.split('#')[0].trim(), 10);
                             else idx = parseInt(String(idxEntry).trim(), 10);

                             if (isNaN(idx) || idx < 0 || idx >= fetchedFiles.length) return `Invalid file index ${idxEntry} in item ${item.name}. Max index is ${fetchedFiles.length - 1}.`;
                             indices.push(idx);
                         } catch { return `Could not parse index from ${idxEntry} in item ${item.name}`; }
                     }
                     item.files = [...new Set(indices)].sort((a, b) => a - b); // Store validated indices
                 }
                 return true;
             }
        );

        if (!abstractionsResult.success || !abstractionsResult.data) {
            return NextResponse.json({ success: false, error: `Failed to identify abstractions: ${abstractionsResult.error}` }, { status: 500 });
        }
        const abstractions: Abstraction[] = abstractionsResult.data;
        console.log(`Identified ${abstractions.length} abstractions.`);

        // --- 3. Analyze Relationships ---
        console.log("Analyzing relationships...");
        let relationshipContext = "Identified Abstractions:\n";
        const allRelevantIndices = new Set<number>();
        const abstractionInfoForPrompt: string[] = [];
        abstractions.forEach((abstr, i) => {
            const fileIndicesStr = abstr.files.join(", ");
            relationshipContext += `- Index ${i}: ${abstr.name} (Relevant file indices: [${fileIndicesStr}])\n  Description: ${abstr.description}\n`;
            abstractionInfoForPrompt.push(`${i} # ${abstr.name}`);
            abstr.files.forEach(idx => allRelevantIndices.add(idx));
        });
        relationshipContext += "\nRelevant File Snippets (Referenced by Index and Path):\n";
        const relevantFilesContentMap = getContentForIndices(fetchedFiles, Array.from(allRelevantIndices));
        relationshipContext += Object.entries(relevantFilesContentMap)
            .map(([idxPath, content]) => `--- File: ${idxPath} ---\n${content}`)
            .join("\n\n");

        const relationshipsResult = await callLlmWithRetry<RelationshipData>(
             () => getAnalyzeRelationshipsPrompt(projectName, abstractionInfoForPrompt.join('\n'), relationshipContext, language),
             (text) => YAML.parse(text) as RelationshipData,
             (parsed) => {
                 if (!parsed || typeof parsed !== 'object' || typeof parsed.summary !== 'string' || !Array.isArray(parsed.relationships)) return "Invalid structure: Expected summary (string) and relationships (list).";
                 const mentionedIndices = new Set<number>();
                 for (const rel of parsed.relationships) {
                     if (!rel || typeof rel !== 'object' || rel.from_abstraction === undefined || rel.to_abstraction === undefined || typeof rel.label !== 'string') return `Invalid relationship item structure: ${JSON.stringify(rel).substring(0,100)}`;
                     try {
                        const fromIdx = parseInt(String(rel.from_abstraction).split('#')[0].trim(), 10);
                        const toIdx = parseInt(String(rel.to_abstraction).split('#')[0].trim(), 10);
                        if (isNaN(fromIdx) || isNaN(toIdx) || fromIdx < 0 || fromIdx >= abstractions.length || toIdx < 0 || toIdx >= abstractions.length) return `Invalid index in relationship: from=${rel.from_abstraction}, to=${rel.to_abstraction}`;
                         rel.from = fromIdx; // Add parsed index
                         rel.to = toIdx;     // Add parsed index
                         mentionedIndices.add(fromIdx);
                         mentionedIndices.add(toIdx);
                     } catch { return `Could not parse indices from relationship: ${JSON.stringify(rel).substring(0,100)}`; }
                 }
                  // Check if all abstractions are mentioned
                 if (mentionedIndices.size !== abstractions.length) {
                     const missing = abstractions.map((_, i) => i).filter(i => !mentionedIndices.has(i));
                     return `Validation Error: Not all abstractions are included in relationships. Missing: ${missing.join(', ')}. Please ensure every abstraction index appears at least once.`;
                 }
                 return true;
             }
         );

        if (!relationshipsResult.success || !relationshipsResult.data) {
            return NextResponse.json({ success: false, error: `Failed to analyze relationships: ${relationshipsResult.error}` }, { status: 500 });
        }
        const relationships: RelationshipData = relationshipsResult.data;
        console.log("Analyzed relationships.");

        // --- 4. Order Chapters ---
        console.log("Ordering chapters...");
         let orderContext = `Project Summary:\n${relationships.summary}\n\n`;
         orderContext += "Relationships (Indices refer to abstractions above):\n";
         relationships.details.forEach(rel => {
             const fromName = abstractions[rel.from]?.name || `Unknown(${rel.from})`;
             const toName = abstractions[rel.to]?.name || `Unknown(${rel.to})`;
             orderContext += `- From ${rel.from} (${fromName}) to ${rel.to} (${toName}): ${rel.label}\n`;
         });

         const orderResult = await callLlmWithRetry<Array<string | number>>(
             () => getOrderChaptersPrompt(projectName, abstractionInfoForPrompt.join('\n'), orderContext, language),
             (text) => YAML.parse(text) as Array<string | number>,
             (parsed) => {
                 if (!Array.isArray(parsed)) return "Expected a list for chapter order.";
                 const seenIndices = new Set<number>();
                 const orderedIndices: number[] = [];
                 for (const entry of parsed) {
                    try {
                         let idx: number;
                         if (typeof entry === 'number') idx = entry;
                         else if (typeof entry === 'string' && entry.includes('#')) idx = parseInt(entry.split('#')[0].trim(), 10);
                         else idx = parseInt(String(entry).trim(), 10);

                         if (isNaN(idx) || idx < 0 || idx >= abstractions.length) return `Invalid index ${entry} in ordered list. Max index is ${abstractions.length - 1}.`;
                         if (seenIndices.has(idx)) return `Duplicate index ${idx} found in ordered list.`;
                         orderedIndices.push(idx);
                         seenIndices.add(idx);
                    } catch { return `Could not parse index from ordered list entry: ${entry}`; }
                 }
                  if (orderedIndices.length !== abstractions.length) {
                      const missing = abstractions.map((_, i) => i).filter(i => !seenIndices.has(i));
                      return `Ordered list length (${orderedIndices.length}) doesn't match abstraction count (${abstractions.length}). Missing: ${missing.join(',')}`;
                  }
                 return true; // Store validated indices on the side if needed, or just validate here
             }
         );

        if (!orderResult.success || !orderResult.data) {
            return NextResponse.json({ success: false, error: `Failed to order chapters: ${orderResult.error}` }, { status: 500 });
        }
        // Parse indices from the raw list again after validation
         const chapterOrder: number[] = orderResult.data.map(entry => {
             if (typeof entry === 'number') return entry;
             if (typeof entry === 'string' && entry.includes('#')) return parseInt(entry.split('#')[0].trim(), 10);
             return parseInt(String(entry).trim(), 10);
         });
        console.log(`Determined chapter order: ${chapterOrder.join(', ')}`);

        // --- 5. Write Chapters (Sequential for Context) ---
        console.log("Writing chapters...");
        const chapterContents: string[] = [];
        const chapterFileInfos: ChapterInfo[] = [];
        let previousChaptersSummary = "";
        const fullChapterListingLines: string[] = [];

        // First pass to generate filenames and the full listing
        chapterOrder.forEach((absIndex, i) => {
             if (absIndex >= 0 && absIndex < abstractions.length) {
                 const chapterNum = i + 1;
                 const chapterName = abstractions[absIndex].name;
                 const safeName = sanitizeFilename(chapterName) || `chapter_${chapterNum}`;
                 const filename = `${String(chapterNum).padStart(2, '0')}_${safeName}.md`;
                 chapterFileInfos.push({ index: absIndex, num: chapterNum, name: chapterName, filename });
                 fullChapterListingLines.push(`${chapterNum}. [${chapterName}](${filename})`);
             } else {
                 console.warn(`Invalid abstraction index ${absIndex} found in chapter order. Skipping.`);
             }
         });
         const fullChapterListing = fullChapterListingLines.join('\n');


        // Second pass to write content
        for (let i = 0; i < chapterFileInfos.length; i++) {
             const currentChapterInfo = chapterFileInfos[i];
             const abstractionDetails = abstractions[currentChapterInfo.index];
             const relatedFileIndices = abstractionDetails.files || [];
             const relatedFilesContentMap = getContentForIndices(fetchedFiles, relatedFileIndices);
             const fileContextStr = Object.entries(relatedFilesContentMap)
                 .map(([idxPath, content]) => `--- File: ${idxPath.split('# ')[1] || idxPath} ---\n${content}`)
                 .join("\n\n");

             console.log(`Writing Chapter ${currentChapterInfo.num}: ${currentChapterInfo.name}...`);

            const chapterResult = await callLlmWithRetry<string>(
                () => getWriteChapterPrompt(
                    projectName,
                    currentChapterInfo.num,
                    currentChapterInfo.name,
                    abstractionDetails.description,
                    fullChapterListing,
                    previousChaptersSummary,
                    fileContextStr,
                    language
                ),
                (text) => text, // Expect raw Markdown
                (parsed) => {
                    // Basic validation: Check if it starts reasonably like markdown
                    if (typeof parsed !== 'string' || parsed.length < 10) return "Chapter content seems too short or invalid.";
                    // Check for expected heading (allow slight variations)
                    const headingRegex = new RegExp(`^#\\s*Chapter\\s+${currentChapterInfo.num}[\\s:]*${currentChapterInfo.name.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}`, 'i'); // Case-insensitive, flexible spacing/colon
                     if (!parsed.trim().match(headingRegex)) {
                         console.warn(`Chapter ${currentChapterInfo.num} missing or incorrect heading. Adding default.`);
                         parsed = `# Chapter ${currentChapterInfo.num}: ${currentChapterInfo.name}\n\n${parsed.trim()}`;
                     }
                    return true;
                },
                3, // Retry chapter writing
                false // Don't cache chapter writing prompts as context changes
            );


            if (!chapterResult.success || !chapterResult.data) {
                // Proceed with a placeholder or skip? For now, return error.
                return NextResponse.json({ success: false, error: `Failed to write chapter ${currentChapterInfo.num} (${currentChapterInfo.name}): ${chapterResult.error}` }, { status: 500 });
            }

            let finalChapterContent = chapterResult.data;
             // Add attribution
             if (!finalChapterContent.endsWith('\n\n')) finalChapterContent += '\n\n';
             finalChapterContent += `---\n\nGenerated by [AI Codebase Knowledge Builder](https://github.com/The-Pocket/Tutorial-Codebase-Knowledge)`; // Keep attribution in English

            chapterContents.push(finalChapterContent);
            previousChaptersSummary += `\n\n---\n\n${finalChapterContent}`; // Append for next chapter's context
        }
        console.log(`Finished writing ${chapterContents.length} chapters.`);

        // --- 6. Combine Tutorial (Generate index.md and Zip) ---
        console.log("Combining tutorial into zip...");
        const zip = new JSZip();

        // Generate Mermaid Diagram
        const mermaidLines = ["flowchart TD"];
        abstractions.forEach((abstr, i) => {
            const nodeId = `A${i}`;
            const sanitizedName = (abstr.name || `Abstraction ${i}`).replace(/"/g, ''); // Sanitize
            mermaidLines.push(`    ${nodeId}["${sanitizedName}"]`); // Node label
        });
        relationships.details.forEach(rel => {
            const fromNodeId = `A${rel.from}`;
            const toNodeId = `A${rel.to}`;
            let edgeLabel = (rel.label || '').replace(/"/g, '').replace(/\n/g, ' '); // Sanitize
            if (edgeLabel.length > 30) edgeLabel = edgeLabel.substring(0, 27) + "...";
            mermaidLines.push(`    ${fromNodeId} -- "${edgeLabel}" --> ${toNodeId}`); // Edge label
        });
        const mermaidDiagram = mermaidLines.join('\n');

        // Generate index.md
        let indexContent = `# Tutorial: ${projectName}\n\n`;
        indexContent += `${relationships.summary}\n\n`; // Use potentially translated summary
        if (repoUrl) indexContent += `**Source Repository:** [${repoUrl}](${repoUrl})\n\n`;
        else if(uploadedFile) indexContent += `**Source:** Uploaded File (${uploadedFile.name})\n\n`;

        indexContent += "## Core Concepts Diagram\n\n"; // Keep section header in English
        indexContent += "```mermaid\n";
        indexContent += mermaidDiagram + "\n";
        indexContent += "```\n\n";
        indexContent += `## Chapters\n\n`; // Keep section header in English
        indexContent += fullChapterListing; // Uses potentially translated names/links

        // Add attribution to index
         indexContent += `\n\n---\n\nGenerated by [AI Codebase Knowledge Builder](https://github.com/The-Pocket/Tutorial-Codebase-Knowledge)`;

        zip.file("index.md", indexContent);
        console.log("Added index.md to zip.");

        // Add chapter files
        chapterFileInfos.forEach((info, i) => {
             if (i < chapterContents.length) {
                 zip.file(info.filename, chapterContents[i]);
                 console.log(`Added ${info.filename} to zip.`);
             }
        });

        // Generate zip blob
        const zipBlob = await zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } });
        const zipFileName = `${sanitizeFilename(projectName)}_tutorial.zip`;
        console.log(`Generated zip file: ${zipFileName} (${(zipBlob.size / 1024).toFixed(1)} KB)`);

        // --- 7. Return Zip File ---
        const headers = new Headers({
            'Content-Type': 'application/zip',
            'Content-Disposition': `attachment; filename="${zipFileName}"`,
        });

        return new NextResponse(zipBlob, { status: 200, headers });

    } catch (error: any) {
        console.error("Unhandled error during tutorial generation:", error);
        return NextResponse.json({ success: false, error: `Server error: ${error.message}` }, { status: 500 });
    }
}