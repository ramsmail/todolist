import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, TextInput, Pressable, Image, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useShareIntentContext } from 'expo-share-intent';
import { usePowerSync } from '@powersync/react';
import { createTask } from '@todolist/db';
import { colors, typography } from '@todolist/ui';
import { useAuth } from '../auth/AuthContext';
import { supabase } from '../supabase/client';
import { uploadQueue } from '../lib/uploadQueue';
import { handleShareIntent, type NormalizedShare } from '../share/handleShareIntent';
import { readFileBytes } from '../share/readFileBytes';

type Phase = 'loading' | 'ready' | 'saving' | 'saved' | 'error';

export default function ShareScreen() {
  const db = usePowerSync();
  const router = useRouter();
  const { session } = useAuth();
  const { shareIntent, hasShareIntent, resetShareIntent } = useShareIntentContext();

  const [payload, setPayload] = useState<NormalizedShare | null>(null);
  const [title, setTitle] = useState('');
  const [phase, setPhase] = useState<Phase>('loading');
  const [error, setError] = useState<string | null>(null);

  // Upload queue bound to this device: local-first attachment row via PowerSync,
  // binary upload to Supabase Storage. enqueue() writes the local row first so
  // the attachment is offline-safe, then uploads in the background.
  const queue = useMemo(
    () =>
      uploadQueue({
        attachmentWrite: async (data) => {
          await db.execute(
            `INSERT INTO attachments
               (id, task_id, user_id, type, filename, mime_type, size_bytes,
                storage_path, local_uri, created_at, updated_at)
             VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
            [
              data.id, data.task_id, data.user_id, data.type, data.filename,
              data.mime_type, data.size_bytes, data.storage_path, data.local_uri,
              data.created_at, data.updated_at,
            ]
          );
        },
        attachmentUpdate: async (id, data) => {
          await db.execute(
            `UPDATE attachments SET storage_path = ?, updated_at = ? WHERE id = ?`,
            [data.storage_path, data.updated_at, id]
          );
        },
        storageUpload: async ({ bucket, path, fileBytes, contentType }) => {
          const { data, error: upErr } = await supabase.storage
            .from(bucket)
            .upload(path, fileBytes, { contentType, upsert: true });
          if (upErr) throw upErr;
          return data.path;
        },
      }),
    [db]
  );

  // Normalize the incoming share once (reads file bytes eagerly).
  useEffect(() => {
    let cancelled = false;
    if (!hasShareIntent) return;
    (async () => {
      try {
        const normalized = await handleShareIntent(shareIntent as never, readFileBytes);
        if (cancelled) return;
        setPayload(normalized);
        setTitle(normalized.title);
        setPhase('ready');
      } catch {
        if (cancelled) return;
        setError('Could not read the shared content.');
        setPhase('error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hasShareIntent, shareIntent]);

  const close = useCallback(() => {
    resetShareIntent();
    router.replace('/(tabs)');
  }, [resetShareIntent, router]);

  const onSave = useCallback(async () => {
    if (!payload || !session) return;
    const trimmed = title.trim();
    if (!trimmed) return;

    setPhase('saving');
    try {
      const taskId = await createTask(db as never, {
        userId: session.user.id,
        title: trimmed,
        status: 'inbox',
        sourceUrl: payload.sourceUrl,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });

      // Fire-and-forget per file: enqueue writes the local attachment row, then
      // uploads in the background. We don't await the upload so a slow/offline
      // network doesn't block the capture. Failures surface via onError.
      for (const file of payload.files) {
        queue
          .enqueue({
            attachmentId: crypto.randomUUID(),
            taskId,
            userId: session.user.id,
            fileBytes: file.fileBytes,
            filename: file.filename,
            mimeType: file.mimeType,
            localUri: file.localUri,
            onError: (err) => console.error('attachment upload failed:', err),
          })
          .catch(() => {
            /* already surfaced via onError; offline rows keep storage_path null */
          });
      }

      // Best-effort server-side title enrichment for links. Only when the user
      // kept the raw URL as the title (didn't type their own); the Edge Function
      // updates the title in Postgres and it syncs back via PowerSync.
      if (payload.sourceUrl && trimmed === payload.sourceUrl) {
        supabase.functions
          .invoke('enrich-url', { body: { taskId, url: payload.sourceUrl } })
          .catch((err) => console.error('enrich-url failed:', err));
      }

      resetShareIntent();
      setPhase('saved');
      setTimeout(close, 900);
    } catch (e) {
      console.error('share save failed:', e);
      setError('Could not save. Please try again.');
      setPhase('error');
    }
  }, [payload, session, title, db, queue, resetShareIntent, close]);

  // Direct navigation to /share with nothing shared — bail back to the app.
  if (!hasShareIntent && phase !== 'saved') {
    return (
      <View style={styles.centered}>
        <Text style={styles.hint}>Nothing to capture.</Text>
        <Pressable style={styles.cancelBtn} onPress={close}>
          <Text style={styles.cancelText}>Back to Inbox</Text>
        </Pressable>
      </View>
    );
  }

  if (phase === 'loading') {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.accent} />
        <Text style={styles.hint}>Reading shared content…</Text>
      </View>
    );
  }

  if (phase === 'saved') {
    return (
      <View style={styles.centered}>
        <Text style={styles.savedText}>Saved to Inbox ✓</Text>
      </View>
    );
  }

  const firstImage = payload?.files.find((f) => f.mimeType.startsWith('image/'));
  const otherFiles = payload?.files.filter((f) => f !== firstImage) ?? [];

  return (
    <KeyboardAvoidingView
      style={styles.sheet}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.handle} />
      <Text style={styles.heading}>Save to Inbox</Text>

      {error && <Text style={styles.errorText}>{error}</Text>}

      {firstImage && (
        <Image source={{ uri: firstImage.localUri }} style={styles.thumb} resizeMode="cover" />
      )}

      {payload?.sourceUrl && (
        <Text style={styles.sourceUrl} numberOfLines={1}>
          {payload.sourceUrl}
        </Text>
      )}

      {(otherFiles.length > 0 || (firstImage && payload!.files.length > 1)) && (
        <Text style={styles.hint}>
          {payload!.files.length} attachment{payload!.files.length > 1 ? 's' : ''}
        </Text>
      )}

      <TextInput
        style={styles.input}
        value={title}
        onChangeText={(t) => {
          setError(null);
          setTitle(t);
        }}
        placeholder="Task title"
        placeholderTextColor={colors.textMuted}
        autoFocus
        multiline
        testID="share-title-input"
      />

      <View style={styles.actions}>
        <Pressable style={styles.cancelBtn} onPress={close} disabled={phase === 'saving'}>
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
        <Pressable
          style={[styles.saveBtn, (!title.trim() || phase === 'saving') && styles.saveBtnDisabled]}
          onPress={onSave}
          disabled={!title.trim() || phase === 'saving'}
          testID="share-save"
        >
          {phase === 'saving' ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.saveText}>Save</Text>
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  sheet: { flex: 1, backgroundColor: colors.surfaceAlt, paddingHorizontal: 20, paddingTop: 12 },
  centered: { flex: 1, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: 20 },
  heading: { ...typography.heading2, color: colors.textPrimary, marginBottom: 16 },
  thumb: { width: '100%', height: 180, borderRadius: 12, marginBottom: 12, backgroundColor: colors.surface },
  sourceUrl: { ...typography.caption, color: colors.accent, marginBottom: 12 },
  hint: { ...typography.caption, color: colors.textMuted, marginBottom: 12 },
  errorText: { ...typography.caption, color: colors.error, marginBottom: 12 },
  savedText: { ...typography.heading2, color: colors.textPrimary },
  input: {
    ...typography.body, color: colors.textPrimary, backgroundColor: colors.surface,
    borderRadius: 12, padding: 14, minHeight: 80, borderWidth: 1, borderColor: colors.border,
    textAlignVertical: 'top', marginBottom: 16,
  },
  actions: { flexDirection: 'row', gap: 12 },
  cancelBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  cancelText: { color: colors.textSecondary, fontWeight: '500', fontSize: 15 },
  saveBtn: { flex: 2, paddingVertical: 14, borderRadius: 12, backgroundColor: colors.accent, alignItems: 'center' },
  saveBtnDisabled: { opacity: 0.4 },
  saveText: { color: '#fff', fontWeight: '600', fontSize: 15 },
});
