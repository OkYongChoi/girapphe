import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  managementDestinationFor,
  subscriptionGrantsAdFree,
  type CanonicalSubscription,
} from '@stem-brain/shared';
import { useMobileAuth } from '@/auth';
import { getActiveLocale, translate, useI18n } from '@/i18n';
import {
  MOBILE_ENTITLEMENT_CONFIRMATION_POLL_MS,
  captureMobileBillingSession,
  claimSuperwallPurchaseOperation,
  isCurrentSubscriptionSession,
  readMobileBillingState,
  registerSuperwallIdentity,
  releaseSuperwallPurchaseOperation,
  requestSuperwallReconciliation,
  shouldReleaseSuperwallPurchaseOperation,
  waitForCanonicalEntitlement,
  type MobileBillingState,
  type MobileBillingSession,
  type SuperwallPurchaseOperationOutcome,
} from '@/subscription-server';
import {
  establishSuperwallIdentity,
  superwallClient,
  superwallStatusAllowsPurchase,
  superwallStatusHasAdFree,
  type LoadedSuperwallProduct,
  type MobilePlanId,
  type SuperwallSubscriptionStatus,
} from '@/superwall-client';

export const AD_FREE_ENTITLEMENT_ID = 'ad_free';
export type SubscriptionPlanId = MobilePlanId;

export type SubscriptionPlan = {
  id: SubscriptionPlanId;
  title: string;
  price: string;
  productIdentifier: string;
  hasFreeTrial: boolean;
};

type SubscriptionState = {
  isConfigured: boolean;
  isReady: boolean;
  isBusy: boolean;
  isAdFree: boolean;
  isConfirming: boolean;
  acquisitionEnabled: boolean;
  managementUrl: string | null;
  activeSubscription: CanonicalSubscription | null;
  plans: SubscriptionPlan[];
  trialProductIds: string[];
  error: string | null;
  purchase: (planId: SubscriptionPlanId) => Promise<boolean>;
  restore: () => Promise<boolean>;
  refresh: () => Promise<void>;
  resetIdentity: () => Promise<void>;
};

const emptyState: SubscriptionState = {
  isConfigured: false,
  isReady: true,
  isBusy: false,
  isAdFree: false,
  isConfirming: false,
  acquisitionEnabled: false,
  managementUrl: null,
  activeSubscription: null,
  plans: [],
  trialProductIds: [],
  error: null,
  purchase: async () => false,
  restore: async () => false,
  refresh: async () => undefined,
  resetIdentity: async () => undefined,
};

const SubscriptionContext = createContext<SubscriptionState>(emptyState);

const configuredBaseUrl = process.env.EXPO_PUBLIC_APP_BASE_URL?.trim();
export const appBaseUrl = configuredBaseUrl && /^https?:\/\//.test(configuredBaseUrl)
  ? configuredBaseUrl.replace(/\/$/, '')
  : 'https://www.girapphe.com';
const clientAcquisitionEnabled = process.env.EXPO_PUBLIC_MOBILE_BILLING_ACQUISITION_ENABLED === 'true';

function purchaseErrorMessage(): string {
  return translate(getActiveLocale(), 'subscription.storeError');
}

function confirmationMessage(): string {
  return translate(getActiveLocale(), 'subscription.confirming');
}

function activeSubscriptionOf(state: MobileBillingState | null): CanonicalSubscription | null {
  if (!state) return null;
  return state.subscriptions.find((subscription) => subscriptionGrantsAdFree(subscription))
    ?? state.subscriptions[0]
    ?? null;
}

