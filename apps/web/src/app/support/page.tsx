import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalPage } from '@/components/legal-page';

export const metadata: Metadata = {
  title: 'Support',
  description: 'Help with Girapphe accounts, learning sync, subscriptions, ads, and account deletion.',
};

export default function SupportPage() {
  return (
    <LegalPage title="Support" eyebrow="Web, iOS, and Android" updated="August 24, 2026">
      <section>
        <h2>Get help</h2>
        <p>
          Email <a href="mailto:support@girapphe.com">support@girapphe.com</a> with the platform you use, the approximate time of the
          problem, and a short description. Do not send passwords, verification codes, payment card numbers, or private note content.
        </p>
      </section>

      <section>
        <h2>Account and sync</h2>
        <ul>
          <li>Confirm that web and mobile use the same email account.</li>
          <li>On mobile, sign out and sign back in if a session no longer syncs.</li>
          <li>Check that the device has a working network connection before retrying notes or practice updates.</li>
        </ul>
      </section>

      <section>
        <h2>Purchases</h2>
        <ul>
          <li>Use Restore purchases from the mobile subscription screen after reinstalling or changing devices.</li>
          <li>Manage or cancel Apple subscriptions from your Apple account and Google Play subscriptions from your Play account.</li>
          <li>Use Refresh purchase status from Account if ad-free access is not reflected immediately.</li>
          <li>Include a store transaction reference in support email, but never send full payment credentials.</li>
        </ul>
      </section>

      <section id="account-deletion">
        <h2>Delete your account</h2>
        <p>
          You can delete your account in the Girapphe app under Account → Delete account, or use the
          {' '}<Link href="/account/delete">web account deletion page</Link>. The web path works without reinstalling the app.
          You will be asked to sign in so the request can be verified.
        </p>
        <p>
          Account deletion removes private notes, drafts, graph data, learning progress, access tokens, and the Girapphe authentication
          record. Cancel App Store or Google Play renewal separately first. Limited financial or security records may be retained as
          described in the <Link href="/privacy">Privacy Policy</Link>.
        </p>
      </section>
    </LegalPage>
  );
}
