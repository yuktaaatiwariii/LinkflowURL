import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  RefreshControl,
  ActivityIndicator,
  useWindowDimensions,
  Alert,
  AppState,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuth, useUser } from '@clerk/expo';
import QRCode from 'react-native-qrcode-svg';
import { Colors } from '../../src/constants/colors';
import {
  CustomButton,
  Card,
  AppIcon,
  LogoutConfirmModal,
  QrExporter,
  MobileBottomNav,
  ClipboardSuggestion,
} from '../../src/components';
import type { QrExporterHandle } from '../../src/components/QrExporter';
import {
  syncUserWithBackend,
  fetchUserLinks,
  fetchQrCodes,
  deleteShortLink,
  deleteQrCode,
  getShortUrlBase,
} from '../../src/services/api';
import {
  dismissClipboardUrl,
  isDismissedClipboardUrl,
  readClipboardUrl,
} from '../../src/services/clipboard';
import { useIsDesktop } from '../../src/hooks/useBreakpoint';
import {
  QR_DARK,
  QR_LIGHT,
  copyTextToClipboard,
  downloadQrImagePng,
  shareQrImagePng,
} from '../../src/utils/qrExport';

const T = {
  bg: '#181818',
  sidebar: '#1C1C1C',
  card: '#202020',
  elevated: '#262626',
  surface: '#303030',
  border: '#3A3A3A',
  purple: '#FFFFFF',
  purpleDeep: '#E5E5E5',
  violet: '#C4C4C4',
  lilac: '#C4C4C4',
  text: '#FFFFFF',
  muted: '#999999',
  faint: '#7A7A7A',
  onPrimary: '#181818',
  green: '#34D399',
  greenBg: 'rgba(52, 211, 153, 0.12)',
};

type NavIcon = 'chart' | 'link' | 'qr' | 'user' | 'sparkles' | 'clock' | 'home' | 'zap' | 'send';

interface NavItem {
  key: string;
  label: string;
  shortLabel: string;
  icon: NavIcon;
  path: string;
  active?: boolean;
}

const NAV: NavItem[] = [
  { key: 'dashboard', label: 'Dashboard', shortLabel: 'Home', icon: 'chart', path: '/(protected)', active: true },
  { key: 'links', label: 'Short Links', shortLabel: 'Links', icon: 'link', path: '/(protected)/links' },
  { key: 'qr', label: 'QR Codes', shortLabel: 'QR', icon: 'qr', path: '/(protected)/qr' },
  { key: 'profile', label: 'Profile', shortLabel: 'Profile', icon: 'user', path: '/(protected)/profile' },
];

interface StatCardData {
  label: string;
  value: number | string;
  icon: 'link' | 'qr' | 'chart' | 'clock';
  accent: string;
}

