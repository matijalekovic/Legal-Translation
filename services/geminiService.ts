import { GoogleGenAI } from "@google/genai";

// Initialize the Gemini API client
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Translates the provided legal text using the Gemini Flash model.
 * 
 * @param text The legal text to translate.
 * @param targetLanguage The target language (e.g., "Spanish").
 * @param excludedText Text to exclude from translation (optional).
 * @returns The translated text.
 */
export const translateLegalText = async (
  text: string, 
  targetLanguage: string = "Spanish",
  excludedText?: string
): Promise<string> => {
  try {
    const modelId = "gemini-3-flash-preview";
    
    let prompt = `You are a professional legal translator. Translate the following legal document text into ${targetLanguage}.
    Maintain a formal, authoritative, and professional tone suitable for legal proceedings.
    Preserve the original formatting structure as much as possible.
    
    Text to translate:
    """
    ${text}
    """
    `;

    if (excludedText && excludedText.trim().length > 0) {
      prompt += `
      IMPORTANT: Do NOT translate the following terms or phrases, keep them in the original language:
      ${excludedText}
      `;
    }

    const response = await ai.models.generateContent({
      model: modelId,
      contents: prompt,
    });

    return response.text || "Translation failed to generate text.";

  } catch (error) {
    console.error("Gemini Translation Error:", error);
    throw new Error("Failed to translate document.");
  }
};
