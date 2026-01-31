import React, { useRef } from 'react';
import { UploadCloud, FileText, X, CheckSquare, Square, FileType } from 'lucide-react';
import { DocumentSettings, UploadedDocument } from '../types';

interface LeftPanelProps {
  documents: UploadedDocument[];
  onUpload: (files: File[]) => void;
  onRemove: (id: string) => void;
  onSelect: (id: string) => void;
  selectedDocId: string | null;
  settings: DocumentSettings;
  onSettingsChange: (settings: DocumentSettings) => void;
}

const LeftPanel: React.FC<LeftPanelProps> = ({
  documents,
  onUpload,
  onRemove,
  onSelect,
  selectedDocId,
  settings,
  onSettingsChange
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    if (files.length > 0) {
      onUpload(files);
    }
    // Reset input to allow selecting same file again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const files = e.dataTransfer.files ? Array.from(e.dataTransfer.files) : [];
    if (files.length > 0) {
      onUpload(files);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const openFileDialog = () => {
    if (!fileInputRef.current) return;
    // Ensure multi-select is always enabled before opening the picker.
    fileInputRef.current.multiple = true;
    fileInputRef.current.click();
  };

  const toggleSetting = (key: keyof DocumentSettings) => {
    if (key === 'excludedText') return;
    onSettingsChange({
      ...settings,
      [key]: !settings[key]
    });
  };

  const handleExcludedTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onSettingsChange({
      ...settings,
      excludedText: e.target.value
    });
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <div className="w-full md:w-[320px] h-[calc(100vh-64px)] bg-lightGray-100 border-r border-lightGray-200 flex flex-col shrink-0">
      
      {/* Header */}
      <div className="h-14 bg-white border-b border-lightGray-200 px-4 flex items-center justify-between shrink-0">
        <h2 className="text-navy-900 text-base font-semibold">Upload Queue</h2>
        <span className="bg-lightGray-100 text-slate-500 text-xs px-2 py-1 rounded-full border border-lightGray-200">
          {documents.length} documents
        </span>
      </div>

      {/* Scrollable Content Area */}
      <div className="flex-grow overflow-y-auto custom-scrollbar flex flex-col">
        
        {/* Upload Area */}
        <div className="p-4 shrink-0">
            <div 
                className="h-[140px] border-2 border-dashed border-lightGray-300 rounded-lg bg-white hover:bg-blue-50 hover:border-profBlue-800 transition-all duration-200 cursor-pointer flex flex-col items-center justify-center p-4 text-center group"
                onClick={openFileDialog}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
            >
                <input 
                    type="file" 
                    ref={fileInputRef} 
                    className="hidden" 
                    multiple 
                    accept=".docx,.txt,.md"
                    onChange={handleFileChange}
                />
                <div className="w-12 h-12 rounded-full bg-lightGray-100 flex items-center justify-center mb-3 group-hover:bg-blue-100 group-hover:scale-110 transition-all duration-200">
                    <UploadCloud className="text-slate-500 w-6 h-6 group-hover:text-profBlue-800" />
                </div>
                <p className="text-sm text-navy-900 font-medium group-hover:text-profBlue-800 transition-colors">Click to upload or drag files</p>
                <p className="text-xs text-slate-400 mt-1">.docx format supported</p>
            </div>
        </div>

        {/* Document List */}
        <div className="px-4 pb-4 space-y-3 flex-grow">
            {documents.length === 0 && (
                <div className="text-center py-8">
                    <p className="text-sm text-slate-400 italic">No documents in queue</p>
                </div>
            )}
            {documents.map((doc) => (
                <div 
                    key={doc.id}
                    onClick={() => onSelect(doc.id)}
                    className={`
                        group relative w-full p-3 rounded-lg border cursor-pointer transition-all duration-200 flex items-center gap-3
                        ${selectedDocId === doc.id 
                            ? 'bg-blue-50/60 border-profBlue-800 shadow-[0_0_0_1px_rgba(44,82,130,1)] z-10' 
                            : 'bg-white border-lightGray-200 hover:border-profBlue-400 hover:shadow-md'}
                    `}
                >
                    {/* Icon Container */}
                    <div className={`
                        w-10 h-10 rounded-lg flex items-center justify-center shrink-0 transition-colors duration-200
                        ${selectedDocId === doc.id ? 'bg-profBlue-100' : 'bg-slate-50 group-hover:bg-blue-50 border border-slate-100'}
                    `}>
                        <FileText className={`w-5 h-5 ${selectedDocId === doc.id ? 'text-profBlue-800' : 'text-slate-400 group-hover:text-profBlue-600'}`} />
                    </div>

                    {/* Content */}
                    <div className="flex-grow min-w-0 pr-6">
                        <h4 
                          className={`text-sm font-semibold truncate leading-tight mb-1.5 ${selectedDocId === doc.id ? 'text-profBlue-900' : 'text-navy-900'}`}
                          title={doc.name}
                        >
                            {doc.name}
                        </h4>
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 tracking-wide">
                                {doc.name.split('.').pop()?.toUpperCase().substring(0, 4) || 'FILE'}
                            </span>
                            <span className="text-xs text-slate-400">
                                {formatFileSize(doc.size)}
                            </span>
                        </div>
                    </div>

                    {/* Actions */}
                    <button 
                        onClick={(e) => { e.stopPropagation(); onRemove(doc.id); }}
                        className="opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity p-1.5 rounded-full hover:bg-red-50 text-slate-400 hover:text-error-red absolute right-2 top-1/2 -translate-y-1/2"
                        title="Remove document"
                        aria-label="Remove document"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            ))}
        </div>

      </div>

      {/* Settings Section (Fixed at bottom) */}
      <div className="shrink-0 bg-white border-t border-lightGray-200 p-4 h-[220px]">
        <h3 className="text-sm font-semibold text-navy-900 mb-3 flex items-center gap-2">
            Translation Options
        </h3>
        <div className="space-y-2.5">
            <label className="flex items-center space-x-2 cursor-pointer group select-none">
                <div onClick={() => toggleSetting('translateHeaders')} className="relative">
                    {settings.translateHeaders 
                        ? <CheckSquare className="w-5 h-5 text-profBlue-800" /> 
                        : <Square className="w-5 h-5 text-slate-300 group-hover:text-profBlue-600 transition-colors" />}
                </div>
                <span className="text-sm text-slate-700 group-hover:text-navy-900 transition-colors">Translate headers & footers</span>
            </label>
            <label className="flex items-center space-x-2 cursor-pointer group select-none">
                <div onClick={() => toggleSetting('translateFootnotes')} className="relative">
                    {settings.translateFootnotes 
                        ? <CheckSquare className="w-5 h-5 text-profBlue-800" /> 
                        : <Square className="w-5 h-5 text-slate-300 group-hover:text-profBlue-600 transition-colors" />}
                </div>
                <span className="text-sm text-slate-700 group-hover:text-navy-900 transition-colors">Translate footnotes</span>
            </label>
            <label className="flex items-center space-x-2 cursor-pointer group select-none">
                <div onClick={() => toggleSetting('preserveFormatting')} className="relative">
                    {settings.preserveFormatting 
                        ? <CheckSquare className="w-5 h-5 text-profBlue-800" /> 
                        : <Square className="w-5 h-5 text-slate-300 group-hover:text-profBlue-600 transition-colors" />}
                </div>
                <span className="text-sm text-slate-700 group-hover:text-navy-900 transition-colors">Preserve formatting</span>
            </label>
            
            <div className="mt-3 pt-2">
                <label className="block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wide">Exclude Words</label>
                <textarea 
                    className="w-full h-12 bg-lightGray-100 border border-lightGray-300 rounded-md px-3 py-2 text-xs font-mono text-navy-900 focus:border-profBlue-800 focus:ring-1 focus:ring-profBlue-800 focus:outline-none resize-none placeholder:text-slate-400 transition-all"
                    placeholder="E.g. CompanyName, BrandX"
                    value={settings.excludedText}
                    onChange={handleExcludedTextChange}
                />
            </div>
        </div>
      </div>

    </div>
  );
};

export default LeftPanel;
