import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { Colors } from '../constants/colors';

interface IconProps {
  name:
    | 'link'
    | 'qr'
    | 'sparkles'
    | 'check'
    | 'copy'
    | 'external'
    | 'logout'
    | 'arrow-left'
    | 'arrow-right'
    | 'mail'
    | 'lock'
    | 'eye'
    | 'eye-off'
    | 'plus'
    | 'chart'
    | 'user'
    | 'shield'
    | 'play'
    | 'download'
    | 'menu'
    | 'x';
  size?: number;
  color?: string;
  style?: ViewStyle;
}

export const AppIcon: React.FC<IconProps> = ({
  name,
  size = 24,
  color = Colors.accent,
  style,
}) => {
  const s = size;
  const stroke = Math.max(1.8, Math.round(s / 10));

  const renderIcon = () => {
    switch (name) {
      case 'link':
        return (
          <View style={[styles.center, { width: s, height: s }]}>
            <View
              style={{
                position: 'absolute',
                width: s * 0.55,
                height: s * 0.35,
                borderRadius: s * 0.2,
                borderWidth: stroke,
                borderColor: color,
                transform: [
                  { rotate: '-45deg' },
                  { translateX: -s * 0.12 },
                  { translateY: -s * 0.12 },
                ],
              }}
            />
            <View
              style={{
                position: 'absolute',
                width: s * 0.55,
                height: s * 0.35,
                borderRadius: s * 0.2,
                borderWidth: stroke,
                borderColor: color,
                transform: [
                  { rotate: '-45deg' },
                  { translateX: s * 0.12 },
                  { translateY: s * 0.12 },
                ],
              }}
            />
          </View>
        );

      case 'qr':
        return (
          <View style={[styles.center, { width: s, height: s }]}>
            <View
              style={{
                position: 'absolute',
                top: s * 0.1,
                left: s * 0.1,
                width: s * 0.36,
                height: s * 0.36,
                borderWidth: stroke,
                borderColor: color,
                borderRadius: 3,
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <View style={{ width: s * 0.14, height: s * 0.14, backgroundColor: color, borderRadius: 1 }} />
            </View>
            <View
              style={{
                position: 'absolute',
                top: s * 0.1,
                right: s * 0.1,
                width: s * 0.36,
                height: s * 0.36,
                borderWidth: stroke,
                borderColor: color,
                borderRadius: 3,
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <View style={{ width: s * 0.14, height: s * 0.14, backgroundColor: color, borderRadius: 1 }} />
            </View>
            <View
              style={{
                position: 'absolute',
                bottom: s * 0.1,
                left: s * 0.1,
                width: s * 0.36,
                height: s * 0.36,
                borderWidth: stroke,
                borderColor: color,
                borderRadius: 3,
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <View style={{ width: s * 0.14, height: s * 0.14, backgroundColor: color, borderRadius: 1 }} />
            </View>
            <View
              style={{
                position: 'absolute',
                bottom: s * 0.12,
                right: s * 0.12,
                width: s * 0.12,
                height: s * 0.12,
                backgroundColor: color,
                borderRadius: 1,
              }}
            />
            <View
              style={{
                position: 'absolute',
                bottom: s * 0.3,
                right: s * 0.28,
                width: s * 0.1,
                height: s * 0.1,
                backgroundColor: color,
                borderRadius: 1,
              }}
            />
          </View>
        );

      case 'sparkles':
        return (
          <View style={[styles.center, { width: s, height: s }]}>
            <View
              style={{
                width: s * 0.5,
                height: s * 0.5,
                backgroundColor: color,
                borderRadius: 2,
                transform: [{ rotate: '45deg' }],
              }}
            />
            <View
              style={{
                position: 'absolute',
                top: s * 0.1,
                right: s * 0.1,
                width: s * 0.2,
                height: s * 0.2,
                backgroundColor: color,
                borderRadius: 1,
                transform: [{ rotate: '45deg' }],
              }}
            />
          </View>
        );

      case 'mail':
        return (
          <View
            style={[
              styles.center,
              {
                width: s,
                height: s * 0.75,
                borderWidth: stroke,
                borderColor: color,
                borderRadius: 4,
                overflow: 'hidden',
              },
            ]}
          >
            <View
              style={{
                width: s * 0.7,
                height: s * 0.7,
                borderWidth: stroke,
                borderColor: color,
                transform: [{ rotate: '45deg' }, { translateY: -s * 0.3 }],
              }}
            />
          </View>
        );

      case 'lock':
        return (
          <View style={[styles.center, { width: s, height: s }]}>
            <View
              style={{
                width: s * 0.44,
                height: s * 0.45,
                borderTopLeftRadius: s * 0.22,
                borderTopRightRadius: s * 0.22,
                borderWidth: stroke,
                borderColor: color,
                borderBottomWidth: 0,
                marginBottom: -1,
              }}
            />
            <View
              style={{
                width: s * 0.65,
                height: s * 0.45,
                backgroundColor: 'transparent',
                borderWidth: stroke,
                borderColor: color,
                borderRadius: 4,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <View style={{ width: stroke * 1.5, height: stroke * 2, backgroundColor: color, borderRadius: 1 }} />
            </View>
          </View>
        );

      case 'eye':
        return (
          <View
            style={[
              styles.center,
              {
                width: s * 0.9,
                height: s * 0.55,
                borderRadius: s * 0.5,
                borderWidth: stroke,
                borderColor: color,
              },
            ]}
          >
            <View
              style={{ width: s * 0.26, height: s * 0.26, borderRadius: s * 0.13, backgroundColor: color }}
            />
          </View>
        );

      case 'eye-off':
        return (
          <View style={[styles.center, { width: s, height: s }]}>
            <View
              style={{
                width: s * 0.85,
                height: s * 0.5,
                borderRadius: s * 0.5,
                borderWidth: stroke,
                borderColor: color,
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <View style={{ width: s * 0.2, height: s * 0.2, borderRadius: s * 0.1, backgroundColor: color }} />
            </View>
            <View
              style={{
                position: 'absolute',
                width: s * 0.9,
                height: stroke,
                backgroundColor: color,
                transform: [{ rotate: '-45deg' }],
              }}
            />
          </View>
        );

      case 'arrow-left':
        return (
          <View style={[styles.center, { width: s, height: s }]}>
            <View
              style={{
                position: 'absolute',
                width: s * 0.65,
                height: stroke,
                backgroundColor: color,
                left: s * 0.15,
                borderRadius: stroke / 2,
              }}
            />
            <View
              style={{
                position: 'absolute',
                left: s * 0.15,
                width: s * 0.35,
                height: stroke,
                backgroundColor: color,
                borderRadius: stroke / 2,
                transform: [{ rotate: '-40deg' }, { translateY: -s * 0.1 }],
              }}
            />
            <View
              style={{
                position: 'absolute',
                left: s * 0.15,
                width: s * 0.35,
                height: stroke,
                backgroundColor: color,
                borderRadius: stroke / 2,
                transform: [{ rotate: '40deg' }, { translateY: s * 0.1 }],
              }}
            />
          </View>
        );

      case 'arrow-right':
        return (
          <View style={[styles.center, { width: s, height: s }]}>
            <View
              style={{
                position: 'absolute',
                width: s * 0.65,
                height: stroke,
                backgroundColor: color,
                left: s * 0.15,
                borderRadius: stroke / 2,
              }}
            />
            <View
              style={{
                position: 'absolute',
                left: s * 0.5,
                width: s * 0.35,
                height: stroke,
                backgroundColor: color,
                borderRadius: stroke / 2,
                transform: [{ rotate: '-40deg' }, { translateY: -s * 0.1 }],
              }}
            />
            <View
              style={{
                position: 'absolute',
                left: s * 0.5,
                width: s * 0.35,
                height: stroke,
                backgroundColor: color,
                borderRadius: stroke / 2,
                transform: [{ rotate: '40deg' }, { translateY: s * 0.1 }],
              }}
            />
          </View>
        );

      case 'play':
        return (
          <View style={[styles.center, { width: s, height: s }]}>
            <View
              style={{
                width: 0,
                height: 0,
                backgroundColor: 'transparent',
                borderStyle: 'solid',
                borderLeftWidth: s * 0.6,
                borderTopWidth: s * 0.35,
                borderBottomWidth: s * 0.35,
                borderLeftColor: color,
                borderTopColor: 'transparent',
                borderBottomColor: 'transparent',
              }}
            />
          </View>
        );

      case 'copy':
        return (
          <View style={[styles.center, { width: s, height: s }]}>
            <View
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: s * 0.75,
                height: s * 0.75,
                borderWidth: stroke,
                borderColor: color,
                borderRadius: 3,
              }}
            />
            <View
              style={{
                position: 'absolute',
                top: s * 0.25,
                left: s * 0.25,
                width: s * 0.75,
                height: s * 0.75,
                borderWidth: stroke,
                borderColor: color,
                borderRadius: 3,
              }}
            />
          </View>
        );

      case 'external':
        return (
          <View style={[styles.center, { width: s, height: s }]}>
            <View
              style={{
                position: 'absolute',
                width: s * 0.7,
                height: s * 0.7,
                borderWidth: stroke,
                borderColor: color,
                borderRadius: 2,
              }}
            />
            <View
              style={{
                position: 'absolute',
                left: s * 0.45,
                top: s * 0.45,
                width: s * 0.35,
                height: stroke,
                backgroundColor: color,
              }}
            />
            <View
              style={{
                position: 'absolute',
                left: s * 0.65,
                top: s * 0.2,
                width: stroke,
                height: s * 0.35,
                backgroundColor: color,
              }}
            />
          </View>
        );

      case 'download':
        return (
          <View style={[styles.center, { width: s, height: s }]}>
            <View
              style={{
                position: 'absolute',
                top: s * 0.25,
                width: stroke,
                height: s * 0.5,
                backgroundColor: color,
                alignSelf: 'center',
              }}
            />
            <View
              style={{
                position: 'absolute',
                top: s * 0.6,
                width: s * 0.4,
                height: stroke,
                backgroundColor: color,
                alignSelf: 'center',
              }}
            />
            <View
              style={{
                position: 'absolute',
                top: s * 0.3,
                left: s * 0.3,
                width: s * 0.4,
                height: s * 0.4,
                borderWidth: stroke,
                borderColor: color,
                borderRadius: 2,
              }}
            />
          </View>
        );

      case 'menu':
        return (
          <View style={[styles.center, { width: s, height: s }]}>
            <View
              style={{
                position: 'absolute',
                width: s * 0.7,
                height: stroke,
                backgroundColor: color,
                top: s * 0.25,
                borderRadius: stroke / 2,
              }}
            />
            <View
              style={{
                position: 'absolute',
                width: s * 0.7,
                height: stroke,
                backgroundColor: color,
                top: s * 0.45,
                borderRadius: stroke / 2,
              }}
            />
            <View
              style={{
                position: 'absolute',
                width: s * 0.7,
                height: stroke,
                backgroundColor: color,
                top: s * 0.65,
                borderRadius: stroke / 2,
              }}
            />
          </View>
        );

      case 'x':
        return (
          <View style={[styles.center, { width: s, height: s }]}>
            <View
              style={{
                position: 'absolute',
                width: s * 0.7,
                height: stroke,
                backgroundColor: color,
                top: s * 0.45 - stroke / 2,
                borderRadius: stroke / 2,
                transform: [{ rotate: '45deg' }],
              }}
            />
            <View
              style={{
                position: 'absolute',
                width: s * 0.7,
                height: stroke,
                backgroundColor: color,
                top: s * 0.45 - stroke / 2,
                borderRadius: stroke / 2,
                transform: [{ rotate: '-45deg' }],
              }}
            />
          </View>
        );

      case 'check':
        return (
          <View style={[styles.center, { width: s, height: s }]}>
            <View
              style={{
                width: s * 0.3,
                height: stroke,
                backgroundColor: color,
                borderRadius: stroke / 2,
                transform: [{ rotate: '45deg' }, { translateX: -s * 0.1 }, { translateY: s * 0.1 }],
              }}
            />
            <View
              style={{
                width: s * 0.6,
                height: stroke,
                backgroundColor: color,
                borderRadius: stroke / 2,
                transform: [{ rotate: '-45deg' }, { translateX: s * 0.08 }, { translateY: -s * 0.02 }],
              }}
            />
          </View>
        );

      case 'logout':
        return (
          <View style={[styles.center, { width: s, height: s }]}>
            <View
              style={{
                position: 'absolute',
                left: s * 0.15,
                width: s * 0.45,
                height: s * 0.75,
                borderWidth: stroke,
                borderColor: color,
                borderRightWidth: 0,
                borderTopLeftRadius: 3,
                borderBottomLeftRadius: 3,
              }}
            />
            <View
              style={{
                position: 'absolute',
                left: s * 0.35,
                width: s * 0.5,
                height: stroke,
                backgroundColor: color,
              }}
            />
            <View
              style={{
                position: 'absolute',
                right: s * 0.12,
                width: s * 0.25,
                height: stroke,
                backgroundColor: color,
                transform: [{ rotate: '45deg' }, { translateY: -s * 0.08 }],
              }}
            />
            <View
              style={{
                position: 'absolute',
                right: s * 0.12,
                width: s * 0.25,
                height: stroke,
                backgroundColor: color,
                transform: [{ rotate: '-45deg' }, { translateY: s * 0.08 }],
              }}
            />
          </View>
        );

      case 'plus':
        return (
          <View style={[styles.center, { width: s, height: s }]}>
            <View style={{ width: s * 0.65, height: stroke, backgroundColor: color, borderRadius: stroke / 2 }} />
            <View
              style={{
                position: 'absolute',
                width: stroke,
                height: s * 0.65,
                backgroundColor: color,
                borderRadius: stroke / 2,
              }}
            />
          </View>
        );

      case 'chart':
        return (
          <View
            style={[
              styles.center,
              {
                width: s,
                height: s,
                flexDirection: 'row',
                alignItems: 'flex-end',
                justifyContent: 'space-evenly',
                paddingBottom: s * 0.15,
              },
            ]}
          >
            <View style={{ width: s * 0.15, height: s * 0.3, backgroundColor: color, borderRadius: 2 }} />
            <View style={{ width: s * 0.15, height: s * 0.65, backgroundColor: color, borderRadius: 2 }} />
            <View style={{ width: s * 0.15, height: s * 0.45, backgroundColor: color, borderRadius: 2 }} />
          </View>
        );

      case 'user':
        return (
          <View style={[styles.center, { width: s, height: s }]}>
            <View
              style={{
                width: s * 0.38,
                height: s * 0.38,
                borderRadius: s * 0.19,
                borderWidth: stroke,
                borderColor: color,
                marginBottom: 2,
              }}
            />
            <View
              style={{
                width: s * 0.65,
                height: s * 0.3,
                borderTopLeftRadius: s * 0.3,
                borderTopRightRadius: s * 0.3,
                borderWidth: stroke,
                borderColor: color,
                borderBottomWidth: 0,
              }}
            />
          </View>
        );

      case 'shield':
      default:
        return (
          <View
            style={[
              styles.center,
              {
                width: s * 0.7,
                height: s * 0.8,
                borderWidth: stroke,
                borderColor: color,
                borderBottomLeftRadius: s * 0.35,
                borderBottomRightRadius: s * 0.35,
                borderTopLeftRadius: 4,
                borderTopRightRadius: 4,
              },
            ]}
          >
            <View style={{ width: stroke * 1.5, height: stroke * 1.5, backgroundColor: color, borderRadius: 1 }} />
          </View>
        );
    }
  };

  return <View style={style}>{renderIcon()}</View>;
};

const styles = StyleSheet.create({
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});
