import { Webhook } from 'svix';

export type SuperwallSignatureHeaders = {
  'svix-id': string;
  'svix-timestamp': string;
  'svix-signature': string;
};

export function verifySuperwallSignature(
  rawBody: string,
  headers: SuperwallSignatureHeaders,
  secret: string,
): boolean {
  try {
    new Webhook(secret).verify(rawBody, headers);
    return true;
  } catch {
    return false;
  }
}
