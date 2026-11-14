import React from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { DevColors, DevRadius, DevSpacing } from '../../constants/developerTheme';
import { DevIconButton } from './DeveloperUI';

interface DeveloperModalProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  dismissable?: boolean;
  width?: number;
}

/**
 * Accessible modal shell used by every destructive and one-time-secret flow.
 * `onClose` is the only dismissal path, so callers can clear secrets from
 * memory when the modal actually closes.
 */
export function DeveloperModal({
  visible,
  onClose,
  title,
  subtitle,
  children,
  footer,
  dismissable = true,
  width = 560,
}: DeveloperModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={() => {
        if (dismissable) onClose();
      }}
    >
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={() => {
            if (dismissable) onClose();
          }}
        />
        <View style={[styles.card, { maxWidth: width }]}>
          <View style={styles.header}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.title}>{title}</Text>
              {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
            </View>
            <DevIconButton icon="x" label="Close" onPress={onClose} disabled={!dismissable} />
          </View>
          <ScrollView
            style={styles.body}
            contentContainerStyle={{ paddingBottom: DevSpacing.md }}
            keyboardShouldPersistTaps="handled"
          >
            {children}
          </ScrollView>
          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

interface ConfirmModalProps {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  destructive?: boolean;
  loading?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  children?: React.ReactNode;
}

export function DeveloperConfirmModal({
  visible,
  title,
  message,
  confirmLabel = 'Confirm',
  destructive = false,
  loading = false,
  onCancel,
  onConfirm,
  children,
}: ConfirmModalProps) {
  return (
    <DeveloperModal
      visible={visible}
      onClose={onCancel}
      title={title}
      dismissable={!loading}
      width={480}
      footer={
        <View style={styles.confirmFooter}>
          <View style={{ flex: 1 }} />
          <View style={styles.confirmActions}>
            <Pressable
              onPress={onCancel}
              disabled={loading}
              style={[styles.textButton, loading && { opacity: 0.5 }]}
            >
              <Text style={styles.textButtonLabel}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={onConfirm}
              disabled={loading}
              style={[
                styles.confirmButton,
                destructive ? styles.confirmDanger : styles.confirmPrimary,
                loading && { opacity: 0.6 },
              ]}
            >
              <Text style={styles.confirmButtonLabel}>{loading ? 'Working…' : confirmLabel}</Text>
            </Pressable>
          </View>
        </View>
      }
    >
      <View style={styles.confirmBody}>
        {destructive ? (
          <View style={styles.warningIcon}>
            <Feather name="alert-triangle" size={18} color={DevColors.danger} />
          </View>
        ) : null}
        <Text style={styles.confirmMessage}>{message}</Text>
        {children}
      </View>
    </DeveloperModal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(4, 4, 9, 0.76)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  card: {
    width: '100%',
    maxHeight: '88%',
    backgroundColor: DevColors.surface,
    borderRadius: DevRadius.xl,
    borderWidth: 1,
    borderColor: DevColors.borderStrong,
    shadowColor: '#000000',
    shadowOpacity: 0.45,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 14 },
    elevation: 18,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: DevSpacing.md,
    padding: DevSpacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: DevColors.border,
  },
  title: { color: DevColors.text, fontSize: 16, fontWeight: '700' },
  subtitle: { color: DevColors.textMuted, fontSize: 12, lineHeight: 17, marginTop: 4 },
  body: { paddingHorizontal: DevSpacing.lg, paddingTop: DevSpacing.lg },
  footer: {
    borderTopWidth: 1,
    borderTopColor: DevColors.border,
    padding: DevSpacing.lg,
  },
  confirmBody: { gap: DevSpacing.md },
  confirmMessage: { color: DevColors.textSecondary, fontSize: 13, lineHeight: 19 },
  warningIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: DevColors.dangerBg,
    borderWidth: 1,
    borderColor: DevColors.dangerBorder,
  },
  confirmFooter: { flexDirection: 'row', alignItems: 'center' },
  confirmActions: { flexDirection: 'row', alignItems: 'center', gap: DevSpacing.sm },
  textButton: { paddingHorizontal: 14, paddingVertical: 10 },
  textButtonLabel: { color: DevColors.textSecondary, fontSize: 13, fontWeight: '600' },
  confirmButton: {
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: DevRadius.md,
    borderWidth: 1,
  },
  confirmPrimary: { backgroundColor: DevColors.primary, borderColor: DevColors.primary },
  confirmDanger: { backgroundColor: DevColors.dangerBg, borderColor: DevColors.dangerBorder },
  confirmButtonLabel: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
});
