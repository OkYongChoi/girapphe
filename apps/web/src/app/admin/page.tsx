import { redirect } from 'next/navigation';
import { localizePathname } from '@stem-brain/shared';
import { getServerLocale } from '@/i18n/server';

export default async function AdminPage() {
  redirect(localizePathname('/admin/nodes', await getServerLocale()));
}
