import { auth, currentUser } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';

export type AuthUser = {
  id: string;
  email: string;
};

export async function getCurrentUser(): Promise<AuthUser | null> {
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

export async function requireCurrentUser(): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  return user;
}
