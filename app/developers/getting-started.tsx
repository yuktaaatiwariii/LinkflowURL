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
  DocsSteps,
  DocsStep,
  DocsPager,
  DocsList,
} from '../../src/components/docs/DocsUI';
import { CodeBlock } from '../../src/components/docs/CodeBlock';
import { CodeTabs } from '../../src/components/docs/CodeTabs';
import { API_SCOPES } from '../../src/constants/apiReference';
import { DocsColors, DocsMonoFont } from '../../src/constants/docsTheme';

const BASE = 'https://api.linkflowurl.com';

export default function GettingStartedScreen() {
  return (
    <DocsPage
      eyebrow="Guide"
      title="Getting started"
      description="From a brand-new account to a working first request. This walkthrough uses a test API key and the real production API; nothing here is simulated."
      badge={
        <>
          <DocsBadge label="~10 minutes" tone="neutral" icon="clock" />
          <DocsBadge label="Test key" tone="success" icon="shield" />
          <DocsBadge label="No SDK required" tone="info" icon="code" />
        </>
      }
    >
      <DocsSection id="what-is-linkflow" title="What the LinkFlow API is">
        <DocsP>
          LinkFlow is a URL shortener. The developer API lets your own backend create and
          manage short links and QR codes inside a LinkFlow account, then read the click
          analytics that LinkFlow records for those links.
        </DocsP>
        <DocsList
          items={[
            'REST over HTTPS with JSON request and response bodies.',
            'Authentication with an API key in the X-API-Key header — no OAuth flow.',
            'Scope-based permissions chosen when a key is created.',
            '11 endpoints covering links, QR codes and analytics.',
          ]}
        />
        <DocsCallout tone="info" title="The API is not a sandbox">
          Test and live keys use the same server and the same account data. A test key is
          for safe experimentation and scope testing, but the links it creates are real.
          Clean up test resources when you are done.
        </DocsCallout>
      </DocsSection>

      <DocsSection id="prerequisites" title="Prerequisites">
        <DocsTable
          columns={['Requirement', 'Why']}
          rows={[
            ['A LinkFlow account', 'Every key belongs to a user account and only sees that account’s data.'],
            ['A backend runtime', 'JavaScript fetch examples need Node.js 18+; Python examples need Python 3.8+ and requests.'],
            ['A secret store', 'The key must live in server-side environment variables or a secret manager, never in client code.'],
            ['Network access', 'The API is HTTPS-only. Browser clients additionally need their origin allowlisted by the LinkFlow operator.'],
          ]}
        />
        <DocsP>
          Install the Python example dependency with{' '}
          <Text style={styles.mono}>pip install requests</Text>. The JavaScript examples
          use the built-in <Text style={styles.mono}>fetch</Text>; no LinkFlow package is
          required or published.
        </DocsP>
      </DocsSection>

      <DocsSection id="create-account" title="1. Create a LinkFlow account">
        <DocsP>
          Sign up in the LinkFlow app. The account you create owns every link, QR code and
          API key you make. There is no separate developer signup and no organisation or
          team layer in this version.
        </DocsP>
        <DocsSteps>
          <DocsStep number={1} title="Sign up or sign in">
            <DocsP>
              Use the LinkFlow welcome screen. Email/password and the configured social
              provider are handled by Clerk, the same identity system the app uses.
            </DocsP>
          </DocsStep>
          <DocsStep number={2} title="Confirm you reach the dashboard">
            <DocsP>
              After authentication you land on the normal LinkFlow dashboard at{' '}
              <Text style={styles.mono}>/</Text>. The developer area is a separate section
              of the same account.
            </DocsP>
          </DocsStep>
        </DocsSteps>
      </DocsSection>

      <DocsSection id="developer-dashboard" title="2. Open the Developer Dashboard">
        <DocsP>
          Open <DocsLink href="/(protected)/developer">/developer</DocsLink>. The dashboard
          shows API usage, projects, keys, request logs and settings. Everything you need
          for this tutorial lives in the <Text style={styles.mono}>Projects</Text> and{' '}
          <Text style={styles.mono}>API keys</Text> screens.
        </DocsP>
        <DocsCallout tone="warning" title="Dashboard requires a signed-in session">
          The dashboard is protected by the normal LinkFlow login. The public API itself is
          not: it authenticates with an API key and never accepts a Clerk session token.
        </DocsCallout>
      </DocsSection>

      <DocsSection id="create-project" title="3. Create an API project">
        <DocsP>
          Projects group keys and usage. Open <Text style={styles.mono}>Projects</Text> in
          the developer sidebar and create one — for example{' '}
          <Text style={styles.mono}>website-integration</Text>. A key can also be created
          with a project name inline, in which case LinkFlow creates the project for you.
        </DocsP>
        <DocsList
          items={[
            'Project names are labels for your own organisation; they do not change API behaviour.',
            'Deleting a key does not delete the project, and vice versa.',
            'Usage and logs are attributed to the key that made the request.',
          ]}
        />
      </DocsSection>

      <DocsSection id="generate-test-key" title="4. Generate a test API key">
        <DocsSteps>
          <DocsStep number={1} title="Open API keys">
            <DocsP>
              Go to <DocsLink href="/(protected)/developer/keys">/developer/keys</DocsLink>{' '}
              and choose <Text style={styles.mono}>Create key</Text>.
            </DocsP>
          </DocsStep>
          <DocsStep number={2} title="Select the test environment">
            <DocsP>
              Choose <Text style={styles.mono}>test</Text>. Keys are prefixed{' '}
              <Text style={styles.mono}>lf_test_</Text> or{' '}
              <Text style={styles.mono}>lf_live_</Text> so you can recognise an environment
              at a glance.
            </DocsP>
          </DocsStep>
          <DocsStep number={3} title="Pick scopes">
            <DocsP>
              Select only what the integration needs. The next section lists every scope and
              the endpoints it unlocks.
            </DocsP>
          </DocsStep>
          <DocsStep number={4} title="Copy the key once">
            <DocsP>
              The full secret is shown exactly once, at creation or rotation. LinkFlow stores
              an HMAC hash and a non-secret prefix, so it cannot show the key again. Store it
              immediately in a server-side secret store.
            </DocsP>
          </DocsStep>
        </DocsSteps>
        <CodeBlock
          language="bash"
          label="Key format"
          code={`lf_<test|live>_<16 hex lookup prefix>_<43 base64url secret>

# example shape only — not a real key
lf_test_9f2c71a04b8de613_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX`}
          caption="The lookup prefix identifies the key record. Only the secret is verified, with HMAC-SHA256."
        />
      </DocsSection>

      <DocsSection id="select-scopes" title="5. Understand permission scopes">
        <DocsP>
          Scopes are checked per endpoint. A key with no scopes authenticates but every
          scoped call fails with <Text style={styles.mono}>INSUFFICIENT_SCOPE</Text>.
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
          Read the full explanation in{' '}
          <DocsLink href="/developers/authentication">Authentication</DocsLink>.
        </DocsP>
      </DocsSection>

      <DocsSection id="first-request" title="6. Make your first request">
        <DocsP>
          The first call lists the links already in your account. It needs the{' '}
          <Text style={styles.mono}>links:read</Text> scope. Export the key in your shell
          or backend environment first.
        </DocsP>
        <CodeTabs
          tabs={[
            {
              label: 'cURL',
              language: 'bash',
              code: `export LINKFLOW_API_KEY="lf_test_..."

curl -X GET '${BASE}/api/v1/links?limit=10&offset=0' \\
  -H "X-API-Key: $LINKFLOW_API_KEY"`,
            },
            {
              label: 'JavaScript',
              language: 'javascript',
              code: `const apiKey = process.env.LINKFLOW_API_KEY;
if (!apiKey) throw new Error("Set LINKFLOW_API_KEY on the server.");

const response = await fetch(
  "${BASE}/api/v1/links?limit=10&offset=0",
  { headers: { "X-API-Key": apiKey } }
);

const payload = await response.json();
if (!response.ok) {
  throw new Error(\`\${payload.error.code}: \${payload.message}\`);
}
console.log(payload.data.links);`,
            },
            {
              label: 'Node.js',
              language: 'javascript',
              code: `// Node.js 18+
const apiKey = process.env.LINKFLOW_API_KEY;

const response = await fetch(
  "${BASE}/api/v1/links?limit=10&offset=0",
  { headers: { "X-API-Key": apiKey } }
);

console.log(response.status);
console.log(await response.json());`,
            },
            {
              label: 'Python',
              language: 'python',
              code: `import os
import requests

response = requests.get(
    "${BASE}/api/v1/links",
    params={"limit": 10, "offset": 0},
    headers={"X-API-Key": os.environ["LINKFLOW_API_KEY"]},
    timeout=30,
)

print(response.status_code)
print(response.json())`,
            },
          ]}
        />
        <DocsCallout tone="danger" title="Never ship this key in a client">
          The header contains a full credential. Browser JavaScript, React components, mobile
          binaries and public repositories are all readable by users. Proxy through your own
          backend instead.
        </DocsCallout>
      </DocsSection>

      <DocsSection id="interpret-response" title="7. Interpret the response">
        <CodeBlock
          language="json"
          label="200 OK"
          code={`{
  "success": true,
  "message": "Links retrieved successfully",
  "data": {
    "links": [
      {
        "id": "0e7c3a9e-2f4b-4a1f-9c55-1f0e6f6f3d21",
        "originalUrl": "https://example.com/launch",
        "shortUrl": "${BASE}/launch",
        "shortCode": "launch",
        "customAlias": "launch",
        "title": "Launch page",
        "isActive": true,
        "expiresAt": null,
        "clicks": 42,
        "createdAt": "2026-11-01T09:12:45.000Z",
        "updatedAt": "2026-11-01T09:12:45.000Z"
      }
    ],
    "total": 1,
    "limit": 10,
    "offset": 0
  }
}`}
        />
        <DocsTable
          columns={['Field', 'Meaning']}
          monoColumns={[0]}
          rows={[
            ['success', 'true for every 2xx response. Use response.ok as well.'],
            ['message', 'Human-readable summary; safe to log, not safe to branch on.'],
            ['data', 'Endpoint-specific payload.'],
            ['total', 'Full number of links in the account, not the page size.'],
            ['limit / offset', 'The pagination values the server actually applied.'],
            ['clicks', 'All-time redirect count for that link. Not unique visitors.'],
          ]}
        />
        <DocsP>
          On a failure the shape changes: <Text style={styles.mono}>success</Text> is false,
          there is no <Text style={styles.mono}>data</Text>, and{' '}
          <Text style={styles.mono}>error.code</Text> is the stable identifier. See the{' '}
          <DocsLink href="/developers/errors">error reference</DocsLink>.
        </DocsP>
      </DocsSection>

      <DocsSection id="testing-to-production" title="8. Move from testing to production">
        <DocsSteps>
          <DocsStep number={1} title="Verify scopes and error handling">
            <DocsP>
              Exercise every endpoint you plan to use, including 401, 403 and 400 paths. Test
              what your integration does when a key is revoked.
            </DocsP>
          </DocsStep>
          <DocsStep number={2} title="Create a live key">
            <DocsP>
              In <Text style={styles.mono}>/developer/keys</Text>, create a key in the{' '}
              <Text style={styles.mono}>live</Text> environment with the same minimal scope
              set. Live keys see the same account data as test keys, so treat them as
              production credentials from the moment they exist.
            </DocsP>
          </DocsStep>
          <DocsStep number={3} title="Store the secret server-side">
            <DocsP>
              Put it in your hosting provider&apos;s secret manager or an environment
              variable named something like <Text style={styles.mono}>LINKFLOW_API_KEY</Text>.
              Restrict who can read it and never print it in logs.
            </DocsP>
          </DocsStep>
          <DocsStep number={4} title="Allow the browser origin, if relevant">
            <DocsP>
              Server-to-server calls need no CORS setup. If a browser calls the API directly,
              the LinkFlow operator must include your origin in{' '}
              <Text style={styles.mono}>CORS_ALLOWED_ORIGINS</Text>. This is a server
              configuration, not a header your client can set.
            </DocsP>
          </DocsStep>
          <DocsStep number={5} title="Plan rotation">
            <DocsP>
              Rotate on a schedule and after any suspected exposure. Rotation issues a new
              secret and revokes the old one; deploy the new value before the old key is
              removed if your platform supports overlapping secrets.
            </DocsP>
          </DocsStep>
        </DocsSteps>
        <DocsCallout tone="warning" title="No environment isolation">
          There is one dataset per account. A live key and a test key can read and modify the
          same links. Use separate accounts if you need strict separation between
          experiments and production data.
        </DocsCallout>
      </DocsSection>

      <DocsSection id="next-steps" title="Next steps">
        <DocsList
          items={[
            <>
              <DocsLink href="/developers/authentication">Authentication</DocsLink> — key
              lifecycle, scopes and rotation.
            </>,
            <>
              <DocsLink href="/developers/api/links">Links API</DocsLink> — pagination,
              aliases and validation.
            </>,
            <>
              <DocsLink href="/developers/api/qr">QR API</DocsLink> — image options and the
              scan-analytics limitation.
            </>,
            <>
              <DocsLink href="/developers/playground">API playground</DocsLink> — send real
              requests without writing code.
            </>,
          ]}
        />
      </DocsSection>

      <DocsPager
        previous={{ label: 'Introduction', href: '/developers' }}
        next={{ label: 'Authentication', href: '/developers/authentication' }}
      />
    </DocsPage>
  );
}

const styles = StyleSheet.create({
  mono: { fontFamily: DocsMonoFont, color: DocsColors.primarySoft, fontSize: 12.5 },
});
