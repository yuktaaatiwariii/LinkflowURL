import { Platform, ViewStyle } from 'react-native';

/**
 * LinkFlow URL — mobile landing design tokens.
 *
 * Scoped to the marketing/landing experience so the rest of the product
 * (dashboard, links, QR, profile) keeps its existing visual language.
 *
 * Phase 4 theme: monochrome. Only greys, white and structural borders.
 */
export const L = {
  // Backgrounds
  bg: '#181818',
  bgAlt: '#202020',
  card: '#262626',
  cardDeep: '#1E1E1E',
  surfaceSecondary: '#303030',

  // Monochrome accents
  primary: '#FFFFFF',
  gradient: '#E5E5E5',
  lavender: '#C4C4C4',

  // Text
  text: '#FFFFFF',
  textSecondary: '#C4C4C4',
  textMuted: '#999999',

  // Lines & surfaces (no blur, no translucency tricks beyond simple opacity)
  border: 'rgba(255, 255, 255, 0.12)',
  borderStrong: 'rgba(255, 255, 255, 0.26)',
  borderSoft: 'rgba(255, 255, 255, 0.07)',
  borderLight: 'rgba(255, 255, 255, 0.18)',
  glass: '#202020',
  overlay: 'rgba(0, 0, 0, 0.72)',
};

/** Two-stop gradients used across the landing page (monochrome only). */
export const G = {
  brand: ['#FFFFFF', '#E5E5E5'] as [string, string],
  brandSoft: ['#343434', '#1E1E1E'] as [string, string],
  cta: ['#FFFFFF', '#E5E5E5'] as [string, string],
  screen: ['#242424', '#1C1C1C'] as [string, string],
  tile: ['rgba(255, 255, 255, 0.08)', 'rgba(255, 255, 255, 0.02)'] as [string, string],
  heading: ['#FFFFFF', '#E5E5E5', '#C4C4C4'] as [string, string, string],
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

/** Neutral elevation used sparingly on floating preview cards. */
export function glow(color: string = '#000000', opacity = 0.35, radius = 18, offsetY = 8): ViewStyle {
  return {
    shadowColor: color,
    shadowOpacity: opacity,
    shadowRadius: radius,
    shadowOffset: { width: 0, height: offsetY },
    elevation: 8,
  };
}
