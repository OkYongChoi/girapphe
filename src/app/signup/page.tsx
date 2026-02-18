import { SignUp } from '@clerk/nextjs';

export default function SignupPage() {
  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-16">
      <SignUp />
    </main>
  );
}
