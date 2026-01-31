import React, { useState, useCallback, useRef, useEffect } from 'react';
import mammoth from 'mammoth';
import {
  UploadedDocument,
  TranslatedDocument,
  DocumentSettings,
  TranslationProgress,
  TranslationConfig,
} from './types';
import { translateLegalText, getLanguageName } from './services/geminiService';
import { parseDocx } from './services/docxParserService';
import { runTranslationPipeline, DEFAULT_CONFIG } from './services/translationPipelineService';
import { dataUrlToBlob } from './services/docxRebuilderService';
import { getStoredUser, clearStoredUser } from './services/authService';
import TopBar from './components/TopBar';
import LeftPanel from './components/LeftPanel';
import CenterCanvas, { PreviewableDocument } from './components/CenterCanvas';
import RightPanel from './components/RightPanel';
import Login from './components/Login';

// Helper to extract content and preview from files
const extractContent = async (file: File): Promise<{ text: string; preview?: string }> => {
  if (file.type === 'text/plain' || file.name.endsWith('.txt') || file.name.endsWith('.md')) {
    const text = await file.text();
    return { text, preview: text };
  } else if (file.name.endsWith('.docx')) {
    try {
      const arrayBuffer = await file.arrayBuffer();

      // Extract raw text for LLM context
      const textResult = await mammoth.extractRawText({ arrayBuffer });
      const text = textResult.value;

      // Extract HTML for Preview
      const htmlResult = await mammoth.convertToHtml({ arrayBuffer });
      const preview = htmlResult.value;

      return { text, preview };
    } catch (error) {
      console.error("Error parsing docx:", error);
      return {
        text: "Error parsing document content.",
        preview: "<p style='color:red'>Error parsing document preview.</p>"
      };
    }
  } else {
    // For other unsupported binaries, provide a placeholder
    return {
      text: `File: ${file.name} (Binary content cannot be previewed directly)`,
      preview: `<p>Preview not available for this file type (${file.type || 'unknown'}).</p>`
    };
  }
};

