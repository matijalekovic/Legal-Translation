import { BatchTranslationResponse, TranslationConfig, LegalDocumentContext, LegalSection, LegalSectionType } from "../types";

// Model constants
const TRANSLATION_MODEL = "gemini-3-flash-preview";
const FALLBACK_MODEL = "gemini-2.5-flash-lite";
const MAX_RETRIES = 3;

// Helper function to call the serverless API with a single attempt
async function attemptAPICall(model: string, contents: string, config?: any): Promise<string> {
  const response = await fetch('/api/translate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      contents,
      config,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'API request failed');
  }

  const data = await response.json();
  return data.text || '';
}

// Helper function to call the serverless API with retry and fallback logic
async function callGeminiAPI(model: string, contents: string, config?: any): Promise<string> {
  let lastError: Error | null = null;

  // Try the requested model up to MAX_RETRIES times
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`Attempting API call with ${model} (attempt ${attempt}/${MAX_RETRIES})`);
      const result = await attemptAPICall(model, contents, config);
      if (attempt > 1) {
        console.log(`Successfully completed after ${attempt} attempts`);
      }
      return result;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error occurred');
      console.warn(`Attempt ${attempt}/${MAX_RETRIES} failed for ${model}:`, lastError.message);

      // Wait before retrying (exponential backoff: 1s, 2s, 4s)
      if (attempt < MAX_RETRIES) {
        const delayMs = Math.pow(2, attempt - 1) * 1000;
        console.log(`Waiting ${delayMs}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }

  // If all retries failed and we're not already using the fallback model, try fallback
  if (model !== FALLBACK_MODEL) {
    console.warn(`All ${MAX_RETRIES} attempts failed with ${model}. Falling back to ${FALLBACK_MODEL}...`);
    try {
      const result = await attemptAPICall(FALLBACK_MODEL, contents, config);
      console.log(`Successfully completed using fallback model ${FALLBACK_MODEL}`);
      return result;
    } catch (fallbackError) {
      console.error(`Fallback to ${FALLBACK_MODEL} also failed:`, fallbackError);
      throw new Error(`Translation failed after ${MAX_RETRIES} retries and fallback: ${lastError?.message}`);
    }
  }

  // If we were already using the fallback model, just throw the error
  throw new Error(`Translation failed after ${MAX_RETRIES} retries: ${lastError?.message}`);
}

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
  sr: "Serbian",
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
 * @param targetLanguageCode Optional language code (kept for backward compatibility).
 * @param customModel Optional custom model to use instead of default.
 * @returns The translated text.
 */
export const translateLegalText = async (
  text: string,
  targetLanguage: string = "Spanish",
  excludedText?: string,
  targetLanguageCode?: string,
  customModel?: string
): Promise<string> => {
  try {
    // Use custom model if provided, otherwise use default
    const modelId = customModel || TRANSLATION_MODEL;
    
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

    const responseText = await callGeminiAPI(modelId, prompt);
    return responseText || "Translation failed to generate text.";

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
    const text = await callGeminiAPI(TRANSLATION_MODEL, prompt, {
      temperature: 0.1,
      maxOutputTokens: 500,
    });
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

  // Use custom model from config if provided, otherwise use default
  const modelToUse = config.model || TRANSLATION_MODEL;

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

  const responseText = await callGeminiAPI(modelToUse, prompt, {
    temperature: config.modelTemperature,
    maxOutputTokens: 16384,
  });

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
