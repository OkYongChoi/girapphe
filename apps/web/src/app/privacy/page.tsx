import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalPage } from '@/components/legal-page';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'How Girapphe collects, uses, retains, and deletes account and learning data.',
};

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" eyebrow="Your data, under your control" updated="August 24, 2026">
      <section>
        <h2>1. Scope</h2>
        <p>
          This policy explains how Girapphe handles information in the Girapphe website and iOS and Android apps.
          Girapphe is a private learning and knowledge-review service. We do not automatically harvest historical
          conversations. Conversation content enters Girapphe only when you deliberately submit selected current-conversation
          material for review, editing, and approval.
        </p>
      </section>

      <section>
        <h2>2. Information we process</h2>
        <ul>
          <li>Account data, such as your email address, authentication status, and a service-specific user identifier.</li>
          <li>Learning data, including notes, reviewed drafts, saved concepts, ratings, progress, and private graph relationships.</li>
          <li>Technical data needed to operate and secure the service, such as request metadata, locale, guest/session identifiers, rate-limit records, and error logs.</li>
          <li>Subscription and transaction references, entitlement status, plan, store, renewal status, and provider event identifiers. Girapphe does not receive full App Store or Google Play payment card numbers.</li>
          <li>Advertising and consent signals needed to show, measure, limit, or remove sponsored cards. The current mobile implementation requests non-personalized ads only after the applicable consent flow permits an ad request.</li>
        </ul>
      </section>

      <section>
        <h2>3. How we use information</h2>
        <p>
          We use information to authenticate you, sync your private learning state, generate and review learning cards,
          provide search and practice, prevent abuse, maintain subscriptions, honor ad-free access, show consent-gated ads,
          debug failures, and comply with legal obligations. We do not publish your private notes or use them to mutate the public knowledge graph.
        </p>
      </section>

      <section>
        <h2>4. Service providers</h2>
        <p>
          Girapphe uses vendors that process information for specific operational purposes: Clerk for authentication; Neon/Postgres
          for application data; Cloudflare for hosting and security; RevenueCat, Apple, and Google for mobile purchases; Stripe and
          Toss Payments for supported web payments; Google Mobile Ads and its consent tooling for mobile advertising; and Expo/EAS
          for mobile builds and delivery. Each provider handles information under its own terms and privacy commitments.
        </p>
      </section>

      <section>
        <h2>5. Retention and deletion</h2>
        <p>
          Active account and learning data is kept while you use the service. A note moved to Trash is scheduled for permanent
          deletion after 14 days unless you restore it. When you delete your account, Girapphe deletes your authentication record,
          private notes, drafts, tokens, graph data, ratings, and progress. Limited billing, fraud-prevention, security, or tax records
          may be retained where reasonably necessary or legally required, without keeping your live Girapphe account.
        </p>
        <p>
          Deleting a Girapphe account does not itself cancel an App Store or Google Play subscription. Cancel store renewal before
          deletion if you do not want billing to continue. Girapphe attempts to cancel supported renewing web billing before completing deletion.
        </p>
      </section>

      <section>
        <h2>6. Your choices and rights</h2>
        <ul>
          <li>Review, edit, restore, or delete private notes from My Notes.</li>
          <li>Change supported ad privacy choices from Account in a configured mobile build.</li>
          <li>Restore purchases or manage a subscription through the store used to subscribe.</li>
          <li><Link href="/account/delete">Delete your account and associated product data</Link> from the web or the in-app Account screen.</li>
          <li>Contact <a href="mailto:privacy@girapphe.com">privacy@girapphe.com</a> for access, correction, deletion, or privacy questions.</li>
        </ul>
      </section>

      <section>
        <h2>7. Security and international processing</h2>
        <p>
          We use access controls, encrypted transport, owner-scoped data queries, secure mobile token storage, bounded requests,
          and provider signature checks. No system is perfectly secure. Service providers may process data in countries other than
          your own, subject to their applicable transfer safeguards.
        </p>
      </section>

      <section>
        <h2>8. Children</h2>
        <p>
          Girapphe is not directed to children who cannot legally consent to an online account in their jurisdiction. A parent or
          guardian who believes a child provided personal information should contact us so we can review and delete it.
        </p>
      </section>

      <section>
        <h2>9. Changes and contact</h2>
        <p>
          We may update this policy as the product or legal requirements change. We will change the effective date and provide
          additional notice when appropriate. For help, visit <Link href="/support">Support</Link> or email
          {' '}<a href="mailto:privacy@girapphe.com">privacy@girapphe.com</a>.
        </p>
      </section>
    </LegalPage>
  );
}
