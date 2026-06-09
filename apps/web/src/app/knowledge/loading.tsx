import Navbar from '@/components/navbar';

export default function KnowledgeLoading() {
  return (
    <main className="min-h-screen bg-gray-50 flex flex-col">
      <Navbar />
      <div className="mx-auto flex w-full max-w-6xl flex-grow flex-col px-6 py-8">
        <div className="mb-6">
          <div className="h-8 w-56 animate-pulse rounded-md bg-gray-200" />
          <div className="mt-3 h-4 w-80 max-w-full animate-pulse rounded bg-gray-200" />
        </div>
        <div className="grid flex-grow gap-4 md:grid-cols-[16rem_1fr]">
          <div className="space-y-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <div className="h-4 w-24 animate-pulse rounded bg-gray-200" />
            <div className="h-10 animate-pulse rounded bg-gray-100" />
            <div className="h-10 animate-pulse rounded bg-gray-100" />
            <div className="h-10 animate-pulse rounded bg-gray-100" />
          </div>
          <div className="relative min-h-[28rem] overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
            <div className="absolute left-1/2 top-1/2 h-44 w-44 -translate-x-1/2 -translate-y-1/2 animate-pulse rounded-full border border-cyan-100 bg-cyan-50" />
            <div className="absolute left-[28%] top-[28%] h-7 w-7 animate-pulse rounded-full bg-emerald-200" />
            <div className="absolute right-[24%] top-[34%] h-9 w-9 animate-pulse rounded-full bg-sky-200" />
            <div className="absolute bottom-[25%] left-[36%] h-8 w-8 animate-pulse rounded-full bg-amber-200" />
            <div className="absolute bottom-[32%] right-[34%] h-6 w-6 animate-pulse rounded-full bg-violet-200" />
          </div>
        </div>
      </div>
    </main>
  );
}
