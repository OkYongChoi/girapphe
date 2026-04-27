import { auth, currentUser } from '@clerk/nextjs/server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { hasValidClerkConfig } from '@/lib/clerk-env';
import { GUEST_ID_COOKIE } from '@/lib/guest';

export type AuthUser = {
  id: string;
  email: string;
};

export type CurrentActor = AuthUser & {
  isGuest: boolean;
};

export async function getCurrentUser(): Promise<AuthUser | null> {
  if (!hasValidClerkConfig()) return null;

  const { userId } = await auth();
  if (!userId) return null;

  const user = await currentUser();
  if (!user) return null;

  const email =
    user.emailAddresses.find((e) => e.id === user.primaryEmailAddressId)?.emailAddress ??
    user.emailAddresses[0]?.emailAddress ??
    '';

  return { id: userId, email };
}

export async function getCurrentActor(): Promise<CurrentActor> {
  const user = await getCurrentUser();
  if (user) return { ...user, isGuest: false };

  const cookieStore = await cookies();
  const guestId = cookieStore.get(GUEST_ID_COOKIE)?.value;

  return {
    id: guestId?.startsWith('guest_') ? guestId : 'guest_anonymous',
    email: 'Guest',
    isGuest: true,
  };
}

export async function requireCurrentActor(): Promise<CurrentActor> {
  return getCurrentActor();
}

export async function requireCurrentUser(): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  return user;
}

export async function requireAdminUser(): Promise<AuthUser> {
  const user = await requireCurrentUser();
  const adminId = process.env.ADMIN_CLERK_USER_ID;
  if (!adminId || user.id !== adminId) redirect('/');
  return user;
}
