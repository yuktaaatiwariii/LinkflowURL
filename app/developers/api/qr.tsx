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

export default function QrApiScreen() {
  return (
    <DocsPage
      eyebrow="API reference"
      title="QR codes"
      description="Generate PNG QR images for a URL or an owned short link, manage QR metadata, and read the analytics that are actually available. QR scans are not tracked — this page says so everywhere it matters."
      badge={
        <>
          <DocsBadge label="5 endpoints" tone="neutral" icon="grid" />
          <DocsBadge label="PNG data URIs" tone="info" icon="image" />
          <DocsBadge label="No scan tracking" tone="warning" icon="alert-triangle" />
        </>
      }
    >
      <DocsSection id="overview" title="Overview">
        <DocsP>
          QR endpoints live under <Text style={styles.mono}>/api/v1/qr</Text>. A QR code can
          point at any absolute http(s) URL (<Text style={styles.mono}>targetUrl</Text>) or at
          one of your short links (<Text style={styles.mono}>linkId</Text>). If both are sent,{' '}
          <Text style={styles.mono}>targetUrl</Text> wins.
        </DocsP>
        <DocsTable
          columns={['Endpoint', 'Method', 'Scope']}
          monoColumns={[0]}
          rows={[
            ['/api/v1/qr', 'GET', 'qr:read'],
            ['/api/v1/qr', 'POST', 'qr:write'],
            ['/api/v1/qr/:id', 'GET', 'qr:read'],
            ['/api/v1/qr/:id', 'DELETE', 'qr:delete'],
            ['/api/v1/qr/:id/analytics', 'GET', 'analytics:read'],
          ]}
        />
        <DocsCallout tone="danger" title="QR scan analytics do not exist">
          LinkFlow does not record scans of QR images. There is no scan counter, no unique
          scanner count and no per-QR daily scan series. The QR analytics endpoint reports a
          linked short link&apos;s <em>clicks</em> and returns{' '}
          <Text style={styles.mono}>supported: false</Text> for standalone codes. Any figure
          labelled as a scan by an integration would be fabricated.
        </DocsCallout>
      </DocsSection>

      <DocsSection id="response-format" title="QR response format">
        <DocsP>
          Create and retrieve responses contain two objects: <Text style={styles.mono}>qr</Text>{' '}
          for stored metadata and <Text style={styles.mono}>image</Text> for the rendered PNG.
          List responses return metadata only.
        </DocsP>
        <CodeBlock
          language="json"
          label="POST /api/v1/qr and GET /api/v1/qr/:id"
          code={`{
  "success": true,
  "message": "QR code created successfully",
  "data": {
    "qr": {
      "id": "7f4d2b1c-9e8a-4b3c-8d2e-5a6b7c8d9e0f",
      "title": "Launch QR",
      "targetUrl": "https://linkflowurl.com/launch",
      "linkId": "0e7c3a9e-2f4b-4a1f-9c55-1f0e6f6f3d21",
      "createdAt": "2026-11-02T10:00:00.000Z",
      "updatedAt": "2026-11-02T10:00:00.000Z"
    },
    "image": {
      "mimeType": "image/png",
      "encoding": "data-uri",
      "dataUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUg…",
      "width": 512,
      "margin": 2,
      "errorCorrectionLevel": "M",
      "dark": "#000000",
      "light": "#FFFFFF"
    }
  }
}`}
        />
        <DocsTable
          columns={['Field', 'Meaning']}
          monoColumns={[0]}
          rows={[
            ['qr.id', 'QR metadata id, used by retrieve, analytics and delete.'],
            ['qr.targetUrl', 'The URL actually encoded in the image.'],
            ['qr.linkId', 'The linked short link id, or null for a standalone QR code.'],
            ['image.dataUrl', 'Complete PNG as a data URI. Decode the base64 payload to store a file.'],
            ['image.encoding', 'Always "data-uri". LinkFlow does not host image files.'],
            ['image.width', 'Rendered pixel width (equal to image.size).'],
          ]}
        />
      </DocsSection>

      <DocsSection id="create-qr" title="Create a QR code" bare>
        <EndpointReference endpoint={findEndpoint('create-qr')} />
      </DocsSection>

      <DocsSection id="list-qr" title="List QR codes" bare>
        <EndpointReference endpoint={findEndpoint('list-qr')} />
      </DocsSection>

      <DocsSection id="get-qr" title="Retrieve a QR code" bare>
        <EndpointReference endpoint={findEndpoint('get-qr')} />
      </DocsSection>

      <DocsSection id="delete-qr" title="Delete a QR code" bare>
        <EndpointReference endpoint={findEndpoint('delete-qr')} />
      </DocsSection>

      <DocsSection id="qr-analytics" title="QR analytics" bare>
        <EndpointReference endpoint={findEndpoint('qr-analytics')} />
      </DocsSection>

      <DocsSection id="image-options" title="Image options">
        <DocsTable
          columns={['Option', 'Default', 'Range', 'Notes']}
          monoColumns={[0, 1]}
          rows={[
            ['image.size', '512', '128–1024', 'Integer pixel width.'],
            ['image.margin', '2', '0–16', 'Quiet-zone width in modules.'],
            ['image.errorCorrectionLevel', 'M', 'L, M, Q, H', 'Higher levels survive more damage but hold less data.'],
            ['image.dark', '#000000', '3- or 6-digit hex', 'Foreground colour.'],
            ['image.light', '#FFFFFF', '3- or 6-digit hex', 'Background colour.'],
          ]}
        />
        <DocsCallout tone="warning" title="Customisation is not persisted">
          The database stores QR metadata — target URL, title and link reference — not colours,
          size or error-correction level. A later{' '}
          <Text style={styles.mono}>GET /api/v1/qr/:id</Text> always renders the defaults (512
          px, margin 2, level M, black on white). Re-request with the same options if you need
          a customised image again.
        </DocsCallout>
        <DocsH3>Storing the image</DocsH3>
        <CodeBlock
          language="javascript"
          label="Save the PNG on your server"
          code={`const payload = await response.json();
const dataUrl = payload.data.image.dataUrl;
const base64 = dataUrl.replace(/^data:image\\/png;base64,/, "");

// Node.js example — store the bytes wherever your app keeps assets.
await fs.promises.writeFile("launch-qr.png", Buffer.from(base64, "base64"));`}
          caption="LinkFlow returns the image inline; it does not provide a hosted image URL."
        />
      </DocsSection>

      <DocsSection id="tracking" title="What QR analytics can and cannot tell you">
        <DocsH3>Linked QR code</DocsH3>
        <DocsP>
          Created with <Text style={styles.mono}>linkId</Text>. The encoded URL is the short
          link&apos;s public URL. Reports return{' '}
          <Text style={styles.mono}>supported: true</Text>,{' '}
          <Text style={styles.mono}>tracking: &quot;linked-link-clicks&quot;</Text> and the
          link&apos;s click series.
        </DocsP>
        <DocsH3>Standalone QR code</DocsH3>
        <DocsP>
          Created with <Text style={styles.mono}>targetUrl</Text> and no link. Returns{' '}
          <Text style={styles.mono}>supported: false</Text> with a reason and no click series,
          because LinkFlow never sees the scan.
        </DocsP>
        <DocsH3>Why the counts are not scans</DocsH3>
        <DocsP>
          A scan opens the link, but the same link can also be clicked from a chat, email or
          the app. The click series counts every redirect, regardless of how the visitor
          arrived, and cannot attribute an individual click to a QR image. Do not label these
          numbers as scans in your product.
        </DocsP>
      </DocsSection>

      <DocsSection id="limitations" title="Known limitations">
        <DocsList
          items={[
            'No scan tracking, scan counters or scanner attribution.',
            'No hosted image URLs: every image is a data URI in the JSON response.',
            'No persistent customisation: colours and size apply to the response only.',
            'No update endpoint: QR metadata cannot be edited after creation; delete and recreate.',
            'Repeated identical creates (same account, target URL and title within 5 seconds) may return the existing row instead of inserting a duplicate.',
            'Deleting a short link does not delete its QR code, but that code no longer reports supported analytics.',
          ]}
        />
      </DocsSection>

      <DocsSection id="next" title="Next">
        <DocsP>
          Read <DocsLink href="/developers/api/analytics">Analytics</DocsLink> for the link and
          account-level click endpoints, or open the{' '}
          <DocsLink href="/developers/playground">playground</DocsLink> to generate a real QR
          code against your account.
        </DocsP>
      </DocsSection>

      <DocsPager
        previous={{ label: 'Links API', href: '/developers/api/links' }}
        next={{ label: 'Analytics API', href: '/developers/api/analytics' }}
      />
    </DocsPage>
  );
}

const styles = StyleSheet.create({
  mono: { fontFamily: DocsMonoFont, color: DocsColors.primarySoft, fontSize: 12.5 },
});
