import { LocalizedLink } from '@/i18n/navigation';
import { getServerI18n } from '@/i18n/server';

export default async function NotFound() {
  const { t } = await getServerI18n();
  return (
    <main id="main-content" className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">{t('errors.notFoundCode')}</p>
      <h1 className="mt-2 text-2xl font-bold text-slate-900">{t('errors.notFoundTitle')}</h1>
      <p className="mt-4 max-w-md text-slate-600">{t('errors.notFoundBody')}</p>
      <LocalizedLink href="/" className="text-blue-500 hover:underline">
        {t('errors.returnHome')}
      </LocalizedLink>
    </main>
  );
}
