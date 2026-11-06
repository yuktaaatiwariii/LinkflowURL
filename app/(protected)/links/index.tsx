import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { useRouter } from 'expo-router';
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
import { createShortLink, fetchUserLinks } from '../../../src/services/api';

export default function LinksScreen() {
  const router = useRouter();
  const { getToken } = useAuth();
  const isDesktop = useIsDesktop();

  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [alias, setAlias] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [links, setLinks] = useState<any[]>([]);

  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const loadLinks = useCallback(async () => {
    try {
      const token = await getToken();
      if (token) {
        const res = await fetchUserLinks(token);
        if (res.data?.links) {
          setLinks(res.data.links);
        }
      }
    } catch (e: any) {
      console.warn('Load links error:', e.message);
    } finally {
      setFetching(false);
    }
  }, [getToken]);

  useEffect(() => {
    loadLinks();
  }, [loadLinks]);

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
        setSuccessMessage(`Short link created: linkflow.url/${res.data.link.short_code}`);
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

  const formWidth = isDesktop ? 480 : '100%';

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.background} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
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

            {/* User Links List */}
            <View style={[styles.listSection, { width: formWidth, alignSelf: isDesktop ? 'center' : 'stretch' }]}>
              <Section title="Your Short Links" />
              {fetching ? (
                <ActivityIndicator color={Colors.accent} style={{ marginTop: 20, alignSelf: 'center' }} />
              ) : links.length === 0 ? (
                <Card style={styles.emptyCard} variant="secondary">
                  <Text style={styles.emptyTitle}>No links created yet</Text>
                  <Text style={styles.emptyText}>Create your first link using the form above.</Text>
                </Card>
              ) : (
                <View style={styles.linksList}>
                  {links.map((link) => (
                    <Card key={link.id} style={styles.linkCard} variant="elevated">
                      <Text style={styles.linkTitle}>{link.title || link.short_code}</Text>
                      <Text style={styles.shortUrl}>linkflow.url/{link.short_code}</Text>
                      <Text style={styles.originalUrl} numberOfLines={2}>
                        {link.original_url}
                      </Text>
                    </Card>
                  ))}
                </View>
              )}
            </View>
          </ResponsiveContainer>
        </ScrollView>
      </KeyboardAvoidingView>
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
  listSection: {
    width: '100%',
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  linkTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
    flex: 1,
  },
  shortUrl: {
    fontSize: 13,
    color: Colors.accentLight,
    fontWeight: '600',
    marginBottom: 4,
  },
  originalUrl: {
    fontSize: 12,
    color: Colors.textMuted,
  },
}) as any;
