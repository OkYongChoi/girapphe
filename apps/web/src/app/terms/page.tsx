import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalPage } from '@/components/legal-page';

export const metadata: Metadata = {
  title: 'Terms of Use',
  description: 'Terms that apply when using the Girapphe website and mobile apps.',
};

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Use" eyebrow="Girapphe website and mobile apps" updated="August 24, 2026">
      <section>
        <h2>1. Agreement and eligibility</h2>
        <p>
          These terms apply when you access or use Girapphe. By creating an account or using the service, you agree to these terms
          and the <Link href="/privacy">Privacy Policy</Link>. You must be able to form a binding agreement in your jurisdiction;
          otherwise, a parent or legal guardian must authorize your use.
        </p>
      </section>

      <section>
        <h2>2. Your account</h2>
        <p>
          Keep your sign-in credentials secure and provide accurate account information. You are responsible for activity under your
          account until you notify us of unauthorized use. You may use guest practice without an account, but syncing, private notes,
          purchases, and restore require an authenticated account.
        </p>
      </section>

      <section>
        <h2>3. Your content and private knowledge</h2>
        <p>
          You retain ownership of content you submit. You grant Girapphe a limited license to host, copy, transform, and display that
          content only as needed to provide and secure the service. Private notes and approved personal copies remain owner-scoped;
          submitting content does not authorize us to publish it or change the public knowledge graph.
        </p>
        <p>
          Only submit material you have the right to use. Do not submit unlawful, harmful, infringing, deceptive, or privacy-invasive
          content, secrets belonging to others, or automated traffic intended to disrupt the service.
        </p>
      </section>

      <section>
        <h2>4. Learning information</h2>
        <p>
          Girapphe provides educational organization and practice tools. Generated or community-derived material can be incomplete or
          incorrect and is not professional, medical, legal, financial, or safety advice. Verify important information with qualified sources.
        </p>
      </section>

      <section>
        <h2>5. Subscriptions, renewal, and ads</h2>
        <ul>
          <li>Current prices and billing periods are shown before purchase by Girapphe or the applicable store.</li>
          <li>Subscriptions renew automatically unless canceled through the provider used to subscribe before its renewal deadline.</li>
          <li>Mobile purchases are billed and managed by Apple or Google. Restore purchases is available in the app.</li>
          <li>Ad-free access removes Girapphe sponsored practice cards while the verified <code>ad_free</code> entitlement is active.</li>
          <li>Refunds and store billing disputes are governed by the policy of the provider that processed the purchase.</li>
        </ul>
      </section>

      <section>
        <h2>6. Availability and changes</h2>
        <p>
          We may improve, replace, limit, or discontinue features and may suspend access needed to protect users, providers, or the
          service. We aim for reliable operation but do not promise uninterrupted availability or permanent storage. Keep copies of
          material you cannot afford to lose.
        </p>
      </section>

      <section>
        <h2>7. Account deletion and termination</h2>
        <p>
          You can delete your account from the in-app Account screen or the <Link href="/account/delete">web deletion page</Link>.
          Cancel App Store or Google Play renewal separately before deletion if you do not want store billing to continue. We may
          suspend or terminate accounts that materially violate these terms, subject to applicable law.
        </p>
      </section>

      <section>
        <h2>8. Disclaimers and liability</h2>
        <p>
          To the extent permitted by law, Girapphe is provided “as is” and “as available,” without implied warranties of merchantability,
          fitness for a particular purpose, or non-infringement. Girapphe is not liable for indirect, incidental, special, consequential,
          or punitive damages. Nothing in these terms excludes rights or liability that cannot legally be excluded.
        </p>
      </section>

      <section>
        <h2>9. Governing terms and contact</h2>
        <p>
          These terms are governed by the laws of the Republic of Korea, without overriding mandatory consumer protections that apply
          where you live. Before filing a formal claim, contact <a href="mailto:support@girapphe.com">support@girapphe.com</a> so we can
          try to resolve the issue. Visit <Link href="/support">Support</Link> for product help.
        </p>
      </section>
    </LegalPage>
  );
}
