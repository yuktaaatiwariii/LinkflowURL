import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StatusBar,
  TouchableOpacity,
  Image,
  Platform,
  ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Colors } from '../../src/constants/colors';
import {
  CustomButton,
  Card,
  AppIcon,
  Section,
  GradientText,
} from '../../src/components';
import { useIsDesktop, useIsMobile } from '../../src/hooks/useBreakpoint';
import { MobileLanding } from '../../src/components/landing/MobileLanding';

/** Desktop-only FAQ. Answers intentionally limited to shipped functionality. */
const FAQ_ITEMS = [
  {
    question: 'What is LinkFlow?',
    answer:
      'LinkFlow is a link management platform that shortens URLs, creates QR codes, and keeps every link organised in one dashboard.',
  },
  {
    question: 'How does URL shortening work?',
    answer:
      'Paste a long URL into your dashboard and LinkFlow generates a short link you can copy and share anywhere.',
  },
  {
    question: 'Can I generate and share QR codes?',
    answer:
      'Yes. Each link can be turned into a QR code that you can download as an image or share straight from your device.',
  },
  {
    question: 'Can I track link performance?',
    answer:
      'Yes. Your dashboard shows total clicks, the number of shortened links, and a last-7-days activity chart.',
  },
];

export default function WelcomeScreen() {
  const router = useRouter();
  const isDesktop = useIsDesktop();
  const isMobile = useIsMobile();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const scrollToSection = useCallback((sectionId: string) => {
    setMobileMenuOpen(false);
    if (Platform.OS === 'web') {
      const element = document.getElementById(sectionId);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
      }
    }
  }, []);

  const navItems = [
    { id: 'features', label: 'Features' },
    { id: 'benefits', label: 'Benefits' },
  ];

  // Phones and tablets get the dedicated mobile-first landing experience.
  // The desktop layout below is intentionally preserved unchanged.
  if (!isDesktop) {
    return <MobileLanding />;
  }

  return (
    <SafeAreaView style={styles.safeArea as ViewStyle} edges={['top', 'bottom']}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.background} />

      {/* Navigation */}
      {isDesktop ? (
        <View style={styles.navBar}>
          <TouchableOpacity
            style={styles.navBrand}
            onPress={() => router.replace('/(auth)/welcome' as any)}
          >
            <AppIcon name="link" size={20} color={Colors.accentLight} />
            <Text style={styles.navBrandText}>LinkFlow URL</Text>
          </TouchableOpacity>

          <View style={styles.navMenu}>
            {navItems.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={styles.navItem}
                onPress={() => scrollToSection(item.id)}
              >
                <Text style={styles.navItemText}>{item.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={styles.navSignIn}
            onPress={() => router.push('/(auth)/sign-in' as any)}
          >
            <Text style={styles.navSignInText}>Sign In</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.mobileNavBar}>
          <TouchableOpacity
            style={styles.navBrand}
            onPress={() => router.replace('/(auth)/welcome' as any)}
          >
            <AppIcon name="link" size={20} color={Colors.accentLight} />
            <Text style={styles.navBrandText}>LinkFlow URL</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.mobileMenuBtn}
            onPress={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            <AppIcon
              name={mobileMenuOpen ? 'x' : 'menu'}
              size={24}
              color={Colors.textPrimary}
            />
          </TouchableOpacity>
        </View>
      )}

       {/* Mobile Menu Overlay */}
      {isMobile && mobileMenuOpen && (
        <TouchableOpacity
          style={styles.backdropPlaceholder}
          onPress={() => setMobileMenuOpen(false)}
          activeOpacity={1}
        >
          <View style={styles.mobileMenuOverlay}>
            <View style={styles.mobileMenuContent}>
              <TouchableOpacity
                style={styles.mobileMenuClose}
                onPress={() => setMobileMenuOpen(false)}
              >
                <AppIcon name="x" size={24} color={Colors.textPrimary} />
              </TouchableOpacity>
              <View style={styles.mobileMenuItems}>
                {navItems.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    style={styles.mobileMenuItem}
                    onPress={() => scrollToSection(item.id)}
                  >
                    <Text style={styles.mobileMenuItemText}>{item.label}</Text>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity
                  style={styles.mobileMenuItem}
                  onPress={() => router.push('/(auth)/sign-in' as any)}
                >
                  <Text style={styles.mobileMenuItemText}>Sign In</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.mobileMenuItem, styles.mobileMenuItemPrimary]}
                  onPress={() => router.push('/(auth)/sign-up' as any)}
                >
                  <Text style={[styles.mobileMenuItemText, styles.mobileMenuItemTextPrimary]}>Get Started Free</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </TouchableOpacity>
      )}

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { alignItems: 'center' }]}
        showsVerticalScrollIndicator={false}
      >
 {/* Hero Section */}
