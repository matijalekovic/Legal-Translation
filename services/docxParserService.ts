import JSZip from 'jszip';
import {
  ParsedDocx,
  ParsedLegalDocx,
  TextSegment,
  SegmentContext,
  DocumentMetadata,
  DocumentSettings,
  LegalSection,
  LegalSectionType,
} from '../types';

// WordprocessingML namespace
const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

/**
 * Parses a DOCX file and extracts all text segments with their XML context
 * Also detects legal document sections for context-aware translation
 */
export async function parseDocx(
  file: File,
  settings: DocumentSettings
): Promise<ParsedLegalDocx> {
  // Load the DOCX file as a ZIP archive
  const arrayBuffer = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(arrayBuffer);

  const xmlDocuments = new Map<string, Document>();
  const segments: TextSegment[] = [];

  // Determine which files to parse
  const filesToParse: Array<{ path: string; location: SegmentContext['location'] }> = [
    { path: 'word/document.xml', location: 'body' },
  ];

  // Find all headers and footers dynamically
  for (const filename of Object.keys(zip.files)) {
    if (settings.translateHeaders && /^word\/header\d*\.xml$/.test(filename)) {
      filesToParse.push({ path: filename, location: 'header' });
    }
    if (settings.translateFootnotes && /^word\/footer\d*\.xml$/.test(filename)) {
      filesToParse.push({ path: filename, location: 'footer' });
    }
  }

  // Parse each XML file
  for (const { path, location } of filesToParse) {
    const zipFile = zip.file(path);
    if (!zipFile) continue;

    const xmlString = await zipFile.async('string');
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlString, 'application/xml');

    // Check for parsing errors
    const parseError = doc.querySelector('parsererror');
    if (parseError) {
      console.warn(`XML parsing error in ${path}:`, parseError.textContent);
      continue;
    }

    xmlDocuments.set(path, doc);

    // Extract paragraphs from this XML file
    extractParagraphSegments(doc, path, location, segments);
  }

  // Detect legal document sections
  const sections = detectLegalSections(segments);

  // Calculate metadata
  const metadata = calculateMetadata(segments);

  return {
    originalFile: file,
    zipInstance: zip,
    xmlDocuments,
    segments,
    sections,
    metadata,
  };
}

/**
 * Extracts text segments from paragraphs in an XML document
 */
function extractParagraphSegments(
  doc: Document,
  xmlPath: string,
  location: SegmentContext['location'],
  segments: TextSegment[]
): void {
  // Find all <w:p> elements (paragraphs)
  const paragraphs = doc.getElementsByTagNameNS(W_NS, 'p');

  for (let i = 0; i < paragraphs.length; i++) {
    const para = paragraphs[i];

    // Extract all text from <w:t> elements within this paragraph
    const text = extractParagraphText(para);

    // Skip empty paragraphs
    if (text.trim().length === 0) {
      continue;
    }

    // Detect if paragraph is inside a table cell
    let actualLocation = location;
    let node = para.parentElement;
    while (node) {
      if (node.localName === 'tc') {
        actualLocation = 'table-cell';
        break;
      }
      node = node.parentElement;
    }

    // Extract style info
    const styleInfo = extractStyleInfo(para);

    segments.push({
      id: `docx-${xmlPath.replace(/[\/\.]/g, '-')}-para-${i}`,
      text,
      xmlPath,
      paragraphIndex: i,
      context: {
        location: actualLocation,
        styleInfo,
      },
      status: 'pending',
    });
  }
}

/**
 * Extracts all text from <w:t> elements within a paragraph
 */
function extractParagraphText(paragraph: Element): string {
  const textElements = paragraph.getElementsByTagNameNS(W_NS, 't');
  let fullText = '';

  for (let i = 0; i < textElements.length; i++) {
    fullText += textElements[i].textContent || '';
  }

  return fullText;
}

/**
 * Extracts style information from a paragraph
 */
function extractStyleInfo(paragraph: Element): string | undefined {
  const pPr = paragraph.getElementsByTagNameNS(W_NS, 'pPr')[0];
  if (!pPr) return undefined;

  const pStyle = pPr.getElementsByTagNameNS(W_NS, 'pStyle')[0];
  if (!pStyle) return undefined;

  return pStyle.getAttribute('w:val') || undefined;
}

