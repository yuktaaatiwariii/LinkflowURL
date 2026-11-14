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
} from '../../../src/components/docs/DocsUI';
import { CodeBlock } from '../../../src/components/docs/CodeBlock';
import { EndpointReference } from '../../../src/components/docs/EndpointReference';
import { findEndpoint } from '../../../src/constants/apiReference';
import { DocsColors, DocsMonoFont } from '../../../src/constants/docsTheme';

export default function LinksApiScreen() {
  return (
    <DocsPage
      eyebrow="API reference"
      title="Links"
      description="Create short links, list and retrieve them, delete them, and read the clicks LinkFlow already records. All five endpoints are scoped and available on test and live keys alike."
      badge={
        <>
          <DocsBadge label="5 endpoints" tone="neutral" icon="link" />
          <DocsBadge label="Offset pagination" tone="info" icon="list" />
          <DocsBadge label="Ownership from key" tone="primary" icon="key" />
        </>
      }
    >
      <DocsSection id="overview" title="Overview">
        <DocsP>
          Every link endpoint is under <Text style={styles.mono}>/api/v1/links</Text> and
          requires an API key. Ownership always comes from the authenticated key: a link
          belonging to another account is reported as{' '}
          <Text style={styles.mono}>404 NOT_FOUND</Text>, never <Text style={styles.mono}>403</Text>.
        </DocsP>
        <DocsTable
          columns={['Endpoint', 'Method', 'Scope']}
          monoColumns={[0]}
          rows={[
            ['/api/v1/links', 'GET', 'links:read'],
            ['/api/v1/links', 'POST', 'links:write'],
            ['/api/v1/links/:id', 'GET', 'links:read'],
            ['/api/v1/links/:id', 'DELETE', 'links:delete'],
            ['/api/v1/links/:id/analytics', 'GET', 'analytics:read'],
          ]}
        />
        <DocsCallout tone="info" title="The API does not set expiry dates">
          Links support <Text style={styles.mono}>expiresAt</Text> and{' '}
          <Text style={styles.mono}>isActive</Text> in their representation, but{' '}
          <Text style={styles.mono}>POST /api/v1/links</Text> accepts only{' '}
          <Text style={styles.mono}>originalUrl</Text>, <Text style={styles.mono}>title</Text>{' '}
          and <Text style={styles.mono}>customAlias</Text>. Expiry and activation are managed
          in the LinkFlow app.
        </DocsCallout>
      </DocsSection>

      <DocsSection id="pagination" title="Pagination">
        <DocsP>
          <Text style={styles.mono}>GET /api/v1/links</Text> uses offset pagination. Results
          are returned newest first by creation time.
        </DocsP>
        <DocsTable
          columns={['Parameter', 'Default', 'Minimum', 'Maximum', 'Notes']}
          monoColumns={[0, 1, 2, 3]}
          rows={[
            ['limit', '20', '1', '100', 'Page size. Values above 100 fail validation.'],
            ['offset', '0', '0', '100000', 'Rows to skip. Values above 100000 fail validation.'],
          ]}
        />
        <DocsP>
          The response repeats the applied <Text style={styles.mono}>limit</Text> and{' '}
          <Text style={styles.mono}>offset</Text>, and{' '}
          <Text style={styles.mono}>total</Text> is the full number of links owned by the
          account — not the number in the page. Pagination beyond the last row returns an empty
          array, not an error.
        </DocsP>
        <CodeBlock
          language="bash"
          label="Walk every page"
          code={`curl -X GET "https://api.linkflowurl.com/api/v1/links?limit=100&offset=0" \\
  -H "X-API-Key: $LINKFLOW_API_KEY"`}
        />
        <DocsP>
          Increase <Text style={styles.mono}>offset</Text> by the previous{' '}
          <Text style={styles.mono}>limit</Text> until{' '}
          <Text style={styles.mono}>offset + links.length &gt;= total</Text>. Because ordering
          is by creation time, a link created mid-walk can shift subsequent pages; de-duplicate
          by <Text style={styles.mono}>id</Text> if that matters.
        </DocsP>
      </DocsSection>

      <DocsSection id="create-link" title="Create a link" bare>
        <EndpointReference endpoint={findEndpoint('create-link')} />
      </DocsSection>

      <DocsSection id="list-links" title="List links" bare>
        <EndpointReference endpoint={findEndpoint('list-links')} />
      </DocsSection>

      <DocsSection id="get-link" title="Retrieve a link" bare>
        <EndpointReference endpoint={findEndpoint('get-link')} />
      </DocsSection>

      <DocsSection id="delete-link" title="Delete a link" bare>
        <EndpointReference endpoint={findEndpoint('delete-link')} />
      </DocsSection>

      <DocsSection id="link-analytics" title="Link analytics" bare>
        <EndpointReference endpoint={findEndpoint('link-analytics')} />
      </DocsSection>

      <DocsSection id="validation" title="Field validation">
        <DocsP>
          Validation happens before any database write. Anything not listed here is ignored;
          in particular, a <Text style={styles.mono}>userId</Text> or{' '}
          <Text style={styles.mono}>user_id</Text> in the body never changes ownership.
        </DocsP>
        <DocsTable
          columns={['Field', 'Rules']}
          monoColumns={[0]}
          rows={[
            ['originalUrl', 'Required. Absolute http or https URL. Max 2048 characters. javascript:, file: and relative URLs are rejected.'],
            ['title', 'Optional. Max 255 characters. Whitespace-only values are treated as omitted.'],
            ['customAlias', 'Optional. 1–50 characters, A–Z a–z 0–9 only. Must be globally unique; conflicts return 409 ALIAS_TAKEN.'],
          ]}
        />
        <DocsH3>What the server ignores</DocsH3>
        <DocsList
          items={[
            'Unknown body fields are not persisted.',
            'A supplied short code, click count or expiry cannot be set through this endpoint.',
            'An alias that already belongs to another account is still a conflict; aliases are global.',
          ]}
        />
      </DocsSection>

      <DocsSection id="lifecycle" title="Errors and lifecycle">
        <DocsP>
          A malformed id returns <Text style={styles.mono}>400 VALIDATION_ERROR</Text>; a
          well-formed id that does not exist — or belongs to someone else — returns{' '}
          <Text style={styles.mono}>404 NOT_FOUND</Text>. Deletion is permanent and returns
          only the deleted id.
        </DocsP>
        <DocsCallout tone="warning" title="Deleting a link affects its QR code">
          A QR code created from a short link keeps its stored{' '}
          <Text style={styles.mono}>targetUrl</Text>, but its analytics can no longer resolve
          the link and falls back to <Text style={styles.mono}>supported: false</Text>. The QR
          row itself is not deleted.
        </DocsCallout>
        <DocsP>
          See the <DocsLink href="/developers/errors">error reference</DocsLink> for every code
          an endpoint can return, and <DocsLink href="/developers/api/analytics">Analytics</DocsLink>{' '}
          for how clicks are aggregated.
        </DocsP>
      </DocsSection>

      <DocsPager
        previous={{ label: 'Authentication', href: '/developers/authentication' }}
        next={{ label: 'QR codes', href: '/developers/api/qr' }}
      />
    </DocsPage>
  );
}

const styles = StyleSheet.create({
  mono: { fontFamily: DocsMonoFont, color: DocsColors.primarySoft, fontSize: 12.5 },
});
