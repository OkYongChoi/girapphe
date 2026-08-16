import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { ClerkProvider, useAuth, useUser } from '@clerk/expo';
import { tokenCache } from '@clerk/expo/token-cache';
import { arSA, enUS, esES, hiIN, jaJP, zhCN } from '@clerk/localizations';
import type { Locale } from '@stem-brain/shared';
import { useI18n } from '@/i18n';

type MobileAuthState = {
  configured: boolean;
  isLoaded: boolean;
  isSignedIn: boolean;
  userId: string | null;
  email: string | null;
  getToken: () => Promise<string | null>;
  signOut: () => Promise<void>;
};

const clerkPublishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim() ?? '';
const clerkLocalizations = {
  en: enUS,
  ja: jaJP,
  'zh-CN': zhCN,
  es: esES,
  ar: arSA,
  hi: hiIN,
} satisfies Record<Locale, typeof enUS>;

const unconfiguredAuth: MobileAuthState = {
  configured: false,
  isLoaded: true,
  isSignedIn: false,
  userId: null,
  email: null,
  getToken: async () => null,
  signOut: async () => undefined,
};

const MobileAuthContext = createContext<MobileAuthState>(unconfiguredAuth);

function ClerkSessionBridge({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const { user } = useUser();

  const value = useMemo<MobileAuthState>(() => {
    const email =
      user?.primaryEmailAddress?.emailAddress ??
      user?.emailAddresses[0]?.emailAddress ??
      null;

    return {
      configured: true,
      isLoaded: auth.isLoaded,
      isSignedIn: Boolean(auth.isSignedIn),
      userId: auth.userId ?? null,
      email,
      getToken: async () => auth.getToken(),
      signOut: async () => {
        await auth.signOut();
      },
    };
  }, [auth, user]);

  return <MobileAuthContext.Provider value={value}>{children}</MobileAuthContext.Provider>;
}

export function MobileAuthProvider({ children }: { children: ReactNode }) {
  const { locale } = useI18n();

  if (!clerkPublishableKey) {
    return <MobileAuthContext.Provider value={unconfiguredAuth}>{children}</MobileAuthContext.Provider>;
  }

  return (
    <ClerkProvider
      publishableKey={clerkPublishableKey}
      tokenCache={tokenCache}
      localization={clerkLocalizations[locale]}
    >
      <ClerkSessionBridge>{children}</ClerkSessionBridge>
    </ClerkProvider>
  );
}

export function useMobileAuth(): MobileAuthState {
  return useContext(MobileAuthContext);
}
