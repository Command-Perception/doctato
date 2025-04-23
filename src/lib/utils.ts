// lib/utils.ts
import micromatch from 'micromatch';
import { Abstraction, Relationship, RelationshipData } from "./types";

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

/**
 * Ensures all abstractions are included in at least one relationship
 * This is a fallback utility to fix LLM-generated relationships that might be missing some abstractions
 */
export function ensureAllAbstractionsInRelationships(
  relationships: RelationshipData,
  abstractions: Abstraction[]
): RelationshipData {
  // Create a set of all abstraction indices mentioned in relationships
  const mentionedIndices = new Set<number>();
  
  // Track both from and to indices
  relationships.details.forEach(rel => {
    mentionedIndices.add(rel.from);
    mentionedIndices.add(rel.to);
  });
  
  // Find any missing abstractions (not in any relationship)
  const missing = abstractions.map((_, i) => i).filter(i => !mentionedIndices.has(i));
  
  // If no missing abstractions, return original relationships
  if (missing.length === 0) {
    return relationships;
  }
  
  // Create a copy of the relationships to modify
  const updatedRelationships: RelationshipData = {
    summary: relationships.summary,
    details: [...relationships.details],
    relationships: [...(relationships.relationships || relationships.details)]
  };
  
  // For each missing abstraction, connect it to the most conceptually relevant abstraction
  // As a fallback, we'll connect to abstraction 0 (usually the most fundamental concept)
  missing.forEach(missingIndex => {
    const newRelationship: Relationship = {
      from: 0,  // Default to first abstraction
      to: missingIndex,
      label: "Related to", // Generic relationship
    };
    
    updatedRelationships.details.push(newRelationship);
    if (updatedRelationships.relationships) {
      updatedRelationships.relationships.push(newRelationship);
    }
  });
  
  return updatedRelationships;
}