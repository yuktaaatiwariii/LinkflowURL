import React, { useEffect, useRef } from 'react';
import {
  Linking,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import {
  DOCS_CONTENT_MAX_WIDTH,
  DocsColors,
  DocsMonoFont,
  DocsRadius,
  DocsSpacing,
} from '../../constants/docsTheme';
import type { FeatherName } from '../developer/DeveloperUI';
import { useDocsToc } from './DocsTocContext';

export type DocsTone = 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'neutral';

const TONE_STYLES: Record<DocsTone, { bg: string; border: string; fg: string; icon: FeatherName }> = {
  primary: {
    bg: DocsColors.primaryBg,
    border: DocsColors.primaryBorder,
    fg: DocsColors.primarySoft,
    icon: 'zap',
  },
  success: {
    bg: DocsColors.successBg,
    border: DocsColors.successBorder,
    fg: DocsColors.success,
    icon: 'check-circle',
  },
  warning: {
    bg: DocsColors.warningBg,
    border: DocsColors.warningBorder,
    fg: DocsColors.warning,
    icon: 'alert-triangle',
  },
  danger: {
    bg: DocsColors.dangerBg,
    border: DocsColors.dangerBorder,
    fg: DocsColors.danger,
    icon: 'x-octagon',
  },
  info: {
    bg: DocsColors.infoBg,
    border: DocsColors.infoBorder,
    fg: DocsColors.info,
    icon: 'info',
  },
  neutral: {
    bg: DocsColors.neutralBg,
    border: DocsColors.neutralBorder,
    fg: DocsColors.textSecondary,
    icon: 'circle',
  },
};

export function DocsPage({
  eyebrow,
  title,
  description,
  badge,
  children,
}: {
  eyebrow?: string;
  title: string;
  description?: React.ReactNode;
  badge?: React.ReactNode;
  children: React.ReactNode;
}) {
  const scrollRef = useRef<ScrollView>(null);
  const { reset, setScrollHandler, updateActiveFromScroll } = useDocsToc();

  useEffect(() => {
    reset();
    setScrollHandler((y) => {
      scrollRef.current?.scrollTo({ y, animated: true });
    });
    return () => setScrollHandler(null);
  }, [reset, setScrollHandler]);

  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    updateActiveFromScroll(event.nativeEvent.contentOffset.y);
  };

  return (
    <ScrollView
      ref={scrollRef}
      style={styles.pageScroll}
      contentContainerStyle={styles.pageScrollContent}
      onScroll={onScroll}
      scrollEventThrottle={32}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.content}>
        {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
        <Text style={styles.pageTitle}>{title}</Text>
        {badge ? <View style={styles.badgeRow}>{badge}</View> : null}
        {typeof description === 'string' ? (
          <Text style={styles.pageDescription}>{description}</Text>
        ) : (
          description || null
        )}
        <View style={{ height: DocsSpacing.lg }} />
        {children}
        <View style={{ height: DocsSpacing.xxxl }} />
      </View>
    </ScrollView>
  );
}

