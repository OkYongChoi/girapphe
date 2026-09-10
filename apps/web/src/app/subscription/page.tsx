import Link from 'next/link';
import { managementDestinationFor, subscriptionGrantsAdFree } from '@stem-brain/shared';
import Navbar from '@/components/navbar';
import BillingConfirmationStatus from '@/components/billing-confirmation-status';
import { requireCurrentUser } from '@/lib/auth';
import { requireBillingEntitlementState } from '@/lib/billing/database';
import {
  isCreemAcquisitionEnabled,
  isCreemLifecycleConfigured,
} from '@/lib/billing/creem';
import { isStripeLifecycleConfigured } from '@/lib/billing/stripe';
import { isTossBillingConfigured } from '@/lib/billing/toss';
import { findActionableTossSubscription } from '@/lib/billing/legacy-management';

export const dynamic = 'force-dynamic';

const ERROR_MESSAGES: Record<string, string> = {
  annual_only: 'New web subscriptions are annual only.',
  checkout_failed: 'Checkout could not be started. No access was granted.',
  invalid_plan: 'The requested web plan is not available.',
  not_configured: 'New web subscriptions are not available yet.',
  payment_processing: 'A payment attempt is already being confirmed. Do not purchase again.',
  portal_failed: 'Subscription management could not be opened. Please try again.',
  subscription_exists: 'You are already subscribed or another subscription needs attention.',
  toss_cancellation_failed: 'The Toss renewal schedule could not be cancelled. Please try again or contact support.',
};

function formatDate(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeZone: 'UTC' }).format(date);
}

function sourceLabel(provider: string, store: string) {
  if (provider === 'creem') return 'Web · Creem';
  if (store === 'app_store') return 'iOS · App Store';
  if (store === 'play_store') return 'Android · Google Play';
  return `${store} · ${provider}`;
}

