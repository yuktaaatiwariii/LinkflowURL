import QRCode from 'qrcode';

/**
 * Server-side QR rendering.
 *
 * The mobile app renders QR codes client-side with `react-native-qrcode-svg`
 * and exports 512 px PNGs with black-on-white colours and ECC level M. The API
 * mirrors those defaults so a generated QR scans the same way, while allowing
 * per-request overrides. QR images are returned as PNG data URIs because the
 * project does not store QR image files server-side.
 */

export interface QrImageOptions {
  size: number;
  margin: number;
  errorCorrectionLevel: 'L' | 'M' | 'Q' | 'H';
  dark: string;
  light: string;
}

export const QR_IMAGE_DEFAULTS: QrImageOptions = {
  size: 512,
  margin: 2,
  errorCorrectionLevel: 'M',
  dark: '#000000',
  light: '#FFFFFF',
};

export async function renderQrDataUrl(
  targetUrl: string,
  options: QrImageOptions = QR_IMAGE_DEFAULTS
): Promise<string> {
  return QRCode.toDataURL(targetUrl, {
    type: 'image/png',
    errorCorrectionLevel: options.errorCorrectionLevel,
    margin: options.margin,
    width: options.size,
    color: {
      dark: options.dark,
      light: options.light,
    },
  });
}

export interface PublicQrImage {
  mimeType: 'image/png';
  encoding: 'data-uri';
  dataUrl: string;
  width: number;
  margin: number;
  errorCorrectionLevel: QrImageOptions['errorCorrectionLevel'];
  dark: string;
  light: string;
}

export function describeQrImage(
  dataUrl: string,
  options: QrImageOptions = QR_IMAGE_DEFAULTS
): PublicQrImage {
  return {
    mimeType: 'image/png',
    encoding: 'data-uri',
    dataUrl,
    width: options.size,
    margin: options.margin,
    errorCorrectionLevel: options.errorCorrectionLevel,
    dark: options.dark,
    light: options.light,
  };
}