<View style={styles.heroSection} id="hero">
  {isDesktop ? (
    <>
      {/* Layer 0: full-bleed desktop hero background */}
      <View pointerEvents="none" style={styles.heroBgWrap}>
        <Image
          source={require('../../assets/image.png')}
          style={styles.heroBgImage}
          resizeMode="cover"
        />
      </View>
      {/* Layer 1: readability overlay */}
      <View pointerEvents="none" style={styles.heroBgOverlay} />

      {/* Layer 10: existing hero content, anchored left */}
      <View style={styles.heroDesktop}>
        <View style={styles.heroLeft}>
          <View style={[styles.badgePill, styles.badgePillDesktop]}>
            <AppIcon name="sparkles" size={14} color={Colors.accent} />
            <Text style={styles.badgeText}>
              Next-Gen URL & QR Engine
            </Text>
          </View>

          <View style={styles.heroHeadingWrapper}>
            <Text style={[styles.heroKicker, styles.heroTextDesktop, {
              fontSize: 52,
              lineHeight: 60,
            }]}>
              Shorten Links.
            </Text>

            <GradientText style={[styles.heroGradient, styles.heroTextDesktop, {
              fontSize: 52,
              lineHeight: 60,
            }] as any}>
              Create QR Codes.
            </GradientText>

            <Text style={[styles.heroKicker, styles.heroTextDesktop, {
              fontSize: 52,
              lineHeight: 60,
            }] as any}>
              Share Smarter.
            </Text>
          </View>

          <Text style={[styles.heroDescription, styles.heroTextDesktop, {
            fontSize: 18,
            lineHeight: 30,
            maxWidth: 540,
          }]}>
            Turn long URLs into clean, shareable short links and beautiful QR
            codes. Manage everything in one place with LinkFlow URL.
          </Text>

          <View style={[styles.heroActions, styles.heroActionsDesktop]}>
            <CustomButton
              title="Get Started Free"
              size="lg"
              variant="primary"
              gradient
              onPress={() => router.push('/(auth)/sign-up' as any)}
            />

            <CustomButton
              title="Learn More"
              size="lg"
              variant="outline"
              onPress={() => scrollToSection('features')}
            />
          </View>
        </View>
      </View>
    </>
  ) : (
    <View style={styles.heroMobileContent}>
        <View style={[styles.badgePill, styles.badgePillMobile]}>
          <AppIcon name="sparkles" size={14} color={Colors.accent} />
          <Text style={styles.badgeText}>
            Next-Gen URL & QR Engine
          </Text>
        </View>

      <View style={styles.heroHeadingWrapper}>
        <Text style={[styles.heroKicker, {
          fontSize: 38,
          lineHeight: 46,
        }]}>
          Shorten Links.
        </Text>

        <GradientText style={[styles.heroGradient, {
          fontSize: 38,
          lineHeight: 46,
        }] as any}>
          Create QR Codes.
        </GradientText>

        <Text style={[styles.heroKicker, {
          fontSize: 38,
          lineHeight: 46,
        }] as any}>
          Share Smarter.
        </Text>
      </View>

      <Text style={[styles.heroDescription, {
        fontSize: 16,
        lineHeight: 26,
        textAlign: 'center',
      }]}>
        Turn long URLs into clean, shareable short links and beautiful QR
        codes. Manage everything in one place with LinkFlow URL.
      </Text>

      <View style={styles.heroActions}>
        <CustomButton
          title="Get Started Free"
          size="lg"
          variant="primary"
          gradient
          onPress={() => router.push('/(auth)/sign-up' as any)}
          fullWidth
        />

        <CustomButton
          title="Learn More"
          size="lg"
          variant="outline"
          onPress={() => scrollToSection('features')}
          fullWidth
        />
      </View>

    </View>
  )}
