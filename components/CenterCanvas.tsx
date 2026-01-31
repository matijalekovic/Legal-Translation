import React, { useState } from 'react';
import { UploadedDocument, TranslatedDocument } from '../types';
import { FileText, ZoomIn, ZoomOut, Languages } from 'lucide-react';

// Union type for documents that can be previewed
export type PreviewableDocument =
  | { type: 'original'; document: UploadedDocument }
  | { type: 'translated'; document: TranslatedDocument };

interface CenterCanvasProps {
  selectedDocument: PreviewableDocument | undefined;
}

const CenterCanvas: React.FC<CenterCanvasProps> = ({ selectedDocument }) => {
  const [zoom, setZoom] = useState(100);

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 10, 200));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 10, 50));

  if (!selectedDocument) {
    return (
      <div className="flex-grow h-[calc(100vh-64px)] bg-lightGray-200 flex flex-col items-center justify-center p-8">
        <div className="w-24 h-24 bg-lightGray-100 rounded-full flex items-center justify-center mb-4 border border-lightGray-300">
          <FileText className="w-10 h-10 text-slate-300" />
        </div>
        <h3 className="text-lg text-slate-400 font-normal">Select a document to preview</h3>
      </div>
    );
  }

  const isTranslated = selectedDocument.type === 'translated';
  const doc = selectedDocument.document;
  const name = doc.name;

  // Get content based on document type
  const getPreviewContent = () => {
    if (selectedDocument.type === 'original') {
      return selectedDocument.document.previewContent;
    }
    // Translated docs don't have HTML preview, return undefined
    return undefined;
  };

  const getTextContent = () => {
    if (selectedDocument.type === 'translated') {
      // Use previewContent for translated documents (contains the actual translated text)
      return selectedDocument.document.previewContent || doc.content;
    }
    return doc.content;
  };

  const previewContent = getPreviewContent();
  const textContent = getTextContent();

  return (
    <div className="flex-grow h-[calc(100vh-64px)] bg-lightGray-200 flex flex-col relative overflow-hidden">

      {/* Sticky Preview Header */}
      <div className="h-12 bg-white border-b border-lightGray-200 flex items-center justify-between px-4 shrink-0 z-10 shadow-sm">
        <div className="flex items-center space-x-2 overflow-hidden">
          {isTranslated ? (
            <Languages className="w-4 h-4 text-success-green shrink-0" />
          ) : (
            <FileText className="w-4 h-4 text-profBlue-800 shrink-0" />
          )}
          <span className="text-sm font-medium text-navy-900 truncate max-w-[300px]">{name}</span>
          {isTranslated && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-success-bg text-success-text border border-success-green/20">
              Translated
            </span>
          )}
        </div>
        <div className="flex items-center space-x-3">
          <span className="text-xs text-slate-500 w-12 text-center">{zoom}%</span>
          <div className="flex items-center bg-lightGray-100 rounded-md border border-lightGray-300">
            <button
              onClick={handleZoomOut}
              className="p-1.5 hover:bg-white rounded-l-md transition-colors border-r border-lightGray-300"
            >
              <ZoomOut className="w-4 h-4 text-slate-600" />
            </button>
            <button
              onClick={handleZoomIn}
              className="p-1.5 hover:bg-white rounded-r-md transition-colors"
            >
              <ZoomIn className="w-4 h-4 text-slate-600" />
            </button>
          </div>
        </div>
      </div>

      {/* Preview Area */}
      <div className="flex-grow overflow-auto p-8 custom-scrollbar bg-[#e2e8f0] flex justify-center">
        <div
          className="bg-white shadow-lg border border-lightGray-300 h-fit transition-transform duration-200 origin-top"
          style={{
            width: '800px', // Standard letter width simulation
            transform: `scale(${zoom / 100})`,
            marginBottom: '50px'
          }}
        >
          <div className="p-12 md:p-16">
            {previewContent ? (
              <div
                className="document-content"
                dangerouslySetInnerHTML={{ __html: previewContent }}
              />
            ) : (
              <div className="whitespace-pre-wrap font-serif text-navy-900 leading-relaxed text-sm document-content">
                {textContent}
              </div>
            )}
          </div>
        </div>
      </div>

    </div>
  );
};

export default CenterCanvas;