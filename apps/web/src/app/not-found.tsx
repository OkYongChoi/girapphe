import Link from 'next/link';
 
export default function NotFound() {
  return (
    <main id="main-content" className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">404 error</p>
      <h1 className="mt-2 text-2xl font-bold text-slate-900">Page not found</h1>
      <p className="mt-4 max-w-md text-slate-600">The page you requested does not exist or may have moved.</p>
      <Link href="/" className="text-blue-500 hover:underline">
        Return Home
      </Link>
    </main>
  );
}
