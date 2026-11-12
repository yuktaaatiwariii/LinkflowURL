import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import QRCode from 'react-native-qrcode-svg';
import { AppIcon } from '../AppIcon';
import { G, L, glow } from './landingTheme';
import { RadialGlow } from './landingPrimitives';

const SCREEN_BARS = [16, 24, 13, 30, 21, 34, 26];

/**
 * Hero visual: a tilted phone showing the shortening flow, a floating QR
 * card, a short-link chip, and decorative purple glows.
 *
 * Entirely vector / native-view based, so it stays crisp at every density
 * and costs nothing to download.
 */
export function HeroArt() {
  const float = useRef(new Animated.Value(0)).current;
  const floatAlt = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loopA = Animated.loop(
      Animated.sequence([
        Animated.timing(float, {
          toValue: 1,
          duration: 2600,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(float, {
          toValue: 0,
          duration: 2600,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );

    const loopB = Animated.loop(
      Animated.sequence([
        Animated.timing(floatAlt, {
          toValue: 1,
          duration: 3200,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(floatAlt, {
          toValue: 0,
          duration: 3200,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );

    loopA.start();
    loopB.start();
    return () => {
      loopA.stop();
      loopB.stop();
    };
  }, [float, floatAlt]);

  return (
    <View style={styles.wrap} accessible accessibilityLabel="LinkFlow app preview with a shortened link and QR code">
      {/* Ambient light */}
      <RadialGlow
        size={330}
        color="#792CF0"
        opacity={0.42}
        style={styles.glowLarge}
      />
      <RadialGlow
        size={210}
        color="#C4A8FF"
        opacity={0.16}
        style={styles.glowSmall}
      />

      <View pointerEvents="none" style={styles.ringOuter} />
      <View pointerEvents="none" style={styles.ringInner} />

      {/* Tilted phone */}
      <View style={styles.phoneShadow}>
        <View style={styles.phone}>
          <LinearGradient
            colors={G.screen}
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

            <View style={styles.screenHeader}>
              <View style={styles.screenLogo}>
                <AppIcon name="link" size={11} color="#FFFFFF" />
              </View>
              <Text style={styles.screenBrand}>LinkFlow</Text>
              <View style={styles.screenBell}>
                <View style={styles.screenBellDot} />
              </View>
            </View>

            <LinearGradient
              colors={G.brand}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.screenInput}
            >
              <Text style={styles.screenInputText} numberOfLines={1}>
                yourbrand.com/campaign…
              </Text>
              <View style={styles.screenSend}>
                <AppIcon name="arrow-right" size={11} color="#FFFFFF" />
              </View>
            </LinearGradient>

            <View style={styles.screenResult}>
              <View style={styles.screenResultCopy}>
                <Text style={styles.screenResultLabel}>Your short link</Text>
                <Text style={styles.screenResultUrl}>linkflow.url/x7Kp2</Text>
              </View>
              <View style={styles.screenCopyBtn}>
                <AppIcon name="copy" size={11} color={L.lavender} />
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
                <LinearGradient
                  key={index}
                  colors={index === SCREEN_BARS.length - 2 ? ['#D9B8FF', '#9B4DFF'] : ['#9B4DFF', '#5A17C4']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 0, y: 1 }}
                  style={[styles.screenBar, { height }]}
                />
              ))}
            </View>

            <View style={styles.screenRow}>
              <View style={styles.screenQrMini}>
                <QRCode value="https://linkflow.url/preview" size={26} color="#FFFFFF" backgroundColor="transparent" />
              </View>
              <View style={styles.screenRowCopy}>
                <Text style={styles.screenRowTitle}>QR code ready</Text>
                <Text style={styles.screenRowSub}>Saved to your library</Text>
              </View>
            </View>
          </LinearGradient>
        </View>
      </View>

      {/* Floating QR card */}
      <Animated.View
        style={[
          styles.qrCard,
          glow('#792CF0', 0.5, 16, 10),
          {
            transform: [
              { translateY: float.interpolate({ inputRange: [0, 1], outputRange: [0, -7] }) },
              { rotate: '8deg' },
            ],
          },
        ]}
      >
        <View style={styles.qrCardTop}>
          <Text style={styles.qrCardTitle}>QR Code</Text>
          <View style={styles.qrCardDot} />
        </View>
        <View style={styles.qrTile}>
          <QRCode value="https://linkflow.url/preview" size={54} color="#12081F" backgroundColor="#FFFFFF" />
        </View>
        <Text style={styles.qrCardLabel}>Ready to share</Text>
      </Animated.View>

      {/* Floating short-link chip */}
      <Animated.View
        style={[
          styles.linkChip,
          glow('#4B139E', 0.5, 12, 8),
          {
            transform: [
              { translateY: floatAlt.interpolate({ inputRange: [0, 1], outputRange: [0, 6] }) },
            ],
          },
        ]}
      >
        <View style={styles.linkChipIcon}>
          <AppIcon name="link" size={13} color={L.lavender} />
        </View>
        <View>
          <Text style={styles.linkChipLabel}>Shortened</Text>
          <Text style={styles.linkChipText}>linkflow.url/9Fk2</Text>
        </View>
        <View style={styles.linkChipCheck}>
          <AppIcon name="check" size={10} color="#FFFFFF" />
        </View>
      </Animated.View>

      {/* Small "instant" badge */}
      <View style={styles.instantBadge}>
        <AppIcon name="zap" size={11} color={L.lavender} />
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
  glowLarge: {
    top: 4,
    alignSelf: 'center',
  },
  glowSmall: {
    right: -10,
    bottom: 6,
  },
  ringOuter: {
    position: 'absolute',
    width: 258,
    height: 258,
    borderRadius: 129,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(155, 77, 255, 0.18)',
  },
  ringInner: {
    position: 'absolute',
    width: 196,
    height: 196,
    borderRadius: 98,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(155, 77, 255, 0.26)',
  },
  phoneShadow: {
    shadowColor: '#792CF0',
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
    backgroundColor: '#120A1F',
    borderWidth: 1,
    borderColor: 'rgba(196, 168, 255, 0.28)',
  },
  screen: {
    flex: 1,
    borderRadius: 24,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 10,
    overflow: 'hidden',
  },
  notch: {
    alignSelf: 'center',
    width: 46,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(196, 168, 255, 0.28)',
    marginBottom: 6,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  statusText: { fontSize: 9, fontWeight: '700', color: 'rgba(196, 168, 255, 0.75)' },
  statusDots: { flexDirection: 'row', gap: 3 },
  statusDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(196, 168, 255, 0.5)',
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
  screenBrand: { flex: 1, fontSize: 11, fontWeight: '800', color: '#FFFFFF' },
  screenBell: {
    width: 18,
    height: 18,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(196, 168, 255, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  screenBellDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: L.lavender,
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
  },
  screenInputText: {
    flex: 1,
    fontSize: 8.5,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.86)',
  },
  screenSend: {
    width: 20,
    height: 20,
    borderRadius: 7,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  screenResult: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: 'rgba(155, 77, 255, 0.32)',
    backgroundColor: 'rgba(155, 77, 255, 0.12)',
    paddingHorizontal: 9,
    paddingVertical: 8,
    marginBottom: 10,
  },
  screenResultCopy: { flex: 1 },
  screenResultLabel: {
    fontSize: 7,
    fontWeight: '700',
    letterSpacing: 0.5,
    color: 'rgba(196, 181, 232, 0.7)',
    marginBottom: 2,
  },
  screenResultUrl: { fontSize: 10, fontWeight: '800', color: '#E9D9FF' },
  screenCopyBtn: {
    width: 20,
    height: 20,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  screenChartHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 7,
  },
  screenChartLabel: { fontSize: 8.5, fontWeight: '700', color: 'rgba(196, 181, 232, 0.85)' },
  screenChartPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 20,
    backgroundColor: 'rgba(155, 77, 255, 0.22)',
  },
  screenChartPillText: { fontSize: 6.5, fontWeight: '700', color: L.lavender },
  screenBars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 38,
    paddingHorizontal: 2,
    marginBottom: 10,
  },
  screenBar: { width: 9, borderRadius: 3.5 },

  screenRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    padding: 7,
  },
  screenQrMini: {
    width: 34,
    height: 34,
    borderRadius: 7,
    backgroundColor: L.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  screenRowCopy: { flex: 1 },
  screenRowTitle: { fontSize: 8.5, fontWeight: '700', color: '#EDE3FF' },
  screenRowSub: { fontSize: 7, color: 'rgba(196, 181, 232, 0.65)', marginTop: 1 },

  qrCard: {
    position: 'absolute',
    right: 2,
    top: 26,
    width: 104,
    borderRadius: 18,
    padding: 10,
    backgroundColor: 'rgba(32, 21, 50, 0.94)',
    borderWidth: 1,
    borderColor: 'rgba(196, 168, 255, 0.3)',
  },
  qrCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  qrCardTitle: { fontSize: 9, fontWeight: '800', color: '#FFFFFF' },
  qrCardDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#34D399' },
  qrTile: {
    borderRadius: 10,
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
    borderRadius: 14,
    backgroundColor: 'rgba(32, 21, 50, 0.95)',
    borderWidth: 1,
    borderColor: 'rgba(196, 168, 255, 0.28)',
  },
  linkChipIcon: {
    width: 26,
    height: 26,
    borderRadius: 9,
    backgroundColor: 'rgba(155, 77, 255, 0.22)',
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
  linkChipText: { fontSize: 10, fontWeight: '800', color: '#F1E7FF' },
  linkChipCheck: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#22C55E',
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
    borderRadius: 999,
    backgroundColor: 'rgba(155, 77, 255, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(196, 168, 255, 0.24)',
  },
  instantText: { fontSize: 8.5, fontWeight: '700', color: L.lavender },
});
