import { GoogleGenAI } from "@google/genai";
import { BatchTranslationResponse, TranslationConfig, LegalDocumentContext, LegalSection, LegalSectionType } from "../types";

// Get API key from multiple possible sources
function getApiKey(): string {
  // Try process.env (Vite injects this)
  if (typeof process !== 'undefined' && process.env?.API_KEY) {
    return process.env.API_KEY;
  }
  // Try import.meta.env (Vite standard)
  if (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_GEMINI_API_KEY) {
    return (import.meta as any).env.VITE_GEMINI_API_KEY;
  }
  // Try global variable (Google AI Studio may inject this)
  if (typeof (globalThis as any).API_KEY !== 'undefined') {
    return (globalThis as any).API_KEY;
  }
  // Fallback - will cause error when used
  console.warn('No API key found. Please set GEMINI_API_KEY in .env file');
  return '';
}

// Initialize the Gemini API client
const ai = new GoogleGenAI({ apiKey: getApiKey() });

// Model for translation pipeline
const TRANSLATION_MODEL = "gemini-2.5-flash-lite";

// Language display names
const LANGUAGE_NAMES: Record<string, string> = {
  auto: "Auto-detect",
  en: "English",
  es: "Spanish",
  fr: "French",
  de: "German",
  it: "Italian",
  pt: "Portuguese",
  zh: "Chinese",
  ja: "Japanese",
  ko: "Korean",
  ar: "Arabic",
  ru: "Russian",
};

/**
 * Gets the display name for a language code
 */
export function getLanguageName(code: string): string {
  return LANGUAGE_NAMES[code] || code;
}

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

/**
 * Analyzes legal document context at the document level
 */
export async function analyzeLegalDocumentContext(
  sampleText: string,
  sourceLanguage: string
): Promise<LegalDocumentContext> {
  const prompt = `You are a legal document analyst for a law firm. Analyze this legal document excerpt and provide structured analysis.

DOCUMENT EXCERPT:
${sampleText.substring(0, 4000)}

Respond in JSON format:
{
  "documentType": "specific type (e.g., Service Agreement, NDA, Employment Contract, Lease Agreement, Power of Attorney)",
  "parties": ["Party A name/description", "Party B name/description"],
  "jurisdiction": "governing law or jurisdiction if mentioned, or null",
  "formalityLevel": "high" or "medium" or "standard",
  "specialTerminology": ["key legal terms that need precise translation"],
  "summary": "One sentence describing the document's purpose"
}`;

  try {
    const response = await ai.models.generateContent({
      model: TRANSLATION_MODEL,
      contents: prompt,
      config: {
        temperature: 0.1,
        maxOutputTokens: 500,
      },
    });

    const text = response.text || "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        documentType: parsed.documentType || "Legal Document",
        parties: parsed.parties || [],
        jurisdiction: parsed.jurisdiction || undefined,
        formalityLevel: parsed.formalityLevel || "high",
        specialTerminology: parsed.specialTerminology || [],
        summary: parsed.summary || "Legal document for professional translation.",
      };
    }
  } catch (error) {
    console.warn("Failed to analyze legal document context:", error);
  }

  // Fallback
  return {
    documentType: "Legal Document",
    parties: [],
    formalityLevel: "high",
    specialTerminology: [],
    summary: "Professional legal document requiring formal translation.",
  };
}

/**
 * Analyzes context for a specific section of a legal document
 */
export async function analyzeSectionContext(
  section: LegalSection,
  documentContext: LegalDocumentContext
): Promise<string> {
  const sectionTypeDescriptions: Record<LegalSectionType, string> = {
    preamble: "opening statements identifying parties and date",
    recitals: "whereas clauses providing background and context",
    definitions: "defined terms and their meanings",
    subject_matter: "main purpose and scope of the agreement",
    obligations: "rights, duties, and responsibilities of parties",
    payment: "fees, compensation, payment terms and schedules",
    term_termination: "duration, renewal, and termination conditions",
    confidentiality: "non-disclosure and confidentiality obligations",
    liability: "limitations of liability and indemnification",
    warranties: "representations, warranties, and guarantees",
    dispute_resolution: "arbitration, jurisdiction, and governing law",
    general_provisions: "miscellaneous clauses (severability, amendments, notices)",
    signatures: "execution blocks and witness statements",
    schedules: "annexes, exhibits, and supplementary materials",
    unknown: "general legal provisions",
  };

  const typeDesc = sectionTypeDescriptions[section.type];

  return `[${documentContext.documentType}] Section: "${section.title}" - ${typeDesc}. Formality: ${documentContext.formalityLevel}. Key terms: ${documentContext.specialTerminology.slice(0, 5).join(", ") || "standard legal terminology"}.`;
}

