import { SignIn } from '@clerk/nextjs';
import { hasValidClerkConfig } from '@/lib/clerk-env';
import { getCurrentUser } from '@/lib/auth';
import { redirect } from 'next/navigation';

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) {
    redirect('/practice');
  }

  if (!hasValidClerkConfig()) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-16">
        <div className="max-w-md rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          Clerk keys are not configured. Set real values for
          {' '}
          <code>NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY</code>
          {' '}
          and
          {' '}
          <code>CLERK_SECRET_KEY</code>
          {' '}
          to use login.
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-16">
      <SignIn forceRedirectUrl="/practice" fallbackRedirectUrl="/practice" />
    </main>
  );
}
