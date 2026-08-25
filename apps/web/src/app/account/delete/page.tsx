import type { Metadata } from 'next';
import Link from 'next/link';
import { AccountDeletionPanel } from '@/components/account-deletion-panel';
import { requireCurrentUserProfile } from '@/lib/auth';

export const metadata: Metadata = {
  title: 'Delete account',
  description: 'Permanently delete a Girapphe account and its associated private product data.',
};

export default async function DeleteAccountPage() {
  const user = await requireCurrentUserProfile();
  return (
    <main className="min-h-screen bg-slate-50 px-5 py-12 text-slate-900 sm:py-16">
      <div className="mx-auto max-w-xl rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-9">
        <Link href="/support" className="text-sm font-semibold text-blue-700 underline underline-offset-4">← Support</Link>
        <h1 className="mt-7 text-4xl font-black tracking-tight">Delete Girapphe account</h1>
        <p className="mt-4 leading-7 text-slate-600">
          This is the verified web deletion path for Girapphe on web, iOS, and Android. Review the scope below before confirming.
        </p>
        <AccountDeletionPanel email={user.email} />
        <p className="mt-6 text-sm leading-6 text-slate-500">
          See the <Link href="/privacy" className="font-semibold text-blue-700 underline underline-offset-4">Privacy Policy</Link>
          {' '}for retention details.
        </p>
      </div>
    </main>
  );
}
