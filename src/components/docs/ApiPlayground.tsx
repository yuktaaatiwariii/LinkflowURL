import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Feather } from '@expo/vector-icons';
import {
  DocsColors,
  DocsMonoFont,
  DocsRadius,
  DocsSpacing,
} from '../../constants/docsTheme';
import {
  API_CATEGORY_LABELS,
  API_ENDPOINTS,
  type ApiCategory,
  type ApiEndpoint,
} from '../../constants/apiReference';
import {
  buildCurlCommand,
  buildRequestUrl,
  defaultPathParams,
  defaultQueryParams,
  docsApiBaseUrl,
  executeApiRequest,
  formatBytes,
  validateAgainstSchema,
  validateIntegerParam,
  type PlaygroundResponse,
} from '../../services/docs';
import type { FeatherName } from '../developer/DeveloperUI';
import { DocsBadge, methodTone } from './DocsUI';
import { CodeBlock } from './CodeBlock';

const CATEGORIES: ApiCategory[] = ['links', 'qr', 'analytics'];

type Environment = 'test' | 'live';

function endpointsFor(category: ApiCategory): ApiEndpoint[] {
  return API_ENDPOINTS.filter((endpoint) => endpoint.category === category);
}

function FieldLabel({
  label,
  hint,
  required,
}: {
  label: string;
  hint?: string;
  required?: boolean;
}) {
  return (
    <View style={styles.fieldLabelRow}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {required ? <Text style={styles.requiredMark}>required</Text> : null}
      {hint ? <Text style={styles.fieldHint}>{hint}</Text> : null}
    </View>
  );
}

function Input({
  value,
  onChangeText,
  placeholder,
  mono = true,
  secureTextEntry,
  multiline,
  keyboardType,
}: {
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  mono?: boolean;
  secureTextEntry?: boolean;
  multiline?: boolean;
  keyboardType?: 'default' | 'numeric';
}) {
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={DocsColors.textMuted}
      secureTextEntry={secureTextEntry}
      multiline={multiline}
      keyboardType={keyboardType || 'default'}
      autoCapitalize="none"
      autoCorrect={false}
      spellCheck={false}
      style={[
        styles.input,
        mono && styles.inputMono,
        multiline && styles.inputMultiline,
      ]}
    />
  );
}

function SectionCard({
  title,
  icon,
  children,
  right,
}: {
  title: string;
  icon: FeatherName;
  children: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Feather name={icon} size={14} color={DocsColors.primarySoft} />
        <Text style={styles.cardTitle}>{title}</Text>
        <View style={{ flex: 1 }} />
        {right}
      </View>
      <View style={styles.cardBody}>{children}</View>
    </View>
  );
}

function StatusBadge({ response }: { response: PlaygroundResponse }) {
  const tone =
    response.status >= 200 && response.status < 300
      ? 'success'
      : response.status >= 400 && response.status < 500
        ? 'warning'
        : 'danger';
  return <DocsBadge label={`${response.status} ${response.statusText}`} tone={tone} />;
}

