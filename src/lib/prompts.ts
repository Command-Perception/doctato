// lib/prompts.ts

// --- Identify Abstractions Prompt ---
export function getIdentifyAbstractionsPrompt(
    projectName: string,
    filesContext: string, // String containing indexed file contents
    fileListingForPrompt: string, // Formatted string "- index # path"
    language: string = "english"
): string {
    const languageInstruction = language.toLowerCase() !== "english"
        ? `IMPORTANT: Generate the \`name\` and \`description\` for each abstraction in **${language}** language. Do NOT use English for these fields.\n\n`
        : "";
    const nameLangHint = language.toLowerCase() !== "english" ? ` (value in ${language})` : "";
    const descLangHint = language.toLowerCase() !== "english" ? ` (value in ${language})` : "";

    return `
For the project \`${projectName}\`:

Codebase Context:
${filesContext}

${languageInstruction}Analyze the codebase context.
Identify the top 5-10 core most important abstractions to help those new to the codebase.

For each abstraction, provide:
1. A concise \`name\`${nameLangHint}.
2. A beginner-friendly \`description\` explaining what it is with a simple analogy, in around 100 words${descLangHint}.
3. A list of relevant \`file_indices\` (integers) using the format \`idx # path/comment\`.

List of file indices and paths present in the context:
${fileListingForPrompt}

Format the output as a YAML list of dictionaries:

\`\`\`yaml
- name: |
    Query Processing${nameLangHint}
  description: |
    Explains what the abstraction does.
    It's like a central dispatcher routing requests.${descLangHint}
  file_indices:
    - 0 # path/to/file1.py
    - 3 # path/to/related.py
- name: |
    Query Optimization${nameLangHint}
  description: |
    Another core concept, similar to a blueprint for objects.${descLangHint}
  file_indices:
    - 5 # path/to/another.js
# ... up to 10 abstractions
\`\`\`

Provide the YAML output now:`;
}

// --- Analyze Relationships Prompt ---
export function getAnalyzeRelationshipsPrompt(
    projectName: string,
    abstractionListing: string, // Formatted string "index # AbstractionName"
    context: string, // Abstractions, descriptions, relevant code
    language: string = "english"
): string {
    const languageInstruction = language.toLowerCase() !== "english"
        ? `IMPORTANT: Generate the \`summary\` and relationship \`label\` fields in **${language}** language. Do NOT use English for these fields.\n\n`
        : "";
    const langHint = language.toLowerCase() !== "english" ? ` (in ${language})` : "";
    const listLangNote = language.toLowerCase() !== "english" ? ` (Names might be in ${language})` : "";


   return `
Based on the following abstractions and relevant code snippets from the project \`${projectName}\`:

List of Abstraction Indices and Names${list_lang_note}:
${abstractionListing}

Context (Abstractions, Descriptions, Code):
${context}

${languageInstruction}Please provide:
1. A high-level \`summary\` of the project's main purpose and functionality in a few beginner-friendly sentences${langHint}. Use markdown formatting with **bold** and *italic* text to highlight important concepts.
2. A list (\`relationships\`) describing the key interactions between these abstractions. For each relationship, specify:
    - \`from_abstraction\`: Index of the source abstraction (e.g., \`0 # AbstractionName1\`)
    - \`to_abstraction\`: Index of the target abstraction (e.g., \`1 # AbstractionName2\`)
    - \`label\`: A brief label for the interaction **in just a few words**${langHint} (e.g., "Manages", "Inherits", "Uses").
    Ideally the relationship should be backed by one abstraction calling or passing parameters to another.
    Simplify the relationship and exclude those non-important ones.

IMPORTANT: Make sure EVERY abstraction is involved in at least ONE relationship (either as source or target). Each abstraction index must appear at least once across all relationships.

Format the output as YAML:

\`\`\`yaml
summary: |
  A brief, simple explanation of the project${langHint}.
  Can span multiple lines with **bold** and *italic* for emphasis.
relationships:
  - from_abstraction: 0 # AbstractionName1
    to_abstraction: 1 # AbstractionName2
    label: "Manages"${langHint}
  - from_abstraction: 2 # AbstractionName3
    to_abstraction: 0 # AbstractionName1
    label: "Provides config"${langHint}
  # ... other relationships
\`\`\`

Now, provide the YAML output:
`;
}


// --- Order Chapters Prompt ---
export function getOrderChaptersPrompt(
    projectName: string,
    abstractionListing: string, // "index # Name" format
    context: string, // Summary, relationships
    language: string = "english"
): string {
    const listLangNote = language.toLowerCase() !== "english" ? ` (Names might be in ${language})` : "";

    return `
Given the following project abstractions and their relationships for the project \`${projectName}\`:

Abstractions (Index # Name)${listLangNote}:
${abstractionListing}

Context about relationships and project summary:
${context}

If you are going to make a tutorial for \`${projectName}\`, what is the best order to explain these abstractions, from first to last?
Ideally, first explain those that are the most important or foundational, perhaps user-facing concepts or entry points. Then move to more detailed, lower-level implementation details or supporting concepts.

Output the ordered list of abstraction indices, including the name in a comment for clarity. Use the format \`idx # AbstractionName\`.

\`\`\`yaml
- 2 # FoundationalConcept
- 0 # CoreClassA
- 1 # CoreClassB (uses CoreClassA)
- ...
\`\`\`

Now, provide the YAML output:
`;
}

