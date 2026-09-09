import { getClerkConfigProblem } from '@/lib/clerk-env';
import { AuthEntrypoint } from '@/components/auth-entrypoint';
import { getServerI18n } from '@/i18n/server';

export default async function SignupPage() {
  const { t } = await getServerI18n();
  const clerkConfigProblem = getClerkConfigProblem();
  if (clerkConfigProblem) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-16">
        <div className="max-w-md rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          {t('auth.configProblem')}
        </div>
      </main>
    );
  }

  return <AuthEntrypoint mode="sign-up" />;
}