export function ApiPlayground() {
  const { width } = useWindowDimensions();
  // See DocsShell: avoid a hydration mismatch by measuring after mount.
  const [measured, setMeasured] = useState(false);
  useEffect(() => setMeasured(true), []);
  const twoColumn = measured && width >= 1050;

  const [category, setCategory] = useState<ApiCategory>('links');
  const [endpointId, setEndpointId] = useState<string>('list-links');
  const endpoint = useMemo(
    () => API_ENDPOINTS.find((entry) => entry.id === endpointId) || API_ENDPOINTS[0],
    [endpointId]
  );

  const [pathValues, setPathValues] = useState<Record<string, string>>(() =>
    defaultPathParams(endpoint)
  );
  const [queryValues, setQueryValues] = useState<Record<string, string>>(() =>
    defaultQueryParams(endpoint)
  );
  const [bodyText, setBodyText] = useState<string>(() =>
    endpoint.bodySchema ? JSON.stringify(endpoint.bodySchema.example, null, 2) : ''
  );

  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [environment, setEnvironment] = useState<Environment>('test');
  const [liveConfirmed, setLiveConfirmed] = useState(false);

  const [running, setRunning] = useState(false);
  const [response, setResponse] = useState<PlaygroundResponse | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [copiedCurl, setCopiedCurl] = useState(false);

  // Credentials are deliberately kept in component state only. Unmounting the
  // playground (leaving the page) discards them; nothing is written to
  // localStorage, sessionStorage or any log.
  useEffect(() => {
    return () => setApiKey('');
  }, []);

  const selectCategory = (next: ApiCategory) => {
    setCategory(next);
    const first = endpointsFor(next)[0];
    if (first) selectEndpoint(first);
  };

  const selectEndpoint = useCallback((next: ApiEndpoint) => {
    setEndpointId(next.id);
    setPathValues(defaultPathParams(next));
    setQueryValues(defaultQueryParams(next));
    setBodyText(
      next.bodySchema ? JSON.stringify(next.bodySchema.example, null, 2) : ''
    );
    setResponse(null);
    setRequestError(null);
    setValidationError(null);
    setLiveConfirmed(false);
  }, []);

  const baseUrl = docsApiBaseUrl();

  const requestUrl = useMemo(
    () => buildRequestUrl(endpoint, baseUrl, pathValues, queryValues),
    [endpoint, baseUrl, pathValues, queryValues]
  );

  const curl = useMemo(
    () =>
      buildCurlCommand({
        method: endpoint.method,
        url: requestUrl,
        body: endpoint.bodySchema && bodyText.trim() ? bodyText : null,
      }),
    [endpoint, requestUrl, bodyText]
  );

  const maskKey = (value: string) => {
    if (!value) return '—';
    if (value.length <= 10) return '••••';
    return `${value.slice(0, 7)}…${value.slice(-4)}`;
  };

  const run = async () => {
    setValidationError(null);
    setRequestError(null);
    setResponse(null);

    if (!apiKey.trim()) {
      setValidationError('Enter an API key. Create a test key in the Developer Dashboard.');
      return;
    }

    for (const param of endpoint.pathParams) {
      if (!(pathValues[param.name] || '').trim()) {
        setValidationError(`Enter a value for the ${param.name} path parameter.`);
        return;
      }
    }

    for (const param of endpoint.queryParams) {
      if (param.type === 'integer') {
        const problem = validateIntegerParam(
          queryValues[param.name] || '',
          param.name,
          param.minimum,
          param.maximum
        );
        if (problem) {
          setValidationError(problem);
          return;
        }
      }
    }

    let body: string | undefined;
    if (endpoint.bodySchema) {
      if (!bodyText.trim()) {
        setValidationError('A JSON request body is required for this endpoint.');
        return;
      }
      let parsed: unknown;
      try {
        parsed = JSON.parse(bodyText);
      } catch (error) {
        setValidationError(
          `Request body is not valid JSON: ${(error as Error).message}`
        );
        return;
      }
      const issues = validateAgainstSchema(endpoint.bodySchema.schema, parsed);
      if (issues.length > 0) {
        setValidationError(
          issues
            .slice(0, 3)
            .map((issue) => `${issue.path}: ${issue.message}`)
            .join('\n')
        );
        return;
      }
      body = bodyText;
    }

    if (environment === 'live' && !liveConfirmed) {
      setValidationError(
        'Confirm that you understand this request will run against the live environment before sending it.'
      );
      return;
    }

    setRunning(true);
    try {
      const result = await executeApiRequest({
        url: requestUrl,
        method: endpoint.method,
        apiKey,
        body,
      });
      setResponse(result);
    } catch (error) {
      const message = (error as Error).message || 'Network request failed.';
      setRequestError(
        message.toLowerCase().includes('abort')
          ? 'The request timed out after 30 seconds.'
          : `Network error: ${message}. Check that the LinkFlow API is reachable from this device and that the origin is allowed by CORS.`
      );
    } finally {
      setRunning(false);
    }
  };

  const copyCurl = async () => {
    try {
      await Clipboard.setStringAsync(curl);
      setCopiedCurl(true);
      setTimeout(() => setCopiedCurl(false), 1600);
    } catch {
      // Clipboard access can be denied; the command stays selectable.
    }
  };

  const prettyResponse = useMemo(() => {
    if (!response) return '';
    if (response.json !== null) return JSON.stringify(response.json, null, 2);
    return response.bodyText;
  }, [response]);

  const responseIsJson = Boolean(response && response.json !== null);

  return (
    <View style={styles.root}>
      <View style={styles.categoryRow}>
        {CATEGORIES.map((entry) => {
          const active = entry === category;
          return (
            <TouchableOpacity
              key={entry}
              activeOpacity={0.8}
              onPress={() => selectCategory(entry)}
              style={[styles.categoryChip, active && styles.categoryChipActive]}
            >
              <Text
                style={[styles.categoryLabel, active && styles.categoryLabelActive]}
              >
                {API_CATEGORY_LABELS[entry]}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.endpointList}>
        {endpointsFor(category).map((entry) => {
          const active = entry.id === endpoint.id;
          return (
            <TouchableOpacity
              key={entry.id}
              activeOpacity={0.8}
              onPress={() => selectEndpoint(entry)}
              style={[styles.endpointRow, active && styles.endpointRowActive]}
            >
              <DocsBadge label={entry.method} tone={methodTone(entry.method)} />
              <Text
                numberOfLines={1}
                style={[styles.endpointPath, active && styles.endpointPathActive]}
              >
                {entry.path}
              </Text>
              <Text style={styles.endpointName} numberOfLines={1}>
                {entry.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View
        style={[
          styles.columns,
          twoColumn ? styles.columnsWide : styles.columnsStacked,
        ]}
      >
        <View style={styles.column}>
          <SectionCard
            title="Request"
            icon="send"
            right={<DocsBadge label={endpoint.method} tone={methodTone(endpoint.method)} />}
          >
            <Text style={styles.urlPreview} selectable numberOfLines={3}>
              {requestUrl}
            </Text>
            <Text style={styles.scopeNote}>
              Requires scope{' '}
              <Text style={styles.scopeValue}>{endpoint.scope}</Text> · API key sent in
              the <Text style={styles.scopeValue}>X-API-Key</Text> header.
            </Text>

            {endpoint.pathParams.length > 0 ? (
              <View style={styles.fieldGroup}>
                {endpoint.pathParams.map((param) => (
                  <View key={param.name}>
                    <FieldLabel label={param.name} hint="path parameter" required />
                    <Input
                      value={pathValues[param.name] || ''}
                      onChangeText={(value) =>
                        setPathValues((current) => ({ ...current, [param.name]: value }))
                      }
                      placeholder={`YOUR_${param.name.toUpperCase()}`}
                    />
                  </View>
                ))}
              </View>
            ) : null}

            {endpoint.queryParams.length > 0 ? (
              <View style={styles.fieldGroup}>
                {endpoint.queryParams.map((param) => (
                  <View key={param.name}>
                    <FieldLabel
                      label={param.name}
                      hint={`query · ${param.type}${param.default !== undefined ? ` · default ${param.default}` : ''}`}
                    />
                    <Input
                      value={queryValues[param.name] || ''}
                      onChangeText={(value) =>
                        setQueryValues((current) => ({ ...current, [param.name]: value }))
                      }
                      placeholder={
                        param.default !== undefined ? String(param.default) : ''
                      }
                      keyboardType={param.type === 'integer' ? 'numeric' : 'default'}
                    />
                  </View>
                ))}
              </View>
            ) : null}

            {endpoint.bodySchema ? (
              <View style={styles.fieldGroup}>
                <FieldLabel label="JSON body" hint="edit before sending" required />
                <Input
                  value={bodyText}
                  onChangeText={setBodyText}
                  placeholder='{ "originalUrl": "https://example.com" }'
                  multiline
                />
              </View>
            ) : null}
          </SectionCard>

          <SectionCard title="Authentication" icon="key">
            <FieldLabel label="API key" hint="kept in memory only" required />
            <View style={styles.keyRow}>
              <TextInput
                value={apiKey}
                onChangeText={(value) => {
                  setApiKey(value);
                  setLiveConfirmed(false);
                  if (value.trim().startsWith('lf_live_')) setEnvironment('live');
                  if (value.trim().startsWith('lf_test_')) setEnvironment('test');
                }}
                placeholder="lf_test_…"
                placeholderTextColor={DocsColors.textMuted}
                secureTextEntry={!showKey}
                autoCapitalize="none"
                autoCorrect={false}
                spellCheck={false}
                style={[styles.input, styles.inputMono, styles.keyInput]}
              />
              <TouchableOpacity
                onPress={() => setShowKey((current) => !current)}
                accessibilityRole="button"
                accessibilityLabel={showKey ? 'Hide API key' : 'Show API key'}
                style={styles.iconButton}
              >
                <Feather
                  name={showKey ? 'eye-off' : 'eye'}
                  size={15}
                  color={DocsColors.textSecondary}
                />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setApiKey('')}
                accessibilityRole="button"
                accessibilityLabel="Clear API key"
                style={styles.iconButton}
              >
                <Feather name="trash-2" size={15} color={DocsColors.danger} />
              </TouchableOpacity>
            </View>
            <Text style={styles.maskNote}>Using key: {maskKey(apiKey)}</Text>

            <View style={styles.environmentRow}>
              {(['test', 'live'] as Environment[]).map((entry) => {
                const active = environment === entry;
                return (
                  <TouchableOpacity
                    key={entry}
                    activeOpacity={0.8}
                    onPress={() => {
                      setEnvironment(entry);
                      setLiveConfirmed(false);
                    }}
                    style={[
                      styles.environmentChip,
                      active && entry === 'live' && styles.environmentChipLive,
                      active && entry === 'test' && styles.environmentChipTest,
                    ]}
                  >
                    <View
                      style={[
                        styles.environmentDot,
                        {
                          backgroundColor:
                            entry === 'live' ? DocsColors.danger : DocsColors.success,
                        },
                      ]}
                    />
                    <Text
                      style={[
                        styles.environmentLabel,
                        active && { color: DocsColors.text },
                      ]}
                    >
                      {entry === 'live' ? 'Live' : 'Test'}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {environment === 'live' ? (
              <View style={styles.liveWarning}>
                <Feather name="alert-triangle" size={14} color={DocsColors.warning} />
                <View style={{ flex: 1, gap: 6 }}>
                  <Text style={styles.liveWarningText}>
                    Live requests create real links and QR codes in your account. Prefer a
                    test key while exploring.
                  </Text>
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => setLiveConfirmed((current) => !current)}
                    style={styles.confirmRow}
                  >
                    <View
                      style={[
                        styles.checkbox,
                        liveConfirmed && styles.checkboxChecked,
                      ]}
                    >
                      {liveConfirmed ? (
                        <Feather name="check" size={11} color="#FFFFFF" />
                      ) : null}
                    </View>
                    <Text style={styles.confirmLabel}>
                      I understand this request runs against live data.
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <Text style={styles.helperText}>
                Test keys use the same API contract as live keys. Test data lives in the
                same account, so delete what you create.
              </Text>
            )}

            <View style={styles.actions}>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => void run()}
                disabled={running}
                style={[styles.sendButton, running && styles.sendButtonDisabled]}
              >
                {running ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Feather name="play" size={14} color="#FFFFFF" />
                )}
                <Text style={styles.sendLabel}>
                  {running ? 'Sending…' : 'Send request'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => {
                  setResponse(null);
                  setRequestError(null);
                  setValidationError(null);
                }}
                style={styles.secondaryButton}
              >
                <Feather name="rotate-ccw" size={13} color={DocsColors.textSecondary} />
                <Text style={styles.secondaryLabel}>Clear result</Text>
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => void copyCurl()}
                style={styles.secondaryButton}
              >
                <Feather
                  name={copiedCurl ? 'check' : 'copy'}
                  size={13}
                  color={copiedCurl ? DocsColors.success : DocsColors.textSecondary}
                />
                <Text
                  style={[
                    styles.secondaryLabel,
                    copiedCurl && { color: DocsColors.success },
                  ]}
                >
                  {copiedCurl ? 'cURL copied' : 'Copy cURL'}
                </Text>
              </TouchableOpacity>
            </View>

            {validationError ? (
              <View style={styles.errorBox}>
                <Feather name="alert-circle" size={14} color={DocsColors.danger} />
                <Text style={styles.errorText}>{validationError}</Text>
              </View>
            ) : null}
            {requestError ? (
              <View style={styles.errorBox}>
                <Feather name="wifi-off" size={14} color={DocsColors.danger} />
                <Text style={styles.errorText}>{requestError}</Text>
              </View>
            ) : null}
          </SectionCard>
        </View>

        <View style={styles.column}>
          <SectionCard
            title="Response"
            icon="download"
            right={response ? <StatusBadge response={response} /> : undefined}
          >
            {!response ? (
              <View style={styles.emptyState}>
                <Feather name="terminal" size={22} color={DocsColors.textMuted} />
                <Text style={styles.emptyTitle}>No request sent yet</Text>
                <Text style={styles.emptyText}>
                  The playground sends a real HTTP request to the LinkFlow API. Responses
                  here are exactly what the server returned.
                </Text>
              </View>
            ) : (
              <View style={{ gap: DocsSpacing.sm }}>
                <View style={styles.responseMeta}>
                  <Text style={styles.responseMetaText}>
                    {response.durationMs} ms
                  </Text>
                  <Text style={styles.responseMetaDot}>•</Text>
                  <Text style={styles.responseMetaText}>
                    {formatBytes(response.sizeBytes)}
                  </Text>
                  {response.contentType ? (
                    <>
                      <Text style={styles.responseMetaDot}>•</Text>
                      <Text style={styles.responseMetaText} numberOfLines={1}>
                        {response.contentType.split(';')[0]}
                      </Text>
                    </>
                  ) : null}
                </View>
                <CodeBlock
                  code={prettyResponse}
                  language={responseIsJson ? 'json' : 'text'}
                  label={responseIsJson ? 'JSON response' : 'Response body'}
                />
              </View>
            )}
          </SectionCard>

          <SectionCard title="Equivalent cURL" icon="code">
            <Text style={styles.helperText}>
              The API key is replaced with <Text style={styles.scopeValue}>$LINKFLOW_API_KEY</Text>{' '}
              so the command never contains your credential.
            </Text>
            <CodeBlock code={curl} language="bash" label="Shell" />
          </SectionCard>

          {endpoint.notes.length > 0 ? (
            <SectionCard title="Endpoint notes" icon="info">
              {endpoint.notes.map((note) => (
                <View key={note} style={styles.noteRow}>
                  <Text style={styles.noteBullet}>•</Text>
                  <Text style={styles.noteText}>{note}</Text>
                </View>
              ))}
            </SectionCard>
          ) : null}
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <Text style={styles.footnote}>
          Base URL {baseUrl} · credentials never leave this screen except as the
          X-API-Key header of the request you send.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: DocsSpacing.md },
  categoryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  categoryChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: DocsRadius.sm,
    borderWidth: 1,
    borderColor: DocsColors.border,
    backgroundColor: DocsColors.surface,
  },
  categoryChipActive: {
    backgroundColor: DocsColors.primaryBg,
    borderColor: DocsColors.primaryBorder,
  },
  categoryLabel: { color: DocsColors.textSecondary, fontSize: 12.5, fontWeight: '700' },
  categoryLabelActive: { color: DocsColors.primarySoft },
  endpointList: {
    borderWidth: 1,
    borderColor: DocsColors.border,
    borderRadius: DocsRadius.md,
    overflow: 'hidden',
    backgroundColor: DocsColors.surface,
  },
  endpointRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingHorizontal: DocsSpacing.md,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: DocsColors.border,
  },
  endpointRowActive: { backgroundColor: DocsColors.surfaceRaised },
  endpointPath: {
    color: DocsColors.textSecondary,
    fontFamily: DocsMonoFont,
    fontSize: 12,
    flexShrink: 1,
  },
  endpointPathActive: { color: DocsColors.text },
  endpointName: {
    flex: 1,
    textAlign: 'right',
    color: DocsColors.textMuted,
    fontSize: 11.5,
  },
  columns: { gap: DocsSpacing.md },
  columnsWide: { flexDirection: 'row', alignItems: 'flex-start' },
  columnsStacked: { flexDirection: 'column' },
  column: { flex: 1, minWidth: 0, gap: DocsSpacing.md },
  card: {
    borderWidth: 1,
    borderColor: DocsColors.border,
    borderRadius: DocsRadius.md,
    backgroundColor: DocsColors.surface,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: DocsSpacing.md,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: DocsColors.border,
    backgroundColor: DocsColors.surfaceRaised,
  },
  cardTitle: {
    color: DocsColors.text,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  cardBody: { padding: DocsSpacing.md, gap: DocsSpacing.sm },
  urlPreview: {
    color: DocsColors.primarySoft,
    fontFamily: DocsMonoFont,
    fontSize: 12,
    lineHeight: 18,
  },
  scopeNote: { color: DocsColors.textMuted, fontSize: 11.5, lineHeight: 17 },
  scopeValue: { color: DocsColors.textSecondary, fontFamily: DocsMonoFont },
  fieldGroup: { gap: DocsSpacing.sm, marginTop: 4 },
  fieldLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginBottom: 5,
    flexWrap: 'wrap',
  },
  fieldLabel: { color: DocsColors.text, fontSize: 11.5, fontWeight: '700' },
  requiredMark: {
    color: DocsColors.warning,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  fieldHint: { color: DocsColors.textMuted, fontSize: 10.5 },
  input: {
    borderWidth: 1,
    borderColor: DocsColors.border,
    borderRadius: DocsRadius.sm,
    backgroundColor: DocsColors.backgroundAlt,
    color: DocsColors.text,
    fontSize: 13,
    paddingHorizontal: 11,
    paddingVertical: 9,
  },
  inputMono: { fontFamily: DocsMonoFont, fontSize: 12 },
  inputMultiline: { minHeight: 150, textAlignVertical: 'top', lineHeight: 18 },
  keyRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  keyInput: { flex: 1 },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: DocsRadius.sm,
    borderWidth: 1,
    borderColor: DocsColors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  maskNote: { color: DocsColors.textMuted, fontSize: 10.5, fontFamily: DocsMonoFont },
  environmentRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  environmentChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 8,
    borderRadius: DocsRadius.sm,
    borderWidth: 1,
    borderColor: DocsColors.border,
  },
  environmentChipTest: {
    backgroundColor: DocsColors.successBg,
    borderColor: DocsColors.successBorder,
  },
  environmentChipLive: {
    backgroundColor: DocsColors.dangerBg,
    borderColor: DocsColors.dangerBorder,
  },
  environmentDot: { width: 6, height: 6, borderRadius: 3 },
  environmentLabel: { color: DocsColors.textSecondary, fontSize: 11.5, fontWeight: '700' },
  liveWarning: {
    flexDirection: 'row',
    gap: 8,
    borderWidth: 1,
    borderColor: DocsColors.warningBorder,
    backgroundColor: DocsColors.warningBg,
    borderRadius: DocsRadius.sm,
    padding: DocsSpacing.sm,
  },
  liveWarningText: { color: DocsColors.textSecondary, fontSize: 11, lineHeight: 16 },
  confirmRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  checkbox: {
    width: 16,
    height: 16,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: DocsColors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: DocsColors.primary,
    borderColor: DocsColors.primary,
  },
  confirmLabel: { flex: 1, color: DocsColors.text, fontSize: 11, lineHeight: 16 },
  helperText: { color: DocsColors.textMuted, fontSize: 11, lineHeight: 16 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
  sendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: DocsColors.primary,
    borderRadius: DocsRadius.sm,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  sendButtonDisabled: { opacity: 0.7 },
  sendLabel: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: DocsColors.border,
    borderRadius: DocsRadius.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  secondaryLabel: { color: DocsColors.textSecondary, fontSize: 11.5, fontWeight: '600' },
  errorBox: {
    flexDirection: 'row',
    gap: 8,
    borderWidth: 1,
    borderColor: DocsColors.dangerBorder,
    backgroundColor: DocsColors.dangerBg,
    borderRadius: DocsRadius.sm,
    padding: DocsSpacing.sm,
    marginTop: 4,
  },
  errorText: { flex: 1, color: DocsColors.text, fontSize: 11.5, lineHeight: 17 },
  emptyState: { alignItems: 'center', gap: 7, paddingVertical: DocsSpacing.xl },
  emptyTitle: { color: DocsColors.text, fontSize: 13, fontWeight: '700' },
  emptyText: {
    color: DocsColors.textMuted,
    fontSize: 11.5,
    lineHeight: 17,
    textAlign: 'center',
    maxWidth: 320,
  },
  responseMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  responseMetaText: { color: DocsColors.textSecondary, fontSize: 11, fontFamily: DocsMonoFont },
  responseMetaDot: { color: DocsColors.textMuted, fontSize: 11 },
  noteRow: { flexDirection: 'row', gap: 8, marginBottom: 6 },
  noteBullet: { color: DocsColors.primarySoft, fontSize: 12, lineHeight: 18 },
  noteText: { flex: 1, color: DocsColors.textSecondary, fontSize: 11.5, lineHeight: 18 },
  footnote: { color: DocsColors.textMuted, fontSize: 10.5, fontFamily: DocsMonoFont },
});
