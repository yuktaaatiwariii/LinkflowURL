import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { openURL } from 'expo-linking';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { Colors } from '../../../src/constants/colors';
import { AppIcon } from '../../../src/components';
import { isValidHttpUrl } from '../../../src/utils/url';

interface ScanResult {
  raw: string;
  url: string | null;
}

/**
 * QR scanner (Phase 4).
 *
 * Scans QR codes with the device camera and offers two safe actions on the
 * result: open the link in the browser, or pre-fill the Create Link screen.
 * A scanned URL is never opened automatically — the user always confirms.
 */
export default function QrScannerScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const [permission, requestPermission] = useCameraPermissions();

  const [cameraError, setCameraError] = useState<string | null>(null);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isRequesting, setIsRequesting] = useState(false);

  const scannedRef = useRef(false);
  const requestedRef = useRef(false);

  // Ask for camera access once when the scanner is opened.
  useEffect(() => {
    if (!permission || requestedRef.current) return;
    requestedRef.current = true;
    if (!permission.granted && permission.canAskAgain) {
      setIsRequesting(true);
      requestPermission()
        .catch(() => undefined)
        .finally(() => setIsRequesting(false));
    }
  }, [permission, requestPermission]);

  const handleBarcodeScanned = useCallback((scanningResult: BarcodeScanningResult) => {
    // Ignore repeat events for the same code while the preview is open.
    if (scannedRef.current) return;
    const raw = scanningResult?.data ?? '';
    if (!raw) return;

    scannedRef.current = true;
    setResult({ raw, url: isValidHttpUrl(raw.trim()) ? raw.trim() : null });
  }, []);

  const scanAgain = useCallback(() => {
    scannedRef.current = false;
    setResult(null);
    setActionError(null);
  }, []);

  const handleOpenUrl = useCallback(async () => {
    if (!result?.url) return;
    try {
      await openURL(result.url);
    } catch {
      setActionError('This link could not be opened on your device.');
    }
  }, [result]);

  const handleShorten = useCallback(() => {
    if (!result?.url) return;
    router.push(`/(protected)/links?url=${encodeURIComponent(result.url)}` as any);
  }, [result, router]);

  const cameraReady = !!permission?.granted && !cameraError;
  const frameSize = Math.min(windowWidth, 360) * 0.72;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />

      {/* Camera preview */}
      {cameraReady && (
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={result ? undefined : handleBarcodeScanned}
          onMountError={(event: any) => {
            setCameraError(event?.message || 'The camera could not be started.');
          }}
        />
      )}

      {/* Dimmed surroundings around the scan frame */}
      {cameraReady && !result && (
        <View style={styles.overlay} pointerEvents="none">
          <View style={[styles.dim, { height: windowHeight * 0.28 }]} />
          <View style={styles.middleRow}>
            <View style={[styles.dim, { width: windowWidth * 0.12 }]} />
            <View style={{ width: frameSize, height: frameSize }} />
            <View style={[styles.dim, { flex: 1 }]} />
          </View>
          <View style={[styles.dim, { flex: 1 }]} />
        </View>
      )}

      {/* Top bar */}
      <SafeAreaView style={styles.topBar} edges={['top']} pointerEvents="box-none">
        <View style={styles.topBarInner}>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => router.back()}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel="Close the QR scanner"
          >
            <AppIcon name="arrow-left" size={20} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.topTitle}>Scan QR Code</Text>
          <View style={styles.iconButtonSpacer} />
        </View>
      </SafeAreaView>

      {/* Scan frame */}
      {cameraReady && !result && (
        <View
          style={[styles.frame, { width: frameSize, height: frameSize }]}
          pointerEvents="none"
        >
          <View style={[styles.corner, styles.cornerTL]} />
          <View style={[styles.corner, styles.cornerTR]} />
          <View style={[styles.corner, styles.cornerBL]} />
          <View style={[styles.corner, styles.cornerBR]} />
        </View>
      )}

      {cameraReady && !result && (
        <View style={[styles.hintWrapper, { bottom: insets.bottom + 32 }]} pointerEvents="none">
          <Text style={styles.hintText}>Point the camera at a QR code</Text>
        </View>
      )}

      {/* Permission / error states */}
      {!cameraReady && (
        <View style={styles.stateOverlay}>
          <View style={styles.stateCard}>
            {isRequesting ? (
              <>
                <ActivityIndicator color={Colors.accent} size="large" />
                <Text style={styles.stateTitle}>Requesting camera access…</Text>
              </>
            ) : cameraError ? (
              <>
                <AppIcon name="x" size={30} color={Colors.error} />
                <Text style={styles.stateTitle}>Camera unavailable</Text>
                <Text style={styles.stateText}>{cameraError}</Text>
                <TouchableOpacity
                  style={styles.stateButton}
                  onPress={() => {
                    setCameraError(null);
                    requestPermission().catch(() => undefined);
                  }}
                >
                  <Text style={styles.stateButtonText}>Try again</Text>
                </TouchableOpacity>
              </>
            ) : permission?.canAskAgain === false ? (
              <>
                <AppIcon name="lock" size={30} color={Colors.warning} />
                <Text style={styles.stateTitle}>Camera access is blocked</Text>
                <Text style={styles.stateText}>
                  Enable the camera for LinkFlowURL in your device settings to scan QR codes.
                </Text>
                <TouchableOpacity
                  style={styles.stateButton}
                  onPress={() => Linking.openSettings()}
                >
                  <Text style={styles.stateButtonText}>Open settings</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <AppIcon name="qr" size={30} color={Colors.accent} />
                <Text style={styles.stateTitle}>Camera access needed</Text>
                <Text style={styles.stateText}>
                  LinkFlow uses the camera only to read QR codes. Nothing is recorded or uploaded.
                </Text>
                <TouchableOpacity
                  style={styles.stateButton}
                  onPress={() => {
                    setIsRequesting(true);
                    requestPermission()
                      .catch(() => undefined)
                      .finally(() => setIsRequesting(false));
                  }}
                >
                  <Text style={styles.stateButtonText}>Allow camera</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      )}

      {/* Result panel */}
      {result && (
        <View style={styles.resultOverlay}>
          <View style={[styles.resultSheet, { paddingBottom: Math.max(insets.bottom, 20) + 8 }]}>
            <View style={styles.sheetHandle} />

            {result.url ? (
              <>
                <View style={styles.resultHeader}>
                  <View style={styles.resultIcon}>
                    <AppIcon name="check" size={20} color={Colors.success} />
                  </View>
                  <View style={styles.resultHeaderCopy}>
                    <Text style={styles.resultTitle}>QR code scanned</Text>
                    <Text style={styles.resultSubtitle}>This QR code points to a link.</Text>
                  </View>
                </View>

                <View style={styles.urlBox}>
                  <Text style={styles.urlText} numberOfLines={3} selectable>
                    {result.url}
                  </Text>
                </View>

                {!!actionError && <Text style={styles.actionError}>{actionError}</Text>}

                <TouchableOpacity
                  style={[styles.primaryButton, { marginTop: 18 }]}
                  onPress={handleOpenUrl}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                >
                  <AppIcon name="external" size={18} color={Colors.background} />
                  <Text style={styles.primaryButtonText}>Open URL</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.secondaryButton}
                  onPress={handleShorten}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                >
                  <AppIcon name="zap" size={18} color={Colors.accentLight} />
                  <Text style={styles.secondaryButtonText}>Shorten URL</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.tertiaryButton}
                  onPress={scanAgain}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                >
                  <Text style={styles.tertiaryButtonText}>Scan another code</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <View style={styles.resultHeader}>
                  <View style={[styles.resultIcon, styles.resultIconError]}>
                    <AppIcon name="x" size={20} color={Colors.error} />
                  </View>
                  <View style={styles.resultHeaderCopy}>
                    <Text style={styles.resultTitle}>Not a link</Text>
                    <Text style={styles.resultSubtitle}>
                      This QR code does not contain a valid http(s) URL.
                    </Text>
                  </View>
                </View>

                <View style={styles.urlBox}>
                  <Text style={styles.urlText} numberOfLines={3} selectable>
                    {result.raw || '(empty)'}
                  </Text>
                </View>

                <TouchableOpacity
                  style={[styles.primaryButton, { marginTop: 18 }]}
                  onPress={scanAgain}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                >
                  <Text style={styles.primaryButtonText}>Scan again</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.tertiaryButton}
                  onPress={() => router.back()}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                >
                  <Text style={styles.tertiaryButtonText}>Cancel</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  topBarInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButtonSpacer: {
    width: 40,
    height: 40,
  },
  topTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-start',
  },
  dim: {
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
  },
  middleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  frame: {
    position: 'absolute',
    alignSelf: 'center',
    top: '32%',
  },
  corner: {
    position: 'absolute',
    width: 34,
    height: 34,
    borderColor: Colors.accent,
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: 12,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: 12,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: 12,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: 12,
  },
  hintWrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  hintText: {
    color: Colors.textSecondary,
    fontSize: 13.5,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    overflow: 'hidden',
  },
  stateOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  stateCard: {
    alignItems: 'center',
    gap: 12,
    maxWidth: 380,
  },
  stateTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  stateText: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 21,
  },
  stateButton: {
    marginTop: 8,
    backgroundColor: Colors.primary,
    paddingHorizontal: 22,
    paddingVertical: 13,
    borderRadius: 12,
  },
  stateButtonText: {
    color: Colors.background,
    fontSize: 15,
    fontWeight: '700',
  },
  resultOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    justifyContent: 'flex-end',
  },
  resultSheet: {
    backgroundColor: Colors.surfaceCard,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: Colors.border,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.borderLight,
    marginBottom: 18,
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  resultIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: Colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultIconError: {
    borderColor: Colors.error,
  },
  resultHeaderCopy: {
    flex: 1,
    gap: 3,
  },
  resultTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  resultSubtitle: {
    fontSize: 13.5,
    color: Colors.textSecondary,
  },
  urlBox: {
    marginTop: 16,
    backgroundColor: Colors.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 13,
    paddingVertical: 12,
  },
  urlText: {
    fontSize: 13,
    color: Colors.accentLight,
    fontWeight: '600',
  },
  actionError: {
    marginTop: 10,
    fontSize: 13,
    color: Colors.error,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    backgroundColor: Colors.primary,
    borderRadius: 13,
    minHeight: 52,
    paddingHorizontal: 20,
  },
  primaryButtonText: {
    color: Colors.background,
    fontSize: 15,
    fontWeight: '700',
  },
  secondaryButton: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    backgroundColor: Colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    borderRadius: 13,
    minHeight: 52,
  },
  secondaryButtonText: {
    color: Colors.accentLight,
    fontSize: 15,
    fontWeight: '700',
  },
  tertiaryButton: {
    marginTop: 6,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 46,
  },
  tertiaryButtonText: {
    color: Colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
});
