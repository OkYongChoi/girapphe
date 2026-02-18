'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import {
  signInWithPassword,
  signOutCurrentUser,
  signUpWithPassword,
} from '@/lib/auth';

export type AuthActionState = {
  error: string | null;
  message?: string | null;
};

const INITIAL_STATE: AuthActionState = { error: null, message: null };

function readCredentials(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  return { email, password };
}

function validate(email: string, password: string): string | null {
  const basicEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!basicEmail.test(email)) {
    return 'Please provide a valid email address.';
  }

  if (password.length < 8) {
    return 'Password must be at least 8 characters.';
  }

  return null;
}

export async function loginAction(
  prevState: AuthActionState = INITIAL_STATE,
  formData: FormData
): Promise<AuthActionState> {
  void prevState;
  try {
    const { email, password } = readCredentials(formData);
    const validationError = validate(email, password);

    if (validationError) {
      return { error: validationError };
    }

    const result = await signInWithPassword(email, password);
    if (!result.success) {
      return { error: result.error, message: null };
    }

    revalidatePath('/', 'layout');
    redirect('/practice');
  } catch (error) {
    console.error('loginAction failed:', error);
    return { error: 'Login failed. Please try again.', message: null };
  }
}

export async function signupAction(
  prevState: AuthActionState = INITIAL_STATE,
  formData: FormData
): Promise<AuthActionState> {
  void prevState;
  try {
    const { email, password } = readCredentials(formData);
    const validationError = validate(email, password);

    if (validationError) {
      return { error: validationError };
    }

    const result = await signUpWithPassword(email, password);
    if (!result.success) {
      return { error: result.error, message: null };
    }

    if (result.requiresVerification) {
      return {
        error: null,
        message: 'Verification email sent. Please verify your email before logging in.',
      };
    }

    revalidatePath('/', 'layout');
    redirect('/practice');
  } catch (error) {
    console.error('signupAction failed:', error);
    return { error: 'Sign up failed. Please try again.', message: null };
  }
}

export async function logoutAction() {
  await signOutCurrentUser();
  revalidatePath('/', 'layout');
  redirect('/');
}
