import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '@clerk/expo';
import { Feather } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import {
  DevBadge,
  DevButton,
  DevCard,
  DevCheckbox,
  DevEmptyState,
  DevErrorState,
  DevIconButton,
  DevInfoRow,
  DevInput,
  DevLoading,
  DevPageHeader,
  DevSegmented,
  DevSelect,
} from '../../../src/components/developer/DeveloperUI';
import { DevPage } from '../../../src/components/developer/DeveloperPage';
import { DeveloperConfirmModal, DeveloperModal } from '../../../src/components/developer/DeveloperModal';
import { useDeveloperToast } from '../../../src/components/developer/DeveloperToast';
import {
  apiErrorMessage,
  apiPayload,
  createDeveloperKey,
  createDeveloperProject,
  fetchDeveloperKeys,
  fetchDeveloperProjects,
  revokeDeveloperKey,
  rotateDeveloperKey,
  type DeveloperApiKey,
  type DeveloperApiKeyWithSecret,
  type DeveloperEnvironment,
  type DeveloperProject,
  type DeveloperScope,
} from '../../../src/services/developer';
import {
  DevColors,
  DevRadius,
  DevSpacing,
  formatDevDate,
  formatCount,
} from '../../../src/constants/developerTheme';
import { DEVELOPER_SCOPE_OPTIONS } from '../../../src/constants/developerApi';

const NEW_PROJECT = '__new__';

type KeyStatus = 'active' | 'revoked' | 'expired';

function keyStatus(key: DeveloperApiKey): KeyStatus {
  if (key.status === 'revoked') return 'revoked';
  if (key.expiresAt && new Date(key.expiresAt).getTime() <= Date.now()) return 'expired';
  return 'active';
}

function statusTone(status: KeyStatus) {
  return status === 'active' ? 'success' : status === 'expired' ? 'warning' : 'danger';
}

function keyLabel(key: DeveloperApiKey) {
  return `lf_${key.environment}_${key.keyPrefix}…`;
}

