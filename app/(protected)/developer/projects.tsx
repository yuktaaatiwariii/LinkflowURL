import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@clerk/expo';
import { Feather } from '@expo/vector-icons';
import {
  DevBadge,
  DevButton,
  DevCard,
  DevEmptyState,
  DevErrorState,
  DevIconButton,
  DevInput,
  DevLoading,
  DevPageHeader,
} from '../../../src/components/developer/DeveloperUI';
import { DevPage } from '../../../src/components/developer/DeveloperPage';
import { DeveloperConfirmModal, DeveloperModal } from '../../../src/components/developer/DeveloperModal';
import { useDeveloperToast } from '../../../src/components/developer/DeveloperToast';
import {
  apiErrorMessage,
  apiPayload,
  createDeveloperProject,
  deleteDeveloperProject,
  fetchDeveloperKeys,
  fetchDeveloperProjects,
  keysBelongingToProject,
  updateDeveloperProject,
  type DeveloperApiKey,
  type DeveloperProject,
} from '../../../src/services/developer';
import {
  DevColors,
  DevRadius,
  DevSpacing,
  formatDevDay,
  formatDevDate,
} from '../../../src/constants/developerTheme';

type EditorState =
  | { mode: 'create' }
  | { mode: 'edit'; project: DeveloperProject }
  | null;

