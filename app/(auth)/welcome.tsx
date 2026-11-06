import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  SafeAreaView,
  StatusBar,
  TouchableOpacity,
  Platform,
} from 'react-native';
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
    { id: 'how-it-works', label: 'How It Works' },
    { id: 'faq', label: 'FAQ' },
  ];

  return (
    <SafeAreaView style={styles.safeArea as ViewStyle}>
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
          {isDesktop ? (
            <View style={styles.heroDesktop}>
              {/* Left Column */}
              <View style={styles.heroLeft}>
                <View style={styles.badgePill}>
                  <AppIcon name="sparkles" size={14} color={Colors.accent} />
                  <Text style={styles.badgeText}>Next-Gen URL & QR Engine</Text>
                </View>

                <View style={styles.heroHeadingWrapper}>
                  <Text style={[styles.heroKicker, { fontSize: isDesktop ? 56 : 32, lineHeight: isDesktop ? 64 : 40 }] as any}>
                    Shorten Links.
                  </Text>
                  <GradientText style={[styles.heroGradient, { fontSize: isDesktop ? 56 : 32, lineHeight: isDesktop ? 64 : 40 }] as any}>
                    Create QR Codes.
                  </GradientText>
                  <Text style={[styles.heroKicker, { fontSize: isDesktop ? 56 : 32, lineHeight: isDesktop ? 64 : 40 }] as any}>
                    Share Smarter.
                  </Text>
                </View>

                <Text style={[styles.heroDescription, { fontSize: isDesktop ? 16 : 15, maxWidth: isDesktop ? 480 : '100%', textAlign: isDesktop ? 'left' : 'center' }] as any}>
                  Turn long URLs into clean, shareable short links and beautiful QR
                  codes. Manage everything in one place with LinkFlow URL.
                </Text>

                <View style={[styles.heroActions, { marginBottom: isDesktop ? 0 : 40 }] as any}>
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

              {/* Right Column - Product Illustration */}
              <View style={styles.heroRight}>
                <View style={styles.phoneMockup}>
                  <View style={styles.phoneHeader}>
                    <AppIcon name="link" size={16} color={Colors.accentLight} />
                    <Text style={styles.phoneBrand}>LinkFlow URL</Text>
                  </View>

                  <View style={styles.phoneBody}>
                    <View style={styles.urlInputRow}>
                      <View style={styles.urlInput}>
                        <Text style={styles.urlInputText}>
                          https://your-long-link.com
                        </Text>
                      </View>
                      <TouchableOpacity style={styles.shortenBtn}>
                        <Text style={styles.shortenBtnText}>Shorten</Text>
                      </TouchableOpacity>
                    </View>

                    <View style={styles.resultCard}>
                      <View style={styles.resultRow}>
                        <Text style={styles.resultShortUrl}>
                          linkflow.app/abc123
                        </Text>
                        <TouchableOpacity style={styles.copyBtn}>
                          <AppIcon name="copy" size={16} color={Colors.textSecondary} />
                        </TouchableOpacity>
                      </View>
                    </View>

                    <View style={styles.qrPreview}>
                      <AppIcon name="qr" size={80} color={Colors.accentLight} />
                    </View>
                  </View>

                  <View style={styles.phoneGlow}></View>
                </View>

                <View style={styles.qrCodeLarge}>
                  <AppIcon name="qr" size={100} color={Colors.accentLight} />
                  <View style={styles.qrCodeGlow}></View>
                </View>
              </View>
            </View>
          ) : (
            <View style={styles.heroMobile}>
              <View style={styles.badgePill}>
                <AppIcon name="sparkles" size={14} color={Colors.accent} />
                <Text style={styles.badgeText}>Next-Gen URL & QR Engine</Text>
              </View>

              <View style={styles.heroHeadingWrapper}>
                <Text style={[styles.heroKicker, { fontSize: isDesktop ? 56 : 32, lineHeight: isDesktop ? 64 : 40 }] as any}>
                  Shorten Links.
                </Text>
                <GradientText style={[styles.heroGradient, { fontSize: isDesktop ? 56 : 32, lineHeight: isDesktop ? 64 : 40 }] as any}>
                  Create QR Codes.
                </GradientText>
                <Text style={[styles.heroKicker, { fontSize: isDesktop ? 56 : 32, lineHeight: isDesktop ? 64 : 40 }] as any}>
                  Share Smarter.
                </Text>
              </View>

              <Text style={[styles.heroDescription, { fontSize: isDesktop ? 16 : 15, maxWidth: isDesktop ? 480 : '100%', textAlign: isDesktop ? 'left' : 'center' }] as any}>
                Turn long URLs into clean, shareable short links and beautiful QR
                codes. Manage everything in one place with LinkFlow URL.
              </Text>

              <View style={[styles.heroActions, { marginBottom: isDesktop ? 0 : 40 }] as any}>
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

              <View style={styles.phoneMockupMobile}>
                <View style={styles.phoneHeader}>
                  <AppIcon name="link" size={16} color={Colors.accentLight} />
                  <Text style={styles.phoneBrand}>LinkFlow URL</Text>
                </View>

                <View style={styles.phoneBody}>
                  <View style={styles.urlInputRow}>
                    <View style={styles.urlInput}>
                      <Text style={styles.urlInputText}>
                        https://your-long-link.com
                      </Text>
                    </View>
                    <TouchableOpacity style={styles.shortenBtn}>
                      <Text style={styles.shortenBtnText}>Shorten</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.resultCard}>
                    <View style={styles.resultRow}>
                      <Text style={styles.resultShortUrl}>
                        linkflow.app/abc123
                      </Text>
                      <TouchableOpacity style={styles.copyBtn}>
                        <AppIcon name="copy" size={16} color={Colors.textSecondary} />
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View style={styles.qrPreview}>
                    <AppIcon name="qr" size={60} color={Colors.accentLight} />
                  </View>
                </View>

                <View style={styles.phoneGlow}></View>
              </View>
            </View>
          )}
        </View>

        {/* Features Section */}
        <View style={styles.featuresSection} id="features">
          <Section title="Powerful Features" titleBottom={8}>
            <Text style={styles.sectionHeading}>
              Everything You Need to Manage Links
            </Text>
            <Text style={styles.sectionSubtitle}>
              Simple. Fast. Feature-rich.
            </Text>
          </Section>

          <View style={styles.featuresGrid}>
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
              {/* Left: Illustration */}
              <View style={styles.benefitsIllustration}>
                <View style={styles.dashboardMockup}>
                  <View style={styles.dashboardHeader}>
                    <AppIcon name="link" size={16} color={Colors.accentLight} />
                    <Text style={styles.dashboardTitle}>Your Links</Text>
                    <TouchableOpacity style={styles.newLinkBtn}>
                      <AppIcon name="plus" size={14} color={Colors.textPrimary} />
                      <Text style={styles.newLinkBtnText}>New Link</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.dashboardList}>
                    <View style={styles.dashboardRow}>
                      <AppIcon name="link" size={14} color={Colors.textMuted} />
                      <Text style={styles.dashboardShortUrl}>
                        linkflow.app/abc123
                      </Text>
                      <Text style={styles.dashboardClicks}>2.5k clicks</Text>
                      <TouchableOpacity style={styles.dashboardMore}>
                        <AppIcon name="external" size={14} color={Colors.textMuted} />
                      </TouchableOpacity>
                    </View>
                    <View style={styles.dashboardRow}>
                      <AppIcon name="link" size={14} color={Colors.textMuted} />
                      <Text style={styles.dashboardShortUrl}>
                        linkflow.app/xyz789
                      </Text>
                      <Text style={styles.dashboardClicks}>1.2k clicks</Text>
                      <TouchableOpacity style={styles.dashboardMore}>
                        <AppIcon name="external" size={14} color={Colors.textMuted} />
                      </TouchableOpacity>
                    </View>
                    <View style={styles.dashboardRow}>
                      <AppIcon name="link" size={14} color={Colors.textMuted} />
                      <Text style={styles.dashboardShortUrl}>
                        linkflow.app/qwe456
                      </Text>
                      <Text style={styles.dashboardClicks}>842 clicks</Text>
                      <TouchableOpacity style={styles.dashboardMore}>
                        <AppIcon name="external" size={14} color={Colors.textMuted} />
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View style={styles.analyticsCard}>
                    <View style={styles.analyticsSparkline}></View>
                    <View style={styles.analyticsInfo}>
                      <Text style={styles.analyticsLabel}>Total Clicks</Text>
                      <Text style={styles.analyticsValue}>4.5k</Text>
                      <Text style={styles.analyticsChange}>↑ 12%</Text>
                    </View>
                  </View>
                </View>
              </View>

              {/* Right: Content */}
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
                  <View style={styles.benefitItem}>
                    <AppIcon name="check" size={18} color={Colors.success} />
                    <Text style={styles.benefitText}>Instant Link Shortening</Text>
                  </View>
                  <View style={styles.benefitItem}>
                    <AppIcon name="check" size={18} color={Colors.success} />
                    <Text style={styles.benefitText}>Custom QR Codes</Text>
                  </View>
                  <View style={styles.benefitItem}>
                    <AppIcon name="check" size={18} color={Colors.success} />
                    <Text style={styles.benefitText}>Real-time Analytics</Text>
                  </View>
                  <View style={styles.benefitItem}>
                    <AppIcon name="check" size={18} color={Colors.success} />
                    <Text style={styles.benefitText}>Easy Link Management</Text>
                  </View>
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
                <View style={styles.benefitItem}>
                  <AppIcon name="check" size={18} color={Colors.success} />
                  <Text style={styles.benefitText}>Instant Link Shortening</Text>
                </View>
                <View style={styles.benefitItem}>
                  <AppIcon name="check" size={18} color={Colors.success} />
                  <Text style={styles.benefitText}>Custom QR Codes</Text>
                </View>
                <View style={styles.benefitItem}>
                  <AppIcon name="check" size={18} color={Colors.success} />
                  <Text style={styles.benefitText}>Real-time Analytics</Text>
                </View>
                <View style={styles.benefitItem}>
                  <AppIcon name="check" size={18} color={Colors.success} />
                  <Text style={styles.benefitText}>Easy Link Management</Text>
                </View>
              </View>

              <View style={styles.benefitsIllustrationMobile}>
                <View style={styles.dashboardMockupMobile}>
                  <View style={styles.dashboardHeader}>
                    <AppIcon name="link" size={16} color={Colors.accentLight} />
                    <Text style={styles.dashboardTitle}>Your Links</Text>
                  </View>
                  <View style={styles.dashboardList}>
                    <View style={styles.dashboardRow}>
                      <AppIcon name="link" size={14} color={Colors.textMuted} />
                      <Text style={styles.dashboardShortUrl}>
                        linkflow.app/abc123
                      </Text>
                      <Text style={styles.dashboardClicks}>2.5k clicks</Text>
                    </View>
                    <View style={styles.dashboardRow}>
                      <AppIcon name="link" size={14} color={Colors.textMuted} />
                      <Text style={styles.dashboardShortUrl}>
                        linkflow.app/xyz789
                      </Text>
                      <Text style={styles.dashboardClicks}>1.2k clicks</Text>
                    </View>
                  </View>
                </View>
              </View>
            </View>
          )}
        </View>

        {/* CTA Banner */}
        <View style={styles.ctaBanner}>
          <View style={styles.ctaContent}>
            <Text style={styles.ctaHeading}>Start Shortening Today!</Text>
            <Text style={styles.ctaDesc}>
              Join thousands of users who trust LinkFlow URL.
            </Text>
            <CustomButton
              title="Create Free Account"
              size="lg"
              variant="primary"
              gradient
              onPress={() => router.push('/(auth)/sign-up' as any)}
            />
          </View>
        </View>

        {/* FAQ Section */}
        <View style={styles.faqSection} id="faq">
          <Section title="Frequently Asked Questions" titleBottom={16}>
            <Text style={styles.faqSubtitle}>
              Everything you need to know about LinkFlow URL
            </Text>
          </Section>

          <View style={styles.faqList}>
            <View style={styles.faqItem}>
              <TouchableOpacity style={styles.faqQuestion} onPress={() => {}}>
                <Text style={styles.faqQuestionText}>What is LinkFlow URL?</Text>
                <AppIcon name="arrow-right" size={16} color={Colors.accent} />
              </TouchableOpacity>
              <Text style={styles.faqAnswer}>
                LinkFlow URL is a modern URL shortener and QR code generator
                that helps you create clean, shareable links and track their
                performance.
              </Text>
            </View>

            <View style={styles.faqItem}>
              <TouchableOpacity style={styles.faqQuestion} onPress={() => {}}>
                <Text style={styles.faqQuestionText}>How do I shorten a URL?</Text>
                <AppIcon name="arrow-right" size={16} color={Colors.accent} />
              </TouchableOpacity>
              <Text style={styles.faqAnswer}>
                Simply paste your long URL into the input field, click Shorten,
                and share your new short link instantly.
              </Text>
            </View>

            <View style={styles.faqItem}>
              <TouchableOpacity style={styles.faqQuestion} onPress={() => {}}>
                <Text style={styles.faqQuestionText}>Can I generate QR codes?</Text>
                <AppIcon name="arrow-right" size={16} color={Colors.accent} />
              </TouchableOpacity>
              <Text style={styles.faqAnswer}>
                Yes! Every short link you create automatically gets a scannable
                QR code that you can download and share.
              </Text>
            </View>

            <View style={styles.faqItem}>
              <TouchableOpacity style={styles.faqQuestion} onPress={() => {}}>
                <Text style={styles.faqQuestionText}>Can I track link clicks?</Text>
                <AppIcon name="arrow-right" size={16} color={Colors.accent} />
              </TouchableOpacity>
              <Text style={styles.faqAnswer}>
                Yes. Our dashboard shows real-time click analytics for every
                link you create.
              </Text>
            </View>

            <View style={styles.faqItem}>
              <TouchableOpacity style={styles.faqQuestion} onPress={() => {}}>
                <Text style={styles.faqQuestionText}>Do I need an account?</Text>
                <AppIcon name="arrow-right" size={16} color={Colors.accent} />
              </TouchableOpacity>
              <Text style={styles.faqAnswer}>
                You can create short links without an account, but signing up
                lets you manage all your links in one dashboard.
              </Text>
            </View>

            <View style={styles.faqItem}>
              <TouchableOpacity style={styles.faqQuestion} onPress={() => {}}>
                <Text style={styles.faqQuestionText}>Are my links private?</Text>
                <AppIcon name="arrow-right" size={16} color={Colors.accent} />
              </TouchableOpacity>
              <Text style={styles.faqAnswer}>
                All links are associated with your account and only accessible
                to you through your dashboard.
              </Text>
            </View>

            <View style={styles.faqItem}>
              <TouchableOpacity style={styles.faqQuestion} onPress={() => {}}>
                <Text style={styles.faqQuestionText}>Can I delete my links?</Text>
                <AppIcon name="arrow-right" size={16} color={Colors.accent} />
              </TouchableOpacity>
              <Text style={styles.faqAnswer}>
                Yes, you can delete any link from your dashboard at any time.
              </Text>
            </View>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <View style={styles.footerContent}>
            <View style={styles.footerBrand}>
              <AppIcon name="link" size={20} color={Colors.accentLight} />
              <Text style={styles.footerBrandText}>LinkFlow URL</Text>
              <Text style={styles.footerTagline}>Shorten. Share. Grow.</Text>
            </View>

            <View style={styles.footerLinks}>
              <View style={styles.footerLinkGroup}>
                <Text style={styles.footerLinkTitle}>Product</Text>
                <TouchableOpacity style={styles.footerLinkItem} onPress={() => scrollToSection('features')}>
                  <Text style={styles.footerLinkText}>Features</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.footerLinkItem} onPress={() => scrollToSection('benefits')}>
                  <Text style={styles.footerLinkText}>Benefits</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.footerLinkItem} onPress={() => scrollToSection('how-it-works')}>
                  <Text style={styles.footerLinkText}>How It Works</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.footerLinkItem} onPress={() => scrollToSection('faq')}>
                  <Text style={styles.footerLinkText}>FAQ</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.footerLinkGroup}>
                <Text style={styles.footerLinkTitle}>Legal</Text>
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
  scrollContent: {
    paddingBottom: 40,
  },
  heroSection: {
    width: '100%',
    paddingHorizontal: 40,
    paddingTop: 20,
    paddingBottom: 80,
  },
  heroDesktop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 60,
    maxWidth: 1200,
    alignSelf: 'center',
  },
  heroLeft: {
    flex: 1,
    maxWidth: 520,
  },
  heroRight: {
    flex: 1,
    maxWidth: 500,
    position: 'relative',
  },
  heroMobile: {
    width: '100%',
    alignItems: 'center',
    gap: 24,
  },
  badgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: Colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 8,
    marginBottom: 24,
  },
  badgeText: {
    color: Colors.accentLight,
    fontSize: 12,
    fontWeight: '600',
  },
  heroHeadingWrapper: {
    marginBottom: 20,
  },
  heroKicker: {
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  heroGradient: {
    color: Colors.accent,
  },
  heroDescription: {
    fontSize: 15,
    color: Colors.textSecondary,
    lineHeight: 26,
    marginBottom: 32,
    textAlign: 'center',
  },
  heroActions: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 40,
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
    paddingHorizontal: 40,
    paddingBottom: 80,
    alignItems: 'center',
  },
  featuresGrid: {
    flexDirection: 'column',
    gap: 16,
    width: '100%',
  },
  featureCard: {
    flex: 1,
    padding: 24,
    minHeight: 200,
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
    paddingHorizontal: 40,
    paddingBottom: 80,
    alignItems: 'center',
  },
  benefitsDesktop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 60,
    maxWidth: 1200,
    alignSelf: 'center',
  },
  benefitsIllustration: {
    flex: 1,
    maxWidth: 480,
  },
  benefitsContent: {
    flex: 1,
    maxWidth: 500,
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
  },
  benefitText: {
    fontSize: 15,
    color: Colors.textSecondary,
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
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    textAlign: 'center',
  },
  benefitsIllustrationMobile: {
    marginTop: 40,
    width: '100%',
    maxWidth: 300,
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
    paddingHorizontal: 40,
    paddingVertical: 60,
    backgroundColor: Colors.primary,
    borderRadius: 24,
    marginBottom: 80,
    alignSelf: 'center',
  },
  ctaContent: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 32,
    maxWidth: 900,
    alignSelf: 'center',
    textAlign: 'center',
  },
  ctaHeading: {
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  ctaDesc: {
    fontSize: 15,
    color: Colors.accentLight,
    marginBottom: 24,
  },

  /* FAQ */
  faqSection: {
    width: '100%',
    paddingHorizontal: 40,
    paddingBottom: 80,
    alignItems: 'center',
  },
  faqSubtitle: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 40,
    maxWidth: 600,
  },
  faqList: {
    width: '100%',
    maxWidth: 600,
    gap: 12,
    alignSelf: 'center',
  },
  faqItem: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    overflow: 'hidden',
  },
  faqQuestion: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    width: '100%',
  },
  faqQuestionText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  faqAnswer: {
    fontSize: 14,
    color: Colors.textSecondary,
    paddingHorizontal: 16,
    paddingBottom: 16,
    lineHeight: 22,
  },

  /* Footer */
  footer: {
    width: '100%',
    paddingHorizontal: 40,
    paddingVertical: 40,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  footerContent: {
    maxWidth: 1200,
    alignSelf: 'center',
  },
  footerBrand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 32,
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    maxWidth: 600,
    marginBottom: 32,
  },
  footerLinkGroup: {
    gap: 12,
  },
  footerLinkTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 12,
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
    gap: 16,
  },
  socialItem: {
    padding: 8,
  },
};
