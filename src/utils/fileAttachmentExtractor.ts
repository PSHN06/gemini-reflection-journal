import { ATTACHMENT_CONFIG } from './attachmentLimits';
import { JournalAttachment } from '../types';

/**
 * Strips XML and HTML tags, decoding common entities
 */
function cleanXmlText(xmlStr: string): string {
  return xmlStr
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Basic safe textual scanner for PDF files without external binary dependencies.
 * Decodes plain text blocks, stream content, and parenthesized text segments.
 */
function extractTextFromPdfBuffer(buffer: ArrayBuffer): { text: string; success: boolean } {
  try {
    const uint8 = new Uint8Array(buffer);
    const decoder = new TextDecoder('latin1');
    const rawString = decoder.decode(uint8);

    // Look for text within parentheses (standard PDF text strings: (text) Tj or [(text)] TJ)
    const textMatches: string[] = [];
    const streamRegex = /\(([^)]+)\)\s*(?:Tj|'|")/g;
    let match: RegExpExecArray | null;

    while ((match = streamRegex.exec(rawString)) !== null) {
      const decoded = match[1]
        .replace(/\\([()\\])/g, '$1')
        .replace(/\\n/g, '\n')
        .replace(/\\r/g, '')
        .replace(/\\t/g, '\t');
      if (decoded.trim().length > 1 && /[a-zA-Z0-9]/.test(decoded)) {
        textMatches.push(decoded.trim());
      }
      if (textMatches.length > 500) break;
    }

    // Fallback: look for text array chunks [(...) (...)] TJ
    if (textMatches.length < 5) {
      const arrayRegex = /\[([^\]]+)\]\s*TJ/g;
      while ((match = arrayRegex.exec(rawString)) !== null) {
        const inner = match[1];
        const subRegex = /\(([^)]+)\)/g;
        let subMatch: RegExpExecArray | null;
        while ((subMatch = subRegex.exec(inner)) !== null) {
          if (subMatch[1].trim()) textMatches.push(subMatch[1].trim());
        }
        if (textMatches.length > 500) break;
      }
    }

    const combined = textMatches.join(' ').replace(/\s+/g, ' ').trim();
    if (combined.length >= 10) {
      return {
        text: combined.slice(0, ATTACHMENT_CONFIG.MAX_EXTRACTED_TEXT_LENGTH),
        success: true,
      };
    }

    return { text: '', success: false };
  } catch (err) {
    return { text: '', success: false };
  }
}

/**
 * Basic safe textual scanner for DOCX files by scanning for word document XML text nodes.
 */
function extractTextFromDocxBuffer(buffer: ArrayBuffer): { text: string; success: boolean } {
  try {
    const uint8 = new Uint8Array(buffer);
    const decoder = new TextDecoder('utf-8');
    const rawString = decoder.decode(uint8);

    // Look for <w:t>...</w:t> tags
    const wtRegex = /<w:t(?:\s+[^>]*)?>([^<]*)<\/w:t>/g;
    const pieces: string[] = [];
    let match: RegExpExecArray | null;

    while ((match = wtRegex.exec(rawString)) !== null) {
      if (match[1]) {
        pieces.push(match[1]);
      }
      if (pieces.length > 2000) break;
    }

    if (pieces.length > 0) {
      const combined = cleanXmlText(pieces.join(' '));
      if (combined.length >= 5) {
        return {
          text: combined.slice(0, ATTACHMENT_CONFIG.MAX_EXTRACTED_TEXT_LENGTH),
          success: true,
        };
      }
    }

    return { text: '', success: false };
  } catch {
    return { text: '', success: false };
  }
}

/**
 * Processes a client-side File object and returns a formatted JournalAttachment.
 */
export async function processClientFileAttachment(
  file: File,
  entryId: string,
  userId: string
): Promise<JournalAttachment> {
  const attachmentId = 'att-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7);
  const isImage = file.type.startsWith('image/');
  const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
  const isDocx = file.name.toLowerCase().endsWith('.docx');
  const isPlainText = file.type.startsWith('text/') ||
    file.name.toLowerCase().endsWith('.txt') ||
    file.name.toLowerCase().endsWith('.md') ||
    file.name.toLowerCase().endsWith('.markdown');

  const baseAttachment: JournalAttachment = {
    id: attachmentId,
    entryId,
    userId,
    fileName: file.name,
    fileType: file.type || (isDocx ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' : 'text/plain'),
    fileSize: file.size,
    uploadedAt: Date.now(),
    status: 'processing',
  };

  // Process Images
  if (isImage) {
    try {
      const previewUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      return {
        ...baseAttachment,
        status: 'image',
        previewUrl,
      };
    } catch {
      return {
        ...baseAttachment,
        status: 'failed',
        error: 'Failed to generate image preview.',
      };
    }
  }

  // Process Plain Text / Markdown
  if (isPlainText) {
    try {
      const text = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsText(file);
      });

      const extracted = text.trim().slice(0, ATTACHMENT_CONFIG.MAX_EXTRACTED_TEXT_LENGTH);
      return {
        ...baseAttachment,
        status: 'extracted',
        extractedText: extracted,
      };
    } catch {
      return {
        ...baseAttachment,
        status: 'failed',
        error: 'Failed to read text file contents.',
      };
    }
  }

  // Process PDF
  if (isPdf) {
    try {
      const buffer = await file.arrayBuffer();
      const result = extractTextFromPdfBuffer(buffer);
      if (result.success && result.text) {
        return {
          ...baseAttachment,
          status: 'extracted',
          extractedText: result.text,
        };
      } else {
        return {
          ...baseAttachment,
          status: 'failed',
          error: 'PDF contains non-extractable text or scanned imagery.',
        };
      }
    } catch {
      return {
        ...baseAttachment,
        status: 'failed',
        error: 'Error parsing PDF stream.',
      };
    }
  }

  // Process DOCX
  if (isDocx) {
    try {
      const buffer = await file.arrayBuffer();
      const result = extractTextFromDocxBuffer(buffer);
      if (result.success && result.text) {
        return {
          ...baseAttachment,
          status: 'extracted',
          extractedText: result.text,
        };
      } else {
        return {
          ...baseAttachment,
          status: 'failed',
          error: 'Could not extract readable text from document format.',
        };
      }
    } catch {
      return {
        ...baseAttachment,
        status: 'failed',
        error: 'Error parsing document structure.',
      };
    }
  }

  return {
    ...baseAttachment,
    status: 'failed',
    error: 'Unsupported file format.',
  };
}