const App: React.FC = () => {
  // Authentication state
  const [user, setUser] = useState<{ email: string; name: string; picture: string } | null>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  const [documents, setDocuments] = useState<UploadedDocument[]>([]);
  const [translatedDocs, setTranslatedDocs] = useState<TranslatedDocument[]>([]);
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
  const [isTranslating, setIsTranslating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTranslatingFile, setCurrentTranslatingFile] = useState<string | null>(null);
  const [selectedTranslatedDocId, setSelectedTranslatedDocId] = useState<string | null>(null);

  const [settings, setSettings] = useState<DocumentSettings>({
    translateHeaders: true,
    translateFootnotes: true,
    preserveFormatting: true,
    translateComments: false,
    excludedText: ''
  });

  // New state for translation pipeline
  const [translationProgress, setTranslationProgress] = useState<TranslationProgress | null>(null);

  // Language selection state
  const [sourceLanguage, setSourceLanguage] = useState('auto');
  const [targetLanguage, setTargetLanguage] = useState('en');
  const [translatedBlobs, setTranslatedBlobs] = useState<Map<string, Blob>>(new Map());
  const abortControllerRef = useRef<AbortController | null>(null);

  // Check for stored user on mount
  useEffect(() => {
    const storedUser = getStoredUser();
    if (storedUser) {
      setUser(storedUser);
    }
    setIsCheckingAuth(false);
  }, []);

  const handleLogout = () => {
    clearStoredUser();
    setUser(null);
    // Clear all data on logout
    setDocuments([]);
    setTranslatedDocs([]);
    setSelectedDocIds([]);
    setSelectedTranslatedDocId(null);
  };

  const handleLoginSuccess = (userData: { email: string; name: string; picture: string }) => {
    setUser(userData);
  };

  const handleUpload = useCallback(async (files: File[]) => {
    const newDocs: UploadedDocument[] = [];

    for (const file of files) {
      const { text, preview } = await extractContent(file);

      newDocs.push({
        id: Math.random().toString(36).substr(2, 9),
        file,
        name: file.name,
        size: file.size,
        content: text,
        previewContent: preview,
        status: 'pending',
        uploadTime: Date.now()
      });
    }

    setDocuments(prev => [...prev, ...newDocs]);
    // Select the first new document if none selected
    if (selectedDocIds.length === 0 && newDocs.length > 0) {
      setSelectedDocIds([newDocs[0].id]);
    }
  }, [selectedDocIds]);

  const handleRemoveDocument = (id: string) => {
    setDocuments(prev => prev.filter(d => d.id !== id));
    setSelectedDocIds(prev => prev.filter(docId => docId !== id));
  };

  // Handle selecting an original document (toggles selection, clears translated selection)
  const handleSelectOriginal = (id: string) => {
    setSelectedDocIds(prev =>
      prev.includes(id)
        ? prev.filter(docId => docId !== id)  // Deselect if already selected
        : [...prev, id]                        // Add to selection
    );
    setSelectedTranslatedDocId(null);
  };

  // Handle selecting a translated document (clears original selections)
  const handleSelectTranslated = (id: string) => {
    setSelectedTranslatedDocId(id);
    setSelectedDocIds([]);
  };

  const handleTranslateAll = async () => {
    if (documents.length === 0) return;

    // Determine which documents to translate: selected ones if any, otherwise all
    const docsToTranslate = selectedDocIds.length > 0
      ? documents.filter(doc => selectedDocIds.includes(doc.id))
      : documents;

    if (docsToTranslate.length === 0) return;

    // Create abort controller for cancellation
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    setIsTranslating(true);
    setProgress(0);
    setTranslationProgress(null);

    // Create placeholders for translated docs (append to existing, don't replace)
    const langPrefix = targetLanguage.toUpperCase();
    const newTranslatedDocs: TranslatedDocument[] = docsToTranslate.map(doc => ({
      id: `trans-${doc.id}`,
      originalDocId: doc.id,
      name: `${langPrefix}_${doc.name}`,
      originalName: doc.name,
      content: '',
      languageFrom: getLanguageName(sourceLanguage),
      languageTo: getLanguageName(targetLanguage),
      timestamp: Date.now(),
      status: 'processing'
    }));

    // Append new translations to existing ones (preserve previously translated docs)
    setTranslatedDocs(prev => [...prev, ...newTranslatedDocs]);

    const totalDocs = docsToTranslate.length;
    let completed = 0;
    const newBlobs = new Map<string, Blob>();

    for (const doc of docsToTranslate) {
      if (signal.aborted) break;

      setCurrentTranslatingFile(doc.name);

      try {
        // Check if it's a DOCX file - use new pipeline
        if (doc.file.name.endsWith('.docx')) {
          // Build translation config
          const config: TranslationConfig = {
            ...DEFAULT_CONFIG,
            sourceLanguage,
            targetLanguage,
            excludedTerms: settings.excludedText
              .split(',')
              .map(s => s.trim())
              .filter(Boolean),
            translateHeaders: settings.translateHeaders,
            translateFooters: settings.translateHeaders,  // Same checkbox controls both
            translateFootnotes: settings.translateFootnotes,
          };

          // Parse the DOCX file
          setTranslationProgress({
            phase: 'parsing',
            currentSegment: 0,
            totalSegments: 0,
            currentBatch: 0,
            totalBatches: 0,
            message: 'Parsing document...',
          });

          const parsedDocx = await parseDocx(doc.file, settings);

          // Run the translation pipeline
          const result = await runTranslationPipeline(
            parsedDocx,
            config,
            {
              onProgress: (prog) => {
                setTranslationProgress(prog);
                // Calculate overall progress including document position
                const docProgress = (completed / totalDocs) * 100;
                const segmentProgress = prog.totalSegments > 0
                  ? (prog.currentSegment / prog.totalSegments) * (100 / totalDocs)
                  : 0;
                setProgress(docProgress + segmentProgress);
              },
            },
            signal
          );

          if (result.success && result.outputDataUrl) {
            // Store the blob for download
            const blob = dataUrlToBlob(result.outputDataUrl);
            newBlobs.set(`trans-${doc.id}`, blob);

            // Extract translated text from segments for preview
            const translatedPreview = parsedDocx.segments
              .filter(seg => seg.translatedText)
              .map(seg => seg.translatedText)
              .join('\n\n');

            setTranslatedDocs(prev => prev.map(td => {
              if (td.originalDocId === doc.id) {
                return {
                  ...td,
                  name: result.outputFileName,
                  content: `Translated ${result.successfulSegments} of ${result.totalSegments} segments`,
                  previewContent: translatedPreview,
                  status: 'completed'
                };
              }
              return td;
            }));

            // Remove successfully translated document from left panel
            setDocuments(prev => prev.filter(d => d.id !== doc.id));
            setSelectedDocIds(prev => prev.filter(id => id !== doc.id));
          } else {
            setTranslatedDocs(prev => prev.map(td => {
              if (td.originalDocId === doc.id) {
                return {
                  ...td,
                  status: 'error',
                  content: result.errors[0]?.message || 'Translation failed'
                };
              }
              return td;
            }));
          }
        } else {
          // For non-DOCX files, use the original simple translation
          const translatedText = await translateLegalText(doc.content, getLanguageName(targetLanguage), settings.excludedText);

          setTranslatedDocs(prev => prev.map(td => {
            if (td.originalDocId === doc.id) {
              return {
                ...td,
                content: translatedText,
                status: 'completed'
              };
            }
            return td;
          }));
        }

      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          console.log('Translation cancelled');
          break;
        }

        setTranslatedDocs(prev => prev.map(td => {
          if (td.originalDocId === doc.id) {
            return {
              ...td,
              status: 'error',
              content: error instanceof Error ? error.message : 'Error during translation.'
            };
          }
          return td;
        }));
      }

      completed++;
      setProgress((completed / totalDocs) * 100);
    }

    // Update blobs state
    setTranslatedBlobs(prev => {
      const merged = new Map(prev);
      newBlobs.forEach((blob, key) => merged.set(key, blob));
      return merged;
    });

    setIsTranslating(false);
    setCurrentTranslatingFile(null);
    setTranslationProgress(null);
    abortControllerRef.current = null;
  };

  const handleCancelTranslation = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  const handleDownloadSingle = (doc: TranslatedDocument) => {
    // Check if we have a DOCX blob for this document
    const docxBlob = translatedBlobs.get(doc.id);

    if (docxBlob) {
      // Download as DOCX
      const url = URL.createObjectURL(docxBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } else {
      // Fallback: download as text
      const blob = new Blob([doc.content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.name.endsWith('.docx') ? doc.name.replace('.docx', '.txt') : doc.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  const handleDownloadAll = () => {
    translatedDocs.forEach(doc => {
      if (doc.status === 'completed') {
        handleDownloadSingle(doc);
      }
    });
  };

  // Get the first selected document for preview
  const selectedDocument = selectedDocIds.length > 0
    ? documents.find(d => d.id === selectedDocIds[0])
    : undefined;
  const selectedTranslatedDoc = translatedDocs.find(d => d.id === selectedTranslatedDocId);

  // Determine what to show in the canvas
  const getPreviewableDocument = (): PreviewableDocument | undefined => {
    if (selectedTranslatedDoc) {
      return { type: 'translated', document: selectedTranslatedDoc };
    }
    if (selectedDocument) {
      return { type: 'original', document: selectedDocument };
    }
    return undefined;
  };

  // Show loading while checking authentication
  if (isCheckingAuth) {
    return (
      <div className="flex items-center justify-center h-screen bg-lightGray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-profBlue-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Show login if not authenticated
  if (!user) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="flex flex-col h-screen bg-lightGray-100 font-sans text-navy-900">
      <TopBar
        sourceLanguage={sourceLanguage}
        targetLanguage={targetLanguage}
        onSourceLanguageChange={setSourceLanguage}
        onTargetLanguageChange={setTargetLanguage}
        user={user}
        onLogout={handleLogout}
      />

      <div className="flex flex-col md:flex-row flex-grow overflow-hidden relative">
        <LeftPanel
          documents={documents}
          onUpload={handleUpload}
          onRemove={handleRemoveDocument}
          onSelect={handleSelectOriginal}
          selectedDocIds={selectedDocIds}
          settings={settings}
          onSettingsChange={setSettings}
        />

        <CenterCanvas
          selectedDocument={getPreviewableDocument()}
        />

        <RightPanel
          documents={documents}
          translatedDocs={translatedDocs}
          isTranslating={isTranslating}
          progress={progress}
          currentTranslatingFile={currentTranslatingFile}
          translationProgress={translationProgress}
          onTranslateAll={handleTranslateAll}
          onDownloadAll={handleDownloadAll}
          onDownloadSingle={handleDownloadSingle}
          onCancelTranslation={handleCancelTranslation}
          onSelectTranslated={handleSelectTranslated}
          selectedTranslatedDocId={selectedTranslatedDocId}
        />
      </div>
    </div>
  );
};

export default App;
