import React from 'react';
import { View, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { Colors } from '../constants/colors';

interface SectionProps {
  children?: React.ReactNode;
  style?: ViewStyle;
  title?: string;
  titleStyle?: TextStyle;
  titleBottom?: number;
}

export function Section({
  children,
  style,
  title,
  titleStyle,
  titleBottom = 16,
}: SectionProps) {
  return (
    <View style={[styles.section, style]}>
      {title && <Text style={[styles.sectionTitle, titleStyle]}>{title}</Text>}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    width: '100%',
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 16,
  },
});
