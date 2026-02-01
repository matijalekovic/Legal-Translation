import JSZip from "jszip";
import { ParsedDocx } from "../types";
import { replaceParagraphText } from "./docxParserService";

// WordprocessingML namespace
const W_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";

/**
 * Removes page breaks and cleans up empty content to prevent blank pages
 * when translated text is longer than the original
 */
function cleanupPageBreaks(doc: Document): void {
  let removedSoftBreaks = 0;
  let removedHardBreaks = 0;
  let removedEmptyParas = 0;
  let removedSectionBreaks = 0;
  let removedPageBreakBefore = 0;

  // 1. Remove all w:pageBreakBefore elements from paragraph properties
  // This is the most common cause of blank pages in legal documents - it forces
  // each section/article to start on a new page, which creates blanks when text expands
  const pageBreakBeforeElements = doc.getElementsByTagNameNS(W_NS, "pageBreakBefore");
  const pageBreakBeforeList: Element[] = [];
  for (let i = 0; i < pageBreakBeforeElements.length; i++) {
    pageBreakBeforeList.push(pageBreakBeforeElements[i]);
  }
  for (const breakEl of pageBreakBeforeList) {
    if (breakEl.parentElement) {
      breakEl.parentElement.removeChild(breakEl);
      removedPageBreakBefore++;
    }
  }

  // 2. Remove all w:lastRenderedPageBreak elements (soft page breaks)
  // These are just Word's rendering hints and will be recalculated when opened
  const softPageBreaks = doc.getElementsByTagNameNS(W_NS, "lastRenderedPageBreak");
  const softBreakElements: Element[] = [];
  for (let i = 0; i < softPageBreaks.length; i++) {
    softBreakElements.push(softPageBreaks[i]);
  }
  for (const breakEl of softBreakElements) {
    if (breakEl.parentElement) {
      breakEl.parentElement.removeChild(breakEl);
      removedSoftBreaks++;
    }
  }

  // 3. Remove ALL hard page breaks (w:br with w:type="page")
  // These create explicit page breaks that cause empty pages when text expands
  const allBreaks = doc.getElementsByTagNameNS(W_NS, "br");
  const hardBreaksToRemove: Element[] = [];

  for (let i = 0; i < allBreaks.length; i++) {
    const br = allBreaks[i];
    const breakType = br.getAttribute("w:type");

    // Remove all page breaks (not line breaks or column breaks)
    if (breakType === "page") {
      hardBreaksToRemove.push(br);
    }
  }

  for (const br of hardBreaksToRemove) {
    if (br.parentElement) {
      br.parentElement.removeChild(br);
      removedHardBreaks++;
    }
  }

  // 4. Handle section breaks that force new pages
  // Change "nextPage" section breaks to "continuous" so they don't create blank pages
  const sectPrs = doc.getElementsByTagNameNS(W_NS, "sectPr");
  for (let i = 0; i < sectPrs.length; i++) {
    const sectPr = sectPrs[i];
    const typeElements = sectPr.getElementsByTagNameNS(W_NS, "type");

    for (let j = 0; j < typeElements.length; j++) {
      const typeEl = typeElements[j];
      const typeVal = typeEl.getAttribute("w:val");

      // Change nextPage to continuous to prevent forced page breaks
      if (typeVal === "nextPage") {
        typeEl.setAttribute("w:val", "continuous");
        removedSectionBreaks++;
      }
    }
  }

  // 5. Remove excessive consecutive empty paragraphs
  // Keep maximum 1 empty paragraph between content for spacing
  const paragraphs = doc.getElementsByTagNameNS(W_NS, "p");
  const emptyParasToRemove: Element[] = [];
  let consecutiveEmptyCount = 0;

  for (let i = 0; i < paragraphs.length; i++) {
    const para = paragraphs[i];
    const textElements = para.getElementsByTagNameNS(W_NS, "t");

    // Check if paragraph is empty (no text)
    let hasContent = false;
    for (let j = 0; j < textElements.length; j++) {
      if (textElements[j].textContent && textElements[j].textContent.trim().length > 0) {
        hasContent = true;
        break;
      }
    }

    if (!hasContent) {
      consecutiveEmptyCount++;
      // Keep first empty paragraph for spacing, remove subsequent ones
      if (consecutiveEmptyCount > 1) {
        emptyParasToRemove.push(para);
      }
    } else {
      consecutiveEmptyCount = 0;
    }
  }

  // Remove excessive empty paragraphs
  for (const para of emptyParasToRemove) {
    if (para.parentElement) {
      para.parentElement.removeChild(para);
      removedEmptyParas++;
    }
  }

  console.log(`Page break cleanup: ${removedPageBreakBefore} pageBreakBefore, ${removedSoftBreaks} soft, ${removedHardBreaks} hard, ${removedSectionBreaks} section breaks, ${removedEmptyParas} empty paragraphs removed`);
}

/**
 * Rebuilds a DOCX file with translated content
 */
export async function rebuildDocx(
  parsedDocx: ParsedDocx,
  translations: Map<string, string>
): Promise<string> {
  const zip = parsedDocx.zipInstance as JSZip;
  const xmlDocuments = parsedDocx.xmlDocuments;
  const segments = parsedDocx.segments;

  // Group segments by XML path
  const segmentsByPath = new Map<string, typeof segments>();
  for (const segment of segments) {
    const existing = segmentsByPath.get(segment.xmlPath) || [];
    existing.push(segment);
    segmentsByPath.set(segment.xmlPath, existing);
  }

  // Process each XML file
  for (const [xmlPath, pathSegments] of segmentsByPath.entries()) {
    const doc = xmlDocuments.get(xmlPath);
    if (!doc) continue;

    // Get all paragraphs in this document
    const paragraphs = doc.getElementsByTagNameNS(W_NS, "p");

    // Apply translations to each segment
    for (const segment of pathSegments) {
      const translation = translations.get(segment.id);
      if (translation === undefined) continue;

      // Find the paragraph by index
      const paragraph = paragraphs[segment.paragraphIndex];
      if (!paragraph) {
        console.warn(`Paragraph not found at index ${segment.paragraphIndex} in ${xmlPath}`);
        continue;
      }

      // Use simple replacement for headers, footers, footnotes, and table cells
      // These have complex layouts where proportional distribution causes issues
      const location = segment.context?.location;
      const useSimpleReplacement = location === 'header' ||
        location === 'footer' ||
        location === 'footnote' ||
        location === 'table-cell';

      // Replace the text in the paragraph
      replaceParagraphText(paragraph, translation, useSimpleReplacement);
    }

    // Only clean up page breaks in the main document body, not headers/footers
    if (xmlPath === 'word/document.xml') {
      cleanupPageBreaks(doc);
    }

    // Serialize XML back to string
    const serializer = new XMLSerializer();
    const newXmlString = serializer.serializeToString(doc);

    // Update ZIP file
    zip.file(xmlPath, newXmlString);
  }

  // Generate DOCX blob
  const blob = await zip.generateAsync({
    type: "blob",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });

  // Convert to data URL
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Failed to convert blob to data URL"));
    reader.readAsDataURL(blob);
  });
}

/**
 * Converts a data URL to a Blob for download
 */
export function dataUrlToBlob(dataUrl: string): Blob {
  const [header, base64] = dataUrl.split(",");
  const mimeMatch = header.match(/data:([^;]+)/);
  const mimeType = mimeMatch ? mimeMatch[1] : "application/octet-stream";

  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  return new Blob([bytes], { type: mimeType });
}
