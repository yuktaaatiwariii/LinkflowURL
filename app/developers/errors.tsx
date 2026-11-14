import React from 'react';
import { StyleSheet, Text } from 'react-native';
import {
  DocsPage,
  DocsSection,
  DocsP,
  DocsCallout,
  DocsBadge,
  DocsLink,
  DocsTable,
  DocsPager,
  DocsList,
} from '../../src/components/docs/DocsUI';
import { CodeBlock } from '../../src/components/docs/CodeBlock';
import { API_ERRORS } from '../../src/constants/apiReference';
import { DocsColors, DocsMonoFont } from '../../src/constants/docsTheme';

export default function ErrorsScreen() {
  return (
    <DocsPage
      eyebrow="Reference"
      title="Errors"
      description="Every error code the public API can return, verified against the server implementation, with the HTTP status and the handling each one deserves."
      badge={
        <>
          <DocsBadge label={`${API_ERRORS.length} codes`} tone="neutral" icon="list" />
          <DocsBadge label="Stable codes" tone="primary" icon="hash" />
          <DocsBadge label="No generic UNAUTHORIZED" tone="warning" icon="alert-triangle" />
        </>
      }
    >
      <DocsSection id="envelope" title="Error envelope">
        <DocsP>
          Every failure uses the same JSON shape. There is no <Text style={styles.mono}>data</Text>{' '}
          key on an error.
        </DocsP>
        <CodeBlock
          language="json"
          label="Error response"
          code={`{
  "success": false,
  "message": "This API key lacks the required scope: links:write.",
  "error": { "code": "INSUFFICIENT_SCOPE" }
}`}
        />
        <DocsP>
          Branch on <Text style={styles.mono}>error.code</Text>, not on{' '}
          <Text style={styles.mono}>message</Text>: messages are human-readable and may become
          more specific, while codes are stable identifiers.
        </DocsP>
      </DocsSection>

      <DocsSection id="catalog" title="Error catalog">
        <DocsTable
          columns={['Status', 'Code', 'Meaning', 'How to handle']}
          monoColumns={[1]}
          rows={API_ERRORS.map((entry) => [
            String(entry.status),
            entry.code,
            entry.meaning,
            entry.handling,
          ])}
        />
      </DocsSection>

      <DocsSection id="http-statuses" title="HTTP status meanings">
        <DocsTable
          columns={['Status', 'When it appears']}
          rows={[
            ['200', 'Successful read, update or delete.'],
            ['201', 'A link or QR code was created.'],
            ['400', 'Validation failure, malformed JSON, or a malformed resource id.'],
            ['401', 'Missing, invalid, revoked or expired API key.'],
            ['403', 'Valid key without the required scope, or the owning account no longer exists.'],
            ['404', 'Resource not found, not owned by this key, or not a public API path.'],
            ['405', 'The path exists but the method is not supported; read the Allow header.'],
            ['409', 'A custom alias is already in use.'],
            ['413', 'The JSON body exceeds the 64 KiB public API limit.'],
            ['500', 'Unexpected server failure.'],
            ['503', 'Server configuration problem: key hashing or persistence is unavailable.'],
          ]}
        />
      </DocsSection>

      <DocsSection id="auth-errors" title="Authentication and permission errors">
        <DocsCallout tone="info" title="UNAUTHORIZED and FORBIDDEN are not emitted by /api/v1">
          The public API never returns a generic{' '}
          <Text style={styles.mono}>UNAUTHORIZED</Text> or{' '}
          <Text style={styles.mono}>FORBIDDEN</Text> code. A 401 always carries{' '}
          <Text style={styles.mono}>MISSING_API_KEY</Text>,{' '}
          <Text style={styles.mono}>INVALID_API_KEY</Text>,{' '}
          <Text style={styles.mono}>API_KEY_REVOKED</Text> or{' '}
          <Text style={styles.mono}>API_KEY_EXPIRED</Text>. A 403 carries{' '}
          <Text style={styles.mono}>INSUFFICIENT_SCOPE</Text> or{' '}
          <Text style={styles.mono}>DEVELOPER_NOT_PROVISIONED</Text>.
        </DocsCallout>
        <DocsList
          items={[
            'Revoked and expired codes are revealed only after the secret verifies, so an unauthenticated caller cannot enumerate key state.',
            'A missing header is MISSING_API_KEY; a malformed or unknown key is INVALID_API_KEY.',
            'INSUFFICIENT_SCOPE includes the exact required scope in the message.',
            'DEVELOPER_NOT_PROVISIONED means the key authenticated but its owning LinkFlow account could not be loaded.',
          ]}
        />
      </DocsSection>

      <DocsSection id="not-found" title="404 is deliberately ambiguous">
        <DocsP>
          A resource that does not exist and a resource owned by another developer both return{' '}
          <Text style={styles.mono}>404 NOT_FOUND</Text>. This prevents an integration from
          probing whether an id exists in someone else&apos;s account. Do not retry a 404 and do
          not treat it as a permission bug.
        </DocsP>
        <CodeBlock
          language="json"
          label="404 NOT_FOUND"
          code={`{
  "success": false,
  "message": "Link not found.",
  "error": { "code": "NOT_FOUND" }
}`}
        />
      </DocsSection>

      <DocsSection id="retry" title="Retry strategy">
        <DocsTable
          columns={['Situation', 'Recommendation']}
          rows={[
            ['400 / 409 / 413', 'Fix the input. Retrying the same payload cannot succeed.'],
            ['401', 'Stop. Refresh or replace the key; do not loop.'],
            ['403', 'Stop. Change the key’s scopes or call a permitted endpoint.'],
            ['404', 'Do not retry. Verify the id and ownership.'],
            ['500', 'Retry idempotent requests with exponential backoff and jitter, capped at a few attempts.'],
            ['503', 'Back off longer; this is an operator configuration problem, not a transient load spike.'],
            ['Network error / timeout', 'Retry idempotent GETs with backoff. Treat an unknown outcome for POST as a possible success and reconcile by listing.'],
          ]}
        />
        <DocsP>
          The API has no idempotency-key header. A retried{' '}
          <Text style={styles.mono}>POST /api/v1/links</Text> with the same{' '}
          <Text style={styles.mono}>customAlias</Text> fails with{' '}
          <Text style={styles.mono}>409 ALIAS_TAKEN</Text> instead of silently duplicating the
          link, which you can use to detect a lost response. QR creation is deduplicated only
          within a five-second window for identical account, target URL and title.
        </DocsP>
      </DocsSection>

      <DocsSection id="payload-limits" title="Payload and size limits">
        <DocsP>
          The public API reads at most 64 KiB (65536 bytes) of JSON per request. A larger
          declared or streamed body fails with{' '}
          <Text style={styles.mono}>413 PAYLOAD_TOO_LARGE</Text>. QR images are generated from
          a URL, so no endpoint requires an upload.
        </DocsP>
      </DocsSection>

      <DocsSection id="next" title="Related">
        <DocsList
          items={[
            <>
              <DocsLink href="/developers/authentication">Authentication</DocsLink> — key
              lifecycle, scopes and rotation.
            </>,
            <>
              <DocsLink href="/developers/playground">API playground</DocsLink> — reproduce a
              failure against the real API.
            </>,
            <>
              <DocsLink href="/developers/changelog">Changelog</DocsLink> — current API version.
            </>,
          ]}
        />
      </DocsSection>

      <DocsPager
        previous={{ label: 'Analytics API', href: '/developers/api/analytics' }}
        next={{ label: 'Changelog', href: '/developers/changelog' }}
      />
    </DocsPage>
  );
}

const styles = StyleSheet.create({
  mono: { fontFamily: DocsMonoFont, color: DocsColors.primarySoft, fontSize: 12.5 },
});
