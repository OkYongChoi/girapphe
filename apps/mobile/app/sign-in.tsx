import { useEffect, useMemo, useState } from 'react';
import { useAuth, useSignIn, useSignUp } from '@clerk/expo';
import { useRouter } from 'expo-router';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type KeyboardTypeOptions,
  type TextInputProps,
} from 'react-native';
import { LanguageSelector } from '@/components/language-selector';
import { useMobileAuth } from '@/auth';
import { useI18n } from '@/i18n';
import type { MessageKey } from '@/i18n/catalogs';

type AuthMode = 'signIn' | 'signUp';
type SignInStage = 'credentials' | 'secondFactor' | 'resetCode' | 'newPassword';
type SignUpStage = 'credentials' | 'emailVerification';
type FactorStrategy = 'email_code' | 'phone_code' | 'totp' | 'backup_code';
type FieldName = 'email' | 'password' | 'code';
type FieldErrors = Partial<Record<FieldName, string>>;
type ClerkFailure = { code: string } | null;
type Factor = { strategy: string; safeIdentifier?: string };

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const FACTOR_ORDER: FactorStrategy[] = ['email_code', 'phone_code', 'totp', 'backup_code'];
const LTR_ISOLATE = '\u2066';
const POP_DIRECTIONAL_ISOLATE = '\u2069';
const configuredBaseUrl = process.env.EXPO_PUBLIC_APP_BASE_URL?.trim();
const appBaseUrl = configuredBaseUrl && /^https?:\/\//.test(configuredBaseUrl)
  ? configuredBaseUrl.replace(/\/$/, '')
  : 'https://www.girapphe.com';

function isolateLTR(value: string): string {
  return value ? `${LTR_ISOLATE}${value}${POP_DIRECTIONAL_ISOLATE}` : value;
}

function isSupportedFactor(strategy: string): strategy is FactorStrategy {
  return FACTOR_ORDER.includes(strategy as FactorStrategy);
}

function getFactorOptions(factors: readonly Factor[]): Array<{ strategy: FactorStrategy; destination?: string }> {
  const byStrategy = new Map<FactorStrategy, string | undefined>();
  for (const factor of factors) {
    if (isSupportedFactor(factor.strategy) && !byStrategy.has(factor.strategy)) {
      byStrategy.set(factor.strategy, factor.safeIdentifier);
    }
  }
  return FACTOR_ORDER.flatMap((strategy) =>
    byStrategy.has(strategy) ? [{ strategy, destination: byStrategy.get(strategy) }] : [],
  );
}

function errorKeyForCode(code: string | undefined, fallback: MessageKey): MessageKey {
  const normalized = code?.toLowerCase() ?? '';
  if (normalized.includes('rate') || normalized.includes('too_many')) return 'auth.error.rateLimited';
  if (normalized.includes('captcha')) return 'auth.error.captcha';
  if (normalized.includes('network') || normalized.includes('offline')) return 'auth.error.network';
  if (normalized.includes('expired')) return 'auth.error.codeExpired';
  if (normalized.includes('code') || normalized.includes('verification')) return 'auth.error.codeInvalid';
  if (normalized.includes('pwned') || normalized.includes('password_length') || normalized.includes('password_size') || normalized.includes('password_strength')) {
    return 'auth.error.passwordRequirements';
  }
  if (normalized.includes('identifier_exists') || normalized.includes('already_exists') || normalized.includes('email_address_taken')) {
    return 'auth.error.emailInUse';
  }
  if (normalized.includes('identifier_not_found') || normalized.includes('password_incorrect') || normalized.includes('credentials')) {
    return 'auth.error.credentials';
  }
  if (normalized.includes('password')) return 'auth.error.passwordRequirements';
  return fallback;
}

function fieldForError(code: string | undefined, fallback?: FieldName): FieldName | undefined {
  const normalized = code?.toLowerCase() ?? '';
  if (normalized.includes('code') || normalized.includes('verification')) return 'code';
  if (normalized.includes('password')) return 'password';
  if (normalized.includes('email') || normalized.includes('identifier')) return 'email';
  return fallback;
}

type AuthFieldProps = Pick<
  TextInputProps,
  'autoCapitalize' | 'autoComplete' | 'autoCorrect' | 'maxLength' | 'secureTextEntry' | 'textContentType'
