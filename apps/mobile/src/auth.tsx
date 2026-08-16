import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { ClerkProvider, useAuth, useUser } from '@clerk/expo';
import { useSignIn } from '@clerk/expo/legacy';
import { tokenCache } from '@clerk/expo/token-cache';

type MobileAuthState = {
  configured: boolean;
  isLoaded: boolean;
  isSignedIn: boolean;
  userId: string | null;
  email: string | null;
  getToken: () => Promise<string | null>;
  signOut: () => Promise<void>;
};

type SignInFormState = {
  emailAddress: string;
  password: string;
  isBusy: boolean;
  error: string | null;
  setEmailAddress: (value: string) => void;
  setPassword: (value: string) => void;
  submit: () => Promise<boolean>;
};

const clerkPublishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim() ?? '';

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
  if (!clerkPublishableKey) {
    return <MobileAuthContext.Provider value={unconfiguredAuth}>{children}</MobileAuthContext.Provider>;
  }

  return (
    <ClerkProvider publishableKey={clerkPublishableKey} tokenCache={tokenCache}>
      <ClerkSessionBridge>{children}</ClerkSessionBridge>
    </ClerkProvider>
  );
}

export function useMobileAuth(): MobileAuthState {
  return useContext(MobileAuthContext);
}

function getClerkErrorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'errors' in error) {
    const errors = (error as { errors?: Array<{ longMessage?: string; message?: string }> }).errors;
    const first = errors?.[0];
    if (first?.longMessage) return first.longMessage;
    if (first?.message) return first.message;
  }
  if (error instanceof Error) return error.message;
  return 'Unable to sign in. Check your details and try again.';
}

export function useClerkEmailPasswordSignIn(): SignInFormState {
  const { isLoaded, signIn, setActive } = useSignIn();
  const [emailAddress, setEmailAddress] = useState('');
  const [password, setPassword] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(): Promise<boolean> {
    if (!isLoaded || isBusy) return false;
    if (!emailAddress.trim() || !password) {
      setError('Enter both your email and password.');
      return false;
    }

    setIsBusy(true);
    setError(null);
    try {
      const attempt = await signIn.create({
        identifier: emailAddress.trim(),
        password,
      });

      if (attempt.status !== 'complete' || !attempt.createdSessionId) {
        setError('This sign-in needs an additional verification step. Finish it on the web, then try again.');
        return false;
      }

      await setActive({ session: attempt.createdSessionId });
      return true;
    } catch (cause) {
      setError(getClerkErrorMessage(cause));
      return false;
    } finally {
      setIsBusy(false);
    }
  }

  return {
    emailAddress,
    password,
    isBusy,
    error,
    setEmailAddress,
    setPassword,
    submit,
  };
}