// --- Write Chapter Prompt ---
export function getWriteChapterPrompt(
    projectName: string,
    chapterNum: number,
    abstractionName: string,
    abstractionDescription: string,
    fullChapterListing: string, // Full list of "Num. [Name](filename)"
    previousChaptersSummary: string, // Markdown content of previous chapters combined
    fileContextStr: string, // Relevant code snippets
    language: string = "english"
): string {
    const langCap = language.charAt(0).toUpperCase() + language.slice(1);
    const languageInstruction = language.toLowerCase() !== "english"
        ? `IMPORTANT: Write this ENTIRE tutorial chapter in **${langCap}**. Some input context (like concept name, description, chapter list, previous summary) might already be in ${langCap}, but you MUST translate ALL other generated content including explanations, examples, technical terms, and potentially code comments into ${langCap}. DO NOT use English anywhere except in code syntax, required proper nouns, or when specified. The entire output MUST be in ${langCap}.\n\n`
        : "";
    const conceptDetailsNote = language.toLowerCase() !== "english" ? ` (Note: Provided in ${langCap})` : "";
    const structureNote = language.toLowerCase() !== "english" ? ` (Note: Chapter names might be in ${langCap})` : "";
    const prevSummaryNote = language.toLowerCase() !== "english" ? ` (Note: This summary might be in ${langCap})` : "";
    const instructionLangNote = language.toLowerCase() !== "english" ? ` (in ${langCap})` : "";
    const mermaidLangNote = language.toLowerCase() !== "english" ? ` (Use ${langCap} for labels/text if appropriate)` : "";
    const codeCommentNote = language.toLowerCase() !== "english" ? ` (Translate to ${langCap} if possible, otherwise keep minimal English for clarity)` : "";
    const linkLangNote = language.toLowerCase() !== "english" ? ` (Use the ${langCap} chapter title from the structure above)` : "";
    const toneNote = language.toLowerCase() !== "english" ? ` (appropriate for ${langCap} readers)` : "";

    return `
${languageInstruction}Write a very beginner-friendly tutorial chapter (in Markdown format) for the project \`${projectName}\` about the concept: "${abstractionName}". This is Chapter ${chapterNum}.

Concept Details${conceptDetailsNote}:
- Name: ${abstractionName}
- Description:
${abstractionDescription}

Complete Tutorial Structure${structureNote}:
${fullChapterListing}

Context from previous chapters${prevSummaryNote}:
${previousChaptersSummary ? previousChaptersSummary : "This is the first chapter."}

Relevant Code Snippets (Code itself remains unchanged):
${fileContextStr ? fileContextStr : "No specific code snippets provided for this abstraction."}

Instructions for the chapter (Generate content in ${langCap} unless specified otherwise):
- Start with a clear heading (e.g., \`# Chapter ${chapterNum}: ${abstractionName}\`). Use the provided concept name.
- If this is not the first chapter, begin with a brief transition from the previous chapter${instructionLangNote}, referencing it with a proper Markdown link using its name${linkLangNote}.
- Begin with a high-level motivation explaining what problem this abstraction solves${instructionLangNote}. Start with a central use case as a concrete example. The whole chapter should guide the reader to understand how to solve this use case. Make it very minimal and friendly to beginners.
- If the abstraction is complex, break it down into key concepts. Explain each concept one-by-one in a very beginner-friendly way${instructionLangNote}.
- Explain how to use this abstraction to solve the use case${instructionLangNote}. Give example inputs and outputs for code snippets (if the output isn't values, describe at a high level what will happen${instructionLangNote}).
- Each code block should be BELOW 20 lines! If longer code blocks are needed, break them down into smaller pieces and walk through them one-by-one. Aggresively simplify the code to make it minimal. Use comments${codeCommentNote} to skip non-important implementation details. Each code block should have a beginner friendly explanation right after it${instructionLangNote}.
- Describe the internal implementation to help understand what's under the hood${instructionLangNote}. First provide a non-code or code-light walkthrough on what happens step-by-step when the abstraction is called${instructionLangNote}. It's recommended to use a simple sequenceDiagram with a dummy example - keep it minimal with at most 5 participants to ensure clarity. If participant name has space, use: \`participant QP as Query Processing\`. ${mermaidLangNote}.
- Then dive deeper into code for the internal implementation with references to files. Provide example code blocks, but make them similarly simple and beginner-friendly. Explain${instructionLangNote}.
- IMPORTANT: When you need to refer to other core abstractions covered in other chapters, ALWAYS use proper Markdown links like this: \`[Chapter Title](filename.md)\`. Use the Complete Tutorial Structure above to find the correct filename and the chapter title${linkLangNote}. Translate the surrounding text.
- Use mermaid diagrams to illustrate complex concepts (\`\`\`mermaid\`\`\` format). ${mermaidLangNote}.
- Heavily use analogies and examples throughout${instructionLangNote} to help beginners understand.
- End the chapter with a brief conclusion that summarizes what was learned${instructionLangNote} and provides a transition to the next chapter${instructionLangNote}. If there is a next chapter, use a proper Markdown link: \`[Next Chapter Title](next_chapter_filename)\`${linkLangNote}.
- Ensure the tone is welcoming and easy for a newcomer to understand${toneNote}.
- Output *only* the Markdown content for this chapter.

Now, directly provide a super beginner-friendly Markdown output (DON'T need \`\`\`markdown\`\`\` tags):
`;
}