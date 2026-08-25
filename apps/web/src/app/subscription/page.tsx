import Link from 'next/link';
import Navbar from '@/components/navbar';
import { requireCurrentUser } from '@/lib/auth';
import {
  getStripeCustomerId,
  getSubscriptionOverview,
  hasAdFreeEntitlement,
  hasBlockingSubscription,
  isStripeTrialAvailable,
} from '@/lib/billing/database';
import { isStripeCheckoutConfigured } from '@/lib/billing/stripe';
import { getTossPlanAmount, isTossBillingConfigured } from '@/lib/billing/toss';
import TossBillingButton from '@/components/toss-billing-button';

export const dynamic = 'force-dynamic';

const ERROR_MESSAGES: Record<string, string> = {
  already_active: 'Ad-free access is already active for this account.',
  checkout_failed: 'Checkout could not be started. Please try again.',
  invalid_plan: 'Choose one of the available subscription plans.',
  not_configured: 'Web checkout is not available yet.',
  portal_failed: 'Subscription management could not be opened. Please try again.',
  subscription_exists: 'An existing subscription needs to be managed before starting another plan.',
  toss_authorization_failed: 'Toss card authorization could not be completed. No ad-free access was granted.',
  toss_cancellation_failed: 'The Toss renewal schedule could not be cancelled. Please try again.',
};

function formatDate(date: Date | null) {
  return date
    ? new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeZone: 'UTC' }).format(date)
    : null;
}

