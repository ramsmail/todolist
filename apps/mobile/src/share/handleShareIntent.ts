import type { ShareIntent } from 'expo-share-intent';

/**
 * A shared file with its bytes already read into memory. We read bytes eagerly
 * (see handleShareIntent) because the OS grant on a shared content:// URI — and
 * the cache copy expo-share-intent makes from it — is short-lived; the file can
 * vanish once the app is backgrounded.
 */
export interface SharedFile {
  fileBytes: Uint8Array;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  localUri: string;
}

/** Normalized result the capture screen turns into a task (+ attachments). */
export interface NormalizedShare {
  /** Editable, pre-seeded task title. */
  title: string;
  /** Original URL if one was shared, else null. Kept on the task for enrichment. */
  sourceUrl: string | null;
  /** Empty for a plain text/URL share. */
  files: SharedFile[];
}

/**
 * Reads a local file's bytes. Injected so the mapping logic stays unit-testable;
 * the native caller passes an expo-file-system-backed reader.
 */
export type FileByteReader = (path: string) => Promise<Uint8Array>;

const MAX_TITLE_LENGTH = 200;

function isUrl(value: string): boolean {
  return /^https?:\/\/\S+$/i.test(value);
}

function deriveTitle(raw: string): string {
  const firstLine = raw.split('\n')[0]?.trim() ?? '';
  if (firstLine.length <= MAX_TITLE_LENGTH) return firstLine;
  return firstLine.slice(0, MAX_TITLE_LENGTH) + '…';
}

/**
 * Normalize an incoming share into a task-ready shape. Reads any shared files'
 * bytes immediately via the injected reader (the share URI grant is temporary).
 * Throws if the intent carries nothing usable.
 */
export async function handleShareIntent(
  intent: ShareIntent,
  readBytes: FileByteReader
): Promise<NormalizedShare> {
  const text = intent.text?.trim() ?? '';
  const webUrl = intent.webUrl?.trim() || null;
  const sourceUrl = webUrl ?? (text && isUrl(text) ? text : null);

  const files: SharedFile[] = [];
  for (const file of intent.files ?? []) {
    const fileBytes = await readBytes(file.path);
    files.push({
      fileBytes,
      filename: file.fileName,
      mimeType: file.mimeType,
      sizeBytes: file.size ?? fileBytes.length,
      localUri: file.path,
    });
  }

  // A caption is free-text that isn't itself the shared URL.
  const caption = text && text !== webUrl && !isUrl(text) ? text : '';

  let title = '';
  if (caption) title = deriveTitle(caption);
  else if (sourceUrl) title = deriveTitle(sourceUrl);
  else if (files.length) title = files[0].filename;

  if (!title && !sourceUrl && files.length === 0) {
    throw new Error('Share intent contained no usable content');
  }

  return { title, sourceUrl, files };
}
