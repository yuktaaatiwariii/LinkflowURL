import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StatusBar,
  TouchableOpacity,
  Platform,
  Image,
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

export default function WelcomeScreen() {
  const router = useRouter();
  const isDesktop = useIsDesktop();
  const isMobile = useIsMobile();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
                  <Text style={styles.mobileMenuItemText}>Get Started Free</Text>
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
  {/* Layer 0: Full-size background image */}
  <Image
    source={require('../../assets/img.png')}
    style={styles.heroBgImage}
    resizeMode="cover"
  />
  {/* Layer 0.5: Subtle dark overlay for readability */}
  <View style={styles.heroBgOverlay} />
  <View pointerEvents="none" style={styles.heroBackgroundGlow} />
  <View pointerEvents="none" style={styles.heroBackgroundGlowSecondary} />

  {isDesktop ? (
    <View style={styles.heroDesktop}>
      {/* Left Column */}
      <View style={styles.heroLeft}>
        <View style={styles.badgePill}>
          <AppIcon name="sparkles" size={14} color={Colors.accent} />
          <Text style={styles.badgeText}>
            Next-Gen URL & QR Engine
          </Text>
        </View>

        <View style={styles.heroHeadingWrapper}>
          <Text style={[styles.heroKicker, {
            fontSize: 68,
            lineHeight: 76,
          }]}>
            Shorten Links.
          </Text>

          <GradientText style={[styles.heroGradient, {
            fontSize: 68,
            lineHeight: 76,
          }] as any}>
            Create QR Codes.
          </GradientText>

          <Text style={[styles.heroKicker, {
            fontSize: 68,
            lineHeight: 76,
          }] as any}>
            Share Smarter.
          </Text>
        </View>

        <Text style={[styles.heroDescription, {
          fontSize: 19,
          lineHeight: 31,
          maxWidth: 540,
          textAlign: 'left',
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
  ) : (
    <View style={styles.heroMobileContent}>
      <View style={styles.badgePill}>
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
          {/* Layer 0: Full-size background image */}
          <Image
            source={require('../../assets/left.png')}
            style={styles.benefitsBgImage}
            resizeMode="cover"
          />
          {/* Layer 0.5: Subtle dark overlay for readability */}
          <View style={styles.benefitsBgOverlay} />

          {isDesktop ? (
            <View style={styles.benefitsDesktop}>
              <View style={styles.benefitsContent}>
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
    color: Colors.textPrimary,
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
    backgroundColor: 'rgba(9, 5, 20, 0.95)',
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
  },
  mobileMenuItemText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
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
  backgroundColor: '#090414',
  overflow: 'hidden',
},

heroBackgroundGlow: {
  position: 'absolute',
  width: 620,
  height: 620,
  borderRadius: 310,
  right: '8%',
  top: 10,
  backgroundColor: '#3B0764',
  opacity: 0.22,
},

heroBackgroundGlowSecondary: {
  position: 'absolute',
  width: 460,
  height: 460,
  borderRadius: 230,
  left: '-12%',
  bottom: -240,
  backgroundColor: '#581C87',
  opacity: 0.16,
},

heroBgImage: {
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  width: '100%',
  height: '100%',
  zIndex: 0,
},

heroBgOverlay: {
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: 'rgba(9, 5, 20, 0.35)',
  zIndex: 5,
},

heroDesktop: {
  width: '100%',
  maxWidth: 1360,
  minHeight: 500,
  alignSelf: 'center',
},

heroLeft: {
  flex: 1.08,
  maxWidth: 690,
  zIndex: 10,
},

heroMobileContent: {
  width: '100%',
  alignItems: 'center',
  gap: 24,
  paddingHorizontal: 4,
  zIndex: 10,
},

heroKicker: {
  fontWeight: '900',
  color: '#FFFFFF',
  marginBottom: 4,
  letterSpacing: -1.8,
},

heroGradient: {
  color: Colors.accent,
  fontWeight: '900',
  letterSpacing: -1.8,
},

heroDescription: {
  fontSize: 19,
  color: '#D6CBEA',
  lineHeight: 31,
  marginBottom: 34,
  textAlign: 'left',
},

heroActions: {
  flexDirection: 'row',
  alignItems: 'center',
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
    color: Colors.textPrimary,
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
  phoneGlow: {
    position: 'absolute',
    top: -40,
    right: -40,
    width: 160,
    height: 160,
    backgroundColor: Colors.primary,
    borderRadius: 80,
    opacity: 0.3,
  },
  qrCodeLarge: {
    position: 'absolute',
    top: 60,
    right: -60,
    alignItems: 'center',
  },
   qrCodeGlow: {
    position: 'absolute',
    top: -20,
    left: -20,
    right: -20,
    bottom: -20,
    backgroundColor: Colors.primary,
    borderRadius: 60,
    opacity: 0.15,
    zIndex: -1,
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
  },
  benefitsBgImage: {
    position: 'absolute',
    top: 0,
    
    left: 60,
    right: 0,
    bottom: 0,
    width: '80%',
    height: '100%',
    zIndex: 0,
  },
  benefitsBgOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(9, 5, 20, 0.4)',
    zIndex: 5,
  },
  benefitsDesktop: {
    position: 'relative',
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    width: '100%',
    maxWidth: 1400,
    alignSelf: 'center',
    minHeight: 450,
  },
  benefitsContent: {
    zIndex: 10,
    maxWidth: 520,
    alignSelf: 'flex-end',
    textAlign: 'left',
  },
  benefitsKicker: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.accent,
    marginBottom: 12,
  },
  benefitsHeading: {
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: 16,
    lineHeight: 32,
  },
  benefitsDesc: {
    fontSize: 15,
    color: Colors.textSecondary,
    lineHeight: 24,
    marginBottom: 32,
  },
  benefitsList: {
    gap: 12,
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
    color: Colors.textPrimary,
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
    backgroundColor: Colors.primary,
    borderRadius: 18,
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
    color: Colors.accentLight,
    marginBottom: 0,
  },

  /* Footer */
  footer: {
    width: '100%',
    paddingHorizontal: 40,
    paddingVertical: 22,
    backgroundColor: '#080512',
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