export default async function SubscriptionPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireCurrentUser('/subscription');
  const searchParams = await props.searchParams;
  const entitlement = await requireBillingEntitlementState(user.id);
  const subscription = entitlement.subscriptions.find((candidate) => (
    subscriptionGrantsAdFree(candidate)
  )) ?? entitlement.subscriptions[0] ?? null;
  const tossSubscription = findActionableTossSubscription(entitlement.subscriptions);
  const checkoutState = typeof searchParams.checkout === 'string' ? searchParams.checkout : null;
  const returned = checkoutState === 'returned' || searchParams.success === 'true';
  const errorCode = typeof searchParams.error === 'string' ? searchParams.error : null;
  const acquisitionEnabled = isCreemAcquisitionEnabled();
  const lifecycleConfigured = isCreemLifecycleConfigured();
  const stripeLifecycleConfigured = isStripeLifecycleConfigured();
  const tossLifecycleConfigured = isTossBillingConfigured();
  const periodEnd = formatDate(subscription?.currentPeriodEnd ?? null);
  const management = subscription
    ? managementDestinationFor(subscription)
    : null;

  return (
    <main id="main-content" className="min-h-screen bg-slate-50 text-slate-950">
      <Navbar user={user} />
      <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-700">Girapphe Plus</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">See the full public knowledge map. Remove the ads.</h1>
          <p className="mt-4 text-base leading-7 text-slate-600">
            Your learning, cards, review state, private concepts, and private relationships remain free. Plus unlocks the full public Knowledge Map and removes sponsored practice cards.
          </p>
          <ul className="mt-4 grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
            <li className="rounded-xl border border-slate-200 bg-white px-4 py-3"><strong className="text-slate-900">Free:</strong> learning and all user-created private knowledge.</li>
            <li className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3"><strong className="text-blue-950">Plus:</strong> the full public map and no sponsored practice cards.</li>
          </ul>
        </div>

        {returned ? <BillingConfirmationStatus /> : null}
        {checkoutState === 'cancelled' ? (
          <div role="status" className="mt-6 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
            Checkout was cancelled. Your account was not upgraded.
          </div>
        ) : null}
        {checkoutState === 'toss_cancelled' ? (
          <div role="status" className="mt-6 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
            Toss renewal is cancelled. Already-paid access remains until its displayed period end.
          </div>
        ) : null}
        {checkoutState === 'toss_cancel_pending' ? (
          <div role="status" className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Toss renewal cancellation is recorded. An in-flight payment attempt is being reconciled before the billing key is deleted.
          </div>
        ) : null}
        {errorCode && ERROR_MESSAGES[errorCode] ? (
          <div role="alert" className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {ERROR_MESSAGES[errorCode]}
          </div>
        ) : null}
        {entitlement.duplicateDetected ? (
          <div role="alert" className="mt-6 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            More than one valid subscription is linked to this Clerk account. New purchases are blocked; contact support so the later duplicate can be handled without deleting billing records.
          </div>
        ) : null}

        <section aria-labelledby="current-plan-heading" className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 id="current-plan-heading" className="text-lg font-bold">Current access</h2>
              <p className="mt-1 text-sm text-slate-600">
                {entitlement.isAdFree
                  ? 'Girapphe Plus is active on web, iOS, and Android for this Clerk account.'
                  : 'Free access remains available on every platform.'}
              </p>
              {subscription ? (
                <p className="mt-2 text-xs text-slate-500">
                  {sourceLabel(subscription.provider, subscription.store)} · {subscription.plan} · {subscription.status}
                  {periodEnd ? ` · access through ${periodEnd}` : ''}
                  {subscription.cancelAtPeriodEnd ? ' · cancels at period end' : ''}
                </p>
              ) : null}
            </div>
            <span className={`rounded-full px-3 py-1 text-xs font-bold ${entitlement.isAdFree ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'}`}>
              {entitlement.isAdFree ? 'PLUS' : 'FREE'}
            </span>
          </div>
          {subscription?.provider === 'creem' && lifecycleConfigured ? (
            <form action="/api/billing/portal" method="post" className="mt-4">
              <button type="submit" className="min-h-11 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500">
                Manage in Creem
              </button>
            </form>
          ) : null}
          {subscription?.provider === 'stripe' && stripeLifecycleConfigured ? (
            <form action="/api/billing/portal" method="post" className="mt-4">
              <button type="submit" className="min-h-11 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500">
                Manage legacy subscription in Stripe
              </button>
            </form>
          ) : null}
          {tossSubscription ? (
            tossLifecycleConfigured ? (
              <form action="/api/billing/toss/cancel" method="post" className="mt-4">
                <button type="submit" className="min-h-11 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500">
                  Cancel Toss renewal
                </button>
              </form>
            ) : (
              <p className="mt-4 text-sm text-amber-800">
                Toss renewal management is temporarily unavailable. <Link href="/support" className="font-semibold underline">Contact support</Link> before the next renewal date.
              </p>
            )
          ) : null}
          {management?.url && management.kind !== 'creem_portal' ? (
            <a href={management.url} className="mt-4 inline-flex min-h-11 items-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500">
              {management.kind === 'app_store' ? 'Manage in the App Store' : 'Manage in Google Play'}
            </a>
          ) : null}
        </section>

        <section aria-labelledby="plans-heading" className="mt-8">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">Web subscription</p>
            <h2 id="plans-heading" className="mt-1 text-2xl font-black">One annual plan</h2>
          </div>
          <article className="mt-4 max-w-xl rounded-2xl border border-blue-200 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-black">Girapphe Plus Annual</h3>
                <p className="mt-1 text-sm text-slate-600">Automatic annual renewal · no trial</p>
              </div>
              <p className="text-right text-2xl font-black">$10.00 <span className="block text-xs font-medium text-slate-500">USD / year · tax included</span></p>
            </div>
            <form action="/api/billing/checkout" method="post" className="mt-6">
              <input type="hidden" name="plan" value="annual" />
              <button
                type="submit"
                disabled={!acquisitionEnabled || entitlement.acquisitionBlocked}
                className="min-h-12 w-full rounded-lg bg-slate-950 px-4 py-3 text-sm font-bold text-white transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {entitlement.isAdFree
                  ? 'You’re already subscribed'
                  : entitlement.acquisitionBlocked
                    ? 'Payment confirmation in progress'
                    : acquisitionEnabled
                      ? 'Subscribe annually with Creem'
                      : 'Web subscriptions coming soon'}
              </button>
            </form>
            <p className="mt-3 text-xs leading-5 text-slate-500">
              Creem hosts checkout and handles recurring payment and applicable taxes. Girapphe never stores card details.
            </p>
          </article>
        </section>

        <section aria-labelledby="refund-heading" className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 text-sm leading-6 text-slate-600">
          <h2 id="refund-heading" className="font-bold text-slate-900">Refunds and provider boundaries</h2>
          <p className="mt-2">Initial annual purchases and annual renewals are eligible for a full refund within 14 days. Standard prorated refunds are not offered after that window. Web refunds are handled manually through Creem; Apple and Google purchases follow their store refund flows.</p>
          <p className="mt-2">To change purchase providers, let the current subscription expire first. Independent payment networks cannot provide a globally atomic duplicate-purchase guarantee.</p>
        </section>

        <div className="mt-8 flex flex-wrap gap-4 text-sm font-semibold">
          <Link href="/terms" className="text-blue-700 underline">Terms</Link>
          <Link href="/privacy" className="text-blue-700 underline">Privacy</Link>
          <Link href="/support" className="text-blue-700 underline">Support</Link>
        </div>
      </div>
    </main>
  );
}
