import React from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  ViewStyle,
  TextStyle,
  View,
} from 'react-native';
import { Colors } from '../constants/colors';

interface CustomButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  style?: ViewStyle;
  textStyle?: TextStyle;
  fullWidth?: boolean;
  gradient?: boolean;
}

export const CustomButton: React.FC<CustomButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  icon,
  style,
  textStyle,
  fullWidth = false,
  gradient = false,
}) => {
  const getContainerStyle = (): ViewStyle => {
    const base: ViewStyle = {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 12,
      minHeight: 52,
      overflow: 'hidden',
    };

    switch (size) {
      case 'sm':
        base.paddingVertical = 8;
        base.paddingHorizontal = 14;
        base.minHeight = 44;
        break;
      case 'lg':
        base.paddingVertical = 17;
        base.paddingHorizontal = 26;
        base.minHeight = 56;
        break;
      case 'md':
      default:
        base.paddingVertical = 14;
        base.paddingHorizontal = 20;
        base.minHeight = 52;
        break;
    }

    if (fullWidth) {
      base.width = '100%';
    }

    switch (variant) {
      case 'secondary':
        base.backgroundColor = Colors.surfaceSecondary;
        base.borderWidth = 1;
        base.borderColor = Colors.border;
        break;
      case 'outline':
        base.backgroundColor = 'transparent';
        base.borderWidth = 1.5;
        base.borderColor = Colors.primary;
        break;
      case 'ghost':
        base.backgroundColor = 'transparent';
        break;
      case 'danger':
        base.backgroundColor = Colors.error;
        break;
      case 'primary':
      default:
        base.backgroundColor = gradient ? Colors.primaryDeep : Colors.primary;
        break;
    }

    if (disabled || loading) {
      base.opacity = 0.6;
    }

    return base;
  };

  const getTextStyle = (): TextStyle => {
    const base: TextStyle = {
      fontWeight: '700',
      textAlign: 'center',
    };

    switch (size) {
      case 'sm':
        base.fontSize = 13;
        break;
      case 'lg':
        base.fontSize = 17;
        break;
      case 'md':
      default:
        base.fontSize = 15;
        break;
    }

    switch (variant) {
      case 'secondary':
        base.color = Colors.textPrimary;
        break;
      case 'outline':
        base.color = Colors.primary;
        break;
      case 'ghost':
        base.color = Colors.textSecondary;
        break;
      case 'danger':
        base.color = Colors.textPrimary;
        break;
      case 'primary':
      default:
        base.color = Colors.textPrimary;
        break;
    }

    return base;
  };

  const isInteractive = !disabled && !loading;

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={isInteractive ? onPress : undefined}
      disabled={disabled || loading}
      style={[getContainerStyle(), style]}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={
            variant === 'outline' ? Colors.primary : Colors.textPrimary
          }
        />
      ) : (
        <>
          {icon && <View style={styles.iconContainer}>{icon}</View>}
          <Text style={[getTextStyle(), textStyle]}>{title}</Text>
        </>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  iconContainer: {
    marginRight: 8,
  },
});
