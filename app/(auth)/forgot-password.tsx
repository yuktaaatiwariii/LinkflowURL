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

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const { signIn, setActive, isLoaded } = useSignIn();
  const isDesktop = useIsDesktop();

  const [step, setStep] = useState<'request' | 'reset'>('request');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const [errors, setErrors] = useState<{
    email?: string;
    code?: string;
    newPassword?: string;
    confirmPassword?: string;
  }>({});

  const onRequestCode = async () => {
    setErrorMessage('');
    setSuccessMessage('');
    if (!email.trim()) {
      setErrors({ email: 'Please enter your registered email address.' });
      return;
    }
    if (!isLoaded || !signIn) return;

    setLoading(true);
    try {
      await signIn.create({
        strategy: 'reset_password_email_code' as any,
        identifier: email.trim(),
      });
      setStep('reset');
      setSuccessMessage('A password reset code has been sent to your email.');
    } catch (err: any) {
      console.error('Password Reset Request Error:', err);
      const msg =
        err?.errors?.[0]?.longMessage ||
        err?.errors?.[0]?.message ||
        err?.message ||
        'Unable to request password reset code.';
      setErrorMessage(msg);
    } finally {
      setLoading(false);
    }
  };

  const onResetPassword = async () => {
    setErrorMessage('');
    setSuccessMessage('');
    const newErrors: typeof errors = {};

    if (!code.trim()) {
      newErrors.code = 'Please enter the verification code.';
    }
    if (!newPassword) {
      newErrors.newPassword = 'New password is required.';
    } else if (newPassword.length < 8) {
      newErrors.newPassword = 'Password must be at least 8 characters.';
    }
    if (newPassword !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match.';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    if (!isLoaded || !signIn || !setActive) return;
    setLoading(true);

    try {
      const result = await signIn.attemptFirstFactor({
        strategy: 'reset_password_email_code',
        code: code.trim(),
        password: newPassword,
      });

      if (result.status === 'complete') {
        await setActive({ session: result.createdSessionId });
        setSuccessMessage('Password successfully updated! Redirecting to dashboard...');
        setTimeout(() => {
          router.replace('/(protected)' as any);
        }, 1200);
      } else {
        setErrorMessage(`Additional reset steps required: ${result.status}`);
      }
    } catch (err: any) {
      console.error('Password Reset Attempt Error:', err);
      const msg =
        err?.errors?.[0]?.longMessage ||
        err?.errors?.[0]?.message ||
        err?.message ||
        'Failed to reset password. Please verify the code.';
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
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <ResponsiveContainer padding={24} centerOnDesktop={isDesktop}>
            {/* Back Button */}
            <TouchableOpacity
              style={styles.backBtn}
              onPress={() => {
                if (step === 'reset') {
                  setStep('request');
                } else {
                  router.back();
                }
              }}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <AppIcon name="arrow-left" size={20} color={Colors.textSecondary} />
            </TouchableOpacity>

            {/* Header */}
            <View style={styles.header}>
              <View style={styles.logoBadge}>
                <AppIcon name="lock" size={24} color={Colors.accentLight} />
              </View>
              <Text style={styles.title}>
                {step === 'request' ? 'Reset Password' : 'Create New Password'}
              </Text>
              <Text style={styles.subtitle}>
                {step === 'request'
                  ? "Enter your email address and we'll send you a recovery code."
                  : `Enter the code sent to ${email} and set your new password.`}
              </Text>
            </View>

            {/* Alerts */}
            {!!errorMessage && <AlertBanner type="error" message={errorMessage} />}
            {!!successMessage && <AlertBanner type="success" message={successMessage} />}

            {step === 'request' ? (
              /* Step 1: Request code */
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

                <CustomButton
                  title="Send Reset Code"
                  size="lg"
                  variant="primary"
                  loading={loading}
                  onPress={onRequestCode}
                  fullWidth
                />
              </View>
            ) : (
              /* Step 2: Code and new password */
              <View style={[styles.form, { width: formWidth, alignSelf: isDesktop ? 'center' : 'stretch' }]}>
                <CustomInput
                  label="Verification Code"
                  placeholder="123456"
                  value={code}
                  onChangeText={setCode}
                  keyboardType="number-pad"
                  maxLength={8}
                  error={errors.code}
                  icon={<AppIcon name="shield" size={18} color={Colors.textSecondary} />}
                />

                <CustomInput
                  label="New Password"
                  placeholder="At least 8 characters"
                  value={newPassword}
                  onChangeText={setNewPassword}
                  isPassword
                  error={errors.newPassword}
                  icon={<AppIcon name="lock" size={18} color={Colors.textSecondary} />}
                />

                <CustomInput
                  label="Confirm New Password"
                  placeholder="Re-enter new password"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  isPassword
                  error={errors.confirmPassword}
                  icon={<AppIcon name="lock" size={18} color={Colors.textSecondary} />}
                />

                <CustomButton
                  title="Set New Password"
                  size="lg"
                  variant="primary"
                  loading={loading}
                  onPress={onResetPassword}
                  fullWidth
                />
              </View>
            )}

            {/* Back to Sign In */}
            <View style={styles.footerRow}>
              <TouchableOpacity onPress={() => router.push('/(auth)/sign-in' as any)}>
                <Text style={styles.footerLink}>Return to Sign In</Text>
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
  submitBtn: {
    width: '100%',
    marginTop: 8,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  footerLink: {
    color: Colors.accentLight,
    fontSize: 14,
    fontWeight: '700',
  },
});
