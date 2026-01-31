import JSZip from "jszip";
import { ParsedDocx } from "../types";
import { replaceParagraphText } from "./docxParserService";

// WordprocessingML namespace
const W_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";

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