export default function DeveloperProjectsScreen() {
  const router = useRouter();
  const { getToken } = useAuth();
  const { showToast } = useDeveloperToast();

  const [projects, setProjects] = useState<DeveloperProject[]>([]);
  const [keys, setKeys] = useState<DeveloperApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  const [editor, setEditor] = useState<EditorState>(null);
  const [name, setName] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<DeveloperProject | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const load = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      const id = ++requestId.current;
      if (mode === 'refresh') setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const token = await getToken();
        if (!token) {
          setError('Your session has expired. Please sign in again.');
          return;
        }
        const [projectResponse, keyResponse] = await Promise.all([
          fetchDeveloperProjects(token),
          fetchDeveloperKeys(token),
        ]);
        if (id !== requestId.current) return;
        const projectPayload = apiPayload(projectResponse);
        const keyPayload = apiPayload(keyResponse);
        if (!projectPayload || !keyPayload) {
          setError(
            apiErrorMessage(
              projectResponse.status >= 400 ? projectResponse : keyResponse,
              'Unable to load your projects.'
            )
          );
          return;
        }
        setProjects(projectPayload.projects);
        setKeys(keyPayload.keys);
      } catch {
        if (id === requestId.current) setError('Unable to load your projects. Please try again.');
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

  const groupedKeys = useMemo(() => {
    const map = new Map<string, DeveloperApiKey[]>();
    for (const project of projects) {
      map.set(project.id, keysBelongingToProject(project, keys));
    }
    return map;
  }, [keys, projects]);

  const openCreate = () => {
    setEditor({ mode: 'create' });
    setName('');
    setFormError(null);
  };

  const openEdit = (project: DeveloperProject) => {
    setEditor({ mode: 'edit', project });
    setName(project.name);
    setFormError(null);
  };

  const closeEditor = () => {
    if (saving) return;
    setEditor(null);
    setFormError(null);
  };

  const saveProject = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setFormError('Project name is required.');
      return;
    }
    if (trimmed.length > 100) {
      setFormError('Project name must not exceed 100 characters.');
      return;
    }
    if (!editor) return;

    setSaving(true);
    setFormError(null);
    try {
      const token = await getToken();
      if (!token) {
        setFormError('Your session has expired. Please sign in again.');
        return;
      }
      const response =
        editor.mode === 'create'
          ? await createDeveloperProject(token, trimmed)
          : await updateDeveloperProject(token, editor.project.id, trimmed);
      const payload = apiPayload(response);
      if (!payload) {
        setFormError(apiErrorMessage(response, 'Unable to save the project.'));
        return;
      }
      setProjects((current) => {
        if (editor.mode === 'create') return [payload, ...current];
        return current.map((project) => (project.id === payload.id ? payload : project));
      });
      showToast(editor.mode === 'create' ? 'Project created.' : 'Project updated.');
      setEditor(null);
    } catch {
      setFormError('Unable to save the project. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const askDelete = (project: DeveloperProject) => {
    const projectKeys = groupedKeys.get(project.id) || [];
    if (projectKeys.length > 0) {
      showToast(
        `This project still has ${projectKeys.length} API key${projectKeys.length === 1 ? '' : 's'}. Revoke them before deleting.`,
        'error'
      );
      return;
    }
    setDeleteTarget(project);
    setDeleteError(null);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const token = await getToken();
      if (!token) {
        setDeleteError('Your session has expired. Please sign in again.');
        return;
      }
      const response = await deleteDeveloperProject(token, deleteTarget.id);
      if (!apiPayload(response)) {
        setDeleteError(apiErrorMessage(response, 'Unable to delete the project.'));
        return;
      }
      setProjects((current) => current.filter((project) => project.id !== deleteTarget.id));
      showToast('Project deleted.');
      setDeleteTarget(null);
    } catch {
      setDeleteError('Unable to delete the project. Please try again.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <DevPage refreshing={refreshing} onRefresh={() => void load('refresh')}>
      <DevPageHeader
        eyebrow="Applications"
        title="Projects"
        subtitle="Organise your API credentials by application. Deleting a project is only possible once its keys are removed."
        actions={
          <DevButton label="New project" icon="plus" variant="primary" onPress={openCreate} />
        }
      />

      {loading && projects.length === 0 ? <DevLoading label="Loading projects…" /> : null}

      {error && projects.length === 0 ? (
        <DevErrorState message={error} onRetry={() => void load()} />
      ) : null}

      {!loading && !error && projects.length === 0 ? (
        <DevCard>
          <DevEmptyState
            icon="folder"
            title="No projects yet"
            message="Create your first project to group test and live keys for one application."
            action={<DevButton label="Create project" icon="plus" variant="primary" onPress={openCreate} />}
          />
        </DevCard>
      ) : null}

      {error && projects.length > 0 ? (
        <View style={{ marginBottom: DevSpacing.lg }}>
          <DevErrorState message={error} onRetry={() => void load()} />
        </View>
      ) : null}

      <View style={styles.grid}>
        {projects.map((project) => {
          const projectKeys = groupedKeys.get(project.id) || [];
          const environments = new Set(projectKeys.map((key) => key.environment));
          return (
            <DevCard key={project.id} style={styles.projectCard} padding={DevSpacing.lg}>
              <View style={styles.projectHeader}>
                <View style={styles.folderIcon}>
                  <Feather name="folder" size={18} color={DevColors.primarySoft} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.projectName} numberOfLines={1}>
                    {project.name}
                  </Text>
                  <Text style={styles.projectMeta}>
                    Created {formatDevDay(project.createdAt)} · Updated {formatDevDate(project.updatedAt)}
                  </Text>
                </View>
                <View style={styles.projectActions}>
                  <DevIconButton
                    icon="edit-2"
                    label={`Edit ${project.name}`}
                    onPress={() => openEdit(project)}
                  />
                  <DevIconButton
                    icon="trash-2"
                    label={`Delete ${project.name}`}
                    tone="danger"
                    onPress={() => askDelete(project)}
                  />
                </View>
              </View>

              <View style={styles.projectBadges}>
                {environments.has('live') ? <DevBadge label="Live" tone="primary" /> : null}
                {environments.has('test') ? <DevBadge label="Test" tone="info" /> : null}
                {environments.size === 0 ? <DevBadge label="No environment yet" tone="neutral" /> : null}
                <DevBadge
                  label={`${projectKeys.length} key${projectKeys.length === 1 ? '' : 's'}`}
                  tone={projectKeys.length > 0 ? 'success' : 'neutral'}
                />
              </View>

              <View style={styles.keyList}>
                {projectKeys.length === 0 ? (
                  <Text style={styles.noKeys}>
                    No API keys in this project yet. Create one to start making requests.
                  </Text>
                ) : (
                  projectKeys.map((key) => {
                    const expired =
                      key.expiresAt && new Date(key.expiresAt).getTime() <= Date.now();
                    const active = key.status === 'active' && !expired;
                    return (
                      <View key={key.id} style={styles.keyRow}>
                        <Feather
                          name={key.environment === 'live' ? 'zap' : 'cpu'}
                          size={13}
                          color={
                            key.environment === 'live' ? DevColors.primarySoft : DevColors.info
                          }
                        />
                        <Text style={styles.keyPrefix} numberOfLines={1}>
                          lf_{key.environment}_{key.keyPrefix}…
                        </Text>
                        <DevBadge
                          label={active ? 'Active' : expired ? 'Expired' : 'Revoked'}
                          tone={active ? 'success' : expired ? 'warning' : 'danger'}
                        />
                      </View>
                    );
                  })
                )}
              </View>

              <View style={styles.projectFooter}>
                <DevButton
                  label="Create API key"
                  size="sm"
                  variant="primary"
                  icon="plus"
                  onPress={() =>
                    router.navigate({
                      pathname: '/(protected)/developer/keys',
                      params: { create: '1', projectId: project.id },
                    } as any)
                  }
                />
                <Text style={styles.projectUsage}>
                  Last used {project.lastUsedAt ? formatDevDate(project.lastUsedAt) : 'never'}
                </Text>
              </View>
            </DevCard>
          );
        })}
      </View>

      <DeveloperModal
        visible={Boolean(editor)}
        onClose={closeEditor}
        title={editor?.mode === 'edit' ? 'Edit project' : 'New project'}
        subtitle="Group API keys that belong to the same application."
        dismissable={!saving}
        footer={
          <View style={styles.modalFooter}>
            <DevButton label="Cancel" variant="ghost" onPress={closeEditor} disabled={saving} />
            <DevButton
              label={editor?.mode === 'edit' ? 'Save changes' : 'Create project'}
              variant="primary"
              loading={saving}
              onPress={() => void saveProject()}
            />
          </View>
        }
      >
        <View style={{ gap: DevSpacing.md }}>
          <DevInput
            label="Project name"
            value={name}
            onChangeText={setName}
            placeholder="e.g. My Ecommerce App"
            maxLength={100}
            autoFocus
            error={formError || undefined}
            returnKeyType="done"
            onSubmitEditing={() => void saveProject()}
          />
          <Text style={styles.formHint}>
            Use a name your team recognises. Project names are unique per developer.
          </Text>
        </View>
      </DeveloperModal>

      <DeveloperConfirmModal
        visible={Boolean(deleteTarget)}
        title="Delete project"
        message={
          deleteTarget
            ? `Delete “${deleteTarget.name}”? This cannot be undone. Projects with API keys cannot be deleted.`
            : ''
        }
        confirmLabel="Delete project"
        destructive
        loading={deleting}
        onCancel={() => {
          if (!deleting) setDeleteTarget(null);
        }}
        onConfirm={() => void confirmDelete()}
      >
        {deleteError ? <Text style={styles.modalError}>{deleteError}</Text> : null}
      </DeveloperConfirmModal>
    </DevPage>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: DevSpacing.md,
  },
  projectCard: {
    flexGrow: 1,
    flexBasis: 360,
    minWidth: 300,
    maxWidth: 620,
  },
  projectHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: DevSpacing.md },
  folderIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: DevColors.primaryBg,
    borderWidth: 1,
    borderColor: DevColors.primaryBorder,
  },
  projectName: { color: DevColors.text, fontSize: 15, fontWeight: '700' },
  projectMeta: { color: DevColors.textMuted, fontSize: 10.5, marginTop: 4, lineHeight: 15 },
  projectActions: { flexDirection: 'row', gap: 6 },
  projectBadges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: DevSpacing.md },
  keyList: {
    marginTop: DevSpacing.md,
    borderWidth: 1,
    borderColor: DevColors.border,
    borderRadius: DevRadius.md,
    overflow: 'hidden',
    backgroundColor: DevColors.backgroundAlt,
  },
  keyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: DevColors.border,
  },
  keyPrefix: { color: DevColors.textSecondary, fontSize: 11, fontFamily: 'monospace', flex: 1 },
  noKeys: {
    color: DevColors.textMuted,
    fontSize: 11.5,
    lineHeight: 17,
    padding: 11,
  },
  projectFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: DevSpacing.sm,
    marginTop: DevSpacing.md,
    flexWrap: 'wrap',
  },
  projectUsage: { color: DevColors.textMuted, fontSize: 10.5 },
  modalFooter: { flexDirection: 'row', justifyContent: 'flex-end', gap: DevSpacing.sm },
  formHint: { color: DevColors.textMuted, fontSize: 11, lineHeight: 16 },
  modalError: { color: DevColors.danger, fontSize: 12, lineHeight: 17 },
});
