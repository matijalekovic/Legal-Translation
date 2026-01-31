export interface DocumentSettings {
  translateHeaders: boolean;
  translateFootnotes: boolean;
  preserveFormatting: boolean;
  translateComments: boolean;
  excludedText: string;
}

export interface UploadedDocument {
  id: string;
  file: File;
  name: string;
  size: number;
  content: string; // Extracted raw text content for translation
  previewContent?: string; // HTML content for preview
  status: 'pending' | 'translating' | 'completed' | 'error';
  uploadTime: number;
}

export interface TranslatedDocument {
  id: string;
  originalDocId: string;
  name: string;
  originalName: string;
  content: string; // Summary or status text
  previewContent?: string; // Actual translated text for preview
  languageFrom: string;
  languageTo: string;
  timestamp: number;
  status: 'processing' | 'completed' | 'error';
}

export type TranslationStatus = 'idle' | 'translating' | 'completed' | 'error';

// ============================================
// DOCX Translation Pipeline Types
// ============================================

/**
 * Context information for a text segment
 */
export interface SegmentContext {
  location: 'body' | 'header' | 'footer' | 'footnote' | 'table-cell';
  styleInfo?: string;
}

/**
 * Represents a single text segment extracted from the DOCX XML
 */
export interface TextSegment {
  id: string;
  text: string;
  translatedText?: string;
  xmlPath: string;
  paragraphIndex: number;
  context: SegmentContext;
  status: 'pending' | 'translating' | 'completed' | 'error';
  error?: string;
}

/**
 * Document metadata extracted during parsing
 */
export interface DocumentMetadata {
  totalParagraphs: number;
  totalCharacters: number;
  estimatedBatches: number;
  detectedLanguage?: string;
  documentTitle?: string;
}

/**
 * Represents the parsed DOCX document structure
 */
export interface ParsedDocx {
  originalFile: File;
  zipInstance: unknown; // JSZip instance
  xmlDocuments: Map<string, Document>;
  segments: TextSegment[];
  metadata: DocumentMetadata;
}

/**
 * A batch of segments to be translated together
 */
export interface TranslationBatch {
  id: string;
  segments: TextSegment[];
  startIndex: number;
  totalCharacters: number;
  status: 'pending' | 'translating' | 'completed' | 'error';
  retryCount: number;
}

/**
 * Configuration for the translation pipeline
 */
export interface TranslationConfig {
  batchSize: number;
  maxCharsPerBatch: number;
  maxConcurrentBatches: number;
  sourceLanguage: string;
  targetLanguage: string;
  excludedTerms: string[];
  translateHeaders: boolean;
  translateFooters: boolean;
  translateFootnotes: boolean;
  modelTemperature: number;
}

/**
 * Translation phases for progress tracking
 */
export type TranslationPhase =
  | 'idle'
  | 'parsing'
  | 'analyzing'
  | 'translating'
  | 'rebuilding'
  | 'complete'
  | 'error'
  | 'cancelled';

/**
 * Detailed progress information
 */
export interface TranslationProgress {
  phase: TranslationPhase;
  currentSegment: number;
  totalSegments: number;
  currentBatch: number;
  totalBatches: number;
  message: string;
}

/**
 * Error information for failed segments/batches
 */
export interface TranslationError {
  segmentId?: string;
  batchId?: string;
  message: string;
  timestamp: number;
  recoverable: boolean;
}

/**
 * Callbacks for progress updates
 */
export interface ProgressCallbacks {
  onProgress: (progress: TranslationProgress) => void;
  onError?: (error: TranslationError) => void;
}

/**
 * Final result of the translation pipeline
 */
export interface TranslationResult {
  success: boolean;
  outputDataUrl?: string;
  outputFileName: string;
  totalSegments: number;
  successfulSegments: number;
  failedSegments: number;
  errors: TranslationError[];
  processingTimeMs: number;
}

/**
 * Response format expected from Gemini API for batch translation
 */
export interface BatchTranslationResponse {
  translations: string[];
}

// ============================================
// Legal Document Structure Types
// ============================================

/**
 * Types of legal document sections
 */
export type LegalSectionType =
  | 'preamble'           // Opening statements, parties identification
  | 'recitals'           // Whereas clauses, background
  | 'definitions'        // Definition of terms
  | 'subject_matter'     // Main subject/purpose of agreement
  | 'obligations'        // Rights and obligations of parties
  | 'payment'            // Payment terms, fees, compensation
  | 'term_termination'   // Duration, termination clauses
  | 'confidentiality'    // NDA clauses, confidential information
  | 'liability'          // Liability limitations, indemnification
  | 'warranties'         // Representations and warranties
  | 'dispute_resolution' // Arbitration, jurisdiction, governing law
  | 'general_provisions' // Miscellaneous, severability, amendments
  | 'signatures'         // Signature blocks, execution
  | 'schedules'          // Annexes, exhibits, schedules
  | 'unknown';           // Unclassified section

/**
 * Represents a section of a legal document
 */
export interface LegalSection {
  id: string;
  title: string;
  type: LegalSectionType;
  segments: TextSegment[];
  startIndex: number;
  endIndex: number;
  context?: string;  // AI-generated section context
}

/**
 * Document-level legal context
 */
export interface LegalDocumentContext {
  documentType: string;        // e.g., "Service Agreement", "NDA", "Employment Contract"
  parties: string[];           // Identified parties
  jurisdiction?: string;       // Governing law/jurisdiction if detected
  formalityLevel: 'high' | 'medium' | 'standard';
  specialTerminology: string[]; // Key legal terms identified
  summary: string;             // Brief document summary
}

/**
 * Extended parsed document with legal structure
 */
export interface ParsedLegalDocx extends ParsedDocx {
  documentContext?: LegalDocumentContext;
  sections: LegalSection[];
}