import React from 'react';
import { Text, View, TextStyle, ViewStyle } from 'react-native';
import { Colors } from '../constants/colors';

interface GradientTextProps {
  children: React.ReactNode;
  style?: TextStyle;
  containerStyle?: ViewStyle;
  gradientColors?: string[];
}

export function GradientText({
  children,
  style,
  containerStyle,
  gradientColors = [Colors.primary, Colors.accent],
}: GradientTextProps) {
  // On Web, we can use a linear gradient background with -webkit-background-clip
  // On mobile, we render the first part with primary color as accent
  return (
    <View style={[styles.container, containerStyle]}>
      <Text style={[styles.text, style, { color: gradientColors[1] }]}>
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