/**
 * Calculates document metadata from parsed segments
 */
function calculateMetadata(segments: TextSegment[]): DocumentMetadata {
  const totalParagraphs = segments.length;
  const totalCharacters = segments.reduce((sum, seg) => sum + seg.text.length, 0);

  // Estimate batches based on default config
  const BATCH_SIZE = 20;
  const MAX_CHARS_PER_BATCH = 12000;

  let estimatedBatches = 0;
  let currentBatchChars = 0;
  let currentBatchSegments = 0;

  for (const segment of segments) {
    const segmentChars = segment.text.length;
    const batchFull = currentBatchSegments >= BATCH_SIZE;
    const tooManyChars = currentBatchChars + segmentChars > MAX_CHARS_PER_BATCH && currentBatchSegments > 0;

    if (batchFull || tooManyChars) {
      estimatedBatches++;
      currentBatchChars = 0;
      currentBatchSegments = 0;
    }

    currentBatchChars += segmentChars;
    currentBatchSegments++;
  }

  if (currentBatchSegments > 0) {
    estimatedBatches++;
  }

  return {
    totalParagraphs,
    totalCharacters,
    estimatedBatches,
  };
}

/**
 * Detects legal document sections based on headings and content patterns
 */
function detectLegalSections(segments: TextSegment[]): LegalSection[] {
  const sections: LegalSection[] = [];
  let currentSection: LegalSection | null = null;
  let sectionId = 0;

  // Patterns for detecting section headers
  const headingStyles = ['Heading1', 'Heading2', 'Heading3', 'Title', 'Subtitle'];
  const numberedPattern = /^(\d+\.|\d+\)|\([a-z]\)|\([ivxlcdm]+\)|Article\s+\d+|Section\s+\d+|ARTICLE\s+[IVXLCDM]+)/i;

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    const isHeading = segment.context.styleInfo && headingStyles.some(s =>
      segment.context.styleInfo?.toLowerCase().includes(s.toLowerCase())
    );
    const isNumberedSection = numberedPattern.test(segment.text.trim());
    const isAllCaps = segment.text.trim().length > 3 &&
      segment.text.trim() === segment.text.trim().toUpperCase() &&
      /[A-Z]/.test(segment.text);

    // Detect new section start
    if (isHeading || isNumberedSection || isAllCaps) {
      // Save previous section
      if (currentSection && currentSection.segments.length > 0) {
        currentSection.endIndex = i - 1;
        sections.push(currentSection);
      }

      // Start new section
      const title = segment.text.trim();
      currentSection = {
        id: `section-${sectionId++}`,
        title,
        type: classifyLegalSection(title),
        segments: [segment],
        startIndex: i,
        endIndex: i,
      };
    } else if (currentSection) {
      // Add to current section
      currentSection.segments.push(segment);
    } else {
      // No section yet - create preamble section
      currentSection = {
        id: `section-${sectionId++}`,
        title: 'Preamble',
        type: 'preamble',
        segments: [segment],
        startIndex: i,
        endIndex: i,
      };
    }
  }

  // Don't forget the last section
  if (currentSection && currentSection.segments.length > 0) {
    currentSection.endIndex = segments.length - 1;
    sections.push(currentSection);
  }

  return sections;
}

/**
 * Classifies a section based on its title/heading
 */
