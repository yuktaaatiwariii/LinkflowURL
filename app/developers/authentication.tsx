import React from 'react';
import { StyleSheet, Text } from 'react-native';
import {
  DocsPage,
  DocsSection,
  DocsP,
  DocsH3,
  DocsCallout,
  DocsBadge,
  DocsLink,
  DocsTable,
  DocsPager,
  DocsList,
} from '../../src/components/docs/DocsUI';
import { CodeBlock } from '../../src/components/docs/CodeBlock';
import { API_ERRORS, API_SCOPES } from '../../src/constants/apiReference';
import { DocsColors, DocsMonoFont } from '../../src/constants/docsTheme';

const BASE = 'https://api.linkflowurl.com';

const AUTH_ERROR_CODES = [
  'MISSING_API_KEY',
  'INVALID_API_KEY',
  'API_KEY_REVOKED',
  'API_KEY_EXPIRED',
  'INSUFFICIENT_SCOPE',
  'DEVELOPER_NOT_PROVISIONED',
];

export default function AuthenticationScreen() {
  const authErrors = API_ERRORS.filter((entry) => AUTH_ERROR_CODES.includes(entry.code));

  return (
    <DocsPage
      eyebrow="Guide"
      title="Authentication"
      description="LinkFlow uses API keys, not OAuth. Every request proves ownership with an X-API-Key header, and the key's scopes decide which endpoints it may call."
      badge={
        <>
          <DocsBadge label="Header auth" tone="primary" icon="key" />
          <DocsBadge label="Test + live" tone="neutral" icon="slash" />
          <DocsBadge label="Scope-based" tone="info" icon="shield" />
        </>
      }
    >
      <DocsSection id="how-it-works" title="How API key authentication works">
        <DocsP>
          Generate a key in the LinkFlow Developer Dashboard. For each request, send the full
          key in the <Text style={styles.mono}>X-API-Key</Text> header. The server finds the
          key record by its non-secret lookup prefix, verifies the secret with HMAC-SHA256,
          then checks status, expiry and scope before the handler runs.
        </DocsP>
        <CodeBlock
          language="bash"
          label="Request header"
          code={`curl -X GET ${BASE}/api/v1/links \\
  -H "X-API-Key: $LINKFLOW_API_KEY"`}
        />
        <DocsP>
          API keys are independent of the Clerk session used by the LinkFlow app. A browser
          session token cannot call <Text style={styles.mono}>/api/v1/*</Text>, and an API key
          cannot call the app&apos;s user endpoints.
        </DocsP>
        <DocsCallout tone="info" title="No query-string keys">
          The key is read only from the header. Do not put it in a URL, because URLs end up in
          logs, browser history and referrer headers.
        </DocsCallout>
      </DocsSection>

      <DocsSection id="key-format" title="Key format">
        <CodeBlock
          language="text"
          label="Format"
          code={`lf_<environment>_<lookup-prefix>_<secret>

environment     test | live
lookup-prefix   16 hex characters (64 bits), not secret
secret          32 random bytes encoded as base64url (43 characters)`}
        />
        <DocsP>
          The prefix lets the server locate the record without scanning every key. It cannot
          authenticate on its own, and it is the only part of the key shown in the dashboard
          after creation.
        </DocsP>
      </DocsSection>

      <DocsSection id="test-vs-live" title="Test keys vs live keys">
        <DocsTable
          columns={['Aspect', 'Test key', 'Live key']}
          rows={[
            ['Prefix', 'lf_test_', 'lf_live_'],
            ['Purpose', 'Development and scope experiments', 'Production traffic'],
            ['Server behaviour', 'Identical', 'Identical'],
            ['Data visibility', 'Same account data', 'Same account data'],
            ['Billing impact', 'None', 'None — the API has no billing in this version'],
          ]}
        />
        <DocsCallout tone="warning" title="There is no isolated sandbox database">
          The environment label is carried on the key and reported by management endpoints,
          but public endpoints behave the same for both. Test links and QR codes are real rows
          in your account. Use a separate LinkFlow account if you need hard separation.
        </DocsCallout>
      </DocsSection>

      <DocsSection id="generate-key" title="Generate a key">
        <DocsList
          ordered
          items={[
            <>
              Sign in and open{' '}
              <DocsLink href="/(protected)/developer/keys">/developer/keys</DocsLink>.
            </>,
            'Choose Create key, then select the environment and the smallest set of scopes that works.',
            'Optionally set an expiration date. A key with no expiry stays valid until revoked or rotated.',
            'Copy the returned secret immediately. It is shown once and cannot be recovered.',
          ]}
        />
        <CodeBlock
          language="json"
          label="Create response (shape)"
          code={`{
  "success": true,
  "message": "API key created successfully",
  "data": {
    "apiKey": {
      "id": "…",
      "projectName": "website-integration",
      "keyPrefix": "lf_test_9f2c71a04b8de613",
      "environment": "test",
      "scopes": ["links:read"],
      "status": "active",
      "expiresAt": null,
      "createdAt": "2026-11-14T10:00:00.000Z"
    },
    "secret": "lf_test_9f2c71a04b8de613_…"
  }
}`}
          caption="Management routes are called by the dashboard with a signed-in session. External integrations never call them with an API key."
        />
      </DocsSection>

      <DocsSection id="scopes" title="Permission scopes">
        <DocsP>
          Scopes are stored on the key and enforced by the server. They are never read from
          the request body, so a caller cannot escalate by adding a field.
        </DocsP>
        <DocsTable
          columns={['Scope', 'Grants', 'Endpoints']}
          monoColumns={[0, 2]}
          rows={API_SCOPES.map((scope) => [
            scope.id,
            scope.description,
            scope.endpoints.join('\n'),
          ])}
        />
        <DocsP>
          Analytics endpoints require <Text style={styles.mono}>analytics:read</Text> even
          when they are rooted under <Text style={styles.mono}>/links/:id</Text> or{' '}
          <Text style={styles.mono}>/qr/:id</Text>. A key with only{' '}
          <Text style={styles.mono}>links:read</Text> can retrieve a link but not its click
          series.
        </DocsP>
        <DocsCallout tone="warning" title="A missing scope is 403, not 401">
          Scope failures return <Text style={styles.mono}>403 INSUFFICIENT_SCOPE</Text> and
          include the required scope in the message. The key is valid; the permission is not.
        </DocsCallout>
      </DocsSection>

      <DocsSection id="expiry" title="Key expiration">
        <DocsP>
          An expiration timestamp is optional. When it passes, requests fail with{' '}
          <Text style={styles.mono}>401 API_KEY_EXPIRED</Text>. Expired keys are not deleted
          automatically; the dashboard still lists them so you can see what happened.
        </DocsP>
        <CodeBlock
          language="json"
          label="Expired key"
          code={`{
  "success": false,
  "message": "This API key has expired.",
  "error": { "code": "API_KEY_EXPIRED" }
}`}
        />
        <DocsP>
          Expiry is enforced only after the secret verifies, so an unauthenticated caller
          cannot probe whether a key exists or has expired.
        </DocsP>
      </DocsSection>

      <DocsSection id="revocation" title="Revocation">
        <DocsP>
          Revoking a key immediately stops authentication. Requests fail with{' '}
          <Text style={styles.mono}>401 API_KEY_REVOKED</Text>. Revocation is intended for
          lost, leaked or retired credentials; it cannot be undone.
        </DocsP>
        <DocsCallout tone="danger" title="Revoke first, investigate second">
          If a key may have leaked, revoke it before reviewing logs. A revoked key cannot be
          used even if an attacker already copied it.
        </DocsCallout>
      </DocsSection>

      <DocsSection id="rotation" title="Rotation">
        <DocsP>
          Rotation replaces the key material while keeping the same key record and scope set.
          The new secret is returned once; the old secret stops working when the rotation is
          applied.
        </DocsP>
        <DocsList
          ordered
          items={[
            'Create the replacement value in your secret manager before rotating if your deployment supports overlapping credentials.',
            'Rotate the key in the dashboard and copy the new secret immediately.',
            'Deploy the new value, then confirm production traffic succeeds.',
            'Watch for 401 responses during the transition; they usually mean one instance still has the old secret.',
          ]}
        />
        <DocsP>
          Rotation is available on the key&apos;s row in{' '}
          <Text style={styles.mono}>/developer/keys</Text> and records which key it came from.
        </DocsP>
      </DocsSection>

      <DocsSection id="authentication-errors" title="Authentication errors">
        <DocsTable
          columns={['Status', 'Code', 'Meaning']}
          monoColumns={[1]}
          rows={authErrors.map((entry) => [
            String(entry.status),
            entry.code,
            entry.meaning,
          ])}
        />
        <DocsCallout tone="info" title="UNAUTHORIZED and FORBIDDEN are not emitted here">
          The public API does not return the generic codes{' '}
          <Text style={styles.mono}>UNAUTHORIZED</Text> or{' '}
          <Text style={styles.mono}>FORBIDDEN</Text>. A 401 always carries one of{' '}
          <Text style={styles.mono}>MISSING_API_KEY</Text>,{' '}
          <Text style={styles.mono}>INVALID_API_KEY</Text>,{' '}
          <Text style={styles.mono}>API_KEY_REVOKED</Text> or{' '}
          <Text style={styles.mono}>API_KEY_EXPIRED</Text>. A 403 carries{' '}
          <Text style={styles.mono}>INSUFFICIENT_SCOPE</Text> or{' '}
          <Text style={styles.mono}>DEVELOPER_NOT_PROVISIONED</Text>.
        </DocsCallout>
      </DocsSection>

      <DocsSection id="security" title="Keep keys secret">
        <DocsCallout tone="danger" title="Never expose a key in client code">
          Anyone who can read the client can read the key. Do not embed API keys in React
          components, browser JavaScript bundles, public GitHub repositories, mobile
          application binaries, or client-side environment variables such as{' '}
          <Text style={styles.mono}>EXPO_PUBLIC_*</Text> /{' '}
          <Text style={styles.mono}>NEXT_PUBLIC_*</Text>.
        </DocsCallout>
        <DocsTable
          columns={['Unsafe location', 'Why it leaks']}
          rows={[
            ['React frontend code', 'Bundled into JavaScript served to every visitor.'],
            ['Browser JavaScript', 'Readable in DevTools and the network tab.'],
            ['Public GitHub repository', 'Indexed by scanners within minutes; history keeps old values.'],
            ['Mobile application binary', 'Can be extracted from the IPA/APK; “obfuscation” does not help.'],
            ['Client-side env variables', 'EXPO_PUBLIC_* / NEXT_PUBLIC_* values are compiled into the client.'],
            ['Logs and analytics', 'Request headers and error payloads are often shipped to third parties.'],
          ]}
        />
        <DocsH3>Practical recommendations</DocsH3>
        <DocsList
          items={[
            'Call the API from your server, then expose a narrow endpoint to your clients.',
            'Store keys in a secret manager or server environment; restrict who can read them.',
            'Use one key per integration so a leak is contained and revocable in isolation.',
            'Grant the minimum scopes: do not give links:delete to a read-only dashboard.',
            'Set an expiry for temporary integrations.',
            'Never log the X-API-Key header. If you must log a reference, log the key prefix instead.',
            'Rotate after any suspected exposure and revoke the old key.',
            'Keep separate keys for local development and production.',
          ]}
        />
      </DocsSection>

      <DocsSection id="cors" title="Browser access and CORS">
        <DocsP>
          Native apps, curl and server-to-server calls do not send an Origin header and need
          no extra setup. Browser requests are subject to CORS: the LinkFlow server only
          returns an <Text style={styles.mono}>Access-Control-Allow-Origin</Text> header for
          origins on its allowlist.
        </DocsP>
        <CodeBlock
          language="bash"
          label="Server configuration"
          code={`CORS_ALLOWED_ORIGINS=https://app.example.com,https://admin.example.com
PUBLIC_APP_ORIGIN=https://app.example.com`}
          caption="Set by the LinkFlow operator. API callers cannot opt themselves in. Development builds also allow the local Expo web ports."
        />
        <DocsCallout tone="warning" title="A browser key is a public key">
          Allowlisting an origin does not make a key safe. A browser must not hold a key at
          all; keep credentials on your server and proxy requests through it.
        </DocsCallout>
      </DocsSection>

      <DocsSection id="next" title="Next">
        <DocsList
          items={[
            <>
              <DocsLink href="/developers/api/links">Links API reference</DocsLink>
            </>,
            <>
              <DocsLink href="/developers/errors">Error reference</DocsLink>
            </>,
            <>
              <DocsLink href="/developers/playground">Try a key in the playground</DocsLink>
            </>,
          ]}
        />
      </DocsSection>

      <DocsPager
        previous={{ label: 'Getting started', href: '/developers/getting-started' }}
        next={{ label: 'Links API', href: '/developers/api/links' }}
      />
    </DocsPage>
  );
}

const styles = StyleSheet.create({
  mono: { fontFamily: DocsMonoFont, color: DocsColors.primarySoft, fontSize: 12.5 },
});
