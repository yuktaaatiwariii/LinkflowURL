import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { DevColors, DevRadius } from '../../constants/developerTheme';

export type DeveloperToastTone = 'success' | 'error' | 'info';

interface ToastState {
  id: number;
  message: string;
  tone: DeveloperToastTone;
}

interface ToastContextValue {
  showToast: (message: string, tone?: DeveloperToastTone) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useDeveloperToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useDeveloperToast must be used inside DeveloperToastProvider.');
  }
  return context;
}

export function DeveloperToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (hideTimer.current) {
      clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
  }, []);

  const showToast = useCallback(
    (message: string, tone: DeveloperToastTone = 'success') => {
      clearTimer();
      setToast({ id: Date.now(), message, tone });
      opacity.setValue(0);
      Animated.timing(opacity, {
        toValue: 1,
        duration: 160,
        useNativeDriver: true,
      }).start();

      hideTimer.current = setTimeout(() => {
        Animated.timing(opacity, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }).start(({ finished }) => {
          if (finished) setToast(null);
        });
      }, 3200);
    },
    [clearTimer, opacity]
  );

  useEffect(() => {
    return () => clearTimer();
  }, [clearTimer]);

  const tone = toast?.tone || 'success';
  const accent =
    tone === 'error' ? DevColors.danger : tone === 'info' ? DevColors.info : DevColors.success;
  const icon = tone === 'error' ? 'alert-circle' : tone === 'info' ? 'info' : 'check-circle';

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toast ? (
        <Animated.View pointerEvents="none" style={[styles.wrap, { opacity }]}>
          <View style={[styles.toast, { borderColor: `${accent}66` }]}>
            <Feather name={icon} size={16} color={accent} />
            <Text style={styles.text}>{toast.message}</Text>
          </View>
        </Animated.View>
      ) : null}
    </ToastContext.Provider>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 18,
    right: 18,
    left: 18,
    alignItems: 'center',
    zIndex: 1000,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    maxWidth: 440,
    backgroundColor: DevColors.surfaceRaised,
    borderWidth: 1,
    borderRadius: DevRadius.md,
    paddingHorizontal: 14,
    paddingVertical: 11,
    shadowColor: '#000000',
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
  text: {
    color: DevColors.text,
    fontSize: 12.5,
    fontWeight: '600',
    lineHeight: 17,
    flexShrink: 1,
  },
});
