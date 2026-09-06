/**
 * Centralized Attachment Configuration & Limits
 * 
 * Strict single source of truth for file uploads across client and server.
 */

export const ATTACHMENT_CONFIG = {
  // Maximum file size in bytes: 5 MB
  MAX_FILE_SIZE_BYTES: 5 * 1024 * 1024,
  MAX_FILE_SIZE_MB: 5,

  // Maximum number of attachments per journal entry
  MAX_ATTACHMENTS_PER_ENTRY: 5,

  // Maximum characters of extracted readable text passed to context / Gemini
  MAX_EXTRACTED_TEXT_LENGTH: 15000,

  // Maximum preview image dimension (width/height)
  MAX_IMAGE_DIMENSION: 2048,

  // Supported MIME types
  ALLOWED_MIME_TYPES: [
    'text/plain',
    'text/markdown',
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/png',
    'image/jpeg',
    'image/webp',
  ],

  // Supported file extensions
  ALLOWED_EXTENSIONS: ['.txt', '.md', '.markdown', '.pdf', '.docx', '.png', '.jpg', '.jpeg', '.webp'],
} as const;

export const MAX_FILE_SIZE_BYTES = ATTACHMENT_CONFIG.MAX_FILE_SIZE_BYTES;
export const MAX_ATTACHMENTS_PER_ENTRY = ATTACHMENT_CONFIG.MAX_ATTACHMENTS_PER_ENTRY;

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validates a file against allowed extensions, MIME types, and size constraints.
 */
export function validateAttachmentFile(
  fileName: string,
  fileSize: number,
  mimeType: string,
  existingAttachmentsCount = 0,
  existingFileNames: string[] = []
): ValidationResult {
  // 1. Entry limit check
  if (existingAttachmentsCount >= ATTACHMENT_CONFIG.MAX_ATTACHMENTS_PER_ENTRY) {
    return {
      valid: false,
      error: `Maximum ${ATTACHMENT_CONFIG.MAX_ATTACHMENTS_PER_ENTRY} attachments allowed per entry.`,
    };
  }

  // 2. Duplicate file name check
  if (existingFileNames.some((name) => name.toLowerCase() === fileName.toLowerCase())) {
    return {
      valid: false,
      error: `An attachment named "${fileName}" is already attached to this entry.`,
    };
  }

  // 3. File size check
  if (fileSize > ATTACHMENT_CONFIG.MAX_FILE_SIZE_BYTES) {
    const sizeMb = (fileSize / (1024 * 1024)).toFixed(1);
    return {
      valid: false,
      error: `File is too large (${sizeMb} MB). Maximum allowed size is ${ATTACHMENT_CONFIG.MAX_FILE_SIZE_MB} MB.`,
    };
  }

  // 4. Extension check
  const extMatch = fileName.match(/\.([a-zA-Z0-9]+)$/);
  const ext = extMatch ? `.${extMatch[1].toLowerCase()}` : '';

  const isAllowedExt = (ATTACHMENT_CONFIG.ALLOWED_EXTENSIONS as readonly string[]).includes(ext);
  const isAllowedMime = (ATTACHMENT_CONFIG.ALLOWED_MIME_TYPES as readonly string[]).includes(mimeType) ||
    (mimeType === 'text/plain' && (ext === '.txt' || ext === '.md' || ext === '.markdown')) ||
    (mimeType === 'application/octet-stream' && isAllowedExt);

  if (!isAllowedExt && !isAllowedMime) {
    return {
      valid: false,
      error: `Unsupported file type "${ext || mimeType}". Supported formats: PDF, DOCX, TXT, Markdown, PNG, JPG, WEBP.`,
    };
  }

  return { valid: true };
}

/**
 * Formats byte size into human readable string (e.g., 450 KB, 2.1 MB).
 */
export function formatAttachmentSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(0)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(1)} MB`;
}
