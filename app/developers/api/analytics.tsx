import React from 'react';
import { StyleSheet, Text } from 'react-native';
import {
  DocsPage,
  DocsSection,
  DocsP,
  DocsH3,
  DocsCallout,
  DocsBadge,
  DocsTable,
  DocsPager,
  DocsList,
} from '../../../src/components/docs/DocsUI';
import { CodeBlock } from '../../../src/components/docs/CodeBlock';
import { EndpointReference } from '../../../src/components/docs/EndpointReference';
import { findEndpoint } from '../../../src/constants/apiReference';
import { DocsColors, DocsMonoFont } from '../../../src/constants/docsTheme';

export default function AnalyticsApiScreen() {
  return (
    <DocsPage
      eyebrow="API reference"
      title="Analytics"
      description="Read the click data LinkFlow actually records: an account overview, a per-link daily series, and the honest QR fallback. There are no scan metrics and no fabricated dimensions."
      badge={
        <>
          <DocsBadge label="3 endpoints" tone="neutral" icon="bar-chart-2" />
          <DocsBadge label="UTC daily series" tone="info" icon="calendar" />
          <DocsBadge label="Clicks ≠ scans" tone="warning" icon="alert-triangle" />
        </>
      }
    >
      <DocsSection id="overview" title="Overview">
        <DocsTable
          columns={['Endpoint', 'Method', 'Scope', 'Returns']}
          monoColumns={[0, 2]}
          rows={[
            [
              '/api/v1/analytics/overview',
              'GET',
              'analytics:read',
              'Account totals, daily clicks, most-clicked link, recent QR metadata',
            ],
            [
              '/api/v1/links/:id/analytics',
              'GET',
              'analytics:read',
              'One link plus its all-time count and daily series',
            ],
            [
              '/api/v1/qr/:id/analytics',
              'GET',
              'analytics:read',
              'Linked-link clicks, or supported: false',
            ],
          ]}
        />
        <DocsP>
          All three endpoints require <Text style={styles.mono}>analytics:read</Text>. Having{' '}
          <Text style={styles.mono}>links:read</Text> or <Text style={styles.mono}>qr:read</Text>{' '}
          is not enough, even though two of the paths are nested under those resources.
        </DocsP>
      </DocsSection>

      <DocsSection id="what-is-measured" title="What is measured">
        <DocsTable
          columns={['Metric', 'Available', 'Meaning']}
          rows={[
            ['Link clicks', 'Yes', 'Every redirect through a LinkFlow short link.'],
            ['Lifetime clicks per link', 'Yes', 'The link’s all-time redirect count.'],
            ['Daily click series', 'Yes', 'Clicks per UTC calendar day, zero-filled.'],
            ['Account click total', 'Yes', 'Sum of all links’ lifetime clicks.'],
            ['QR scans', 'No', 'Not recorded anywhere.'],
            ['Unique visitors', 'No', 'No visitor identity is stored.'],
            ['Referrers / devices / geography', 'No', 'Not captured by this API.'],
          ]}
        />
        <DocsCallout tone="danger" title="Do not present clicks as QR scans">
          A QR code made from a short link produces clicks when scanned, but the API cannot
          distinguish those clicks from clicks on the same short URL from anywhere else. Label
          the numbers as link clicks, never as scans.
        </DocsCallout>
      </DocsSection>

      <DocsSection id="range-and-days" title="Ranges, days and time zones">
        <DocsP>
          Every analytics endpoint accepts an optional{' '}
          <Text style={styles.mono}>days</Text> query parameter. It defaults to{' '}
          <Text style={styles.mono}>7</Text> and must be an integer from{' '}
          <Text style={styles.mono}>1</Text> to <Text style={styles.mono}>90</Text>.
        </DocsP>
        <DocsList
          items={[
            'daily always contains exactly `days` entries, oldest first, with zero-filled gaps.',
            'Dates are UTC calendar days written as YYYY-MM-DD.',
            'range.since and range.until repeat the first and last date of the series.',
            'totalClicks is lifetime, not the sum of the requested window.',
            'The window ends today (UTC); there is no arbitrary start/end parameter.',
          ]}
        />
        <CodeBlock
          language="json"
          label="range object"
          code={`"range": {
  "days": 7,
  "since": "2026-11-08",
  "until": "2026-11-14"
}`}
        />
      </DocsSection>

      <DocsSection id="analytics-overview" title="Analytics overview" bare>
        <EndpointReference endpoint={findEndpoint('analytics-overview')} />
      </DocsSection>

      <DocsSection id="link-analytics" title="Link click analytics" bare>
        <EndpointReference endpoint={findEndpoint('link-analytics')} />
      </DocsSection>

      <DocsSection id="qr-analytics" title="QR analytics" bare>
        <EndpointReference endpoint={findEndpoint('qr-analytics')} />
      </DocsSection>

      <DocsSection id="response-shapes" title="Response shapes explained">
        <DocsH3>Link analytics</DocsH3>
        <CodeBlock
          language="json"
          label="GET /api/v1/links/:id/analytics"
          code={`{
  "success": true,
  "message": "Link analytics retrieved successfully",
  "data": {
    "link": { "…": "the full link representation" },
    "totalClicks": 42,
    "range": { "days": 7, "since": "2026-11-08", "until": "2026-11-14" },
    "daily": [
      { "date": "2026-11-08", "clicks": 3 },
      { "date": "2026-11-09", "clicks": 0 }
    ]
  }
}`}
        />
        <DocsH3>QR analytics — linked</DocsH3>
        <CodeBlock
          language="json"
          label="supported: true"
          code={`{
  "success": true,
  "message": "QR code analytics retrieved successfully",
  "data": {
    "qr": { "…": "QR metadata" },
    "supported": true,
    "tracking": "linked-link-clicks",
    "link": { "…": "the linked short link" },
    "totalClicks": 42,
    "range": { "days": 7, "since": "2026-11-08", "until": "2026-11-14" },
    "daily": [{ "date": "2026-11-08", "clicks": 3 }]
  }
}`}
        />
        <DocsH3>QR analytics — standalone or deleted link</DocsH3>
        <CodeBlock
          language="json"
          label="supported: false"
          code={`{
  "success": true,
  "message": "QR code analytics retrieved successfully",
  "data": {
    "qr": { "…": "QR metadata" },
    "supported": false,
    "reason": "QR scans are not tracked. Create the QR from a short link to see its click analytics."
  }
}`}
        />
        <DocsP>
          The unsupported form has no <Text style={styles.mono}>daily</Text>,{' '}
          <Text style={styles.mono}>range</Text> or{' '}
          <Text style={styles.mono}>totalClicks</Text> fields. Branch on{' '}
          <Text style={styles.mono}>data.supported</Text> before reading any numeric field.
        </DocsP>
        <DocsH3>Overview totals</DocsH3>
        <DocsTable
          columns={['Field', 'Meaning']}
          monoColumns={[0]}
          rows={[
            ['totals.links', 'Every link in the account, active or not.'],
            ['totals.activeLinks', 'Links with isActive true.'],
            ['totals.clicks', 'Lifetime sum of clicks across all links.'],
            ['totals.qrCodes', 'Number of QR metadata rows.'],
            ['totals.linkedQrCodes', 'QR rows that reference a short link.'],
            ['mostClickedLink', 'The link with the highest lifetime clicks, or null.'],
            ['recentQrCodes', 'At most five recent QR metadata rows.'],
          ]}
        />
        <DocsCallout tone="info" title="QR counts are not scans">
          <Text style={styles.mono}>totals.qrCodes</Text> counts stored QR records.{' '}
          <Text style={styles.mono}>totals.clicks</Text> counts redirects on short links. No
          field in the overview counts scans.
        </DocsCallout>
      </DocsSection>

      <DocsSection id="missing-analytics" title="Missing and unsupported analytics">
        <DocsList
          items={[
            'No QR scan count, unique scanner count or scan time series.',
            'No per-country, per-device, per-referrer or per-browser breakdown.',
            'No unique-visitor metric: clicks are redirect events.',
            'No arbitrary date range; only the last 1–90 UTC days.',
            'No export endpoint and no scheduled reports.',
            'No real-time stream: values reflect the data present when the request is handled.',
          ]}
        />
        <DocsP>
          If your product needs one of these, derive and store it yourself from your own
          telemetry rather than presenting an approximation as LinkFlow data.
        </DocsP>
      </DocsSection>

      <DocsPager
        previous={{ label: 'QR codes', href: '/developers/api/qr' }}
        next={{ label: 'Errors', href: '/developers/errors' }}
      />
    </DocsPage>
  );
}

const styles = StyleSheet.create({
  mono: { fontFamily: DocsMonoFont, color: DocsColors.primarySoft, fontSize: 12.5 },
});
