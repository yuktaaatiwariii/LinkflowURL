import React, { useCallback, useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Colors } from '../constants/colors';
import { AppIcon } from './AppIcon';
import { truncateUrl } from '../utils/url';

interface ClipboardSuggestionProps {
  url: string;
  onShorten: (url: string) => void;
  onDismiss: (url: string) => void;
}

/**
 * "We found a URL in your clipboard" suggestion.
 *
 * Rendered inline (never as a blocking overlay) so it can never cover an
 * important control. Entrance and dismissal are animated, and the dismiss
 * action is exposed as an accessible button for screen readers.
 */
export const ClipboardSuggestion: React.FC<ClipboardSuggestionProps> = ({
  url,
  onShorten,
  onDismiss,
}) => {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: 1,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [progress]);

  const handleDismiss = useCallback(() => {
    // Fade/slide out first, then let the parent remove the card.
    Animated.timing(progress, {
      toValue: 0,
      duration: 180,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) onDismiss(url);
    });
  }, [onDismiss, progress, url]);

  const translateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [-12, 0],
  });

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity: progress,
          transform: [{ translateY }],
        },
      ]}
      accessibilityLiveRegion="polite"
    >
      <View style={styles.glow} pointerEvents="none" />

      <View style={styles.headerRow}>
        <View style={styles.iconWrap}>
          <AppIcon name="link" size={18} color={Colors.accentLight} />
        </View>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>We found a URL in your clipboard</Text>
          <Text style={styles.subtitle}>Would you like to shorten it?</Text>
        </View>
      </View>

      <View style={styles.urlBox}>
        <Text style={styles.urlText} numberOfLines={1} selectable>
          {truncateUrl(url, 52)}
        </Text>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.actionButton, styles.shortenButton]}
          onPress={() => onShorten(url)}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Shorten the URL from your clipboard"
        >
          <AppIcon name="zap" size={16} color="#FFFFFF" />
          <Text style={styles.shortenText}>Shorten</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.dismissButton]}
          onPress={handleDismiss}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Dismiss clipboard suggestion"
          accessibilityHint="This suggestion will not be shown again for this URL"
        >
          <Text style={styles.dismissText}>Dismiss</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    backgroundColor: Colors.surfaceCard,
    padding: 16,
    overflow: 'hidden',
    gap: 14,
  },
  glow: {
    position: 'absolute',
    top: -60,
    right: -40,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: Colors.primaryDeep,
    opacity: 0.35,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: Colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCopy: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 14.5,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  subtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  urlBox: {
    backgroundColor: Colors.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  urlText: {
    fontSize: 12.5,
    color: Colors.accentLight,
    fontWeight: '600',
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 12,
    minHeight: 46,
    paddingHorizontal: 18,
  },
  shortenButton: {
    flex: 1,
    backgroundColor: Colors.primary,
  },
  shortenText: {
    fontSize: 14.5,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  dismissButton: {
    backgroundColor: Colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  dismissText: {
    fontSize: 14.5,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
});
