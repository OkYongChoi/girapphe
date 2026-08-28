export type TossBillingPlan = 'monthly' | 'annual';

type TossBillingConfig = {
  clientKey: string;
  secretKey: string;
  encryptionKey: Uint8Array;
  monthlyAmountKrw: number;
  annualAmountKrw: number;
};

type TossBillingAuthorization = {
  billingKey: string;
  customerKey: string;
};

const EXCLUSIVE_PROVIDER_SERVER_KEYS = [
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'STRIPE_PRICE_AD_FREE_MONTHLY',
  'STRIPE_PRICE_AD_FREE_ANNUAL',
  'REVENUECAT_WEBHOOK_AUTHORIZATION',
  'REVENUECAT_WEBHOOK_SIGNING_SECRET',
  'REVENUECAT_APP_IDS',
  'REVENUECAT_SECRET_API_KEY',
  'REVENUECAT_PRODUCT_AD_FREE_MONTHLY_IDS',
  'REVENUECAT_PRODUCT_AD_FREE_ANNUAL_IDS',
] as const;

// A billing-key delete/adopt operation needs a provider-tested global
// fingerprint lock before Toss can be activated. Keep this compile-time fuse
// closed; tests may exercise the staged implementation only in NODE_ENV=test.
const TOSS_BILLING_RUNTIME_APPROVED = false;

function hasTossBillingTestOverride() {
  return process.env.NODE_ENV === 'test'
    && process.env.TOSS_BILLING_TEST_OVERRIDE === 'true';
}

export type TossPayment = {
  paymentKey: string;
  orderId: string;
  status: string;
  totalAmount: number;
  currency?: string;
  card?: Record<string, unknown> | null;
};

export class TossBillingError extends Error {
  readonly code: string;

  constructor(message: string, code = 'TOSS_BILLING_ERROR') {
    super(message);
    this.name = 'TossBillingError';
    this.code = code;
  }
}

export class TossProviderRequestError extends TossBillingError {
  constructor(
    message: string,
    code: string,
    readonly outcome: 'definite_rejection' | 'indeterminate',
    options?: ErrorOptions,
  ) {
    super(message, code);
    this.name = 'TossProviderRequestError';
    if (options?.cause !== undefined) this.cause = options.cause;
  }
}

export function isTossBillingEnabled() {
  return process.env.TOSS_BILLING_ENABLED === 'true';
}

function readPositiveInteger(name: string) {
  const raw = process.env[name]?.trim() ?? '';
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new TossBillingError(`${name} must be a positive integer.`, 'TOSS_CONFIGURATION_ERROR');
  }
  return value;
}

function decodeEncryptionKey(raw: string) {
  try {
    const bytes = Buffer.from(raw, 'base64');
    if (bytes.byteLength !== 32) throw new Error('wrong_length');
    return new Uint8Array(bytes);
  } catch {
    throw new TossBillingError(
      'TOSS_BILLING_ENCRYPTION_KEY must be a base64-encoded 32-byte key.',
      'TOSS_CONFIGURATION_ERROR'
    );
  }
}

export function getTossBillingConfig(): TossBillingConfig {
  if (!isTossBillingEnabled()) {
    throw new TossBillingError(
      'Toss recurring billing is disabled by the operational gate.',
      'TOSS_BILLING_DISABLED'
    );
  }

  if (!TOSS_BILLING_RUNTIME_APPROVED && !hasTossBillingTestOverride()) {
    throw new TossBillingError(
      'Toss recurring billing is staged but not approved for runtime activation.',
      'TOSS_ACTIVATION_PENDING'
    );
  }

  if (EXCLUSIVE_PROVIDER_SERVER_KEYS.some((name) => Boolean(process.env[name]?.trim()))) {
    throw new TossBillingError(
      'Toss recurring billing cannot run while Stripe or RevenueCat server configuration is present.',
      'TOSS_PROVIDER_CONFLICT'
    );
  }

  const clientKey = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY?.trim() ?? '';
  const secretKey = process.env.TOSS_SECRET_KEY?.trim() ?? '';
  const encryptionKey = process.env.TOSS_BILLING_ENCRYPTION_KEY?.trim() ?? '';
  const cronToken = process.env.TOSS_BILLING_CRON_TOKEN?.trim() ?? '';

  if (!/^(test|live)_ck_/.test(clientKey)) {
    throw new TossBillingError('Toss client key is not configured.', 'TOSS_CONFIGURATION_ERROR');
  }
  if (!/^(test|live)_(g)?sk_/.test(secretKey)) {
    throw new TossBillingError('Toss secret key is not configured.', 'TOSS_CONFIGURATION_ERROR');
  }
  if (clientKey.startsWith('test_') !== secretKey.startsWith('test_')) {
    throw new TossBillingError('Toss client and secret keys must use the same environment.', 'TOSS_CONFIGURATION_ERROR');
  }
  if (cronToken.length < 32) {
    throw new TossBillingError('Toss renewal scheduler is not configured.', 'TOSS_CONFIGURATION_ERROR');
  }

  return {
    clientKey,
    secretKey,
    encryptionKey: decodeEncryptionKey(encryptionKey),
    monthlyAmountKrw: readPositiveInteger('TOSS_MONTHLY_AMOUNT_KRW'),
    annualAmountKrw: readPositiveInteger('TOSS_ANNUAL_AMOUNT_KRW'),
  };
}

