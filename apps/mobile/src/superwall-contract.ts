export type MobileStore = 'app_store' | 'play_store';
export type MobilePlanId = 'monthly' | 'annual';

export type SuperwallProduct = {
  productIdentifier: string;
  fullIdentifier?: string;
  localizedPrice: string;
  localizedSubscriptionPeriod?: string;
  hasFreeTrial?: boolean;
};

export type SuperwallPurchaseResult =
  | { type: 'cancelled' | 'purchased' | 'pending' }
  | { type: 'unavailable'; error?: string }
  | { type: 'failed'; error?: string };

export type SuperwallSubscriptionStatus =
  | { status: 'UNKNOWN' | 'INACTIVE' }
  | { status: 'ACTIVE'; entitlements?: Array<{ id?: string }> };

export type SuperwallPlatformConfiguration = {
  apiKey: string;
  store: MobileStore;
  monthlyProductId: string;
  annualProductId: string;
};

type NativeSubscriptionStatusListener = {
  remove(): void;
};

export type SuperwallNativeModule = {
  configure(
    apiKey: string,
    options: Record<string, unknown>,
    usingPurchaseController: boolean,
    sdkVersion: string,
  ): Promise<void>;
  identify(userId: string): Promise<void>;
  reset(): Promise<void>;
  getUserAttributes(): Promise<Record<string, unknown>>;
  getProducts(productIdentifiers: string[]): Promise<SuperwallProduct[]>;
  purchaseProduct(productIdentifier: string): Promise<SuperwallPurchaseResult>;
  restorePurchases(): Promise<{ result: 'restored' | 'failed'; errorMessage?: string | null }>;
  getSubscriptionStatus(): Promise<SuperwallSubscriptionStatus>;
  addListener(
    event: 'subscriptionStatusDidChange',
    listener: (event: { to: SuperwallSubscriptionStatus }) => void,
  ): NativeSubscriptionStatusListener;
};

export type LoadedSuperwallProduct = {
  plan: MobilePlanId;
  configuredIdentifier: string;
  purchaseIdentifier: string;
  localizedPrice: string;
  hasFreeTrial: boolean;
};

function productKey(product: SuperwallProduct): string {
  return product.fullIdentifier?.trim() || product.productIdentifier.trim();
}

export function mapConfiguredProducts(
  configuration: Pick<SuperwallPlatformConfiguration, 'monthlyProductId' | 'annualProductId'>,
  products: readonly SuperwallProduct[],
): LoadedSuperwallProduct[] {
  const expected: Array<[MobilePlanId, string]> = [
    ['monthly', configuration.monthlyProductId],
    ['annual', configuration.annualProductId],
  ];

  return expected.map(([plan, configuredIdentifier]) => {
    const product = products.find((candidate) => (
      productKey(candidate) === configuredIdentifier
      || candidate.productIdentifier === configuredIdentifier
    ));
    if (!product?.localizedPrice?.trim()) {
      throw new Error(`Superwall did not load the configured ${plan} store product.`);
    }
    return {
      plan,
      configuredIdentifier,
      purchaseIdentifier: productKey(product),
      localizedPrice: product.localizedPrice,
      hasFreeTrial: product.hasFreeTrial === true,
    };
  });
}

export function superwallStatusHasAdFree(status: SuperwallSubscriptionStatus): boolean {
  return status.status === 'ACTIVE'
    && Boolean(status.entitlements?.some((entitlement) => entitlement.id === 'ad_free'));
}

export function superwallStatusAllowsPurchase(status: SuperwallSubscriptionStatus): boolean {
  return status.status === 'INACTIVE';
}

export async function establishSuperwallIdentity(input: {
  userId: string;
  transitionIdentity: (userId: string) => Promise<void>;
  registerIdentity: () => Promise<void>;
  isCurrentUser: (userId: string) => boolean;
}): Promise<void> {
  if (!input.userId || input.userId.trim() !== input.userId) {
    throw new Error('invalid_clerk_user_id');
  }
  await input.transitionIdentity(input.userId);
  if (!input.isCurrentUser(input.userId)) throw new Error('identity_changed');
  await input.registerIdentity();
  if (!input.isCurrentUser(input.userId)) throw new Error('identity_changed');
}

