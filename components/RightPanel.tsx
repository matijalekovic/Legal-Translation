import React, { useState } from 'react';
import { UploadedDocument, TranslatedDocument, TranslationProgress } from '../types';
import { Languages, Download, CheckCircle, Loader2, FileText, AlertTriangle, X, HelpCircle, Zap, Sparkles } from 'lucide-react';

// Translation Mode Help Modal
const TranslationModeModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center"
            onClick={onClose}
        >
            {/* Backdrop with blur */}
            <div className="absolute inset-0 bg-navy-900/60 backdrop-blur-sm" />

            {/* Modal */}
            <div
                className="relative bg-white rounded-xl shadow-2xl max-w-md w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col"
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-label="Translation mode help"
            >
                {/* Header */}
                <div className="bg-gradient-to-r from-profBlue-800 to-profBlue-600 px-5 py-4 flex items-center justify-between">
                    <h3 className="text-white font-semibold text-lg">Translation Modes</h3>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
                    >
                        <X className="w-5 h-5 text-white" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-5 space-y-5 overflow-y-auto">
                    {/* Fast Mode */}
                    <div className="border border-lightGray-200 rounded-lg p-4 hover:border-profBlue-800/30 transition-colors">
                        <div className="flex items-center gap-2 mb-2">
                            <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center">
                                <Zap className="w-4 h-4 text-amber-600" />
                            </div>
                            <h4 className="font-semibold text-navy-900">Fast Mode</h4>
                        </div>
                        <p className="text-sm text-slate-600 mb-3">
                            Quick and cost-effective translation using an optimized model.
                        </p>
                        <div className="space-y-1.5">
                            <p className="text-xs text-slate-500 flex items-start gap-2">
                                <CheckCircle className="w-3.5 h-3.5 text-green-500 mt-0.5 shrink-0" />
                                <span>Best for translating <strong>to English</strong> or other widely-supported languages</span>
                            </p>
                            <p className="text-xs text-slate-500 flex items-start gap-2">
                                <CheckCircle className="w-3.5 h-3.5 text-green-500 mt-0.5 shrink-0" />
                                <span>Ideal for <strong>short documents</strong>, forms, and simple contracts</span>
                            </p>
                            <p className="text-xs text-slate-500 flex items-start gap-2">
                                <CheckCircle className="w-3.5 h-3.5 text-green-500 mt-0.5 shrink-0" />
                                <span>Great for <strong>quick drafts</strong> and initial reviews</span>
                            </p>
                        </div>
                    </div>

                    {/* Professional Mode */}
                    <div className="border border-profBlue-800/30 rounded-lg p-4 bg-blue-50/30">
                        <div className="flex items-center gap-2 mb-2">
                            <div className="w-8 h-8 rounded-full bg-profBlue-800/10 flex items-center justify-center">
                                <Sparkles className="w-4 h-4 text-profBlue-800" />
                            </div>
                            <h4 className="font-semibold text-navy-900">Professional Mode</h4>
                        </div>
                        <p className="text-sm text-slate-600 mb-3">
                            Premium translation with advanced language model for superior accuracy.
                        </p>
                        <div className="space-y-1.5">
                            <p className="text-xs text-slate-500 flex items-start gap-2">
                                <CheckCircle className="w-3.5 h-3.5 text-profBlue-800 mt-0.5 shrink-0" />
                                <span>Essential for <strong>harder target languages</strong> like Serbian, Hungarian, Czech, or Slovak</span>
                            </p>
                            <p className="text-xs text-slate-500 flex items-start gap-2">
                                <CheckCircle className="w-3.5 h-3.5 text-profBlue-800 mt-0.5 shrink-0" />
                                <span>Best for <strong>lengthy or structurally complex documents</strong> with intricate legal terminology</span>
                            </p>
                            <p className="text-xs text-slate-500 flex items-start gap-2">
                                <CheckCircle className="w-3.5 h-3.5 text-profBlue-800 mt-0.5 shrink-0" />
                                <span>Superior handling of <strong>context and nuance</strong> in legal text</span>
                            </p>
                            <p className="text-xs text-slate-500 flex items-start gap-2">
                                <CheckCircle className="w-3.5 h-3.5 text-profBlue-800 mt-0.5 shrink-0" />
                                <span>Recommended for <strong>final versions</strong> of important documents</span>
                            </p>
                        </div>
                    </div>

                    {/* Tip */}
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                        <p className="text-xs text-amber-800">
                            <strong>Tip:</strong> If unsure, start with Fast mode for a quick preview, then use Professional mode for the final translation.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