export default function DeveloperKeysScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ create?: string; projectId?: string }>();
  const { getToken } = useAuth();
  const { showToast } = useDeveloperToast();
  const { width } = useWindowDimensions();
  const isMobile = width < 780;

  const [keys, setKeys] = useState<DeveloperApiKey[]>([]);
  const [projects, setProjects] = useState<DeveloperProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  const [search, setSearch] = useState('');
  const [environmentFilter, setEnvironmentFilter] = useState<'all' | DeveloperEnvironment>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | KeyStatus>('all');
  const [projectFilter, setProjectFilter] = useState('all');

  const [createOpen, setCreateOpen] = useState(false);
  const [createProjectId, setCreateProjectId] = useState<string>('');
  const [newProjectName, setNewProjectName] = useState('');
  const [environment, setEnvironment] = useState<DeveloperEnvironment>('test');
  const [scopes, setScopes] = useState<DeveloperScope[]>(['links:read']);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [secret, setSecret] = useState<{
    key: DeveloperApiKeyWithSecret;
    title: string;
    note: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  const [rotateTarget, setRotateTarget] = useState<DeveloperApiKey | null>(null);
  const [rotating, setRotating] = useState(false);
  const [rotateError, setRotateError] = useState<string | null>(null);

  const [revokeTarget, setRevokeTarget] = useState<DeveloperApiKey | null>(null);
  const [revoking, setRevoking] = useState(false);
  const [revokeError, setRevokeError] = useState<string | null>(null);

  const [detailKey, setDetailKey] = useState<DeveloperApiKey | null>(null);
  const autoOpened = useRef(false);

  const load = useCallback(
    async (mode: 'initial' | 'refresh' | 'silent' = 'initial') => {
      const id = ++requestId.current;
      if (mode === 'refresh') setRefreshing(true);
      if (mode === 'initial') setLoading(true);
      if (mode !== 'silent') setError(null);

      try {
        const token = await getToken();
        if (!token) {
          if (mode !== 'silent') setError('Your session has expired. Please sign in again.');
          return;
        }
        const [keyResponse, projectResponse] = await Promise.all([
          fetchDeveloperKeys(token),
          fetchDeveloperProjects(token),
        ]);
        if (id !== requestId.current) return;
        const keyPayload = apiPayload(keyResponse);
        const projectPayload = apiPayload(projectResponse);
        if (!keyPayload || !projectPayload) {
          if (mode !== 'silent') {
            setError(
              apiErrorMessage(
                keyResponse.status >= 400 ? keyResponse : projectResponse,
                'Unable to load your API keys.'
              )
            );
          }
          return;
        }
        setKeys(keyPayload.keys);
        setProjects(projectPayload.projects);
      } catch {
        if (id === requestId.current && mode !== 'silent') {
          setError('Unable to load your API keys. Please try again.');
        }
      } finally {
        if (id === requestId.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [getToken]
  );

  useEffect(() => {
    void load();
  }, [load]);

  const openCreate = useCallback(
    (preferredProjectId?: string) => {
      setCreateProjectId(preferredProjectId || projects[0]?.id || NEW_PROJECT);
      setNewProjectName('');
      setEnvironment('test');
      setScopes(['links:read']);
      setCreateError(null);
      setCreateOpen(true);
    },
    [projects]
  );

  useEffect(() => {
    if (autoOpened.current || params.create !== '1' || loading) return;
    autoOpened.current = true;
    openCreate(typeof params.projectId === 'string' ? params.projectId : undefined);
  }, [loading, openCreate, params.create, params.projectId]);

  const projectOptions = useMemo(
    () => [
      ...projects.map((project) => ({
        value: project.id,
        label: project.name,
        description:
          project.keyCount === 0
            ? 'No keys yet'
            : `${project.keyCount} key${project.keyCount === 1 ? '' : 's'}`,
      })),
      { value: NEW_PROJECT, label: '＋ New project', description: 'Create a new project for this key' },
    ],
    [projects]
  );

  const filterProjectOptions = useMemo(
    () => [
      { value: 'all', label: 'All projects' },
      ...projects.map((project) => ({ value: project.id, label: project.name })),
    ],
    [projects]
  );

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return keys.filter((key) => {
      if (environmentFilter !== 'all' && key.environment !== environmentFilter) return false;
      if (statusFilter !== 'all' && keyStatus(key) !== statusFilter) return false;
      if (projectFilter !== 'all' && key.projectId !== projectFilter) return false;
      if (!needle) return true;
      return (
        key.projectName.toLowerCase().includes(needle) ||
        key.keyPrefix.toLowerCase().includes(needle) ||
        key.id.toLowerCase().includes(needle)
      );
    });
  }, [environmentFilter, keys, projectFilter, search, statusFilter]);

  const summary = useMemo(() => {
    const active = keys.filter((key) => keyStatus(key) === 'active').length;
    return {
      total: keys.length,
      active,
      test: keys.filter((key) => key.environment === 'test').length,
      live: keys.filter((key) => key.environment === 'live').length,
    };
  }, [keys]);

  const toggleScope = (scope: DeveloperScope) => {
    setScopes((current) =>
      current.includes(scope) ? current.filter((item) => item !== scope) : [...current, scope]
    );
  };

  const closeCreate = () => {
    if (creating) return;
    setCreateOpen(false);
    setCreateError(null);
  };

  const submitCreate = async () => {
    if (!createProjectId) {
      setCreateError('Select a project for this key.');
      return;
    }
    if (scopes.length === 0) {
      setCreateError('Select at least one permission scope.');
      return;
    }

    setCreating(true);
    setCreateError(null);
    try {
      const token = await getToken();
      if (!token) {
        setCreateError('Your session has expired. Please sign in again.');
        return;
      }

      let projectId = createProjectId;
      if (projectId === NEW_PROJECT) {
        const name = newProjectName.trim();
        if (!name) {
          setCreateError('Enter a name for the new project.');
          return;
        }
        const projectResponse = await createDeveloperProject(token, name);
        const project = apiPayload(projectResponse);
        if (!project) {
          setCreateError(apiErrorMessage(projectResponse, 'Unable to create the project.'));
          return;
        }
        projectId = project.id;
        setProjects((current) => [project, ...current]);
      }

      const response = await createDeveloperKey(token, {
        projectId,
        environment,
        scopes,
      });
      const payload = apiPayload(response);
      if (!payload) {
        setCreateError(apiErrorMessage(response, 'Unable to create the API key.'));
        return;
      }

      setCreateOpen(false);
      setSecret({
        key: payload,
        title: 'API key created',
        note: 'This is the only time the full key will be shown. Store it in a secure secrets manager.',
      });
      setCopied(false);
      showToast('API key created. Copy it now.');
      void load('silent');
    } catch {
      setCreateError('Unable to create the API key. Please try again.');
    } finally {
      setCreating(false);
    }
  };

  const closeSecret = () => {
    // Drop the plaintext secret from component state as soon as the modal closes.
    setSecret(null);
    setCopied(false);
  };

  const copySecret = async () => {
    if (!secret) return;
    await Clipboard.setStringAsync(secret.key.apiKey);
    setCopied(true);
    showToast('API key copied to clipboard.');
  };

  const openRotate = (key: DeveloperApiKey) => {
    setRotateTarget(key);
    setRotateError(null);
  };

  const confirmRotate = async () => {
    if (!rotateTarget) return;
    setRotating(true);
    setRotateError(null);
    try {
      const token = await getToken();
      if (!token) {
        setRotateError('Your session has expired. Please sign in again.');
        return;
      }
      const response = await rotateDeveloperKey(token, rotateTarget.id);
      const payload = apiPayload(response);
      if (!payload) {
        setRotateError(apiErrorMessage(response, 'Unable to rotate the API key.'));
        return;
      }
      setRotateTarget(null);
      setSecret({
        key: payload,
        title: 'API key rotated',
        note: 'The previous key has been invalidated immediately. Copy the new key now — it will not be shown again.',
      });
      setCopied(false);
      showToast('API key rotated. The previous key is now invalid.');
      void load('silent');
    } catch {
      setRotateError('Unable to rotate the API key. Please try again.');
    } finally {
      setRotating(false);
    }
  };

  const openRevoke = (key: DeveloperApiKey) => {
    setRevokeTarget(key);
    setRevokeError(null);
  };

  const confirmRevoke = async () => {
    if (!revokeTarget) return;
    setRevoking(true);
    setRevokeError(null);
    try {
      const token = await getToken();
      if (!token) {
        setRevokeError('Your session has expired. Please sign in again.');
        return;
      }
      const response = await revokeDeveloperKey(token, revokeTarget.id);
      const payload = apiPayload(response);
      if (!payload) {
        // Never pretend the revocation succeeded when the backend failed.
        setRevokeError(apiErrorMessage(response, 'Unable to revoke the API key.'));
        return;
      }
      setKeys((current) => current.map((key) => (key.id === payload.id ? payload : key)));
      setRevokeTarget(null);
      showToast('API key revoked.');
      void load('silent');
    } catch {
      setRevokeError('Unable to revoke the API key. Please try again.');
    } finally {
      setRevoking(false);
    }
  };

  const clearFilters = () => {
    setSearch('');
    setEnvironmentFilter('all');
    setStatusFilter('all');
    setProjectFilter('all');
  };

  const secretWarning = secret ? secret.note : '';

  return (
    <DevPage refreshing={refreshing} onRefresh={() => void load('refresh')}>
      <DevPageHeader
        eyebrow="Credentials"
        title="API Keys"
        subtitle="Create scoped test and live credentials, rotate them safely and revoke access immediately."
        actions={
          <DevButton label="Create API key" icon="plus" variant="primary" onPress={() => openCreate()} />
        }
      />

      <View style={styles.summaryRow}>
        <DevBadge label={`${formatCount(summary.total)} total`} tone="neutral" icon="key" />
        <DevBadge label={`${formatCount(summary.active)} active`} tone="success" icon="check-circle" />
        <DevBadge label={`${formatCount(summary.test)} test`} tone="info" icon="cpu" />
        <DevBadge label={`${formatCount(summary.live)} live`} tone="primary" icon="zap" />
      </View>

      <DevCard style={styles.securityNote} tone="raised">
        <View style={styles.securityRow}>
          <View style={styles.securityIcon}>
            <Feather name="shield" size={16} color={DevColors.primarySoft} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.securityTitle}>Secrets are shown once</Text>
            <Text style={styles.securityText}>
              LinkFlow stores only an HMAC digest of each key. The full secret is revealed a single time
              after creation or rotation. It is never written to local storage, session storage or logs.
            </Text>
          </View>
        </View>
      </DevCard>

      <View style={styles.filterRow}>
        <View style={styles.searchBox}>
          <DevInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search project, prefix or key id"
            icon="search"
            autoCapitalize="none"
          />
        </View>
        <View style={styles.filterItem}>
          <DevSelect<'all' | DeveloperEnvironment>
            label="Environment"
            value={environmentFilter}
            options={[
              { value: 'all', label: 'All environments' },
              { value: 'test', label: 'Test' },
              { value: 'live', label: 'Live' },
            ]}
            onChange={setEnvironmentFilter}
          />
        </View>
        <View style={styles.filterItem}>
          <DevSelect<'all' | KeyStatus>
            label="Status"
            value={statusFilter}
            options={[
              { value: 'all', label: 'All statuses' },
              { value: 'active', label: 'Active' },
              { value: 'expired', label: 'Expired' },
              { value: 'revoked', label: 'Revoked' },
            ]}
            onChange={setStatusFilter}
          />
        </View>
        <View style={styles.filterItem}>
          <DevSelect
            label="Project"
            value={projectFilter}
            options={filterProjectOptions}
            onChange={setProjectFilter}
          />
        </View>
      </View>

      {loading && keys.length === 0 ? <DevLoading label="Loading API keys…" /> : null}

      {error && keys.length === 0 ? <DevErrorState message={error} onRetry={() => void load()} /> : null}

      {!loading && !error && keys.length === 0 ? (
        <DevCard>
          <DevEmptyState
            icon="key"
            title="No API keys yet"
            message="Create a project and a scoped key to start calling the LinkFlow API. Test keys are perfect for development."
            action={<DevButton label="Create API key" icon="plus" variant="primary" onPress={() => openCreate()} />}
          />
        </DevCard>
      ) : null}

      {keys.length > 0 && filtered.length === 0 ? (
        <DevCard>
          <DevEmptyState
            icon="search"
            title="No keys match these filters"
            message="Try a different search term, environment, status or project."
            action={<DevButton label="Clear filters" size="sm" variant="outline" onPress={clearFilters} />}
          />
        </DevCard>
      ) : null}

      {filtered.length > 0 && isMobile ? (
        <View style={styles.mobileList}>
          {filtered.map((key) => {
            const status = keyStatus(key);
            return (
              <DevCard key={key.id} style={styles.keyCard}>
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => setDetailKey(key)}
                  style={styles.keyCardHeader}
                >
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.keyMono} numberOfLines={1}>
                      {keyLabel(key)}
                    </Text>
                    <Text style={styles.keyProject} numberOfLines={1}>
                      {key.projectName}
                    </Text>
                  </View>
                  <DevBadge label={status} tone={statusTone(status)} />
                </TouchableOpacity>
                <View style={styles.keyCardMeta}>
                  <DevBadge label={key.environment} tone={key.environment === 'live' ? 'primary' : 'info'} />
                  <Text style={styles.metaText}>{key.scopes.length} scopes</Text>
                  <Text style={styles.metaText}>Created {formatDevDate(key.createdAt)}</Text>
                </View>
                <View style={styles.keyCardActions}>
                  <DevButton
                    label="Rotate"
                    size="sm"
                    variant="secondary"
                    icon="refresh-cw"
                    onPress={() => openRotate(key)}
                    disabled={status !== 'active'}
                  />
                  <DevButton
                    label="Revoke"
                    size="sm"
                    variant="danger"
                    icon="slash"
                    onPress={() => openRevoke(key)}
                    disabled={status === 'revoked'}
                  />
                </View>
              </DevCard>
            );
          })}
        </View>
      ) : null}

      {filtered.length > 0 && !isMobile ? (
        <DevCard padding={0}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.table}>
              <View style={[styles.tableRow, styles.tableHead]}>
                <Text style={[styles.th, { flex: 1.8 }]}>Key</Text>
                <Text style={[styles.th, { flex: 1.3 }]}>Project</Text>
                <Text style={[styles.th, { width: 78 }]}>Env</Text>
                <Text style={[styles.th, { width: 92 }]}>Status</Text>
                <Text style={[styles.th, { width: 74 }]}>Scopes</Text>
                <Text style={[styles.th, { width: 132 }]}>Created</Text>
                <Text style={[styles.th, { width: 132 }]}>Last used</Text>
                <Text style={[styles.th, { width: 96, textAlign: 'right' }]}>Actions</Text>
              </View>
              {filtered.map((key) => {
                const status = keyStatus(key);
                return (
                  <TouchableOpacity
                    key={key.id}
                    activeOpacity={0.8}
                    onPress={() => setDetailKey(key)}
                    style={styles.tableRow}
                  >
                    <View style={{ flex: 1.8, minWidth: 0 }}>
                      <Text style={styles.keyMono} numberOfLines={1}>
                        {keyLabel(key)}
                      </Text>
                      <Text style={styles.keyId} numberOfLines={1}>
                        {key.id}
                      </Text>
                    </View>
                    <Text style={[styles.td, { flex: 1.3 }]} numberOfLines={1}>
                      {key.projectName}
                    </Text>
                    <View style={{ width: 78 }}>
                      <DevBadge
                        label={key.environment}
                        tone={key.environment === 'live' ? 'primary' : 'info'}
                      />
                    </View>
                    <View style={{ width: 92 }}>
                      <DevBadge label={status} tone={statusTone(status)} />
                    </View>
                    <Text style={[styles.td, { width: 74 }]}>{key.scopes.length}</Text>
                    <Text style={[styles.tdMuted, { width: 132 }]}>{formatDevDate(key.createdAt)}</Text>
                    <Text style={[styles.tdMuted, { width: 132 }]}>
                      {key.lastUsedAt ? formatDevDate(key.lastUsedAt) : 'Never'}
                    </Text>
                    <View style={[styles.rowActions, { width: 96 }]}>
                      <DevIconButton
                        icon="refresh-cw"
                        label="Rotate key"
                        onPress={() => openRotate(key)}
                        disabled={status !== 'active'}
                      />
                      <DevIconButton
                        icon="slash"
                        label="Revoke key"
                        tone="danger"
                        onPress={() => openRevoke(key)}
                        disabled={status === 'revoked'}
                      />
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>
        </DevCard>
      ) : null}

      {/* Create modal */}
      <DeveloperModal
        visible={createOpen}
        onClose={closeCreate}
        title="Create API key"
        subtitle="Choose a project, environment and the permissions this credential needs."
        dismissable={!creating}
        width={620}
        footer={
          <View style={styles.modalFooter}>
            <DevButton label="Cancel" variant="ghost" onPress={closeCreate} disabled={creating} />
            <DevButton
              label="Create key"
              variant="primary"
              icon="key"
              loading={creating}
              onPress={() => void submitCreate()}
            />
          </View>
        }
      >
        <View style={{ gap: DevSpacing.lg }}>
          <View style={{ gap: 6 }}>
            <Text style={styles.scopeTitle}>Project</Text>
            <View style={styles.projectPicker}>
              {projectOptions.map((option) => {
                const active = option.value === createProjectId;
                return (
                  <TouchableOpacity
                    key={option.value}
                    activeOpacity={0.82}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: active }}
                    onPress={() => setCreateProjectId(option.value)}
                    style={[styles.projectOption, active && styles.projectOptionActive]}
                  >
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text
                        style={[styles.projectOptionLabel, active && { color: DevColors.primarySoft }]}
                        numberOfLines={1}
                      >
                        {option.label}
                      </Text>
                      {option.description ? (
                        <Text style={styles.projectOptionDescription}>{option.description}</Text>
                      ) : null}
                    </View>
                    {active ? <Feather name="check" size={15} color={DevColors.primarySoft} /> : null}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
          {createProjectId === NEW_PROJECT ? (
            <DevInput
              label="New project name"
              value={newProjectName}
              onChangeText={setNewProjectName}
              placeholder="e.g. My Ecommerce App"
              maxLength={100}
            />
          ) : null}

          <View style={{ gap: 6 }}>
            <DevSegmented
              label="Environment"
              options={[
                { value: 'test', label: 'Test' },
                { value: 'live', label: 'Live' },
              ]}
              value={environment}
              onChange={(value) => setEnvironment(value as DeveloperEnvironment)}
            />
            <Text style={styles.formHint}>
              {environment === 'live'
                ? 'Live keys can read and modify production data. Keep the secret private.'
                : 'Test keys are intended for development and automated tests.'}
            </Text>
          </View>

          <View style={{ gap: DevSpacing.sm }}>
            <View style={styles.scopeHeader}>
              <Text style={styles.scopeTitle}>Permissions</Text>
              <View style={styles.scopeHeaderActions}>
                <DevButton
                  label="Select all"
                  size="sm"
                  variant="ghost"
                  onPress={() => setScopes(DEVELOPER_SCOPE_OPTIONS.map((option) => option.value))}
                />
                <DevButton label="Clear" size="sm" variant="ghost" onPress={() => setScopes([])} />
              </View>
            </View>
            {(['Links', 'QR codes', 'Analytics'] as const).map((group) => (
              <View key={group} style={{ gap: 7 }}>
                <Text style={styles.scopeGroup}>{group}</Text>
                {DEVELOPER_SCOPE_OPTIONS.filter((option) => option.group === group).map((option) => (
                  <DevCheckbox
                    key={option.value}
                    checked={scopes.includes(option.value)}
                    onToggle={() => toggleScope(option.value)}
                    label={`${option.label} · ${option.value}`}
                    description={option.description}
                  />
                ))}
              </View>
            ))}
          </View>

          {createError ? <Text style={styles.formError}>{createError}</Text> : null}
        </View>
      </DeveloperModal>

      {/* One-time secret reveal */}
      <DeveloperModal
        visible={Boolean(secret)}
        onClose={closeSecret}
        title={secret?.title || 'API key'}
        subtitle="Copy this credential now. It cannot be displayed again."
        width={600}
        footer={
          <View style={styles.modalFooter}>
            <DevButton label="I saved it securely" variant="ghost" onPress={closeSecret} />
            <DevButton
              label={copied ? 'Copied' : 'Copy API key'}
              icon={copied ? 'check' : 'copy'}
              variant="primary"
              onPress={() => void copySecret()}
            />
          </View>
        }
      >
        <View style={{ gap: DevSpacing.md }}>
          <View style={styles.warningBox}>
            <Feather name="alert-triangle" size={18} color={DevColors.warning} />
            <Text style={styles.warningText}>{secretWarning}</Text>
          </View>
          <View style={styles.secretBox}>
            <Text selectable style={styles.secretText}>
              {secret?.key.apiKey || ''}
            </Text>
          </View>
          <View style={styles.secretMeta}>
            <DevBadge
              label={secret?.key.environment || ''}
              tone={secret?.key.environment === 'live' ? 'primary' : 'info'}
            />
            <DevBadge label={secret?.key.projectName || ''} tone="neutral" />
            <DevBadge label={`${secret?.key.scopes.length || 0} scopes`} tone="neutral" />
          </View>
          <Text style={styles.formHint}>
            Store it in a password manager or your deployment secrets. Never commit it to source control
            or paste it into logs.
          </Text>
        </View>
      </DeveloperModal>

      {/* Rotate confirmation */}
      <DeveloperConfirmModal
        visible={Boolean(rotateTarget)}
        title="Rotate API key"
        message={
          rotateTarget
            ? `Rotate “${keyLabel(rotateTarget)}”? The current key will be invalidated immediately and a new secret will be shown once.`
            : ''
        }
        confirmLabel="Rotate key"
        loading={rotating}
        onCancel={() => {
          if (!rotating) setRotateTarget(null);
        }}
        onConfirm={() => void confirmRotate()}
      >
        {rotateError ? <Text style={styles.formError}>{rotateError}</Text> : null}
      </DeveloperConfirmModal>

      {/* Revoke confirmation */}
      <DeveloperConfirmModal
        visible={Boolean(revokeTarget)}
        title="Revoke API key"
        message={
          revokeTarget
            ? `Revoke “${keyLabel(revokeTarget)}”? Any application using it will immediately lose access. This cannot be undone.`
            : ''
        }
        confirmLabel="Revoke key"
        destructive
        loading={revoking}
        onCancel={() => {
          if (!revoking) setRevokeTarget(null);
        }}
        onConfirm={() => void confirmRevoke()}
      >
        {revokeError ? <Text style={styles.formError}>{revokeError}</Text> : null}
      </DeveloperConfirmModal>

      {/* Metadata detail */}
      <DeveloperModal
        visible={Boolean(detailKey)}
        onClose={() => setDetailKey(null)}
        title="API key details"
        subtitle="Metadata only. The secret cannot be recovered."
        width={560}
      >
        {detailKey ? (
          <View>
            <DevInfoRow label="Key" value={keyLabel(detailKey)} mono />
            <DevInfoRow label="Key id" value={detailKey.id} mono />
            <DevInfoRow label="Project" value={detailKey.projectName} />
            <DevInfoRow
              label="Environment"
              value={
                <DevBadge
                  label={detailKey.environment}
                  tone={detailKey.environment === 'live' ? 'primary' : 'info'}
                />
              }
            />
            <DevInfoRow
              label="Status"
              value={
                <DevBadge
                  label={keyStatus(detailKey)}
                  tone={statusTone(keyStatus(detailKey))}
                />
              }
            />
            <DevInfoRow label="Created" value={formatDevDate(detailKey.createdAt)} />
            <DevInfoRow label="Last used" value={detailKey.lastUsedAt ? formatDevDate(detailKey.lastUsedAt) : 'Never'} />
            <DevInfoRow label="Expires" value={detailKey.expiresAt ? formatDevDate(detailKey.expiresAt) : 'No expiry'} />
            <DevInfoRow label="Revoked" value={detailKey.revokedAt ? formatDevDate(detailKey.revokedAt) : 'Not revoked'} />
            <DevInfoRow label="Rotated from" value={detailKey.rotatedFromId || '—'} mono />
            <View style={{ marginTop: DevSpacing.md }}>
              <Text style={styles.scopeTitle}>Permissions</Text>
              <View style={styles.scopeWrap}>
                {detailKey.scopes.map((scope) => (
                  <DevBadge key={scope} label={scope} tone="neutral" />
                ))}
              </View>
            </View>
            <View style={styles.detailActions}>
              <DevButton
                label="Rotate key"
                size="sm"
                variant="secondary"
                icon="refresh-cw"
                disabled={keyStatus(detailKey) !== 'active'}
                onPress={() => {
                  const target = detailKey;
                  setDetailKey(null);
                  if (target) openRotate(target);
                }}
              />
              <DevButton
                label="Revoke key"
                size="sm"
                variant="danger"
                icon="slash"
                disabled={keyStatus(detailKey) === 'revoked'}
                onPress={() => {
                  const target = detailKey;
                  setDetailKey(null);
                  if (target) openRevoke(target);
                }}
              />
            </View>
          </View>
        ) : null}
      </DeveloperModal>

      {error && keys.length > 0 ? (
        <View style={{ marginTop: DevSpacing.lg }}>
          <DevErrorState message={error} onRetry={() => void load()} />
        </View>
      ) : null}

      <View style={styles.footerLinks}>
        <DevButton
          label="Manage projects"
          size="sm"
          variant="ghost"
          icon="folder"
          onPress={() => router.navigate('/(protected)/developer/projects' as any)}
        />
        <DevButton
          label="View request logs"
          size="sm"
          variant="ghost"
          icon="list"
          onPress={() => router.navigate('/(protected)/developer/logs' as any)}
        />
      </View>
    </DevPage>
  );
}

const styles = StyleSheet.create({
  summaryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: DevSpacing.sm,
    marginBottom: DevSpacing.lg,
  },
  securityNote: { marginBottom: DevSpacing.lg },
  securityRow: { flexDirection: 'row', alignItems: 'flex-start', gap: DevSpacing.md },
  securityIcon: {
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: DevColors.primaryBg,
    borderWidth: 1,
    borderColor: DevColors.primaryBorder,
  },
  securityTitle: { color: DevColors.text, fontSize: 12.5, fontWeight: '700' },
  securityText: { color: DevColors.textMuted, fontSize: 11.5, lineHeight: 17, marginTop: 3 },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-end',
    gap: DevSpacing.md,
    marginBottom: DevSpacing.lg,
  },
  searchBox: { flexGrow: 1, flexBasis: 260, minWidth: 220 },
  filterItem: { width: 170, minWidth: 150 },
  mobileList: { gap: DevSpacing.md },
  keyCard: { padding: DevSpacing.lg },
  keyCardHeader: { flexDirection: 'row', alignItems: 'center', gap: DevSpacing.md },
  keyMono: { color: DevColors.text, fontSize: 12.5, fontFamily: 'monospace', fontWeight: '600' },
  keyId: { color: DevColors.textMuted, fontSize: 10, fontFamily: 'monospace', marginTop: 3 },
  keyProject: { color: DevColors.textSecondary, fontSize: 11.5, marginTop: 3 },
  keyCardMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: DevSpacing.sm,
    marginTop: DevSpacing.md,
  },
  metaText: { color: DevColors.textMuted, fontSize: 10.5 },
  keyCardActions: { flexDirection: 'row', gap: DevSpacing.sm, marginTop: DevSpacing.md },
  table: { minWidth: 980, width: '100%' },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DevSpacing.sm,
    paddingHorizontal: DevSpacing.md,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: DevColors.border,
  },
  tableHead: { backgroundColor: DevColors.backgroundAlt },
  th: {
    color: DevColors.textMuted,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  td: { color: DevColors.textSecondary, fontSize: 11.5, paddingRight: 4 },
  tdMuted: { color: DevColors.textMuted, fontSize: 10.5, paddingRight: 4 },
  rowActions: { flexDirection: 'row', gap: 5, justifyContent: 'flex-end' },
  modalFooter: { flexDirection: 'row', justifyContent: 'flex-end', gap: DevSpacing.sm, flexWrap: 'wrap' },
  formHint: { color: DevColors.textMuted, fontSize: 11, lineHeight: 16 },
  formError: { color: DevColors.danger, fontSize: 12, lineHeight: 17 },
  scopeHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  scopeHeaderActions: { flexDirection: 'row', alignItems: 'center' },
  projectPicker: {
    borderWidth: 1,
    borderColor: DevColors.border,
    borderRadius: DevRadius.md,
    backgroundColor: DevColors.backgroundAlt,
    overflow: 'hidden',
  },
  projectOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 11,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: DevColors.border,
  },
  projectOptionActive: { backgroundColor: DevColors.primaryBg },
  projectOptionLabel: { color: DevColors.text, fontSize: 12.5, fontWeight: '600' },
  projectOptionDescription: { color: DevColors.textMuted, fontSize: 10.5, marginTop: 2 },
  scopeTitle: { color: DevColors.textSecondary, fontSize: 11.5, fontWeight: '700', letterSpacing: 0.3 },
  scopeGroup: { color: DevColors.primarySoft, fontSize: 10, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase' },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: DevColors.warningBg,
    borderWidth: 1,
    borderColor: DevColors.warningBorder,
    borderRadius: DevRadius.md,
    padding: 12,
  },
  warningText: { flex: 1, color: DevColors.warning, fontSize: 11.5, lineHeight: 17, fontWeight: '600' },
  secretBox: {
    backgroundColor: DevColors.backgroundAlt,
    borderWidth: 1,
    borderColor: DevColors.primaryBorder,
    borderRadius: DevRadius.md,
    padding: 14,
  },
  secretText: { color: DevColors.text, fontSize: 12.5, fontFamily: 'monospace', lineHeight: 20 },
  secretMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  scopeWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 3, marginTop: DevSpacing.sm, marginBottom: DevSpacing.sm },
  detailActions: { flexDirection: 'row', gap: DevSpacing.sm, marginTop: DevSpacing.lg, flexWrap: 'wrap' },
  footerLinks: { flexDirection: 'row', flexWrap: 'wrap', gap: DevSpacing.sm, marginTop: DevSpacing.xl },
});
