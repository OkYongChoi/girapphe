import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function TossBillingFailPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const rawCode = typeof params.code === 'string' ? params.code : '';
  const code = /^[A-Z0-9_]{1,80}$/.test(rawCode) ? rawCode : 'PAYMENT_CANCELED';
  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-lg items-center px-4 py-12">
      <section className="w-full rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Toss Payments</p>
        <h1 className="mt-2 text-2xl font-bold text-slate-950">카드 등록이 취소됐습니다</h1>
        <p className="mt-3 text-sm text-slate-600">결제나 구독 권한은 생성되지 않았습니다.</p>
        <code className="mt-4 inline-block rounded bg-slate-100 px-2 py-1 text-xs text-slate-600">{code}</code>
        <div className="mt-6">
          <Link href="/subscription" className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-bold text-white hover:bg-slate-800">
            구독 화면으로 돌아가기
          </Link>
        </div>
      </section>
    </main>
  );
}
