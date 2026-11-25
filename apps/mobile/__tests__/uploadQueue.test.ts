import { describe, it, expect, beforeEach, vi } from 'vitest';
import { uploadQueue, UploadTask } from '../src/lib/uploadQueue';

describe('uploadQueue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('RED: Local write before upload', () => {
    it('writes attachment row locally with local_uri before attempting upload', async () => {
      const attachmentId = 'att-123';
      const taskId = 'task-123';
      const userId = 'user-123';
      const fileBytes = Buffer.from('test-file-content');
      const filename = 'document.pdf';
      const mimeType = 'application/pdf';

      const mockLocalWrite = vi.fn().mockResolvedValue(undefined);
      const mockStorageUpload = vi.fn().mockResolvedValue('storage/path');

      const queue = uploadQueue({
        attachmentWrite: mockLocalWrite,
        storageUpload: mockStorageUpload,
      });

      await queue.enqueue({
        attachmentId,
        taskId,
        userId,
        fileBytes,
        filename,
        mimeType,
        localUri: 'file:///local/path',
      });

      // Should write locally first
      expect(mockLocalWrite).toHaveBeenCalledWith({
        id: attachmentId,
        task_id: taskId,
        user_id: userId,
        filename,
        mime_type: mimeType,
        size_bytes: fileBytes.length,
        local_uri: 'file:///local/path',
        storage_path: null, // Empty until upload succeeds
        type: 'file',
        created_at: expect.any(String),
        updated_at: expect.any(String),
      });
    });
  });

  describe('RED: Upload to storage + update row', () => {
    it('uploads to storage and updates storage_path on success', async () => {
      const attachmentId = 'att-456';
      const userId = 'user-456';
      const fileBytes = Buffer.from('image-data');
      const filename = 'photo.jpg';

      const mockLocalWrite = vi.fn().mockResolvedValue(undefined);
      const mockUpdateStoragePath = vi.fn().mockResolvedValue(undefined);
      const mockStorageUpload = vi.fn().mockResolvedValue('attachments/user-456/att-456/photo.jpg');

      const queue = uploadQueue({
        attachmentWrite: mockLocalWrite,
        attachmentUpdate: mockUpdateStoragePath,
        storageUpload: mockStorageUpload,
      });

      await queue.enqueue({
        attachmentId,
        taskId: 'task-456',
        userId,
        fileBytes,
        filename,
        mimeType: 'image/jpeg',
        localUri: 'file:///local/photo.jpg',
      });

      // Should call storage upload
      expect(mockStorageUpload).toHaveBeenCalledWith({
        bucket: 'attachments',
        path: `${userId}/${attachmentId}/${filename}`,
        fileBytes,
        contentType: 'image/jpeg',
      });

      // Should update storage_path after upload
      expect(mockUpdateStoragePath).toHaveBeenCalledWith(attachmentId, {
        storage_path: 'attachments/user-456/att-456/photo.jpg',
        updated_at: expect.any(String),
      });
    });
  });

  describe('RED: Retry on network reconnect', () => {
    it('retries failed uploads when connectivity is restored', async () => {
      const attachmentId = 'att-retry';
      const fileBytes = Buffer.from('test');

      const mockLocalWrite = vi.fn().mockResolvedValue(undefined);
      const mockUpdateStoragePath = vi.fn().mockResolvedValue(undefined);
      let uploadAttempt = 0;
      const mockStorageUpload = vi.fn().mockImplementation(async () => {
        uploadAttempt++;
        if (uploadAttempt === 1) {
          throw new Error('Network error');
        }
        return 'attachments/user/att-retry/file.txt';
      });

      const queue = uploadQueue({
        attachmentWrite: mockLocalWrite,
        attachmentUpdate: mockUpdateStoragePath,
        storageUpload: mockStorageUpload,
      });

      // First attempt fails
      await expect(
        queue.enqueue({
          attachmentId,
          taskId: 'task',
          userId: 'user',
          fileBytes,
          filename: 'file.txt',
          mimeType: 'text/plain',
          localUri: 'file:///local/file.txt',
        })
      ).rejects.toThrow('Network error');

      // Retry succeeds
      await queue.retry(attachmentId);

      expect(mockStorageUpload).toHaveBeenCalledTimes(2);
      expect(mockUpdateStoragePath).toHaveBeenCalledOnce();
    });
  });

  describe('RED: Idempotent by attachment_id', () => {
    it('does not duplicate uploads for the same attachment_id', async () => {
      const attachmentId = 'att-dedup';
      const fileBytes = Buffer.from('data');

      const mockLocalWrite = vi.fn().mockResolvedValue(undefined);
      const mockUpdateStoragePath = vi.fn().mockResolvedValue(undefined);
      const mockStorageUpload = vi.fn().mockResolvedValue('attachments/user/att-dedup/file.txt');

      const queue = uploadQueue({
        attachmentWrite: mockLocalWrite,
        attachmentUpdate: mockUpdateStoragePath,
        storageUpload: mockStorageUpload,
      });

      const task = {
        attachmentId,
        taskId: 'task',
        userId: 'user',
        fileBytes,
        filename: 'file.txt',
        mimeType: 'text/plain',
        localUri: 'file:///local/file.txt',
      };

      // Enqueue same attachment twice
      await queue.enqueue(task);
      await queue.enqueue(task);

      // Should only upload once
      expect(mockStorageUpload).toHaveBeenCalledTimes(1);
      expect(mockUpdateStoragePath).toHaveBeenCalledOnce();
    });
  });

  describe('RED: Error handling', () => {
    it('surfaces upload failures without failing silently', async () => {
      const attachmentId = 'att-error';
      const fileBytes = Buffer.from('data');

      const mockLocalWrite = vi.fn().mockResolvedValue(undefined);
      const mockStorageUpload = vi.fn().mockRejectedValue(new Error('Upload failed'));

      const queue = uploadQueue({
        attachmentWrite: mockLocalWrite,
        storageUpload: mockStorageUpload,
      });

      const errorHandler = vi.fn();

      await expect(
        queue.enqueue({
          attachmentId,
          taskId: 'task',
          userId: 'user',
          fileBytes,
          filename: 'file.txt',
          mimeType: 'text/plain',
          localUri: 'file:///local/file.txt',
          onError: errorHandler,
        })
      ).rejects.toThrow('Upload failed');

      expect(errorHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Upload failed'),
        })
      );
    });
  });
});
