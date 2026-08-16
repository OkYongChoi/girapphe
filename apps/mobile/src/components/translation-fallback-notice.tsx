import { StyleSheet, Text, View } from 'react-native';
import type { Locale } from '@stem-brain/shared';
import type { TranslationStatus } from '@/api';
import { useI18n } from '@/i18n';

type TranslationMeta = {
  resolved_locale?: Locale;
  translation_status?: TranslationStatus;
} | null | undefined;

export function TranslationFallbackNotice({ translation, dark = false }: { translation: TranslationMeta; dark?: boolean }) {
  const { locale, t } = useI18n();
  const isFallback = locale !== 'en' && (
    !translation
    || translation.resolved_locale === 'en'
    || translation.translation_status === 'fallback'
    || translation.translation_status === 'failed'
    || translation.translation_status === 'partial'
  );
  if (!isFallback) return null;
  return <View style={[styles.notice, dark && styles.noticeDark]}><Text style={[styles.text, dark && styles.textDark]}>{t('content.englishFallback')}</Text></View>;
}

const styles = StyleSheet.create({
  notice: { alignSelf: 'flex-start', borderRadius: 6, backgroundColor: '#fff7ed', paddingHorizontal: 8, paddingVertical: 5, marginTop: 8 },
  noticeDark: { backgroundColor: '#3f2d1d' },
  text: { color: '#9a3412', fontSize: 12, fontWeight: '700' },
  textDark: { color: '#fed7aa' },
});
