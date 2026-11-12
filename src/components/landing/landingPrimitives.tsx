import React, { useId, useRef } from 'react';
import {
  Animated,
  Pressable,
  StyleProp,
  Text,
  useWindowDimensions,
  View,
  ViewStyle,
} from 'react-native';
import Svg, {
  Circle,
  Defs,
  LinearGradient,
  RadialGradient,
  Stop,
  Text as SvgText,
} from 'react-native-svg';
import { G, L, SANS } from './landingTheme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * Headline rendered as SVG so the highlighted line can carry a real
 * purple gradient. All lines share one SVG box, which keeps baselines and
 * line spacing perfectly consistent across platforms.
 */
export function GradientHeadline({
  lines,
  fontSize,
  lineHeight,
  width,
  id = 'lf-headline',
}: {
  lines: { text: string; gradient?: boolean }[];
  fontSize: number;
  lineHeight: number;
  width: number;
  id?: string;
}) {
  const height = lines.length * lineHeight;

  return (
    <Svg width={width} height={height} style={{ alignSelf: 'center' }}>
      <Defs>
        <LinearGradient id={id} x1="0" y1="0" x2="1" y2="0.6">
          <Stop offset="0" stopColor={G.heading[0]} />
          <Stop offset="0.55" stopColor={G.heading[1]} />
          <Stop offset="1" stopColor={G.heading[2]} />
        </LinearGradient>
      </Defs>

      {lines.map((line, index) => (
        <SvgText
          key={line.text}
          x={width / 2}
          y={index * lineHeight + lineHeight * 0.75}
          textAnchor="middle"
          fill={line.gradient ? `url(#${id})` : L.text}
          fontSize={fontSize}
          fontWeight="800"
          fontFamily={SANS}
          letterSpacing={-fontSize * 0.028}
        >
          {line.text}
        </SvgText>
      ))}
    </Svg>
  );
}

/** Pressable with a subtle, spring-based scale for premium card feedback. */
export function ScalePress({
  children,
  onPress,
  style,
  scaleTo = 0.97,
  accessibilityLabel,
  accessibilityHint,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  scaleTo?: number;
  accessibilityLabel?: string;
  accessibilityHint?: string;
}) {
  const scale = useRef(new Animated.Value(1)).current;

  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      onPress={onPress}
      onPressIn={() =>
        Animated.spring(scale, {
          toValue: scaleTo,
          useNativeDriver: true,
          speed: 45,
          bounciness: 0,
        }).start()
      }
      onPressOut={() =>
        Animated.spring(scale, {
          toValue: 1,
          useNativeDriver: true,
          speed: 28,
          bounciness: 7,
        }).start()
      }
      style={[style, { transform: [{ scale }] }]}
    >
      {children}
    </AnimatedPressable>
  );
}

/**
 * Soft radial glow rendered as an SVG radial gradient.
 *
 * Solid translucent circles show a visible rim on dark backgrounds, so the
 * light is faded out toward the edge instead.
 */
export function RadialGlow({
  size,
  color,
  opacity = 0.3,
  style,
}: {
  size: number;
  color: string;
  opacity?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const gradientId = `glow-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;

  return (
    <View
      pointerEvents="none"
      style={[
        { position: 'absolute', width: size, height: size },
        style,
      ]}
    >
      <Svg width={size} height={size}>
        <Defs>
          <RadialGradient id={gradientId} cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={color} stopOpacity={opacity} />
            <Stop offset="55%" stopColor={color} stopOpacity={opacity * 0.45} />
            <Stop offset="100%" stopColor={color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={size / 2}
          fill={`url(#${gradientId})`}
        />
      </Svg>
    </View>
  );
}

/**
 * Section heading with deliberately balanced line breaks.
 *
 * Passing an array renders each entry on its own line, which stops short
 * headings from wrapping into awkward orphans on narrow phones.
 */
export function SectionHeading({ title }: { title: string | readonly string[] }) {
  const { width } = useWindowDimensions();
  const lines = typeof title === 'string' ? [title] : title;
  const fontSize = width < 360 ? 21 : 24;
  const lineHeight = Math.round(fontSize * 1.3);

  return (
    <View
      accessible
      accessibilityRole="header"
      accessibilityLabel={lines.join(' ')}
      style={sectionHeadingStyles.wrap}
    >
      {lines.map((line) => (
        <Text
          key={line}
          style={[sectionHeadingStyles.text, { fontSize, lineHeight }]}
        >
          {line}
        </Text>
      ))}
    </View>
  );
}

const sectionHeadingStyles = {
  wrap: {
    alignItems: 'center' as const,
  },
  text: {
    fontWeight: '800' as const,
    color: L.text,
    textAlign: 'center' as const,
    letterSpacing: -0.5,
  },
};

/** Small uppercase section label. */
export function SectionKicker({ children }: { children: string }) {
  return (
    <View style={sectionKickerStyles.wrap}>
      <View style={sectionKickerStyles.dot} />
      <Text style={sectionKickerStyles.text}>{children}</Text>
    </View>
  );
}

const sectionKickerStyles = {
  wrap: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    alignSelf: 'center' as const,
    gap: 7,
    marginBottom: 10,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: L.lavender,
  },
  text: {
    fontSize: 11,
    fontWeight: '700' as const,
    letterSpacing: 1.4,
    color: L.lavender,
    textTransform: 'uppercase' as const,
  },
};
