import React, { useState, useCallback } from 'react';
import mammoth from 'mammoth';
import { UploadedDocument, TranslatedDocument, DocumentSettings } from './types';
import { translateLegalText } from './services/geminiService';
import TopBar from './components/TopBar';
import LeftPanel from './components/LeftPanel';
import CenterCanvas from './components/CenterCanvas';
import RightPanel from './components/RightPanel';

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
  const [documents, setDocuments] = useState<UploadedDocument[]>([]);
  const [translatedDocs, setTranslatedDocs] = useState<TranslatedDocument[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTranslatingFile, setCurrentTranslatingFile] = useState<string | null>(null);
  
  const [settings, setSettings] = useState<DocumentSettings>({
    translateHeaders: true,
    translateFootnotes: true,
    preserveFormatting: true,
    translateComments: false,
    excludedText: ''
  });

  const handleUpload = useCallback(async (files: FileList) => {
    const newDocs: UploadedDocument[] = [];
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
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
    if (!selectedDocId && newDocs.length > 0) {
      setSelectedDocId(newDocs[0].id);
    }
  }, [selectedDocId]);

  const handleRemoveDocument = (id: string) => {
    setDocuments(prev => prev.filter(d => d.id !== id));
    if (selectedDocId === id) setSelectedDocId(null);
  };

  const handleTranslateAll = async () => {
    if (documents.length === 0) return;

    setIsTranslating(true);
    setProgress(0);
    
    // Create placeholders for translated docs
    const newTranslatedDocs: TranslatedDocument[] = documents.map(doc => ({
      id: `trans-${doc.id}`,
      originalDocId: doc.id,
      name: `ES_${doc.name}`,
      originalName: doc.name,
      content: '',
      languageFrom: 'English',
      languageTo: 'Spanish',
      timestamp: Date.now(),
      status: 'processing'
    }));

    setTranslatedDocs(newTranslatedDocs);

    const totalDocs = documents.length;
    let completed = 0;

    for (const doc of documents) {
      setCurrentTranslatingFile(doc.name);
      
      try {
        const translatedText = await translateLegalText(doc.content, 'Spanish', settings.excludedText);
        
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

      } catch (error) {
         setTranslatedDocs(prev => prev.map(td => {
            if (td.originalDocId === doc.id) {
                return {
                    ...td,
                    status: 'error',
                    content: 'Error during translation.'
                };
            }
            return td;
        }));
      }

      completed++;
      setProgress((completed / totalDocs) * 100);
    }

    setIsTranslating(false);
    setCurrentTranslatingFile(null);
  };

  const handleDownloadSingle = (doc: TranslatedDocument) => {
    const blob = new Blob([doc.content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = doc.name.endsWith('.docx') ? doc.name.replace('.docx', '.txt') : doc.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadAll = () => {
    translatedDocs.forEach(doc => {
      if (doc.status === 'completed') {
        handleDownloadSingle(doc);
      }
    });
  };

  const selectedDocument = documents.find(d => d.id === selectedDocId);

  return (
    <div className="flex flex-col h-screen bg-lightGray-100 font-sans text-navy-900">
      <TopBar />
      
      <div className="flex flex-col md:flex-row flex-grow overflow-hidden relative">
        <LeftPanel 
            documents={documents}
            onUpload={handleUpload}
            onRemove={handleRemoveDocument}
            onSelect={setSelectedDocId}
            selectedDocId={selectedDocId}
            settings={settings}
            onSettingsChange={setSettings}
        />

        <CenterCanvas 
            selectedDocument={selectedDocument}
        />

        <RightPanel 
            documents={documents}
            translatedDocs={translatedDocs}
            isTranslating={isTranslating}
            progress={progress}
            currentTranslatingFile={currentTranslatingFile}
            onTranslateAll={handleTranslateAll}
            onDownloadAll={handleDownloadAll}
            onDownloadSingle={handleDownloadSingle}
        />
      </div>
    </div>
  );
};

export default App;