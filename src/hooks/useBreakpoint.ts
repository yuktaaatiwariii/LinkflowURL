import { useWindowDimensions } from 'react-native';

export type Breakpoint = 'sm' | 'md' | 'lg' | 'xl' | '2xl';

/**
 * Screen width breakpoints (in CSS pixels).
 * sm: 320-375 small mobile
 * md: 375-430 standard mobile
 * lg: 768 tablet
 * xl: 1024 small desktop
 * 2xl: 1280+ standard/large desktop
 */
const BREAKPOINTS: Record<Breakpoint, number> = {
  sm: 320,
  md: 375,
  lg: 768,
  xl: 1024,
  '2xl': 1280,
};

export function useBreakpoint(): Breakpoint {
  const { width } = useWindowDimensions();

  let current: Breakpoint = 'sm';
  for (const [key, value] of Object.entries(BREAKPOINTS)) {
    if (width >= value) {
      current = key as Breakpoint;
    }
  }
  return current;
}

export function useIsDesktop(): boolean {
  const { width } = useWindowDimensions();
  return width >= BREAKPOINTS.xl;
}

export function useIsTablet(): boolean {
  const { width } = useWindowDimensions();
  return width >= BREAKPOINTS.lg && width < BREAKPOINTS.xl;
}

export function useIsMobile(): boolean {
  const { width } = useWindowDimensions();
  return width < BREAKPOINTS.lg;
}

/**
 * Returns a centered max-width container width based on breakpoint.
 * Mobile: full width with padding. Desktop: bounded max-width.
 */
export function getContainerWidth(breakpoint: Breakpoint): number {
  switch (breakpoint) {
    case 'sm':
    case 'md':
      return 100; // percentage handled via width: '100%'
    case 'lg':
      return 700;
    case 'xl':
      return 960;
    case '2xl':
      return 1180;
    default:
      return 960;
  }
}

export default useBreakpoint;