export function isTossBillingConfigured() {
  try {
    getTossBillingConfig();
    return true;
  } catch {
    return false;
  }
}

export function getTossPlanAmount(plan: TossBillingPlan) {
  const config = getTossBillingConfig();
  return plan === 'monthly' ? config.monthlyAmountKrw : config.annualAmountKrw;
}

export function createTossCheckoutState() {
  return crypto.randomUUID().replaceAll('-', '');
}

export function isTossCheckoutState(value: string): boolean {
  return /^[a-f0-9]{32}$/.test(value);
}

function toBase64Url(bytes: Uint8Array) {
  return Buffer.from(bytes).toString('base64url');
}

function fromBase64Url(value: string) {
  return new Uint8Array(Buffer.from(value, 'base64url'));
}

function toArrayBuffer(bytes: Uint8Array) {
  return Uint8Array.from(bytes).buffer;
}

async function importEncryptionKey(rawKey: Uint8Array) {
  return crypto.subtle.importKey('raw', toArrayBuffer(rawKey), { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

export async function encryptTossBillingKey(billingKey: string) {
  const config = getTossBillingConfig();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await importEncryptionKey(config.encryptionKey);
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: toArrayBuffer(iv) },
    key,
    new TextEncoder().encode(billingKey)
  );
  return `v1.${toBase64Url(iv)}.${toBase64Url(new Uint8Array(ciphertext))}`;
}

export async function decryptTossBillingKey(value: string) {
  const [version, encodedIv, encodedCiphertext] = value.split('.');
  if (version !== 'v1' || !encodedIv || !encodedCiphertext) {
    throw new TossBillingError('Stored Toss billing credential is invalid.', 'TOSS_CREDENTIAL_ERROR');
  }
  try {
    const config = getTossBillingConfig();
    const key = await importEncryptionKey(config.encryptionKey);
    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: toArrayBuffer(fromBase64Url(encodedIv)) },
      key,
      toArrayBuffer(fromBase64Url(encodedCiphertext))
    );
    return new TextDecoder().decode(plaintext);
  } catch {
    throw new TossBillingError('Stored Toss billing credential could not be decrypted.', 'TOSS_CREDENTIAL_ERROR');
  }
}

async function tossApiRequest<T>(
  path: string,
  init: {
    method: 'GET' | 'POST' | 'DELETE';
    body?: Record<string, unknown>;
    idempotencyKey?: string;
    allowEmptySuccess?: boolean;
  }
) {
  const { secretKey } = getTossBillingConfig();
  const headers = new Headers({
    Authorization: `Basic ${Buffer.from(`${secretKey}:`, 'utf8').toString('base64')}`,
    'Content-Type': 'application/json',
  });
  if (init.idempotencyKey) headers.set('Idempotency-Key', init.idempotencyKey);

  let response: Response;
  try {
    response = await fetch(`https://api.tosspayments.com${path}`, {
      method: init.method,
      headers,
      body: init.body ? JSON.stringify(init.body) : undefined,
      cache: 'no-store',
      signal: AbortSignal.timeout(65_000),
    });
  } catch (error) {
    if (init.method === 'POST') {
      throw new TossProviderRequestError(
        'The Toss Payments request outcome is indeterminate.',
        'TOSS_PROVIDER_OUTCOME_INDETERMINATE',
        'indeterminate',
        { cause: error },
      );
    }
    throw error;
  }
  const payload = await response.json().catch(() => null) as (T & { code?: string; message?: string }) | null;
  if (!response.ok || (!payload && !init.allowEmptySuccess)) {
    const code = payload?.code?.slice(0, 80) || `HTTP_${response.status}`;
    const outcome = init.method === 'POST' && (response.ok || response.status >= 500)
      ? 'indeterminate'
      : 'definite_rejection';
    throw new TossProviderRequestError(
      'Toss Payments rejected the billing request.',
      code,
      outcome,
    );
  }
  return payload as T;
}