function prettyShortBase(): string {
  return getShortUrlBase().replace(/^https?:\/\//, '');
}

function formatDate(value: string): string {
  const d = new Date(value);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function withinDays(value: string, days: number): boolean {
  const d = new Date(value).getTime();
  if (isNaN(d)) return false;
  return Date.now() - d <= days * 24 * 60 * 60 * 1000;
}

function confirmDelete(title: string, message: string): Promise<boolean> {
  if (Platform.OS === 'web') {
    if (typeof window === 'undefined' || typeof window.confirm !== 'function') {
      return Promise.resolve(false);
    }
    return Promise.resolve(window.confirm(`${title}\n\n${message}`));
  }
  return new Promise((resolve) => {
    Alert.alert(
      title,
      message,
      [
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Delete', style: 'destructive', onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) }
    );
  });
}

function Notice({
  kind,
  message,
  onClose,
}: {
  kind: 'error' | 'success';
  message: string;
  onClose: () => void;
}) {
  return (
    <View style={[styles.notice, kind === 'error' ? styles.noticeError : styles.noticeSuccess]}>
      <Text style={[styles.noticeText, { color: kind === 'error' ? '#FCA5A5' : '#86EFAC' }]}>
        {message}
      </Text>
      <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <AppIcon name="x" size={14} color={T.muted} />
      </TouchableOpacity>
    </View>
  );
}

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <View style={styles.brand}>
      <View style={[styles.brandMark, compact && styles.brandMarkCompact]}>
        <AppIcon name="link" size={compact ? 17 : 20} color={T.onPrimary} />
      </View>
      <Text style={[styles.brandText, compact && styles.brandTextCompact]}>LinkFlow</Text>
    </View>
  );
}

function Sidebar({
  displayName,
  email,
  initial,
  onNavigate,
  onLogout,
}: {
  displayName: string;
  email: string;
  initial: string;
  onNavigate: (path: string) => void;
  onLogout: () => void;
}) {
  return (
    <View style={styles.sidebar}>
      <View style={styles.sidebarTop}>
        <Brand />
      </View>

      <View style={styles.nav}>
        {NAV.map((item) => (
          <TouchableOpacity
            key={item.key}
            activeOpacity={0.85}
            style={[styles.navItem, item.active && styles.navItemActive]}
            onPress={() => onNavigate(item.path)}
          >
            <AppIcon name={item.icon} size={19} color={item.active ? T.onPrimary : T.muted} />
            <Text style={[styles.navText, item.active && styles.navTextActive]}>{item.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.sidebarFooter}>
        <View style={styles.sidebarUser}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initial}</Text>
          </View>
          <View style={styles.sidebarUserText}>
            <Text style={styles.sidebarName} numberOfLines={1}>
              {displayName}
            </Text>
            <Text style={styles.sidebarEmail} numberOfLines={1}>
              {email}
            </Text>
          </View>
        </View>
        <TouchableOpacity
          style={styles.logoutBtn}
          onPress={onLogout}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <AppIcon name="logout" size={17} color={T.muted} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

function TopBar({
  initial,
  isTablet,
  onNavigate,
  onLogout,
}: {
  initial: string;
  isTablet: boolean;
  onNavigate: (path: string) => void;
  onLogout: () => void;
}) {
  return (
    <View style={styles.topBar}>
      <View style={styles.topBarRow}>
        <Brand compact />
        <View style={styles.topRight}>
          <View style={styles.avatarSmall}>
            <Text style={styles.avatarSmallText}>{initial}</Text>
          </View>
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={onLogout}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <AppIcon name="logout" size={17} color={T.muted} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.pillRow}>
        {NAV.map((item) => (
          <TouchableOpacity
            key={item.key}
            activeOpacity={0.85}
            style={[styles.pill, item.active && styles.pillActive]}
            onPress={() => onNavigate(item.path)}
          >
            <AppIcon name={item.icon} size={14} color={item.active ? T.onPrimary : T.muted} />
            <Text
              style={[styles.pillText, item.active && styles.pillTextActive]}
              numberOfLines={1}
            >
              {isTablet ? item.label : item.shortLabel}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

function ChainArt() {
  return (
    <View style={styles.art} pointerEvents="none">
      <View style={styles.artCore}>
        <AppIcon name="link" size={30} color={T.text} />
      </View>
    </View>
  );
}

function Welcome({ displayName, compact }: { displayName: string; compact: boolean }) {
  return (
    <View style={styles.welcome}>
      <View style={styles.welcomeText}>
        <View style={styles.welcomeBadge}>
          <Text style={styles.welcomeBadgeText}>👋 Welcome back,</Text>
        </View>
        <Text style={[styles.welcomeTitle, compact && styles.welcomeTitleCompact]}>
          {displayName}!
        </Text>
        <Text style={styles.welcomeSub}>Shorten, share and track your links effortlessly.</Text>
      </View>
      {compact ? null : <ChainArt />}
    </View>
  );
}

function ShortenCard({ compact, onPress }: { compact: boolean; onPress: () => void }) {
  return (
    <View style={styles.shortenOuter}>
      <View style={[styles.shortenInner, compact && styles.shortenInnerCompact]}>
        <View style={styles.shortenLead}>
          <View style={styles.shortenIcon}>
            <AppIcon name="link" size={22} color={T.text} />
          </View>
          <View style={styles.shortenCopy}>
            <Text style={styles.shortenTitle}>Shorten a URL</Text>
            <Text style={styles.shortenDesc} numberOfLines={2}>
              Turn long links into short, shareable links in seconds.
            </Text>
          </View>
        </View>

        <TouchableOpacity
          activeOpacity={0.85}
          style={[styles.shortenInput, compact && styles.shortenInputCompact]}
          onPress={onPress}
        >
          <Text style={styles.shortenPlaceholder} numberOfLines={1}>
            Paste your long URL here…
          </Text>
        </TouchableOpacity>

        <TouchableOpacity activeOpacity={0.85} style={styles.shortenBtn} onPress={onPress}>
          <Text style={styles.shortenBtnText}>Shorten</Text>
          <AppIcon name="arrow-right" size={16} color={T.onPrimary} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

function QrQuickCard({ onPress }: { onPress: () => void }) {
  return (
    <View style={styles.qrQuick}>
      <View style={styles.qrQuickIcon}>
        <AppIcon name="qr" size={22} color={T.text} />
      </View>
      <Text style={styles.qrQuickTitle}>Generate QR Code</Text>
      <Text style={styles.qrQuickDesc}>Create a scannable code for any link.</Text>
      <TouchableOpacity style={styles.qrQuickBtn} onPress={onPress} activeOpacity={0.85}>
        <Text style={styles.qrQuickBtnText}>Open QR Studio</Text>
        <AppIcon name="arrow-right" size={14} color={T.lilac} />
      </TouchableOpacity>
    </View>
  );
}

function StatCard({ data }: { data: StatCardData }) {
  return (
    <Card variant="elevated" padding={16} style={styles.statCard}>
      <View style={[styles.statAccent, { backgroundColor: data.accent }]} pointerEvents="none" />
      <View style={styles.statTop}>
        <View style={styles.statIconWrap}>
          <AppIcon name={data.icon} size={19} color={T.lilac} />
        </View>
        <View style={styles.statSpark}>
          <View style={[styles.sparkBar, { height: 10 }]} />
          <View style={[styles.sparkBar, { height: 17 }]} />
          <View style={[styles.sparkBar, { height: 13 }]} />
          <View style={[styles.sparkBar, { height: 23 }]} />
        </View>
      </View>
      <Text style={styles.statValue}>{data.value}</Text>
      <Text style={styles.statLabel}>{data.label}</Text>
    </Card>
  );
}

function StatsGrid({ cards, columns }: { cards: StatCardData[]; columns: 2 | 4 }) {
  return (
    <View style={[styles.statsRow, columns === 4 ? styles.statsRowWide : styles.statsRowWrap]}>
      {cards.map((card) => (
        <View
          key={card.label}
          style={columns === 4 ? styles.statCellWide : styles.statCellHalf}
        >
          <StatCard data={card} />
        </View>
      ))}
    </View>
  );
}

function MetricChip({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: number | string;
  icon: NavIcon;
  tone: string;
}) {
  return (
    <View style={styles.metricChip}>
      <View style={styles.metricChipTop}>
        <Text style={styles.metricChipLabel} numberOfLines={2}>
          {label}
        </Text>
        <AppIcon name={icon} size={14} color={tone} />
      </View>
      <Text style={styles.metricChipValue}>{value}</Text>
    </View>
  );
}

function MetricGrid({
  items,
  columns,
}: {
  items: { label: string; value: number | string; icon: NavIcon; tone: string }[];
  columns: 2 | 4;
}) {
  return (
    <View style={[styles.metricGrid, columns === 4 ? styles.metricGridWide : styles.metricGridWrap]}>
      {items.map((item) => (
        <View
          key={item.label}
          style={columns === 4 ? styles.metricCellWide : styles.metricCellHalf}
        >
          <MetricChip {...item} />
        </View>
      ))}
    </View>
  );
}

function SectionPanel({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  accent,
  accentBg,
  children,
}: {
  icon: NavIcon;
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
  accent: string;
  accentBg: string;
  children: React.ReactNode;
}) {
  return (
    <Card variant="surface" padding={0} style={styles.sectionPanel}>
      <View style={[styles.sectionPanelBar, { backgroundColor: accent }]} pointerEvents="none" />
      <View style={styles.sectionPanelHeader}>
        <View style={styles.sectionPanelTitleWrap}>
          <View style={[styles.sectionIcon, { backgroundColor: accentBg }]}>
            <AppIcon name={icon} size={18} color={accent} />
          </View>
          <View style={styles.sectionPanelHeading}>
            <Text style={styles.sectionPanelTitle}>{title}</Text>
            <Text style={styles.sectionPanelDesc}>{description}</Text>
          </View>
        </View>
        <TouchableOpacity
          style={styles.sectionActionBtn}
          onPress={onAction}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        >
          <Text style={[styles.sectionActionText, { color: accent }]}>{actionLabel} →</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.sectionPanelBody}>{children}</View>
    </Card>
  );
}

function InlineEmpty({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  accent,
}: {
  icon: NavIcon;
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
  accent: string;
}) {
  return (
    <View style={styles.inlineEmpty}>
      <View style={styles.inlineEmptyIcon}>
        <AppIcon name={icon} size={26} color={accent} />
      </View>
      <Text style={styles.inlineEmptyTitle}>{title}</Text>
      <Text style={styles.inlineEmptyText}>{description}</Text>
      <CustomButton title={actionLabel} size="sm" variant="primary" onPress={onAction} />
    </View>
  );
}

function InlineError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <View style={styles.inlineError}>
      <AppIcon name="x" size={20} color={Colors.error} />
      <Text style={styles.inlineErrorText}>{message}</Text>
      <CustomButton title="Retry" size="sm" variant="outline" onPress={onRetry} />
    </View>
  );
}

function StatusBadge({ active }: { active: boolean }) {
  return (
    <View style={[styles.badge, active ? styles.badgeActive : styles.badgeInactive]}>
      <Text style={[styles.badgeText, { color: active ? T.green : T.muted }]}>
        {active ? 'Active' : 'Inactive'}
      </Text>
    </View>
  );
}

function LinkTableRow({
  item,
  shortBase,
  compact,
  deleting,
  onCopy,
  onDelete,
}: {
  item: any;
  shortBase: string;
  compact: boolean;
  deleting: boolean;
  onCopy: () => void;
  onDelete: () => void;
}) {
  const active = item.is_active !== false;
  return (
    <View style={styles.tableRow}>
      <View style={styles.tableCellMain}>
        <Text style={styles.tablePrimary} numberOfLines={1}>
          {item.title || item.short_code}
        </Text>
        <Text style={styles.tableSecondary} numberOfLines={1}>
          {item.original_url}
        </Text>
        {compact ? (
          <View style={styles.tableCompactMeta}>
            <Text style={styles.tableShort} numberOfLines={1}>
              {shortBase}
              {item.short_code}
            </Text>
            <Text style={styles.tableMeta}>
              {item.clicks_count || 0} clicks · {formatDate(item.created_at)}
            </Text>
          </View>
        ) : null}
      </View>

      {compact ? null : (
        <View style={styles.tableCellShort}>
          <Text style={styles.tableShort} numberOfLines={1}>
            {shortBase}
            {item.short_code}
          </Text>
          <Text style={styles.tableMeta}>{item.clicks_count || 0} clicks</Text>
        </View>
      )}

      {compact ? null : (
        <View style={styles.tableCellStatus}>
          <StatusBadge active={active} />
        </View>
      )}

      {compact ? null : (
        <Text style={styles.tableCellDate}>{formatDate(item.created_at)}</Text>
      )}

      <View style={styles.tableActions}>
        <TouchableOpacity
          style={styles.iconAction}
          onPress={onCopy}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <AppIcon name="copy" size={15} color={T.lilac} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.iconAction, styles.iconActionDanger]}
          onPress={onDelete}
          disabled={deleting}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          {deleting ? (
            <ActivityIndicator size="small" color={Colors.error} />
          ) : (
            <AppIcon name="trash" size={15} color={Colors.error} />
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

function QrPreviewCard({
  item,
  sharing,
  downloading,
  onShare,
  onDownload,
  onOpen,
}: {
  item: any;
  sharing: boolean;
  downloading: boolean;
  onShare: () => void;
  onDownload: () => void;
  onOpen: () => void;
}) {
  return (
    <View style={styles.qrPreview}>
      <TouchableOpacity activeOpacity={0.85} onPress={onOpen} style={styles.qrPreviewTop}>
        <View style={styles.qrPreviewThumb}>
          <QRCode
            value={item.target_url}
            size={76}
            color={QR_DARK}
            backgroundColor={QR_LIGHT}
            quietZone={5}
            ecl="M"
            logoSize={0}
          />
        </View>
        <View style={styles.qrPreviewInfo}>
          <Text style={styles.qrPreviewTitle} numberOfLines={1}>
            {item.title || 'QR Code'}
          </Text>
          <Text style={styles.qrPreviewTarget} numberOfLines={2}>
            {item.target_url}
          </Text>
          <Text style={styles.qrPreviewDate}>{formatDate(item.created_at)}</Text>
        </View>
      </TouchableOpacity>
      <View style={styles.qrPreviewActions}>
        <TouchableOpacity
          style={styles.qrPreviewAction}
          onPress={onShare}
          disabled={sharing}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        >
          {sharing ? (
            <ActivityIndicator size="small" color={T.lilac} />
          ) : (
            <AppIcon name="external" size={14} color={T.lilac} />
          )}
          <Text style={styles.qrPreviewActionText}>Share</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.qrPreviewAction}
          onPress={onDownload}
          disabled={downloading}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        >
          {downloading ? (
            <ActivityIndicator size="small" color={T.lilac} />
          ) : (
            <AppIcon name="download" size={14} color={T.lilac} />
          )}
          <Text style={styles.qrPreviewActionText}>Save</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function LoadingBlock({ label }: { label: string }) {
  return (
    <View style={styles.loading}>
      <ActivityIndicator color={T.violet} size="small" />
      <Text style={styles.loadingText}>{label}</Text>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Mobile dashboard — matches the mobile reference design              */
/* ------------------------------------------------------------------ */

function MobileHeader({ initial, onProfile }: { initial: string; onProfile: () => void }) {
  return (
    <View style={styles.mHeader}>
      <View style={styles.mBrand}>
        <View style={styles.mBrandMark}>
          <AppIcon name="link" size={18} color={T.onPrimary} />
        </View>
        <Text style={styles.mBrandText}>
          LinkFlow <Text style={styles.mBrandAccent}>URL</Text>
        </Text>
      </View>

      <TouchableOpacity
        style={styles.mAvatar}
        onPress={onProfile}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel="Open profile"
      >
        <Text style={styles.mAvatarText}>{initial}</Text>
      </TouchableOpacity>
    </View>
  );
}

function MobileHero({ displayName }: { displayName: string }) {
  return (
    <View style={styles.mHero}>
      <View style={styles.mHeroText}>
        <View style={styles.mHeroBadge}>
          <Text style={styles.mHeroBadgeText}>👋 Welcome back,</Text>
        </View>
        <Text
          style={styles.mHeroTitle}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.75}
        >
          {displayName}!
        </Text>
        <Text style={styles.mHeroSub}>
          Shorten, share and track your links effortlessly.
        </Text>
      </View>

      <View style={styles.mHeroArt} pointerEvents="none">
        <View style={styles.mHeroCore}>
          <AppIcon name="link" size={24} color={T.text} />
        </View>
      </View>
    </View>
  );
}

function MobileShortenCard({
  onPress,
  links,
  shortBase,
  loading,
  onCopy,
}: {
  onPress: () => void;
  links: any[];
  shortBase: string;
  loading: boolean;
  onCopy: (text: string) => void;
}) {
  const recentLinks = links.slice(0, 3);

  return (
    <View style={styles.mShortenOuter}>
      <View style={styles.mShortenHeader}>
        <View style={styles.mShortenIcon}>
          <AppIcon name="zap" size={20} color={T.text} />
        </View>
        <View style={styles.mShortenCopy}>
          <Text style={styles.mShortenTitle}>Shorten a URL</Text>
          <Text style={styles.mShortenDesc}>
            Turn long links into short, shareable links in seconds.
          </Text>
        </View>
      </View>

      <View style={styles.mShortenForm}>
        <TouchableOpacity
          style={styles.mShortenInput}
          activeOpacity={0.85}
          onPress={onPress}
          accessibilityRole="button"
          accessibilityLabel="Go to the link shortener"
        >
          <Text style={styles.mShortenPlaceholder} numberOfLines={1}>
            Paste your long URL…
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.mShortenSend}
          activeOpacity={0.85}
          onPress={onPress}
          accessibilityRole="button"
          accessibilityLabel="Shorten URL"
        >
          <AppIcon name="send" size={20} color={T.onPrimary} />
        </TouchableOpacity>
      </View>

      {/* Previous short links, shown right where the user shortens URLs */}
      {loading ? (
        <View style={styles.mShortenRecent}>
          <View style={styles.mShortenSkeletonRow} />
          <View style={[styles.mShortenSkeletonRow, { width: '72%' }]} />
        </View>
      ) : recentLinks.length > 0 ? (
        <View style={styles.mShortenRecent}>
          <View style={styles.mShortenRecentHeader}>
            <Text style={styles.mShortenRecentTitle}>Your recent short links</Text>
            <TouchableOpacity
              onPress={onPress}
              activeOpacity={0.8}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel="View all your short links"
            >
              <Text style={styles.mShortenRecentAll}>View all →</Text>
            </TouchableOpacity>
          </View>

          {recentLinks.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.mShortenRecentRow}
              activeOpacity={0.75}
              onPress={() => onCopy(`${shortBase}${item.short_code}`)}
              accessibilityRole="button"
              accessibilityLabel={`Copy short link ${item.short_code}`}
            >
              <View style={styles.mShortenRecentDot} />
              <Text style={styles.mShortenRecentCode} numberOfLines={1}>
                {shortBase}
                {item.short_code}
              </Text>
              <Text style={styles.mShortenRecentClicks}>
                {item.clicks_count || 0} {item.clicks_count === 1 ? 'click' : 'clicks'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function MobileStatCard({ data }: { data: StatCardData }) {
  return (
    <View style={styles.mStatCard}>
      <View style={styles.mStatTop}>
        <View style={styles.mStatIcon}>
          <AppIcon name={data.icon} size={18} color={T.lilac} />
        </View>
        <View style={styles.mStatSpark} pointerEvents="none">
          <View style={[styles.mSparkBar, { height: 7 }]} />
          <View style={[styles.mSparkBar, { height: 12 }]} />
          <View style={[styles.mSparkBar, { height: 9 }]} />
          <View style={[styles.mSparkBar, { height: 16 }]} />
        </View>
      </View>
      <Text style={styles.mStatValue}>{data.value}</Text>
      <Text style={styles.mStatLabel}>{data.label}</Text>
    </View>
  );
}

function MobilePanelHeader({
  icon,
  title,
  onViewAll,
}: {
  icon: NavIcon;
  title: string;
  onViewAll: () => void;
}) {
  return (
    <View style={styles.mPanelHeader}>
      <View style={styles.mPanelTitleRow}>
        <View style={styles.mPanelIcon}>
          <AppIcon name={icon} size={16} color={T.lilac} />
        </View>
        <Text style={styles.mPanelTitle}>{title}</Text>
      </View>
      <TouchableOpacity
        onPress={onViewAll}
        activeOpacity={0.8}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        accessibilityRole="button"
        accessibilityLabel={`View all ${title}`}
      >
        <Text style={styles.mPanelAction}>View All →</Text>
      </TouchableOpacity>
    </View>
  );
}

function MobileEmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
}: {
  icon: NavIcon;
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <View style={styles.mEmpty}>
      <View style={styles.mEmptyIcon}>
        <AppIcon name={icon} size={26} color={T.violet} />
      </View>
      <Text style={styles.mEmptyTitle}>{title}</Text>
      <Text style={styles.mEmptyText}>{description}</Text>
      <TouchableOpacity
        style={styles.mEmptyBtn}
        onPress={onAction}
        activeOpacity={0.85}
        accessibilityRole="button"
      >
        <Text style={styles.mEmptyBtnText}>{actionLabel}</Text>
      </TouchableOpacity>
    </View>
  );
}

function MobileRecentLinks({
  links,
  loading,
  error,
  shortBase,
  onViewAll,
  onRetry,
}: {
  links: any[];
  loading: boolean;
  error: string | null;
  shortBase: string;
  onViewAll: () => void;
  onRetry: () => void;
}) {
  return (
    <View style={styles.mPanel}>
      <MobilePanelHeader icon="clock" title="Recent Links" onViewAll={onViewAll} />

      {loading ? (
        <LoadingBlock label="Loading your links…" />
      ) : error ? (
        <InlineError message={error} onRetry={onRetry} />
      ) : links.length === 0 ? (
        <MobileEmptyState
          icon="link"
          title="No links yet"
          description="Start by shortening your first URL!"
          actionLabel="Create Your First Link →"
          onAction={onViewAll}
        />
      ) : (
        <>
          {links.slice(0, 5).map((item) => {
            const active = item.is_active !== false;
            return (
              <View key={item.id} style={styles.mLinkRow}>
                <View style={styles.mLinkTop}>
                  <Text style={styles.mLinkTitle} numberOfLines={1}>
                    {item.title || item.short_code}
                  </Text>
                  <View
                    style={[styles.mStatus, active ? styles.mStatusActive : styles.mStatusInactive]}
                  >
                    <View
                      style={[
                        styles.mStatusDot,
                        { backgroundColor: active ? T.green : T.faint },
                      ]}
                    />
                    <Text
                      style={[styles.mStatusText, { color: active ? T.green : T.faint }]}
                    >
                      {active ? 'Active' : 'Inactive'}
                    </Text>
                  </View>
                </View>
                <Text style={styles.mLinkShort} numberOfLines={1}>
                  {shortBase}
                  {item.short_code}
                </Text>
                <Text style={styles.mLinkOriginal} numberOfLines={1}>
                  {item.original_url}
                </Text>
              </View>
            );
          })}
          {links.length > 5 ? (
            <TouchableOpacity style={styles.mMoreRow} onPress={onViewAll} activeOpacity={0.8}>
              <Text style={styles.mMoreText}>
                +{links.length - 5} more link{links.length - 5 === 1 ? '' : 's'} — View All →
              </Text>
            </TouchableOpacity>
          ) : null}
        </>
      )}
    </View>
  );
}

function MobileQrHistory({
  qrCodes,
  loading,
  error,
  onViewAll,
  onRetry,
}: {
  qrCodes: any[];
  loading: boolean;
  error: string | null;
  onViewAll: () => void;
  onRetry: () => void;
}) {
  return (
    <View style={styles.mPanel}>
      <MobilePanelHeader icon="qr" title="QR History" onViewAll={onViewAll} />

      {loading ? (
        <LoadingBlock label="Loading your QR codes…" />
      ) : error ? (
        <InlineError message={error} onRetry={onRetry} />
      ) : qrCodes.length === 0 ? (
        <MobileEmptyState
          icon="qr"
          title="No QR codes yet"
          description="Generate a QR code for your links."
          actionLabel="Generate QR Code →"
          onAction={onViewAll}
        />
      ) : (
        <>
          {qrCodes.slice(0, 3).map((qr) => (
            <View key={qr.id} style={styles.mQrRow}>
              <View style={styles.mQrIcon}>
                <AppIcon name="qr" size={17} color={T.lilac} />
              </View>
              <View style={styles.mQrInfo}>
                <Text style={styles.mQrTitle} numberOfLines={1}>
                  {qr.title || 'QR Code'}
                </Text>
                <Text style={styles.mQrTarget} numberOfLines={1}>
                  {qr.target_url}
                </Text>
                <Text style={styles.mQrDate}>{formatDate(qr.created_at)}</Text>
              </View>
            </View>
          ))}
          {qrCodes.length > 3 ? (
            <TouchableOpacity style={styles.mMoreRow} onPress={onViewAll} activeOpacity={0.8}>
              <Text style={styles.mMoreText}>
                View all {qrCodes.length} QR codes →
              </Text>
            </TouchableOpacity>
          ) : null}
        </>
      )}
    </View>
  );
}

function MobileDashboardContent(props: DashboardContentProps) {
  const {
    displayName,
    initial,
    links,
    totalLinks,
    activeLinks,
    linksLoading,
    linksError,
    qrCodes,
    qrCount,
    qrLoading,
    qrError,
    totalClicks,
    refreshing,
    shortBase,
    errorMessage,
    successMessage,
  } = props;

  const stats: StatCardData[] = [
    { label: 'Total Links', value: linksLoading ? '—' : totalLinks, icon: 'link', accent: T.purple },
    { label: 'QR Codes', value: qrLoading ? '—' : qrCount, icon: 'qr', accent: T.violet },
    { label: 'Active Links', value: linksLoading ? '—' : activeLinks, icon: 'chart', accent: T.muted },
    { label: 'Clicks', value: linksLoading ? '—' : totalClicks, icon: 'clock', accent: T.faint },
  ];

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.mScrollContent}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={props.onRefresh}
          tintColor={T.violet}
          colors={[T.violet]}
        />
      }
    >
      <MobileHeader
        initial={initial}
        onProfile={() => props.onNavigate('/(protected)/profile')}
      />

      {errorMessage ? (
        <Notice kind="error" message={errorMessage} onClose={props.onDismissNotice} />
      ) : null}
      {successMessage ? (
        <Notice kind="success" message={successMessage} onClose={props.onDismissNotice} />
      ) : null}

      <MobileHero displayName={displayName} />

      <MobileShortenCard
        onPress={() => props.onNavigate('/(protected)/links')}
        links={links}
        shortBase={shortBase}
        loading={linksLoading}
        onCopy={props.onCopy}
      />

      {!!props.clipboardUrl && (
        <ClipboardSuggestion
          url={props.clipboardUrl}
          onShorten={props.onClipboardShorten}
          onDismiss={props.onClipboardDismiss}
        />
      )}

      <View style={styles.mSection}>
        <View style={styles.mSectionHeader}>
          <Text style={styles.mSectionTitle}>Overview</Text>
          <Text style={styles.mSectionSub}>Your account at a glance</Text>
        </View>
        <View style={styles.mStatsGrid}>
          {stats.map((stat) => (
            <View key={stat.label} style={styles.mStatCell}>
              <MobileStatCard data={stat} />
            </View>
          ))}
        </View>
      </View>

      <MobileRecentLinks
        links={links}
        loading={linksLoading}
        error={linksError}
        shortBase={shortBase}
        onViewAll={() => props.onNavigate('/(protected)/links')}
        onRetry={props.onRetryLinks}
      />

      <MobileQrHistory
        qrCodes={qrCodes}
        loading={qrLoading}
        error={qrError}
        onViewAll={() => props.onNavigate('/(protected)/qr')}
        onRetry={props.onRetryQr}
      />

      <View style={styles.mBottomSpacer} />
    </ScrollView>
  );
}

interface DashboardContentProps {
  displayName: string;
  email: string;
  initial: string;
  links: any[];
  totalLinks: number;
  activeLinks: number;
  linksLoading: boolean;
  linksError: string | null;
  qrCodes: any[];
  qrCount: number;
  qrLoading: boolean;
  qrError: string | null;
  refreshing: boolean;
  deletingLink: string | null;
  deletingQr: string | null;
  sharingId: string | null;
  downloadingId: string | null;
  errorMessage: string | null;
  successMessage: string | null;
  shortBase: string;
  totalClicks: number;
  linksThisWeek: number;
  mostClicked: any | null;
  qrThisMonth: number;
  qrLinkedCount: number;
  isDesktop: boolean;
  isTablet: boolean;
  onNavigate: (path: string) => void;
  onLogout: () => void;
  onRefresh: () => void;
  onRetryLinks: () => void;
  onRetryQr: () => void;
  onDeleteLink: (item: any) => void;
  onDeleteQr: (item: any) => void;
  onCopy: (text: string) => void;
  onShareQr: (item: any) => void;
  onDownloadQr: (item: any) => void;
  onDismissNotice: () => void;
  clipboardUrl: string | null;
  onClipboardShorten: (url: string) => void;
  onClipboardDismiss: (url: string) => void;
}

function DashboardContent(props: DashboardContentProps) {
  const {
    isDesktop,
    isTablet,
    links,
    qrCodes,
    linksLoading,
    qrLoading,
    linksError,
    qrError,
    totalLinks,
    activeLinks,
    qrCount,
    totalClicks,
    linksThisWeek,
    mostClicked,
    qrThisMonth,
    qrLinkedCount,
    shortBase,
    displayName,
    initial,
    refreshing,
    errorMessage,
    successMessage,
  } = props;

  const columns: 2 | 4 = isDesktop ? 4 : 2;

  const overviewCards: StatCardData[] = [
    { label: 'Total Links', value: linksLoading ? '—' : totalLinks, icon: 'link', accent: T.purple },
    { label: 'QR Codes', value: qrLoading ? '—' : qrCount, icon: 'qr', accent: T.violet },
    { label: 'Active Links', value: linksLoading ? '—' : activeLinks, icon: 'chart', accent: T.muted },
    { label: 'Clicks', value: linksLoading ? '—' : totalClicks, icon: 'chart', accent: T.faint },
  ];

  // Mobile uses the dedicated reference-matched layout; desktop is untouched.
  if (!isDesktop) {
    return <MobileDashboardContent {...props} />;
  }

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.scrollContent, isDesktop && styles.scrollContentDesktop]}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={props.onRefresh}
          tintColor={T.violet}
          colors={[T.violet]}
        />
      }
    >
      {isDesktop ? null : (
        <TopBar
          initial={initial}
          isTablet={isTablet}
          onNavigate={props.onNavigate}
          onLogout={props.onLogout}
        />
      )}

      {errorMessage ? (
        <Notice kind="error" message={errorMessage} onClose={props.onDismissNotice} />
      ) : null}
      {successMessage ? (
        <Notice kind="success" message={successMessage} onClose={props.onDismissNotice} />
      ) : null}

      <Welcome displayName={displayName} compact={!isDesktop} />

      <View style={[styles.quickRow, isDesktop ? styles.quickRowWide : styles.quickRowStack]}>
        <View style={isDesktop ? styles.quickMain : undefined}>
          <ShortenCard
            compact={!isDesktop}
            onPress={() => props.onNavigate('/(protected)/links')}
          />
        </View>
        <View style={isDesktop ? styles.quickSide : undefined}>
          <QrQuickCard onPress={() => props.onNavigate('/(protected)/qr')} />
        </View>
      </View>

      <View style={styles.overviewBlock}>
        <View style={styles.blockHeadingRow}>
          <Text style={styles.blockHeading}>General Overview</Text>
          <Text style={styles.blockSubheading}>Your account at a glance</Text>
        </View>
        <StatsGrid cards={overviewCards} columns={columns} />
      </View>

      {/* SECTION 1 — URL Shortener Analytics */}
      <View style={styles.sectionSpacer}>
        <SectionPanel
          icon="link"
          title="URL Shortener Analytics"
          description="Track and manage the performance of your shortened links."
          actionLabel="View All Links"
          onAction={() => props.onNavigate('/(protected)/links')}
          accent={T.purple}
          accentBg="rgba(255, 255, 255, 0.06)"
        >
          <MetricGrid
            columns={columns}
            items={[
              { label: 'Total Links Created', value: linksLoading ? '—' : totalLinks, icon: 'link', tone: T.lilac },
              { label: 'Active Links', value: linksLoading ? '—' : activeLinks, icon: 'chart', tone: T.muted },
              { label: 'Total Link Clicks', value: linksLoading ? '—' : totalClicks, icon: 'chart', tone: T.violet },
              { label: 'Recent Links (7d)', value: linksLoading ? '—' : linksThisWeek, icon: 'sparkles', tone: T.violet },
            ]}
          />

          {linksLoading ? (
            <LoadingBlock label="Loading link analytics…" />
          ) : linksError ? (
            <InlineError message={linksError} onRetry={props.onRetryLinks} />
          ) : links.length === 0 ? (
            <InlineEmpty
              icon="link"
              title="No links yet"
              description="Shorten your first URL to start seeing analytics."
              actionLabel="Create Your First Link →"
              onAction={() => props.onNavigate('/(protected)/links')}
              accent={T.violet}
            />
          ) : (
            <>
              <View style={styles.highlightStrip}>
                <View style={styles.highlightIcon}>
                  <AppIcon name="chart" size={16} color={T.lilac} />
                </View>
                <View style={styles.highlightText}>
                  <Text style={styles.highlightLabel}>Most clicked link</Text>
                  <Text style={styles.highlightValue} numberOfLines={1}>
                    {mostClicked
                      ? `${mostClicked.title || mostClicked.short_code} — ${mostClicked.clicks_count || 0} clicks`
                      : 'No clicks recorded yet'}
                  </Text>
                </View>
              </View>

              <View style={styles.tableHeader}>
                <Text style={[styles.tableHeaderText, styles.tableCellMain]}>Link</Text>
                <Text style={[styles.tableHeaderText, styles.tableCellShort]}>Short URL / Clicks</Text>
                <Text style={[styles.tableHeaderText, styles.tableCellStatus]}>Status</Text>
                <Text style={[styles.tableHeaderText, styles.tableCellDate]}>Created</Text>
                <Text style={[styles.tableHeaderText, styles.tableActions]}>Actions</Text>
              </View>

              <View style={styles.tableBody}>
                {links.slice(0, 5).map((item) => (
                  <LinkTableRow
                    key={item.id}
                    item={item}
                    shortBase={shortBase}
                    compact={!isDesktop}
                    deleting={props.deletingLink === item.id}
                    onCopy={() => props.onCopy(`${shortBase}${item.short_code}`)}
                    onDelete={() => props.onDeleteLink(item)}
                  />
                ))}
              </View>

              {links.length > 5 ? (
                <TouchableOpacity
                  style={styles.moreRow}
                  onPress={() => props.onNavigate('/(protected)/links')}
                >
                  <Text style={styles.moreText}>
                    +{links.length - 5} more link{links.length - 5 === 1 ? '' : 's'} — View All →
                  </Text>
                </TouchableOpacity>
              ) : null}
            </>
          )}
        </SectionPanel>
      </View>

      {/* SECTION 2 — QR Code Analytics */}
      <View style={styles.sectionSpacer}>
        <SectionPanel
          icon="qr"
          title="QR Code Analytics"
          description="Track your generated QR codes and manage your QR history."
          actionLabel="View All QR Codes"
          onAction={() => props.onNavigate('/(protected)/qr')}
          accent={T.violet}
          accentBg="rgba(255, 255, 255, 0.06)"
        >
          <MetricGrid
            columns={columns}
            items={[
              { label: 'Total QR Codes', value: qrLoading ? '—' : qrCount, icon: 'qr', tone: T.lilac },
              { label: 'Created (last 30d)', value: qrLoading ? '—' : qrThisMonth, icon: 'sparkles', tone: T.violet },
              { label: 'Linked to Short Links', value: qrLoading ? '—' : qrLinkedCount, icon: 'link', tone: T.muted },
              { label: 'QR Scans', value: 'Not tracked', icon: 'chart', tone: T.faint },
            ]}
          />

          <Text style={styles.trackingNote}>
            QR scans are not measured. Only visits through shortened links are counted — a
            generated QR code is never presented as a scan.
          </Text>

          {qrLoading ? (
            <LoadingBlock label="Loading QR analytics…" />
          ) : qrError ? (
            <InlineError message={qrError} onRetry={props.onRetryQr} />
          ) : qrCodes.length === 0 ? (
            <InlineEmpty
              icon="qr"
              title="No QR codes yet"
              description="Generate a QR code for your links to see it here."
              actionLabel="Generate QR Code →"
              onAction={() => props.onNavigate('/(protected)/qr')}
              accent={T.violet}
            />
          ) : (
            <View
              style={[
                styles.qrPreviewGrid,
                isDesktop ? styles.qrPreviewGridWide : styles.qrPreviewGridStack,
              ]}
            >
              {qrCodes.slice(0, isDesktop ? 4 : 3).map((item) => (
                <View
                  key={item.id}
                  style={isDesktop ? styles.qrPreviewCellWide : styles.qrPreviewCellStack}
                >
                  <QrPreviewCard
                    item={item}
                    sharing={props.sharingId === item.id}
                    downloading={props.downloadingId === item.id}
                    onShare={() => props.onShareQr(item)}
                    onDownload={() => props.onDownloadQr(item)}
                    onOpen={() => props.onNavigate('/(protected)/qr')}
                  />
                </View>
              ))}
            </View>
          )}
        </SectionPanel>
      </View>

      <View style={styles.bottomSpacer} />
    </ScrollView>
  );
}

export default function HomeDashboard() {
  const router = useRouter();
  const { signOut, getToken } = useAuth();
  const { user } = useUser();
  const isDesktop = useIsDesktop();
  const { width } = useWindowDimensions();
  const isTablet = width >= 768 && width < 1024;
  const userId = user?.id;

  const [links, setLinks] = useState<any[]>([]);
  const [totalLinks, setTotalLinks] = useState<number>(0);
  const [activeLinks, setActiveLinks] = useState<number>(0);
  const [linksLoading, setLinksLoading] = useState<boolean>(true);
  const [linksError, setLinksError] = useState<string | null>(null);

  const [qrCodes, setQrCodes] = useState<any[]>([]);
  const [qrCount, setQrCount] = useState<number>(0);
  const [qrLoading, setQrLoading] = useState<boolean>(true);
  const [qrError, setQrError] = useState<string | null>(null);

  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [loggingOut, setLoggingOut] = useState<boolean>(false);
  const [showLogoutModal, setShowLogoutModal] = useState<boolean>(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [deletingLink, setDeletingLink] = useState<string | null>(null);
  const [deletingQr, setDeletingQr] = useState<string | null>(null);
  const [sharingId, setSharingId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [readyUserId, setReadyUserId] = useState<string | null>(null);
  const [clipboardUrl, setClipboardUrl] = useState<string | null>(null);

  const exporterRef = useRef<QrExporterHandle>(null);
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;
  const userRef = useRef(user);
  userRef.current = user;
  const linksInFlight = useRef(false);
  const qrInFlight = useRef(false);
  const hasLoadedRef = useRef(false);

  const loadLinks = useCallback(async (token: string, silent: boolean) => {
    if (linksInFlight.current) return;
    linksInFlight.current = true;
    if (!silent) setLinksLoading(true);
    setLinksError(null);
    try {
      const res = await fetchUserLinks(token);
      if (res.error) {
        setLinksError(res.error);
        return;
      }
      setLinks(res.data?.links || []);
      setTotalLinks(res.data?.total || 0);
      setActiveLinks(res.data?.active || 0);
    } catch (err: any) {
      setLinksError(err?.message || 'Unable to load link analytics.');
    } finally {
      linksInFlight.current = false;
      setLinksLoading(false);
    }
  }, []);

  const loadQrCodes = useCallback(async (token: string, silent: boolean) => {
    if (qrInFlight.current) return;
    qrInFlight.current = true;
    if (!silent) setQrLoading(true);
    setQrError(null);
    try {
      const res = await fetchQrCodes(token);
      if (res.error) {
        setQrError(res.error);
        return;
      }
      setQrCodes(res.data?.qrs || []);
      setQrCount(res.data?.total || 0);
    } catch (err: any) {
      setQrError(err?.message || 'Unable to load QR analytics.');
    } finally {
      qrInFlight.current = false;
      setQrLoading(false);
    }
  }, []);

  const bootstrap = useCallback(
    async (silent: boolean) => {
      const token = await getTokenRef.current();
      if (!token) {
        setLinksError('Session expired. Please sign in again.');
        setQrError('Session expired. Please sign in again.');
        setLinksLoading(false);
        setQrLoading(false);
        return;
      }
      await Promise.all([loadLinks(token, silent), loadQrCodes(token, silent)]);
    },
    [loadLinks, loadQrCodes]
  );

  // Sync the authenticated Clerk user once per account change, then allow the
  // analytics requests to run (so a brand-new account is never queried early).
  useEffect(() => {
    let cancelled = false;
    hasLoadedRef.current = false;

    if (!userId) {
      setLinks([]);
      setTotalLinks(0);
      setActiveLinks(0);
      setQrCodes([]);
      setQrCount(0);
      setLinksError(null);
      setQrError(null);
      setReadyUserId(null);
      return () => {
        cancelled = true;
      };
    }

    (async () => {
      try {
        const token = await getTokenRef.current();
        if (token) {
          const currentUser = userRef.current;
          const email = currentUser?.primaryEmailAddress?.emailAddress;
          const fullName =
            currentUser?.fullName ||
            [currentUser?.firstName, currentUser?.lastName].filter(Boolean).join(' ') ||
            null;
          await syncUserWithBackend(token, email, fullName);
        }
      } catch (err: any) {
        console.warn('Dashboard user sync notice:', err?.message);
      } finally {
        if (!cancelled) setReadyUserId(userId);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  // Reload analytics whenever the screen is focused (after creating/deleting
  // links or QR codes elsewhere) and once the user is synced.
  useFocusEffect(
    useCallback(() => {
      if (!userId || readyUserId !== userId) return;
      bootstrap(hasLoadedRef.current);
      hasLoadedRef.current = true;
    }, [userId, readyUserId, bootstrap])
  );

  const onRefresh = () => {
    setRefreshing(true);
    bootstrap(true).finally(() => setRefreshing(false));
  };

  /**
   * Smart clipboard detection.
   *
   * The clipboard is only inspected at deliberate lifecycle moments: when the
   * dashboard mounts and when the app returns to the foreground. It is never
   * polled, and the detected URL is never sent to the server.
   */
  const checkClipboard = useCallback(async () => {
    try {
      const found = await readClipboardUrl();
      if (!found) return;
      if (await isDismissedClipboardUrl(found)) return;
      setClipboardUrl((current) => (current === found ? current : found));
    } catch {
      // Clipboard access can be denied by the OS: stay silent.
    }
  }, []);

  useEffect(() => {
    checkClipboard();
  }, [checkClipboard]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        checkClipboard();
      }
    });
    return () => subscription.remove();
  }, [checkClipboard]);

  const handleClipboardShorten = useCallback(
    (url: string) => {
      setClipboardUrl(null);
      router.push({
        pathname: '/(protected)/links',
        params: { url },
      } as any);
    },
    [router]
  );

  const handleClipboardDismiss = useCallback(async (url: string) => {
    setClipboardUrl(null);
    await dismissClipboardUrl(url);
  }, []);

  const onNavigate = useCallback(
    (path: string) => {
      if (path === '/(protected)') {
        router.replace(path as any);
      } else {
        router.push(path as any);
      }
    },
    [router]
  );

  const confirmLogout = async () => {
    setLogoutError(null);
    setLoggingOut(true);
    try {
      await signOut();
      router.replace('/(auth)/welcome' as any);
    } catch (err: any) {
      console.error('Sign Out error:', err);
      setLoggingOut(false);
      setLogoutError(err?.message || 'Sign out failed. Please try again.');
    }
  };

  const handleLogout = () => {
    setLogoutError(null);
    setShowLogoutModal(true);
  };

  const handleDeleteLink = async (item: any) => {
    const label = item.title || item.short_code;
    const confirmed = await confirmDelete(
      'Delete link?',
      `"${label}" will be permanently removed. Existing analytics for it will be lost.`
    );
    if (!confirmed) return;

    setDeletingLink(item.id);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const token = await getTokenRef.current();
      if (!token) {
        setErrorMessage('Session expired. Please sign in again.');
        return;
      }
      const res = await deleteShortLink(token, item.id);
      if (res.error) {
        setErrorMessage(res.error || 'Failed to delete link.');
        return;
      }
      setLinks((prev) => prev.filter((l) => l.id !== item.id));
      setTotalLinks((prev) => Math.max(0, prev - 1));
      if (item.is_active !== false) {
        setActiveLinks((prev) => Math.max(0, prev - 1));
      }
      setSuccessMessage('Link deleted.');
    } catch (err: any) {
      console.error('Delete link error:', err);
      setErrorMessage(err?.message || 'Failed to delete link.');
    } finally {
      setDeletingLink(null);
    }
  };

  const handleDeleteQr = async (item: any) => {
    const confirmed = await confirmDelete(
      'Delete QR code?',
      `"${item.title || 'QR Code'}" will be permanently removed from your history.`
    );
    if (!confirmed) return;

    setDeletingQr(item.id);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const token = await getTokenRef.current();
      if (!token) {
        setErrorMessage('Session expired. Please sign in again.');
        return;
      }
      const res = await deleteQrCode(token, item.id);
      if (res.error) {
        setErrorMessage(res.error || 'Failed to delete QR code.');
        return;
      }
      setQrCodes((prev) => prev.filter((q) => q.id !== item.id));
      setQrCount((prev) => Math.max(0, prev - 1));
      setSuccessMessage('QR code deleted.');
    } catch (err: any) {
      console.error('Delete QR error:', err);
      setErrorMessage(err?.message || 'Failed to delete QR code.');
    } finally {
      setDeletingQr(null);
    }
  };

  const handleCopy = async (text: string) => {
    try {
      await copyTextToClipboard(text);
      setSuccessMessage('Copied to clipboard.');
    } catch {
      setErrorMessage('Unable to copy on this device.');
    }
  };

  const handleShareQr = async (item: any) => {
    setSharingId(item.id);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const exporter = exporterRef.current;
      if (!exporter) {
        throw new Error('QR renderer is not ready. Please try again.');
      }
      const base64 = await exporter.exportPng(item.target_url);
      const result = await shareQrImagePng(base64, item.title || 'LinkFlow QR Code');
      setSuccessMessage(
        result === 'shared'
          ? 'QR image shared.'
          : 'Image sharing is unavailable here, so the PNG was downloaded instead.'
      );
    } catch (err: any) {
      console.error('Share QR error:', err);
      setErrorMessage(err?.message || 'Unable to share the QR image.');
    } finally {
      setSharingId(null);
    }
  };

  const handleDownloadQr = async (item: any) => {
    setDownloadingId(item.id);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const exporter = exporterRef.current;
      if (!exporter) {
        throw new Error('QR renderer is not ready. Please try again.');
      }
      const base64 = await exporter.exportPng(item.target_url);
      const result = await downloadQrImagePng(base64, item.title || 'LinkFlow QR Code');
      setSuccessMessage(
        result === 'downloaded'
          ? 'QR image downloaded.'
          : 'QR image saved. Use the opened sheet to store it on your device.'
      );
    } catch (err: any) {
      console.error('Download QR error:', err);
      setErrorMessage(err?.message || 'Unable to save the QR image.');
    } finally {
      setDownloadingId(null);
    }
  };

  const displayName =
    user?.firstName ||
    user?.fullName ||
    user?.primaryEmailAddress?.emailAddress?.split('@')[0] ||
    'Member';

  const initial = displayName.charAt(0).toUpperCase();
  const email = user?.primaryEmailAddress?.emailAddress || '';

  const totalClicks = links.reduce((sum, link) => sum + (link.clicks_count || 0), 0);
  const linksThisWeek = links.filter((link) => withinDays(link.created_at, 7)).length;
  const qrThisMonth = qrCodes.filter((qr) => withinDays(qr.created_at, 30)).length;
  const qrLinkedCount = qrCodes.filter((qr) => !!qr.link_id).length;
  const mostClicked = links.reduce<any | null>((best, link) => {
    const clicks = link.clicks_count || 0;
    if (!best || clicks > (best.clicks_count || 0)) return link;
    return best;
  }, null);
  const shortBase = prettyShortBase();

  return (
    <SafeAreaView
      style={styles.root}
      edges={isDesktop ? ['top', 'bottom', 'left', 'right'] : ['top', 'left', 'right']}
    >
      <StatusBar barStyle="light-content" backgroundColor={T.bg} />
      <View style={styles.shell}>
        {isDesktop ? (
          <Sidebar
            displayName={displayName}
            email={email}
            initial={initial}
            onNavigate={onNavigate}
            onLogout={handleLogout}
          />
        ) : null}

        <View style={styles.main}>
          <DashboardContent
            displayName={displayName}
            email={email}
            initial={initial}
            links={links}
            totalLinks={totalLinks}
            activeLinks={activeLinks}
            linksLoading={linksLoading}
            linksError={linksError}
            qrCodes={qrCodes}
            qrCount={qrCount}
            qrLoading={qrLoading}
            qrError={qrError}
            refreshing={refreshing}
            deletingLink={deletingLink}
            deletingQr={deletingQr}
            sharingId={sharingId}
            downloadingId={downloadingId}
            errorMessage={errorMessage}
            successMessage={successMessage}
            shortBase={shortBase}
            totalClicks={totalClicks}
            linksThisWeek={linksThisWeek}
            mostClicked={mostClicked}
            qrThisMonth={qrThisMonth}
            qrLinkedCount={qrLinkedCount}
            isDesktop={isDesktop}
            isTablet={isTablet}
            onNavigate={onNavigate}
            onLogout={handleLogout}
            onRefresh={onRefresh}
            onRetryLinks={() => bootstrap(false)}
            onRetryQr={() => bootstrap(false)}
            onDeleteLink={handleDeleteLink}
            onDeleteQr={handleDeleteQr}
            onCopy={handleCopy}
            onShareQr={handleShareQr}
            onDownloadQr={handleDownloadQr}
            onDismissNotice={() => {
              setErrorMessage(null);
              setSuccessMessage(null);
            }}
            clipboardUrl={clipboardUrl}
            onClipboardShorten={handleClipboardShorten}
            onClipboardDismiss={handleClipboardDismiss}
          />
        </View>
      </View>

      {!isDesktop ? <MobileBottomNav /> : null}

      <LogoutConfirmModal
        visible={showLogoutModal}
        onCancel={() => setShowLogoutModal(false)}
        onConfirm={confirmLogout}
        loading={loggingOut}
        error={logoutError}
      />

      <QrExporter ref={exporterRef} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.bg },
  shell: { flex: 1, flexDirection: 'row' },
  main: { flex: 1, minWidth: 0 },
  scroll: { flex: 1 },
  scrollContent: {
    width: '100%',
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 24,
  },
  scrollContentDesktop: {
    maxWidth: 1240,
    alignSelf: 'center',
    paddingHorizontal: 32,
    paddingTop: 28,
  },
  bottomSpacer: { height: 34 },

  /* Brand + sidebar */
  brand: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  brandMark: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: T.purple,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandMarkCompact: { width: 34, height: 34, borderRadius: 9 },
  brandText: { fontSize: 19, fontWeight: '800', color: T.text, letterSpacing: 0.2 },
  brandTextCompact: { fontSize: 16 },
  sidebar: {
    width: 280,
    backgroundColor: T.sidebar,
    borderRightWidth: 1,
    borderRightColor: T.border,
    paddingHorizontal: 18,
    paddingTop: 26,
    paddingBottom: 22,
  },
  sidebarTop: { marginBottom: 34, paddingHorizontal: 4 },
  nav: { gap: 6 },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    overflow: 'hidden',
  },
  navItemActive: { backgroundColor: T.purple },
  navText: { fontSize: 14, fontWeight: '600', color: T.muted },
  navTextActive: { color: T.onPrimary },
  sidebarFooter: {
    marginTop: 'auto',
    paddingTop: 18,
    borderTopWidth: 1,
    borderTopColor: T.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sidebarUser: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: T.purple,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 15, fontWeight: '800', color: T.onPrimary },
  sidebarUserText: { flex: 1, minWidth: 0 },
  sidebarName: { fontSize: 13.5, fontWeight: '700', color: T.text },
  sidebarEmail: { fontSize: 11.5, color: T.faint, marginTop: 1 },
  logoutBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: T.border,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Compact top bar */
  topBar: { marginBottom: 20 },
  topBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  topRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  avatarSmall: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: T.purple,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarSmallText: { fontSize: 14, fontWeight: '800', color: T.onPrimary },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: T.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: T.card,
  },
  pillRow: { flexDirection: 'row', gap: 6 },
  pill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 9,
    paddingHorizontal: 6,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: T.border,
    backgroundColor: T.card,
  },
  pillActive: { backgroundColor: T.purple, borderColor: T.purple },
  pillText: { fontSize: 10.5, fontWeight: '700', color: T.muted },
  pillTextActive: { color: T.onPrimary },

  /* Welcome */
  welcome: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    marginBottom: 20,
  },
  welcomeText: { flex: 1, minWidth: 0 },
  welcomeBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 8,
    marginBottom: 10,
  },
  welcomeBadgeText: { fontSize: 12, fontWeight: '600', color: T.lilac },
  welcomeTitle: { fontSize: 30, fontWeight: '800', color: T.text, letterSpacing: -0.4 },
  welcomeTitleCompact: { fontSize: 23 },
  welcomeSub: { fontSize: 14, color: T.muted, marginTop: 6 },
  art: { width: 132, height: 132, alignItems: 'center', justifyContent: 'center' },
  artCore: {
    width: 66,
    height: 66,
    borderRadius: 16,
    backgroundColor: T.elevated,
    borderWidth: 1,
    borderColor: T.border,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Quick actions */
  quickRow: { gap: 14, marginBottom: 22 },
  quickRowWide: { flexDirection: 'row', alignItems: 'stretch' },
  quickRowStack: { flexDirection: 'column' },
  quickMain: { flex: 2, minWidth: 0 },
  quickSide: { flex: 1, minWidth: 220 },
  shortenOuter: {
    position: 'relative',
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: T.card,
    borderWidth: 1,
    borderColor: T.border,
    height: '100%',
    justifyContent: 'center',
  },
  shortenInner: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 18 },
  shortenInnerCompact: { flexDirection: 'column', alignItems: 'stretch', gap: 12 },
  shortenLead: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, minWidth: 200 },
  shortenIcon: {
    width: 46,
    height: 46,
    borderRadius: 10,
    backgroundColor: T.surface,
    borderWidth: 1,
    borderColor: T.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shortenCopy: { flex: 1, minWidth: 0 },
  shortenTitle: { fontSize: 17, fontWeight: '800', color: T.text },
  shortenDesc: {
    fontSize: 12.5,
    color: T.muted,
    marginTop: 2,
    lineHeight: 17,
  },
  shortenInput: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 150,
    minWidth: 130,
    maxWidth: 300,
    height: 46,
    justifyContent: 'center',
    backgroundColor: T.bg,
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: 10,
    paddingHorizontal: 14,
  },
  shortenInputCompact: { flexGrow: 0, flexBasis: 'auto', width: '100%', maxWidth: '100%' },
  shortenPlaceholder: { fontSize: 13, color: T.muted },
  shortenBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    height: 46,
    paddingHorizontal: 18,
    borderRadius: 10,
    backgroundColor: T.purple,
  },
  shortenBtnText: { fontSize: 13.5, fontWeight: '800', color: T.onPrimary },
  qrQuick: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: T.border,
    backgroundColor: T.card,
    padding: 18,
    minHeight: 150,
    justifyContent: 'center',
    gap: 6,
  },
  qrQuickIcon: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: T.surface,
    borderWidth: 1,
    borderColor: T.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  qrQuickTitle: { fontSize: 15, fontWeight: '800', color: T.text },
  qrQuickDesc: { fontSize: 12, color: T.muted, lineHeight: 17 },
  qrQuickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    alignSelf: 'flex-start',
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  qrQuickBtnText: { fontSize: 12, fontWeight: '700', color: T.lilac },

  /* Stats */
  overviewBlock: { marginBottom: 8 },
  blockHeadingRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 12,
    flexWrap: 'wrap',
  },
  blockHeading: { fontSize: 15, fontWeight: '700', color: T.text },
  blockSubheading: { fontSize: 11.5, color: T.faint },
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  statsRowWide: { flexWrap: 'nowrap' },
  statsRowWrap: { flexWrap: 'wrap' },
  statCellWide: { flex: 1, minWidth: 0 },
  statCellHalf: { flexBasis: '46%', flexGrow: 1, minWidth: 0 },
  statCard: { position: 'relative', overflow: 'hidden', borderRadius: 16 },
  statAccent: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, opacity: 0.9 },
  statTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  statIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statSpark: { flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: 26 },
  sparkBar: { width: 4, borderRadius: 2, backgroundColor: 'rgba(255, 255, 255, 0.18)' },
  statValue: { fontSize: 24, fontWeight: '800', color: T.text, letterSpacing: -0.5 },
  statLabel: {
    fontSize: 10.5,
    color: T.muted,
    marginTop: 3,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },

  /* Analytics sections */
  sectionSpacer: { marginTop: 14 },
  sectionPanel: { overflow: 'hidden', borderRadius: 18, position: 'relative' },
  sectionPanelBar: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, opacity: 0.9 },
  sectionPanelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: T.border,
    flexWrap: 'wrap',
  },
  sectionPanelTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    flex: 1,
    minWidth: 220,
  },
  sectionIcon: {
    width: 38,
    height: 38,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionPanelHeading: { flex: 1, minWidth: 0 },
  sectionPanelTitle: { fontSize: 16, fontWeight: '800', color: T.text },
  sectionPanelDesc: { fontSize: 12, color: T.muted, marginTop: 2, lineHeight: 16 },
  sectionActionBtn: { paddingVertical: 6, paddingHorizontal: 4 },
  sectionActionText: { fontSize: 12.5, fontWeight: '700' },
  sectionPanelBody: { padding: 14, gap: 14 },

  /* Metric chips */
  metricGrid: { flexDirection: 'row', gap: 10 },
  metricGridWide: { flexWrap: 'nowrap' },
  metricGridWrap: { flexWrap: 'wrap' },
  metricCellWide: { flex: 1, minWidth: 0 },
  metricCellHalf: { flexBasis: '46%', flexGrow: 1, minWidth: 0 },
  metricChip: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    padding: 12,
    gap: 6,
    minHeight: 74,
    justifyContent: 'center',
  },
  metricChipTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 6,
  },
  metricChipLabel: {
    flex: 1,
    fontSize: 10.5,
    fontWeight: '700',
    color: T.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  metricChipValue: { fontSize: 19, fontWeight: '800', color: T.text },

  /* Link analytics */
  highlightStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 11,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  highlightIcon: {
    width: 32,
    height: 32,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
  },
  highlightText: { flex: 1, minWidth: 0 },
  highlightLabel: { fontSize: 10.5, fontWeight: '700', color: T.faint, textTransform: 'uppercase' },
  highlightValue: { fontSize: 13, fontWeight: '700', color: T.text, marginTop: 2 },

  tableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  tableHeaderText: {
    fontSize: 10,
    fontWeight: '700',
    color: T.faint,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  tableBody: { gap: 8 },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 11,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  tableCellMain: { flex: 2.2, minWidth: 0 },
  tableCellShort: { flex: 1.6, minWidth: 0 },
  tableCellStatus: { width: 74 },
  tableCellDate: { width: 82 },
  tableActions: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  tablePrimary: { fontSize: 13, fontWeight: '700', color: T.text },
  tableSecondary: { fontSize: 11, color: T.faint, marginTop: 2 },
  tableCompactMeta: { marginTop: 4, gap: 2 },
  tableShort: { fontSize: 12, fontWeight: '600', color: T.lilac },
  tableMeta: { fontSize: 10.5, color: T.faint, marginTop: 2 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, alignSelf: 'flex-start' },
  badgeActive: { backgroundColor: T.greenBg },
  badgeInactive: { backgroundColor: 'rgba(255, 255, 255, 0.05)' },
  badgeText: { fontSize: 10, fontWeight: '700' },
  iconAction: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  iconActionDanger: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderColor: 'rgba(239, 68, 68, 0.35)',
  },
  moreRow: { alignItems: 'center', paddingVertical: 6 },
  moreText: { fontSize: 12, fontWeight: '700', color: T.lilac },

  /* QR analytics */
  trackingNote: {
    fontSize: 11,
    color: T.faint,
    lineHeight: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.09)',
    borderRadius: 10,
    padding: 10,
  },
  qrPreviewGrid: { flexDirection: 'row', gap: 10 },
  qrPreviewGridWide: { flexWrap: 'nowrap' },
  qrPreviewGridStack: { flexWrap: 'wrap' },
  qrPreviewCellWide: { flex: 1, minWidth: 0 },
  qrPreviewCellStack: { flexBasis: '46%', flexGrow: 1, minWidth: 0 },
  qrPreview: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    padding: 10,
    gap: 10,
    height: '100%',
  },
  qrPreviewTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  qrPreviewThumb: {
    width: 84,
    height: 84,
    borderRadius: 9,
    overflow: 'hidden',
    backgroundColor: QR_LIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrPreviewInfo: { flex: 1, minWidth: 0, gap: 2 },
  qrPreviewTitle: { fontSize: 12.5, fontWeight: '700', color: T.text },
  qrPreviewTarget: { fontSize: 10.5, color: T.muted, lineHeight: 14 },
  qrPreviewDate: { fontSize: 10, color: T.faint },
  qrPreviewActions: {
    flexDirection: 'row',
    gap: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: T.border,
  },
  qrPreviewAction: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  qrPreviewActionText: { fontSize: 11, fontWeight: '700', color: T.lilac },

  /* Shared states */
  inlineEmpty: { alignItems: 'center', paddingVertical: 22, paddingHorizontal: 16, gap: 8 },
  inlineEmptyIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    marginBottom: 2,
  },
  inlineEmptyTitle: { fontSize: 14.5, fontWeight: '700', color: T.text },
  inlineEmptyText: {
    fontSize: 12.5,
    color: T.muted,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 4,
  },
  inlineError: {
    alignItems: 'center',
    gap: 8,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.4)',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  inlineErrorText: { fontSize: 12.5, color: '#FCA5A5', textAlign: 'center' },
  loading: { paddingVertical: 26, alignItems: 'center', gap: 8 },
  loadingText: { fontSize: 12.5, color: T.muted },

  /* Notices */
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 14,
  },
  noticeError: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderColor: 'rgba(239, 68, 68, 0.4)',
  },
  noticeSuccess: {
    backgroundColor: 'rgba(34, 197, 94, 0.12)',
    borderColor: 'rgba(34, 197, 94, 0.4)',
  },
  noticeText: { flex: 1, fontSize: 12.5, fontWeight: '600' },

  /* ------------------------------------------------------------------ */
  /* Mobile redesign styles                                              */
  /* ------------------------------------------------------------------ */
  mScrollContent: {
    width: '100%',
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 24,
  },
  mBottomSpacer: { height: 6 },

  mHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  mBrand: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  mBrandMark: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: T.purple,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mBrandText: { fontSize: 17, fontWeight: '800', color: T.text, letterSpacing: 0.2 },
  mBrandAccent: { fontSize: 12.5, fontWeight: '800', color: T.lilac },
  mAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: T.purple,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  mAvatarText: { fontSize: 16, fontWeight: '800', color: T.onPrimary },

  mHero: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 18,
  },
  mHeroText: { flex: 1, minWidth: 0 },
  mHeroBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    marginBottom: 9,
  },
  mHeroBadgeText: { fontSize: 11.5, fontWeight: '600', color: T.lilac },
  mHeroTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: T.text,
    letterSpacing: -0.5,
  },
  mHeroSub: { fontSize: 12.5, color: T.muted, marginTop: 6, lineHeight: 18 },
  mHeroArt: { width: 96, height: 96, alignItems: 'center', justifyContent: 'center' },
  mHeroCore: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: T.elevated,
    borderWidth: 1,
    borderColor: T.border,
    alignItems: 'center',
    justifyContent: 'center',
  },

  mShortenOuter: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 14,
    backgroundColor: T.card,
    borderWidth: 1,
    borderColor: T.border,
    padding: 16,
    marginBottom: 20,
  },
  mShortenHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  mShortenIcon: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: T.surface,
    borderWidth: 1,
    borderColor: T.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mShortenCopy: { flex: 1, minWidth: 0 },
  mShortenTitle: { fontSize: 16, fontWeight: '800', color: T.text },
  mShortenDesc: {
    fontSize: 11.5,
    color: T.muted,
    marginTop: 2,
    lineHeight: 16,
  },
  mShortenForm: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  mShortenInput: {
    flex: 1,
    minWidth: 0,
    height: 46,
    justifyContent: 'center',
    backgroundColor: T.bg,
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: 10,
    paddingHorizontal: 13,
  },
  mShortenPlaceholder: { fontSize: 12.5, color: T.muted },
  mShortenSend: {
    width: 46,
    height: 46,
    borderRadius: 10,
    backgroundColor: T.purple,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mShortenRecent: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: T.border,
    gap: 8,
  },
  mShortenRecentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  mShortenRecentTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: T.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  mShortenRecentAll: {
    fontSize: 12,
    fontWeight: '700',
    color: T.text,
  },
  mShortenRecentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    backgroundColor: T.bg,
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: 8,
    paddingHorizontal: 11,
    paddingVertical: 9,
  },
  mShortenRecentDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: T.violet,
  },
  mShortenRecentCode: {
    flex: 1,
    minWidth: 0,
    fontSize: 12.5,
    fontWeight: '600',
    color: T.text,
  },
  mShortenRecentClicks: {
    fontSize: 11,
    fontWeight: '600',
    color: T.muted,
  },
  mShortenSkeletonRow: {
    height: 32,
    borderRadius: 8,
    backgroundColor: T.bg,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },

  mSection: { marginBottom: 20 },
  mSectionHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 10,
  },
  mSectionTitle: { fontSize: 15, fontWeight: '700', color: T.text },
  mSectionSub: { fontSize: 11, color: T.faint },
  mStatsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 12,
  },
  mStatCell: { width: '48%' },
  mStatCard: {
    minHeight: 112,
    borderRadius: 18,
    backgroundColor: T.card,
    borderWidth: 1,
    borderColor: T.border,
    padding: 14,
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  mStatTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  mStatIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mStatSpark: { flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: 20 },
  mSparkBar: {
    width: 3.5,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
  },
  mStatValue: {
    fontSize: 24,
    fontWeight: '800',
    color: T.text,
    letterSpacing: -0.4,
    marginTop: 10,
  },
  mStatLabel: { fontSize: 11.5, fontWeight: '600', color: T.muted, marginTop: 2 },

  mPanel: {
    backgroundColor: T.card,
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: 20,
    padding: 14,
    marginBottom: 16,
    overflow: 'hidden',
  },
  mPanelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 10,
  },
  mPanelTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 9, flex: 1, minWidth: 0 },
  mPanelIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mPanelTitle: { fontSize: 14.5, fontWeight: '800', color: T.text },
  mPanelAction: { fontSize: 11.5, fontWeight: '700', color: T.lilac },

  mLinkRow: {
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    gap: 3,
  },
  mLinkTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  mLinkTitle: { flex: 1, minWidth: 0, fontSize: 13, fontWeight: '700', color: T.text },
  mStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
  },
  mStatusActive: { backgroundColor: T.greenBg },
  mStatusInactive: { backgroundColor: 'rgba(255, 255, 255, 0.05)' },
  mStatusDot: { width: 5, height: 5, borderRadius: 3 },
  mStatusText: { fontSize: 9.5, fontWeight: '700' },
  mLinkShort: { fontSize: 11.5, fontWeight: '600', color: T.lilac },
  mLinkOriginal: { fontSize: 10.5, color: T.faint },

  mQrRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  mQrIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mQrInfo: { flex: 1, minWidth: 0, gap: 2 },
  mQrTitle: { fontSize: 13, fontWeight: '700', color: T.text },
  mQrTarget: { fontSize: 10.5, color: T.muted },
  mQrDate: { fontSize: 10, color: T.faint },

  mEmpty: { alignItems: 'center', paddingVertical: 18, gap: 7 },
  mEmptyIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  mEmptyTitle: { fontSize: 14.5, fontWeight: '700', color: T.text },
  mEmptyText: {
    fontSize: 12.5,
    color: T.muted,
    textAlign: 'center',
    lineHeight: 18,
  },
  mEmptyBtn: {
    marginTop: 6,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 9,
    backgroundColor: T.purple,
  },
  mEmptyBtnText: { fontSize: 12, fontWeight: '700', color: T.onPrimary },

  mMoreRow: { alignItems: 'center', paddingTop: 10 },
  mMoreText: { fontSize: 11.5, fontWeight: '700', color: T.lilac },
});
