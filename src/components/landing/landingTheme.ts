import { Platform, ViewStyle } from 'react-native';

/**
 * LinkFlow URL — mobile landing design tokens.
 *
 * Scoped to the marketing/landing experience so the rest of the product
 * (dashboard, links, QR, profile) keeps its existing visual language.
 */
export const L = {
  // Backgrounds
  bg: '#0B0615',
  bgAlt: '#160D25',
  card: '#201532',
  cardDeep: '#180F28',

  // Purples
  primary: '#792CF0',
  gradient: '#9B4DFF',
  lavender: '#C4A8FF',

  // Text
  text: '#FFFFFF',
  textSecondary: '#C4B5E8',
  textMuted: '#9C8ABA',

  // Lines & glass
  border: 'rgba(153, 105, 255, 0.2)',
  borderStrong: 'rgba(153, 105, 255, 0.42)',
  borderSoft: 'rgba(196, 168, 255, 0.12)',
  glass: 'rgba(32, 21, 50, 0.78)',
  overlay: 'rgba(5, 3, 10, 0.72)',
};

/** Two-stop gradients used across the landing page. */
export const G = {
  brand: ['#A45CFF', '#6C1BDB'] as [string, string],
  brandSoft: ['#8B3CF7', '#4B139E'] as [string, string],
  cta: ['#7B2BF2', '#B07CFF'] as [string, string],
  screen: ['#2B1350', '#120A22'] as [string, string],
  tile: ['rgba(155, 77, 255, 0.34)', 'rgba(155, 77, 255, 0.05)'] as [string, string],
  heading: ['#F1E7FF', '#B072FF', '#792CF0'] as [string, string, string],
};

/**
 * Font stack that matches the platform default closely enough for the SVG
 * headline to sit inline with regular React Native text.
 */
export const SANS = Platform.select({
  web: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  ios: 'System',
  android: 'sans-serif',
  default: undefined,
});

/** Purple glow that degrades gracefully on Android (elevation). */
export function glow(color: string, opacity = 0.55, radius = 18, offsetY = 8): ViewStyle {
  return {
    shadowColor: color,
    shadowOpacity: opacity,
    shadowRadius: radius,
    shadowOffset: { width: 0, height: offsetY },
    elevation: 14,
  };
}
