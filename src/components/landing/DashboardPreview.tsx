import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import QRCode from 'react-native-qrcode-svg';
import { AppIcon } from '../AppIcon';
import { L, glow } from './landingTheme';
import { RadialGlow } from './landingPrimitives';

const BARS = [22, 34, 27, 46, 38, 58, 49];

const RECENT = [
  { label: 'linkflow.url/x7Kp2', meta: 'Campaign link' },
  { label: 'linkflow.url/9Fk2', meta: 'Portfolio' },
];

/**
 * Promotional dashboard mockup.
 *
 * Deliberately static artwork (badged "Preview") — it never pretends to be
 * live account data and is not wired to any API.
 */
export function DashboardPreview() {
  return (
    <View style={styles.stage}>
      <RadialGlow
        size={320}
        color={L.primary}
        opacity={0.34}
        style={styles.glowBack}
      />
      <RadialGlow
        size={190}
        color="#C4A8FF"
        opacity={0.14}
        style={styles.glowTop}
      />

      <View style={styles.phone}>
        <LinearGradient
          colors={['#1C1030', '#0F0819']}
          start={{ x: 0.1, y: 0 }}
          end={{ x: 0.9, y: 1 }}
          style={styles.screen}
        >
          <View style={styles.notch} />

          <View style={styles.statusRow}>
            <Text style={styles.statusText}>9:41</Text>
            <View style={styles.statusDots}>
              <View style={styles.statusDot} />
              <View style={styles.statusDot} />
              <View style={styles.statusDot} />
            </View>
          </View>

          <View style={styles.header}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>A</Text>
            </View>
            <View style={styles.headerCopy}>
              <Text style={styles.headerTitle}>Dashboard</Text>
              <Text style={styles.headerSub}>Welcome back</Text>
            </View>
            <View style={styles.previewPill}>
              <View style={styles.previewDot} />
              <Text style={styles.previewText}>Preview</Text>
            </View>
          </View>

          <View style={styles.statRow}>
            <View style={styles.statCard}>
              <View style={styles.statIcon}>
                <AppIcon name="chart" size={12} color={L.lavender} />
              </View>
              <Text style={styles.statValue}>12.4K</Text>
              <Text style={styles.statLabel}>Total clicks</Text>
            </View>
            <View style={styles.statCard}>
              <View style={styles.statIcon}>
                <AppIcon name="link" size={12} color={L.lavender} />
              </View>
              <Text style={styles.statValue}>248</Text>
              <Text style={styles.statLabel}>Shortened links</Text>
            </View>
          </View>

          <View style={styles.analyticsCard}>
            <View style={styles.cardHead}>
              <Text style={styles.cardTitle}>Analytics</Text>
              <Text style={styles.cardMeta}>Last 7 days</Text>
            </View>
            <View style={styles.bars}>
              {BARS.map((height, index) => (
                <LinearGradient
                  key={index}
                  colors={index === BARS.length - 1 ? ['#E3CBFF', '#9B4DFF'] : ['#8B3CF7', '#4B139E']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 0, y: 1 }}
                  style={[styles.bar, { height }]}
                />
              ))}
            </View>
            <View style={styles.barAxis}>
              {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, index) => (
                <Text key={index} style={styles.axisLabel}>{day}</Text>
              ))}
            </View>
          </View>

          <View style={styles.listCard}>
            <View style={styles.cardHead}>
              <Text style={styles.cardTitle}>Link history</Text>
              <Text style={styles.cardLink}>View all</Text>
            </View>
            {RECENT.map((item) => (
              <View key={item.label} style={styles.linkRow}>
                <View style={styles.linkFavicon}>
                  <AppIcon name="link" size={10} color={L.lavender} />
                </View>
                <View style={styles.linkRowCopy}>
                  <Text style={styles.linkUrl}>{item.label}</Text>
                  <Text style={styles.linkMeta}>{item.meta}</Text>
                </View>
                <View style={styles.linkClicks}>
                  <Text style={styles.linkClicksText}>1.2K</Text>
                </View>
              </View>
            ))}
          </View>

          <View style={styles.qrRow}>
            <View style={styles.qrTile}>
              <QRCode value="https://linkflow.url/preview" size={34} color="#12081F" backgroundColor="#FFFFFF" />
            </View>
            <View style={styles.qrCopy}>
              <Text style={styles.qrTitle}>Latest QR code</Text>
              <Text style={styles.qrSub}>Ready to share anywhere</Text>
            </View>
            <AppIcon name="arrow-right" size={13} color={L.lavender} />
          </View>
        </LinearGradient>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stage: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: 12,
  },
  glowBack: {
    top: 30,
    alignSelf: 'center',
  },
  glowTop: {
    top: -20,
    right: 0,
  },

  phone: {
    width: 276,
    borderRadius: 34,
    padding: 7,
    backgroundColor: '#0C0716',
    borderWidth: 1,
    borderColor: 'rgba(196, 168, 255, 0.24)',
    ...glow('#792CF0', 0.45, 24, 18),
  },
  screen: {
    borderRadius: 27,
    paddingHorizontal: 13,
    paddingTop: 11,
    paddingBottom: 14,
    overflow: 'hidden',
  },
  notch: {
    alignSelf: 'center',
    width: 52,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(196, 168, 255, 0.24)',
    marginBottom: 9,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  statusText: { fontSize: 9, fontWeight: '700', color: 'rgba(196, 168, 255, 0.7)' },
  statusDots: { flexDirection: 'row', gap: 3 },
  statusDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(196, 168, 255, 0.45)',
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    marginBottom: 14,
  },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: L.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(200, 165, 255, 0.5)',
  },
  avatarText: { fontSize: 12, fontWeight: '800', color: '#FFFFFF' },
  headerCopy: { flex: 1 },
  headerTitle: { fontSize: 13, fontWeight: '800', color: '#FFFFFF' },
  headerSub: { fontSize: 8.5, color: 'rgba(196, 181, 232, 0.7)', marginTop: 1 },
  previewPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 20,
    backgroundColor: 'rgba(52, 211, 153, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.3)',
  },
  previewDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#34D399' },
  previewText: { fontSize: 7, fontWeight: '800', color: '#34D399' },

  statRow: { flexDirection: 'row', gap: 9, marginBottom: 10 },
  statCard: {
    flex: 1,
    borderRadius: 14,
    padding: 10,
    backgroundColor: 'rgba(155, 77, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(155, 77, 255, 0.22)',
  },
  statIcon: {
    width: 22,
    height: 22,
    borderRadius: 7,
    backgroundColor: 'rgba(155, 77, 255, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 7,
  },
  statValue: { fontSize: 15, fontWeight: '800', color: '#FFFFFF', letterSpacing: -0.3 },
  statLabel: { fontSize: 7.5, fontWeight: '600', color: 'rgba(196, 181, 232, 0.75)', marginTop: 2 },

  analyticsCard: {
    borderRadius: 14,
    padding: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(196, 168, 255, 0.12)',
    marginBottom: 10,
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  cardTitle: { fontSize: 9.5, fontWeight: '800', color: '#F2E9FF' },
  cardMeta: { fontSize: 7, fontWeight: '600', color: 'rgba(196, 181, 232, 0.6)' },
  cardLink: { fontSize: 7.5, fontWeight: '700', color: L.lavender },
  bars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 62,
    paddingHorizontal: 2,
  },
  bar: { width: 15, borderRadius: 5 },
  barAxis: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
    paddingHorizontal: 2,
  },
  axisLabel: { fontSize: 6.5, fontWeight: '600', color: 'rgba(196, 181, 232, 0.45)' },

  listCard: {
    borderRadius: 14,
    padding: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(196, 168, 255, 0.1)',
    marginBottom: 10,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: 'rgba(196, 168, 255, 0.07)',
  },
  linkFavicon: {
    width: 22,
    height: 22,
    borderRadius: 7,
    backgroundColor: 'rgba(155, 77, 255, 0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkRowCopy: { flex: 1 },
  linkUrl: { fontSize: 8.5, fontWeight: '700', color: '#E9DDFF' },
  linkMeta: { fontSize: 7, color: 'rgba(196, 181, 232, 0.55)', marginTop: 1 },
  linkClicks: {
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: 'rgba(155, 77, 255, 0.16)',
  },
  linkClicksText: { fontSize: 7, fontWeight: '800', color: L.lavender },

  qrRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    borderRadius: 14,
    padding: 9,
    backgroundColor: 'rgba(155, 77, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(155, 77, 255, 0.18)',
  },
  qrTile: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    padding: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrCopy: { flex: 1 },
  qrTitle: { fontSize: 9.5, fontWeight: '800', color: '#F2E9FF' },
  qrSub: { fontSize: 7.5, color: 'rgba(196, 181, 232, 0.65)', marginTop: 2 },
});
