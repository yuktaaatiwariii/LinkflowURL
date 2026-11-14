import React, { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TextStyle,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { DevColors, DevRadius, DevSpacing } from '../../constants/developerTheme';

export type FeatherName = React.ComponentProps<typeof Feather>['name'];

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

interface DevCardProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  action?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  padding?: number;
  tone?: 'surface' | 'raised';
}

export function DevCard({
  children,
  title,
  subtitle,
  action,
  style,
  padding = DevSpacing.lg,
  tone = 'surface',
}: DevCardProps) {
  return (
    <View
      style={[
        styles.card,
        { padding, backgroundColor: tone === 'raised' ? DevColors.surfaceRaised : DevColors.surface },
        style,
      ]}
    >
      {(title || subtitle || action) && (
        <View style={styles.cardHeader}>
          <View style={{ flex: 1, minWidth: 0 }}>
            {title ? <Text style={styles.cardTitle}>{title}</Text> : null}
            {subtitle ? <Text style={styles.cardSubtitle}>{subtitle}</Text> : null}
          </View>
          {action ? <View style={styles.cardAction}>{action}</View> : null}
        </View>
      )}
      {children}
    </View>
  );
}

interface DevPageHeaderProps {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export function DevPageHeader({ eyebrow, title, subtitle, actions }: DevPageHeaderProps) {
  return (
    <View style={styles.pageHeader}>
      <View style={{ flex: 1, minWidth: 220 }}>
        {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
        <Text style={styles.pageTitle}>{title}</Text>
        {subtitle ? <Text style={styles.pageSubtitle}>{subtitle}</Text> : null}
      </View>
      {actions ? <View style={styles.pageActions}>{actions}</View> : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Buttons
// ---------------------------------------------------------------------------

interface DevButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md';
  icon?: FeatherName;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function DevButton({
  label,
  onPress,
  variant = 'secondary',
  size = 'md',
  icon,
  loading = false,
  disabled = false,
  fullWidth = false,
  style,
}: DevButtonProps) {
  const isDisabled = disabled || loading;
  const palette = {
    primary: { bg: DevColors.primary, border: DevColors.primary, text: '#FFFFFF' },
    secondary: { bg: DevColors.surfaceRaised, border: DevColors.border, text: DevColors.text },
    outline: { bg: 'transparent', border: DevColors.borderStrong, text: DevColors.text },
    ghost: { bg: 'transparent', border: 'transparent', text: DevColors.textSecondary },
    danger: { bg: DevColors.dangerBg, border: DevColors.dangerBorder, text: DevColors.danger },
  }[variant];

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.82}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled }}
      style={[
        styles.button,
        size === 'sm' && styles.buttonSm,
        {
          backgroundColor: palette.bg,
          borderColor: palette.border,
          opacity: isDisabled ? 0.5 : 1,
        },
        fullWidth && { width: '100%' },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={palette.text} />
      ) : icon ? (
        <Feather name={icon} size={size === 'sm' ? 14 : 16} color={palette.text} />
      ) : null}
      <Text
        style={[
          styles.buttonText,
          size === 'sm' && styles.buttonTextSm,
          { color: palette.text },
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

interface DevIconButtonProps {
  icon: FeatherName;
  onPress: () => void;
  label: string;
  tone?: 'neutral' | 'danger' | 'primary';
  disabled?: boolean;
}

export function DevIconButton({
  icon,
  onPress,
  label,
  tone = 'neutral',
  disabled = false,
}: DevIconButtonProps) {
  const color =
    tone === 'danger' ? DevColors.danger : tone === 'primary' ? DevColors.primarySoft : DevColors.textSecondary;
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[
        styles.iconButton,
        { borderColor: tone === 'danger' ? DevColors.dangerBorder : DevColors.border },
        disabled && { opacity: 0.4 },
      ]}
    >
      <Feather name={icon} size={16} color={color} />
    </TouchableOpacity>
  );
}

// ---------------------------------------------------------------------------
// Badges and stats
// ---------------------------------------------------------------------------

export type DevBadgeTone = 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'neutral';

export function DevBadge({
  label,
  tone = 'neutral',
  icon,
}: {
  label: string;
  tone?: DevBadgeTone;
  icon?: FeatherName;
}) {
  const palette: Record<DevBadgeTone, { bg: string; border: string; text: string }> = {
    primary: { bg: DevColors.primaryBg, border: DevColors.primaryBorder, text: DevColors.primarySoft },
    success: { bg: DevColors.successBg, border: DevColors.successBorder, text: DevColors.success },
    warning: { bg: DevColors.warningBg, border: DevColors.warningBorder, text: DevColors.warning },
    danger: { bg: DevColors.dangerBg, border: DevColors.dangerBorder, text: DevColors.danger },
    info: { bg: DevColors.infoBg, border: DevColors.infoBorder, text: DevColors.info },
    neutral: { bg: DevColors.neutralBg, border: DevColors.neutralBorder, text: DevColors.textSecondary },
  };
  const current = palette[tone];
  return (
    <View style={[styles.badge, { backgroundColor: current.bg, borderColor: current.border }]}>
      {icon ? <Feather name={icon} size={11} color={current.text} /> : null}
      <Text style={[styles.badgeText, { color: current.text }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

interface DevStatCardProps {
  label: string;
  value: string;
  helper?: string;
  icon?: FeatherName;
  tone?: DevBadgeTone;
}

export function DevStatCard({ label, value, helper, icon, tone = 'primary' }: DevStatCardProps) {
  const toneColor: Record<DevBadgeTone, string> = {
    primary: DevColors.primarySoft,
    success: DevColors.success,
    warning: DevColors.warning,
    danger: DevColors.danger,
    info: DevColors.info,
    neutral: DevColors.textSecondary,
  };
  const color = toneColor[tone];
  return (
    <View style={styles.statCard}>
      <View style={styles.statTop}>
        <Text style={styles.statLabel}>{label}</Text>
        {icon ? (
          <View style={[styles.statIcon, { backgroundColor: `${color}1F`, borderColor: `${color}55` }]}>
            <Feather name={icon} size={15} color={color} />
          </View>
        ) : null}
      </View>
      <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      {helper ? <Text style={styles.statHelper}>{helper}</Text> : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// States
// ---------------------------------------------------------------------------

export function DevEmptyState({
  icon = 'inbox',
  title,
  message,
  action,
}: {
  icon?: FeatherName;
  title: string;
  message?: string;
  action?: React.ReactNode;
}) {
  return (
    <View style={styles.stateBox}>
      <View style={styles.stateIcon}>
        <Feather name={icon} size={22} color={DevColors.primarySoft} />
      </View>
      <Text style={styles.stateTitle}>{title}</Text>
      {message ? <Text style={styles.stateMessage}>{message}</Text> : null}
      {action ? <View style={{ marginTop: DevSpacing.lg }}>{action}</View> : null}
    </View>
  );
}

export function DevErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <View style={styles.errorBox}>
      <Feather name="alert-triangle" size={20} color={DevColors.danger} />
      <View style={{ flex: 1 }}>
        <Text style={styles.errorTitle}>Something went wrong</Text>
        <Text style={styles.errorMessage}>{message}</Text>
      </View>
      {onRetry ? <DevButton label="Retry" size="sm" variant="outline" onPress={onRetry} /> : null}
    </View>
  );
}

export function DevLoading({ label = 'Loading…' }: { label?: string }) {
  return (
    <View style={styles.loadingBox}>
      <ActivityIndicator size="small" color={DevColors.primary} />
      <Text style={styles.loadingText}>{label}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Form controls
// ---------------------------------------------------------------------------

interface DevInputProps extends TextInputProps {
  label?: string;
  error?: string;
  icon?: FeatherName;
  containerStyle?: StyleProp<ViewStyle>;
}

export function DevInput({ label, error, icon, containerStyle, style, ...rest }: DevInputProps) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={[styles.inputWrap, containerStyle]}>
      {label ? <Text style={styles.inputLabel}>{label}</Text> : null}
      <View
        style={[
          styles.inputShell,
          focused && { borderColor: DevColors.primaryBorder, backgroundColor: DevColors.backgroundAlt },
          !!error && { borderColor: DevColors.dangerBorder },
        ]}
      >
        {icon ? <Feather name={icon} size={15} color={DevColors.textMuted} /> : null}
        <TextInput
          {...rest}
          onFocus={(event) => {
            setFocused(true);
            rest.onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            rest.onBlur?.(event);
          }}
          placeholderTextColor={DevColors.textMuted}
          style={[styles.input, style as StyleProp<TextStyle>]}
        />
      </View>
      {error ? <Text style={styles.inputError}>{error}</Text> : null}
    </View>
  );
}

export interface DevSelectOption<T extends string> {
  value: T;
  label: string;
  description?: string;
}

interface DevSelectProps<T extends string> {
  label?: string;
  value: T | null;
  options: DevSelectOption<T>[];
  onChange: (value: T) => void;
  placeholder?: string;
  disabled?: boolean;
  error?: string;
}

export function DevSelect<T extends string>({
  label,
  value,
  options,
  onChange,
  placeholder = 'Select…',
  disabled = false,
  error,
}: DevSelectProps<T>) {
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value);

  return (
    <View style={styles.inputWrap}>
      {label ? <Text style={styles.inputLabel}>{label}</Text> : null}
      <TouchableOpacity
        onPress={() => setOpen(true)}
        disabled={disabled}
        activeOpacity={0.8}
        accessibilityRole="button"
        style={[
          styles.inputShell,
          !!error && { borderColor: DevColors.dangerBorder },
          disabled && { opacity: 0.55 },
        ]}
      >
        <Text style={[styles.selectValue, !selected && { color: DevColors.textMuted }]} numberOfLines={1}>
          {selected?.label || placeholder}
        </Text>
        <Feather name="chevron-down" size={16} color={DevColors.textMuted} />
      </TouchableOpacity>
      {error ? <Text style={styles.inputError}>{error}</Text> : null}

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.pickerBackdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.pickerCard} onPress={() => undefined}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>{label || 'Select an option'}</Text>
              <DevIconButton icon="x" label="Close" onPress={() => setOpen(false)} />
            </View>
            <ScrollView style={{ maxHeight: 380 }}>
              {options.map((option) => {
                const active = option.value === value;
                return (
                  <TouchableOpacity
                    key={option.value}
                    onPress={() => {
                      onChange(option.value);
                      setOpen(false);
                    }}
                    style={[styles.pickerOption, active && styles.pickerOptionActive]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.pickerOptionLabel, active && { color: DevColors.primarySoft }]}>
                        {option.label}
                      </Text>
                      {option.description ? (
                        <Text style={styles.pickerOptionDescription}>{option.description}</Text>
                      ) : null}
                    </View>
                    {active ? <Feather name="check" size={16} color={DevColors.primarySoft} /> : null}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

export function DevCheckbox({
  checked,
  onToggle,
  label,
  description,
}: {
  checked: boolean;
  onToggle: () => void;
  label: string;
  description?: string;
}) {
  return (
    <TouchableOpacity
      onPress={onToggle}
      activeOpacity={0.8}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      style={[styles.checkboxRow, checked && { borderColor: DevColors.primaryBorder }]}
    >
      <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
        {checked ? <Feather name="check" size={12} color="#FFFFFF" /> : null}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.checkboxLabel}>{label}</Text>
        {description ? <Text style={styles.checkboxDescription}>{description}</Text> : null}
      </View>
    </TouchableOpacity>
  );
}

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
}

export function DevSegmented<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  label?: string;
}) {
  return (
    <View style={{ gap: 6 }}>
      {label ? <Text style={styles.segmentLabel}>{label}</Text> : null}
      <View style={styles.segmentWrap}>
        {options.map((option) => {
          const active = option.value === value;
          return (
            <TouchableOpacity
              key={option.value}
              onPress={() => onChange(option.value)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              style={[styles.segmentItem, active && styles.segmentItemActive]}
            >
              <Text style={[styles.segmentText, active && styles.segmentTextActive]} numberOfLines={1}>
                {option.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

export function DevInfoRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      {typeof value === 'string' ? (
        <Text style={[styles.infoValue, mono && styles.mono]} selectable>
          {value}
        </Text>
      ) : (
        <View style={{ alignItems: 'flex-end' }}>{value}</View>
      )}
    </View>
  );
}

export function DevDivider() {
  return <View style={styles.divider} />;
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: DevColors.border,
    borderRadius: DevRadius.lg,
    width: '100%',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: DevSpacing.md,
    marginBottom: DevSpacing.lg,
  },
  cardAction: { flexShrink: 0 },
  cardTitle: {
    color: DevColors.text,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.1,
  },
  cardSubtitle: {
    color: DevColors.textMuted,
    fontSize: 12,
    marginTop: 3,
    lineHeight: 17,
  },
  pageHeader: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: DevSpacing.lg,
    marginBottom: DevSpacing.xl,
  },
  eyebrow: {
    color: DevColors.primarySoft,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  pageTitle: {
    color: DevColors.text,
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  pageSubtitle: {
    color: DevColors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 6,
    maxWidth: 680,
  },
  pageActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: DevSpacing.sm,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    minHeight: 42,
    paddingHorizontal: 15,
    borderRadius: DevRadius.md,
    borderWidth: 1,
  },
  buttonSm: { minHeight: 34, paddingHorizontal: 11, borderRadius: DevRadius.sm },
  buttonText: { fontSize: 13, fontWeight: '700' },
  buttonTextSm: { fontSize: 12 },
  iconButton: {
    width: 32,
    height: 32,
    borderRadius: DevRadius.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  badgeText: { fontSize: 10.5, fontWeight: '700', letterSpacing: 0.2 },
  statCard: {
    flex: 1,
    minWidth: 150,
    backgroundColor: DevColors.surface,
    borderWidth: 1,
    borderColor: DevColors.border,
    borderRadius: DevRadius.lg,
    padding: DevSpacing.lg,
  },
  statTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  statLabel: { color: DevColors.textMuted, fontSize: 11, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase' },
  statIcon: {
    width: 28,
    height: 28,
    borderRadius: 9,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: { color: DevColors.text, fontSize: 26, fontWeight: '800', marginTop: 10, letterSpacing: -0.5 },
  statHelper: { color: DevColors.textMuted, fontSize: 11.5, marginTop: 5 },
  stateBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 42,
    paddingHorizontal: 20,
  },
  stateIcon: {
    width: 46,
    height: 46,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: DevColors.primaryBg,
    borderWidth: 1,
    borderColor: DevColors.primaryBorder,
    marginBottom: DevSpacing.md,
  },
  stateTitle: { color: DevColors.text, fontSize: 15, fontWeight: '700', textAlign: 'center' },
  stateMessage: {
    color: DevColors.textMuted,
    fontSize: 12.5,
    lineHeight: 18,
    textAlign: 'center',
    marginTop: 6,
    maxWidth: 420,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DevSpacing.md,
    backgroundColor: DevColors.dangerBg,
    borderWidth: 1,
    borderColor: DevColors.dangerBorder,
    borderRadius: DevRadius.md,
    padding: DevSpacing.md,
  },
  errorTitle: { color: DevColors.danger, fontSize: 12.5, fontWeight: '700' },
  errorMessage: { color: DevColors.textSecondary, fontSize: 12, lineHeight: 17, marginTop: 2 },
  loadingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 34,
  },
  loadingText: { color: DevColors.textMuted, fontSize: 12.5 },
  inputWrap: { width: '100%', gap: 6 },
  inputLabel: { color: DevColors.textSecondary, fontSize: 11.5, fontWeight: '700', letterSpacing: 0.3 },
  inputShell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 42,
    paddingHorizontal: 12,
    borderRadius: DevRadius.md,
    borderWidth: 1,
    borderColor: DevColors.border,
    backgroundColor: DevColors.backgroundAlt,
  },
  input: {
    flex: 1,
    color: DevColors.text,
    fontSize: 13.5,
    paddingVertical: 10,
  },
  inputError: { color: DevColors.danger, fontSize: 11.5 },
  selectValue: { flex: 1, color: DevColors.text, fontSize: 13.5 },
  pickerBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(5, 5, 10, 0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  pickerCard: {
    width: '100%',
    maxWidth: 460,
    backgroundColor: DevColors.surfaceRaised,
    borderRadius: DevRadius.lg,
    borderWidth: 1,
    borderColor: DevColors.borderStrong,
    padding: DevSpacing.lg,
  },
  pickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: DevSpacing.md,
    gap: 12,
  },
  pickerTitle: { color: DevColors.text, fontSize: 15, fontWeight: '700' },
  pickerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 11,
    paddingHorizontal: 10,
    borderRadius: DevRadius.md,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  pickerOptionActive: {
    backgroundColor: DevColors.primaryBg,
    borderColor: DevColors.primaryBorder,
  },
  pickerOptionLabel: { color: DevColors.text, fontSize: 13.5, fontWeight: '600' },
  pickerOptionDescription: { color: DevColors.textMuted, fontSize: 11.5, marginTop: 2, lineHeight: 16 },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderWidth: 1,
    borderColor: DevColors.border,
    borderRadius: DevRadius.md,
    padding: 11,
    backgroundColor: DevColors.backgroundAlt,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: DevColors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  checkboxChecked: { backgroundColor: DevColors.primary, borderColor: DevColors.primary },
  checkboxLabel: { color: DevColors.text, fontSize: 12.5, fontWeight: '600' },
  checkboxDescription: { color: DevColors.textMuted, fontSize: 11, lineHeight: 16, marginTop: 2 },
  segmentLabel: { color: DevColors.textMuted, fontSize: 10.5, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase' },
  segmentWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 2,
    padding: 3,
    borderRadius: DevRadius.md,
    borderWidth: 1,
    borderColor: DevColors.border,
    backgroundColor: DevColors.backgroundAlt,
    alignSelf: 'flex-start',
  },
  segmentItem: {
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: DevRadius.sm,
  },
  segmentItemActive: { backgroundColor: DevColors.primaryBg },
  segmentText: { color: DevColors.textMuted, fontSize: 11.5, fontWeight: '700' },
  segmentTextActive: { color: DevColors.primarySoft },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: DevSpacing.lg,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: DevColors.border,
  },
  infoLabel: { color: DevColors.textMuted, fontSize: 12, flexShrink: 0 },
  infoValue: { color: DevColors.text, fontSize: 12.5, fontWeight: '600', textAlign: 'right', flex: 1 },
  mono: { fontFamily: 'monospace' },
  divider: { height: 1, backgroundColor: DevColors.border, width: '100%' },
});

export const devStyles = styles;
