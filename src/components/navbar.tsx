import Link from 'next/link';

export default function Navbar() {
  return (
    <nav className="border-b bg-white dark:bg-gray-950 px-4 py-3 flex items-center justify-between">
      <Link href="/" className="font-bold text-xl tracking-tight">
        Eng<span className="text-blue-600">Cards</span>
      </Link>
      <div className="flex gap-4 text-sm font-medium">
        <Link href="/" className="hover:text-blue-600 transition-colors">
          Practice
        </Link>
        <Link href="/saved" className="hover:text-blue-600 transition-colors">
          Saved
        </Link>
      </div>
    </nav>
  );
}
