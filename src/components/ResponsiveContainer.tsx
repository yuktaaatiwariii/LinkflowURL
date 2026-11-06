import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { Colors } from '../constants/colors';
import { useBreakpoint, getContainerWidth } from '../hooks/useBreakpoint';

interface ResponsiveContainerProps {
  children: React.ReactNode;
  style?: ViewStyle;
  padding?: number;
  centerOnDesktop?: boolean;
}

export function ResponsiveContainer({
  children,
  style,
  padding = 20,
  centerOnDesktop = true,
}: ResponsiveContainerProps) {
  const breakpoint = useBreakpoint();
  const isDesktop = breakpoint === 'xl' || breakpoint === '2xl';
  const containerWidth = getContainerWidth(breakpoint);

  const containerStyle: ViewStyle = {
    flex: 1,
    width: isDesktop && centerOnDesktop ? containerWidth : '100%',
    alignSelf: isDesktop && centerOnDesktop ? 'center' : 'stretch',
    paddingHorizontal: isDesktop && centerOnDesktop ? 0 : padding,
    ...style,
  };

  return (
    <View style={[styles.container, containerStyle]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.background,
  },
});
