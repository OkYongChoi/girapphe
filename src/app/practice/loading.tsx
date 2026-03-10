export default function PracticeLoading() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Navbar placeholder */}
      <div className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 px-4 py-3">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-3">
          <div className="flex items-center justify-between gap-4">
            <div className="h-6 w-28 rounded-md bg-gray-200 animate-pulse" />
            <div className="h-8 w-20 rounded-md bg-gray-200 animate-pulse" />
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-lg flex-grow px-4 py-4 md:py-6">
        {/* Header */}
        <div className="mb-5 flex items-end justify-between gap-3">
          <div className="space-y-2">
            <div className="h-7 w-24 rounded-md bg-gray-200 animate-pulse" />
            <div className="h-4 w-56 rounded-md bg-gray-200 animate-pulse" />
          </div>
        </div>

        {/* Mode toggle placeholder */}
        <div className="mb-2 h-10 w-full rounded-lg bg-gray-200 animate-pulse" />
        <div className="mb-6 h-4 w-48 rounded bg-gray-200 animate-pulse" />

        {/* Stats bar */}
        <div className="mb-4 rounded-xl border bg-white px-4 py-2.5 animate-pulse">
          <div className="flex items-center justify-between">
            <div className="flex gap-3">
              <div className="h-4 w-16 rounded bg-gray-200" />
              <div className="h-4 w-24 rounded bg-gray-200" />
            </div>
            <div className="h-4 w-20 rounded bg-gray-200" />
          </div>
        </div>

        {/* Prev / Skip */}
        <div className="mb-3 flex justify-between">
          <div className="h-7 w-14 rounded-lg bg-gray-200 animate-pulse" />
          <div className="h-7 w-14 rounded-lg bg-gray-200 animate-pulse" />
        </div>

        {/* Card skeleton */}
        <div className="w-full rounded-xl border border-gray-200 bg-white p-6 shadow-sm animate-pulse">
          <div className="mb-4 flex justify-between">
            <div className="h-5 w-16 rounded-full bg-gray-200" />
            <div className="h-4 w-28 rounded bg-gray-200" />
          </div>
          <div className="mb-4 space-y-2">
            <div className="h-7 w-3/4 rounded bg-gray-200" />
            <div className="h-7 w-1/2 rounded bg-gray-200" />
          </div>
          <div className="space-y-2">
            <div className="h-4 w-full rounded bg-gray-100" />
            <div className="h-4 w-full rounded bg-gray-100" />
            <div className="h-4 w-2/3 rounded bg-gray-100" />
          </div>
        </div>

        {/* Show answer button skeleton */}
        <div className="mt-3 h-14 w-full rounded-2xl bg-gray-300 animate-pulse" />
      </div>
    </div>
  );
}
