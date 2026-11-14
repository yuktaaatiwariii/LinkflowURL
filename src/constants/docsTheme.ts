/**
 * Developer Documentation Portal visual identity.
 *
 * Charcoal (not pitch black) surfaces with the LinkFlow violet accent. This
 * theme is used only by `/developers`; the landing page and the consumer
 * dashboard keep their existing colours.
 */
export const DocsColors = {
  background: '#111014',
  backgroundAlt: '#15131B',
  surface: '#191721',
  surfaceRaised: '#201D2A',
  surfaceHover: '#262230',
  border: '#2C2838',
  borderStrong: '#3B3649',

  primary: '#8B5CF6',
  primarySoft: '#A78BFA',
  primaryDeep: '#6D28D9',
  primaryBg: 'rgba(139, 92, 246, 0.14)',
  primaryBorder: 'rgba(139, 92, 246, 0.40)',

  text: '#F5F3FF',
  textSecondary: '#B8B3C9',
  textMuted: '#837D96',
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

  codeBackground: '#0C0B10',
  codeHeader: '#16131D',
  codeBorder: '#2C2838',
  codeText: '#E7E3F2',

  tokenKey: '#C4B5FD',
  tokenString: '#6EE7B7',
  tokenNumber: '#FCA5A5',
  tokenKeyword: '#93C5FD',
  tokenComment: '#6B7280',
  tokenPunctuation: '#9CA3AF',
  tokenFunction: '#FCD34D',
  tokenUrl: '#A78BFA',
  tokenFlag: '#FDBA74',
} as const;

export const DocsRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 22,
} as const;

export const DocsSpacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const DocsMonoFont =
  'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace';

export const DOCS_SIDEBAR_WIDTH = 272;
export const DOCS_TOC_WIDTH = 224;
export const DOCS_CONTENT_MAX_WIDTH = 900;
export const DOCS_SHELL_MAX_WIDTH = 1440;

export function formatDocsDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}
