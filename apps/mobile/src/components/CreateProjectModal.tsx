import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  Modal, View, Text, TextInput, Pressable, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { usePowerSync } from '@powersync/react';
import { createProject } from '@todolist/db';
import { useAuth } from '../auth/AuthContext';
import { colors, typography } from '@todolist/ui';

interface Props {
  visible: boolean;
  onClose: () => void;
}

const COLORS = ['#6366F1', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];
const ICONS  = ['📁', '🏠', '💼', '🎯', '📚', '🛒', '🏋️', '✈️'];

export function CreateProjectModal({ visible, onClose }: Props) {
  const db          = usePowerSync();
  const { session } = useAuth();
  const [name, setName]       = useState('');
  const [color, setColor]     = useState(COLORS[0]);
  const [icon, setIcon]       = useState(ICONS[0]);
  const [saving, setSaving]   = useState(false);

  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  const handleSave = useCallback(async () => {
    const trimmed = name.trim();
    if (!trimmed || !session) return;

    setSaving(true);
    let succeeded = false;
    try {
      await createProject(db as any, {
        userId: session.user.id,
        name:   trimmed,
        color,
        icon,
      });
      succeeded = true;
    } catch (e) {
      console.error('createProject failed:', e);
    } finally {
      setSaving(false);
    }
    if (succeeded) {
      setName('');
      setColor(COLORS[0]);
      setIcon(ICONS[0]);
      onCloseRef.current();
    }
  }, [db, session, name, color, icon]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onCloseRef.current}
    >
      <KeyboardAvoidingView
        style={styles.sheet}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.handle} />
        <Text style={styles.heading}>New project</Text>

        <TextInput
          style={styles.input}
          placeholder="Project name"
          placeholderTextColor={colors.textMuted}
          value={name}
          onChangeText={setName}
          autoFocus
          returnKeyType="done"
          onSubmitEditing={handleSave}
        />

        <Text style={styles.label}>COLOR</Text>
        <View style={styles.swatches}>
          {COLORS.map(c => (
            <Pressable
              key={c}
              style={[styles.swatch, { backgroundColor: c }, color === c && styles.swatchActive]}
              onPress={() => setColor(c)}
            />
          ))}
        </View>

        <Text style={styles.label}>ICON</Text>
        <View style={styles.icons}>
          {ICONS.map(i => (
            <Pressable
              key={i}
              style={[styles.iconBtn, icon === i && styles.iconBtnActive]}
              onPress={() => setIcon(i)}
            >
              <Text style={styles.iconText}>{i}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.actions}>
          <Pressable style={styles.cancelBtn} onPress={onCloseRef.current}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
          <Pressable
            style={[styles.saveBtn, !name.trim() && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={!name.trim() || saving}
          >
            {saving
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={styles.saveText}>Create</Text>
            }
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheet:         { flex: 1, backgroundColor: colors.surfaceAlt, paddingHorizontal: 20, paddingTop: 12 },
  handle:        { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: 20 },
  heading:       { ...typography.heading2, color: colors.textPrimary, marginBottom: 20 },
  input:         { ...typography.body, color: colors.textPrimary, backgroundColor: colors.surface, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: colors.border, marginBottom: 20 },
  label:         { ...typography.caption, color: colors.textMuted, fontWeight: '600', letterSpacing: 0.8, marginBottom: 10 },
  swatches:      { flexDirection: 'row', gap: 10, marginBottom: 20 },
  swatch:        { width: 32, height: 32, borderRadius: 16 },
  swatchActive:  { borderWidth: 3, borderColor: '#fff' },
  icons:         { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 24 },
  iconBtn:       { padding: 8, borderRadius: 8, backgroundColor: colors.surface },
  iconBtnActive: { borderWidth: 2, borderColor: colors.accent },
  iconText:      { fontSize: 22 },
  actions:       { flexDirection: 'row', gap: 12, marginTop: 'auto' },
  cancelBtn:     { flex: 1, paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  cancelText:    { color: colors.textSecondary, fontWeight: '500', fontSize: 15 },
  saveBtn:       { flex: 2, paddingVertical: 14, borderRadius: 12, backgroundColor: colors.accent, alignItems: 'center' },
  saveBtnDisabled: { opacity: 0.4 },
  saveText:      { color: '#fff', fontWeight: '600', fontSize: 15 },
});
