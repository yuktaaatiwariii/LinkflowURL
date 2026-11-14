import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { AppIcon } from '../AppIcon';
import { L, glow } from './landingTheme';

const SCREEN_BARS = [16, 24, 13, 30, 21, 34, 26];

/**
 * Hero visual: a tilted phone showing the shortening flow, a QR card, and a
 * short-link chip.
 *
 * Entirely vector / native-view based, so it stays crisp at every density and
 * costs nothing to download. Monochrome composition — no ambient glows,
 * rings or floating animation.
 */
export function HeroArt() {
  return (
    <View style={styles.wrap} accessible accessibilityLabel="LinkFlow app preview with a shortened link and QR code">
      {/* Tilted phone */}
      <View style={styles.phoneShadow}>
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

            <View style={styles.screenHeader}>
              <View style={styles.screenLogo}>
                <AppIcon name="link" size={11} color={L.bg} />
              </View>
              <Text style={styles.screenBrand}>LinkFlow</Text>
              <View style={styles.screenBell}>
                <View style={styles.screenBellDot} />
              </View>
            </View>

            <View style={styles.screenInput}>
              <Text style={styles.screenInputText} numberOfLines={1}>
                yourbrand.com/campaign…
              </Text>
              <View style={styles.screenSend}>
                <AppIcon name="arrow-right" size={11} color={L.bg} />
              </View>
            </View>

            <View style={styles.screenResult}>
              <View style={styles.screenResultCopy}>
                <Text style={styles.screenResultLabel}>Your short link</Text>
                <Text style={styles.screenResultUrl}>linkflow.url/x7Kp2</Text>
              </View>
              <View style={styles.screenCopyBtn}>
                <AppIcon name="copy" size={11} color={L.textSecondary} />
              </View>
            </View>

            <View style={styles.screenChartHead}>
              <Text style={styles.screenChartLabel}>Clicks</Text>
              <View style={styles.screenChartPill}>
                <Text style={styles.screenChartPillText}>This week</Text>
              </View>
            </View>

            <View style={styles.screenBars}>
              {SCREEN_BARS.map((height, index) => (
                <View
                  key={index}
                  style={[
                    styles.screenBar,
                    { height },
                    index === SCREEN_BARS.length - 2 && styles.screenBarActive,
                  ]}
                />
              ))}
            </View>

            <View style={styles.screenRow}>
              <View style={styles.screenQrMini}>
                <QRCode value="https://linkflow.url/preview" size={26} color="#000000" backgroundColor="#FFFFFF" />
              </View>
              <View style={styles.screenRowCopy}>
                <Text style={styles.screenRowTitle}>QR code ready</Text>
                <Text style={styles.screenRowSub}>Saved to your library</Text>
              </View>
            </View>
          </View>
        </View>
      </View>

      {/* QR card */}
      <View style={[styles.qrCard, glow('#000000', 0.5, 14, 8)]}>
        <View style={styles.qrCardTop}>
          <Text style={styles.qrCardTitle}>QR Code</Text>
          <View style={styles.qrCardDot} />
        </View>
        <View style={styles.qrTile}>
          <QRCode value="https://linkflow.url/preview" size={54} color="#000000" backgroundColor="#FFFFFF" />
        </View>
        <Text style={styles.qrCardLabel}>Ready to share</Text>
      </View>

      {/* Short-link chip */}
      <View style={[styles.linkChip, glow('#000000', 0.45, 10, 6)]}>
        <View style={styles.linkChipIcon}>
          <AppIcon name="link" size={13} color={L.textSecondary} />
        </View>
        <View>
          <Text style={styles.linkChipLabel}>Shortened</Text>
          <Text style={styles.linkChipText}>linkflow.url/9Fk2</Text>
        </View>
        <View style={styles.linkChipCheck}>
          <AppIcon name="check" size={10} color={L.bg} />
        </View>
      </View>

      {/* Small "instant" badge */}
      <View style={styles.instantBadge}>
        <AppIcon name="zap" size={11} color={L.textSecondary} />
        <Text style={styles.instantText}>1-tap shorten</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    height: 400,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  phoneShadow: {
    shadowColor: '#000000',
    shadowOpacity: 0.6,
    shadowRadius: 26,
    shadowOffset: { width: 0, height: 18 },
    elevation: 22,
    transform: [{ rotate: '-7deg' }],
    marginLeft: -28,
  },
  phone: {
    width: 184,
    height: 344,
    borderRadius: 30,
    padding: 6,
    backgroundColor: L.cardDeep,
    borderWidth: 1,
    borderColor: L.borderStrong,
  },
  screen: {
    flex: 1,
    borderRadius: 24,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 10,
    overflow: 'hidden',
    backgroundColor: L.bg,
  },
  notch: {
    alignSelf: 'center',
    width: 46,
    height: 5,
    borderRadius: 3,
    backgroundColor: L.borderStrong,
    marginBottom: 6,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  statusText: { fontSize: 9, fontWeight: '700', color: L.textMuted },
  statusDots: { flexDirection: 'row', gap: 3 },
  statusDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: L.borderStrong,
  },

  screenHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginBottom: 10,
  },
  screenLogo: {
    width: 22,
    height: 22,
    borderRadius: 7,
    backgroundColor: L.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  screenBrand: { flex: 1, fontSize: 11, fontWeight: '800', color: L.text },
  screenBell: {
    width: 18,
    height: 18,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: L.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  screenBellDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: L.textMuted,
  },

  screenInput: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 11,
    paddingLeft: 10,
    paddingRight: 6,
    paddingVertical: 7,
    marginBottom: 10,
    backgroundColor: L.card,
    borderWidth: 1,
    borderColor: L.border,
  },
  screenInputText: {
    flex: 1,
    fontSize: 8.5,
    fontWeight: '600',
    color: L.textSecondary,
  },
  screenSend: {
    width: 20,
    height: 20,
    borderRadius: 7,
    backgroundColor: L.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  screenResult: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: L.border,
    backgroundColor: L.card,
    paddingHorizontal: 9,
    paddingVertical: 8,
    marginBottom: 10,
  },
  screenResultCopy: { flex: 1 },
  screenResultLabel: {
    fontSize: 7,
    fontWeight: '700',
    letterSpacing: 0.5,
    color: L.textMuted,
    marginBottom: 2,
  },
  screenResultUrl: { fontSize: 10, fontWeight: '800', color: L.text },
  screenCopyBtn: {
    width: 20,
    height: 20,
    borderRadius: 6,
    backgroundColor: L.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  screenChartHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 7,
  },
  screenChartLabel: { fontSize: 8.5, fontWeight: '700', color: L.textSecondary },
  screenChartPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: L.card,
    borderWidth: 1,
    borderColor: L.border,
  },
  screenChartPillText: { fontSize: 6.5, fontWeight: '700', color: L.textMuted },
  screenBars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 38,
    paddingHorizontal: 2,
    marginBottom: 10,
  },
  screenBar: { width: 9, borderRadius: 2, backgroundColor: L.surfaceSecondary },
  screenBarActive: { backgroundColor: L.primary },

  screenRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 10,
    backgroundColor: L.card,
    borderWidth: 1,
    borderColor: L.borderSoft,
    padding: 7,
  },
  screenQrMini: {
    width: 34,
    height: 34,
    borderRadius: 7,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  screenRowCopy: { flex: 1 },
  screenRowTitle: { fontSize: 8.5, fontWeight: '700', color: L.text },
  screenRowSub: { fontSize: 7, color: L.textMuted, marginTop: 1 },

  qrCard: {
    position: 'absolute',
    right: 2,
    top: 26,
    width: 104,
    borderRadius: 16,
    padding: 10,
    backgroundColor: L.card,
    borderWidth: 1,
    borderColor: L.border,
  },
  qrCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  qrCardTitle: { fontSize: 9, fontWeight: '800', color: L.text },
  qrCardDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#22C55E' },
  qrTile: {
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    padding: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrCardLabel: {
    fontSize: 7.5,
    fontWeight: '600',
    color: L.textSecondary,
    textAlign: 'center',
    marginTop: 7,
  },

  linkChip: {
    position: 'absolute',
    left: 0,
    bottom: 30,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingLeft: 8,
    paddingRight: 10,
    borderRadius: 12,
    backgroundColor: L.card,
    borderWidth: 1,
    borderColor: L.border,
  },
  linkChipIcon: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: L.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkChipLabel: {
    fontSize: 7,
    fontWeight: '700',
    letterSpacing: 0.4,
    color: L.textMuted,
    textTransform: 'uppercase',
  },
  linkChipText: { fontSize: 10, fontWeight: '800', color: L.text },
  linkChipCheck: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: L.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  instantBadge: {
    position: 'absolute',
    right: 8,
    bottom: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: L.card,
    borderWidth: 1,
    borderColor: L.border,
  },
  instantText: { fontSize: 8.5, fontWeight: '700', color: L.textSecondary },
});
