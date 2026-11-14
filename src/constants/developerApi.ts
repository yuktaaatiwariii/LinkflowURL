import type { DeveloperApiScope } from '../../server/types';

/**
 * Frontend mirror of the Phase 2 scope catalogue. Kept as display metadata;
 * the backend remains the source of truth and rejects unknown scopes.
 */
export interface ScopeOption {
  value: DeveloperApiScope;
  label: string;
  description: string;
  group: 'Links' | 'QR codes' | 'Analytics';
}

export const DEVELOPER_SCOPE_OPTIONS: ScopeOption[] = [
  {
    value: 'links:read',
    label: 'Read links',
    description: 'List and retrieve short links.',
    group: 'Links',
  },
  {
    value: 'links:write',
    label: 'Create links',
    description: 'Create new short links.',
    group: 'Links',
  },
  {
    value: 'links:delete',
    label: 'Delete links',
    description: 'Remove short links permanently.',
    group: 'Links',
  },
  {
    value: 'qr:read',
    label: 'Read QR codes',
    description: 'List and retrieve QR codes.',
    group: 'QR codes',
  },
  {
    value: 'qr:write',
    label: 'Create QR codes',
    description: 'Create QR codes, including images.',
    group: 'QR codes',
  },
  {
    value: 'qr:delete',
    label: 'Delete QR codes',
    description: 'Remove QR codes permanently.',
    group: 'QR codes',
  },
  {
    value: 'analytics:read',
    label: 'Read analytics',
    description: 'Read link, QR and aggregate analytics.',
    group: 'Analytics',
  },
];

export const DEVELOPER_ENVIRONMENTS = [
  {
    value: 'test' as const,
    label: 'Test',
    description: 'Safe for development and automated tests.',
  },
  {
    value: 'live' as const,
    label: 'Live',
    description: 'Production traffic. Treat the secret as sensitive.',
  },
];
