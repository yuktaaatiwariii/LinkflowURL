import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import QRCode from 'react-native-qrcode-svg';
import { AppIcon } from '../AppIcon';
import { L, glow } from './landingTheme';
import { GradientHeadline, ScalePress, SectionHeading, SectionKicker } from './landingPrimitives';
import { HeroArt } from './HeroArt';
import { DashboardPreview } from './DashboardPreview';
import { LandingInfoSheet, InfoKind } from './LandingInfoSheet';

type IconName = React.ComponentProps<typeof AppIcon>['name'];

const FEATURES: {
  icon: IconName;
  title: string;
  desc: string;
  visual: 'link' | 'qr' | 'chart';
}[] = [
  {
    icon: 'link',
    title: 'URL Shortener',
    desc: 'Turn long addresses into clean links you can paste anywhere.',
    visual: 'link',
  },
  {
    icon: 'qr',
    title: 'QR Code Generator',
    desc: 'Create a scannable QR code for any destination in seconds.',
    visual: 'qr',
  },
  {
    icon: 'chart',
    title: 'Link Management',
    desc: 'See every link, QR code and click in one tidy dashboard.',
    visual: 'chart',
  },
];

const STEPS: { icon: IconName; title: string; desc: string }[] = [
  { icon: 'link', title: 'Paste Your URL', desc: 'Drop in any destination link — no setup required.' },
  { icon: 'sparkles', title: 'Generate Short Link', desc: 'LinkFlow creates a compact link and a matching QR code.' },
  { icon: 'send', title: 'Share Anywhere', desc: 'Copy, download or share on social, print and in chat.' },
];

const BENEFITS = [
  'Instant link shortening',
  'Custom QR codes',
  'Real-time click analytics',
  'Easy link management',
];

