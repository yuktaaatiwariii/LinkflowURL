declare module 'qrcode' {
  export function toDataURL(
    text: string,
    options?: {
      type?: 'svg' | 'png';
      width?: number;
      margin?: number;
      color?: { dark: string; light: string };
    }
  ): Promise<string>;

  export function toString(
    text: string,
    options?: {
      type?: 'svg';
      width?: number;
      margin?: number;
      color?: { dark: string; light: string };
    }
  ): Promise<string>;
}
