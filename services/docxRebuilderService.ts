import JSZip from "jszip";
import { ParsedDocx } from "../types";
import { replaceParagraphText } from "./docxParserService";

// WordprocessingML namespace
const W_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";

/**
 * Removes soft page breaks (rendering hints) to prevent empty pages when text expands
 */
function cleanupPageBreaks(doc: Document): void {
  // Remove all w:lastRenderedPageBreak elements (soft page breaks)
  // These are just Word's rendering hints and will be recalculated
  const softPageBreaks = doc.getElementsByTagNameNS(W_NS, "lastRenderedPageBreak");
  const breakElements: Element[] = [];

  // Collect elements to remove (can't remove while iterating)
  for (let i = 0; i < softPageBreaks.length; i++) {
    breakElements.push(softPageBreaks[i]);
  }

  // Remove all soft page breaks
  for (const breakEl of breakElements) {
    if (breakEl.parentElement) {
      breakEl.parentElement.removeChild(breakEl);
    }
  }

  // Also remove empty runs that might cause spacing issues
  const runs = doc.getElementsByTagNameNS(W_NS, "r");
  const emptyRuns: Element[] = [];

  for (let i = 0; i < runs.length; i++) {
    const run = runs[i];
    const textElements = run.getElementsByTagNameNS(W_NS, "t");

    // Check if this run has no text content
    let hasText = false;
    for (let j = 0; j < textElements.length; j++) {
      if (textElements[j].textContent && textElements[j].textContent.trim().length > 0) {
        hasText = true;
        break;
      }
    }

    // If run has no text and no other important content (tabs, breaks, etc.), mark for removal
    if (!hasText) {
      const hasTab = run.getElementsByTagNameNS(W_NS, "tab").length > 0;
      const hasBreak = run.getElementsByTagNameNS(W_NS, "br").length > 0;
      const hasDrawing = run.getElementsByTagNameNS(W_NS, "drawing").length > 0;

      if (!hasTab && !hasBreak && !hasDrawing) {
        emptyRuns.push(run);
      }
    }
  }

  // Remove empty runs
  for (const run of emptyRuns) {
    if (run.parentElement) {
      run.parentElement.removeChild(run);
    }
  }
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

      // Replace the text in the paragraph
      replaceParagraphText(paragraph, translation);
    }

    // Clean up soft page breaks and excessive spacing to prevent empty pages
    cleanupPageBreaks(doc);

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
