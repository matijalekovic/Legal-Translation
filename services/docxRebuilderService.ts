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
  let removedFrameBreaks = 0;
  let modifiedWidowControl = 0;

  // Helper to collect elements into array (since HTMLCollection is live)
  const toArray = (collection: HTMLCollectionOf<Element>): Element[] => {
    const arr: Element[] = [];
    for (let i = 0; i < collection.length; i++) {
      arr.push(collection[i]);
    }
    return arr;
  };

  // 1. Remove all w:pageBreakBefore elements from paragraph properties
  // This is the most common cause of blank pages in legal documents - it forces
  // each section/article to start on a new page, which creates blanks when text expands
  const pageBreakBeforeElements = toArray(doc.getElementsByTagNameNS(W_NS, "pageBreakBefore"));
  for (const breakEl of pageBreakBeforeElements) {
    if (breakEl.parentElement) {
      breakEl.parentElement.removeChild(breakEl);
      removedPageBreakBefore++;
    }
  }

  // 2. Remove all w:lastRenderedPageBreak elements (soft page breaks)
  // These are just Word's rendering hints and will be recalculated when opened
  const softPageBreaks = toArray(doc.getElementsByTagNameNS(W_NS, "lastRenderedPageBreak"));
  for (const breakEl of softPageBreaks) {
    if (breakEl.parentElement) {
      breakEl.parentElement.removeChild(breakEl);
      removedSoftBreaks++;
    }
  }

  // 3. Remove ALL hard page breaks (w:br with w:type="page")
  // These create explicit page breaks that cause empty pages when text expands
  const allBreaks = toArray(doc.getElementsByTagNameNS(W_NS, "br"));
  for (const br of allBreaks) {
    const breakType = br.getAttribute("w:type");
    // Remove all page breaks (not line breaks or column breaks)
    if (breakType === "page") {
      if (br.parentElement) {
        br.parentElement.removeChild(br);
        removedHardBreaks++;
      }
    }
  }

  // 4. Handle section breaks that force new pages
  // Change "nextPage" and "oddPage"/"evenPage" section breaks to "continuous"
  const sectPrs = toArray(doc.getElementsByTagNameNS(W_NS, "sectPr"));
  for (const sectPr of sectPrs) {
    const typeElements = sectPr.getElementsByTagNameNS(W_NS, "type");
    for (let j = 0; j < typeElements.length; j++) {
      const typeEl = typeElements[j];
      const typeVal = typeEl.getAttribute("w:val");
      // Change any page-forcing breaks to continuous
      if (typeVal === "nextPage" || typeVal === "oddPage" || typeVal === "evenPage") {
        typeEl.setAttribute("w:val", "continuous");
        removedSectionBreaks++;
      }
    }
  }

  // 5. Remove frame properties that force page breaks (w:framePr with w:dropCap or anchoring)
  // Frames can have their own page break behavior
  const framePrs = toArray(doc.getElementsByTagNameNS(W_NS, "framePr"));
  for (const framePr of framePrs) {
    // Check for anchor attributes that might cause page positioning issues
    const vAnchor = framePr.getAttribute("w:vAnchor");
    const hAnchor = framePr.getAttribute("w:hAnchor");
    // If frame is anchored to page (not text/margin), it can cause layout issues
    if (vAnchor === "page" || hAnchor === "page") {
      // Change page anchoring to margin/text to allow flow
      if (vAnchor === "page") {
        framePr.setAttribute("w:vAnchor", "text");
        removedFrameBreaks++;
      }
      if (hAnchor === "page") {
        framePr.setAttribute("w:hAnchor", "margin");
        removedFrameBreaks++;
      }
    }
  }

  // 6. Disable aggressive widow/orphan control that can push content to new pages
  // widowControl forces at least 2 lines at top/bottom of page, which can create gaps
  const widowControls = toArray(doc.getElementsByTagNameNS(W_NS, "widowControl"));
  for (const widowCtrl of widowControls) {
    const val = widowCtrl.getAttribute("w:val");
    // If widow control is enabled (val is missing or "1" or "true")
    if (val !== "0" && val !== "false") {
      widowCtrl.setAttribute("w:val", "0");
      modifiedWidowControl++;
    }
  }

  // 7. Remove keepNext and keepLines that can cause cascading page breaks
  // These force paragraphs to stay together, which can push large blocks to new pages
  const keepNextElements = toArray(doc.getElementsByTagNameNS(W_NS, "keepNext"));
  let removedKeepNext = 0;
  for (const keepNext of keepNextElements) {
    if (keepNext.parentElement) {
      keepNext.parentElement.removeChild(keepNext);
      removedKeepNext++;
    }
  }

  const keepLinesElements = toArray(doc.getElementsByTagNameNS(W_NS, "keepLines"));
  let removedKeepLines = 0;
  for (const keepLines of keepLinesElements) {
    if (keepLines.parentElement) {
      keepLines.parentElement.removeChild(keepLines);
      removedKeepLines++;
    }
  }

  // 8. Remove excessive consecutive empty paragraphs AND paragraphs with only breaks
  const paragraphs = toArray(doc.getElementsByTagNameNS(W_NS, "p"));
  const emptyParasToRemove: Element[] = [];
  let consecutiveEmptyCount = 0;

  for (let i = 0; i < paragraphs.length; i++) {
    const para = paragraphs[i];
    const textElements = para.getElementsByTagNameNS(W_NS, "t");

    // Check if paragraph has meaningful text content
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

  console.log(`Page break cleanup: ${removedPageBreakBefore} pageBreakBefore, ${removedSoftBreaks} soft, ${removedHardBreaks} hard, ${removedSectionBreaks} section, ${removedEmptyParas} empty paras, ${removedFrameBreaks} frame anchors, ${modifiedWidowControl} widowControl, ${removedKeepNext} keepNext, ${removedKeepLines} keepLines removed`);
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

  // Process each XML file that has segments
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

    // Serialize XML back to string
    const serializer = new XMLSerializer();
    const newXmlString = serializer.serializeToString(doc);

    // Update ZIP file
    zip.file(xmlPath, newXmlString);
  }

  // ALWAYS clean up page breaks in the main document, even if it wasn't in segmentsByPath
  // This handles cases where all content might be in tables/frames
  const mainDoc = xmlDocuments.get('word/document.xml');
  if (mainDoc) {
    cleanupPageBreaks(mainDoc);
    // Re-serialize after cleanup
    const serializer = new XMLSerializer();
    const cleanedXmlString = serializer.serializeToString(mainDoc);
    zip.file('word/document.xml', cleanedXmlString);
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
