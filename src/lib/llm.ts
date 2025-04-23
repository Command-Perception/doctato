// lib/llm.ts
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";
import { LlmLlmCallResult } from './types';

// Basic in-memory cache (Replace with Redis/etc. for production)
const cache = new Map<string, string>();

const API_KEY = process.env.GEMINI_API_KEY;
const MODEL_NAME = process.env.GEMINI_MODEL || "gemini-1.5-flash"; // Use Flash default, cheaper/faster

if (!API_KEY) {
    console.error("Error: GEMINI_API_KEY environment variable is not set.");
}

const genAI = API_KEY ? new GoogleGenerativeAI(API_KEY) : null;
const model = genAI ? genAI.getGenerativeModel({ model: MODEL_NAME }) : null;

// Configuration for safety settings - adjust as needed
const safetySettings = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
];

// Configuration for generation - adjust temperature, etc.
const generationConfig = {
  temperature: 0.3, // Lower temperature for more deterministic code analysis
  topK: 1,
  topP: 1,
  maxOutputTokens: 8192, // Increase if needed, check model limits
};


export async function callLlm(prompt: string, useCache: boolean = true): Promise<LlmLlmCallResult> {
    console.log("LLM Call initiated...");
    // Log prompt (careful with large prompts in production logs)
    // console.log("PROMPT:", prompt.substring(0, 500) + "..."); // Log snippet

    if (!model || !genAI) {
        return { success: false, error: "LLM client not initialized. Check API Key." };
    }

    // Check cache
    if (useCache && cache.has(prompt)) {
        console.log("LLM Cache HIT");
        const cachedResponse = cache.get(prompt)!;
        // console.log("RESPONSE (cached):", cachedResponse.substring(0, 500) + "...");
        return { success: true, text: cachedResponse };
    }
    console.log("LLM Cache MISS");

    try {
        const result = await model.generateContent({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig,
            safetySettings,
        });

        // --- Detailed Error Handling ---
        if (!result.response) {
            console.error("LLM Error: No response object found.", result);
             // Check for specific block reasons if available
            const blockReason = result.promptFeedback?.blockReason;
            const safetyRatings = result.promptFeedback?.safetyRatings;
            let errorMsg = "LLM Error: No response received.";
            if (blockReason) {
                errorMsg += ` Block Reason: ${blockReason}.`;
            }
            if (safetyRatings) {
                errorMsg += ` Safety Ratings: ${JSON.stringify(safetyRatings)}`;
            }
             return { success: false, error: errorMsg };
        }

        const response = result.response;

        // Check if the response finished successfully
        if (response.promptFeedback?.blockReason) {
             console.error("LLM Error: Prompt blocked.", response.promptFeedback);
             return { success: false, error: `LLM Error: Prompt blocked due to ${response.promptFeedback.blockReason}. ${JSON.stringify(response.promptFeedback.safetyRatings)}` };
        }
         if (response.candidates?.[0]?.finishReason !== 'STOP' && response.candidates?.[0]?.finishReason !== 'MAX_TOKENS') {
            console.error("LLM Error: Response did not finish normally.", response.candidates?.[0]);
            return { success: false, error: `LLM Error: Incomplete response. Finish Reason: ${response.candidates?.[0]?.finishReason ?? 'Unknown'}. ${JSON.stringify(response.candidates?.[0]?.safetyRatings)}` };
        }

        // Extract text safely
        const responseText = response.text(); // Use the built-in text() method


        if (!responseText) {
             console.error("LLM Error: Response text is empty.", response);
             return { success: false, error: "LLM Error: Received empty response text." };
        }

        // console.log("RESPONSE (API):", responseText.substring(0, 500) + "..."); // Log snippet

        // Update cache
        if (useCache) {
            cache.set(prompt, responseText);
            console.log("LLM Cache UPDATED");
        }

        return { success: true, text: responseText };

    } catch (error: any) {
        console.error("LLM API Call Failed:", error);
        return { success: false, error: `LLM API Error: ${error.message || 'Unknown error'}` };
    }
}