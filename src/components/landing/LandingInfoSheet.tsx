import React from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { AppIcon } from '../AppIcon';
import { G, L, glow } from './landingTheme';

export type InfoKind = 'about' | 'privacy' | 'terms' | 'contact';

type Block =
  | { type: 'p'; text: string }
  | { type: 'li'; text: string };

const CONTENT: Record<InfoKind, { title: string; intro: string; blocks: Block[] }> = {
  about: {
    title: 'About LinkFlow URL',
    intro: 'A focused workspace for links and QR codes.',
    blocks: [
      {
        type: 'p',
        text: 'LinkFlow URL turns long web addresses into short links you can share, and generates QR codes that point at any destination.',
      },
      {
        type: 'p',
        text: 'Everything you create lives in one place: a dashboard with your links, QR codes, click counts and recent activity. Sign in once and your library follows you across devices.',
      },
      {
        type: 'li',
        text: 'Shorten links with optional custom aliases',
      },
      {
        type: 'li',
        text: 'Generate, download and share QR codes',
      },
      {
        type: 'li',
        text: 'Track clicks and manage your link history',
      },
    ],
  },
  privacy: {
    title: 'Privacy',
    intro: 'What LinkFlow URL stores, and why.',
    blocks: [
      {
        type: 'p',
        text: 'Authentication is handled by Clerk. LinkFlow URL never sees or stores your password — only the session token issued to your device.',
      },
      {
        type: 'p',
        text: 'When you are signed in, the service stores the account identifier and email returned by Clerk, the links you shorten, the QR codes you generate, and a click counter for each short link so analytics work.',
      },
      {
        type: 'li',
        text: 'Session tokens are kept in the device secure store',
      },
      {
        type: 'li',
        text: 'Your links and QR codes are visible only to your account',
      },
      {
        type: 'li',
        text: 'Deleting a link or QR code removes it from the database',
      },
      {
        type: 'p',
        text: 'No advertising trackers are used, and your data is not sold.',
      },
    ],
  },
  terms: {
    title: 'Terms of Use',
    intro: 'The basics of using the service.',
    blocks: [
      {
        type: 'p',
        text: 'LinkFlow URL is provided to shorten links and create QR codes for content you have the right to share.',
      },
      {
        type: 'li',
        text: 'No spam, malware, phishing or deceptive redirects',
      },
      {
        type: 'li',
        text: 'No content that infringes someone else’s rights',
      },
      {
        type: 'li',
        text: 'Links that break these rules can be disabled without notice',
      },
      {
        type: 'p',
        text: 'The service is provided as-is while under active development. Features and availability may change.',
      },
    ],
  },
  contact: {
    title: 'Contact',
    intro: 'Support is handled inside the app.',
    blocks: [
      {
        type: 'p',
        text: 'Sign in to reach your account settings, manage your links and QR codes, or sign out safely from the Profile screen.',
      },
      {
        type: 'p',
        text: 'New here? Create a free account and your dashboard is ready immediately — no credit card required.',
      },
    ],
  },
};

export function LandingInfoSheet({
  visible,
  kind,
  onClose,
  onSignIn,
  onSignUp,
}: {
  visible: boolean;
  kind: InfoKind;
  onClose: () => void;
  onSignIn: () => void;
  onSignUp: () => void;
}) {
  const insets = useSafeAreaInsets();
  const content = CONTENT[kind];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close dialog">
        <Pressable
          style={[
            styles.sheet,
            glow('#792CF0', 0.35, 22, -6),
            { paddingBottom: 18 + insets.bottom },
          ]}
          onPress={(event) => event.stopPropagation()}
        >
          <View style={styles.grabber} />

          <View style={styles.header}>
            <Text style={styles.title}>{content.title}</Text>
            <Pressable
              style={styles.closeBtn}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close"
              hitSlop={10}
            >
              <AppIcon name="x" size={18} color={L.textSecondary} />
            </Pressable>
          </View>

          <Text style={styles.intro}>{content.intro}</Text>

          <ScrollView
            style={styles.body}
            contentContainerStyle={styles.bodyContent}
            showsVerticalScrollIndicator={false}
          >
            {content.blocks.map((block, index) =>
              block.type === 'li' ? (
                <View key={index} style={styles.bulletRow}>
                  <View style={styles.bullet}>
                    <AppIcon name="check" size={10} color={L.lavender} />
                  </View>
                  <Text style={styles.bulletText}>{block.text}</Text>
                </View>
              ) : (
                <Text key={index} style={styles.paragraph}>
                  {block.text}
                </Text>
              )
            )}
          </ScrollView>

          {kind === 'contact' ? (
            <View style={styles.actions}>
              <Pressable
                style={styles.primaryBtn}
                onPress={() => {
                  onClose();
                  onSignUp();
                }}
              >
                <LinearGradient
                  colors={G.brand}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.primaryFill}
                >
                  <Text style={styles.primaryText}>Create Free Account</Text>
                </LinearGradient>
              </Pressable>
              <Pressable
                style={styles.secondaryBtn}
                onPress={() => {
                  onClose();
                  onSignIn();
                }}
              >
                <Text style={styles.secondaryText}>Sign In</Text>
              </Pressable>
            </View>
          ) : null}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(4, 2, 8, 0.72)',
    justifyContent: 'flex-end',
  },
  sheet: {
    width: '100%',
    maxHeight: '84%',
    backgroundColor: L.bgAlt,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderWidth: 1,
    borderColor: L.border,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  grabber: {
    alignSelf: 'center',
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(196, 168, 255, 0.28)',
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  title: { flex: 1, fontSize: 20, fontWeight: '800', color: L.text, letterSpacing: -0.4 },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: 'rgba(196, 168, 255, 0.08)',
    borderWidth: 1,
    borderColor: L.borderSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  intro: {
    fontSize: 13,
    color: L.lavender,
    marginTop: 6,
    marginBottom: 14,
  },
  body: { flexGrow: 0 },
  bodyContent: { paddingBottom: 16 },
  paragraph: {
    fontSize: 13.5,
    lineHeight: 21,
    color: L.textSecondary,
    marginBottom: 10,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 10,
  },
  bullet: {
    width: 20,
    height: 20,
    borderRadius: 7,
    backgroundColor: 'rgba(155, 77, 255, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  bulletText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 20,
    color: L.textSecondary,
  },
  actions: { gap: 10, paddingTop: 6 },
  primaryBtn: { borderRadius: 14, overflow: 'hidden' },
  primaryFill: { paddingVertical: 14, alignItems: 'center', borderRadius: 14 },
  primaryText: { fontSize: 15, fontWeight: '800', color: '#FFFFFF' },
  secondaryBtn: {
    paddingVertical: 13,
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: L.borderStrong,
    backgroundColor: 'rgba(155, 77, 255, 0.08)',
  },
  secondaryText: { fontSize: 15, fontWeight: '700', color: L.lavender },
});
