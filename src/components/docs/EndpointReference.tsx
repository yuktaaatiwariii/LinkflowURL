import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  DocsColors,
  DocsMonoFont,
  DocsSpacing,
} from '../../constants/docsTheme';
import {
  API_ERRORS,
  type ApiEndpoint,
} from '../../constants/apiReference';
import { buildEndpointExamples } from '../../services/docs';
import {
  DocsBadge,
  DocsCallout,
  DocsH3,
  DocsP,
  DocsTable,
  methodTone,
} from './DocsUI';
import { CodeBlock } from './CodeBlock';
import { CodeTabs } from './CodeTabs';

interface SchemaRow {
  name: string;
  type: string;
  required: boolean;
  details: string;
}

function schemaType(schema: Record<string, any>): string {
  if (!schema) return 'any';
  if (schema.type) {
    return Array.isArray(schema.type) ? schema.type.join(' | ') : schema.type;
  }
  if (schema.anyOf) return 'one of';
  return 'any';
}

function flattenSchema(
  schema: Record<string, any> | null | undefined,
  prefix = '',
  parentRequired: string[] = []
): SchemaRow[] {
  if (!schema || !schema.properties) return [];
  const required = Array.isArray(schema.required) ? schema.required : parentRequired;
  const rows: SchemaRow[] = [];

  for (const [key, rawChild] of Object.entries(schema.properties)) {
    const child = rawChild as Record<string, any>;
    const name = prefix ? `${prefix}.${key}` : key;
    const details = [
      child.description,
      child.maxLength ? `Max ${child.maxLength} characters.` : null,
      child.minimum !== undefined ? `Minimum ${child.minimum}.` : null,
      child.maximum !== undefined ? `Maximum ${child.maximum}.` : null,
      child.enum ? `One of: ${child.enum.join(', ')}.` : null,
      child.default !== undefined ? `Default: ${JSON.stringify(child.default)}.` : null,
      child.pattern ? `Pattern: ${child.pattern}.` : null,
    ]
      .filter(Boolean)
      .join(' ');

    rows.push({
      name,
      type: schemaType(child),
      required: required.includes(key),
      details,
    });

    if (child.type === 'object' && child.properties) {
      rows.push(...flattenSchema(child, name));
    }
  }

  return rows;
}

function errorsFor(endpoint: ApiEndpoint) {
  const codes = new Set<string>(endpoint.errorCodes);
  for (const code of [
    'MISSING_API_KEY',
    'INVALID_API_KEY',
    'API_KEY_REVOKED',
    'API_KEY_EXPIRED',
    'INSUFFICIENT_SCOPE',
    'METHOD_NOT_ALLOWED',
    'INTERNAL_ERROR',
  ]) {
    codes.add(code);
  }
  return [...codes]
    .map((code) => API_ERRORS.find((entry) => entry.code === code))
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
    .sort((a, b) => a.status - b.status || a.code.localeCompare(b.code));
}

