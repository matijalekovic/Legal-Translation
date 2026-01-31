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
  content: string; // Translated text
  languageFrom: string;
  languageTo: string;
  timestamp: number;
  status: 'processing' | 'completed' | 'error';
}

export type TranslationStatus = 'idle' | 'translating' | 'completed' | 'error';