</View>

        {/* Features Section */}
        <View style={styles.featuresSection} id="features">
          <Section >
            <Text style={styles.sectionHeading}>
              Everything You Need to <Text style={styles.sectionHeadingAccent}>Manage Links</Text>
            </Text>
            <Text style={styles.sectionSubtitle}>
              Simple. Fast. Feature-rich.
            </Text>
          </Section>

          <View style={[styles.featuresGrid, isDesktop && styles.featuresGridDesktop]}>
            <Card style={styles.featureCard} variant="elevated">
              <View style={styles.featureIcon}>
                <AppIcon name="link" size={28} color={Colors.accentLight} />
              </View>
              <Text style={styles.featureTitle}>URL Shortener</Text>
              <Text style={styles.featureDesc}>
                Convert lengthy URLs into compact, shareable links in seconds.
              </Text>
            </Card>

            <Card style={styles.featureCard} variant="elevated">
              <View style={styles.featureIcon}>
                <AppIcon name="qr" size={28} color={Colors.accentLight} />
              </View>
              <Text style={styles.featureTitle}>QR Code Generator</Text>
              <Text style={styles.featureDesc}>
                Generate custom QR codes for your links and share them instantly.
              </Text>
            </Card>

          <Card style={styles.featureCard} variant="elevated">
              <View style={styles.featureIcon}>
                <AppIcon name="chart" size={28} color={Colors.accentLight} />
              </View>
              <Text style={styles.featureTitle}>Link Management</Text>
              <Text style={styles.featureDesc}>
                Track and manage your links and QR codes from one dashboard.
              </Text>
            </Card>
          </View>
        </View>

        {/* Benefits Section */}
        <View style={styles.benefitsSection} id="benefits">
          {isDesktop ? (
            <View style={styles.benefitsDesktop}>
              {/* Left Column — compact desktop FAQ */}
              <View style={styles.benefitsFaq}>
                <Text style={styles.faqHeading}>Frequently Asked Questions</Text>

                <View style={styles.faqList}>
                  {FAQ_ITEMS.map((item, index) => {
                    const isOpen = openFaq === index;
                    return (
                      <View key={item.question} style={styles.faqItem}>
                        <TouchableOpacity
                          style={styles.faqQuestionRow}
                          activeOpacity={0.75}
                          accessibilityRole="button"
                          accessibilityState={{ expanded: isOpen }}
                          onPress={() => setOpenFaq(isOpen ? null : index)}
                        >
                          <Text style={styles.faqQuestion}>{item.question}</Text>
                          <View style={[styles.faqIcon, isOpen && styles.faqIconOpen]}>
                            <AppIcon name="plus" size={15} color={Colors.textSecondary} />
                          </View>
                        </TouchableOpacity>

                        {isOpen && (
                          <Text style={styles.faqAnswer}>{item.answer}</Text>
                        )}
                      </View>
                    );
                  })}
                </View>
              </View>

              {/* Right Column — existing content */}
              <View style={styles.benefitsContent}>
                <Text style={[styles.benefitsKicker, styles.benefitsTextDesktop]}>Why Choose LinkFlow?</Text>
                <Text style={[styles.benefitsHeading, styles.benefitsHeadingDesktop, styles.benefitsTextDesktop]}>
                  More Than Just a URL Shortener
                </Text>
                <Text style={[styles.benefitsDesc, styles.benefitsTextDesktop]}>
                  A complete link management solution designed for speed,
                  simplicity, and powerful insights.
                </Text>

                <View style={[styles.benefitsList, styles.benefitsListDesktop]}>
                  <TouchableOpacity
                    style={[styles.benefitItem, styles.benefitItemHover]}
                    activeOpacity={0.8}
                  >
                    <AppIcon name="check" size={18} color={Colors.accent} />
                    <Text style={[styles.benefitText, styles.benefitTextHover]}>
                      Instant Link Shortening
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.benefitItem, styles.benefitItemHover]}
                    activeOpacity={0.8}
                  >
                    <AppIcon name="check" size={18} color={Colors.accent} />
                    <Text style={[styles.benefitText, styles.benefitTextHover]}>
                      Custom QR Codes
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.benefitItem, styles.benefitItemHover]}
                    activeOpacity={0.8}
                  >
                    <AppIcon name="check" size={18} color={Colors.accent} />
                    <Text style={[styles.benefitText, styles.benefitTextHover]}>
                      Real-time Analytics
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.benefitItem, styles.benefitItemHover]}
                    activeOpacity={0.8}
                  >
                    <AppIcon name="check" size={18} color={Colors.accent} />
                    <Text style={[styles.benefitText, styles.benefitTextHover]}>
                      Easy Link Management
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ) : (
            <View style={styles.benefitsMobile}>
              <Text style={styles.benefitsKicker}>Why Choose LinkFlow?</Text>
              <Text style={styles.benefitsHeading}>
                More Than Just a URL Shortener
              </Text>
              <Text style={styles.benefitsDesc}>
                A complete link management solution designed for speed,
                simplicity, and powerful insights.
              </Text>

              <View style={styles.benefitsList}>
                <TouchableOpacity
                  style={[styles.benefitItem, styles.benefitItemHover]}
                  activeOpacity={0.8}
                >
                  <AppIcon name="check" size={18} color={Colors.accent} />
                  <Text style={[styles.benefitText, styles.benefitTextHover]}>
                    Instant Link Shortening
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.benefitItem, styles.benefitItemHover]}
                  activeOpacity={0.8}
                >
                  <AppIcon name="check" size={18} color={Colors.accent} />
                  <Text style={[styles.benefitText, styles.benefitTextHover]}>
                    Custom QR Codes
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.benefitItem, styles.benefitItemHover]}
                  activeOpacity={0.8}
                >
                  <AppIcon name="check" size={18} color={Colors.accent} />
                  <Text style={[styles.benefitText, styles.benefitTextHover]}>
                    Real-time Analytics
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.benefitItem, styles.benefitItemHover]}
                  activeOpacity={0.8}
                >
                  <AppIcon name="check" size={18} color={Colors.accent} />
                  <Text style={[styles.benefitText, styles.benefitTextHover]}>
                    Easy Link Management
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        {/* CTA Banner */}
        <View style={styles.ctaBanner}>
          <View style={[styles.ctaContent, !isDesktop && styles.ctaContentMobile]}>
            <View style={styles.ctaTextGroup}>
              <Text style={styles.ctaHeading}>Start Shortening Today!</Text>
              <Text style={styles.ctaDesc}>
                Join thousands of users who trust LinkFlow URL.
              </Text>
            </View>
            <CustomButton
              title="Create Free Account"
              size="lg"
              variant="primary"
              gradient
              onPress={() => router.push('/(auth)/sign-up' as any)}
            />
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <View style={[styles.footerContent, !isDesktop && styles.footerContentMobile]}>
            <View style={styles.footerBrand}>
              <AppIcon name="link" size={20} color={Colors.accentLight} />
              <Text style={styles.footerBrandText}>LinkFlow URL</Text>
              <Text style={styles.footerTagline}>Shorten. Share. Grow.</Text>
            </View>

  <View style={styles.footerLinks}>
              <View style={styles.footerLinkGroup}>
                        <TouchableOpacity style={styles.footerLinkItem} onPress={() => scrollToSection('features')}>
                  <Text style={styles.footerLinkText}>Features</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.footerLinkItem} onPress={() => scrollToSection('benefits')}>
                  <Text style={styles.footerLinkText}>Benefits</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.footerLinkGroup}>
                <TouchableOpacity style={styles.footerLinkItem} onPress={() => router.push('/(auth)/sign-in' as any)}>
                  <Text style={styles.footerLinkText}>Privacy</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.footerLinkItem} onPress={() => router.push('/(auth)/sign-in' as any)}>
                  <Text style={styles.footerLinkText}>Terms</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.footerLinkItem} onPress={() => router.push('/(auth)/sign-in' as any)}>
                  <Text style={styles.footerLinkText}>Contact</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.footerSocial}>
              <TouchableOpacity style={styles.socialItem}>
                <AppIcon name="external" size={20} color={Colors.textSecondary} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.socialItem}>
                <AppIcon name="external" size={20} color={Colors.textSecondary} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.socialItem}>
                <AppIcon name="external" size={20} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles: any = {
  backdropPlaceholder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'transparent',
  },
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },

  /* Navigation */
  navBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingVertical: 20,
    backgroundColor: Colors.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  navBrand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  navBrandText: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  navMenu: {
    flexDirection: 'row',
    gap: 32,
  },
  navItem: {
    paddingVertical: 8,
  },
  navItemText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  navSignIn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
  },
  navSignInText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.background,
  },

  mobileNavBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: Colors.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  mobileMenuBtn: {
    padding: 8,
  }, 
  
  
  mobileMenuOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(24, 24, 24, 0.98)',
  },
  mobileMenuContent: {
    padding: 32,
    paddingTop: 80,
  },
  mobileMenuClose: {
    position: 'absolute',
    top: 24,
    right: 24,
    padding: 8,
  },

  mobileMenuItems: {
    marginTop: 40,
    gap: 16,
  },
  mobileMenuItem: {
    paddingVertical: 12,
  },
  mobileMenuItemPrimary: {
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingHorizontal: 16,
  },
  mobileMenuItemText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  mobileMenuItemTextPrimary: {
    color: Colors.background,
  },

  /* Hero */
