import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { AppIcon } from '../AppIcon';
import { L, glow } from './landingTheme';

const BARS = [22, 34, 27, 46, 38, 58, 49];

const RECENT = [
  { label: 'linkflow.url/x7Kp2', meta: 'Campaign link' },
  { label: 'linkflow.url/9Fk2', meta: 'Portfolio' },
];

/**
 * Promotional dashboard mockup.
 *
 * Deliberately static artwork (badged "Preview") — it never pretends to be
 * live account data and is not wired to any API. Monochrome, no ambient
 * glow or gradient decoration.
 */
export function DashboardPreview() {
  return (
    <View style={styles.stage}>
      <View style={styles.phone}>
        <View style={styles.screen}>
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
                <AppIcon name="chart" size={12} color={L.textSecondary} />
              </View>
              <Text style={styles.statValue}>12.4K</Text>
              <Text style={styles.statLabel}>Total clicks</Text>
            </View>
            <View style={styles.statCard}>
              <View style={styles.statIcon}>
                <AppIcon name="link" size={12} color={L.textSecondary} />
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
                <View
                  key={index}
                  style={[
                    styles.bar,
                    { height },
                    index === BARS.length - 1 && styles.barActive,
                  ]}
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
                  <AppIcon name="link" size={10} color={L.textSecondary} />
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
              <QRCode value="https://linkflow.url/preview" size={34} color="#000000" backgroundColor="#FFFFFF" />
            </View>
            <View style={styles.qrCopy}>
              <Text style={styles.qrTitle}>Latest QR code</Text>
              <Text style={styles.qrSub}>Ready to share anywhere</Text>
            </View>
            <AppIcon name="arrow-right" size={13} color={L.textSecondary} />
          </View>
        </View>
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

  phone: {
    width: 276,
    borderRadius: 30,
    padding: 7,
    backgroundColor: L.cardDeep,
    borderWidth: 1,
    borderColor: L.border,
    ...glow('#000000', 0.45, 20, 14),
  },
  screen: {
    borderRadius: 24,
    paddingHorizontal: 13,
    paddingTop: 11,
    paddingBottom: 14,
    overflow: 'hidden',
    backgroundColor: L.bg,
  },
  notch: {
    alignSelf: 'center',
    width: 52,
    height: 5,
    borderRadius: 3,
    backgroundColor: L.borderStrong,
    marginBottom: 9,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  statusText: { fontSize: 9, fontWeight: '700', color: L.textMuted },
  statusDots: { flexDirection: 'row', gap: 3 },
  statusDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: L.borderStrong,
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
  },
  avatarText: { fontSize: 12, fontWeight: '800', color: L.bg },
  headerCopy: { flex: 1 },
  headerTitle: { fontSize: 13, fontWeight: '800', color: L.text },
  headerSub: { fontSize: 8.5, color: L.textMuted, marginTop: 1 },
  previewPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: L.card,
    borderWidth: 1,
    borderColor: L.border,
  },
  previewDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#34D399' },
  previewText: { fontSize: 7, fontWeight: '800', color: '#34D399' },

  statRow: { flexDirection: 'row', gap: 9, marginBottom: 10 },
  statCard: {
    flex: 1,
    borderRadius: 12,
    padding: 10,
    backgroundColor: L.card,
    borderWidth: 1,
    borderColor: L.border,
  },
  statIcon: {
    width: 22,
    height: 22,
    borderRadius: 7,
    backgroundColor: L.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 7,
  },
  statValue: { fontSize: 15, fontWeight: '800', color: L.text, letterSpacing: -0.3 },
  statLabel: { fontSize: 7.5, fontWeight: '600', color: L.textMuted, marginTop: 2 },

  analyticsCard: {
    borderRadius: 12,
    padding: 10,
    backgroundColor: L.card,
    borderWidth: 1,
    borderColor: L.border,
    marginBottom: 10,
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  cardTitle: { fontSize: 9.5, fontWeight: '800', color: L.text },
  cardMeta: { fontSize: 7, fontWeight: '600', color: L.textMuted },
  cardLink: { fontSize: 7.5, fontWeight: '700', color: L.textSecondary },
  bars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 62,
    paddingHorizontal: 2,
  },
  bar: { width: 15, borderRadius: 3, backgroundColor: L.surfaceSecondary },
  barActive: { backgroundColor: L.primary },
  barAxis: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
    paddingHorizontal: 2,
  },
  axisLabel: { fontSize: 6.5, fontWeight: '600', color: L.textMuted },

  listCard: {
    borderRadius: 12,
    padding: 10,
    backgroundColor: L.card,
    borderWidth: 1,
    borderColor: L.border,
    marginBottom: 10,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: L.borderSoft,
  },
  linkFavicon: {
    width: 22,
    height: 22,
    borderRadius: 7,
    backgroundColor: L.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkRowCopy: { flex: 1 },
  linkUrl: { fontSize: 8.5, fontWeight: '700', color: L.text },
  linkMeta: { fontSize: 7, color: L.textMuted, marginTop: 1 },
  linkClicks: {
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: L.surfaceSecondary,
  },
  linkClicksText: { fontSize: 7, fontWeight: '800', color: L.textSecondary },

  qrRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    borderRadius: 12,
    padding: 9,
    backgroundColor: L.card,
    borderWidth: 1,
    borderColor: L.border,
  },
  qrTile: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    padding: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrCopy: { flex: 1 },
  qrTitle: { fontSize: 9.5, fontWeight: '800', color: L.text },
  qrSub: { fontSize: 7.5, color: L.textMuted, marginTop: 2 },
});
