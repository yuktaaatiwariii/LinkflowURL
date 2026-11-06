import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  Clipboard,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '../../../src/constants/colors';
import {
  CustomButton,
  CustomInput,
  Card,
  AlertBanner,
  AppIcon,
  ResponsiveContainer,
} from '../../../src/components';
import { useIsDesktop } from '../../../src/hooks/useBreakpoint';
import QRCode from 'react-native-qrcode-svg';
import * as Sharing from 'expo-sharing';

export default function QRScreen() {
  const router = useRouter();
  const isDesktop = useIsDesktop();

  const [targetUrl, setTargetUrl] = useState('');
  const [title, setTitle] = useState('');
  const [qrValue, setQrValue] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [sharing, setSharing] = useState(false);

  const handleGenerateQR = () => {
    setErrorMessage('');
    if (!targetUrl.trim()) {
      setErrorMessage('Please provide a URL or text to encode.');
      return;
    }
    setQrValue(targetUrl.trim());
  };

  const handleCopy = () => {
    if (!qrValue) return;
    Clipboard.setString(qrValue);
  };

  const handleShare = async () => {
    if (!qrValue) return;
    setSharing(true);
    try {
      await Sharing.shareAsync(qrValue, {
        dialogTitle: 'Share LinkFlow URL',
        UTI: 'public.plain-text',
      });
    } catch (err) {
      console.error('Share error:', err);
      setErrorMessage('Unable to share. Please try again.');
    } finally {
      setSharing(false);
    }
  };

  const formWidth = isDesktop ? 480 : '100%';
  const qrSize = isDesktop ? 260 : 220;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.background} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <ResponsiveContainer padding={24} centerOnDesktop={isDesktop}>
            {/* Back Button */}
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
            </View>

            {!!errorMessage && <AlertBanner type="error" message={errorMessage} />}

            {/* Generator Form */}
            <View style={[styles.formCardWrapper, { width: formWidth, alignSelf: isDesktop ? 'center' : 'stretch' }]}>
              <Card style={styles.formCard} variant="elevated">
                <CustomInput
                  label="Target URL or Text"
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
                  onPress={handleGenerateQR}
                  fullWidth
                />
              </Card>
            </View>

            {/* QR Display */}
            {qrValue ? (
              <View style={[styles.qrDisplayWrapper, { width: formWidth, alignSelf: isDesktop ? 'center' : 'stretch' }]}>
                <Card style={styles.qrDisplayCard} variant="elevated">
                  <Text style={styles.qrTitle}>{title || 'Your Generated QR Code'}</Text>
                  <View style={[styles.qrBox, { width: qrSize, height: qrSize }]}>
                    <QRCode
                      value={qrValue}
                      size={qrSize}
                      color="#7C3AED"
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
                      onPress={handleCopy}
                    />
                    <CustomButton
                      title="Share"
                      size="sm"
                      variant="secondary"
                      loading={sharing}
                      onPress={handleShare}
                    />
                  </View>
                  <Text style={styles.readyBadge}>Ready to Scan</Text>
                </Card>
              </View>
            ) : (
              <View style={[styles.emptyCardWrapper, { width: formWidth, alignSelf: isDesktop ? 'center' : 'stretch' }]}>
                <Card style={styles.emptyCard} variant="secondary">
                  <AppIcon name="qr" size={36} color={Colors.textMuted} />
                  <Text style={styles.emptyTitle}>No QR code generated yet</Text>
                  <Text style={styles.emptyText}>
                    Enter your target link above to generate a scannable QR code.
                  </Text>
                </Card>
              </View>
            )}
          </ResponsiveContainer>
        </ScrollView>
      </KeyboardAvoidingView>
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
    gap: 12,
    marginBottom: 16,
    width: '100%',
    justifyContent: 'center',
  },
  readyBadge: {
    color: Colors.success,
    fontSize: 12,
    fontWeight: '600',
    backgroundColor: '#064e3b',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 10,
  },
  emptyCardWrapper: {
    width: '100%',
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
});
