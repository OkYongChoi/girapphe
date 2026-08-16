'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { localizePathname } from '@stem-brain/shared';
import { getServerLocale } from '@/i18n/server';

export async function logoutAction() {
  const locale = await getServerLocale();
  const { userId, sessionId } = await auth();
  if (userId && sessionId) {
    const client = await clerkClient();
    await client.sessions.revokeSession(sessionId);
  }
  revalidatePath('/', 'layout');
  redirect(localizePathname('/', locale));
}
