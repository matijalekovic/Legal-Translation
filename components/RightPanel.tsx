import React from 'react';
import { UploadedDocument, TranslatedDocument, TranslationProgress } from '../types';
import { Languages, Download, CheckCircle, Loader2, FileText, AlertTriangle, X } from 'lucide-react';

interface RightPanelProps {
    documents: UploadedDocument[];
    translatedDocs: TranslatedDocument[];
    isTranslating: boolean;
    progress: number;
    currentTranslatingFile: string | null;
    translationProgress: TranslationProgress | null;
    onTranslateAll: () => void;
    onDownloadAll: () => void;
    onDownloadSingle: (doc: TranslatedDocument) => void;
    onCancelTranslation: () => void;
    onSelectTranslated: (docId: string) => void;
    selectedTranslatedDocId: string | null;
}

const getPhaseLabel = (phase: TranslationProgress['phase']): string => {
    switch (phase) {
        case 'parsing': return 'Parsing document...';
        case 'analyzing': return 'Analyzing context...';
        case 'translating': return 'Translating...';
        case 'rebuilding': return 'Rebuilding document...';
        case 'complete': return 'Complete!';
        case 'error': return 'Error';
        case 'cancelled': return 'Cancelled';
        default: return 'Processing...';
    }
};

const RightPanel: React.FC<RightPanelProps> = ({
    documents,
    translatedDocs,
    isTranslating,
    progress,
    currentTranslatingFile,
    translationProgress,
    onTranslateAll,
    onDownloadAll,
    onDownloadSingle,
    onCancelTranslation,
    onSelectTranslated,
    selectedTranslatedDocId
}) => {
    const completedCount = translatedDocs.filter(d => d.status === 'completed').length;
    const totalCount = documents.length;
    const isAllCompleted = totalCount > 0 && completedCount === totalCount;
    const hasDocuments = documents.length > 0;

    return (
        <div className="w-full md:w-[280px] h-[calc(100vh-56px)] bg-lightGray-100 border-l border-lightGray-200 flex flex-col shrink-0">

            {/* Header */}
            <div className="h-12 bg-white border-b border-lightGray-200 px-3 flex items-center justify-between shrink-0">
                <h2 className="text-navy-900 text-sm font-semibold">Translated Docs</h2>
                {hasDocuments && (
                    <span className="text-xs text-slate-500 font-medium">
                        {completedCount}/{totalCount}
                    </span>
                )}
            </div>

            <div className="flex-grow overflow-y-auto custom-scrollbar p-3">

                {/* Translate Button */}
                <button
                    onClick={onTranslateAll}
                    disabled={isTranslating || !hasDocuments || isAllCompleted}
                    className={`
                w-full h-11 rounded-lg flex items-center justify-center space-x-2 font-semibold text-sm text-white shadow-md transition-all duration-200 mb-3
                ${isTranslating || !hasDocuments || isAllCompleted
                            ? 'bg-slate-300 cursor-not-allowed shadow-none'
                            : 'bg-gradient-to-r from-profBlue-800 to-profBlue-600 hover:scale-[1.02] hover:shadow-lg active:scale-[0.98]'}
            `}
                >
                    {isTranslating ? (
                        <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Processing...</span>
                        </>
                    ) : (
                        <>
                            <Languages className="w-4 h-4" />
                            <span>{isAllCompleted ? 'Complete' : 'TRANSLATE ALL'}</span>
                        </>
                    )}
                </button>

                {/* Progress Indicator */}
                {isTranslating && (
                    <div className="bg-white border border-lightGray-200 rounded-md p-3 mb-3 shadow-sm">
                        <div className="flex justify-between items-center mb-1.5">
                            <span className="text-xs font-medium text-profBlue-800">
                                {translationProgress ? getPhaseLabel(translationProgress.phase) : 'Processing...'}
                            </span>
                            <button
                                onClick={onCancelTranslation}
                                className="w-5 h-5 rounded flex items-center justify-center text-slate-400 hover:text-error-red hover:bg-error-bg transition-colors"
                                title="Cancel translation"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        </div>

                        {/* Current file */}
                        <div className="text-[10px] text-slate-500 font-mono truncate mb-1.5" title={currentTranslatingFile || ''}>
                            {currentTranslatingFile}
                        </div>

                        {/* Progress bar */}
                        <div className="h-1.5 bg-lightGray-200 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-progress-blue transition-all duration-300 ease-out relative overflow-hidden"
                                style={{ width: `${progress}%` }}
                            >
                                <div className="absolute top-0 left-0 bottom-0 right-0 bg-white/20 animate-[pulse_2s_infinite]"></div>
                            </div>
                        </div>

                        {/* Detailed progress */}
                        <div className="mt-1.5 flex justify-between items-center">
                            <span className="text-sm font-bold text-profBlue-800">{Math.round(progress)}%</span>
                            {translationProgress && translationProgress.phase === 'translating' && (
                                <span className="text-[10px] text-slate-500">
                                    Batch {translationProgress.currentBatch}/{translationProgress.totalBatches}
                                </span>
                            )}
                        </div>

                        {/* Segment progress for DOCX */}
                        {translationProgress && translationProgress.totalSegments > 0 && (
                            <div className="mt-1 text-[10px] text-slate-400 text-center">
                                {translationProgress.currentSegment} / {translationProgress.totalSegments} segments
                            </div>
                        )}
                    </div>
                )}

                {/* Download All Button */}
                <button
                    onClick={onDownloadAll}
                    disabled={completedCount === 0}
                    className={`
                w-full h-9 rounded-md border-2 flex items-center justify-center space-x-1.5 font-medium text-xs transition-all duration-200 mb-4
                ${completedCount === 0
                            ? 'border-slate-200 text-slate-300 cursor-not-allowed'
                            : 'border-profBlue-800 text-profBlue-800 bg-white hover:bg-blue-50'}
            `}
                >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download All</span>
                </button>

                {/* List of Translated Docs */}
                <div className="space-y-2">
                    {translatedDocs.length === 0 && !isTranslating && (
                        <div className="text-center py-8 opacity-50">
                            <div className="w-12 h-12 bg-slate-200 rounded-full flex items-center justify-center mx-auto mb-2">
                                <FileText className="w-6 h-6 text-slate-400" />
                            </div>
                            <p className="text-xs text-slate-500">Translations will appear here</p>
                        </div>
                    )}

                    {translatedDocs.map((doc) => (
                        <div
                            key={doc.id}
                            onClick={() => onSelectTranslated(doc.id)}
                            className={`bg-white border rounded-md p-2 hover:shadow-md transition-all cursor-pointer ${selectedTranslatedDocId === doc.id
                                    ? 'border-profBlue-800 ring-2 ring-profBlue-800/20 shadow-md'
                                    : 'border-lightGray-200'
                                }`}
                        >
                            <div className="flex items-start justify-between mb-1.5">
                                <div className="flex items-center space-x-1.5 overflow-hidden">
                                    {doc.status === 'error' ? (
                                        <AlertTriangle className="w-3.5 h-3.5 text-error-red shrink-0" />
                                    ) : (
                                        <FileText className="w-3.5 h-3.5 text-success-green shrink-0" />
                                    )}
                                    <span className="text-[11px] font-mono text-navy-900 truncate" title={doc.name}>{doc.name}</span>
                                </div>
                            </div>

                            <div className="flex items-center justify-between text-[10px] text-slate-500 mb-2">
                                <span>{doc.languageFrom} → {doc.languageTo}</span>
                                <span>{new Date(doc.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>

                            <div className="flex items-center justify-between">
                                {doc.status === 'completed' && (
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-medium bg-success-bg text-success-text border border-success-green/20">
                                        <CheckCircle className="w-2.5 h-2.5 mr-0.5" />
                                        Completed
                                    </span>
                                )}
                                {doc.status === 'processing' && (
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-medium bg-blue-50 text-profBlue-800 border border-profBlue-800/20">
                                        <Loader2 className="w-2.5 h-2.5 mr-0.5 animate-spin" />
                                        Processing
                                    </span>
                                )}
                                {doc.status === 'error' && (
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-medium bg-error-bg text-error-red border border-error-red/20">
                                        Failed
                                    </span>
                                )}

                                <button
                                    onClick={() => onDownloadSingle(doc)}
                                    disabled={doc.status !== 'completed'}
                                    className={`w-7 h-7 rounded flex items-center justify-center transition-colors
                                ${doc.status === 'completed'
                                            ? 'bg-blue-50 hover:bg-profBlue-800 hover:text-white text-profBlue-800'
                                            : 'bg-slate-100 text-slate-300 cursor-not-allowed'}
                            `}
                                >
                                    <Download className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>

            </div>
        </div>
    );
};

export default RightPanel;