export function MobileLanding() {
  const router = useRouter();
  const { width } = useWindowDimensions();

  const scrollRef = useRef<ScrollView>(null);
  const offsets = useRef<Record<string, number>>({});

  const [menuMounted, setMenuMounted] = useState(false);
  const [infoKind, setInfoKind] = useState<InfoKind | null>(null);

  const menuAnim = useRef(new Animated.Value(0)).current;
  const heroAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(heroAnim, {
      toValue: 1,
      duration: 520,
      delay: 60,
      useNativeDriver: true,
    }).start();
  }, [heroAnim]);

  const contentWidth = Math.min(width, 560) - 40;
  const narrow = width < 360;
  const heroFontSize = Math.max(22, Math.min(33, contentWidth / 9.6));
  const heroLineHeight = Math.round(heroFontSize * 1.17);

  const registerSection = useCallback((key: string) => (event: any) => {
    offsets.current[key] = event.nativeEvent.layout.y;
  }, []);

  const scrollToSection = useCallback((key: string) => {
    const y = offsets.current[key];
    if (typeof y === 'number') {
      scrollRef.current?.scrollTo({ y: Math.max(0, y - 10), animated: true });
    }
  }, []);

  const openMenu = useCallback(() => {
    setMenuMounted(true);
    Animated.timing(menuAnim, {
      toValue: 1,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [menuAnim]);

  const closeMenu = useCallback(
    (after?: () => void) => {
      Animated.timing(menuAnim, {
        toValue: 0,
        duration: 170,
        useNativeDriver: true,
      }).start(() => {
        setMenuMounted(false);
        after?.();
      });
    },
    [menuAnim]
  );

  const goSignUp = useCallback(() => router.push('/(auth)/sign-up' as any), [router]);
  const goSignIn = useCallback(() => router.push('/(auth)/sign-in' as any), [router]);

  const handleMenuNavigate = useCallback(
    (key: 'home' | 'features' | 'how' | 'about') => {
      closeMenu(() => {
        if (key === 'home') {
          scrollRef.current?.scrollTo({ y: 0, animated: true });
        } else if (key === 'about') {
          setInfoKind('about');
        } else {
          scrollToSection(key);
        }
      });
    },
    [closeMenu, scrollToSection]
  );

  const menuTranslate = menuAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [Math.min(width, 360), 0],
  });

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <ScalePress
          style={styles.brand}
          onPress={() => scrollRef.current?.scrollTo({ y: 0, animated: true })}
          accessibilityLabel="LinkFlow URL home"
        >
          <View style={styles.brandMark}>
            <AppIcon name="link" size={17} color={L.bg} />
          </View>
          <View>
            <Text style={styles.brandName}>
              LinkFlow <Text style={styles.brandAccent}>URL</Text>
            </Text>
            <Text style={styles.brandTagline}>Shorten. Share. Grow.</Text>
          </View>
        </ScalePress>

        <Pressable
          style={styles.menuBtn}
          onPress={openMenu}
          accessibilityRole="button"
          accessibilityLabel="Open navigation menu"
          hitSlop={8}
        >
          <AppIcon name="menu" size={20} color={L.text} />
        </Pressable>
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.shell}>
          {/* Hero */}
          <Animated.View
            onLayout={registerSection('home')}
            style={[
              styles.hero,
              {
                opacity: heroAnim,
                transform: [
                  {
                    translateY: heroAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [18, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <View style={styles.badge}>
              <AppIcon name="sparkles" size={12} color={L.textSecondary} />
              <Text style={styles.badgeText}>Next-Gen URL & QR Engine</Text>
            </View>

            <GradientHeadline
              width={contentWidth}
              fontSize={heroFontSize}
              lineHeight={heroLineHeight}
              lines={[
                { text: 'Shorten Links.' },
                { text: 'Create QR Codes.', gradient: true },
                { text: 'Share Smarter.' },
              ]}
            />

            <Text style={styles.heroDesc}>
              Turn long URLs into clean, shareable short links and beautiful QR codes.
            </Text>

            <View style={styles.ctaStack}>
              <ScalePress onPress={goSignUp} style={[styles.primaryWrap]} scaleTo={0.98}>
                <View style={styles.primaryFill}>
                  <Text style={styles.primaryText}>Get Started Free</Text>
                  <AppIcon name="arrow-right" size={17} color={L.bg} />
                </View>
              </ScalePress>

              <ScalePress
                onPress={() => scrollToSection('preview')}
                style={styles.ghostBtn}
                scaleTo={0.98}
                accessibilityLabel="Watch demo — jump to the dashboard preview"
              >
                <View style={styles.ghostIcon}>
                  <AppIcon name="play" size={12} color={L.textSecondary} />
                </View>
                <Text style={styles.ghostText}>Watch Demo</Text>
              </ScalePress>
            </View>

            <View style={styles.trustRow}>
              <View style={styles.trustItem}>
                <AppIcon name="check" size={11} color="#34D399" />
                <Text style={styles.trustText}>Free to start</Text>
              </View>
              <View style={styles.trustDivider} />
              <View style={styles.trustItem}>
                <AppIcon name="shield" size={11} color="#34D399" />
                <Text style={styles.trustText}>No credit card</Text>
              </View>
            </View>
          </Animated.View>

          <HeroArt />

          {/* Features */}
          <View style={styles.section} onLayout={registerSection('features')}>
            <SectionKicker>Features</SectionKicker>
            <SectionHeading title={['Everything You Need', 'in One Place']} />
            <Text style={styles.sectionSub}>
              Shorten, generate and track — without juggling tools.
            </Text>

            <View style={styles.featureRow}>
              <FeatureCard
                icon={FEATURES[0].icon}
                title={FEATURES[0].title}
                desc={FEATURES[0].desc}
                visual={<LinkMini />}
                narrow={narrow}
              />
              <FeatureCard
                icon={FEATURES[1].icon}
                title={FEATURES[1].title}
                desc={FEATURES[1].desc}
                visual={<QrMini narrow={narrow} />}
                narrow={narrow}
              />
            </View>

            <View style={styles.featureWide}>
              <View style={styles.featureWideCopy}>
                <View style={styles.featureIcon}>
                  <AppIcon name={FEATURES[2].icon} size={20} color={L.textSecondary} />
                </View>
                <Text style={styles.featureTitle}>{FEATURES[2].title}</Text>
                <Text style={styles.featureDesc}>{FEATURES[2].desc}</Text>
              </View>
              <ChartMini />
            </View>
          </View>

          {/* Dashboard preview */}
          <View style={styles.section} onLayout={registerSection('preview')}>
            <SectionKicker>Dashboard</SectionKicker>
            <SectionHeading title={['Manage Everything', 'in One Place']} />
            <Text style={styles.sectionSub}>
              Track, organize, and manage your links and QR codes with LinkFlow URL.
            </Text>

            <DashboardPreview />

            <Text style={styles.previewCaption}>
              Product preview — your dashboard shows your own live data.
            </Text>
          </View>

          {/* How it works */}
          <View style={styles.section} onLayout={registerSection('how')}>
            <SectionKicker>How it works</SectionKicker>
            <SectionHeading title={['Get Started in', '3 Simple Steps']} />
            <Text style={styles.sectionSub}>From long URL to shareable link in under a minute.</Text>

            <View style={styles.steps}>
              {STEPS.map((step, index) => (
                <View key={step.title}>
                  <View style={styles.stepCard}>
                    <View style={styles.stepIndex}>
                      <Text style={styles.stepIndexText}>{`0${index + 1}`}</Text>
                    </View>
                    <View style={styles.stepIcon}>
                      <AppIcon name={step.icon} size={16} color={L.textSecondary} />
                    </View>
                    <View style={styles.stepCopy}>
                      <Text style={styles.stepTitle}>{step.title}</Text>
                      <Text style={styles.stepDesc}>{step.desc}</Text>
                    </View>
                  </View>
                  {index < STEPS.length - 1 ? (
                    <View style={styles.stepConnector}>
                      <View style={styles.stepLine} />
                      <AppIcon name="arrow-right" size={12} color={L.textMuted} style={styles.stepArrow} />
                    </View>
                  ) : null}
                </View>
              ))}
            </View>
          </View>

          {/* Benefits */}
          <View style={styles.section}>
            <SectionKicker>Why LinkFlow</SectionKicker>
            <SectionHeading title={['More Than Just', 'a URL Shortener']} />
            <Text style={styles.sectionSub}>
              A complete link workflow designed for speed, clarity and insight.
            </Text>

            <BenefitsArt />

            <View style={styles.benefitList}>
              {BENEFITS.map((benefit) => (
                <View key={benefit} style={styles.benefitRow}>
                  <View style={styles.benefitCheck}>
                    <AppIcon name="check" size={11} color={L.textSecondary} />
                  </View>
                  <Text style={styles.benefitText}>{benefit}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Final CTA */}
          <View style={styles.ctaCard}>
            <Text style={[styles.ctaTitle, narrow && styles.ctaTitleNarrow]}>
              Ready to Share Smarter?
            </Text>
            <Text style={styles.ctaDesc}>
              Start shortening links and creating QR codes with LinkFlow URL.
            </Text>

            <Pressable
              style={[styles.ctaBtn, narrow && styles.ctaBtnNarrow]}
              onPress={goSignUp}
              accessibilityRole="button"
            >
              <Text style={[styles.ctaBtnText, narrow && styles.ctaBtnTextNarrow]}>
                Create Your Free Account
              </Text>
              <AppIcon name="arrow-right" size={16} color={L.bg} />
            </Pressable>
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <View style={styles.footerBrand}>
              <View style={styles.footerMark}>
                <AppIcon name="link" size={14} color={L.bg} />
              </View>
              <Text style={styles.footerName}>LinkFlow URL</Text>
            </View>
            <Text style={styles.footerTagline}>Shorten. Share. Grow.</Text>

            <View style={styles.footerLinks}>
              {[
                { label: 'Home', action: () => scrollRef.current?.scrollTo({ y: 0, animated: true }) },
                { label: 'Features', action: () => scrollToSection('features') },
                { label: 'How It Works', action: () => scrollToSection('how') },
                { label: 'About', action: () => setInfoKind('about') },
              ].map((link) => (
                <Pressable key={link.label} onPress={link.action} hitSlop={6}>
                  <Text style={styles.footerLink}>{link.label}</Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.footerLinks}>
              {[
                { label: 'Privacy', kind: 'privacy' as InfoKind },
                { label: 'Terms', kind: 'terms' as InfoKind },
                { label: 'Contact', kind: 'contact' as InfoKind },
              ].map((link) => (
                <Pressable key={link.label} onPress={() => setInfoKind(link.kind)} hitSlop={6}>
                  <Text style={styles.footerLinkMuted}>{link.label}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.footerCopy}>
              © {new Date().getFullYear()} LinkFlow URL. All rights reserved.
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Mobile navigation drawer */}
      {menuMounted ? (
        <View style={styles.menuLayer}>
          <Animated.View style={[styles.menuBackdrop, { opacity: menuAnim }]}>
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={() => closeMenu()}
              accessibilityLabel="Close navigation menu"
            />
          </Animated.View>

          <Animated.View
            style={[styles.menuPanel, { transform: [{ translateX: menuTranslate }] }]}
          >
            <View style={styles.menuTop}>
              <View style={styles.menuBrand}>
                <View style={styles.menuMark}>
                  <AppIcon name="link" size={15} color={L.bg} />
                </View>
                <Text style={styles.menuBrandText}>LinkFlow URL</Text>
              </View>
              <Pressable style={styles.menuClose} onPress={() => closeMenu()} hitSlop={8}>
                <AppIcon name="x" size={18} color={L.textSecondary} />
              </Pressable>
            </View>

            <View style={styles.menuItems}>
              {[
                { icon: 'home' as IconName, label: 'Home', key: 'home' as const },
                { icon: 'sparkles' as IconName, label: 'Features', key: 'features' as const },
                { icon: 'zap' as IconName, label: 'How It Works', key: 'how' as const },
                { icon: 'shield' as IconName, label: 'About', key: 'about' as const },
              ].map((item) => (
                <Pressable
                  key={item.key}
                  style={styles.menuItem}
                  onPress={() => handleMenuNavigate(item.key)}
                >
                  <View style={styles.menuItemIcon}>
                    <AppIcon name={item.icon} size={16} color={L.textSecondary} />
                  </View>
                  <Text style={styles.menuItemText}>{item.label}</Text>
                  <AppIcon name="arrow-right" size={13} color={L.textMuted} />
                </Pressable>
              ))}
            </View>

            <View style={styles.menuFooter}>
              <Pressable
                style={styles.menuSignIn}
                onPress={() => closeMenu(goSignIn)}
              >
                <AppIcon name="user" size={15} color={L.textSecondary} />
                <Text style={styles.menuSignInText}>Sign In</Text>
              </Pressable>

              <Pressable onPress={() => closeMenu(goSignUp)} style={styles.menuCtaWrap}>
                <View style={styles.menuCta}>
                  <Text style={styles.menuCtaText}>Get Started Free</Text>
                </View>
              </Pressable>
            </View>
          </Animated.View>
        </View>
      ) : null}

      <LandingInfoSheet
        visible={infoKind !== null}
        kind={infoKind ?? 'about'}
        onClose={() => setInfoKind(null)}
        onSignIn={goSignIn}
        onSignUp={goSignUp}
      />
    </SafeAreaView>
  );
}

/* -------------------------------------------------------------------- */
/* Section content                                                       */
/* -------------------------------------------------------------------- */

function FeatureCard({
  icon,
  title,
  desc,
  visual,
  narrow,
}: {
  icon: IconName;
  title: string;
  desc: string;
  visual: React.ReactNode;
  narrow?: boolean;
}) {
  return (
    <ScalePress
      style={[styles.featureCard, narrow && styles.featureCardNarrow]}
      onPress={() => {}}
      accessibilityLabel={`${title} feature`}
    >
      <View style={[styles.featureIcon, narrow && styles.featureIconNarrow]}>
        <AppIcon name={icon} size={narrow ? 18 : 20} color={L.textSecondary} />
      </View>
      <Text style={[styles.featureTitle, narrow && styles.featureTitleNarrow]}>{title}</Text>
      <Text style={[styles.featureDesc, narrow && styles.featureDescNarrow]}>{desc}</Text>
      <View style={styles.featureVisual}>{visual}</View>
    </ScalePress>
  );
}

function LinkMini() {
  return (
    <View style={styles.miniColumn}>
      <View style={styles.miniLongUrl}>
        <Text style={styles.miniLongText} numberOfLines={1}>
          mywebsite.com/blog/…
        </Text>
      </View>
      <View style={styles.miniArrow}>
        <View style={styles.miniArrowLine} />
        <AppIcon
          name="arrow-right"
          size={11}
          color={L.textMuted}
          style={styles.miniArrowIcon}
        />
      </View>
      <View style={styles.miniShortUrl}>
        <Text style={styles.miniShortText}>linkflow.url/x7Kp</Text>
      </View>
    </View>
  );
}

function QrMini({ narrow }: { narrow?: boolean }) {
  return (
    <View style={styles.miniQrRow}>
      <View style={[styles.miniQrTile, narrow && styles.miniQrTileNarrow]}>
        <QRCode
          value="https://linkflow.url/preview"
          size={narrow ? 30 : 34}
          color="#000000"
          backgroundColor="#FFFFFF"
        />
      </View>
      <View style={styles.miniQrCopy}>
        <Text style={[styles.miniQrTitle, narrow && styles.miniQrTitleNarrow]} numberOfLines={1}>
          Scan ready
        </Text>
        <Text style={[styles.miniQrSub, narrow && styles.miniQrSubNarrow]} numberOfLines={1}>
          Any destination
        </Text>
      </View>
    </View>
  );
}

function ChartMini() {
  const bars = [10, 18, 14, 24, 20, 30];
  return (
    <View style={styles.miniChart}>
      {bars.map((height, index) => (
        <View
          key={index}
          style={[
            styles.miniBar,
            { height },
            index === bars.length - 1 && styles.miniBarActive,
          ]}
        />
      ))}
    </View>
  );
}

function BenefitsArt() {
  return (
    <View style={styles.benefitArt}>
      <View style={styles.flowNode}>
        <View style={styles.flowIcon}>
          <AppIcon name="external" size={15} color={L.textSecondary} />
        </View>
        <Text style={styles.flowLabel}>Long URL</Text>
      </View>

      <View style={styles.flowArrow}>
        <View style={styles.flowDot} />
        <View style={styles.flowLine} />
        <AppIcon name="arrow-right" size={11} color={L.textSecondary} />
      </View>

      <View style={[styles.flowNode, styles.flowNodeActive]}>
        <View style={[styles.flowIcon, styles.flowIconActive]}>
          <AppIcon name="link" size={15} color={L.bg} />
        </View>
        <Text style={[styles.flowLabel, styles.flowLabelActive]}>Short link</Text>
      </View>

      <View style={styles.flowArrow}>
        <View style={styles.flowDot} />
        <View style={styles.flowLine} />
        <AppIcon name="arrow-right" size={11} color={L.textSecondary} />
      </View>

      <View style={styles.flowNode}>
        <View style={styles.flowQr}>
          <QRCode value="https://linkflow.url/preview" size={20} color="#000000" backgroundColor="#FFFFFF" />
        </View>
        <Text style={styles.flowLabel}>QR code</Text>
      </View>
    </View>
  );
}

/* -------------------------------------------------------------------- */
/* Styles                                                                */
/* -------------------------------------------------------------------- */

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: L.bg },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 8 },
  shell: {
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
    paddingHorizontal: 20,
  },

  /* Header */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: L.borderSoft,
    backgroundColor: L.bg,
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  brandMark: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: L.primary,
  },
  brandName: { fontSize: 16, fontWeight: '800', color: L.text, letterSpacing: 0.1 },
  brandAccent: { color: L.textSecondary },
  brandTagline: { fontSize: 9.5, fontWeight: '600', color: L.textMuted, marginTop: 1, letterSpacing: 0.3 },
  menuBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: L.card,
    borderWidth: 1,
    borderColor: L.border,
  },

  /* Hero */
  hero: { alignItems: 'center', paddingTop: 22 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: L.card,
    borderWidth: 1,
    borderColor: L.border,
    marginBottom: 16,
  },
  badgeText: { fontSize: 11.5, fontWeight: '600', color: L.textSecondary, letterSpacing: 0.2 },
  heroDesc: {
    fontSize: 14.5,
    lineHeight: 22,
    color: L.textSecondary,
    textAlign: 'center',
    marginTop: 14,
    maxWidth: 340,
  },
  ctaStack: { width: '100%', gap: 10, marginTop: 22 },
  primaryWrap: { borderRadius: 12, ...glow('#000000', 0.4, 10, 6) },
  primaryFill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    paddingVertical: 16,
    borderRadius: 12,
    minHeight: 54,
    backgroundColor: L.primary,
  },
  primaryText: { fontSize: 16, fontWeight: '800', color: L.bg, letterSpacing: 0.2 },
  ghostBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    paddingVertical: 14,
    minHeight: 52,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: L.borderStrong,
    backgroundColor: L.card,
  },
  ghostIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: L.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghostText: { fontSize: 15, fontWeight: '700', color: L.text },
  trustRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 16,
  },
  trustItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  trustText: { fontSize: 11.5, fontWeight: '600', color: L.textMuted },
  trustDivider: { width: 1, height: 11, backgroundColor: L.border },

  /* Sections */
  section: { marginTop: 44 },
  sectionSub: {
    fontSize: 13.5,
    lineHeight: 20,
    color: L.textSecondary,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 22,
    paddingHorizontal: 4,
  },

  /* Features */
  featureRow: { flexDirection: 'row', gap: 12 },
  featureCard: {
    flex: 1,
    minHeight: 196,
    padding: 14,
    borderRadius: 14,
    backgroundColor: L.card,
    borderWidth: 1,
    borderColor: L.border,
  },
  featureCardNarrow: { padding: 11, borderRadius: 12, minHeight: 206 },
  featureIconNarrow: { width: 34, height: 34, borderRadius: 8, marginBottom: 9 },
  featureWide: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 12,
    padding: 14,
    borderRadius: 14,
    backgroundColor: L.card,
    borderWidth: 1,
    borderColor: L.border,
  },
  featureWideCopy: { flex: 1 },
  featureIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: L.surfaceSecondary,
    borderWidth: 1,
    borderColor: L.borderSoft,
    marginBottom: 12,
  },
  featureTitle: { fontSize: 14.5, fontWeight: '800', color: L.text, marginBottom: 5 },
  featureTitleNarrow: { fontSize: 13.2, marginBottom: 4 },
  featureDesc: { fontSize: 11.8, lineHeight: 17, color: L.textSecondary },
  featureDescNarrow: { fontSize: 10.8, lineHeight: 15.5 },
  featureVisual: { marginTop: 'auto', paddingTop: 12 },

  /* Feature mini visuals */
  miniColumn: { gap: 4 },
  miniLongUrl: {
    paddingHorizontal: 7,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: L.cardDeep,
    borderWidth: 1,
    borderColor: L.borderSoft,
  },
  miniLongText: { fontSize: 8.5, color: L.textMuted },
  miniArrow: { alignSelf: 'flex-start', alignItems: 'center', gap: 1, paddingLeft: 11 },
  miniArrowLine: {
    width: 1.5,
    height: 9,
    borderRadius: 1,
    backgroundColor: L.borderLight,
  },
  miniArrowIcon: { transform: [{ rotate: '90deg' }] },
  miniShortUrl: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: L.surfaceSecondary,
    borderWidth: 1,
    borderColor: L.border,
  },
  miniShortText: { fontSize: 8.5, fontWeight: '700', color: L.text },

  miniQrRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  miniQrTile: {
    width: 46,
    height: 46,
    borderRadius: 9,
    backgroundColor: '#FFFFFF',
    padding: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniQrTileNarrow: { width: 40, height: 40, borderRadius: 8, padding: 4 },
  miniQrCopy: { flex: 1 },
  miniQrTitle: { fontSize: 10, fontWeight: '800', color: L.text },
  miniQrTitleNarrow: { fontSize: 9.2 },
  miniQrSub: { fontSize: 8.5, color: L.textMuted, marginTop: 2 },
  miniQrSubNarrow: { fontSize: 7.8 },

  miniChart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 5,
    height: 44,
    paddingRight: 2,
  },
  miniBar: { width: 9, borderRadius: 2, backgroundColor: L.surfaceSecondary },
  miniBarActive: { backgroundColor: L.primary },

  /* Dashboard preview */
  previewCaption: {
    fontSize: 11,
    color: L.textMuted,
    textAlign: 'center',
    marginTop: 12,
  },

  /* Steps */
  steps: { gap: 0 },
  stepCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 13,
    borderRadius: 12,
    backgroundColor: L.card,
    borderWidth: 1,
    borderColor: L.border,
  },
  stepIndex: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: L.surfaceSecondary,
    borderWidth: 1,
    borderColor: L.border,
  },
  stepIndexText: { fontSize: 13, fontWeight: '800', color: L.textSecondary, letterSpacing: 0.5 },
  stepIcon: {
    width: 34,
    height: 34,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: L.cardDeep,
  },
  stepCopy: { flex: 1 },
  stepTitle: { fontSize: 13.5, fontWeight: '800', color: L.text, marginBottom: 3 },
  stepDesc: { fontSize: 11.5, lineHeight: 16, color: L.textSecondary },
  stepConnector: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 26,
    width: 38,
  },
  stepLine: { width: 1, height: 12, backgroundColor: L.borderLight },
  stepArrow: { transform: [{ rotate: '90deg' }], marginTop: 2 },

  /* Benefits */
  benefitArt: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 18,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: L.card,
    borderWidth: 1,
    borderColor: L.border,
    overflow: 'hidden',
    marginBottom: 18,
  },
  flowNode: { alignItems: 'center', gap: 6, width: 68 },
  flowNodeActive: {},
  flowIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: L.cardDeep,
    borderWidth: 1,
    borderColor: L.borderSoft,
  },
  flowIconActive: {
    backgroundColor: L.primary,
    borderColor: L.primary,
    ...glow('#000000', 0.4, 8, 3),
  },
  flowLabel: { fontSize: 9.5, fontWeight: '700', color: L.textMuted },
  flowLabelActive: { color: L.text },
  flowQr: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4,
  },
  flowArrow: { flexDirection: 'row', alignItems: 'center', gap: 2, marginBottom: 16 },
  flowDot: { width: 3, height: 3, borderRadius: 2, backgroundColor: L.borderLight },
  flowLine: { width: 14, height: 1, backgroundColor: L.border },

  benefitList: { gap: 9 },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: L.card,
    borderWidth: 1,
    borderColor: L.borderSoft,
  },
  benefitCheck: {
    width: 22,
    height: 22,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: L.surfaceSecondary,
  },
  benefitText: { flex: 1, fontSize: 13.5, fontWeight: '600', color: L.textSecondary },

  /* Final CTA */
  ctaCard: {
    marginTop: 44,
    borderRadius: 18,
    paddingHorizontal: 22,
    paddingVertical: 28,
    alignItems: 'center',
    overflow: 'hidden',
    backgroundColor: L.card,
    borderWidth: 1,
    borderColor: L.border,
  },
  ctaTitle: {
    fontSize: 23,
    lineHeight: 30,
    fontWeight: '800',
    color: L.text,
    textAlign: 'center',
    letterSpacing: -0.4,
  },
  ctaTitleNarrow: { fontSize: 20, lineHeight: 26 },
  ctaDesc: {
    fontSize: 13,
    lineHeight: 20,
    color: L.textSecondary,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 20,
    maxWidth: 300,
  },
  ctaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: L.primary,
    paddingVertical: 14,
    paddingHorizontal: 22,
    borderRadius: 12,
    width: '100%',
    minHeight: 52,
  },
  ctaBtnNarrow: { paddingHorizontal: 12, gap: 6 },
  ctaBtnText: { fontSize: 15, fontWeight: '800', color: L.bg },
  ctaBtnTextNarrow: {
    fontSize: 13,
    flexShrink: 1,
    textAlign: 'center',
  },

  /* Footer */
  footer: {
    marginTop: 40,
    paddingTop: 26,
    paddingBottom: 18,
    borderTopWidth: 1,
    borderTopColor: L.border,
    alignItems: 'center',
  },
  footerBrand: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  footerMark: {
    width: 26,
    height: 26,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: L.primary,
  },
  footerName: { fontSize: 14.5, fontWeight: '800', color: L.text },
  footerTagline: { fontSize: 11.5, color: L.textMuted, marginTop: 6 },
  footerLinks: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 18,
    marginTop: 14,
  },
  footerLink: { fontSize: 12, fontWeight: '600', color: L.textSecondary },
  footerLinkMuted: { fontSize: 12, fontWeight: '600', color: L.textMuted },
  footerCopy: { fontSize: 10.5, color: L.textMuted, marginTop: 18 },

  /* Drawer */
  menuLayer: { ...StyleSheet.absoluteFillObject, zIndex: 40 },
  menuBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: L.overlay,
  },
  menuPanel: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    width: '82%',
    maxWidth: 330,
    backgroundColor: L.bgAlt,
    borderLeftWidth: 1,
    borderLeftColor: L.border,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 20,
  },
  menuTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  menuBrand: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  menuMark: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: L.primary,
  },
  menuBrandText: { fontSize: 15, fontWeight: '800', color: L.text },
  menuClose: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: L.card,
    borderWidth: 1,
    borderColor: L.border,
  },
  menuItems: { gap: 6 },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  menuItemIcon: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: L.card,
  },
  menuItemText: { flex: 1, fontSize: 14.5, fontWeight: '700', color: L.textSecondary },
  menuFooter: { marginTop: 'auto', gap: 10, paddingTop: 20 },
  menuSignIn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: L.borderStrong,
    backgroundColor: L.card,
  },
  menuSignInText: { fontSize: 14.5, fontWeight: '700', color: L.text },
  menuCtaWrap: { borderRadius: 10, overflow: 'hidden' },
  menuCta: { paddingVertical: 14, alignItems: 'center', borderRadius: 10, backgroundColor: L.primary },
  menuCtaText: { fontSize: 14.5, fontWeight: '800', color: L.bg },
});
