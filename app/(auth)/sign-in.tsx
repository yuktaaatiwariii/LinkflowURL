import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSignIn } from '@clerk/expo/legacy';
import { Colors } from '../../src/constants/colors';
import { CustomButton, CustomInput, AlertBanner, AppIcon, ResponsiveContainer } from '../../src/components';
import { useIsDesktop } from '../../src/hooks/useBreakpoint';

export default function SignInScreen() {
  const router = useRouter();
  const { signIn, setActive, isLoaded } = useSignIn();
  const isDesktop = useIsDesktop();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  const validate = () => {
    const newErrors: { email?: string; password?: string } = {};
    if (!email.trim()) {
      newErrors.email = 'Email address is required.';
    } else if (!/\S+@\S+\.\S+/.test(email.trim())) {
      newErrors.email = 'Please enter a valid email address.';
    }

    if (!password) {
      newErrors.password = 'Password is required.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const onSignInPress = async () => {
    setErrorMessage('');
    if (!validate()) return;
    if (!isLoaded || !signIn || !setActive) return;

    setLoading(true);
    try {
      const signInAttempt = await signIn.create({
        identifier: email.trim(),
        password,
      });

      if (signInAttempt.status === 'complete') {
        await setActive({ session: signInAttempt.createdSessionId });
        router.replace('/(protected)' as any);
      } else {
        setErrorMessage(`Additional authentication required: ${signInAttempt.status}`);
      }
    } catch (err: any) {
      console.error('Sign In Error:', err);
      const msg =
        err?.errors?.[0]?.longMessage ||
        err?.errors?.[0]?.message ||
        err?.message ||
        'Unable to sign in. Please verify your credentials.';
      setErrorMessage(msg);
    } finally {
      setLoading(false);
    }
  };

  const formWidth = isDesktop ? 420 : '100%';

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.background} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { alignItems: 'center' }]}
          keyboardShouldPersistTaps="handled"
        >
          <ResponsiveContainer padding={24} centerOnDesktop={isDesktop}>
            {/* Top navigation row */}
            <TouchableOpacity
              style={styles.backBtn}
              onPress={() => router.back()}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <AppIcon name="arrow-left" size={20} color={Colors.textSecondary} />
            </TouchableOpacity>

            {/* Header */}
            <View style={styles.header}>
              <View style={styles.logoBadge}>
                <AppIcon name="link" size={26} color={Colors.accentLight} />
              </View>
              <Text style={styles.title}>Welcome Back</Text>
              <Text style={styles.subtitle}>Sign in to continue to LinkFlow URL.</Text>
            </View>

            {/* Alert Error */}
            {!!errorMessage && <AlertBanner type="error" message={errorMessage} />}

            {/* Form */}
            <View style={[styles.form, { width: formWidth, alignSelf: isDesktop ? 'center' : 'stretch' }]}>
              <CustomInput
                label="Email Address"
                placeholder="alex@example.com"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoComplete="email"
                autoCapitalize="none"
                error={errors.email}
                icon={<AppIcon name="mail" size={18} color={Colors.textSecondary} />}
              />

              <CustomInput
                label="Password"
                placeholder="••••••••"
                value={password}
                onChangeText={setPassword}
                isPassword
                error={errors.password}
                icon={<AppIcon name="lock" size={18} color={Colors.textSecondary} />}
              />

              {/* Forgot Password */}
              <TouchableOpacity
                onPress={() => router.push('/(auth)/forgot-password' as any)}
                style={styles.forgotBtn}
              >
                <Text style={styles.forgotText}>Forgot password?</Text>
              </TouchableOpacity>

              {/* Sign In Button */}
              <CustomButton
                title="Sign In"
                size="lg"
                variant="primary"
                loading={loading}
                onPress={onSignInPress}
                fullWidth
              />
            </View>

            {/* Footer Navigation */}
            <View style={styles.footerRow}>
              <Text style={styles.footerPrompt}>Don&apos;t have an account?</Text>
              <TouchableOpacity onPress={() => router.push('/(auth)/sign-up' as any)}>
                <Text style={styles.footerLink}>Create Account</Text>
              </TouchableOpacity>
            </View>
          </ResponsiveContainer>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 22,
    paddingTop: 16,
    paddingBottom: 36,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    alignSelf: 'flex-start',
  },
  header: {
    marginBottom: 28,
    alignItems: 'center',
  },
  logoBadge: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: Colors.surfaceSecondary,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  title: {
    fontSize: 30,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    color: Colors.textSecondary,
    lineHeight: 22,
    textAlign: 'center',
  },
  form: {
    marginBottom: 28,
  },
  forgotBtn: {
    alignSelf: 'flex-end',
    marginBottom: 24,
    marginTop: 4,
  },
  forgotText: {
    color: Colors.accent,
    fontSize: 14,
    fontWeight: '600',
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  footerPrompt: {
    color: Colors.textSecondary,
    fontSize: 14,
  },
  footerLink: {
    color: Colors.accentLight,
    fontSize: 14,
    fontWeight: '700',
  },
});
