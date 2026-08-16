import { redirect } from 'next/navigation';
import { localizePathname } from '@stem-brain/shared';
import { getServerLocale } from '@/i18n/server';

export default async function RegisterPage() {
  redirect(localizePathname('/signup', await getServerLocale()));
}
