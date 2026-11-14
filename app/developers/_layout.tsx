import React from 'react';
import { DocsShell } from '../../src/components/docs/DocsShell';

/**
 * Public developer documentation layout.
 *
 * These routes live outside `(auth)` and `(protected)`, so the global
 * NavigationGuard never redirects them and the portal is readable by anyone.
 */
export default function DevelopersLayout() {
  return <DocsShell />;
}
