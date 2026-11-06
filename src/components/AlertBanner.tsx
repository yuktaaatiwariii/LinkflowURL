import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { Colors } from '../constants/colors';

interface AlertBannerProps {
  type: 'error' | 'success' | 'info';
  message: string;
  style?: ViewStyle;
}

export const AlertBanner: React.FC<AlertBannerProps> = ({
  type,
  message,
  style,
}) => {
  if (!message) return null;

  const getStyle = () => {
    switch (type) {
      case 'success':
        return {
          bg: Colors.successBg,
          border: Colors.success,
          text: '#86EFAC',
        };
      case 'info':
        return {
          bg: Colors.surfaceSecondary,
          border: Colors.accent,
          text: Colors.accentLight,
        };
      case 'error':
      default:
        return {
          bg: Colors.errorBg,
          border: Colors.error,
          text: '#FCA5A5',
        };
    }
  };

  const current = getStyle();

  return (
    <View
      style={[
        styles.banner,
        {
          backgroundColor: current.bg,
          borderColor: current.border,
        },
        style,
      ]}
    >
      <Text style={[styles.text, { color: current.text }]}>{message}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  banner: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 16,
    width: '100%',
  },
  text: {
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
  },
});