export async function issueTossBillingKey(
  authKey: string,
  customerKey: string,
  idempotencyKey: string
) {
  const result = await tossApiRequest<TossBillingAuthorization>('/v1/billing/authorizations/issue', {
    method: 'POST',
    idempotencyKey,
    body: { authKey, customerKey },
  });
  if (!result.billingKey || result.customerKey !== customerKey) {
    throw new TossProviderRequestError(
      'Toss billing authorization returned an invalid identity.',
      'TOSS_IDENTITY_MISMATCH',
      'indeterminate',
    );
  }
  return result.billingKey;
}

export async function chargeTossBillingKey(input: {
  billingKey: string;
  customerKey: string;
  amount: number;
  orderId: string;
  orderName: string;
  customerEmail?: string;
  idempotencyKey: string;
}) {
  const payment = await tossApiRequest<TossPayment>(`/v1/billing/${encodeURIComponent(input.billingKey)}`, {
    method: 'POST',
    idempotencyKey: input.idempotencyKey,
    body: {
      customerKey: input.customerKey,
      amount: input.amount,
      orderId: input.orderId,
      orderName: input.orderName,
      ...(input.customerEmail ? { customerEmail: input.customerEmail } : {}),
    },
  });
  if (
    !payment.paymentKey
    || payment.orderId !== input.orderId
    || payment.totalAmount !== input.amount
  ) {
    throw new TossProviderRequestError(
      'Toss billing returned an invalid payment identity.',
      'TOSS_PAYMENT_IDENTITY_MISMATCH',
      'indeterminate',
    );
  }
  return payment;
}

export async function verifyTossPayment(input: {
  paymentKey: string;
  orderId: string;
  amount: number;
}) {
  const payment = await tossApiRequest<TossPayment>(
    `/v1/payments/${encodeURIComponent(input.paymentKey)}`,
    { method: 'GET' }
  );
  if (
    payment.status !== 'DONE'
    || payment.orderId !== input.orderId
    || payment.totalAmount !== input.amount
    || !payment.card
  ) {
    throw new TossBillingError('Toss payment verification did not match the expected charge.', 'TOSS_PAYMENT_MISMATCH');
  }
  return payment;
}

export async function findTossPaymentByOrderId(orderId: string) {
  try {
    return await tossApiRequest<TossPayment>(
      `/v1/payments/orders/${encodeURIComponent(orderId)}`,
      { method: 'GET' }
    );
  } catch (error) {
    if (
      error instanceof TossBillingError
      && (error.code === 'HTTP_404' || error.code === 'NOT_FOUND_PAYMENT')
    ) {
      return null;
    }
    throw error;
  }
}

export async function deleteTossBillingKey(billingKey: string) {
  await tossApiRequest<Record<string, unknown>>(`/v1/billing/${encodeURIComponent(billingKey)}`, {
    method: 'DELETE',
    allowEmptySuccess: true,
  });
}

export async function sha256Fingerprint(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Buffer.from(digest).toString('hex');
}

export async function createTossOrderId(agreementId: string, cycleKey: string | Date) {
  const normalizedCycleKey = cycleKey instanceof Date ? cycleKey.toISOString() : cycleKey;
  const fingerprint = await sha256Fingerprint(
    `${agreementId}:${normalizedCycleKey}`
  );
  return `girapphe_${fingerprint.slice(0, 40)}`;
}

export function addTossBillingPeriod(date: Date, plan: TossBillingPlan) {
  const source = new Date(date);
  const sourceDay = source.getUTCDate();
  const targetYear = source.getUTCFullYear() + (plan === 'annual' ? 1 : 0);
  const targetMonth = source.getUTCMonth() + (plan === 'monthly' ? 1 : 0);
  const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  source.setUTCFullYear(targetYear, targetMonth, Math.min(sourceDay, lastDay));
  return source;
}