export function EndpointReference({ endpoint }: { endpoint: ApiEndpoint }) {
  const examples = useMemo(() => buildEndpointExamples(endpoint), [endpoint]);
  const bodyRows = useMemo(
    () => (endpoint.bodySchema ? flattenSchema(endpoint.bodySchema.schema) : []),
    [endpoint.bodySchema]
  );
  const errors = useMemo(() => errorsFor(endpoint), [endpoint]);

  return (
    <View>
      <View style={styles.headerRow}>
        <DocsBadge label={endpoint.method} tone={methodTone(endpoint.method)} />
        <Text style={styles.path} selectable>
          {endpoint.path}
        </Text>
        <View style={{ flex: 1 }} />
        <DocsBadge label={endpoint.scope} tone="primary" icon="key" />
      </View>
      <Text style={styles.name}>{endpoint.name}</Text>
      <DocsP>{endpoint.description}</DocsP>

      <View style={styles.metaRow}>
        <DocsBadge label="Authentication required" tone="neutral" icon="lock" />
        <DocsBadge label={`Scope: ${endpoint.scope}`} tone="primary" icon="key" />
      </View>

      {endpoint.pathParams.length > 0 ? (
        <>
          <DocsH3>Path parameters</DocsH3>
          <DocsTable
            columns={['Name', 'Type', 'Required', 'Description']}
            monoColumns={[0, 1]}
            rows={endpoint.pathParams.map((param) => [
              param.name,
              param.type,
              param.required ? 'Yes' : 'No',
              param.description,
            ])}
          />
        </>
      ) : null}

      {endpoint.queryParams.length > 0 ? (
        <>
          <DocsH3>Query parameters</DocsH3>
          <DocsTable
            columns={['Name', 'Type', 'Required', 'Default', 'Description']}
            monoColumns={[0, 1, 3]}
            rows={endpoint.queryParams.map((param) => [
              param.name,
              param.type,
              param.required ? 'Yes' : 'No',
              param.default !== undefined ? String(param.default) : '—',
              param.description,
            ])}
          />
        </>
      ) : null}

      {endpoint.bodySchema ? (
        <>
          <DocsH3>Request body</DocsH3>
          {endpoint.id === 'create-qr' ? (
            <DocsP>
              Provide <Text style={styles.mono}>targetUrl</Text> or an owned{' '}
              <Text style={styles.mono}>linkId</Text>. If both are supplied,{' '}
              <Text style={styles.mono}>targetUrl</Text> wins.
            </DocsP>
          ) : null}
          <DocsTable
            columns={['Field', 'Type', 'Required', 'Validation']}
            monoColumns={[0, 1]}
            rows={bodyRows.map((row) => [
              row.name,
              row.type,
              row.required ? 'Yes' : 'No',
              row.details || '—',
            ])}
          />
          <CodeBlock
            code={JSON.stringify(endpoint.bodySchema.example, null, 2)}
            language="json"
            label="Request body example"
          />
        </>
      ) : null}

      <DocsH3>Response</DocsH3>
      <View style={styles.responseHeader}>
        <DocsBadge
          label={String(endpoint.success.status)}
          tone={endpoint.success.status < 300 ? 'success' : 'warning'}
        />
        <Text style={styles.responseText}>{endpoint.success.description}</Text>
      </View>
      <CodeBlock
        code={JSON.stringify(endpoint.success.example, null, 2)}
        language="json"
        label="Successful response"
      />
      {endpoint.success.alternativeExample ? (
        <View style={{ marginTop: DocsSpacing.sm }}>
          <CodeBlock
            code={JSON.stringify(endpoint.success.alternativeExample, null, 2)}
            language="json"
            label="Alternative response (standalone QR)"
          />
        </View>
      ) : null}

      <DocsH3>Errors</DocsH3>
      <DocsTable
        columns={['Status', 'Code', 'Meaning']}
        monoColumns={[1]}
        rows={errors.map((entry) => [
          String(entry.status),
          entry.code,
          entry.meaning,
        ])}
      />
      <DocsP>
        Every error uses the same envelope:{' '}
        <Text style={styles.mono}>{'{ success, message, error: { code } }'}</Text>. See the{' '}
        <Text style={styles.link}>Errors</Text> reference for handling guidance.
      </DocsP>

      {endpoint.notes.length > 0 ? (
        <>
          <DocsH3>Notes</DocsH3>
          {endpoint.notes.map((note) => (
            <DocsCallout key={note} tone="info">
              {note}
            </DocsCallout>
          ))}
        </>
      ) : null}

      <DocsH3>Code examples</DocsH3>
      <CodeTabs
        tabs={[
          { label: 'cURL', code: examples.curl, language: 'bash' },
          { label: 'JavaScript', code: examples.javascript, language: 'javascript' },
          { label: 'Node.js', code: examples.node, language: 'javascript' },
          { label: 'Python', code: examples.python, language: 'python' },
        ]}
      />
      <View style={{ height: DocsSpacing.xxl }} />
      <View style={styles.divider} />
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: DocsSpacing.sm,
    marginBottom: 10,
  },
  path: {
    color: DocsColors.text,
    fontFamily: DocsMonoFont,
    fontSize: 14,
    fontWeight: '600',
  },
  name: {
    color: DocsColors.text,
    fontSize: 21,
    lineHeight: 28,
    fontWeight: '700',
    letterSpacing: -0.3,
    marginBottom: 6,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginVertical: DocsSpacing.sm,
  },
  responseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DocsSpacing.sm,
    marginBottom: DocsSpacing.sm,
  },
  responseText: { color: DocsColors.textSecondary, fontSize: 13, flex: 1 },
  mono: { fontFamily: DocsMonoFont, color: DocsColors.primarySoft, fontSize: 12.5 },
  link: { color: DocsColors.primarySoft, fontWeight: '600' },
  divider: { height: 1, backgroundColor: DocsColors.border },
});
