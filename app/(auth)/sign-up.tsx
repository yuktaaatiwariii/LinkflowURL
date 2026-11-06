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
import { useSignUp } from '@clerk/expo/legacy';
import { Colors } from '../../src/constants/colors';
import { CustomButton, CustomInput, AlertBanner, AppIcon, ResponsiveContainer } from '../../src/components';
import { useIsDesktop } from '../../src/hooks/useBreakpoint';

export default function SignUpScreen() {
  const router = useRouter();
  const { signUp, setActive, isLoaded } = useSignUp();
  const isDesktop = useIsDesktop();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Email verification state
  const [pendingVerification, setPendingVerification] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');

  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const [errors, setErrors] = useState<{
    fullName?: string;
    email?: string;
    password?: string;
    confirmPassword?: string;
    code?: string;
  }>({});

  const validateForm = () => {
    const newErrors: typeof errors = {};

    if (!fullName.trim()) {
      newErrors.fullName = 'Full name is required.';
    }

    if (!email.trim()) {
      newErrors.email = 'Email address is required.';
    } else if (!/\S+@\S+\.\S+/.test(email.trim())) {
      newErrors.email = 'Please provide a valid email.';
    }

    if (!password) {
      newErrors.password = 'Password is required.';
    } else if (password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters.';
    }

    if (password !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const onSignUpPress = async () => {
    setErrorMessage('');
    setSuccessMessage('');
    if (!validateForm()) return;
    if (!isLoaded || !signUp) return;

    setLoading(true);
    try {
      const parts = fullName.trim().split(' ');
      const firstName = parts[0] || undefined;
      const lastName = parts.slice(1).join(' ') || undefined;

      await signUp.create({
        emailAddress: email.trim(),
        password,
        firstName,
        lastName,
      });

      // Send verification email
      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
      setPendingVerification(true);
      setSuccessMessage('A verification code has been sent to your email.');
    } catch (err: any) {
      console.error('Sign Up Error:', err);
      const msg =
        err?.errors?.[0]?.longMessage ||
        err?.errors?.[0]?.message ||
        err?.message ||
        'Unable to create account.';
      setErrorMessage(msg);
    } finally {
      setLoading(false);
    }
  };

  const onVerifyPress = async () => {
    setErrorMessage('');
    setSuccessMessage('');
    if (!verificationCode.trim()) {
      setErrors({ code: 'Please enter the verification code.' });
      return;
    }
    if (!isLoaded || !signUp || !setActive) return;

    setLoading(true);
    try {
      const completeSignUp = await signUp.attemptEmailAddressVerification({
        code: verificationCode.trim(),
      });

      if (completeSignUp.status === 'complete') {
        await setActive({ session: completeSignUp.createdSessionId });
        router.replace('/(protected)' as any);
      } else if (completeSignUp.status === 'missing_requirements') {
        const missingFields: string[] = (completeSignUp.missingFields as string[]) ?? [];

        if (missingFields.includes('first_name') || missingFields.includes('last_name')) {
          const parts = fullName.trim().split(' ');
          const firstName = parts[0] || 'User';
          const lastName = parts.slice(1).join(' ') || undefined;

          const updatedSignUp = await signUp.update({ firstName, lastName });

          if (updatedSignUp.status === 'complete') {
            await setActive({ session: updatedSignUp.createdSessionId });
            router.replace('/(protected)' as any);
          } else {
            const remaining =
              (updatedSignUp.missingFields as string[] | undefined)?.join(', ') ??
              updatedSignUp.status;
            setErrorMessage(`Registration could not complete. Still required: ${remaining}`);
          }
        } else if (missingFields.length > 0) {
          setErrorMessage(`Additional information required: ${missingFields.join(', ')}`);
        } else {
          setErrorMessage('Verification is pending. Please wait a moment and try again.');
        }
      } else {
        setErrorMessage(`Unexpected registration status: ${completeSignUp.status}. Please try again.`);
      }
    } catch (err: any) {
      console.error('Verification Error:', err);
      const msg =
        err?.errors?.[0]?.longMessage ||
        err?.errors?.[0]?.message ||
        err?.message ||
        'Invalid verification code. Please check and try again.';
      setErrorMessage(msg);
    } finally {
      setLoading(false);
    }
  };

  const onResendCode = async () => {
    if (!isLoaded || !signUp) return;
    setResending(true);
    setErrorMessage('');
    try {
      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
      setSuccessMessage('A new verification code has been sent to your email.');
    } catch (err: any) {
      const msg = err?.errors?.[0]?.message || err?.message || 'Could not resend code.';
      setErrorMessage(msg);
    } finally {
      setResending(false);
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
                if (pendingVerification) {
                  setPendingVerification(false);
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
                <AppIcon name={pendingVerification ? 'mail' : 'sparkles'} size={24} color={Colors.accentLight} />
              </View>
              <Text style={styles.title}>
                {pendingVerification ? 'Verify Your Email' : 'Create Your Account'}
              </Text>
              <Text style={styles.subtitle}>
                {pendingVerification
                  ? `Enter the 6-digit code sent to ${email}`
                  : 'Start shortening URLs and generating QR codes.'}
              </Text>
            </View>

            {/* Feedback Banners */}
            {!!errorMessage && <AlertBanner type="error" message={errorMessage} />}
            {!!successMessage && <AlertBanner type="success" message={successMessage} />}

            {!pendingVerification ? (
              /* Registration Form */
              <View style={[styles.form, { width: formWidth, alignSelf: isDesktop ? 'center' : 'stretch' }]}>
                <CustomInput
                  label="Full Name"
                  placeholder="Alex Johnson"
                  value={fullName}
                  onChangeText={setFullName}
                  autoCapitalize="words"
                  error={errors.fullName}
                  icon={<AppIcon name="user" size={18} color={Colors.textSecondary} />}
                />

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
                  placeholder="At least 8 characters"
                  value={password}
                  onChangeText={setPassword}
                  isPassword
                  error={errors.password}
                  icon={<AppIcon name="lock" size={18} color={Colors.textSecondary} />}
                />

                <CustomInput
                  label="Confirm Password"
                  placeholder="Re-enter password"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  isPassword
                  error={errors.confirmPassword}
                  icon={<AppIcon name="lock" size={18} color={Colors.textSecondary} />}
                />

                <CustomButton
                  title="Create Account"
                  size="lg"
                  variant="primary"
                  loading={loading}
                  onPress={onSignUpPress}
                  fullWidth
                />
              </View>
            ) : (
              /* Verification Form */
              <View style={[styles.form, { width: formWidth, alignSelf: isDesktop ? 'center' : 'stretch' }]}>
                <CustomInput
                  label="Verification Code"
                  placeholder="123456"
                  value={verificationCode}
                  onChangeText={setVerificationCode}
                  keyboardType="number-pad"
                  maxLength={8}
                  error={errors.code}
                  icon={<AppIcon name="shield" size={18} color={Colors.textSecondary} />}
                />

                <CustomButton
                  title="Verify & Continue"
                  size="lg"
                  variant="primary"
                  loading={loading}
                  onPress={onVerifyPress}
                  fullWidth
                />

                <View style={styles.resendContainer}>
                  <TouchableOpacity
                    onPress={onResendCode}
                    disabled={resending}
                    style={styles.resendBtn}
                  >
                    <Text style={styles.resendText}>
                      {resending ? 'Sending...' : "Didn't receive code? Resend"}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Footer Navigation */}
            {!pendingVerification && (
              <View style={styles.footerRow}>
                <Text style={styles.footerPrompt}>Already have an account?</Text>
                <TouchableOpacity onPress={() => router.push('/(auth)/sign-in' as any)}>
                  <Text style={styles.footerLink}>Sign In</Text>
                </TouchableOpacity>
              </View>
            )}
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
  resendContainer: {
    alignItems: 'center',
    marginTop: 20,
  },
  resendText: {
    color: Colors.accent,
    fontSize: 14,
    fontWeight: '600',
  },
  resendBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
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