export default async function SubscriptionPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireCurrentUser();
  const searchParams = await props.searchParams;
  const [isAdFree, subscription, stripeCustomerId, trialAvailable, hasBlockingPlan] = await Promise.all([
    hasAdFreeEntitlement(user.id),
    getSubscriptionOverview(user.id),
    getStripeCustomerId(user.id).catch(() => null),
    isStripeTrialAvailable(user.id).catch(() => false),
    hasBlockingSubscription(user.id).catch(() => false),
  ]);
  const checkoutState = typeof searchParams.checkout === 'string' ? searchParams.checkout : null;
  const errorCode = typeof searchParams.error === 'string' ? searchParams.error : null;
  const checkoutConfigured = isStripeCheckoutConfigured();
  const tossConfigured = isTossBillingConfigured();
  const tossMonthlyAmount = tossConfigured ? getTossPlanAmount('monthly') : null;
  const tossAnnualAmount = tossConfigured ? getTossPlanAmount('annual') : null;
  const periodEnd = formatDate(subscription?.currentPeriodEnd ?? null);

  return (
    <main id="main-content" className="min-h-screen bg-slate-50 text-slate-950">
      <Navbar user={user} />
      <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-700">Girapphe Plus</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">See the full public knowledge map. Remove the ads.</h1>
          <p className="mt-4 text-base leading-7 text-slate-600">
            Your concepts, review state, and private knowledge graph remain free. Plus unlocks the full public
            knowledge map and removes the sponsored card shown after every five completed card actions.
          </p>
          <ul className="mt-4 grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
            <li className="rounded-xl border border-slate-200 bg-white px-4 py-3"><strong className="text-slate-900">Free:</strong> all private concepts and a representative 144-concept public map.</li>
            <li className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3"><strong className="text-blue-950">Plus:</strong> the full public map and no sponsored practice cards.</li>
          </ul>
        </div>

        {checkoutState === 'returned' && (
          <div role="status" className="mt-6 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
            Checkout returned successfully. Girapphe Plus access appears after Stripe confirms the subscription by webhook;
            this page never grants access from the redirect alone.
          </div>
        )}
        {checkoutState === 'cancelled' && (
          <div role="status" className="mt-6 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
            Checkout was cancelled. Your account was not upgraded.
          </div>
        )}
        {checkoutState === 'toss_returned' && (
          <div role="status" className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            Toss card authorization was verified and Girapphe Plus is active.
          </div>
        )}
        {checkoutState === 'toss_pending' && (
          <div role="status" className="mt-6 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
            Toss received the payment. Entitlement reconciliation is pending and the same order will not be charged again.
          </div>
        )}
        {checkoutState === 'toss_cancelled' && (
          <div role="status" className="mt-6 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
            Toss renewal is cancelled. Already-paid access remains until its displayed period end.
          </div>
        )}
        {checkoutState === 'toss_cancel_pending' && (
          <div role="status" className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Toss renewal cancellation is recorded. An in-flight payment attempt is being reconciled before the billing key is deleted.
          </div>
        )}
        {errorCode && ERROR_MESSAGES[errorCode] && (
          <div role="alert" className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {ERROR_MESSAGES[errorCode]}
          </div>
        )}

        <section aria-labelledby="current-plan-heading" className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 id="current-plan-heading" className="text-lg font-bold">Current access</h2>
              <p className="mt-1 text-sm text-slate-600">
                {isAdFree ? 'Girapphe Plus is active: full public map and ad-free practice.' : 'Free access: a 144-concept public map and a sponsored card every five completed actions.'}
              </p>
              {subscription && (
                <p className="mt-2 text-xs text-slate-500">
                  {subscription.provider === 'stripe'
                    ? 'Web · Stripe'
                    : subscription.provider === 'toss'
                      ? 'Web · Toss'
                      : subscription.store ?? 'Mobile'} · {subscription.plan} · {subscription.status}
                  {periodEnd ? ` · access through ${periodEnd}` : ''}
                  {subscription.cancelAtPeriodEnd ? ' · cancels at period end' : ''}
                </p>
              )}
            </div>
            <span className={`rounded-full px-3 py-1 text-xs font-bold ${isAdFree ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'}`}>
              {isAdFree ? 'PLUS' : 'FREE'}
            </span>
          </div>
          {stripeCustomerId && subscription?.provider === 'stripe' && (
            <form action="/api/billing/portal" method="post" className="mt-4">
              <button type="submit" className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500">
                Manage web subscription
              </button>
            </form>
          )}
          {subscription?.provider === 'revenuecat' && (
            <p className="mt-4 text-sm text-slate-600">Manage or restore this subscription from the App Store or Google Play account used for purchase.</p>
          )}
          {subscription?.provider === 'toss' && !subscription.cancelAtPeriodEnd && tossConfigured && (
            <form action="/api/billing/toss/cancel" method="post" className="mt-4">
              <button type="submit" className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500">
                Cancel Toss renewal
              </button>
            </form>
          )}
        </section>

        <section aria-labelledby="plans-heading" className="mt-8">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 id="plans-heading" className="text-2xl font-black">Choose a web plan</h2>
              <p className="mt-1 text-sm text-slate-600">
                {trialAvailable ? 'Your first account subscription includes one 14-day trial.' : 'The one-time trial has already been used.'}
              </p>
            </div>
            <p className="text-xs text-slate-500">USD pricing · cancel anytime</p>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <PlanCard
              plan="monthly"
              title="Monthly"
              price="$1"
              cadence="per month"
              trialAvailable={trialAvailable}
              disabled={!checkoutConfigured || isAdFree || hasBlockingPlan}
            />
            <PlanCard
              plan="annual"
              title="Annual"
              price="$10"
              cadence="per year"
              trialAvailable={trialAvailable}
              disabled={!checkoutConfigured || isAdFree || hasBlockingPlan}
              featured
            />
          </div>
          {!checkoutConfigured && (
            <p className="mt-4 text-sm text-amber-800">Stripe checkout activation is pending provider configuration.</p>
          )}

          <div className="mt-8 border-t border-slate-200 pt-7">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold">Korean domestic card · Toss Payments</h3>
                <p className="mt-1 text-sm text-slate-600">Automatic billing is available only after the merchant contract and supported-card checks.</p>
              </div>
              <p className="text-xs text-slate-500">KRW pricing · same Girapphe Plus access</p>
            </div>
            {tossConfigured && tossMonthlyAmount !== null && tossAnnualAmount !== null ? (
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <h4 className="font-bold">Monthly · ₩{tossMonthlyAmount.toLocaleString('ko-KR')}</h4>
                  <div className="mt-4">
                    <TossBillingButton
                      plan="monthly"
                      amountKrw={tossMonthlyAmount}
                      trialAvailable={trialAvailable}
                      disabled={isAdFree || hasBlockingPlan}
                    />
                  </div>
                </article>
                <article className="rounded-2xl border border-blue-300 bg-white p-5 shadow-sm">
                  <h4 className="font-bold">Annual · ₩{tossAnnualAmount.toLocaleString('ko-KR')}</h4>
                  <div className="mt-4">
                    <TossBillingButton
                      plan="annual"
                      amountKrw={tossAnnualAmount}
                      trialAvailable={trialAvailable}
                      disabled={isAdFree || hasBlockingPlan}
                    />
                  </div>
                </article>
              </div>
            ) : (
              <p className="mt-4 text-sm text-amber-800">Toss automatic billing remains hidden until its operational gate is explicitly enabled after the complete contract configuration and renewal scheduler are ready.</p>
            )}
          </div>
        </section>

        <div className="mt-8 flex flex-wrap gap-3 text-sm">
          <Link href="/knowledge" className="font-semibold text-blue-700 underline underline-offset-4">Explore Knowledge Map</Link>
          <Link href="/practice" className="font-semibold text-blue-700 underline underline-offset-4">Return to practice</Link>
          <Link href="/" className="font-semibold text-slate-600 underline underline-offset-4">Home</Link>
        </div>
      </div>
    </main>
  );
}

function PlanCard({
  plan,
  title,
  price,
  cadence,
  trialAvailable,
  disabled,
  featured = false,
}: {
  plan: 'monthly' | 'annual';
  title: string;
  price: string;
  cadence: string;
  trialAvailable: boolean;
  disabled: boolean;
  featured?: boolean;
}) {
  return (
    <article className={`rounded-2xl border bg-white p-6 shadow-sm ${featured ? 'border-blue-400 ring-2 ring-blue-100' : 'border-slate-200'}`}>
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-lg font-bold">{title}</h3>
        {featured && <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-bold text-blue-800">2 months free</span>}
      </div>
      <p className="mt-5"><span className="text-4xl font-black">{price}</span> <span className="text-sm text-slate-500">{cadence}</span></p>
      <p className="mt-3 text-sm text-slate-600">{trialAvailable ? '14 days free, then billed automatically.' : 'Billed immediately; no additional trial.'}</p>
      <form action="/api/billing/checkout" method="post" className="mt-6">
        <input type="hidden" name="plan" value={plan} />
        <button
          type="submit"
          disabled={disabled}
          className="w-full rounded-xl bg-slate-950 px-4 py-3 text-sm font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          {disabled ? 'Unavailable' : trialAvailable ? 'Start 14-day trial' : `Choose ${title.toLowerCase()}`}
        </button>
      </form>
    </article>
  );
}
