import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { Platform } from 'react-native';
import Purchases, {
  LOG_LEVEL,
  type CustomerInfo,
  type PurchasesPackage,
} from 'react-native-purchases';
import { useMobileAuth } from '@/auth';

export const AD_FREE_ENTITLEMENT_ID = 'ad_free';

export type SubscriptionPlanId = 'monthly' | 'annual';

export type SubscriptionPlan = {
  id: SubscriptionPlanId;
  title: string;
  price: string;
  productIdentifier: string;
};

type SubscriptionState = {
  isConfigured: boolean;
  isReady: boolean;
  isBusy: boolean;
  isAdFree: boolean;
  managementUrl: string | null;
  plans: SubscriptionPlan[];
  error: string | null;
  purchase: (planId: SubscriptionPlanId) => Promise<boolean>;
  restore: () => Promise<boolean>;
  refresh: () => Promise<void>;
};

const emptyState: SubscriptionState = {
  isConfigured: false,
  isReady: true,
  isBusy: false,
  isAdFree: false,
  managementUrl: null,
  plans: [],
  error: null,
  purchase: async () => false,
  restore: async () => false,
  refresh: async () => undefined,
};

const SubscriptionContext = createContext<SubscriptionState>(emptyState);

const revenueCatIosApiKey = process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY?.trim() ?? '';
const revenueCatAndroidApiKey = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY?.trim() ?? '';
const monthlyPackageId = process.env.EXPO_PUBLIC_REVENUECAT_MONTHLY_PACKAGE_ID?.trim() || '$rc_monthly';
const annualPackageId = process.env.EXPO_PUBLIC_REVENUECAT_ANNUAL_PACKAGE_ID?.trim() || '$rc_annual';
const configuredBaseUrl = process.env.EXPO_PUBLIC_APP_BASE_URL?.trim();
export const appBaseUrl = configuredBaseUrl && /^https?:\/\//.test(configuredBaseUrl)
  ? configuredBaseUrl.replace(/\/$/, '')
  : 'https://www.girapphe.com';

let purchasesConfigured = false;
let identifiedRevenueCatUserId: string | null = null;
let purchasesIdentityTransition: Promise<unknown> = Promise.resolve();

type StoreStateSnapshot = {
  customerInfo: CustomerInfo;
  monthly?: PurchasesPackage;
  annual?: PurchasesPackage;
};

function enqueuePurchasesIdentityTransition<T>(operation: () => Promise<T>): Promise<T> {
  const pending = purchasesIdentityTransition.then(
    () => operation(),
    () => operation(),
  );
  purchasesIdentityTransition = pending.then(
    () => undefined,
    () => undefined,
  );
  return pending;
}

function getPlatformApiKey(): string {
  if (Platform.OS === 'ios') return revenueCatIosApiKey;
  if (Platform.OS === 'android') return revenueCatAndroidApiKey;
  return '';
}

function isEntitled(customerInfo: CustomerInfo): boolean {
  return Boolean(customerInfo.entitlements.active[AD_FREE_ENTITLEMENT_ID]);
}

async function readServerEntitlement(getToken: () => Promise<string | null>): Promise<boolean> {
  const token = await getToken();
  if (!token) return false;

  const response = await fetch(`${appBaseUrl}/api/billing/entitlement`, {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });
  if (!response.ok) throw new Error('Unable to verify the account subscription.');

  const body = await response.json() as { isAdFree?: unknown };
  return body.isAdFree === true;
}

function getPurchasesErrorMessage(cause: unknown): string {
  if (cause && typeof cause === 'object' && 'message' in cause) {
    const message = (cause as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) return message;
  }
  return 'The store could not complete this request. Please try again.';
}

function wasCancelled(cause: unknown): boolean {
  return Boolean(
    cause &&
      typeof cause === 'object' &&
      'userCancelled' in cause &&
      (cause as { userCancelled?: unknown }).userCancelled,
  );
}

