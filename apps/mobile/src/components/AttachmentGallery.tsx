import { useEffect, useState } from 'react';
import {
  View, Image, Text, Pressable, Modal, StyleSheet,
  FlatList, ActivityIndicator, Dimensions,
} from 'react-native';
import { useAttachmentsForTask } from '@todolist/db';
import { colors, typography } from '@todolist/ui';
import { supabase } from '../supabase/client';

const { width: SCREEN_W } = Dimensions.get('window');
const THUMB = (SCREEN_W - 48) / 3;

interface Props { taskId: string }

function useSignedUrl(storagePath: string | null): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!storagePath) return;
    supabase.storage
      .from('attachments')
      .createSignedUrl(storagePath, 3600)
      .then(({ data }) => { if (data?.signedUrl) setUrl(data.signedUrl); });
  }, [storagePath]);
  return url;
}

function AttachmentThumb({ item, onPress }: {
  item: { id: string; local_uri: string | null; storage_path: string | null; mime_type: string | null; filename: string | null };
  onPress: (uri: string) => void;
}) {
  const signedUrl = useSignedUrl(item.storage_path ?? null);
  const uri = item.local_uri ?? signedUrl;
  const isImage = item.mime_type?.startsWith('image/') ?? false;

  if (!isImage) {
    return (
      <View style={styles.fileThumb}>
        <Text style={styles.fileIcon}>📎</Text>
        <Text style={styles.fileName} numberOfLines={2}>{item.filename ?? 'file'}</Text>
      </View>
    );
  }

  if (!uri) {
    return (
      <View style={styles.thumb}>
        <ActivityIndicator color={colors.accent} size="small" />
      </View>
    );
  }

  return (
    <Pressable style={styles.thumb} onPress={() => onPress(uri)}>
      <Image source={{ uri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
    </Pressable>
  );
}

export function AttachmentGallery({ taskId }: Props) {
  const { data: attachments } = useAttachmentsForTask(taskId);
  const [lightbox, setLightbox] = useState<string | null>(null);

  if (__DEV__) console.log('[AttachmentGallery] taskId:', taskId, 'count:', attachments?.length, JSON.stringify(attachments?.map(a => ({ id: (a as any).id, local_uri: (a as any).local_uri, storage_path: (a as any).storage_path }))));

  if (!attachments || attachments.length === 0) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.label}>ATTACHMENTS</Text>
      <FlatList
        data={attachments as any[]}
        keyExtractor={item => item.id}
        numColumns={3}
        scrollEnabled={false}
        columnWrapperStyle={styles.row}
        renderItem={({ item }) => (
          <AttachmentThumb item={item} onPress={setLightbox} />
        )}
      />

      <Modal visible={!!lightbox} transparent animationType="fade" onRequestClose={() => setLightbox(null)}>
        <Pressable style={styles.backdrop} onPress={() => setLightbox(null)}>
          {lightbox && (
            <Image
              source={{ uri: lightbox }}
              style={styles.fullImage}
              resizeMode="contain"
            />
          )}
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 20 },
  label: { ...typography.caption, color: colors.textMuted, fontWeight: '600', letterSpacing: 0.8, marginBottom: 8 },
  row: { gap: 4, marginBottom: 4 },
  thumb: {
    width: THUMB, height: THUMB, borderRadius: 8,
    backgroundColor: colors.surface, overflow: 'hidden',
    alignItems: 'center', justifyContent: 'center',
  },
  fileThumb: {
    width: THUMB, height: THUMB, borderRadius: 8,
    backgroundColor: colors.surface, alignItems: 'center',
    justifyContent: 'center', padding: 8,
  },
  fileIcon: { fontSize: 24, marginBottom: 4 },
  fileName: { ...typography.caption, color: colors.textMuted, textAlign: 'center' },
  backdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.92)',
    alignItems: 'center', justifyContent: 'center',
  },
  fullImage: { width: SCREEN_W, height: SCREEN_W },
});