export function DocsSection({
  id,
  title,
  subtitle,
  bare = false,
  children,
}: {
  id: string;
  title?: string;
  subtitle?: string;
  bare?: boolean;
  children: React.ReactNode;
}) {
  const { registerSection, reportOffset } = useDocsToc();

  useEffect(() => {
    if (title) registerSection({ id, title });
  }, [id, title, registerSection]);

  return (
    <View
      nativeID={id}
      onLayout={(event) => reportOffset(id, event.nativeEvent.layout.y)}
      style={styles.section}
    >
      {!bare && title ? <Text style={styles.sectionTitle}>{title}</Text> : null}
      {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
      {children}
    </View>
  );
}

export function DocsH3({ children }: { children: React.ReactNode }) {
  return <Text style={styles.h3}>{children}</Text>;
}

export function DocsP({ children }: { children: React.ReactNode }) {
  return <Text style={styles.paragraph}>{children}</Text>;
}

export function DocsInlineCode({ children }: { children: React.ReactNode }) {
  return <Text style={styles.inlineCode}>{children}</Text>;
}

export function DocsList({
  items,
  ordered = false,
}: {
  items: React.ReactNode[];
  ordered?: boolean;
}) {
  return (
    <View style={styles.list}>
      {items.map((item, index) => (
        <View key={index} style={styles.listRow}>
          <Text style={[styles.listMarker, ordered && styles.listMarkerOrdered]}>
            {ordered ? `${index + 1}.` : '•'}
          </Text>
          <Text style={styles.listText}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

export function DocsCallout({
  tone = 'info',
  title,
  children,
}: {
  tone?: DocsTone;
  title?: string;
  children: React.ReactNode;
}) {
  const palette = TONE_STYLES[tone];
  return (
    <View
      style={[
        styles.callout,
        { backgroundColor: palette.bg, borderColor: palette.border },
      ]}
    >
      <Feather name={palette.icon} size={16} color={palette.fg} style={{ marginTop: 1 }} />
      <View style={{ flex: 1, minWidth: 0 }}>
        {title ? <Text style={[styles.calloutTitle, { color: palette.fg }]}>{title}</Text> : null}
        <Text style={styles.calloutBody}>{children}</Text>
      </View>
    </View>
  );
}

export function DocsBadge({
  label,
  tone = 'neutral',
  icon,
}: {
  label: string;
  tone?: DocsTone;
  icon?: FeatherName;
}) {
  const palette = TONE_STYLES[tone];
  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: palette.bg, borderColor: palette.border },
      ]}
    >
      {icon ? <Feather name={icon} size={10} color={palette.fg} /> : null}
      <Text style={[styles.badgeLabel, { color: palette.fg }]}>{label}</Text>
    </View>
  );
}

export function methodTone(method: string): DocsTone {
  if (method === 'POST') return 'primary';
  if (method === 'DELETE') return 'danger';
  return 'info';
}

export function DocsTable({
  columns,
  rows,
  monoColumns = [],
}: {
  columns: string[];
  rows: React.ReactNode[][];
  monoColumns?: number[];
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tableScroll}>
      <View style={[styles.table, { minWidth: Math.max(520, columns.length * 168) }]}>
        <View style={[styles.tableRow, styles.tableHead]}>
          {columns.map((column) => (
            <Text key={column} style={styles.tableHeaderCell}>
              {column}
            </Text>
          ))}
        </View>
        {rows.map((row, rowIndex) => (
          <View key={rowIndex} style={styles.tableRow}>
            {row.map((cell, cellIndex) => (
              <View key={cellIndex} style={styles.tableCell}>
                {typeof cell === 'string' || typeof cell === 'number' ? (
                  <Text
                    style={[
                      styles.tableCellText,
                      monoColumns.includes(cellIndex) && styles.tableCellMono,
                    ]}
                  >
                    {cell}
                  </Text>
                ) : (
                  cell
                )}
              </View>
            ))}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

export function DocsLink({
  href,
  children,
  external,
  onPress,
}: {
  href?: string;
  children: React.ReactNode;
  external?: boolean;
  onPress?: () => void;
}) {
  const router = useRouter();
  const handlePress = () => {
    if (onPress) {
      onPress();
      return;
    }
    if (!href) return;
    if (external || /^https?:\/\//.test(href)) {
      void Linking.openURL(href);
      return;
    }
    router.navigate(href as any);
  };

  return (
    <Text
      accessibilityRole="link"
      onPress={handlePress}
      style={styles.link}
    >
      {children}
    </Text>
  );
}

export function DocsButton({
  label,
  onPress,
  icon,
  variant = 'primary',
  size = 'md',
}: {
  label: string;
  onPress: () => void;
  icon?: FeatherName;
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md';
}) {
  const palette =
    variant === 'primary'
      ? { background: DocsColors.primary, border: DocsColors.primary, text: '#FFFFFF' }
      : variant === 'secondary'
        ? {
            background: DocsColors.surfaceRaised,
            border: DocsColors.borderStrong,
            text: DocsColors.text,
          }
        : { background: 'transparent', border: 'transparent', text: DocsColors.textSecondary };

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.82}
      accessibilityRole="button"
      style={[
        styles.button,
        size === 'sm' && styles.buttonSm,
        { backgroundColor: palette.background, borderColor: palette.border },
      ]}
    >
      {icon ? <Feather name={icon} size={size === 'sm' ? 13 : 15} color={palette.text} /> : null}
      <Text style={[styles.buttonLabel, size === 'sm' && styles.buttonLabelSm, { color: palette.text }]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

export function DocsSteps({ children }: { children: React.ReactNode }) {
  return <View style={styles.steps}>{children}</View>;
}

export function DocsStep({
  number,
  title,
  children,
}: {
  number: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.step}>
      <View style={styles.stepRail}>
        <View style={styles.stepNumber}>
          <Text style={styles.stepNumberLabel}>{number}</Text>
        </View>
        <View style={styles.stepLine} />
      </View>
      <View style={styles.stepBody}>
        <Text style={styles.stepTitle}>{title}</Text>
        {children}
      </View>
    </View>
  );
}

export function DocsDivider() {
  return <View style={styles.divider} />;
}

export function DocsPager({
  previous,
  next,
}: {
  previous?: { label: string; href: string };
  next?: { label: string; href: string };
}) {
  const router = useRouter();
  return (
    <View style={styles.pager}>
      {previous ? (
        <TouchableOpacity
          style={[styles.pagerCard, styles.pagerCardLeft]}
          activeOpacity={0.8}
          onPress={() => router.navigate(previous.href as any)}
        >
          <Text style={styles.pagerDirection}>Previous</Text>
          <Text style={styles.pagerLabel}>← {previous.label}</Text>
        </TouchableOpacity>
      ) : (
        <View style={{ flex: 1 }} />
      )}
      {next ? (
        <TouchableOpacity
          style={[styles.pagerCard, styles.pagerCardRight]}
          activeOpacity={0.8}
          onPress={() => router.navigate(next.href as any)}
        >
          <Text style={styles.pagerDirection}>Next</Text>
          <Text style={styles.pagerLabel}>{next.label} →</Text>
        </TouchableOpacity>
      ) : (
        <View style={{ flex: 1 }} />
      )}
    </View>
  );
}

export function DocsFeatureCard({
  icon,
  title,
  description,
  href,
}: {
  icon: FeatherName;
  title: string;
  description: string;
  href: string;
}) {
  const router = useRouter();
  return (
    <TouchableOpacity
      activeOpacity={0.82}
      onPress={() => router.navigate(href as any)}
      style={styles.featureCard}
    >
      <View style={styles.featureIcon}>
        <Feather name={icon} size={17} color={DocsColors.primarySoft} />
      </View>
      <Text style={styles.featureTitle}>{title}</Text>
      <Text style={styles.featureDescription}>{description}</Text>
      <View style={styles.featureMore}>
        <Text style={styles.featureMoreLabel}>Read more</Text>
        <Feather name="arrow-right" size={12} color={DocsColors.primarySoft} />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  pageScroll: { flex: 1 },
  pageScrollContent: { paddingBottom: DocsSpacing.xxl },
  content: { width: '100%', maxWidth: DOCS_CONTENT_MAX_WIDTH, alignSelf: 'center' },
  eyebrow: {
    color: DocsColors.primarySoft,
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  pageTitle: {
    color: DocsColors.text,
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '800',
    letterSpacing: -0.8,
  },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 },
  pageDescription: {
    color: DocsColors.textSecondary,
    fontSize: 15,
    lineHeight: 24,
    marginTop: 12,
    maxWidth: 760,
  },
  section: { marginTop: DocsSpacing.xxl },
  sectionTitle: {
    color: DocsColors.text,
    fontSize: 23,
    lineHeight: 30,
    fontWeight: '700',
    letterSpacing: -0.4,
    marginBottom: DocsSpacing.md,
  },
  sectionSubtitle: {
    color: DocsColors.textMuted,
    fontSize: 12.5,
    lineHeight: 19,
    marginTop: -6,
    marginBottom: DocsSpacing.md,
  },
  h3: {
    color: DocsColors.text,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '700',
    marginTop: DocsSpacing.xl,
    marginBottom: DocsSpacing.sm,
  },
  paragraph: {
    color: DocsColors.textSecondary,
    fontSize: 14,
    lineHeight: 23,
    marginBottom: DocsSpacing.md,
  },
  inlineCode: {
    fontFamily: DocsMonoFont,
    fontSize: 12.5,
    color: DocsColors.primarySoft,
    backgroundColor: DocsColors.surfaceRaised,
    borderRadius: 5,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  list: { gap: 7, marginBottom: DocsSpacing.md },
  listRow: { flexDirection: 'row', gap: 9, alignItems: 'flex-start' },
  listMarker: {
    color: DocsColors.primarySoft,
    fontSize: 14,
    lineHeight: 22,
    fontWeight: '700',
  },
  listMarkerOrdered: {
    color: DocsColors.primarySoft,
    fontSize: 12,
    lineHeight: 23,
    minWidth: 18,
  },
  listText: { flex: 1, color: DocsColors.textSecondary, fontSize: 14, lineHeight: 23 },
  callout: {
    flexDirection: 'row',
    gap: 10,
    borderWidth: 1,
    borderRadius: DocsRadius.md,
    padding: DocsSpacing.md,
    marginVertical: DocsSpacing.md,
  },
  calloutTitle: { fontSize: 12.5, fontWeight: '700', marginBottom: 4 },
  calloutBody: { color: DocsColors.textSecondary, fontSize: 13, lineHeight: 20 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 3,
    alignSelf: 'flex-start',
  },
  badgeLabel: { fontSize: 10.5, fontWeight: '700', letterSpacing: 0.2 },
  tableScroll: { marginVertical: DocsSpacing.md },
  table: {
    borderWidth: 1,
    borderColor: DocsColors.border,
    borderRadius: DocsRadius.md,
    overflow: 'hidden',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: DocsColors.border,
  },
  tableHead: { backgroundColor: DocsColors.surfaceRaised },
  tableHeaderCell: {
    flex: 1,
    minWidth: 128,
    color: DocsColors.textMuted,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  tableCell: { flex: 1, minWidth: 128, paddingHorizontal: 12, paddingVertical: 11 },
  tableCellText: { color: DocsColors.textSecondary, fontSize: 12.5, lineHeight: 19 },
  tableCellMono: { fontFamily: DocsMonoFont, fontSize: 11.5, color: DocsColors.text },
  link: { color: DocsColors.primarySoft, fontWeight: '600', textDecorationLine: 'underline' },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: DocsRadius.md,
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  buttonSm: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: DocsRadius.sm },
  buttonLabel: { fontSize: 13, fontWeight: '700' },
  buttonLabelSm: { fontSize: 11.5 },
  steps: { gap: DocsSpacing.lg, marginVertical: DocsSpacing.md },
  step: { flexDirection: 'row', gap: 14 },
  stepRail: { width: 30, alignItems: 'center' },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: DocsColors.primaryBg,
    borderWidth: 1,
    borderColor: DocsColors.primaryBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberLabel: { color: DocsColors.primarySoft, fontSize: 12, fontWeight: '800' },
  stepLine: { flex: 1, width: 1, backgroundColor: DocsColors.border, marginTop: 6 },
  stepBody: { flex: 1, paddingBottom: 4 },
  stepTitle: {
    color: DocsColors.text,
    fontSize: 14.5,
    fontWeight: '700',
    marginBottom: 6,
    lineHeight: 21,
  },
  divider: { height: 1, backgroundColor: DocsColors.border, marginVertical: DocsSpacing.xl },
  pager: {
    flexDirection: 'row',
    gap: DocsSpacing.md,
    marginTop: DocsSpacing.xxl,
    flexWrap: 'wrap',
  },
  pagerCard: {
    flex: 1,
    minWidth: 200,
    borderWidth: 1,
    borderColor: DocsColors.border,
    borderRadius: DocsRadius.md,
    backgroundColor: DocsColors.surface,
    padding: DocsSpacing.md,
  },
  pagerCardLeft: { alignItems: 'flex-start' },
  pagerCardRight: { alignItems: 'flex-end' },
  pagerDirection: {
    color: DocsColors.textMuted,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 5,
  },
  pagerLabel: { color: DocsColors.text, fontSize: 13, fontWeight: '700' },
  featureCard: {
    flex: 1,
    minWidth: 220,
    borderWidth: 1,
    borderColor: DocsColors.border,
    borderRadius: DocsRadius.lg,
    backgroundColor: DocsColors.surface,
    padding: DocsSpacing.lg,
    gap: 8,
  },
  featureIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: DocsColors.primaryBg,
    borderWidth: 1,
    borderColor: DocsColors.primaryBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  featureTitle: { color: DocsColors.text, fontSize: 14, fontWeight: '700' },
  featureDescription: { color: DocsColors.textMuted, fontSize: 12, lineHeight: 18, flex: 1 },
  featureMore: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
  featureMoreLabel: { color: DocsColors.primarySoft, fontSize: 11, fontWeight: '700' },
});
