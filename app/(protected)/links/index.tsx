import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  ActivityIndicator,
  Clipboard,
  Share,
  ViewStyle,
  TextStyle,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { openURL } from 'expo-linking';
import { useAuth } from '@clerk/expo';
import { Colors } from '../../../src/constants/colors';
import {
  CustomButton,
  CustomInput,
  Card,
  AlertBanner,
  AppIcon,
  ResponsiveContainer,
  Section,
} from '../../../src/components';
import { useIsDesktop } from '../../../src/hooks/useBreakpoint';
import { createShortLink, fetchUserLinks, getShortUrlBase, deleteShortLink } from '../../../src/services/api';
import { isValidHttpUrl } from '../../../src/utils/url';

export default function LinksScreen() {
  const router = useRouter();
  const { getToken } = useAuth();
  const isDesktop = useIsDesktop();
  const params = useLocalSearchParams<{ url?: string | string[] }>();

  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [alias, setAlias] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [links, setLinks] = useState<any[]>([]);

  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [copyStatus, setCopyStatus] = useState<'idle' | 'success' | 'error' | null>(null);
  const [copyTarget, setCopyTarget] = useState<string | null>(null);
  const [shortUrlBase, setShortUrlBase] = useState<string>('');
  const [deletingLink, setDeletingLink] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<boolean>(false);
  const [linkToDelete, setLinkToDelete] = useState<{ id: string; shortCode: string } | null>(null);
  // The last created link is kept in a persistent card instead of a banner, so
  // the layout does not jump when the confirmation disappears.
  const [createdLink, setCreatedLink] = useState<{
    shortCode: string;
    title: string | null;
    originalUrl: string;
  } | null>(null);

  const loadLinks = useCallback(async (showSpinner = false) => {
    if (showSpinner) setFetching(true);
    try {
      const token = await getToken();
      if (!token) {
        setLoadError('Your session has expired. Please sign in again.');
        return;
      }
      const res = await fetchUserLinks(token);
      if (res.error) {
        setLoadError(res.error);
        return;
      }
      const list = res.data?.links;
      if (!Array.isArray(list)) {
        setLoadError('The server returned an unexpected links response.');
        return;
      }
      setLinks(list);
      setLoadError('');
    } catch (e: any) {
      setLoadError(e?.message || 'Unable to load your links.');
    } finally {
      setFetching(false);
    }
  }, [getToken]);

  useEffect(() => {
    loadLinks(true);
  }, [loadLinks]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadLinks(false);
    setRefreshing(false);
  }, [loadLinks]);

  useEffect(() => {
    setShortUrlBase(getShortUrlBase());
  }, []);

  /**
   * Prefills the destination field when the screen is opened with a URL
   * (share target, clipboard suggestion or QR scanner). Text that the user
   * already typed is never overwritten.
   */
  useEffect(() => {
    const incoming = Array.isArray(params.url) ? params.url[0] : params.url;
    if (!incoming || !isValidHttpUrl(incoming)) return;
    setUrl((current) => (current.trim() ? current : incoming));
  }, [params.url]);

  const handleCreateLink = async () => {
    setErrorMessage('');
    setSuccessMessage('');

    if (!url.trim()) {
      setErrorMessage('Please enter a destination URL.');
      return;
    }

    let finalUrl = url.trim();
    if (!/^https?:\/\//i.test(finalUrl)) {
      finalUrl = `https://${finalUrl}`;
    }

    setLoading(true);
    try {
      const token = await getToken();
      if (!token) {
        setErrorMessage('Session expired. Please sign in again.');
        return;
      }

      const res = await createShortLink(token, finalUrl, title.trim() || undefined, alias.trim() || undefined);
      if (res.data?.success && res.data?.link) {
        setCreatedLink({
          shortCode: res.data.link.short_code,
          title: res.data.link.title || null,
          originalUrl: res.data.link.original_url || finalUrl,
        });
        setUrl('');
        setTitle('');
        setAlias('');
        loadLinks();
      } else {
        setErrorMessage(res.error || 'Failed to create short link.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error communicating with backend.');
    } finally {
      setLoading(false);
    }
  };

  const copyShortUrl = async (shortCode: string) => {
    const fullUrl = `${shortUrlBase}${shortCode}`;
    setCopyStatus('idle');
    setCopyTarget(shortCode);
    try {
      await Clipboard.setString(fullUrl);
      setCopyStatus('success');
      setSuccessMessage('Link copied successfully!');
      setTimeout(() => {
        setCopyStatus(null);
        setCopyTarget(null);
      }, 2000);
    } catch (err) {
      console.error('Copy error:', err);
      setCopyStatus('error');
      setErrorMessage('Failed to copy link. Please try again.');
      setTimeout(() => {
        setCopyStatus(null);
        setCopyTarget(null);
      }, 3000);
    }
  };

  const openShortUrl = (shortCode: string) => {
    const fullUrl = `${shortUrlBase}${shortCode}`;
    openURL(fullUrl).catch((err: any) => {
      console.error('Open URL error:', err);
      setErrorMessage('Failed to open link. Please try again.');
    });
  };

  const shareShortUrl = async (shortCode: string) => {
    const fullUrl = `${shortUrlBase}${shortCode}`;
    try {
      await Share.share({
        message: fullUrl,
        title: 'Share your LinkFlow link',
      });
    } catch (err: any) {
      console.error('Share link error:', err);
      setErrorMessage('Failed to share the link. Please try again.');
    }
  };

  const confirmDeleteLink = (id: string, shortCode: string) => {
    setLinkToDelete({ id, shortCode });
    setShowDeleteConfirm(true);
  };

  const deleteLink = async () => {
    if (!linkToDelete) return;
    setDeletingLink(linkToDelete.id);
    try {
      const token = await getToken();
      if (!token) {
        setErrorMessage('Session expired. Please sign in again.');
        setDeletingLink(null);
        setShowDeleteConfirm(false);
        setLinkToDelete(null);
        return;
      }
      const res = await deleteShortLink(token, linkToDelete.id);
      if (res.error) {
        setErrorMessage(res.error || 'Failed to delete link.');
      } else {
        setSuccessMessage('Link deleted successfully.');
        setLinks(links.filter((l) => l.id !== linkToDelete.id));
      }
    } catch (err: any) {
      console.error('Delete link error:', err);
      setErrorMessage(err.message || 'Failed to delete link.');
    } finally {
      setDeletingLink(null);
      setShowDeleteConfirm(false);
      setLinkToDelete(null);
    }
  };

  const formWidth = isDesktop ? 480 : '100%';

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.background} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={Colors.accent}
              colors={[Colors.accent]}
            />
          }
        >
          <ResponsiveContainer padding={24} centerOnDesktop={isDesktop}>
            {/* Back Button */}
            <TouchableOpacity
              style={styles.backBtn}
              onPress={() => router.back()}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <AppIcon name="arrow-left" size={20} color={Colors.textSecondary} />
            </TouchableOpacity>

            <View style={styles.header as ViewStyle}>
              <Text style={[styles.title as TextStyle, { fontSize: isDesktop ? 30 : 26 }]}>Shorten Links</Text>
              <Text style={styles.subtitle}>
                Create clean, trackable short URLs instantly.
              </Text>
            </View>

            {!!errorMessage && <AlertBanner type="error" message={errorMessage} />}
            {!!successMessage && <AlertBanner type="success" message={successMessage} />}

            {/* Creation Form */}
            <View style={[styles.formCardWrapper, { width: formWidth, alignSelf: isDesktop ? 'center' : 'stretch' }]}>
              <Card style={styles.formCard} variant="elevated">
                <CustomInput
                  label="Destination URL"
                  placeholder="https://yourwebsite.com/long-page-path"
                  value={url}
                  onChangeText={setUrl}
                  keyboardType="url"
                  autoCapitalize="none"
                  icon={<AppIcon name="link" size={18} color={Colors.textSecondary} />}
                />

                <CustomInput
                  label="Title (Optional)"
                  placeholder="e.g. Portfolio Website"
                  value={title}
                  onChangeText={setTitle}
                  autoCapitalize="words"
                />

                <CustomInput
                  label="Custom Alias (Optional)"
                  placeholder="e.g. my-site"
                  value={alias}
                  onChangeText={setAlias}
                  autoCapitalize="none"
                />

                <CustomButton
                  title="Generate Short Link"
                  size="md"
                  variant="primary"
                  loading={loading}
                  onPress={handleCreateLink}
                  fullWidth
                />
              </Card>
            </View>

            {/* Last created link — a stable card instead of a transient banner */}
            {createdLink && (
              <View style={[styles.formCardWrapper, { width: formWidth, alignSelf: isDesktop ? 'center' : 'stretch' }]}>
                <Card style={styles.resultCard} variant="elevated">
                  <View style={styles.resultHeader}>
                    <View style={styles.resultIcon}>
                      <AppIcon name="check" size={18} color={Colors.success} />
                    </View>
                    <View style={styles.resultCopy}>
                      <Text style={styles.resultTitle}>Short link ready</Text>
                      <Text style={styles.resultSubtitle} numberOfLines={1}>
                        {createdLink.title || createdLink.originalUrl}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.resultUrlBox}>
                    <Text style={styles.resultUrl} selectable numberOfLines={2}>
                      {shortUrlBase}
                      {createdLink.shortCode}
                    </Text>
                  </View>

                  <View style={styles.resultActions}>
                    <TouchableOpacity
                      style={styles.resultAction}
                      onPress={() => copyShortUrl(createdLink.shortCode)}
                      activeOpacity={0.85}
                      accessibilityRole="button"
                      accessibilityLabel="Copy the new short link"
                    >
                      <AppIcon name="copy" size={16} color={Colors.textSecondary} />
                      <Text style={styles.resultActionText}>Copy</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.resultAction}
                      onPress={() => shareShortUrl(createdLink.shortCode)}
                      activeOpacity={0.85}
                      accessibilityRole="button"
                      accessibilityLabel="Share the new short link"
                    >
                      <AppIcon name="send" size={16} color={Colors.textSecondary} />
                      <Text style={styles.resultActionText}>Share</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.resultAction}
                      onPress={() => openShortUrl(createdLink.shortCode)}
                      activeOpacity={0.85}
                      accessibilityRole="button"
                      accessibilityLabel="Open the new short link"
                    >
                      <AppIcon name="external" size={16} color={Colors.textSecondary} />
                      <Text style={styles.resultActionText}>Open</Text>
                    </TouchableOpacity>
                  </View>
                </Card>
              </View>
            )}

            {/* User Links List */}
            <View style={[styles.listSection, { width: formWidth, alignSelf: isDesktop ? 'center' : 'stretch' }]}>
              <Section title="Your Short Links" />
              {fetching ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator color={Colors.accent} size="large" />
                  <Text style={styles.loadingText}>Loading your links…</Text>
                </View>
              ) : loadError ? (
                <Card style={styles.errorCard} variant="secondary">
                  <AppIcon name="x" size={28} color={Colors.error} />
                  <Text style={styles.errorTitle}>Could not load your links</Text>
                  <Text style={styles.errorText}>{loadError}</Text>
                  <CustomButton
                    title="Retry"
                    size="sm"
                    variant="primary"
                    onPress={() => loadLinks(true)}
                  />
                </Card>
              ) : links.length === 0 ? (
                <Card style={styles.emptyCard} variant="secondary">
                  <Text style={styles.emptyTitle}>No links created yet</Text>
                  <Text style={styles.emptyText}>Create your first link using the form above.</Text>
                </Card>
              ) : (
                <View style={styles.linksList}>
                  {links.map((link) => (
                    <Card key={link.id} style={styles.linkCard} variant="elevated">
                      <View style={styles.linkContent}>
                        <View style={styles.linkInfo}>
                          <Text style={styles.linkTitle}>{link.title || link.short_code}</Text>
                          <Text
                            style={[styles.shortUrlInput, { color: Colors.accentLight }]}
                            selectable={true}
                          >
                            {`${shortUrlBase}${link.short_code}`}
                          </Text>
                          <Text style={styles.originalUrl} numberOfLines={2}>
                            {link.original_url}
                          </Text>
                        </View>
                        <View style={styles.linkActions}>
                          <TouchableOpacity
                            style={styles.actionBtn}
                            onPress={() => copyShortUrl(link.short_code)}
                            disabled={copyTarget === link.short_code && copyStatus !== null}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          >
                            <AppIcon
                              name="copy"
                              size={18}
                              color={
                                copyTarget === link.short_code && copyStatus === 'success'
                                  ? Colors.success
                                  : Colors.textSecondary
                              }
                            />
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.actionBtn}
                            onPress={() => openShortUrl(link.short_code)}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          >
                            <AppIcon name="external" size={18} color={Colors.textSecondary} />
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.actionBtn, styles.deleteBtn]}
                            onPress={() => confirmDeleteLink(link.id, link.short_code)}
                            disabled={deletingLink === link.id}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          >
                            <AppIcon
                              name="trash"
                              size={18}
                              color={deletingLink === link.id ? Colors.textMuted : Colors.error}
                            />
                          </TouchableOpacity>
                        </View>
                      </View>
                    </Card>
                  ))}
                </View>
              )}
            </View>
          </ResponsiveContainer>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && linkToDelete && (
        <View style={styles.confirmDialogOverlay}>
          <View style={styles.confirmDialog}>
            <Text style={styles.confirmTitle}>Delete Link</Text>
            <Text style={styles.confirmMessage}>
              Are you sure you want to delete the short link {`${shortUrlBase}${linkToDelete.shortCode}`}?
            </Text>
            <View style={styles.confirmActions}>
              <TouchableOpacity
                style={styles.confirmCancelBtn}
                onPress={() => {
                  setShowDeleteConfirm(false);
                  setLinkToDelete(null);
                }}
              >
                <Text style={styles.confirmCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmDeleteBtn, deletingLink === linkToDelete.id && styles.confirmDeleteBtnDisabled]}
                onPress={deleteLink}
                disabled={deletingLink === linkToDelete.id}
              >
                <Text style={styles.confirmDeleteText}>
                  {deletingLink === linkToDelete.id ? 'Deleting...' : 'Delete'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    alignSelf: 'flex-start',
  },
  header: {
    marginBottom: 28,
  },
  title: {
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 15,
    color: Colors.textSecondary,
    lineHeight: 22,
  },
  formCardWrapper: {
    marginBottom: 28,
    width: '100%',
  },
  formCard: {
    padding: 20,
    width: '100%',
  },
  resultCard: {
    padding: 18,
    width: '100%',
    borderColor: Colors.borderLight,
    gap: 14,
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  resultIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: Colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultCopy: {
    flex: 1,
    gap: 2,
  },
  resultTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  resultSubtitle: {
    fontSize: 12.5,
    color: Colors.textSecondary,
  },
  resultUrlBox: {
    backgroundColor: Colors.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 13,
    paddingVertical: 11,
  },
  resultUrl: {
    fontSize: 13.5,
    fontWeight: '600',
    color: Colors.accentLight,
  },
  resultActions: {
    flexDirection: 'row',
    gap: 10,
  },
  resultAction: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 11,
    borderRadius: 11,
    backgroundColor: Colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  resultActionText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  listSection: {
    width: '100%',
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 28,
    gap: 10,
  },
  loadingText: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  errorCard: {
    alignItems: 'center',
    padding: 24,
    gap: 8,
    width: '100%',
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 13.5,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 6,
  },
  emptyCard: {
    alignItems: 'center',
    padding: 26,
    borderStyle: 'dashed',
    width: '100%',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 6,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  linksList: {
    gap: 12,
  },
  linkCard: {
    padding: 16,
    flexDirection: 'column',
    gap: 12,
  },
  linkContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    width: '100%',
  },
  linkInfo: {
    flex: 1,
    gap: 6,
  },
  linkTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  shortUrlInput: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.accentLight,
    backgroundColor: 'transparent',
    padding: 0,
    margin: 0,
    height: 20,
    width: '100%',
    textAlignVertical: 'center',
  },
  originalUrl: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  linkActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionBtn: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: Colors.surfaceSecondary,
  },
  deleteBtn: {
    backgroundColor: Colors.errorBg,
  },
  confirmDialogOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  confirmDialog: {
    backgroundColor: Colors.surfaceCard,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 16,
    padding: 24,
    width: '85%',
    maxWidth: 320,
  },
  confirmTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: 12,
    textAlign: 'center',
  },
  confirmMessage: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
    marginBottom: 20,
    textAlign: 'center',
  },
  confirmActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  confirmCancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
  },
  confirmCancelText: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  confirmDeleteBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: Colors.error,
    borderRadius: 10,
  },
  confirmDeleteBtnDisabled: {
    opacity: 0.6,
  },
  confirmDeleteText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
}) as any;
