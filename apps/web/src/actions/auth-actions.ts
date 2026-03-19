'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { auth, clerkClient } from '@clerk/nextjs/server';

export async function logoutAction() {
  const { userId, sessionId } = await auth();
  if (userId && sessionId) {
    const client = await clerkClient();
    await client.sessions.revokeSession(sessionId);
  }
  revalidatePath('/', 'layout');
  redirect('/');
}