async function readStoreState(): Promise<StoreStateSnapshot> {
  const [customerInfo, offerings] = await Promise.all([
    Purchases.getCustomerInfo(),
    Purchases.getOfferings(),
  ]);
  const offering = offerings.current;

  return {
    customerInfo,
    monthly:
      offering?.availablePackages.find((candidate) => candidate.identifier === monthlyPackageId) ??
      offering?.monthly ??
      undefined,
    annual:
      offering?.availablePackages.find((candidate) => candidate.identifier === annualPackageId) ??
      offering?.annual ??
      undefined,
  };
}

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const auth = useMobileAuth();
  const apiKey = getPlatformApiKey();
  const isConfigured = auth.configured && Boolean(apiKey);
  const [sdkReady, setSdkReady] = useState(false);
  const [storeReady, setStoreReady] = useState(false);
  const [serverReady, setServerReady] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [storeAdFree, setStoreAdFree] = useState(false);
  const [serverAdFree, setServerAdFree] = useState(false);
  const [managementUrl, setManagementUrl] = useState<string | null>(null);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [packages, setPackages] = useState<Partial<Record<SubscriptionPlanId, PurchasesPackage>>>({});
  const [error, setError] = useState<string | null>(null);

  const applyCustomerInfo = useCallback((customerInfo: CustomerInfo) => {
    setStoreAdFree(isEntitled(customerInfo));
    setManagementUrl(customerInfo.managementURL ?? null);
  }, []);

  const applyStoreState = useCallback((snapshot: StoreStateSnapshot) => {
    const { customerInfo, monthly, annual } = snapshot;
    applyCustomerInfo(customerInfo);

    setPackages({ monthly, annual });
    setPlans(
      [
        monthly
          ? {
              id: 'monthly' as const,
              title: 'Monthly',
              price: monthly.product.priceString,
              productIdentifier: monthly.product.identifier,
            }
          : null,
        annual
          ? {
              id: 'annual' as const,
              title: 'Annual',
              price: annual.product.priceString,
              productIdentifier: annual.product.identifier,
            }
          : null,
      ].filter((plan): plan is SubscriptionPlan => Boolean(plan)),
    );
  }, [applyCustomerInfo]);

  const loadStoreState = useCallback(async () => {
    const expectedUserId = auth.userId;
    const snapshot = await enqueuePurchasesIdentityTransition(readStoreState);
    if (identifiedRevenueCatUserId !== expectedUserId) return;
    applyStoreState(snapshot);
  }, [applyStoreState, auth.userId]);

  useEffect(() => {
    let cancelled = false;

    async function initialize() {
      if (!auth.isLoaded) return;

      setSdkReady(false);
      setStoreAdFree(false);
      setManagementUrl(null);
      setPlans([]);
      setPackages({});
      setStoreReady(false);
      setError(null);

      if (!isConfigured || !auth.isSignedIn || !auth.userId) {
        try {
          await enqueuePurchasesIdentityTransition(async () => {
            if (!purchasesConfigured || identifiedRevenueCatUserId === null) return;

            await Purchases.logOut();
            identifiedRevenueCatUserId = null;
          });
        } catch (cause) {
          if (!cancelled) setError(getPurchasesErrorMessage(cause));
        } finally {
          if (!cancelled) setStoreReady(true);
        }
        return;
      }

      const userId = auth.userId;

      try {
        if (__DEV__) {
          await Purchases.setLogLevel(LOG_LEVEL.DEBUG);
        }

        const snapshot = await enqueuePurchasesIdentityTransition(async () => {
          if (!purchasesConfigured) {
            Purchases.configure({ apiKey, appUserID: userId });
            purchasesConfigured = true;
            identifiedRevenueCatUserId = userId;
          } else if (identifiedRevenueCatUserId !== userId) {
            if (identifiedRevenueCatUserId !== null) {
              await Purchases.logOut();
              identifiedRevenueCatUserId = null;
            }

            await Purchases.logIn(userId);
            identifiedRevenueCatUserId = userId;
          }

          return readStoreState();
        });

        if (cancelled) return;
        setSdkReady(true);
        applyStoreState(snapshot);
      } catch (cause) {
        if (!cancelled) {
          setSdkReady(false);
          setStoreAdFree(false);
          setError(getPurchasesErrorMessage(cause));
        }
      } finally {
        if (!cancelled) setStoreReady(true);
      }
    }

    void initialize();
    return () => {
      cancelled = true;
    };
  }, [apiKey, applyStoreState, auth.isLoaded, auth.isSignedIn, auth.userId, isConfigured]);

  useEffect(() => {
    let cancelled = false;

    async function refreshServerEntitlement() {
      if (!auth.isLoaded) return;
      setServerReady(false);
      setServerAdFree(false);

      if (!auth.isSignedIn || !auth.userId) {
        setServerReady(true);
        return;
      }

      try {
        const entitled = await readServerEntitlement(auth.getToken);
        if (!cancelled) setServerAdFree(entitled);
      } catch (cause) {
        if (!cancelled) setError(getPurchasesErrorMessage(cause));
      } finally {
        if (!cancelled) setServerReady(true);
      }
    }

    void refreshServerEntitlement();
    return () => {
      cancelled = true;
    };
  }, [auth.getToken, auth.isLoaded, auth.isSignedIn, auth.userId]);

  useEffect(() => {
    if (!sdkReady) return;

    const listener = (customerInfo: CustomerInfo) => applyCustomerInfo(customerInfo);
    Purchases.addCustomerInfoUpdateListener(listener);
    return () => {
      Purchases.removeCustomerInfoUpdateListener(listener);
    };
  }, [applyCustomerInfo, sdkReady]);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const [serverEntitled] = await Promise.all([
        auth.isSignedIn ? readServerEntitlement(auth.getToken) : Promise.resolve(false),
        sdkReady ? loadStoreState() : Promise.resolve(),
      ]);
      setServerAdFree(serverEntitled);
    } catch (cause) {
      setError(getPurchasesErrorMessage(cause));
    }
  }, [auth.getToken, auth.isSignedIn, loadStoreState, sdkReady]);

  const purchase = useCallback(
    async (planId: SubscriptionPlanId) => {
      const selectedPackage = packages[planId];
      if (!sdkReady || !selectedPackage || isBusy) return false;

      setIsBusy(true);
      setError(null);
      try {
        const result = await Purchases.purchasePackage(selectedPackage);
        applyCustomerInfo(result.customerInfo);
        return isEntitled(result.customerInfo);
      } catch (cause) {
        if (!wasCancelled(cause)) setError(getPurchasesErrorMessage(cause));
        return false;
      } finally {
        setIsBusy(false);
      }
    },
    [applyCustomerInfo, isBusy, packages, sdkReady],
  );

  const restore = useCallback(async () => {
    if (!sdkReady || isBusy) return false;

    setIsBusy(true);
    setError(null);
    try {
      const customerInfo = await Purchases.restorePurchases();
      applyCustomerInfo(customerInfo);
      return isEntitled(customerInfo);
    } catch (cause) {
      setError(getPurchasesErrorMessage(cause));
      return false;
    } finally {
      setIsBusy(false);
    }
  }, [applyCustomerInfo, isBusy, sdkReady]);

  const value = useMemo<SubscriptionState>(
    () => ({
      isConfigured,
      isReady: storeReady && serverReady,
      isBusy,
      isAdFree: storeAdFree || serverAdFree,
      managementUrl,
      plans,
      error,
      purchase,
      restore,
      refresh,
    }),
    [error, isBusy, isConfigured, managementUrl, plans, purchase, refresh, restore, serverAdFree, serverReady, storeAdFree, storeReady],
  );

  return <SubscriptionContext.Provider value={value}>{children}</SubscriptionContext.Provider>;
}

export function useSubscription(): SubscriptionState {
  return useContext(SubscriptionContext);
}
