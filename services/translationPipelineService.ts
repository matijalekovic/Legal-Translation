import {
  ParsedLegalDocx,
  TextSegment,
  TranslationBatch,
  TranslationConfig,
  TranslationProgress,
  TranslationResult,
  TranslationError,
  ProgressCallbacks,
  LegalSection,
  LegalDocumentContext,
} from "../types";
import {
  analyzeLegalDocumentContext,
  analyzeSectionContext,
  translateBatchLegalText
} from "./geminiService";
import { rebuildDocx } from "./docxRebuilderService";

// Default configuration - optimized for speed (from original spec)
export const DEFAULT_CONFIG: TranslationConfig = {
  batchSize: 20,              // Original batch size
  maxCharsPerBatch: 12000,    // Original char limit
  maxConcurrentBatches: 3,    // Original concurrency
  sourceLanguage: "auto",
  targetLanguage: "es",
  excludedTerms: [],
  translateHeaders: true,
  translateFooters: true,
  translateFootnotes: true,
  modelTemperature: 0.4,      // Original temperature
};

/**
 * Filters segments based on user settings for translation
 */
function filterSegmentsBySettings(
  segments: TextSegment[],
  config: TranslationConfig
): TextSegment[] {
  return segments.filter((segment) => {
    const { location } = segment.context;

    // Filter based on checkbox settings
    if (location === 'header' && !config.translateHeaders) {
      return false;
    }
    if (location === 'footer' && !config.translateFooters) {
      return false;
    }
    if (location === 'footnote' && !config.translateFootnotes) {
      return false;
    }

    return true;
  });
}

/**
 * Main entry point - orchestrates the entire translation pipeline with legal context
 */
