import React, { useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuth } from '@clerk/expo';
import { Colors } from '../../../src/constants/colors';
import {
  CustomButton,
  CustomInput,
  Card,
  AlertBanner,
  AppIcon,
  ResponsiveContainer,
  Section,
  QrExporter,
} from '../../../src/components';
import type { QrExporterHandle } from '../../../src/components/QrExporter';
import { useIsDesktop } from '../../../src/hooks/useBreakpoint';
import QRCode from 'react-native-qrcode-svg';
import { openURL } from 'expo-linking';
import { saveQrCode, fetchQrCodes, deleteQrCode } from '../../../src/services/api';
import {
  QR_DARK,
  QR_LIGHT,
  copyTextToClipboard,
  downloadQrImagePng,
  saveQrImageToGallery,
  shareQrImagePng,
} from '../../../src/utils/qrExport';

function isValidHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function HistoryAction({
  icon,
  label,
  onPress,
  busy,
  danger,
}: {
  icon: 'copy' | 'external' | 'download' | 'trash' | 'send';
  label: string;
  onPress: () => void;
  busy?: boolean;
  danger?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[styles.historyAction, danger && styles.historyActionDanger]}
      onPress={onPress}
      disabled={busy}
      hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
    >
      {busy ? (
        <ActivityIndicator size="small" color={danger ? Colors.error : Colors.accentLight} />
      ) : (
        <AppIcon name={icon} size={15} color={danger ? Colors.error : Colors.accentLight} />
      )}
      <Text style={[styles.historyActionText, danger && styles.historyActionTextDanger]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function HistoryCard({
  item,
  active,
  deleting,
  sharing,
  saving,
  onSelect,
  onCopy,
  onOpen,
  onShare,
  onSaveToPhotos,
  onDelete,
}: {
  item: any;
  active: boolean;
  deleting: boolean;
  sharing: boolean;
  saving: boolean;
  onSelect: () => void;
  onCopy: () => void;
  onOpen: () => void;
  onShare: () => void;
  onSaveToPhotos: () => void;
  onDelete: () => void;
}) {
  return (
    <Card
      variant="elevated"
      padding={14}
      style={active ? styles.historyCardActive : styles.historyCard}
    >
      <TouchableOpacity activeOpacity={0.85} style={styles.historyTop} onPress={onSelect}>
        <View style={styles.historyThumb}>
          <QRCode
            value={item.target_url}
            size={86}
            color={QR_DARK}
            backgroundColor={QR_LIGHT}
            quietZone={6}
            ecl="M"
            logoSize={0}
          />
        </View>
        <View style={styles.historyInfo}>
          <View style={styles.historyTitleRow}>
            <Text style={styles.historyTitle} numberOfLines={1}>
              {item.title || 'QR Code'}
            </Text>
            {active ? (
              <View style={styles.selectedBadge}>
                <Text style={styles.selectedBadgeText}>Selected</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.historyTarget} numberOfLines={2}>
            {item.target_url}
          </Text>
          <Text style={styles.historyDate}>{formatDate(item.created_at)}</Text>
          {item.link_id ? (
            <Text style={styles.historyLinked}>Linked to a short link</Text>
          ) : null}
        </View>
      </TouchableOpacity>

      <View style={styles.historyActionsRow}>
        <HistoryAction icon="copy" label="Copy" onPress={onCopy} />
        <HistoryAction icon="external" label="Open" onPress={onOpen} />
        <HistoryAction icon="send" label="Share" onPress={onShare} busy={sharing} />
        <HistoryAction icon="download" label="Save" onPress={onSaveToPhotos} busy={saving} />
        <HistoryAction icon="trash" label="Delete" onPress={onDelete} busy={deleting} danger />
      </View>
    </Card>
  );
}

export default function QRScreen() {
  const router = useRouter();
  const { getToken } = useAuth();
  const isDesktop = useIsDesktop();

  const [targetUrl, setTargetUrl] = useState('');
  const [title, setTitle] = useState('');
  const [qrValue, setQrValue] = useState<string | null>(null);
  const [activeQr, setActiveQr] = useState<any | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [qrCodes, setQrCodes] = useState<any[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [listRefreshing, setListRefreshing] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [deletingQr, setDeletingQr] = useState<string | null>(null);
  const [sharingId, setSharingId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [savingToPhotosId, setSavingToPhotosId] = useState<string | null>(null);

  const exporterRef = useRef<QrExporterHandle>(null);
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;
  const inFlightRef = useRef(false);
  const hasLoadedRef = useRef(false);

  const qrSize = isDesktop ? 260 : 220;

  const loadQrCodes = useCallback(async (silent = false) => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;

    if (!silent && !hasLoadedRef.current) {
      setInitialLoading(true);
    } else {
      setListRefreshing(true);
    }
    setLoadError('');

    try {
      const token = await getTokenRef.current();
      if (!token) {
        setLoadError('Your session has expired. Please sign in again.');
        return;
      }
      const res = await fetchQrCodes(token);
      if (res.error) {
        setLoadError(res.error);
        return;
      }
      const list = res.data?.qrs;
      if (!Array.isArray(list)) {
        setLoadError('The server returned an unexpected QR history response.');
        return;
      }
      setQrCodes(list);
      hasLoadedRef.current = true;
    } catch (err: any) {
      setLoadError(err?.message || 'Unable to load your QR history.');
    } finally {
      inFlightRef.current = false;
      setInitialLoading(false);
      setListRefreshing(false);
    }
  }, []);

  // Load on mount and every time the screen regains focus so newly created
  // QR codes from other sessions/screens are reflected.
  useFocusEffect(
    useCallback(() => {
      loadQrCodes(hasLoadedRef.current);
    }, [loadQrCodes])
  );

  const handleGenerateQR = async () => {
    if (saving) return;
    setErrorMessage('');
    setSuccessMessage('');

    const value = targetUrl.trim();
    if (!value) {
      setErrorMessage('Please provide a URL to encode.');
      return;
    }
    if (!isValidHttpUrl(value)) {
      setErrorMessage('Enter a valid URL starting with http:// or https://.');
      return;
    }

    setQrValue(value);
    setActiveQr(null);
    setSaving(true);

    try {
      const token = await getTokenRef.current();
      if (!token) {
        setErrorMessage('Your session has expired. Please sign in again.');
        return;
      }
      const res = await saveQrCode(token, value, title.trim() || undefined);
      if (res.error) {
        setErrorMessage(`QR generated but could not be saved: ${res.error}`);
        return;
      }
      const saved = res.data?.qr;
      if (!saved) {
        setErrorMessage('QR generated but the server did not confirm the saved record.');
        return;
      }
      setQrCodes((prev) => [saved, ...prev.filter((q) => q.id !== saved.id)]);
      setActiveQr(saved);
      setSuccessMessage('QR code saved to your account.');
    } catch (err: any) {
      console.error('Save QR error:', err);
      setErrorMessage('QR generated but could not be saved to your account.');
    } finally {
      setSaving(false);
    }
  };

  const handleSelectQr = (item: any) => {
    setQrValue(item.target_url);
    setTitle(item.title && item.title !== 'QR Code' ? item.title : '');
    setActiveQr(item);
    setErrorMessage('');
    setSuccessMessage('Loaded saved QR code.');
  };

  const handleCopy = async (text: string) => {
    try {
      await copyTextToClipboard(text);
      setSuccessMessage('URL copied to clipboard.');
    } catch {
      setErrorMessage('Unable to copy the URL on this device.');
    }
  };

  const handleShareQr = async (value: string, label: string, key: string) => {
    setSharingId(key);
    setErrorMessage('');
    setSuccessMessage('');
    try {
      const exporter = exporterRef.current;
      if (!exporter) {
        throw new Error('QR renderer is not ready. Please try again.');
      }
      const base64 = await exporter.exportPng(value);
      const result = await shareQrImagePng(base64, label, 'Share QR Code');
      setSuccessMessage(
        result === 'shared'
          ? 'QR image shared.'
          : 'Image sharing is unavailable here, so the PNG was downloaded instead.'
      );
    } catch (err: any) {
      console.error('Share QR error:', err);
      setErrorMessage(err?.message || 'Unable to share the QR image.');
    } finally {
      setSharingId(null);
    }
  };

  const handleDownloadQr = async (value: string, label: string, key: string) => {
    setDownloadingId(key);
    setErrorMessage('');
    setSuccessMessage('');
    try {
      const exporter = exporterRef.current;
      if (!exporter) {
        throw new Error('QR renderer is not ready. Please try again.');
      }
      const base64 = await exporter.exportPng(value);
      const result = await downloadQrImagePng(base64, label);
      setSuccessMessage(
        result === 'downloaded'
          ? 'QR image downloaded.'
          : 'QR image saved. Use the opened sheet to store it on your device.'
      );
    } catch (err: any) {
      console.error('Download QR error:', err);
      setErrorMessage(err?.message || 'Unable to save the QR image.');
    } finally {
      setDownloadingId(null);
    }
  };

  const handleSaveToPhotos = async (value: string, label: string, key: string) => {
    setSavingToPhotosId(key);
    setErrorMessage('');
    setSuccessMessage('');
    try {
      const exporter = exporterRef.current;
      if (!exporter) {
        throw new Error('QR renderer is not ready. Please try again.');
      }
      const base64 = await exporter.exportPng(value);
      const result = await saveQrImageToGallery(base64, label);
      setSuccessMessage(
        result === 'saved'
          ? 'QR image saved to your photo library.'
          : 'Photo library is unavailable here, so the PNG was downloaded instead.'
      );
    } catch (err: any) {
      console.error('Save to photos error:', err);
      setErrorMessage(err?.message || 'Unable to save the QR image to your gallery.');
    } finally {
      setSavingToPhotosId(null);
    }
  };

  const handleOpenTarget = async (value: string) => {
    try {
      await openURL(value);
    } catch (err: any) {
      console.error('Open target error:', err);
      setErrorMessage('This link could not be opened on your device.');
    }
  };

  const handleDeleteQr = async (id: string) => {
    setDeletingQr(id);
    setErrorMessage('');
    setSuccessMessage('');
    try {
      const token = await getTokenRef.current();
      if (!token) {
        setErrorMessage('Session expired. Please sign in again.');
        return;
      }
      const res = await deleteQrCode(token, id);
      if (res.error) {
        setErrorMessage(res.error || 'Failed to delete QR code.');
        return;
      }
      setQrCodes((prev) => prev.filter((q) => q.id !== id));
      if (activeQr?.id === id) {
        setActiveQr(null);
      }
      setSuccessMessage('QR code deleted.');
    } catch (err: any) {
      console.error('Delete QR error:', err);
      setErrorMessage(err?.message || 'Failed to delete QR code.');
    } finally {
      setDeletingQr(null);
    }
  };

  const formWidth = isDesktop ? 480 : '100%';

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.background} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={listRefreshing}
              onRefresh={() => loadQrCodes(true)}
              tintColor={Colors.accent}
              colors={[Colors.accent]}
            />
          }
        >
          <ResponsiveContainer padding={24} centerOnDesktop={isDesktop}>
            <TouchableOpacity
              style={styles.backBtn}
              onPress={() => router.back()}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <AppIcon name="arrow-left" size={20} color={Colors.textSecondary} />
            </TouchableOpacity>

            <View style={styles.header}>
              <Text style={styles.title}>QR Code Generator</Text>
              <Text style={styles.subtitle}>
                Generate scannable QR codes for instant sharing.
              </Text>
              <TouchableOpacity
                style={styles.scanButton}
                onPress={() => router.push('/(protected)/qr/scan' as any)}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel="Scan a QR code with the camera"
              >
                <AppIcon name="qr" size={17} color={Colors.accentLight} />
                <Text style={styles.scanButtonText}>Scan a QR code</Text>
              </TouchableOpacity>
            </View>

            {!!errorMessage && <AlertBanner type="error" message={errorMessage} />}
            {!!successMessage && <AlertBanner type="success" message={successMessage} />}

            {/* Generator Form */}
            <View
              style={[
                styles.formCardWrapper,
                { width: formWidth, alignSelf: isDesktop ? 'center' : 'stretch' },
              ]}
            >
              <Card style={styles.formCard} variant="elevated">
                <CustomInput
                  label="Target URL"
                  placeholder="https://yourwebsite.com"
                  value={targetUrl}
                  onChangeText={setTargetUrl}
                  autoCapitalize="none"
                  icon={<AppIcon name="qr" size={18} color={Colors.textSecondary} />}
                />

                <CustomInput
                  label="QR Code Label (Optional)"
                  placeholder="e.g. Menu QR Code"
                  value={title}
                  onChangeText={setTitle}
                  autoCapitalize="words"
                />

                <CustomButton
                  title="Generate QR Code"
                  size="md"
                  variant="primary"
                  loading={saving}
                  onPress={handleGenerateQR}
                  fullWidth
                />
              </Card>
            </View>

            {/* QR Display */}
            {qrValue ? (
              <View
                style={[
                  styles.qrDisplayWrapper,
                  { width: formWidth, alignSelf: isDesktop ? 'center' : 'stretch' },
                ]}
              >
                <Card style={styles.qrDisplayCard} variant="elevated">
                  <Text style={styles.qrTitle}>
                    {activeQr?.title || title || 'Your Generated QR Code'}
                  </Text>
                  <View style={[styles.qrBox, { width: qrSize, height: qrSize }]}>
                    <QRCode
                      value={qrValue}
                      size={qrSize}
                      color={QR_DARK}
                      backgroundColor={QR_LIGHT}
                      quietZone={10}
                      ecl="M"
                      logoSize={0}
                    />
                  </View>
                  <Text style={styles.targetDisplay} numberOfLines={3}>
                    {qrValue}
                  </Text>

                  <View style={styles.qrActions}>
                    <CustomButton
                      title="Copy URL"
                      size="sm"
                      variant="outline"
                      onPress={() => handleCopy(qrValue)}
                    />
                    <CustomButton
                      title="Share QR"
                      size="sm"
                      variant="secondary"
                      loading={sharingId === 'current'}
                      onPress={() =>
                        handleShareQr(
                          qrValue,
                          activeQr?.title || title || 'LinkFlow QR Code',
                          'current'
                        )
                      }
                    />
                    <CustomButton
                      title="Download QR"
                      size="sm"
                      variant="secondary"
                      loading={downloadingId === 'current'}
                      onPress={() =>
                        handleDownloadQr(
                          qrValue,
                          activeQr?.title || title || 'LinkFlow QR Code',
                          'current'
                        )
                      }
                    />
                    <CustomButton
                      title="Save to Photos"
                      size="sm"
                      variant="outline"
                      loading={savingToPhotosId === 'current'}
                      onPress={() =>
                        handleSaveToPhotos(
                          qrValue,
                          activeQr?.title || title || 'LinkFlow QR Code',
                          'current'
                        )
                      }
                    />
                    <CustomButton
                      title="Open URL"
                      size="sm"
                      variant="outline"
                      onPress={() => handleOpenTarget(qrValue)}
                    />
                  </View>

                  <View
                    style={[
                      styles.readyBadge,
                      activeQr ? styles.readyBadgeSaved : styles.readyBadgeUnsaved,
                    ]}
                  >
                    <Text
                      style={[
                        styles.readyBadgeText,
                        activeQr ? styles.readyBadgeTextSaved : styles.readyBadgeTextUnsaved,
                      ]}
                    >
                      {activeQr ? 'Saved to your account' : 'Not saved yet'}
                    </Text>
                  </View>
                </Card>
              </View>
            ) : (
              <View
                style={[
                  styles.emptyCardWrapper,
                  { width: formWidth, alignSelf: isDesktop ? 'center' : 'stretch' },
                ]}
              >
                <Card style={styles.emptyCard} variant="secondary">
                  <AppIcon name="qr" size={36} color={Colors.textMuted} />
                  <Text style={styles.emptyTitle}>No QR code generated yet</Text>
                  <Text style={styles.emptyText}>
                    Enter your target link above to generate a scannable QR code.
                  </Text>
                </Card>
              </View>
            )}

            {/* QR History */}
            <View
              style={[
                styles.historyWrapper,
                { width: formWidth, alignSelf: isDesktop ? 'center' : 'stretch' },
              ]}
            >
              <Section title="QR History" titleBottom={12}>
                <View style={styles.historyMetaRow}>
                  <Text style={styles.historyMetaText}>
                    {hasLoadedRef.current
                      ? `${qrCodes.length} saved QR ${qrCodes.length === 1 ? 'code' : 'codes'}`
                      : 'Loading saved QR codes…'}
                  </Text>
                  {listRefreshing && !initialLoading ? (
                    <ActivityIndicator size="small" color={Colors.accent} />
                  ) : null}
                </View>

                {initialLoading ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator color={Colors.accent} size="large" />
                    <Text style={styles.loadingText}>Loading your QR history…</Text>
                  </View>
                ) : loadError ? (
                  <Card style={styles.errorCard} variant="secondary">
                    <AppIcon name="x" size={28} color={Colors.error} />
                    <Text style={styles.errorTitle}>Could not load QR history</Text>
                    <Text style={styles.errorText}>{loadError}</Text>
                    <CustomButton
                      title="Retry"
                      size="sm"
                      variant="primary"
                      onPress={() => loadQrCodes(false)}
                    />
                  </Card>
                ) : qrCodes.length === 0 ? (
                  <Card style={styles.emptyCard} variant="secondary">
                    <AppIcon name="qr" size={36} color={Colors.textMuted} />
                    <Text style={styles.emptyTitle}>No QR codes yet</Text>
                    <Text style={styles.emptyText}>
                      Generate your first QR code to see it here.
                    </Text>
                  </Card>
                ) : (
                  <View style={styles.qrHistoryList}>
                    {qrCodes.map((qr: any) => (
                      <HistoryCard
                        key={qr.id}
                        item={qr}
                        active={activeQr?.id === qr.id}
                        deleting={deletingQr === qr.id}
                        sharing={sharingId === qr.id}
                        saving={savingToPhotosId === qr.id}
                        onSelect={() => handleSelectQr(qr)}
                        onCopy={() => handleCopy(qr.target_url)}
                        onOpen={() => handleOpenTarget(qr.target_url)}
                        onShare={() =>
                          handleShareQr(qr.target_url, qr.title || 'LinkFlow QR Code', qr.id)
                        }
                        onSaveToPhotos={() =>
                          handleSaveToPhotos(
                            qr.target_url,
                            qr.title || 'LinkFlow QR Code',
                            qr.id
                          )
                        }
                        onDelete={() => handleDeleteQr(qr.id)}
                      />
                    ))}
                  </View>
                )}
              </Section>
            </View>
          </ResponsiveContainer>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Hidden high-resolution renderer used for PNG export/sharing */}
      <QrExporter ref={exporterRef} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    alignSelf: 'flex-start',
  },
  header: {
    marginBottom: 28,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 15,
    color: Colors.textSecondary,
    lineHeight: 22,
  },
  formCardWrapper: {
    marginBottom: 28,
    width: '100%',
  },
  formCard: {
    padding: 20,
    width: '100%',
  },
  qrDisplayWrapper: {
    width: '100%',
    marginBottom: 28,
  },
  qrDisplayCard: {
    alignItems: 'center',
    padding: 24,
    width: '100%',
  },
  qrTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 20,
    textAlign: 'center',
  },
  qrBox: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    backgroundColor: QR_LIGHT,
    borderRadius: 12,
    padding: 8,
    overflow: 'hidden',
  },
  targetDisplay: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  qrActions: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
    width: '100%',
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  scanButton: {
    marginTop: 14,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 12,
    backgroundColor: Colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  scanButtonText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: Colors.accentLight,
  },
  readyBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
  },
  readyBadgeSaved: {
    backgroundColor: Colors.successBg,
    borderColor: Colors.success,
  },
  readyBadgeUnsaved: {
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderColor: Colors.warning,
  },
  readyBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  readyBadgeTextSaved: {
    color: Colors.success,
  },
  readyBadgeTextUnsaved: {
    color: Colors.warning,
  },
  emptyCardWrapper: {
    width: '100%',
    marginBottom: 28,
  },
  emptyCard: {
    alignItems: 'center',
    padding: 26,
    borderStyle: 'dashed',
    gap: 10,
    width: '100%',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  historyWrapper: {
    width: '100%',
  },
  historyMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    minHeight: 20,
  },
  historyMetaText: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  qrHistoryList: {
    gap: 12,
  },
  historyCard: {
    width: '100%',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  historyCardActive: {
    borderColor: Colors.accent,
  },
  historyTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  historyThumb: {
    width: 98,
    height: 98,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: QR_LIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyInfo: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  historyTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  historyTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  selectedBadge: {
    backgroundColor: 'rgba(124, 34, 234, 0.2)',
    borderWidth: 1,
    borderColor: Colors.accent,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  selectedBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.accentLight,
  },
  historyTarget: {
    fontSize: 12.5,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  historyDate: {
    fontSize: 11.5,
    color: Colors.textMuted,
  },
  historyLinked: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.accentLight,
  },
  historyActionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  historyAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 9,
    backgroundColor: Colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  historyActionDanger: {
    backgroundColor: Colors.errorBg,
    borderColor: 'rgba(239, 68, 68, 0.4)',
  },
  historyActionText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.accentLight,
  },
  historyActionTextDanger: {
    color: Colors.error,
  },
  loadingContainer: {
    paddingVertical: 36,
    alignItems: 'center',
    gap: 10,
  },
  loadingText: {
    fontSize: 13,
    color: Colors.textMuted,
  },
  errorCard: {
    alignItems: 'center',
    padding: 24,
    gap: 10,
    width: '100%',
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 19,
  },
});
