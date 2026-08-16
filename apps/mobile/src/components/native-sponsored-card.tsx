import { useEffect, useState } from 'react';
import Constants from 'expo-constants';
import { Image, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import type { NativeAd } from 'react-native-google-mobile-ads';

type GoogleMobileAdsModule = typeof import('react-native-google-mobile-ads');

type NativeSponsoredCardProps = {
  onContinue: () => void;
  onUpgrade: () => void;
};

const iosAppId = process.env.EXPO_PUBLIC_ADMOB_IOS_APP_ID?.trim() ?? '';
const androidAppId = process.env.EXPO_PUBLIC_ADMOB_ANDROID_APP_ID?.trim() ?? '';
const iosNativeUnitId = process.env.EXPO_PUBLIC_ADMOB_IOS_NATIVE_UNIT_ID?.trim() ?? '';
const androidNativeUnitId = process.env.EXPO_PUBLIC_ADMOB_ANDROID_NATIVE_UNIT_ID?.trim() ?? '';
const useGoogleTestAds = Constants.expoConfig?.extra?.easBuildProfile !== 'production';

let adsInitialization: Promise<unknown> | null = null;

function getProductionNativeUnitId(): string | null {
  if (Platform.OS === 'ios') return iosAppId && iosNativeUnitId ? iosNativeUnitId : null;
  if (Platform.OS === 'android') {
    return androidAppId && androidNativeUnitId ? androidNativeUnitId : null;
  }
  return null;
}

export function NativeSponsoredCard({ onContinue, onUpgrade }: NativeSponsoredCardProps) {
  const [adsModule, setAdsModule] = useState<GoogleMobileAdsModule | null>(null);
  const [nativeAd, setNativeAd] = useState<NativeAd | null>(null);

  useEffect(() => {
    let active = true;
    let loadedAd: NativeAd | null = null;

    async function loadNativeAd() {
      try {
        const productionUnitId = getProductionNativeUnitId();
        if (!useGoogleTestAds && !productionUnitId) return;

        const module = await import('react-native-google-mobile-ads');
        const unitId = useGoogleTestAds ? module.TestIds.NATIVE : productionUnitId;
        if (!unitId) return;

        const consentInfo = await module.AdsConsent.gatherConsent();
        if (!consentInfo.canRequestAds) return;

        adsInitialization ??= module.default().initialize();
        await adsInitialization;
        loadedAd = await module.NativeAd.createForAdRequest(unitId, {
          requestNonPersonalizedAdsOnly: true,
        });

        if (!active) {
          loadedAd.destroy();
          return;
        }
        setAdsModule(module);
        setNativeAd(loadedAd);
      } catch {
        // Expo Go, unavailable native modules, network failures, and missing
        // production configuration all fall back to the non-blocking house card.
      }
    }

    void loadNativeAd();
    return () => {
      active = false;
      loadedAd?.destroy();
    };
  }, []);

  if (!adsModule || !nativeAd) {
    return <HouseSponsoredCard onContinue={onContinue} onUpgrade={onUpgrade} />;
  }

  const { NativeAdView, NativeAsset, NativeAssetType, NativeMediaView } = adsModule;

  return (
    <View>
      <NativeAdView nativeAd={nativeAd} style={styles.nativeAdCard}>
        <View style={styles.adChoicesClearance} />
        <Text style={styles.sponsoredLabel}>Sponsored</Text>

        <View style={styles.adHeader}>
          {nativeAd.icon ? (
            <NativeAsset assetType={NativeAssetType.ICON}>
              <Image source={{ uri: nativeAd.icon.url }} style={styles.adIcon} />
            </NativeAsset>
          ) : null}
          <View style={styles.adHeadingText}>
            <NativeAsset assetType={NativeAssetType.HEADLINE}>
              <Text style={styles.adHeadline} numberOfLines={2}>
                {nativeAd.headline}
              </Text>
            </NativeAsset>
            {nativeAd.advertiser ? (
              <NativeAsset assetType={NativeAssetType.ADVERTISER}>
                <Text style={styles.adAdvertiser} numberOfLines={1}>
                  {nativeAd.advertiser}
                </Text>
              </NativeAsset>
            ) : null}
          </View>
        </View>

        {nativeAd.body ? (
          <NativeAsset assetType={NativeAssetType.BODY}>
            <Text style={styles.adBody} numberOfLines={3}>
              {nativeAd.body}
            </Text>
          </NativeAsset>
        ) : null}

        <NativeMediaView resizeMode="contain" style={styles.adMedia} />

        {nativeAd.callToAction ? (
          <NativeAsset assetType={NativeAssetType.CALL_TO_ACTION}>
            <Text style={styles.adCallToAction}>{nativeAd.callToAction}</Text>
          </NativeAsset>
        ) : null}
      </NativeAdView>

      <ContinueButton onPress={onContinue} />
    </View>
  );
}

function HouseSponsoredCard({ onContinue, onUpgrade }: NativeSponsoredCardProps) {
  return (
    <View>
      <View style={styles.houseCard}>
        <Text style={styles.houseLabel}>Sponsored · Girapphe</Text>
        <Text style={styles.houseTitle}>Keep your review flow distraction-free</Text>
        <Text style={styles.houseBody}>
          Go ad-free on every practice session with a monthly or annual subscription.
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="See ad-free plans"
          onPress={onUpgrade}
          style={({ pressed }) => [styles.upgradeButton, pressed && styles.pressed]}
        >
          <Text style={styles.upgradeButtonText}>See ad-free plans</Text>
        </Pressable>
      </View>
      <ContinueButton onPress={onContinue} />
    </View>
  );
}

function ContinueButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Continue practice"
      onPress={onPress}
      style={({ pressed }) => [styles.continueButton, pressed && styles.pressed]}
    >
      <Text style={styles.continueButtonText}>Continue practice</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  nativeAdCard: {
    minHeight: 420,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d8dee8',
    backgroundColor: '#ffffff',
    padding: 16,
    overflow: 'hidden',
  },
  adChoicesClearance: {
    height: 24,
  },
  sponsoredLabel: {
    alignSelf: 'flex-start',
    borderRadius: 4,
    backgroundColor: '#fff4cc',
    color: '#6f5200',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5,
    paddingHorizontal: 7,
    paddingVertical: 4,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  adHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  adIcon: {
    width: 52,
    height: 52,
    borderRadius: 10,
  },
  adHeadingText: {
    flex: 1,
    minWidth: 0,
  },
  adHeadline: {
    color: '#111827',
    fontSize: 20,
    fontWeight: '800',
    lineHeight: 25,
  },
  adAdvertiser: {
    color: '#607080',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 4,
  },
  adBody: {
    color: '#445463',
    fontSize: 14,
    lineHeight: 21,
    marginTop: 14,
  },
  adMedia: {
    width: '100%',
    minHeight: 180,
    marginTop: 14,
    backgroundColor: '#eef1f5',
  },
  adCallToAction: {
    overflow: 'hidden',
    borderRadius: 8,
    backgroundColor: '#1f5fd1',
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
    paddingHorizontal: 16,
    paddingVertical: 13,
    textAlign: 'center',
    marginTop: 14,
  },
  houseCard: {
    minHeight: 360,
    borderRadius: 12,
    backgroundColor: '#18212f',
    padding: 22,
    justifyContent: 'center',
  },
  houseLabel: {
    color: '#b8c4d3',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 18,
  },
  houseTitle: {
    color: '#ffffff',
    fontSize: 28,
    fontWeight: '900',
    lineHeight: 34,
  },
  houseBody: {
    color: '#d7dee8',
    fontSize: 16,
    lineHeight: 24,
    marginTop: 14,
  },
  upgradeButton: {
    minHeight: 50,
    borderRadius: 8,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
  },
  upgradeButtonText: {
    color: '#111827',
    fontSize: 15,
    fontWeight: '800',
  },
  continueButton: {
    minHeight: 50,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#cbd3df',
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  continueButtonText: {
    color: '#111827',
    fontSize: 15,
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.72,
  },
});
