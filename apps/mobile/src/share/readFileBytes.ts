import { File } from 'expo-file-system';
import type { FileByteReader } from './handleShareIntent';

/**
 * Native byte reader backed by expo-file-system's File API. Passed into
 * handleShareIntent so the mapping logic itself stays free of native imports
 * (and unit-testable). Uses arrayBuffer() — the concrete method on File — rather
 * than the Blob-inherited bytes(), then wraps it as a Uint8Array for uploadQueue.
 */
export const readFileBytes: FileByteReader = async (path) => {
  const buffer = await new File(path).arrayBuffer();
  return new Uint8Array(buffer);
};