function classifyLegalSection(title: string): LegalSectionType {
  const lower = title.toLowerCase();

  // Preamble / Introduction
  if (/preamble|introduction|parties|between|this agreement/i.test(lower)) {
    return 'preamble';
  }
  // Recitals / Whereas
  if (/recital|whereas|background|premise/i.test(lower)) {
    return 'recitals';
  }
  // Definitions
  if (/definition|interpret|meaning|glossary/i.test(lower)) {
    return 'definitions';
  }
  // Subject matter / Scope
  if (/subject|scope|purpose|object|appointment/i.test(lower)) {
    return 'subject_matter';
  }
  // Obligations / Duties
  if (/obligation|duty|duties|responsibilities|covenant|undertaking/i.test(lower)) {
    return 'obligations';
  }
  // Payment
  if (/payment|fee|price|compensation|remuneration|consideration|invoice/i.test(lower)) {
    return 'payment';
  }
  // Term and Termination
  if (/term|duration|termination|expir|cancel|withdrawal/i.test(lower)) {
    return 'term_termination';
  }
  // Confidentiality
  if (/confidential|non-disclosure|nda|secrecy|proprietary/i.test(lower)) {
    return 'confidentiality';
  }
  // Liability / Indemnification
  if (/liabil|indemnif|damages|limitation|exclusion|remedy/i.test(lower)) {
    return 'liability';
  }
  // Warranties
  if (/warrant|represent|guarantee|assurance/i.test(lower)) {
    return 'warranties';
  }
  // Dispute Resolution
  if (/dispute|arbitrat|jurisdiction|governing law|litigation|mediat|applicable law/i.test(lower)) {
    return 'dispute_resolution';
  }
  // General Provisions
  if (/general|miscellaneous|sever|amendment|waiver|entire agreement|notice|force majeure/i.test(lower)) {
    return 'general_provisions';
  }
  // Signatures
  if (/signature|witness|execut|sign|in witness whereof/i.test(lower)) {
    return 'signatures';
  }
  // Schedules / Annexes
  if (/schedule|annex|exhibit|appendix|attachment/i.test(lower)) {
    return 'schedules';
  }

  return 'unknown';
}

/**
 * Replaces text content in a paragraph while preserving XML structure and formatting
 * Preserves subscript, superscript, bold, italic, and other run-level formatting
 */
export function replaceParagraphText(
  paragraph: Element,
  translatedText: string
): void {
  const textElements = paragraph.getElementsByTagNameNS(W_NS, 't');

  if (textElements.length === 0) {
    return;
  }

  // If there's only one text element, simple replacement
  if (textElements.length === 1) {
    textElements[0].textContent = translatedText;
    return;
  }

  // Multiple text elements - preserve run structure and formatting
  // Calculate the proportion of text in each run
  const runs: Array<{ element: Element; originalLength: number; hasFormatting: boolean }> = [];
  let totalOriginalLength = 0;

  for (let i = 0; i < textElements.length; i++) {
    const textEl = textElements[i];
    const run = textEl.parentElement; // <w:r> element
    const originalText = textEl.textContent || '';
    const originalLength = originalText.length;

    // Check if this run has special formatting (rPr element)
    const hasFormatting = run ? run.getElementsByTagNameNS(W_NS, 'rPr').length > 0 : false;

    runs.push({
      element: textEl,
      originalLength,
      hasFormatting
    });

    totalOriginalLength += originalLength;
  }

  // If the original paragraph had no text, just put everything in the first element
  if (totalOriginalLength === 0) {
    textElements[0].textContent = translatedText;
    // Clear other elements
    for (let i = 1; i < textElements.length; i++) {
      textElements[i].textContent = '';
    }
    return;
  }

  // Distribute translated text proportionally across runs
  let remainingText = translatedText;
  let remainingOriginalLength = totalOriginalLength;

  for (let i = 0; i < runs.length; i++) {
    const run = runs[i];
    const isLastRun = i === runs.length - 1;

    if (isLastRun) {
      // Put all remaining text in the last run
      run.element.textContent = remainingText;
    } else {
      // Calculate proportion for this run
      const proportion = run.originalLength / remainingOriginalLength;
      const targetLength = Math.round(remainingText.length * proportion);

      // Find a good break point (prefer spaces)
      let breakPoint = targetLength;
      if (targetLength > 0 && targetLength < remainingText.length) {
        // Look for a space near the target position (within 5 characters)
        const searchStart = Math.max(0, targetLength - 5);
        const searchEnd = Math.min(remainingText.length, targetLength + 5);
        const nearbySpace = remainingText.substring(searchStart, searchEnd).indexOf(' ');

        if (nearbySpace !== -1) {
          breakPoint = searchStart + nearbySpace + 1; // Include the space in this run
        }
      }

      // Assign text to this run
      const textForThisRun = remainingText.substring(0, breakPoint);
      run.element.textContent = textForThisRun;

      // Update remaining text
      remainingText = remainingText.substring(breakPoint);
      remainingOriginalLength -= run.originalLength;
    }
  }
}
