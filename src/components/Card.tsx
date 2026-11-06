import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { Colors } from '../constants/colors';

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  variant?: 'surface' | 'secondary' | 'elevated' | 'gradient';
  padding?: number;
  borderWidth?: number;
}

export const Card: React.FC<CardProps> = ({
  children,
  style,
  variant = 'surface',
  padding = 18,
  borderWidth = 1,
}) => {
  const getBackgroundColor = () => {
    switch (variant) {
      case 'secondary':
        return Colors.surfaceSecondary;
      case 'elevated':
        return Colors.surfaceCard;
      case 'surface':
      default:
        return Colors.surface;
    }
  };

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: getBackgroundColor(),
          padding,
          borderWidth,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderColor: Colors.border,
  },
});
