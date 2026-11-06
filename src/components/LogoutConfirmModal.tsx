import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  TouchableWithoutFeedback,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { Colors } from '../constants/colors';

interface LogoutConfirmModalProps {
  visible: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  loading: boolean;
  error?: string | null;
}

export function LogoutConfirmModal({
  visible,
  onCancel,
  onConfirm,
  loading,
  error,
}: LogoutConfirmModalProps) {
  return (
    <Modal
      transparent={true}
      visible={visible}
      onRequestClose={onCancel}
      animationType="fade"
    >
      <TouchableWithoutFeedback onPress={onCancel}>
        <View style={styles.backdrop}>
          <View style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.title}>Sign Out</Text>
          </View>
          <View style={styles.body}>
            <Text style={styles.message}>
              Are you sure you want to sign out?
            </Text>
            {error && (
              <View style={styles.errorBanner}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}
          </View>
          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={onCancel}
              disabled={loading}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.confirmButton,
                loading && styles.confirmButtonLoading,
              ]}
              onPress={onConfirm}
              disabled={loading}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              {loading ? (
                <ActivityIndicator size="small" color={Colors.textPrimary} />
              ) : (
                <Text style={styles.confirmText}>Sign Out</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  } as ViewStyle,
  card: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 16,
    width: '100%',
    maxWidth: 320,
    overflow: 'hidden',
  } as ViewStyle,
  header: {
    padding: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  } as ViewStyle,
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.textPrimary,
    textAlign: 'center',
  } as TextStyle,
  body: {
    padding: 20,
  } as ViewStyle,
  message: {
    fontSize: 15,
    color: Colors.textSecondary,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 20,
  } as TextStyle,
  errorBanner: {
    backgroundColor: Colors.errorBg,
    borderWidth: 1,
    borderColor: Colors.error,
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
  } as ViewStyle,
  errorText: {
    fontSize: 13,
    color: '#FCA5A5',
    lineHeight: 18,
    textAlign: 'center',
  } as TextStyle,
  footer: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  } as ViewStyle,
  cancelButton: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
  } as ViewStyle,
  cancelText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textSecondary,
  } as TextStyle,
  confirmButton: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
    backgroundColor: Colors.primary,
  } as ViewStyle,
  confirmButtonLoading: {
    opacity: 0.6,
  } as ViewStyle,
  confirmText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
  } as TextStyle,
});