interface RightPanelProps {
    documents: UploadedDocument[];
    translatedDocs: TranslatedDocument[];
    isTranslating: boolean;
    progress: number;
    currentTranslatingFile: string | null;
    translationProgress: TranslationProgress | null;
    translationMode: 'fast' | 'professional';
    onTranslationModeChange: (mode: 'fast' | 'professional') => void;
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
    translationMode,
    onTranslationModeChange,
    onTranslateAll,
    onDownloadAll,
    onDownloadSingle,
    onCancelTranslation,
    onSelectTranslated,
    selectedTranslatedDocId
}) => {
    const [isModeHelpOpen, setIsModeHelpOpen] = useState(false);
    // Get IDs of current documents in the left panel
    const currentDocIds = new Set(documents.map(d => d.id));

    // Count translations for documents that are CURRENTLY in the left panel (for translate button)
    const pendingCompletedCount = translatedDocs.filter(td =>
        td.status === 'completed' && currentDocIds.has(td.originalDocId)
    ).length;

    // Count ALL completed translations (for download button)
    const allCompletedCount = translatedDocs.filter(td => td.status === 'completed').length;

    const totalCount = documents.length;
    const isAllCompleted = totalCount > 0 && pendingCompletedCount === totalCount;
    const hasDocuments = documents.length > 0;

    return (
        <div className="w-full md:w-[280px] 2xl:w-[320px] h-[calc(100vh-56px)] 2xl:h-[calc(100vh-64px)] bg-lightGray-100 border-l border-lightGray-200 flex flex-col shrink-0">
            <TranslationModeModal isOpen={isModeHelpOpen} onClose={() => setIsModeHelpOpen(false)} />

            {/* Header */}
            <div className="h-12 2xl:h-14 bg-white border-b border-lightGray-200 px-3 2xl:px-4 flex items-center justify-between shrink-0">
                <h2 className="text-navy-900 text-sm 2xl:text-base font-semibold">Translated Docs</h2>
                {allCompletedCount > 0 && (
                    <span className="text-xs text-slate-500 font-medium">
                        {allCompletedCount} <span className="hidden 2xl:inline">complete</span>
                    </span>
                )}
            </div>

            <div className="flex-grow overflow-y-auto custom-scrollbar p-3 2xl:p-4">

                {/* Translate Button */}
                <button
                    onClick={onTranslateAll}
                    disabled={isTranslating || !hasDocuments || isAllCompleted}
                    className={`
                w-full h-11 2xl:h-14 rounded-lg flex items-center justify-center space-x-2 font-semibold text-sm text-white shadow-md transition-all duration-200 mb-3 2xl:mb-4
                ${isTranslating || !hasDocuments || isAllCompleted
                            ? 'bg-slate-300 cursor-not-allowed shadow-none'
                            : 'bg-gradient-to-r from-profBlue-800 to-profBlue-600 hover:scale-[1.02] hover:shadow-lg active:scale-[0.98]'}
            `}
                >
                    {isTranslating ? (
                        <>
                            <Loader2 className="w-4 h-4 2xl:w-5 2xl:h-5 animate-spin" />
                            <span>Processing...</span>
                        </>
                    ) : (
                        <>
                            <Languages className="w-4 h-4 2xl:w-5 2xl:h-5" />
                            <span>{isAllCompleted ? 'Translation Complete' : 'TRANSLATE ALL'}</span>
                        </>
                    )}
                </button>

                {/* Translation Mode Selector */}
                {!isTranslating && (
                    <div className="mb-3 2xl:mb-4">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[11px] 2xl:text-xs font-semibold text-slate-600">Translation Mode</span>
                            <button
                                onClick={() => setIsModeHelpOpen(true)}
                                className="w-6 h-6 rounded-full border border-lightGray-200 bg-white text-slate-500 hover:text-profBlue-800 hover:border-profBlue-800/50 hover:bg-blue-50 transition-colors flex items-center justify-center"
                                aria-label="Open translation mode help"
                                title="Translation mode help"
                            >
                                <HelpCircle className="w-3.5 h-3.5" />
                            </button>
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={() => onTranslationModeChange('fast')}
                                className={`
                                    flex-1 h-9 2xl:h-10 rounded-md flex items-center justify-center text-xs 2xl:text-sm font-medium transition-all duration-200
                                    ${translationMode === 'fast'
                                        ? 'bg-profBlue-800 text-white shadow-md'
                                        : 'bg-white text-slate-600 border border-lightGray-200 hover:border-profBlue-800 hover:text-profBlue-800'}
                                `}
                            >
                                <span>⚡ Fast</span>
                            </button>
                            <button
                                onClick={() => onTranslationModeChange('professional')}
                                className={`
                                    flex-1 h-9 2xl:h-10 rounded-md flex items-center justify-center text-xs 2xl:text-sm font-medium transition-all duration-200
                                    ${translationMode === 'professional'
                                        ? 'bg-profBlue-800 text-white shadow-md'
                                        : 'bg-white text-slate-600 border border-lightGray-200 hover:border-profBlue-800 hover:text-profBlue-800'}
                                `}
                            >
                                <span>✨ Professional</span>
                            </button>
                        </div>
                        <p className="text-[10px] 2xl:text-xs text-slate-500 text-center mt-1.5 2xl:mt-2">
                            {translationMode === 'fast' ? 'Faster, cost-effective' : 'Higher quality, advanced model'}
                        </p>
                    </div>
                )}

                {/* Progress Indicator */}
                {isTranslating && (
                    <div className="bg-white border border-lightGray-200 rounded-md p-3 2xl:p-4 mb-3 2xl:mb-4 shadow-sm">
                        <div className="flex justify-between items-center mb-1.5 2xl:mb-2">
                            <span className="text-xs 2xl:text-sm font-medium text-profBlue-800">
                                {translationProgress ? getPhaseLabel(translationProgress.phase) : 'Processing...'}
                            </span>
                            <button
                                onClick={onCancelTranslation}
                                className="w-5 h-5 2xl:w-6 2xl:h-6 rounded flex items-center justify-center text-slate-400 hover:text-error-red hover:bg-error-bg transition-colors"
                                title="Cancel translation"
                            >
                                <X className="w-3.5 h-3.5 2xl:w-4 2xl:h-4" />
                            </button>
                        </div>

                        {/* Current file */}
                        <div className="text-[10px] 2xl:text-xs text-slate-500 font-mono truncate mb-1.5 2xl:mb-2" title={currentTranslatingFile || ''}>
                            {currentTranslatingFile}
                        </div>

                        {/* Progress bar */}
                        <div className="h-1.5 2xl:h-2 bg-lightGray-200 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-progress-blue transition-all duration-300 ease-out relative overflow-hidden"
                                style={{ width: `${progress}%` }}
                            >
                                <div className="absolute top-0 left-0 bottom-0 right-0 bg-white/20 animate-[pulse_2s_infinite]"></div>
                            </div>
                        </div>

                        {/* Detailed progress */}
                        <div className="mt-1.5 2xl:mt-2 flex justify-between items-center">
                            <span className="text-sm 2xl:text-lg font-bold text-profBlue-800">{Math.round(progress)}%</span>
                            {translationProgress && translationProgress.phase === 'translating' && (
                                <span className="text-[10px] 2xl:text-xs text-slate-500">
                                    Batch {translationProgress.currentBatch}/{translationProgress.totalBatches}
                                </span>
                            )}
                        </div>

                        {/* Segment progress for DOCX */}
                        {translationProgress && translationProgress.totalSegments > 0 && (
                            <div className="mt-1 text-[10px] 2xl:text-xs text-slate-400 text-center">
                                {translationProgress.currentSegment} / {translationProgress.totalSegments} segments
                            </div>
                        )}
                    </div>
                )}

                {/* Download All Button */}
                <button
                    onClick={onDownloadAll}
                    disabled={allCompletedCount === 0}
                    className={`
                w-full h-9 2xl:h-11 rounded-md border-2 flex items-center justify-center space-x-1.5 2xl:space-x-2 font-medium text-xs 2xl:text-sm transition-all duration-200 mb-4 2xl:mb-6
                ${allCompletedCount === 0
                            ? 'border-slate-200 text-slate-300 cursor-not-allowed'
                            : 'border-profBlue-800 text-profBlue-800 bg-white hover:bg-blue-50'}
            `}
                >
                    <Download className="w-3.5 h-3.5 2xl:w-4 2xl:h-4" />
                    <span><span className="2xl:hidden">Download All</span><span className="hidden 2xl:inline">Download All Translations</span></span>
                </button>

                {/* List of Translated Docs */}
                <div className="space-y-2 2xl:space-y-3">
                    {translatedDocs.length === 0 && !isTranslating && (
                        <div className="text-center py-8 2xl:py-10 opacity-50">
                            <div className="w-12 h-12 2xl:w-16 2xl:h-16 bg-slate-200 rounded-full flex items-center justify-center mx-auto mb-2 2xl:mb-3">
                                <FileText className="w-6 h-6 2xl:w-8 2xl:h-8 text-slate-400" />
                            </div>
                            <p className="text-xs 2xl:text-sm text-slate-500">Translations will appear here</p>
                        </div>
                    )}

                    {translatedDocs.map((doc) => (
                        <div
                            key={doc.id}
                            onClick={() => onSelectTranslated(doc.id)}
                            className={`bg-white border rounded-md p-2 2xl:p-3 hover:shadow-md transition-all cursor-pointer ${selectedTranslatedDocId === doc.id
                                    ? 'border-profBlue-800 ring-2 ring-profBlue-800/20 shadow-md'
                                    : 'border-lightGray-200'
                                }`}
                        >
                            <div className="flex items-start justify-between mb-1.5 2xl:mb-2">
                                <div className="flex items-center space-x-1.5 2xl:space-x-2 overflow-hidden">
                                    {doc.status === 'error' ? (
                                        <AlertTriangle className="w-3.5 h-3.5 2xl:w-4 2xl:h-4 text-error-red shrink-0" />
                                    ) : (
                                        <FileText className="w-3.5 h-3.5 2xl:w-4 2xl:h-4 text-success-green shrink-0" />
                                    )}
                                    <span className="text-[11px] 2xl:text-[13px] font-mono text-navy-900 truncate" title={doc.name}>{doc.name}</span>
                                </div>
                            </div>

                            <div className="flex items-center justify-between text-[10px] 2xl:text-xs text-slate-500 mb-2 2xl:mb-3">
                                <span>{doc.languageFrom} → {doc.languageTo}</span>
                                <span>{new Date(doc.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>

                            <div className="flex items-center justify-between">
                                {doc.status === 'completed' && (
                                    <span className="inline-flex items-center px-1.5 2xl:px-2 py-0.5 2xl:py-1 rounded-full text-[9px] 2xl:text-[10px] font-medium bg-success-bg text-success-text border border-success-green/20">
                                        <CheckCircle className="w-2.5 h-2.5 2xl:w-3 2xl:h-3 mr-0.5 2xl:mr-1" />
                                        Completed
                                    </span>
                                )}
                                {doc.status === 'processing' && (
                                    <span className="inline-flex items-center px-1.5 2xl:px-2 py-0.5 2xl:py-1 rounded-full text-[9px] 2xl:text-[10px] font-medium bg-blue-50 text-profBlue-800 border border-profBlue-800/20">
                                        <Loader2 className="w-2.5 h-2.5 2xl:w-3 2xl:h-3 mr-0.5 2xl:mr-1 animate-spin" />
                                        Processing
                                    </span>
                                )}
                                {doc.status === 'error' && (
                                    <span className="inline-flex items-center px-1.5 2xl:px-2 py-0.5 2xl:py-1 rounded-full text-[9px] 2xl:text-[10px] font-medium bg-error-bg text-error-red border border-error-red/20">
                                        Failed
                                    </span>
                                )}

                                <button
                                    onClick={() => onDownloadSingle(doc)}
                                    disabled={doc.status !== 'completed'}
                                    className={`w-7 h-7 2xl:w-8 2xl:h-8 rounded flex items-center justify-center transition-colors
                                ${doc.status === 'completed'
                                            ? 'bg-blue-50 hover:bg-profBlue-800 hover:text-white text-profBlue-800'
                                            : 'bg-slate-100 text-slate-300 cursor-not-allowed'}
                            `}
                                >
                                    <Download className="w-3.5 h-3.5 2xl:w-4 2xl:h-4" />
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
