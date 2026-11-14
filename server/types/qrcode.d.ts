/**
 * Minimal ambient typings for the `qrcode` package (v1.5.x).
 *
 * The package ships without TypeScript definitions and `@types/qrcode` is not
 * installed, so only the single API used by the developer API is declared.
 */
declare module 'qrcode' {
  export type QrErrorCorrectionLevel = 'low' | 'medium' | 'quartile' | 'high' | 'L' | 'M' | 'Q' | 'H';

  export interface QrToDataUrlOptions {
    type?: 'image/png' | 'image/jpeg' | 'image/webp';
    errorCorrectionLevel?: QrErrorCorrectionLevel;
    margin?: number;
    scale?: number;
    width?: number;
    color?: {
      dark?: string;
      light?: string;
    };
  }

  export function toDataURL(text: string, options?: QrToDataUrlOptions): Promise<string>;

  const QRCode: {
    toDataURL: typeof toDataURL;
  };

  export default QRCode;
}
