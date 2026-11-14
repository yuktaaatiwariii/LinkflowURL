import React from 'react';
import {
  DocsPage,
  DocsSection,
  DocsP,
  DocsCallout,
  DocsBadge,
  DocsLink,
  DocsPager,
  DocsList,
} from '../../src/components/docs/DocsUI';
import { ApiPlayground } from '../../src/components/docs/ApiPlayground';

export default function PlaygroundScreen() {
  return (
    <DocsPage
      eyebrow="Tool"
      title="API playground"
      description="Send a real HTTP request to the LinkFlow API from your browser. Nothing is mocked: the status, headers, duration and JSON body are exactly what the server returned."
      badge={
        <>
          <DocsBadge label="Real requests" tone="success" icon="zap" />
          <DocsBadge label="Key stays in memory" tone="primary" icon="shield" />
          <DocsBadge label="No proxy" tone="info" icon="server" />
        </>
      }
    >
      <DocsSection id="playground" title="Try an endpoint" bare>
        <ApiPlayground />
      </DocsSection>

      <DocsSection id="how-it-works" title="How the playground works">
        <DocsList
          items={[
            'Pick a category and endpoint. The method, full URL, scope and body template come from the same catalog that renders the reference pages.',
            'Path and query parameters are validated locally first so obvious mistakes do not cost a round trip.',
            'The JSON body is parsed and validated against the documented schema before sending.',
            'The browser calls the LinkFlow API directly with your X-API-Key header. There is no LinkFlow proxy in between.',
            'The response panel shows the real status, duration, size and body. Error envelopes are displayed unchanged.',
            'Copy cURL replaces your key with $LINKFLOW_API_KEY, so copied commands contain no credential.',
          ]}
        />
        <DocsP>
          If the request fails before reaching the server, the playground reports a network
          error. The most common cause on web is CORS: the API only returns an allow header for
          origins configured by the operator. See{' '}
          <DocsLink href="/developers/authentication">Authentication</DocsLink>.
        </DocsP>
      </DocsSection>

      <DocsSection id="credentials" title="Credential handling">
        <DocsCallout tone="danger" title="Use a test key, and expect real data">
          Test and live keys hit the same account. Any link or QR code you create here is a
          real row. Delete what you create, and never paste a production key into a shared
          machine.
        </DocsCallout>
        <DocsList
          items={[
            'The key lives in React state only. It is never written to localStorage, sessionStorage, cookies or analytics.',
            'It is never logged to the console. The UI shows only a masked reference.',
            'Leaving this page unmounts the form and discards the key.',
            'The Clear button wipes the field immediately.',
            'Live mode requires an explicit confirmation checkbox before a request is sent.',
            'The server does not receive the key anywhere except the X-API-Key header of the request you send.',
          ]}
        />
        <DocsP>
          Generating a test key is covered in{' '}
          <DocsLink href="/developers/getting-started">Getting started</DocsLink>. The
          dashboard lives at <DocsLink href="/(protected)/developer/keys">/developer/keys</DocsLink>.
        </DocsP>
      </DocsSection>

      <DocsPager
        previous={{ label: 'Changelog', href: '/developers/changelog' }}
        next={{ label: 'Links API', href: '/developers/api/links' }}
      />
    </DocsPage>
  );
}