export function createSuperwallClient(
  nativeModule: SuperwallNativeModule,
  configuration: SuperwallPlatformConfiguration,
  nativeOptions: Record<string, unknown> = {},
) {
  let configured = false;
  let identifiedUserId: string | null = null;
  // Superwall persists its device identity across process restarts, while this
  // JavaScript marker does not. The first identity operation in every process
  // must sanitize native state before any Clerk id is identified.
  let nativeIdentitySanitized = false;
  let identityTransition: Promise<unknown> = Promise.resolve();
  const identityPropagationTimeoutMs = 5_000;
  const identityPollIntervalMs = 25;

  function enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const pending = identityTransition.then(operation, operation);
    identityTransition = pending.then(() => undefined, () => undefined);
    return pending;
  }

  async function configureIfNeeded(): Promise<void> {
    if (configured) return;
    if (!configuration.apiKey) {
      throw new Error('Superwall is not configured for this platform.');
    }
    await nativeModule.configure(configuration.apiKey, nativeOptions, false, '1.3.0');
    configured = true;
  }

  async function waitForNativeIdentity(expectedUserId: string | null): Promise<void> {
    const deadline = Date.now() + identityPropagationTimeoutMs;
    while (true) {
      const attributes = await nativeModule.getUserAttributes();
      const value = attributes.appUserId;
      const nativeUserId = typeof value === 'string' && value.length > 0 ? value : null;
      if (nativeUserId === expectedUserId) return;
      if (Date.now() >= deadline) {
        throw new Error(
          expectedUserId
            ? 'Superwall did not confirm the new Clerk identity.'
            : 'Superwall did not clear the previous Clerk identity.',
        );
      }
      await new Promise<void>((resolve) => setTimeout(resolve, identityPollIntervalMs));
    }
  }

  async function resetNativeIdentity(): Promise<void> {
    await nativeModule.reset();
    await waitForNativeIdentity(null);
  }

  async function ensureNativeIdentity(userId: string | null): Promise<void> {
    await configureIfNeeded();
    if (userId !== null && (!userId || userId.trim() !== userId)) {
      throw new Error('invalid_clerk_user_id');
    }
    if (!nativeIdentitySanitized) {
      await resetNativeIdentity();
      identifiedUserId = null;
      nativeIdentitySanitized = true;
    }
    if (identifiedUserId !== userId) {
      if (identifiedUserId !== null) {
        // Keep the previous marker until native reset succeeds so a failed
        // reset is retried and the next account is never identified on top.
        await resetNativeIdentity();
        identifiedUserId = null;
      }
      if (userId !== null) {
        try {
          await nativeModule.identify(userId);
          await waitForNativeIdentity(userId);
          identifiedUserId = userId;
        } catch (error) {
          // identify() can fail after partially mutating native state. Force a
          // full reset before the next retry instead of trusting either marker.
          identifiedUserId = null;
          nativeIdentitySanitized = false;
          throw error;
        }
      }
    } else {
      // The native SDK persists independently of this JavaScript marker. Check
      // the actor again at every identity-bound operation and fail closed if it
      // drifted instead of reading or purchasing under a stale account.
      try {
        await waitForNativeIdentity(userId);
      } catch (error) {
        identifiedUserId = null;
        nativeIdentitySanitized = false;
        throw error;
      }
    }
  }

  function transitionIdentity(userId: string | null): Promise<void> {
    return enqueue(() => ensureNativeIdentity(userId));
  }

  function resetIdentity(): Promise<void> {
    return enqueue(async () => {
      await configureIfNeeded();
      // reset() is intentionally unconditional: a failed identify() may have
      // changed native state without updating the JavaScript identity marker.
      await resetNativeIdentity();
      identifiedUserId = null;
      nativeIdentitySanitized = true;
    });
  }

  function loadProducts(): Promise<LoadedSuperwallProduct[]> {
    return enqueue(async () => {
      await configureIfNeeded();
      if (!configuration.monthlyProductId || !configuration.annualProductId) {
        throw new Error('Superwall acquisition products are not fully configured.');
      }
      const products = await nativeModule.getProducts([
        configuration.monthlyProductId,
        configuration.annualProductId,
      ]);
      return mapConfiguredProducts(configuration, products);
    });
  }

  return {
    configuration,
    transitionIdentity,
    resetIdentity,
    loadProducts,
    readSubscriptionStatus: (userId: string) => enqueue(async () => {
      await ensureNativeIdentity(userId);
      return nativeModule.getSubscriptionStatus();
    }),
    purchase: (userId: string, productIdentifier: string) => enqueue(async () => {
      await ensureNativeIdentity(userId);
      return nativeModule.purchaseProduct(productIdentifier);
    }),
    restore: (userId: string) => enqueue(async () => {
      await ensureNativeIdentity(userId);
      return nativeModule.restorePurchases();
    }),
    subscribe(userId: string, listener: (status: SuperwallSubscriptionStatus) => void) {
      return nativeModule.addListener('subscriptionStatusDidChange', ({ to }) => {
        if (identifiedUserId === userId) listener(to);
      });
    },
  };
}
