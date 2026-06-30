import { PowerSyncDatabase } from '@powersync/react-native';

export interface UploadTaskInput {
  attachmentId: string;
  taskId: string;
  userId: string;
  fileBytes: Uint8Array;
  filename: string;
  mimeType: string;
  localUri: string;
  onError?: (error: Error) => void;
}

export interface UploadTask {
  attachmentId: string;
  taskId: string;
  userId: string;
  fileBytes: Uint8Array;
  filename: string;
  mimeType: string;
  localUri: string;
  status: 'pending' | 'uploading' | 'completed' | 'failed';
  error?: Error;
  onError?: (error: Error) => void;
}

interface UploadQueueDeps {
  attachmentWrite: (data: any) => Promise<void>;
  attachmentUpdate?: (id: string, data: any) => Promise<void>;
  storageUpload: (data: any) => Promise<string>;
}

class UploadQueueImpl {
  private queue: Map<string, UploadTask> = new Map();
  private processing: Set<string> = new Set();
  private deps: UploadQueueDeps;
  private uploadPromises: Map<string, Promise<void>> = new Map();

  constructor(deps: UploadQueueDeps) {
    this.deps = deps;
  }

  async enqueue(task: UploadTaskInput): Promise<void> {
    const attachmentId = task.attachmentId;

    // If already queued, return existing promise
    if (this.queue.has(attachmentId)) {
      const existingPromise = this.uploadPromises.get(attachmentId);
      if (existingPromise) {
        return existingPromise;
      }
    }

    const now = new Date().toISOString();

    // Write attachment row locally first (offline-safe)
    await this.deps.attachmentWrite({
      id: attachmentId,
      task_id: task.taskId,
      user_id: task.userId,
      filename: task.filename,
      mime_type: task.mimeType,
      size_bytes: task.fileBytes.length,
      local_uri: task.localUri,
      storage_path: null,
      type: 'file',
      created_at: now,
      updated_at: now,
    });

    // Add to queue
    const queuedTask: UploadTask = {
      ...task,
      status: 'pending',
      onError: task.onError,
    };
    this.queue.set(attachmentId, queuedTask);

    // Start upload and track the promise for idempotency
    const uploadPromise = this.processUpload(attachmentId).catch((error) => {
      if (task.onError) {
        task.onError(error instanceof Error ? error : new Error(String(error)));
      }
      throw error;
    });

    this.uploadPromises.set(attachmentId, uploadPromise);
    return uploadPromise;
  }

  async retry(attachmentId: string): Promise<void> {
    const task = this.queue.get(attachmentId);
    if (!task) {
      throw new Error(`Task ${attachmentId} not found`);
    }
    await this.processUpload(attachmentId);
  }

  private async processUpload(attachmentId: string): Promise<void> {
    // Prevent duplicate processing
    if (this.processing.has(attachmentId)) {
      return;
    }

    const task = this.queue.get(attachmentId);
    if (!task) {
      return;
    }

    this.processing.add(attachmentId);

    try {
      task.status = 'uploading';

      // Upload to Storage
      const storagePath = await this.deps.storageUpload({
        bucket: 'attachments',
        path: `${task.userId}/${attachmentId}/${task.filename}`,
        fileBytes: task.fileBytes,
        contentType: task.mimeType,
      });

      // Update storage_path in database
      const now = new Date().toISOString();
      if (this.deps.attachmentUpdate) {
        await this.deps.attachmentUpdate(attachmentId, {
          storage_path: storagePath,
          updated_at: now,
        });
      }

      task.status = 'completed';
    } catch (error) {
      task.status = 'failed';
      task.error = error instanceof Error ? error : new Error(String(error));
      this.processing.delete(attachmentId);
      throw error;
    }

    this.processing.delete(attachmentId);
  }
}

export function uploadQueue(deps: UploadQueueDeps): {
  enqueue: (task: UploadTaskInput) => Promise<void>;
  retry: (attachmentId: string) => Promise<void>;
} {
  const impl = new UploadQueueImpl(deps);
  return {
    enqueue: impl.enqueue.bind(impl),
    retry: impl.retry.bind(impl),
  };
}