heroSection: {
  position: 'relative',
  width: '100%',
  maxWidth: 1600,
  minHeight: 650,
  paddingHorizontal: 64,
  paddingTop: 56,
  paddingBottom: 88,
  alignSelf: 'center',
  justifyContent: 'center',
  backgroundColor: Colors.background,
  overflow: 'hidden',
},

heroDesktop: {
  width: '100%',
  maxWidth: 1240,
  minHeight: 520,
  alignSelf: 'center',
  justifyContent: 'center',
  alignItems: 'flex-start',
  zIndex: 10,
},

heroLeft: {
  width: '100%',
  maxWidth: 620,
  alignItems: 'flex-start',
  zIndex: 10,
},

/* Desktop-only hero background layers */
heroBgWrap: {
  position: 'absolute',
  top: 0,
  bottom: 0,
  left: '-12%',
  right: 0,
  zIndex: 0,
},

heroBgImage: {
  width: '100%',
  height: '100%',
},

heroBgOverlay: {
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: 'rgba(0, 0, 0, 0.55)',
  zIndex: 1,
},

/* Desktop-only hero text alignment */
badgePillDesktop: {
  alignSelf: 'flex-start',
},

heroTextDesktop: {
  textAlign: 'left',
},

heroActionsDesktop: {
  justifyContent: 'flex-start',
},