/**
 * Legacy function - analyzes document context (kept for compatibility)
 */
export async function analyzeDocumentContext(
  sampleText: string,
  sourceLanguage: string
): Promise<string> {
  const context = await analyzeLegalDocumentContext(sampleText, sourceLanguage);
  return `${context.documentType}: ${context.summary} Formality: ${context.formalityLevel}. Key terms: ${context.specialTerminology.join(", ")}.`;
}

/**
 * Translates a batch of legal text segments with context
 */
export async function translateBatchLegalText(
  texts: string[],
  config: TranslationConfig,
  documentContext: string,
  sectionContext?: string
): Promise<BatchTranslationResponse> {
  const sourceLangDisplay =
    config.sourceLanguage === "auto"
      ? "the detected language"
      : getLanguageName(config.sourceLanguage);
  const targetLangDisplay = getLanguageName(config.targetLanguage);

  const excludeNote = config.excludedTerms.length > 0
    ? `\nPRESERVE UNCHANGED: ${config.excludedTerms.join(", ")}`
    : "";

  const sectionNote = sectionContext ? `\nSECTION: ${sectionContext}` : "";

  const prompt = `You are a certified legal translator for a law firm. Translate from ${sourceLangDisplay} to ${targetLangDisplay}.

DOCUMENT: ${documentContext}${sectionNote}${excludeNote}

LEGAL TRANSLATION REQUIREMENTS:
- Use formal legal register appropriate for court documents
- Preserve Latin phrases (e.g., "inter alia", "prima facie", "bona fide")
- Maintain legal precision - do not paraphrase legal terms
- Keep party names, dates, currency amounts, case numbers unchanged
- Preserve numbered clauses and cross-references exactly
- Use established legal terminology in target language

Return EXACTLY ${texts.length} translations as JSON: {"translations":["...",...]}}

INPUT:
${JSON.stringify(texts)}`;

  const response = await ai.models.generateContent({
    model: TRANSLATION_MODEL,
    contents: prompt,
    config: {
      temperature: config.modelTemperature,
      maxOutputTokens: 16384,
    },
  });

  const responseText = response.text || "";
  return parseTranslationResponse(responseText, texts);
}

/**
 * Parses the translation response from Gemini
 */
function parseTranslationResponse(
  response: string,
  originalTexts: string[]
): BatchTranslationResponse {
  try {
    // Remove markdown code blocks if present
    let cleanResponse = response.trim();
    if (cleanResponse.startsWith("```")) {
      cleanResponse = cleanResponse
        .replace(/^```(?:json)?\s*\n/, "")
        .replace(/\n```\s*$/, "");
    }

    // Extract JSON from response
    const jsonMatch = cleanResponse.match(/\{[\s\S]*"translations"[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No valid JSON found in response");
    }

    const parsed = JSON.parse(jsonMatch[0]);

    if (!Array.isArray(parsed.translations)) {
      throw new Error("Invalid response format: translations is not an array");
    }

    // Ensure correct number of translations
    if (parsed.translations.length !== originalTexts.length) {
      console.warn(
        `Translation count mismatch: expected ${originalTexts.length}, got ${parsed.translations.length}`
      );

      // Pad with original text if missing
      while (parsed.translations.length < originalTexts.length) {
        const missingIndex = parsed.translations.length;
        parsed.translations.push(originalTexts[missingIndex]);
      }

      // Trim if too many
      if (parsed.translations.length > originalTexts.length) {
        parsed.translations = parsed.translations.slice(0, originalTexts.length);
      }
    }

    return { translations: parsed.translations };
  } catch (error) {
    // Fallback: return original texts
    console.error("Translation parsing failed:", error);
    return { translations: originalTexts };
  }
}
