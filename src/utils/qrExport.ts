import { Platform, Clipboard } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as MediaLibrary from 'expo-media-library';

/** On-brand, high-contrast QR colours (black on white for reliable scanning). */
export const QR_DARK = '#000000';
export const QR_LIGHT = '#FFFFFF';

/** Resolution used for exported/shared PNG files (independent of on-screen size). */
export const QR_EXPORT_SIZE = 512;

export type QrExportResult = 'shared' | 'downloaded' | 'saved';

/**
 * Waits for React to commit a render and for the SVG to lay out before export.
 * Never relies solely on requestAnimationFrame: browsers can throttle it
 * indefinitely for occluded/hidden windows, which would otherwise leave
 * sharing stuck forever. A timer always guarantees the wait settles.
 */
export function waitForRender(delayMs = 120): Promise<void> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      resolve();
    };

    const fallback = setTimeout(finish, delayMs + 250);
    const schedule: (cb: () => void) => any =
      typeof requestAnimationFrame === 'function'
        ? requestAnimationFrame
        : (cb: () => void) => setTimeout(cb, 16);

    schedule(() =>
      schedule(() => {
        clearTimeout(fallback);
        setTimeout(finish, delayMs);
      })
    );
  });
}

/**
 * Converts the rendered react-native-svg node into a base64 PNG.
 * Works on native and web (react-native-svg implements toDataURL on both).
 */
export function svgToBase64Png(svgRef: any): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!svgRef || typeof svgRef.toDataURL !== 'function') {
      reject(new Error('QR image is not ready yet. Please try again.'));
      return;
    }

    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        reject(new Error('QR image generation timed out.'));
      }
    }, 10000);

    try {
      svgRef.toDataURL((base64: string) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (base64 && base64.length > 100) {
          resolve(base64);
        } else {
          reject(new Error('Generated QR image was empty.'));
        }
      });
    } catch (err) {
      settled = true;
      clearTimeout(timer);
      reject(err instanceof Error ? err : new Error('Unable to render QR image.'));
    }
  });
}

function sanitizeFileName(label?: string): string {
  const base = (label || 'linkflow-qr')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return `${base || 'linkflow-qr'}-${Date.now()}.png`;
}

function base64ToBlob(base64: string, mimeType = 'image/png'): Blob {
  const byteChars = atob(base64);
  const bytes = new Uint8Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i += 1) {
    bytes[i] = byteChars.charCodeAt(i);
  }
  return new Blob([bytes], { type: mimeType });
}

function triggerWebDownload(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Shares a real PNG containing the QR pattern.
 * Web: Web Share API (files) when supported, otherwise a PNG download.
 * Native: writes a real PNG file and opens the native share sheet.
 */
export async function shareQrImagePng(
  base64: string,
  label?: string,
  dialogTitle = 'Share QR Code'
): Promise<QrExportResult> {
  const fileName = sanitizeFileName(label);

  if (Platform.OS === 'web') {
    const blob = base64ToBlob(base64);
    const nav: any = typeof navigator !== 'undefined' ? navigator : null;
    const file = typeof File !== 'undefined' ? new File([blob], fileName, { type: 'image/png' }) : null;

    if (file && nav?.share && nav?.canShare?.({ files: [file] })) {
      await nav.share({ files: [file], title: dialogTitle });
      return 'shared';
    }

    // Never silently fall back to sharing a URL — give the user the PNG instead.
    triggerWebDownload(blob, fileName);
    return 'downloaded';
  }

  const cacheDir = FileSystem.cacheDirectory;
  if (!cacheDir) {
    throw new Error('Device cache directory is unavailable.');
  }
  const fileUri = `${cacheDir}${fileName}`;
  await FileSystem.writeAsStringAsync(fileUri, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });

  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('Sharing is not available on this device.');
  }

  await Sharing.shareAsync(fileUri, {
    dialogTitle,
    mimeType: 'image/png',
    UTI: 'public.png',
  });
  return 'shared';
}

/**
 * Saves a PNG containing the QR pattern.
 * Web: real browser download. Native: writes to app storage and opens the
 * system save sheet (no extra native dependency required).
 */
export async function downloadQrImagePng(
  base64: string,
  label?: string
): Promise<QrExportResult> {
  const fileName = sanitizeFileName(label);

  if (Platform.OS === 'web') {
    triggerWebDownload(base64ToBlob(base64), fileName);
    return 'downloaded';
  }

  const dir = FileSystem.documentDirectory;
  if (!dir) {
    throw new Error('Device document directory is unavailable.');
  }
  const fileUri = `${dir}${fileName}`;
  await FileSystem.writeAsStringAsync(fileUri, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(fileUri, {
      dialogTitle: 'Save QR Code',
      mimeType: 'image/png',
      UTI: 'public.png',
    });
  }
  return 'saved';
}

export async function copyTextToClipboard(text: string): Promise<void> {
  if (Platform.OS === 'web') {
    const nav: any = typeof navigator !== 'undefined' ? navigator : null;
    if (nav?.clipboard?.writeText) {
      await nav.clipboard.writeText(text);
      return;
    }
  }
  Clipboard.setString(text);
}

/**
 * Saves a PNG containing the QR pattern to the device photo gallery.
 *
 * Web: triggers a real browser download (no photo library exists there).
 * Native: writes a temporary PNG and hands it to the system media store.
 *
 * iOS requires the photo-library add permission; Android 10+ can write to the
 * shared collection without any permission, so a denial there is not fatal.
 */
export async function saveQrImageToGallery(
  base64: string,
  label?: string
): Promise<QrExportResult> {
  const fileName = sanitizeFileName(label);

  if (Platform.OS === 'web') {
    triggerWebDownload(base64ToBlob(base64), fileName);
    return 'downloaded';
  }

  let permissionGranted = false;
  try {
    const permission = await MediaLibrary.requestPermissionsAsync();
    permissionGranted = permission.granted;
  } catch (err: any) {
    console.warn('[QR] Photo library permission request failed:', err?.message);
  }

  if (!permissionGranted && Platform.OS === 'ios') {
    throw new Error(
      'Photo library access is required to save the QR code. Enable it in Settings › LinkFlowURL.'
    );
  }

  const cacheDir = FileSystem.cacheDirectory;
  if (!cacheDir) {
    throw new Error('Device cache directory is unavailable.');
  }
  const fileUri = `${cacheDir}${fileName}`;
  await FileSystem.writeAsStringAsync(fileUri, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });

  try {
    await MediaLibrary.saveToLibraryAsync(fileUri);
  } catch (err: any) {
    if (!permissionGranted) {
      throw new Error(
        err?.message ||
          'Could not save the QR code to your photo library. Check the app permissions in your device settings.'
      );
    }
    throw err;
  }

  return 'saved';
}
