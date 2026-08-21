'use server';

import { redirect } from 'next/navigation';
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
  redirect(localizePathname('/', locale));
}
