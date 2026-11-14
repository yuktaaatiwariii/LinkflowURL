/**
 * Developer dashboard visual identity.
 *
 * Deliberately separate from the monochrome consumer dashboard: charcoal
 * surfaces, a violet primary accent and restrained borders. Importing this
 * module never affects the landing page or the normal `/` dashboard.
 */
export const DevColors = {
  background: '#0D0D12',
  backgroundAlt: '#111118',
  surface: '#16161F',
  surfaceRaised: '#1C1C27',
  surfaceHover: '#232331',
  border: '#2A2A38',
  borderStrong: '#3A3A4C',

  primary: '#8B5CF6',
  primarySoft: '#A78BFA',
  primaryDeep: '#6D28D9',
  primaryBg: 'rgba(139, 92, 246, 0.14)',
  primaryBorder: 'rgba(139, 92, 246, 0.42)',

  text: '#F7F5FF',
  textSecondary: '#B4B0C6',
  textMuted: '#7C7891',
  textOnPrimary: '#FFFFFF',

  success: '#34D399',
  successBg: 'rgba(52, 211, 153, 0.12)',
  successBorder: 'rgba(52, 211, 153, 0.34)',
  warning: '#FBBF24',
  warningBg: 'rgba(251, 191, 36, 0.12)',
  warningBorder: 'rgba(251, 191, 36, 0.34)',
  danger: '#F87171',
  dangerBg: 'rgba(248, 113, 113, 0.12)',
  dangerBorder: 'rgba(248, 113, 113, 0.34)',
  info: '#60A5FA',
  infoBg: 'rgba(96, 165, 250, 0.12)',
  infoBorder: 'rgba(96, 165, 250, 0.34)',
  neutralBg: 'rgba(148, 144, 170, 0.12)',
  neutralBorder: 'rgba(148, 144, 170, 0.28)',

  chartSuccess: '#34D399',
  chartFailed: '#F87171',
  chartPrimary: '#8B5CF6',
  chartGrid: '#262634',
} as const;

export const DevRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
} as const;

export const DevSpacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

/** Compact, deterministic date formatting used across the developer area. */
export function formatDevDate(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDevDay(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatCount(value: number): string {
  return new Intl.NumberFormat().format(value);
}

export function formatDuration(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '0 ms';
  if (value < 1000) return `${Math.round(value)} ms`;
  return `${(value / 1000).toFixed(2)} s`;
}