export async function runTranslationPipeline(
  parsedDocx: ParsedLegalDocx,
  config: TranslationConfig,
  callbacks: ProgressCallbacks,
  signal?: AbortSignal
): Promise<TranslationResult> {
  const startTime = Date.now();
  const errors: TranslationError[] = [];

  // Filter segments based on user settings
  const allSegments = parsedDocx.segments;
  const segments = filterSegmentsBySettings(allSegments, config);

  console.log(`📊 Filtered ${segments.length} translatable segments (${allSegments.length - segments.length} excluded by settings)`);

  if (segments.length === 0) {
    return {
      success: false,
      outputFileName: "",
      totalSegments: 0,
      successfulSegments: 0,
      failedSegments: 0,
      errors: [
        {
          message: "No translatable text found in document.",
          timestamp: Date.now(),
          recoverable: false,
        },
      ],
      processingTimeMs: Date.now() - startTime,
    };
  }

  // Check for abort
  if (signal?.aborted) {
    throw new DOMException("Translation cancelled", "AbortError");
  }

  // Phase 1: Analyze document-level legal context
  callbacks.onProgress({
    phase: "analyzing",
    currentSegment: 0,
    totalSegments: segments.length,
    currentBatch: 0,
    totalBatches: 0,
    message: "Analyzing legal document structure...",
  });

  let documentContext: LegalDocumentContext;
  try {
    // Sample fewer segments for faster context analysis
    const sampleText = segments
      .slice(0, 15)
      .map((s) => s.text)
      .join("\n");
    documentContext = await analyzeLegalDocumentContext(sampleText, config.sourceLanguage);
    console.log("📋 Document context:", documentContext);
  } catch (error) {
    console.warn("Context analysis failed, using fallback");
    documentContext = {
      documentType: "Legal Document",
      parties: [],
      formalityLevel: "high",
      specialTerminology: [],
      summary: "Professional legal document requiring formal translation.",
    };
  }

  // Check for abort
  if (signal?.aborted) {
    throw new DOMException("Translation cancelled", "AbortError");
  }

  // Phase 2: Create batches (simple batching from original spec)
  const documentContextStr = `${documentContext.documentType}: ${documentContext.summary}. Formality: ${documentContext.formalityLevel}. Key terms: ${documentContext.specialTerminology.join(", ")}.`;
  const batches = createBatches(segments, config);
  const totalBatches = batches.length;

  console.log(`📦 Created ${totalBatches} translation batches`);

  callbacks.onProgress({
    phase: "translating",
    currentSegment: 0,
    totalSegments: segments.length,
    currentBatch: 0,
    totalBatches,
    message: `Translating ${segments.length} text segments...`,
  });

  // Phase 3: Translate batches with controlled concurrency (original algorithm)
  const translations = new Map<string, string>();
  let processedSegments = 0;

  for (let i = 0; i < batches.length; i += config.maxConcurrentBatches) {
    // Check for abort
    if (signal?.aborted) {
      throw new DOMException("Translation cancelled", "AbortError");
    }

    const batchGroup = batches.slice(i, i + config.maxConcurrentBatches);

    const batchPromises = batchGroup.map(async (batch, groupIndex) => {
      const batchIndex = i + groupIndex;

      try {
        batch.status = "translating";
        const texts = batch.segments.map((s) => s.text);

        const response = await translateBatchLegalText(
          texts,
          config,
          documentContextStr
        );

        // Store translations
        batch.segments.forEach((segment, idx) => {
          if (response.translations[idx] !== undefined) {
            translations.set(segment.id, response.translations[idx]);
            segment.translatedText = response.translations[idx];
            segment.status = "completed";
          }
        });

        batch.status = "completed";
        return batch.segments.length;
      } catch (error) {
        console.error(`Batch ${batchIndex} translation failed:`, error);

        // On error, keep original text
        batch.segments.forEach((segment) => {
          translations.set(segment.id, segment.text);
          segment.translatedText = segment.text;
          segment.status = "error";
          segment.error = error instanceof Error ? error.message : "Translation failed";
        });

        batch.status = "error";

        errors.push({
          batchId: batch.id,
          message: error instanceof Error ? error.message : "Batch translation failed",
          timestamp: Date.now(),
          recoverable: true,
        });

        return batch.segments.length;
      }
    });

    const results = await Promise.all(batchPromises);
    processedSegments += results.reduce((a, b) => a + b, 0);

    // Report progress
    callbacks.onProgress({
      phase: "translating",
      currentSegment: processedSegments,
      totalSegments: segments.length,
      currentBatch: Math.min(i + config.maxConcurrentBatches, batches.length),
      totalBatches,
      message: `Translating batch ${Math.min(i + config.maxConcurrentBatches, batches.length)} of ${totalBatches}...`,
    });
  }

  console.log(`✅ Translated ${translations.size} segments`);

  // Mark excluded segments as completed with original text
  allSegments.forEach((segment) => {
    if (!translations.has(segment.id)) {
      translations.set(segment.id, segment.text);
      segment.translatedText = segment.text;
      segment.status = "completed";
    }
  });

  // Check for abort
  if (signal?.aborted) {
    throw new DOMException("Translation cancelled", "AbortError");
  }

  // Phase 4: Rebuild DOCX
  callbacks.onProgress({
    phase: "rebuilding",
    currentSegment: segments.length,
    totalSegments: segments.length,
    currentBatch: totalBatches,
    totalBatches,
    message: "Rebuilding document...",
  });

  let outputDataUrl: string;
  try {
    outputDataUrl = await rebuildDocx(parsedDocx, translations);
    console.log("✅ Document rebuild complete");
  } catch (error) {
    console.error("Document rebuild failed:", error);
    return {
      success: false,
      outputFileName: "",
      totalSegments: allSegments.length,
      successfulSegments: translations.size,
      failedSegments: allSegments.length - translations.size,
      errors: [
        ...errors,
        {
          message: error instanceof Error ? error.message : "Failed to rebuild document",
          timestamp: Date.now(),
          recoverable: false,
        },
      ],
      processingTimeMs: Date.now() - startTime,
    };
  }

  // Phase 5: Complete
  callbacks.onProgress({
    phase: "complete",
    currentSegment: segments.length,
    totalSegments: segments.length,
    currentBatch: totalBatches,
    totalBatches,
    message: "Translation complete!",
  });

  const successfulSegments = allSegments.filter((s) => s.status === "completed").length;
  const failedSegments = allSegments.filter((s) => s.status === "error").length;

  // Generate output filename
  const originalName = parsedDocx.originalFile.name;
  const langPrefix = config.targetLanguage.toUpperCase();
  const outputFileName = originalName.replace(/\.docx$/i, `_${langPrefix}.docx`);

  return {
    success: true,
    outputDataUrl,
    outputFileName,
    totalSegments: allSegments.length,
    successfulSegments,
    failedSegments,
    errors,
    processingTimeMs: Date.now() - startTime,
  };
}

/**
 * Groups segments into batches based on size constraints
 */
export function createBatches(
  segments: TextSegment[],
  config: TranslationConfig
): TranslationBatch[] {
  const batches: TranslationBatch[] = [];
  let currentBatch: TextSegment[] = [];
  let currentChars = 0;
  let startIndex = 0;
  let batchId = 0;

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    const segmentChars = segment.text.length;

    // Start new batch if current batch is full
    const batchFull = currentBatch.length >= config.batchSize;
    const tooManyChars =
      currentChars + segmentChars > config.maxCharsPerBatch && currentBatch.length > 0;

    if (batchFull || tooManyChars) {
      batches.push({
        id: `batch-${batchId++}`,
        segments: currentBatch,
        startIndex,
        totalCharacters: currentChars,
        status: "pending",
        retryCount: 0,
      });
      currentBatch = [];
      currentChars = 0;
      startIndex = i;
    }

    currentBatch.push(segment);
    currentChars += segmentChars;
  }

  // Add remaining segments
  if (currentBatch.length > 0) {
    batches.push({
      id: `batch-${batchId}`,
      segments: currentBatch,
      startIndex,
      totalCharacters: currentChars,
      status: "pending",
      retryCount: 0,
    });
  }

  return batches;
}
