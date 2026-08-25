import { auth, currentUser } from '@clerk/nextjs/server';
import { cache } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { hasValidClerkConfig } from '@/lib/clerk-env';
import { GUEST_ID_COOKIE, isServerIssuedGuestId } from '@/lib/guest';
import { getServerLocale } from '@/i18n/server';
import { localizePathname } from '@stem-brain/shared';

export type AuthUser = {
  id: string;
  email: string;
};

export type CurrentActor = AuthUser & {
  isGuest: boolean;
};

export const getCurrentUser = cache(async function getCurrentUser(): Promise<AuthUser | null> {
  if (!hasValidClerkConfig()) return null;

  const { userId, sessionClaims } = await auth();
  if (!userId) return null;

  const claimedEmail = typeof (sessionClaims as Record<string, unknown> | null)?.email === 'string'
    ? String((sessionClaims as Record<string, unknown>).email)
    : '';

  return { id: userId, email: claimedEmail };
});

export const getCurrentUserProfile = cache(async function getCurrentUserProfile(): Promise<AuthUser | null> {
  const authenticated = await getCurrentUser();
  if (!authenticated) return null;

  const user = await currentUser();
  if (!user) return authenticated;

  const email =
    user.emailAddresses.find((e) => e.id === user.primaryEmailAddressId)?.emailAddress ??
    user.emailAddresses[0]?.emailAddress ??
    '';

  return { id: authenticated.id, email };
});

export const getCurrentActor = cache(async function getCurrentActor(): Promise<CurrentActor> {
  const user = await getCurrentUser();
  if (user) return { ...user, isGuest: false };

  const cookieStore = await cookies();
  const guestId = cookieStore.get(GUEST_ID_COOKIE)?.value;

  return {
    id: isServerIssuedGuestId(guestId) ? guestId : 'guest_anonymous',
    email: 'Guest',
    isGuest: true,
  };
});

export async function requireCurrentActor(): Promise<CurrentActor> {
  return getCurrentActor();
}

export async function requireCurrentUser(): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (!user) redirect(localizePathname('/login', await getServerLocale()));
  return user;
}

export async function requireCurrentUserProfile(): Promise<AuthUser> {
  const user = await getCurrentUserProfile();
  if (!user) redirect(localizePathname('/login', await getServerLocale()));
  return user;
}

export function isAdminUser(user: AuthUser | null): boolean {
  const adminId = process.env.ADMIN_CLERK_USER_ID;
  return Boolean(adminId && user && user.id === adminId);
}

export async function requireAdminUser(): Promise<AuthUser> {
  const user = await requireCurrentUser();
  if (!isAdminUser(user)) redirect(localizePathname('/', await getServerLocale()));
  return user;
}