function managementUrlOf(subscription: CanonicalSubscription | null): string | null {
  if (!subscription) return null;
  const destination = managementDestinationFor(
    subscription,
    `${appBaseUrl}/subscription`,
  );
  return destination.url;
}

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const auth = useMobileAuth();
  const { t } = useI18n();
  const sdkConfigured = Boolean(superwallClient?.configuration.apiKey);
  const acquisitionProductsConfigured = Boolean(
    superwallClient?.configuration.monthlyProductId
      && superwallClient.configuration.annualProductId,
  );
  const [isReady, setIsReady] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [serverState, setServerState] = useState<MobileBillingState | null>(null);
  const [sessionUserId, setSessionUserId] = useState<string | null>(null);
  const [localAdFree, setLocalAdFree] = useState(false);
  const [localSubscriptionStatus, setLocalSubscriptionStatus] = useState<SuperwallSubscriptionStatus['status']>('UNKNOWN');
  const [identityRegistered, setIdentityRegistered] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [loadedProducts, setLoadedProducts] = useState<LoadedSuperwallProduct[]>([]);
  const [error, setError] = useState<string | null>(null);
  const currentUserIdRef = useRef<string | null>(null);
  const serverAdFreeRef = useRef(false);
  const reconcileFlightRef = useRef<{ userId: string; promise: Promise<boolean> } | null>(null);
  currentUserIdRef.current = auth.isSignedIn ? auth.userId : null;

  const readServer = useCallback((session: MobileBillingSession) => readMobileBillingState({
    baseUrl: appBaseUrl,
    expectedUserId: session.userId,
    getToken: session.getToken,
  }), []);

  const captureCurrentBillingSession = useCallback(async (userId: string) => {
    const session = await captureMobileBillingSession({
      userId,
      getToken: auth.getToken,
    });
    if (currentUserIdRef.current !== userId) throw new Error('identity_changed');
    return session;
  }, [auth.getToken]);

  const applyServerState = useCallback((state: MobileBillingState) => {
    serverAdFreeRef.current = state.isAdFree;
    setServerState(state);
    if (state.isAdFree) setIsConfirming(false);
  }, []);

  const reconcileAndConfirm = useCallback((providedSession?: MobileBillingSession): Promise<boolean> => {
    const userId = providedSession?.userId ?? auth.userId;
    if (!auth.isSignedIn || !userId || currentUserIdRef.current !== userId) {
      return Promise.resolve(false);
    }
    const existing = reconcileFlightRef.current;
    if (existing?.userId === userId) return existing.promise;

    const isCurrentIdentity = () => currentUserIdRef.current === userId;
    const promise = (async (): Promise<boolean> => {
      if (isCurrentIdentity()) setIsConfirming(true);
      let session: MobileBillingSession;
      try {
        session = providedSession ?? await captureCurrentBillingSession(userId);
      } catch {
        if (isCurrentIdentity()) setError(confirmationMessage());
        return false;
      }
      try {
        await requestSuperwallReconciliation({
          baseUrl: appBaseUrl,
          expectedUserId: userId,
          getToken: session.getToken,
        });
      } catch {
        // A signed provider webhook may still complete while the explicit refresh
        // is temporarily unavailable, so bounded canonical polling continues.
      }

      try {
        const confirmed = await waitForCanonicalEntitlement({
          read: async () => {
            if (!isCurrentIdentity()) throw new Error('identity_changed');
            const state = await readServer(session);
            if (!isCurrentIdentity()) throw new Error('identity_changed');
            return state;
          },
          maxDurationMs: MOBILE_ENTITLEMENT_CONFIRMATION_POLL_MS,
        });
        if (!isCurrentIdentity()) return false;
        applyServerState(confirmed);
        if (!confirmed.isAdFree) {
          setIsConfirming(true);
          setError(confirmationMessage());
        }
        return confirmed.isAdFree;
      } catch {
        if (isCurrentIdentity()) {
          setIsConfirming(true);
          setError(confirmationMessage());
        }
        return false;
      }
    })().finally(() => {
      if (reconcileFlightRef.current?.promise === promise) {
        reconcileFlightRef.current = null;
      }
    });
    reconcileFlightRef.current = { userId, promise };
    return promise;
  }, [applyServerState, auth.isSignedIn, auth.userId, captureCurrentBillingSession, readServer]);

  const clearUserState = useCallback(() => {
    serverAdFreeRef.current = false;
    setIsBusy(false);
    setServerState(null);
    setSessionUserId(null);
    setLocalAdFree(false);
    setLocalSubscriptionStatus('UNKNOWN');
    setIdentityRegistered(false);
    setIsConfirming(false);
    setLoadedProducts([]);
    setError(null);
  }, []);

  const establishCurrentSuperwallIdentity = useCallback(async (session: MobileBillingSession) => {
    if (!superwallClient || !sdkConfigured) throw new Error('superwall_unavailable');
    await establishSuperwallIdentity({
      userId: session.userId,
      transitionIdentity: superwallClient.transitionIdentity,
      registerIdentity: () => registerSuperwallIdentity({
        baseUrl: appBaseUrl,
        expectedUserId: session.userId,
        getToken: session.getToken,
      }),
      isCurrentUser: (candidateUserId) => currentUserIdRef.current === candidateUserId,
    });
  }, [sdkConfigured]);

  useEffect(() => {
    let cancelled = false;
    clearUserState();
    setIsReady(false);

    async function initialize() {
      if (!auth.isLoaded) return;
      if (!auth.isSignedIn || !auth.userId) {
        await superwallClient?.resetIdentity().catch(() => undefined);
        if (!cancelled) setIsReady(true);
        return;
      }

      const userId = auth.userId;
      // Superwall persists its actor outside React and outside this process.
      // Start the A -> B reset/identify transition before any canonical network
      // read, so a Girapphe outage cannot leave the native SDK on account A.
      if (superwallClient && sdkConfigured) {
        await superwallClient.transitionIdentity(userId).catch(() => undefined);
        if (cancelled || currentUserIdRef.current !== userId) return;
      }

      let billingSession: MobileBillingSession;
      let canonical: MobileBillingState;
      try {
        billingSession = await captureCurrentBillingSession(userId);
        canonical = await readServer(billingSession);
      } catch {
        if (!cancelled && currentUserIdRef.current === userId) {
          setSessionUserId(userId);
          setError(purchaseErrorMessage());
          setIsReady(true);
        }
        return;
      }
      if (cancelled || currentUserIdRef.current !== userId) return;

      // Canonical Girapphe access is independent from Superwall availability.
      // Apply it even if the native adapter is unavailable so an SDK outage can
      // never hide a valid Creem or already-reconciled mobile entitlement.
      applyServerState(canonical);
      setSessionUserId(userId);
      setIsReady(true);

      let localStatus: SuperwallSubscriptionStatus = { status: 'UNKNOWN' };
      let registered = false;
      if (superwallClient && sdkConfigured) {
        try {
          await establishCurrentSuperwallIdentity(billingSession);
          if (cancelled || currentUserIdRef.current !== userId) return;
          localStatus = await superwallClient.readSubscriptionStatus(userId);
          if (cancelled || currentUserIdRef.current !== userId) return;
          registered = true;
        } catch {
          // Existing canonical access remains visible. Only mobile acquisition
          // and restore are unavailable until identity setup succeeds.
          if (!cancelled && !canonical.isAdFree) setError(purchaseErrorMessage());
        }
      }
      if (cancelled || currentUserIdRef.current !== userId) return;
      setIdentityRegistered(registered);
      setLocalSubscriptionStatus(localStatus.status);
      const locallySubscribed = superwallStatusHasAdFree(localStatus);
      setLocalAdFree(locallySubscribed);

      if (locallySubscribed && !canonical.isAdFree) {
        setIsConfirming(true);
        void reconcileAndConfirm(billingSession);
      }
    }

    void initialize();
    return () => { cancelled = true; };
  }, [
    acquisitionProductsConfigured,
    applyServerState,
    auth.isLoaded,
    auth.isSignedIn,
    auth.userId,
    clearUserState,
    captureCurrentBillingSession,
    establishCurrentSuperwallIdentity,
    readServer,
    reconcileAndConfirm,
    sdkConfigured,
  ]);

  useEffect(() => {
    if (
      !superwallClient
      || !sdkConfigured
      || !auth.isSignedIn
      || !auth.userId
      || sessionUserId !== auth.userId
      || !identityRegistered
    ) return;
    const subscription = superwallClient.subscribe(auth.userId, (status) => {
      if (currentUserIdRef.current !== auth.userId) return;
      const entitled = superwallStatusHasAdFree(status);
      setLocalSubscriptionStatus(status.status);
      setLocalAdFree(entitled);
      if (entitled && !serverAdFreeRef.current) {
        setIsConfirming(true);
        void reconcileAndConfirm();
      }
    });
    return () => subscription.remove();
  }, [auth.isSignedIn, auth.userId, identityRegistered, reconcileAndConfirm, sdkConfigured, sessionUserId]);

  useEffect(() => {
    if (
      !superwallClient
      || !sdkConfigured
      || !acquisitionProductsConfigured
      || !clientAcquisitionEnabled
      || !auth.isSignedIn
      || !auth.userId
      || sessionUserId !== auth.userId
      || currentUserIdRef.current !== auth.userId
      || !identityRegistered
      || localSubscriptionStatus !== 'INACTIVE'
      || !serverState?.acquisitionEnabled.mobile
      || serverState.acquisitionBlocked
      || serverState.isAdFree
      || loadedProducts.length > 0
    ) return;
    const userId = auth.userId;
    let cancelled = false;
    void superwallClient.loadProducts().then((products) => {
      if (!cancelled && currentUserIdRef.current === userId) {
        setLoadedProducts(products);
      }
    }).catch(() => {
      if (!cancelled && currentUserIdRef.current === userId) {
        setError(purchaseErrorMessage());
      }
    });
    return () => { cancelled = true; };
  }, [
    acquisitionProductsConfigured,
    auth.isSignedIn,
    auth.userId,
    identityRegistered,
    loadedProducts.length,
    localSubscriptionStatus,
    sdkConfigured,
    serverState?.acquisitionBlocked,
    serverState?.acquisitionEnabled.mobile,
    serverState?.isAdFree,
    sessionUserId,
  ]);

  const refresh = useCallback(async () => {
    const userId = auth.userId;
    if (!auth.isSignedIn || !userId || sessionUserId !== userId) return;
    const isCurrentIdentity = () => currentUserIdRef.current === userId;
    setError(null);
    let billingSession: MobileBillingSession;
    let canonical: MobileBillingState;
    try {
      billingSession = await captureCurrentBillingSession(userId);
      canonical = await readServer(billingSession);
      if (!isCurrentIdentity()) return;
      applyServerState(canonical);
    } catch {
      if (isCurrentIdentity()) setError(purchaseErrorMessage());
      return;
    }
    if (!superwallClient || !sdkConfigured) return;
    setIdentityRegistered(false);
    try {
      await establishCurrentSuperwallIdentity(billingSession);
      if (!isCurrentIdentity()) return;
      const localStatus = await superwallClient.readSubscriptionStatus(userId);
      if (!isCurrentIdentity()) return;
      setIdentityRegistered(true);
      const locallySubscribed = superwallStatusHasAdFree(localStatus);
      setLocalSubscriptionStatus(localStatus.status);
      setLocalAdFree(locallySubscribed);
      if (locallySubscribed && !canonical.isAdFree) {
        await reconcileAndConfirm(billingSession);
      }
    } catch {
      // Do not discard the canonical state already applied above.
      if (isCurrentIdentity() && !canonical.isAdFree) setError(purchaseErrorMessage());
    }
  }, [applyServerState, auth.isSignedIn, auth.userId, captureCurrentBillingSession, establishCurrentSuperwallIdentity, readServer, reconcileAndConfirm, sdkConfigured, sessionUserId]);

  const purchase = useCallback(async (planId: SubscriptionPlanId) => {
    const userId = auth.userId;
    const selected = loadedProducts.find((product) => product.plan === planId);
    if (!superwallClient || !selected || isBusy || !auth.isSignedIn || !userId || sessionUserId !== userId) return false;
    const isCurrentIdentity = () => currentUserIdRef.current === userId;
    let purchaseSession: MobileBillingSession | null = null;
    let purchaseOperationToken: string | null = null;
    let purchaseOperationOutcome: SuperwallPurchaseOperationOutcome | null = null;
    let nativePurchaseStarted = false;
    setIsBusy(true);
    setError(null);
    try {
      purchaseSession = await captureCurrentBillingSession(userId);
      const canonical = await readServer(purchaseSession);
      if (!isCurrentIdentity()) return false;
      applyServerState(canonical);
      if (canonical.isAdFree) return true;
      if (
        !clientAcquisitionEnabled
        || !canonical.acquisitionEnabled.mobile
        || canonical.acquisitionBlocked
      ) {
        setError(t('subscription.acquisitionDisabled'));
        return false;
      }

      setIdentityRegistered(false);
      try {
        await establishCurrentSuperwallIdentity(purchaseSession);
        if (!isCurrentIdentity()) return false;
        setIdentityRegistered(true);
      } catch {
        if (isCurrentIdentity()) setError(t('subscription.acquisitionDisabled'));
        return false;
      }

      const localStatus = await superwallClient.readSubscriptionStatus(userId);
      if (!isCurrentIdentity()) return false;
      if (superwallStatusHasAdFree(localStatus)) {
        setLocalSubscriptionStatus(localStatus.status);
        setLocalAdFree(true);
        return reconcileAndConfirm();
      }
      setLocalSubscriptionStatus(localStatus.status);
      if (!superwallStatusAllowsPurchase(localStatus)) {
        setError(t('subscription.acquisitionDisabled'));
        return false;
      }

      purchaseOperationToken = await claimSuperwallPurchaseOperation({
        baseUrl: appBaseUrl,
        expectedUserId: userId,
        getToken: purchaseSession.getToken,
      });
      if (!isCurrentIdentity()) {
        purchaseOperationOutcome = 'aborted_before_purchase';
        return false;
      }

      // Reconfirm both the native actor and the server-side Clerk association
      // immediately before crossing into the store purchase operation.
      await establishCurrentSuperwallIdentity(purchaseSession);
      if (!isCurrentIdentity()) {
        purchaseOperationOutcome = 'aborted_before_purchase';
        return false;
      }
      nativePurchaseStarted = true;
      const result = await superwallClient.purchase(userId, selected.purchaseIdentifier);
      if (result.type === 'unavailable') {
        // The iOS bridge reports this only when its final StoreKit product
        // refetch failed before calling Superwall.purchase(). No charge was
        // attempted, so the durable server block can be released safely.
        purchaseOperationOutcome = 'aborted_before_purchase';
        if (isCurrentIdentity()) setError(purchaseErrorMessage());
        return false;
      }
      if (result.type === 'cancelled') {
        purchaseOperationOutcome = 'cancelled';
        return false;
      }
      if (result.type === 'failed') {
        // A generic Superwall failure may wrap a StoreKit unverified
        // transaction that was already finished. Keep the durable purchase
        // block and try canonical recovery instead of allowing a second charge.
        purchaseOperationOutcome = 'indeterminate';
        if (isCurrentIdentity()) setIsConfirming(true);
        const confirmed = await reconcileAndConfirm(purchaseSession);
        purchaseOperationOutcome = confirmed ? 'canonically_confirmed' : 'indeterminate';
        return confirmed;
      }
      if (!isCurrentIdentity()) return false;

      setIsConfirming(true);
      if (result.type === 'purchased') setLocalAdFree(true);
      const confirmed = await reconcileAndConfirm(purchaseSession);
      purchaseOperationOutcome = confirmed ? 'canonically_confirmed' : 'unconfirmed';
      return confirmed;
    } catch {
      if (purchaseOperationToken && !nativePurchaseStarted) {
        purchaseOperationOutcome = 'aborted_before_purchase';
      } else if (purchaseOperationToken) {
        purchaseOperationOutcome = 'indeterminate';
      }
      if (isCurrentIdentity()) {
        setIdentityRegistered(false);
        setError(purchaseErrorMessage());
      }
      return false;
    } finally {
      if (
        purchaseOperationToken
        && purchaseSession
        && purchaseOperationOutcome
        && shouldReleaseSuperwallPurchaseOperation(purchaseOperationOutcome)
      ) {
        try {
          await releaseSuperwallPurchaseOperation({
            baseUrl: appBaseUrl,
            expectedUserId: userId,
            getToken: purchaseSession.getToken,
            ownerToken: purchaseOperationToken,
          });
        } catch {
          // The durable server block remains until an exact retry, signed
          // provider reconciliation, or the documented operator recovery.
        }
      }
      if (isCurrentIdentity()) setIsBusy(false);
    }
  }, [applyServerState, auth.getToken, auth.isSignedIn, auth.userId, captureCurrentBillingSession, establishCurrentSuperwallIdentity, isBusy, loadedProducts, readServer, reconcileAndConfirm, sessionUserId, t]);

  const restore = useCallback(async () => {
    const userId = auth.userId;
    if (!superwallClient || !sdkConfigured || isBusy || !auth.isSignedIn || !userId || sessionUserId !== userId) return false;
    const isCurrentIdentity = () => currentUserIdRef.current === userId;
    setIsBusy(true);
    setError(null);
    try {
      const billingSession = await captureCurrentBillingSession(userId);
      setIdentityRegistered(false);
      await establishCurrentSuperwallIdentity(billingSession);
      if (!isCurrentIdentity()) return false;
      setIdentityRegistered(true);
      const result = await superwallClient.restore(userId);
      if (!isCurrentIdentity()) return false;
      if (result.result !== 'restored') {
        setError(purchaseErrorMessage());
        return false;
      }
      const status = await superwallClient.readSubscriptionStatus(userId);
      if (!isCurrentIdentity()) return false;
      setLocalSubscriptionStatus(status.status);
      const locallySubscribed = superwallStatusHasAdFree(status);
      setLocalAdFree(locallySubscribed);
      if (locallySubscribed) return reconcileAndConfirm(billingSession);
      if (status.status === 'UNKNOWN') {
        setIsConfirming(true);
        setError(confirmationMessage());
      } else {
        setError(t('subscription.noActivePurchase'));
      }
      return false;
    } catch {
      if (isCurrentIdentity()) {
        setIdentityRegistered(false);
        setError(purchaseErrorMessage());
      }
      return false;
    } finally {
      if (isCurrentIdentity()) setIsBusy(false);
    }
  }, [auth.isSignedIn, auth.userId, captureCurrentBillingSession, establishCurrentSuperwallIdentity, isBusy, reconcileAndConfirm, sdkConfigured, sessionUserId, t]);

  const resetIdentity = useCallback(async () => {
    clearUserState();
    await superwallClient?.resetIdentity();
  }, [clearUserState]);

  const sessionIsCurrent = isCurrentSubscriptionSession({
    isSignedIn: auth.isSignedIn,
    currentUserId: auth.userId,
    sessionUserId,
  });
  const currentServerState = sessionIsCurrent ? serverState : null;
  const activeSubscription = activeSubscriptionOf(currentServerState);
  const acquisitionEnabled = Boolean(
    sessionIsCurrent
      && clientAcquisitionEnabled
      && currentServerState?.acquisitionEnabled.mobile
      && !currentServerState.acquisitionBlocked
      && !currentServerState.isAdFree
      && !localAdFree
      && localSubscriptionStatus === 'INACTIVE'
      && identityRegistered
      && acquisitionProductsConfigured,
  );
  const plans = loadedProducts.map((product) => ({
    id: product.plan,
    title: t(product.plan === 'monthly' ? 'subscription.monthly' : 'subscription.annual'),
    price: product.localizedPrice,
    productIdentifier: product.configuredIdentifier,
    hasFreeTrial: product.hasFreeTrial,
  }));

  const value = useMemo<SubscriptionState>(() => ({
    isConfigured: sdkConfigured,
    isReady: !auth.isSignedIn || sessionIsCurrent ? isReady : false,
    isBusy: sessionIsCurrent ? isBusy : false,
    isAdFree: currentServerState?.isAdFree === true,
    isConfirming: sessionIsCurrent ? isConfirming : false,
    acquisitionEnabled,
    managementUrl: managementUrlOf(activeSubscription),
    activeSubscription,
    plans: acquisitionEnabled ? plans : [],
    trialProductIds: acquisitionEnabled
      ? plans.filter((plan) => plan.hasFreeTrial).map((plan) => plan.productIdentifier)
      : [],
    error: sessionIsCurrent ? error : null,
    purchase,
    restore,
    refresh,
    resetIdentity,
  }), [
    acquisitionEnabled,
    activeSubscription,
    auth.isSignedIn,
    currentServerState?.isAdFree,
    error,
    isBusy,
    isConfirming,
    isReady,
    plans,
    purchase,
    refresh,
    resetIdentity,
    restore,
    sdkConfigured,
    sessionIsCurrent,
  ]);

  return <SubscriptionContext.Provider value={value}>{children}</SubscriptionContext.Provider>;
}

export function useSubscription(): SubscriptionState {
  return useContext(SubscriptionContext);
}
