'use client';

import { useState } from 'react';
import { useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import { archiveKnowledgeItem, supersedeKnowledgeItem, verifyKnowledgeItem } from '@/actions/user-knowledge-actions';
import { useI18n } from '@/i18n/client';
import { normalizeLocalDateTimeFields } from '@/lib/local-datetime';

type ReplacementItem = { id: string; title: string };

function PendingButton({ idle, busy, className }: { idle: string; busy: string; className: string }) {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} className={className}>{pending ? busy : idle}</button>;
}

export default function KnowledgeLifecycleControls({
  itemId,
  version,
  lastVerifiedAt,
  replacements,
}: {
  itemId: string;
  version: number;
  lastVerifiedAt: string | null;
  replacements: ReplacementItem[];
}) {
  const router = useRouter();
  const { t } = useI18n();
  const [error, setError] = useState<string | null>(null);

  const verify = async (formData: FormData) => {
    setError(null);
    try {
      normalizeLocalDateTimeFields(formData, ['review_at']);
      const result = await verifyKnowledgeItem(formData);
      if (!result.verified) setError(result.stale ? t('topic.lifecycle.verifyChanged') : t('topic.lifecycle.verifyError'));
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t('topic.lifecycle.verifyError'));
    }
  };

  const supersede = async (formData: FormData) => {
    setError(null);
    if (!window.confirm(t('topic.lifecycle.supersedeConfirm'))) return;
    try {
      const result = await supersedeKnowledgeItem(formData);
      if (!result.superseded) setError(result.stale ? t('topic.lifecycle.supersedeChanged') : t('topic.lifecycle.supersedeError'));
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t('topic.lifecycle.supersedeError'));
    }
  };

  const archive = async (formData: FormData) => {
    setError(null);
    if (!window.confirm(t('topic.lifecycle.archiveConfirm'))) return;
    try {
      const result = await archiveKnowledgeItem(formData);
      if (!result.archived) setError(result.stale ? t('topic.lifecycle.archiveChanged') : t('topic.lifecycle.archiveError'));
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t('topic.lifecycle.archiveError'));
    }
  };

  return (
    <details className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
      <summary className="cursor-pointer text-xs font-bold uppercase tracking-wide text-slate-700">{t('topic.lifecycle.actions')}</summary>
      <div className="mt-3 grid gap-4 lg:grid-cols-3">
        <form action={verify} className="rounded-xl border border-emerald-200 bg-white p-3">
          <input type="hidden" name="id" value={itemId} />
          <input type="hidden" name="version" value={version} />
          <p className="text-sm font-bold text-slate-900">{t('topic.lifecycle.verifyTitle')}</p>
          <p className="mt-1 text-xs leading-relaxed text-slate-500">{t('topic.lifecycle.verifyBody')}</p>
          <label className="mt-3 grid gap-1 text-xs font-semibold text-slate-600">{t('topic.lifecycle.reviewAt')}<input type="datetime-local" name="review_at" className="min-h-10 rounded-lg border px-3 text-sm font-normal" /></label>
          <PendingButton idle={lastVerifiedAt ? t('topic.lifecycle.verifyAgain') : t('topic.lifecycle.markVerified')} busy={t('topic.lifecycle.verifying')} className="mt-3 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50" />
        </form>

        <form action={supersede} className="rounded-xl border border-amber-200 bg-white p-3">
          <input type="hidden" name="superseded_item_id" value={itemId} />
          <input type="hidden" name="superseded_version" value={version} />
          <p className="text-sm font-bold text-slate-900">{t('topic.lifecycle.supersedeTitle')}</p>
          <p className="mt-1 text-xs leading-relaxed text-slate-500">{t('topic.lifecycle.supersedeBody')}</p>
          <label className="mt-3 grid gap-1 text-xs font-semibold text-slate-600">{t('topic.lifecycle.replacement')}<select name="superseding_item_id" required disabled={replacements.length === 0} className="min-h-10 rounded-lg border bg-white px-3 text-sm font-normal"><option value="">{t('topic.lifecycle.chooseReplacement')}</option>{replacements.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
          <label className="mt-2 grid gap-1 text-xs font-semibold text-slate-600">{t('topic.lifecycle.reason')}<input name="reason" required maxLength={500} placeholder={t('topic.lifecycle.reasonPlaceholder')} className="min-h-10 rounded-lg border px-3 text-sm font-normal" /></label>
          {replacements.length > 0 ? <PendingButton idle={t('topic.lifecycle.markSuperseded')} busy={t('topic.lifecycle.saving')} className="mt-3 rounded-lg border border-amber-400 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-900 hover:bg-amber-100 disabled:opacity-50" /> : <p className="mt-3 text-xs text-slate-500">{t('topic.lifecycle.noReplacement')}</p>}
        </form>

        <form action={archive} className="rounded-xl border border-slate-300 bg-white p-3">
          <input type="hidden" name="id" value={itemId} />
          <input type="hidden" name="version" value={version} />
          <p className="text-sm font-bold text-slate-900">{t('topic.lifecycle.archiveTitle')}</p>
          <p className="mt-1 text-xs leading-relaxed text-slate-500">{t('topic.lifecycle.archiveBody')}</p>
          <PendingButton idle={t('topic.lifecycle.moveArchive')} busy={t('topic.lifecycle.archiving')} className="mt-3 rounded-lg border border-slate-400 bg-slate-100 px-3 py-2 text-xs font-bold text-slate-800 hover:bg-slate-200 disabled:opacity-50" />
        </form>
      </div>
      {error ? <p role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-800">{error}</p> : null}
    </details>
  );
}
