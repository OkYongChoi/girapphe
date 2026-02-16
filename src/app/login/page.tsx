import { redirect } from 'next/navigation';
import AuthForm from '@/components/auth/auth-form';
import { getCurrentUser } from '@/lib/auth';
import { getEnabledOAuthProviders } from '@/lib/oauth';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await getCurrentUser();
  if (user) {
    redirect('/practice');
  }
  const providers = getEnabledOAuthProviders();
  const params = await searchParams;

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-16">
      <div className="mx-auto flex w-full max-w-5xl flex-col items-center gap-8">
        <AuthForm mode="login" enabledProviders={providers} oauthError={params.error} />
      </div>
    </main>
  );
}
