import React from 'react';
import { Text, View, TextStyle, ViewStyle } from 'react-native';
import { Colors } from '../constants/colors';

interface GradientTextProps {
  children: React.ReactNode;
  style?: TextStyle;
  containerStyle?: ViewStyle;
  /** Kept for API compatibility; the monochrome theme renders solid text. */
  gradientColors?: string[];
}

/**
 * Highlighted headline text.
 *
 * The previous multi-stop gradient is intentionally gone: the design system is
 * monochrome, so emphasis comes from weight and colour contrast instead.
 */
export function GradientText({ children, style, containerStyle }: GradientTextProps) {
  return (
    <View style={[styles.container, containerStyle]}>
      <Text style={[styles.text, style, { color: Colors.textPrimary }]}>
        {children}
      </Text>
    </View>
  );
}

const styles = {
  container: {
    display: 'flex',
  } as ViewStyle,
  text: {
    fontWeight: '800',
  } as TextStyle,
};