> & {
  disabled: boolean;
  error?: string;
  forceLTR?: boolean;
  isRTL: boolean;
  keyboardType?: KeyboardTypeOptions;
  label: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  value: string;
};

function AuthField({ disabled, error, forceLTR = false, isRTL, keyboardType, label, ...inputProps }: AuthFieldProps) {
  const logicalText = isRTL ? styles.rtlText : styles.ltrText;
  return (
    <View style={styles.field}>
      <Text style={[styles.label, logicalText]}>{label}</Text>
      <TextInput
        {...inputProps}
        accessibilityLabel={label}
        accessibilityState={{ disabled }}
        editable={!disabled}
        keyboardType={keyboardType}
        placeholderTextColor="#94a3b8"
        style={[styles.input, forceLTR ? styles.ltrText : logicalText, error ? styles.inputError : null]}
      />
      {error ? (
        <Text accessibilityLiveRegion="polite" style={[styles.fieldError, logicalText]}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

type PrimaryButtonProps = {
  busy: boolean;
  disabled: boolean;
  label: string;
  loadingLabel: string;
  onPress: () => void;
};

function PrimaryButton({ busy, disabled, label, loadingLabel, onPress }: PrimaryButtonProps) {
  return (
    <Pressable
      accessibilityLabel={busy ? loadingLabel : label}
      accessibilityRole="button"
      accessibilityState={{ busy, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.primaryButton, disabled && styles.disabled, pressed && !disabled && styles.pressed]}
    >
      {busy ? <ActivityIndicator accessibilityLabel={loadingLabel} color="#ffffff" /> : null}
      <Text style={styles.primaryButtonText}>{busy ? loadingLabel : label}</Text>
    </Pressable>
  );
}

type TextButtonProps = {
  disabled?: boolean;
  label: string;
  onPress: () => void;
};

function TextButton({ disabled = false, label, onPress }: TextButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.textButton, disabled && styles.disabled, pressed && !disabled && styles.pressed]}
    >
      <Text style={styles.textButtonText}>{label}</Text>
    </Pressable>
  );
}

export default function SignInScreen() {
  const auth = useMobileAuth();
  const router = useRouter();
  const { direction, isRTL, t } = useI18n();
  const logicalText = isRTL ? styles.rtlText : styles.ltrText;

  if (auth.configured) return <ConfiguredSignInScreen />;

  return (
    <SafeAreaView style={[styles.safeArea, { direction }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.topBar}>
          <Text style={styles.brand}>Girapphe</Text>
          <View style={styles.topActions}>
            <LanguageSelector />
            <Pressable
              accessibilityLabel={t('common.close')}
              accessibilityRole="button"
              onPress={() => router.back()}
              style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}
            >
              <Text style={styles.closeButtonText}>{t('common.close')}</Text>
            </Pressable>
          </View>
        </View>
        <View style={styles.card}>
          <View style={styles.headingBlock}>
            <Text accessibilityRole="header" style={[styles.title, logicalText]}>{t('auth.mobileNotConfiguredTitle')}</Text>
            <Text style={[styles.copy, logicalText]}>{t('auth.mobileNotConfiguredCopy')}</Text>
          </View>
          <PrimaryButton
            busy={false}
            disabled={false}
            label={t('auth.continueGuest')}
            loadingLabel={t('auth.submitting')}
            onPress={() => router.replace('/(tabs)/practice')}
          />
          <TextButton
            label={t('auth.signUpWeb')}
            onPress={() => void Linking.openURL(`${appBaseUrl}/signup`)}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function ConfiguredSignInScreen() {
  const { isLoaded: isAuthLoaded, isSignedIn } = useAuth({ treatPendingAsSignedOut: false });
  const { fetchStatus: signInFetchStatus, signIn } = useSignIn();
  const { fetchStatus: signUpFetchStatus, signUp } = useSignUp();
  const router = useRouter();
  const { direction, isRTL, locale, t } = useI18n();
  const [mode, setMode] = useState<AuthMode>('signIn');
  const [signInStage, setSignInStage] = useState<SignInStage>('credentials');
  const [signUpStage, setSignUpStage] = useState<SignUpStage>('credentials');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [selectedFactor, setSelectedFactor] = useState<FactorStrategy | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  useEffect(() => {
    if (isSignedIn) router.replace('/(tabs)/account');
  }, [isSignedIn, router]);

  const factorOptions = useMemo(
    () => getFactorOptions(signIn?.supportedSecondFactors ?? []),
    [signIn?.supportedSecondFactors],
  );
  const selectedFactorOption = factorOptions.find((option) => option.strategy === selectedFactor);
  const hookBusy = signInFetchStatus === 'fetching' || signUpFetchStatus === 'fetching';
  const busy = working || hookBusy;
  const logicalText = isRTL ? styles.rtlText : styles.ltrText;
  const isClientTrust = signIn?.status === 'needs_client_trust';

  function resetFeedback() {
    setFieldErrors({});
    setFormError(null);
    setNotice(null);
  }

  function showFailure(error: ClerkFailure, fallback: MessageKey, fallbackField?: FieldName) {
    const codeValue = error?.code;
    const key = errorKeyForCode(codeValue, fallback);
    const message = t(key);
    const field = fieldForError(codeValue, fallbackField);
    if (field) setFieldErrors((current) => ({ ...current, [field]: message }));
    else setFormError(message);
  }

  async function finalizeSignIn(): Promise<boolean> {
    const { error } = await signIn.finalize();
    if (error) {
      showFailure(error, 'auth.error.generic');
      return false;
    }
    router.replace('/');
    return true;
  }

  async function finalizeSignUp(): Promise<boolean> {
    const { error } = await signUp.finalize();
    if (error) {
      showFailure(error, 'auth.error.generic');
      return false;
    }
    router.replace('/');
    return true;
  }

  async function submitSignIn() {
    resetFeedback();
    const normalizedEmail = email.trim().toLowerCase();
    const nextErrors: FieldErrors = {};
    if (!normalizedEmail) nextErrors.email = t('auth.error.emailRequired');
    else if (!EMAIL_PATTERN.test(normalizedEmail)) nextErrors.email = t('auth.error.emailInvalid');
    if (!password) nextErrors.password = t('auth.error.passwordRequired');
    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      return;
    }

    setWorking(true);
    try {
      const { error } = await signIn.password({ emailAddress: normalizedEmail, password });
      if (error) {
        showFailure(error, 'auth.error.credentials');
        return;
      }
      if (signIn.status === 'complete') {
        await finalizeSignIn();
        return;
      }
      if (signIn.status === 'needs_second_factor' || signIn.status === 'needs_client_trust') {
        const options = getFactorOptions(signIn.supportedSecondFactors);
        if (options.length === 0) {
          setFormError(t('auth.error.unsupportedFactor'));
          return;
        }
        setSelectedFactor(null);
        setCode('');
        setSignInStage('secondFactor');
        return;
      }
      setFormError(t('auth.error.unsupportedRequirements'));
    } catch {
      setFormError(t('auth.error.network'));
    } finally {
      setWorking(false);
    }
  }

  async function beginPasswordReset() {
    resetFeedback();
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      setFieldErrors({ email: t('auth.error.emailRequired') });
      return;
    }
    if (!EMAIL_PATTERN.test(normalizedEmail)) {
      setFieldErrors({ email: t('auth.error.emailInvalid') });
      return;
    }

    setWorking(true);
    try {
      await signIn.reset();
      const createResult = await signIn.create({ identifier: normalizedEmail });
      if (createResult.error) {
        setFormError(t('auth.error.resetUnavailable'));
        return;
      }
      const sendResult = await signIn.resetPasswordEmailCode.sendCode();
      if (sendResult.error) {
        setFormError(t('auth.error.resetUnavailable'));
        return;
      }
      setCode('');
      setSignInStage('resetCode');
      setNotice(t('auth.codeSent'));
    } catch {
      setFormError(t('auth.error.network'));
    } finally {
      setWorking(false);
    }
  }

  async function verifyPasswordResetCode() {
    resetFeedback();
    const normalizedCode = code.trim();
    if (!normalizedCode) {
      setFieldErrors({ code: t('auth.error.codeRequired') });
      return;
    }

    setWorking(true);
    try {
      const { error } = await signIn.resetPasswordEmailCode.verifyCode({ code: normalizedCode });
      if (error) {
        showFailure(error, 'auth.error.codeInvalid', 'code');
        return;
      }
      if (signIn.status === 'needs_new_password') {
        setPassword('');
        setCode('');
        setSignInStage('newPassword');
        return;
      }
      setFormError(t('auth.error.resetUnavailable'));
    } catch {
      setFormError(t('auth.error.network'));
    } finally {
      setWorking(false);
    }
  }

  async function submitNewPassword() {
    resetFeedback();
    if (!password) {
      setFieldErrors({ password: t('auth.error.passwordRequired') });
      return;
    }

    setWorking(true);
    try {
      const { error } = await signIn.resetPasswordEmailCode.submitPassword({ password });
      if (error) {
        showFailure(error, 'auth.error.passwordRequirements', 'password');
        return;
      }
      if (signIn.status === 'complete') {
        await finalizeSignIn();
        return;
      }
      setFormError(t('auth.error.resetUnavailable'));
    } catch {
      setFormError(t('auth.error.network'));
    } finally {
      setWorking(false);
    }
  }

  async function submitSignUp() {
    resetFeedback();
    const normalizedEmail = email.trim().toLowerCase();
    const nextErrors: FieldErrors = {};
    if (!normalizedEmail) nextErrors.email = t('auth.error.emailRequired');
    else if (!EMAIL_PATTERN.test(normalizedEmail)) nextErrors.email = t('auth.error.emailInvalid');
    if (!password) nextErrors.password = t('auth.error.passwordRequired');
    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      return;
    }

    setWorking(true);
    try {
      const { error } = await signUp.password({ emailAddress: normalizedEmail, locale, password });
      if (error) {
        showFailure(error, 'auth.error.generic');
        return;
      }
      if (signUp.status === 'complete') {
        await finalizeSignUp();
        return;
      }
      if (signUp.unverifiedFields.includes('email_address')) {
        const sendResult = await signUp.verifications.sendEmailCode();
        if (sendResult.error) {
          showFailure(sendResult.error, 'auth.error.generic');
          return;
        }
        setCode('');
        setSignUpStage('emailVerification');
        return;
      }
      setFormError(t('auth.error.unsupportedRequirements'));
    } catch {
      setFormError(t('auth.error.network'));
    } finally {
      setWorking(false);
    }
  }

  async function chooseFactor(strategy: FactorStrategy) {
    resetFeedback();
    setWorking(true);
    try {
      let failure: ClerkFailure = null;
      if (strategy === 'email_code') failure = (await signIn.mfa.sendEmailCode()).error;
      if (strategy === 'phone_code') failure = (await signIn.mfa.sendPhoneCode()).error;
      if (failure) {
        showFailure(failure, 'auth.error.generic');
        return;
      }
      setSelectedFactor(strategy);
      setCode('');
      if (strategy === 'email_code' || strategy === 'phone_code') setNotice(t('auth.codeSent'));
    } catch {
      setFormError(t('auth.error.network'));
    } finally {
      setWorking(false);
    }
  }

  async function verifySecondFactor() {
    resetFeedback();
    if (!selectedFactor) {
      setFormError(t('auth.error.chooseFactor'));
      return;
    }
    const normalizedCode = code.trim();
    if (!normalizedCode) {
      setFieldErrors({ code: t('auth.error.codeRequired') });
      return;
    }

    setWorking(true);
    try {
      let failure: ClerkFailure;
      if (selectedFactor === 'email_code') failure = (await signIn.mfa.verifyEmailCode({ code: normalizedCode })).error;
      else if (selectedFactor === 'phone_code') failure = (await signIn.mfa.verifyPhoneCode({ code: normalizedCode })).error;
      else if (selectedFactor === 'totp') failure = (await signIn.mfa.verifyTOTP({ code: normalizedCode })).error;
      else failure = (await signIn.mfa.verifyBackupCode({ code: normalizedCode })).error;

      if (failure) {
        showFailure(failure, 'auth.error.codeInvalid', 'code');
        return;
      }
      if (signIn.status === 'complete') {
        await finalizeSignIn();
        return;
      }
      setFormError(t('auth.error.unsupportedRequirements'));
    } catch {
      setFormError(t('auth.error.network'));
    } finally {
      setWorking(false);
    }
  }

  async function verifySignUpEmail() {
    resetFeedback();
    const normalizedCode = code.trim();
    if (!normalizedCode) {
      setFieldErrors({ code: t('auth.error.codeRequired') });
      return;
    }

    setWorking(true);
    try {
      const { error } = await signUp.verifications.verifyEmailCode({ code: normalizedCode });
      if (error) {
        showFailure(error, 'auth.error.codeInvalid', 'code');
        return;
      }
      if (signUp.status === 'complete') {
        await finalizeSignUp();
        return;
      }
      setFormError(t('auth.error.unsupportedRequirements'));
    } catch {
      setFormError(t('auth.error.network'));
    } finally {
      setWorking(false);
    }
  }

  async function resendCode() {
    resetFeedback();
    setWorking(true);
    try {
      let failure: ClerkFailure = null;
      if (mode === 'signUp') failure = (await signUp.verifications.sendEmailCode()).error;
      else if (signInStage === 'resetCode') failure = (await signIn.resetPasswordEmailCode.sendCode()).error;
      else if (selectedFactor === 'email_code') failure = (await signIn.mfa.sendEmailCode()).error;
      else if (selectedFactor === 'phone_code') failure = (await signIn.mfa.sendPhoneCode()).error;
      if (failure) {
        showFailure(failure, 'auth.error.generic');
        return;
      }
      setNotice(t('auth.codeResent'));
    } catch {
      setFormError(t('auth.error.network'));
    } finally {
      setWorking(false);
    }
  }

  function clearFormState() {
    setSignInStage('credentials');
    setSignUpStage('credentials');
    setEmail('');
    setPassword('');
    setCode('');
    setSelectedFactor(null);
    resetFeedback();
  }

  async function startOver() {
    if (busy) return;
    setWorking(true);
    try {
      if (mode === 'signIn') await signIn.reset();
      else await signUp.reset();
      clearFormState();
    } finally {
      setWorking(false);
    }
  }

  async function switchMode(nextMode: AuthMode) {
    if (nextMode === mode || busy) return;
    setWorking(true);
    try {
      await Promise.all([signIn.reset(), signUp.reset()]);
      clearFormState();
      setMode(nextMode);
    } finally {
      setWorking(false);
    }
  }

  if (!isAuthLoaded || !signIn || !signUp) {
    return (
      <SafeAreaView style={[styles.loadingScreen, { direction }]}>
        <ActivityIndicator accessibilityLabel={t('auth.loading')} color="#2563eb" size="large" />
        <Text style={[styles.loadingText, logicalText]}>{t('auth.loading')}</Text>
      </SafeAreaView>
    );
  }

  const showSignInFactors = mode === 'signIn' && signInStage === 'secondFactor';
  const showPasswordResetCode = mode === 'signIn' && signInStage === 'resetCode';
  const showNewPassword = mode === 'signIn' && signInStage === 'newPassword';
  const showSignUpVerification = mode === 'signUp' && signUpStage === 'emailVerification';
  const title = showSignInFactors
    ? t(isClientTrust ? 'auth.clientTrustTitle' : 'auth.secondFactorTitle')
    : showPasswordResetCode
      ? t('auth.resetCodeTitle')
      : showNewPassword
        ? t('auth.newPasswordTitle')
    : showSignUpVerification
      ? t('auth.verificationTitle')
      : t(mode === 'signIn' ? 'auth.signInTitle' : 'auth.signUpTitle');
  const copy = showSignInFactors
    ? t(isClientTrust ? 'auth.clientTrustCopy' : 'auth.secondFactorCopy')
    : showPasswordResetCode
      ? t('auth.resetCodeCopy', { email: isolateLTR(signIn.identifier ?? email.trim()) })
      : showNewPassword
        ? t('auth.newPasswordCopy')
    : showSignUpVerification
      ? t('auth.verificationEmailCopy', { email: isolateLTR(signUp.emailAddress ?? email.trim()) })
      : t(mode === 'signIn' ? 'auth.signInCopy' : 'auth.signUpCopy');

  return (
    <SafeAreaView style={[styles.safeArea, { direction }]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.topBar}>
            <Text style={styles.brand}>Girapphe</Text>
            <View style={styles.topActions}>
              <LanguageSelector />
              <Pressable
                accessibilityLabel={t('common.close')}
                accessibilityRole="button"
                onPress={() => router.back()}
                style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}
              >
                <Text style={styles.closeButtonText}>{t('common.close')}</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.card}>
            <View style={styles.headingBlock}>
              <Text accessibilityRole="header" style={[styles.title, logicalText]}>{title}</Text>
              <Text style={[styles.copy, logicalText]}>{copy}</Text>
            </View>

            {showSignInFactors ? (
              <View style={styles.form}>
                <Text style={[styles.sectionLabel, logicalText]}>{t('auth.chooseFactor')}</Text>
                <View accessibilityRole="radiogroup" style={styles.factorList}>
                  {factorOptions.map((option) => {
                    const label = t(`auth.factor.${option.strategy}` as MessageKey);
                    const selected = selectedFactor === option.strategy;
                    return (
                      <Pressable
                        key={option.strategy}
                        accessibilityLabel={option.destination ? `${label}: ${option.destination}` : label}
                        accessibilityRole="radio"
                        accessibilityState={{ checked: selected, disabled: busy }}
                        disabled={busy}
                        onPress={() => void chooseFactor(option.strategy)}
                        style={({ pressed }) => [
                          styles.factorButton,
                          selected && styles.factorButtonSelected,
                          busy && styles.disabled,
                          pressed && !busy && styles.pressed,
                        ]}
                      >
                        <Text style={[styles.factorLabel, logicalText]}>{label}</Text>
                        {option.destination ? <Text style={[styles.factorDestination, styles.ltrText]}>{option.destination}</Text> : null}
                      </Pressable>
                    );
                  })}
                </View>

                {selectedFactor ? (
                  <>
                    <Text style={[styles.factorHelp, logicalText]}>
                      {selectedFactor === 'email_code'
                        ? t('auth.factor.emailHelp', { destination: isolateLTR(selectedFactorOption?.destination ?? '') })
                        : selectedFactor === 'phone_code'
                          ? t('auth.factor.phoneHelp', { destination: isolateLTR(selectedFactorOption?.destination ?? '') })
                          : selectedFactor === 'totp'
                            ? t('auth.factor.totpHelp')
                            : t('auth.factor.backupHelp')}
                    </Text>
                    <AuthField
                      autoCapitalize="none"
                      autoComplete="one-time-code"
                      autoCorrect={false}
                      disabled={busy}
                      error={fieldErrors.code}
                      forceLTR
                      isRTL={isRTL}
                      keyboardType={selectedFactor === 'backup_code' ? 'default' : 'number-pad'}
                      label={t('auth.code')}
                      maxLength={selectedFactor === 'backup_code' ? 64 : 12}
                      onChangeText={setCode}
                      placeholder={t(selectedFactor === 'totp' ? 'auth.totpPlaceholder' : selectedFactor === 'backup_code' ? 'auth.backupCodePlaceholder' : 'auth.codePlaceholder')}
                      textContentType="oneTimeCode"
                      value={code}
                    />
                    <PrimaryButton
                      busy={busy}
                      disabled={busy || !code.trim()}
                      label={t('auth.verify')}
                      loadingLabel={t('auth.submitting')}
                      onPress={() => void verifySecondFactor()}
                    />
                    {selectedFactor === 'email_code' || selectedFactor === 'phone_code' ? (
                      <TextButton disabled={busy} label={t('auth.resendCode')} onPress={() => void resendCode()} />
                    ) : null}
                  </>
                ) : null}
                <TextButton disabled={busy} label={t('auth.startOver')} onPress={() => void startOver()} />
              </View>
            ) : showPasswordResetCode ? (
              <View style={styles.form}>
                <AuthField
                  autoCapitalize="none"
                  autoComplete="one-time-code"
                  autoCorrect={false}
                  disabled={busy}
                  error={fieldErrors.code}
                  forceLTR
                  isRTL={isRTL}
                  keyboardType="number-pad"
                  label={t('auth.code')}
                  maxLength={12}
                  onChangeText={setCode}
                  placeholder={t('auth.codePlaceholder')}
                  textContentType="oneTimeCode"
                  value={code}
                />
                <PrimaryButton
                  busy={busy}
                  disabled={busy || !code.trim()}
                  label={t('auth.verifyResetCode')}
                  loadingLabel={t('auth.submitting')}
                  onPress={() => void verifyPasswordResetCode()}
                />
                <TextButton disabled={busy} label={t('auth.resendCode')} onPress={() => void resendCode()} />
                <TextButton disabled={busy} label={t('auth.startOver')} onPress={() => void startOver()} />
              </View>
            ) : showNewPassword ? (
              <View style={styles.form}>
                <AuthField
                  autoCapitalize="none"
                  autoComplete="new-password"
                  autoCorrect={false}
                  disabled={busy}
                  error={fieldErrors.password}
                  isRTL={isRTL}
                  label={t('auth.password')}
                  maxLength={256}
                  onChangeText={setPassword}
                  placeholder={t('auth.newPasswordPlaceholder')}
                  secureTextEntry
                  textContentType="newPassword"
                  value={password}
                />
                <PrimaryButton
                  busy={busy}
                  disabled={busy || !password}
                  label={t('auth.saveNewPassword')}
                  loadingLabel={t('auth.submitting')}
                  onPress={() => void submitNewPassword()}
                />
                <TextButton disabled={busy} label={t('auth.startOver')} onPress={() => void startOver()} />
              </View>
            ) : showSignUpVerification ? (
              <View style={styles.form}>
                <AuthField
                  autoCapitalize="none"
                  autoComplete="one-time-code"
                  autoCorrect={false}
                  disabled={busy}
                  error={fieldErrors.code}
                  forceLTR
                  isRTL={isRTL}
                  keyboardType="number-pad"
                  label={t('auth.code')}
                  maxLength={12}
                  onChangeText={setCode}
                  placeholder={t('auth.codePlaceholder')}
                  textContentType="oneTimeCode"
                  value={code}
                />
                <PrimaryButton
                  busy={busy}
                  disabled={busy || !code.trim()}
                  label={t('auth.verifyEmail')}
                  loadingLabel={t('auth.submitting')}
                  onPress={() => void verifySignUpEmail()}
                />
                <TextButton disabled={busy} label={t('auth.resendCode')} onPress={() => void resendCode()} />
                <TextButton disabled={busy} label={t('auth.startOver')} onPress={() => void startOver()} />
              </View>
            ) : (
              <View style={styles.form}>
                <AuthField
                  autoCapitalize="none"
                  autoComplete="email"
                  autoCorrect={false}
                  disabled={busy}
                  error={fieldErrors.email}
                  forceLTR
                  isRTL={isRTL}
                  keyboardType="email-address"
                  label={t('auth.email')}
                  maxLength={254}
                  onChangeText={setEmail}
                  placeholder={t('auth.emailPlaceholder')}
                  textContentType="emailAddress"
                  value={email}
                />
                <AuthField
                  autoCapitalize="none"
                  autoComplete={mode === 'signIn' ? 'current-password' : 'new-password'}
                  autoCorrect={false}
                  disabled={busy}
                  error={fieldErrors.password}
                  isRTL={isRTL}
                  label={t('auth.password')}
                  maxLength={256}
                  onChangeText={setPassword}
                  placeholder={t('auth.passwordPlaceholder')}
                  secureTextEntry
                  textContentType={mode === 'signIn' ? 'password' : 'newPassword'}
                  value={password}
                />
                {mode === 'signUp' ? (
                  <View
                    accessible={false}
                    collapsable={false}
                    importantForAccessibility="no-hide-descendants"
                    nativeID="clerk-captcha"
                    style={styles.captcha}
                  />
                ) : null}
                <PrimaryButton
                  busy={busy}
                  disabled={busy || !email.trim() || !password}
                  label={t(mode === 'signIn' ? 'auth.signIn' : 'auth.createAccount')}
                  loadingLabel={t('auth.submitting')}
                  onPress={() => void (mode === 'signIn' ? submitSignIn() : submitSignUp())}
                />
                {mode === 'signIn' ? (
                  <TextButton disabled={busy} label={t('auth.forgotPassword')} onPress={() => void beginPasswordReset()} />
                ) : null}
              </View>
            )}

            {formError ? (
              <Text accessibilityLiveRegion="assertive" style={[styles.formError, logicalText]}>{formError}</Text>
            ) : null}
            {notice ? (
              <Text accessibilityLiveRegion="polite" style={[styles.notice, logicalText]}>{notice}</Text>
            ) : null}

            <View style={styles.modeRow}>
              <Text style={[styles.modeCopy, logicalText]}>
                {t(mode === 'signIn' ? 'auth.noAccount' : 'auth.haveAccount')}
              </Text>
              <TextButton
                disabled={busy}
                label={t(mode === 'signIn' ? 'auth.switchToSignUp' : 'auth.switchToSignIn')}
                onPress={() => void switchMode(mode === 'signIn' ? 'signUp' : 'signIn')}
              />
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: '#f6f8fc' },
  loadingScreen: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: '#f6f8fc', padding: 24 },
  loadingText: { color: '#475569', fontSize: 15, fontWeight: '600' },
  scrollContent: { flexGrow: 1, width: '100%', maxWidth: 620, alignSelf: 'center', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 36 },
  topBar: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 20 },
  topActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  brand: { color: '#0f172a', fontSize: 20, fontWeight: '900', letterSpacing: -0.4 },
  closeButton: { minHeight: 38, borderRadius: 8, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center' },
  closeButtonText: { color: '#475569', fontSize: 13, fontWeight: '800' },
  card: { width: '100%', borderRadius: 22, borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#ffffff', padding: 22, gap: 20, shadowColor: '#0f172a', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.07, shadowRadius: 20, elevation: 3 },
  headingBlock: { gap: 8 },
  title: { color: '#0f172a', fontSize: 28, fontWeight: '900', letterSpacing: -0.7 },
  copy: { color: '#64748b', fontSize: 15, lineHeight: 22 },
  form: { gap: 14 },
  field: { gap: 6 },
  label: { color: '#334155', fontSize: 14, fontWeight: '800' },
  input: { minHeight: 52, borderRadius: 12, borderWidth: 1, borderColor: '#cbd5e1', backgroundColor: '#ffffff', color: '#0f172a', fontSize: 16, paddingHorizontal: 14, paddingVertical: 12 },
  inputError: { borderColor: '#dc2626', backgroundColor: '#fef2f2' },
  fieldError: { color: '#b91c1c', fontSize: 13, lineHeight: 18, fontWeight: '600' },
  primaryButton: { minHeight: 52, borderRadius: 12, backgroundColor: '#2563eb', paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 },
  primaryButtonText: { color: '#ffffff', fontSize: 16, fontWeight: '900' },
  textButton: { minHeight: 40, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  textButtonText: { color: '#2563eb', fontSize: 14, fontWeight: '800', textAlign: 'center' },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.72 },
  sectionLabel: { color: '#334155', fontSize: 15, fontWeight: '900' },
  factorList: { gap: 9 },
  factorButton: { minHeight: 58, borderRadius: 12, borderWidth: 1, borderColor: '#cbd5e1', backgroundColor: '#ffffff', paddingHorizontal: 14, paddingVertical: 10, justifyContent: 'center', gap: 3 },
  factorButtonSelected: { borderColor: '#2563eb', backgroundColor: '#eff6ff' },
  factorLabel: { color: '#0f172a', fontSize: 15, fontWeight: '800' },
  factorDestination: { color: '#64748b', fontSize: 13 },
  factorHelp: { color: '#475569', fontSize: 14, lineHeight: 20 },
  captcha: { width: '100%', minHeight: 1, overflow: 'visible' },
  formError: { borderRadius: 10, backgroundColor: '#fef2f2', color: '#b91c1c', fontSize: 14, lineHeight: 20, fontWeight: '700', padding: 12 },
  notice: { borderRadius: 10, backgroundColor: '#ecfdf5', color: '#047857', fontSize: 14, lineHeight: 20, fontWeight: '700', padding: 12 },
  modeRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: 4 },
  modeCopy: { color: '#64748b', fontSize: 14 },
  ltrText: { textAlign: 'left', writingDirection: 'ltr' },
  rtlText: { textAlign: 'right', writingDirection: 'rtl' },
});