heroMobileContent: {
  width: '100%',
  alignItems: 'center',
  gap: 24,
  paddingHorizontal: 4,
  zIndex: 10,
},

badgePill: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 8,
  alignSelf: 'center',
  paddingHorizontal: 12,
  paddingVertical: 6,
  borderRadius: 8,
  backgroundColor: Colors.surfaceCard,
  borderWidth: 1,
  borderColor: Colors.border,
  marginBottom: 20,
},

badgePillMobile: {
  alignSelf: 'center',
},

badgeText: {
  fontSize: 12,
  fontWeight: '700',
  letterSpacing: 0.6,
  color: Colors.textSecondary,
  textTransform: 'uppercase',
},

heroKicker: {
  fontWeight: '900',
  color: '#FFFFFF',
  marginBottom: 4,
  letterSpacing: -1.8,
  textAlign: 'center',
},

heroGradient: {
  color: Colors.accent,
  fontWeight: '900',
  letterSpacing: -1.8,
  textAlign: 'center',
},

heroDescription: {
  fontSize: 19,
  color: Colors.textSecondary,
  lineHeight: 31,
  marginBottom: 34,
  textAlign: 'left',
},

heroActions: {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 18,
  marginBottom: 40,
  marginTop: 2,
},
  

  /* Phone Mockup */
  phoneMockup: {
    position: 'relative',
    backgroundColor: Colors.surfaceCard,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 24,
    padding: 24,
    width: '100%',
    height: 420,
    overflow: 'hidden',
  },
  phoneHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 24,
  },
  phoneBrand: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  phoneBody: {
    flex: 1,
  },
  urlInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 24,
  },
  urlInput: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  urlInputText: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  shortenBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
  },
  shortenBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.background,
  },
  resultCard: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
  },
  resultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  resultShortUrl: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.accentLight,
  },
  copyBtn: {
    padding: 6,
  },
  qrPreview: {
    alignItems: 'center',
    marginTop: 16,
  },
  qrCodeLarge: {
    position: 'absolute',
    top: 60,
    right: -60,
    alignItems: 'center',
  },

  phoneMockupMobile: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: Colors.surfaceCard,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 20,
    padding: 20,
    marginTop: 40,
  },

  /* Features */
  featuresSection: {
    width: '100%',
    maxWidth: 1360,
    paddingHorizontal: 92,
    paddingBottom: 92,
    alignItems: 'center',
    alignSelf: 'center',
    borderWidth: 1,
    padding:40,
    borderBottomColor: Colors.border,
  },
  featuresGrid: {
    flexDirection: 'column',
    gap: 16,
    width: '100%',
  },
  featuresGridDesktop: {
    flexDirection: 'row',
    gap: 18,
  },
  sectionHeading: {
    padding:20,
    fontSize: 28,
    lineHeight: 36,
    fontWeight: '800',
    color: Colors.textPrimary,
    textAlign: 'center',
  
  },
  sectionHeadingAccent: {
    color: Colors.accentLight,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 28,
  },
  featureCard: {
    flex: 1,
    padding: 22,
    minHeight: 178,
    backgroundColor: Colors.surfaceCard,
    borderColor: Colors.border,
    borderWidth: 1,
    borderRadius: 18,
  },
  featureIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: Colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  featureTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 8,
  },

    featureDesc: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 22,
  },

  /* Benefits */
  benefitsSection: {
    width: '100%',
    paddingHorizontal: 48,
    paddingBottom: 90,
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: Colors.background,
  },
  benefitsDesktop: {
    position: 'relative',
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    maxWidth: 1240,
    alignSelf: 'center',
    minHeight: 450,
    gap: 64,
  },
  /* Desktop-only Why Choose Us FAQ */
  benefitsFaq: {
    flex: 1,
    maxWidth: 560,
    alignSelf: 'center',
  },
  faqHeading: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
    color: Colors.textPrimary,
    marginBottom: 16,
  },
  faqList: {
    width: '100%',
  },
  faqItem: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  faqQuestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    paddingVertical: 14,
  },
  faqQuestion: {
    flex: 1,
    fontSize: 14.5,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  faqAnswer: {
    fontSize: 13.5,
    lineHeight: 21,
    color: Colors.textSecondary,
    paddingRight: 30,
    paddingBottom: 14,
  },
  faqIcon: {
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  faqIconOpen: {
    transform: [{ rotate: '45deg' }],
  },
  benefitsHeadingDesktop: {
    fontSize: 34,
    lineHeight: 44,
  },
  benefitsTextDesktop: {
    textAlign: 'left',
    alignSelf: 'stretch',
  },
  benefitsListDesktop: {
    alignSelf: 'flex-start',
    maxWidth: 460,
  },
  benefitsContent: {
    flex: 1,
    zIndex: 10,
    maxWidth: 560,
    alignSelf: 'center',
    alignItems: 'flex-start',
    textAlign: 'left',
  },
  benefitsKicker: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.accent,
    marginBottom: 12,
    textAlign: 'center',
  },
  benefitsHeading: {
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: 16,
    lineHeight: 32,
    textAlign: 'center',
  },
  benefitsDesc: {
    fontSize: 15,
    color: Colors.textSecondary,
    lineHeight: 24,
    marginBottom: 32,
    textAlign: 'center',
  },
  benefitsList: {
    gap: 12,
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
  },
  benefitItemHover: {
    paddingLeft: 16,
    paddingRight: 16,
    borderRadius: 10,
  },
  benefitText: {
    fontSize: 15,
    color: Colors.textSecondary,
  },
  benefitTextHover: {
    color: Colors.textPrimary,
    fontWeight: '600',
  },

  dashboardMockup: {
    backgroundColor: Colors.surfaceCard,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 20,
    padding: 24,
    width: '100%',
    height: 320,
  },
  dashboardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  dashboardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  newLinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  newLinkBtnText: {
    fontSize: 13,
      fontWeight: '600',
    color: Colors.background,
  },
  dashboardList: {
    gap: 12,
    marginBottom: 20,
  },
  dashboardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  dashboardShortUrl: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.accentLight,
    flex: 1,
  },
  dashboardClicks: {
    fontSize: 13,
    color: Colors.textMuted,
  },
  dashboardMore: {
    padding: 4,
  },
  analyticsCard: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  analyticsSparkline: {
    width: 60,
    height: 30,
    backgroundColor: Colors.primary,
    borderRadius: 6,
    opacity: 0.3,
  },
  analyticsInfo: {
    gap: 4,
  },
  analyticsLabel: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  analyticsValue: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  analyticsChange: {
    fontSize: 12,
    color: Colors.success,
    fontWeight: '700',
  },

  benefitsMobile: {
    position: 'relative',
    zIndex: 10,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    textAlign: 'center',
  },
  dashboardMockupMobile: {
    backgroundColor: Colors.surfaceCard,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 16,
    padding: 20,
    width: '100%',
    height: 240,
  },

  /* CTA Banner */
  ctaBanner: {
    width: '100%',
    maxWidth: 1280,
    paddingHorizontal: 36,
    paddingVertical: 26,
    backgroundColor: Colors.surfaceCard,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
      marginBottom: 64,
    alignSelf: 'center',
  },
  ctaContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 24,
    maxWidth: 1160,
    width: '100%',
    alignSelf: 'center',
  },
  ctaTextGroup: {
    flex: 1,
    gap: 6,
  },
  ctaContentMobile: {
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    gap: 10,
  },
  ctaHeading: {
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  ctaDesc: {
    fontSize: 15,
    color: Colors.textSecondary,
    marginBottom: 0,
  },

  /* Footer */
  footer: {
    width: '100%',
    paddingHorizontal: 40,
    paddingVertical: 22,
    backgroundColor: Colors.background,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  footerContent: {
    maxWidth: 1280,
    width: '100%',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 24,
  },
  footerBrand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 0,
    flexShrink: 0,
  },
  footerContentMobile: {
    flexDirection: 'column',
    gap: 14,
  },
  footerBrandText: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  footerTagline: {
    fontSize: 13,
    color: Colors.textMuted,
  },
  footerLinks: {
    flexWrap: 'wrap',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 28,
    flex: 1,
    width: 'auto',
    maxWidth: 600,
    marginBottom: 0,
  },
  footerLinkGroup: {
    flexWrap: 'wrap',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
  },
  footerLinkTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 0,
  },
  footerLinkItem: {
    paddingVertical: 6,
  },
  footerLinkText: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  footerSocial: {
    flexDirection: 'row',
    gap: 10,
    flexShrink: 0,
  },
  socialItem: {
    padding: 8,
  },
};
