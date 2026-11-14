import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  DocsPage,
  DocsSection,
  DocsP,
  DocsH3,
  DocsCallout,
  DocsBadge,
  DocsPager,
} from '../../src/components/docs/DocsUI';
import { API_REFERENCE } from '../../src/constants/apiReference';
import { DocsColors, DocsMonoFont, DocsSpacing } from '../../src/constants/docsTheme';

function ChangeGroup({
  label,
  tone,
  items,
}: {
  label: string;
  tone: 'success' | 'info' | 'warning' | 'danger';
  items: string[];
}) {
  if (items.length === 0) return null;
  return (
    <View style={styles.group}>
      <DocsBadge label={label} tone={tone} />
      <View style={styles.groupItems}>
        {items.map((item) => (
          <View key={item} style={styles.itemRow}>
            <Text style={styles.bullet}>•</Text>
            <Text style={styles.itemText}>{item}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

export default function ChangelogScreen() {
  return (
    <DocsPage
      eyebrow="Reference"
      title="API changelog"
      description="A public record of every released version of the LinkFlow API. Only versions that exist in the shipped server are listed; there are no invented historical releases."
      badge={
        <>
          <DocsBadge label={`Current v${API_REFERENCE.meta.version}`} tone="success" icon="check-circle" />
          <DocsBadge label="No earlier releases" tone="neutral" icon="archive" />
        </>
      }
    >
      <DocsSection id="current" title={`v${API_REFERENCE.meta.version} — initial public release`}>
        <View style={styles.releaseHeader}>
          <View style={styles.versionChip}>
            <Text style={styles.versionChipLabel}>v{API_REFERENCE.meta.version}</Text>
          </View>
          <Text style={styles.releaseDate}>Released 14 Nov 2026</Text>
          <View style={{ flex: 1 }} />
          <DocsBadge label="Current" tone="success" icon="radio" />
        </View>
        <DocsP>
          The first public version of the LinkFlow Developer API. It exposes the existing
          link, QR and click-analytics functionality of the LinkFlow app; it does not add new
          tracking or new database concepts.
        </DocsP>

        <ChangeGroup
          label="Added"
          tone="success"
          items={[
            'API key authentication with the X-API-Key header, HMAC-hashed secrets and per-key scopes.',
            'Links API: GET/POST /api/v1/links, GET/DELETE /api/v1/links/:id with offset pagination.',
            'QR API: GET/POST /api/v1/qr, GET/DELETE /api/v1/qr/:id with PNG data-URI rendering and per-request image options.',
            'Analytics API: GET /api/v1/analytics/overview, GET /api/v1/links/:id/analytics, GET /api/v1/qr/:id/analytics.',
            'Test and live key environments, expiry, revocation and rotation in the Developer Dashboard.',
            'OpenAPI 3.1 document at /api/openapi.json and an importable Postman v2.1 collection and environment.',
            'This documentation portal, including an interactive playground that calls the real API.',
          ]}
        />

        <ChangeGroup
          label="Improvements"
          tone="info"
          items={[
            'Consistent success and error envelopes across every public endpoint.',
            'Bounded JSON body reader (64 KiB) and strict DTO validation for URLs, aliases, titles, ids, pagination and day ranges.',
            'Origin-allowlisted CORS so browser access is opt-in per deployment while native and server clients are unaffected.',
            'Zero-filled UTC daily click series, so charting clients receive a stable number of points.',
          ]}
        />

        <ChangeGroup
          label="Bug fixes"
          tone="warning"
          items={[
            'None recorded for this version.',
          ]}
        />

        <ChangeGroup
          label="Breaking changes"
          tone="danger"
          items={[
            'None. This is the first public API version.',
          ]}
        />

        <DocsCallout tone="info" title="Versioning policy">
          The public surface is versioned in the path (<Text style={styles.mono}>/api/v1</Text>).
          Additive changes — new optional fields, new endpoints, new error codes — may ship
          within v1. Removing a field, changing a type, or changing an existing status code
          requires a new path version and will be listed here as a breaking change.
        </DocsCallout>
      </DocsSection>

      <DocsSection id="documentation" title="Documentation and artifacts">
        <DocsH3>Generated from one catalog</DocsH3>
        <DocsP>
          The reference pages, playground, OpenAPI document and Postman files are all built
          from the same endpoint catalog transcribed from the server controllers and DTOs.
          Regenerate the machine-readable artifacts after any API change:
        </DocsP>
        <View style={styles.codeLine}>
          <Text style={styles.codeText} selectable>
            npm run docs:generate
          </Text>
        </View>
        <DocsH3>Where to download</DocsH3>
        <DocsP>
          <Text style={styles.mono}>GET /api/openapi.json</Text>,{' '}
          <Text style={styles.mono}>GET /api/postman/collection.json</Text> and{' '}
          <Text style={styles.mono}>GET /api/postman/environment.json</Text>. The same files
          are served as static assets at <Text style={styles.mono}>/openapi.json</Text> etc. on
          the documentation host.
        </DocsP>
      </DocsSection>

      <DocsSection id="known-limitations" title="Known limitations at v1.0.0">
        <DocsP>
          These are product limits, not regressions. They are documented so integrators do not
          build against capabilities that do not exist.
        </DocsP>
        <View style={styles.groupItems}>
          {[
            'QR scans are not tracked; QR analytics only expose a linked short link’s clicks.',
            'QR image customisation is not persisted, and images are returned as data URIs.',
            'Links cannot be created with an expiry through the API, and there is no update endpoint for links or QR metadata.',
            'No unique-visitor, referrer, device or geographic analytics.',
            'No billing, webhooks, SDK packages or idempotency keys.',
            'Test and live keys share the same account data; there is no isolated sandbox.',
          ].map((item) => (
            <View key={item} style={styles.itemRow}>
              <Text style={styles.bullet}>•</Text>
              <Text style={styles.itemText}>{item}</Text>
            </View>
          ))}
        </View>
      </DocsSection>

      <DocsPager
        previous={{ label: 'Errors', href: '/developers/errors' }}
        next={{ label: 'API playground', href: '/developers/playground' }}
      />
    </DocsPage>
  );
}

const styles = StyleSheet.create({
  releaseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: DocsSpacing.sm,
    marginBottom: DocsSpacing.md,
  },
  versionChip: {
    borderWidth: 1,
    borderColor: DocsColors.primaryBorder,
    backgroundColor: DocsColors.primaryBg,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  versionChipLabel: {
    color: DocsColors.primarySoft,
    fontSize: 12,
    fontWeight: '800',
    fontFamily: DocsMonoFont,
  },
  releaseDate: { color: DocsColors.textMuted, fontSize: 11.5, fontWeight: '600' },
  group: { gap: 9, marginBottom: DocsSpacing.xl },
  groupItems: { gap: 7, marginTop: 6 },
  itemRow: { flexDirection: 'row', gap: 9, alignItems: 'flex-start' },
  bullet: { color: DocsColors.primarySoft, fontSize: 13, lineHeight: 21, fontWeight: '700' },
  itemText: { flex: 1, color: DocsColors.textSecondary, fontSize: 13, lineHeight: 21 },
  codeLine: {
    borderWidth: 1,
    borderColor: DocsColors.codeBorder,
    backgroundColor: DocsColors.codeBackground,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginVertical: DocsSpacing.sm,
  },
  codeText: { color: DocsColors.codeText, fontFamily: DocsMonoFont, fontSize: 12.5 },
  mono: { fontFamily: DocsMonoFont, color: DocsColors.primarySoft, fontSize: 12.5 },
});
