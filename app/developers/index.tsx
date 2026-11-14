import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { DocsPage, DocsSection, DocsP, DocsH3, DocsCallout, DocsBadge, DocsLink, DocsTable, DocsFeatureCard, DocsButton, DocsPager, methodTone, DocsList } from '../../src/components/docs/DocsUI';
import { CodeBlock } from '../../src/components/docs/CodeBlock';
import { API_REFERENCE } from '../../src/constants/apiReference';
import { DocsColors, DocsMonoFont, DocsSpacing } from '../../src/constants/docsTheme';

const CATEGORY_PAGE: Record<string, string> = {
  links: '/developers/api/links',
  qr: '/developers/api/qr',
  analytics: '/developers/api/analytics',
};

export default function DevelopersHomeScreen() {
  const router = useRouter();
  const { meta, endpoints } = API_REFERENCE;

  return (
    <DocsPage
      eyebrow="Developer platform"
      title="LinkFlow API"
      description="Create short links and QR codes, then read the click analytics LinkFlow actually records. One REST API, authenticated with an API key, with an interactive playground and machine-readable specifications."
      badge={
        <>
          <DocsBadge label={`API ${meta.apiVersion}`} tone="primary" icon="server" />
          <DocsBadge label={`${endpoints.length} endpoints`} tone="neutral" icon="list" />
          <DocsBadge label="OpenAPI 3.1" tone="info" icon="file-text" />
          <DocsBadge label="Postman ready" tone="success" icon="download" />
        </>
      }
    >
      <DocsSection id="overview" title="What you can build">
        <DocsP>
          The LinkFlow API exposes the same link, QR and analytics data the LinkFlow app
          uses. There is no separate sandbox database: a test key and a live key both act
          on your account, so create and clean up data deliberately.
        </DocsP>
        <View style={styles.cards}>
          <DocsFeatureCard
            icon="link"
            title="Short links"
            description="Create, list, retrieve and delete short links. Custom aliases are globally unique Base62 codes."
            href="/developers/api/links"
          />
          <DocsFeatureCard
            icon="grid"
            title="QR codes"
            description="Render PNG QR codes as data URIs for a URL or an owned short link, and manage QR metadata."
            href="/developers/api/qr"
          />
          <DocsFeatureCard
            icon="bar-chart-2"
            title="Click analytics"
            description="Read per-link click series and account totals with zero-filled UTC days. QR scans are not tracked."
            href="/developers/api/analytics"
          />
        </View>
      </DocsSection>

      <DocsSection id="base-url" title="Base URL and response envelope">
        <DocsP>
          All endpoints are rooted at <Text style={styles.mono}>{meta.baseUrl}</Text> and
          versioned under <Text style={styles.mono}>/{meta.apiVersion}</Text>. Every
          response is JSON, and every response uses the same envelope.
        </DocsP>
        <DocsTable
          columns={['Setting', 'Value']}
          monoColumns={[1]}
          rows={[
            ['Base URL', meta.baseUrl],
            ['API version', meta.apiVersion],
            ['Authentication', `${meta.authHeader} request header`],
            ['Content type', 'application/json; charset=utf-8'],
            ['Key environments', meta.keyEnvironments.join(' and ')],
          ]}
        />
        <DocsH3>Success</DocsH3>
        <CodeBlock
          language="json"
          label="200 / 201 response"
          code={`{
  "success": true,
  "message": "Links retrieved successfully",
  "data": { }
}`}
        />
        <DocsH3>Error</DocsH3>
        <CodeBlock
          language="json"
          label="4xx / 5xx response"
          code={`{
  "success": false,
  "message": "This API key lacks the required scope: links:write.",
  "error": { "code": "INSUFFICIENT_SCOPE" }
}`}
        />
        <DocsP>
          Branch on <Text style={styles.mono}>response.ok</Text>, then read{' '}
          <Text style={styles.mono}>error.code</Text>. Messages are human-readable and may
          become more specific; codes are stable identifiers.
        </DocsP>
      </DocsSection>

      <DocsSection id="endpoints" title="Endpoint overview">
        <DocsP>
          Every endpoint below is implemented by the LinkFlow server. Required scopes are
          enforced from the authenticated key, never from the request body.
        </DocsP>
        <DocsTable
          columns={['Method', 'Path', 'Scope', 'Description']}
          monoColumns={[1, 2]}
          rows={endpoints.map((endpoint) => [
            <DocsBadge
              key={endpoint.id}
              label={endpoint.method}
              tone={methodTone(endpoint.method)}
            />,
            endpoint.path,
            endpoint.scope,
            <View key={`${endpoint.id}-desc`} style={{ gap: 3 }}>
              <Text style={styles.rowTitle}>{endpoint.name}</Text>
              <Text style={styles.rowText}>{endpoint.summary}</Text>
              <DocsLink href={CATEGORY_PAGE[endpoint.category]}>Read the reference</DocsLink>
            </View>,
          ])}
        />
      </DocsSection>

      <DocsSection id="start" title="Start integrating">
        <DocsList
          ordered
          items={[
            <>
              Create an account and open the{' '}
              <DocsLink href="/(protected)/developer">Developer Dashboard</DocsLink>.
            </>,
            <>
              Create a project, then generate a test API key with the scopes you need.
              Read <DocsLink href="/developers/authentication">Authentication</DocsLink>{' '}
              first.
            </>,
            <>
              Follow the{' '}
              <DocsLink href="/developers/getting-started">step-by-step tutorial</DocsLink>{' '}
              to send your first request.
            </>,
            <>
              Try requests in the{' '}
              <DocsLink href="/developers/playground">API playground</DocsLink> before
              writing code.
            </>,
          ]}
        />
        <View style={styles.buttonRow}>
          <DocsButton
            label="Getting started"
            icon="play-circle"
            onPress={() => router.navigate('/developers/getting-started' as any)}
          />
          <DocsButton
            label="API playground"
            icon="terminal"
            variant="secondary"
            onPress={() => router.navigate('/developers/playground' as any)}
          />
        </View>
      </DocsSection>

      <DocsSection id="limitations" title="Honest limitations">
        <DocsCallout tone="warning" title="QR scan analytics are not implemented">
          LinkFlow records clicks on short links. It does not record scans of QR images.
          QR analytics for a code created from a short link return that link&apos;s click
          analytics with <Text style={styles.mono}>tracking: &quot;linked-link-clicks&quot;</Text>;
          standalone QR codes return <Text style={styles.mono}>supported: false</Text>.
          Never present those clicks as individual scans.
        </DocsCallout>
        <DocsP>
          QR image options are applied to the response only — the database stores QR
          metadata, not colours or size — and images are returned as PNG data URIs rather
          than hosted URLs. The API also has no billing, webhooks or SDK packages; use the
          documented REST endpoints directly.
        </DocsP>
      </DocsSection>

      <DocsSection id="resources" title="Machine-readable resources">
        <DocsP>
          The OpenAPI document and Postman files are generated from the same endpoint
          catalog that renders this site, so they cannot drift from the reference pages.
        </DocsP>
        <DocsList
          items={[
            'OpenAPI 3.1: GET /api/openapi.json',
            'Postman collection v2.1: GET /api/postman/collection.json',
            'Postman environment: GET /api/postman/environment.json',
          ]}
        />
        <DocsCallout tone="info" title="Generated, not hand-written">
          Regenerate the artifacts with <Text style={styles.mono}>npm run docs:generate</Text>{' '}
          after changing the catalog. See <DocsLink href="/developers/changelog">Changelog</DocsLink>{' '}
          for the current API version.
        </DocsCallout>
      </DocsSection>

      <DocsPager next={{ label: 'Getting started', href: '/developers/getting-started' }} />
    </DocsPage>
  );
}

const styles = StyleSheet.create({
  cards: { flexDirection: 'row', flexWrap: 'wrap', gap: DocsSpacing.md, marginVertical: DocsSpacing.sm },
  mono: { fontFamily: DocsMonoFont, color: DocsColors.primarySoft, fontSize: 12.5 },
  rowTitle: { color: DocsColors.text, fontSize: 12.5, fontWeight: '700' },
  rowText: { color: DocsColors.textMuted, fontSize: 11.5, lineHeight: 17 },
  buttonRow: { flexDirection: 'row', flexWrap: 'wrap', gap: DocsSpacing.sm, marginTop: DocsSpacing.sm },
});
