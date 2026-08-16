import { useState } from 'react';
import { Modal, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { LOCALE_META, SUPPORTED_LOCALES } from '@stem-brain/shared';
import { useI18n } from '@/i18n';

export function LanguageSelector() {
  const [visible, setVisible] = useState(false);
  const { locale, direction, setLocale, t } = useI18n();

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('language.current', { language: LOCALE_META[locale].nativeName })}
        onPress={() => setVisible(true)}
        style={({ pressed }) => [styles.trigger, pressed && styles.pressed]}
      >
        <Text style={styles.triggerText}>🌐 {LOCALE_META[locale].nativeName}</Text>
      </Pressable>
      <Modal animationType="slide" onRequestClose={() => setVisible(false)} transparent visible={visible}>
        <SafeAreaView style={styles.backdrop}>
          <View style={[styles.sheet, { direction }]}>
            <View style={styles.header}>
              <Text style={styles.title}>{t('language.choose')}</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('common.close')}
                onPress={() => setVisible(false)}
                style={styles.close}
              >
                <Text style={styles.closeText}>{t('common.close')}</Text>
              </Pressable>
            </View>
            {SUPPORTED_LOCALES.map((option) => (
              <Pressable
                key={option}
                accessibilityRole="radio"
                accessibilityLabel={t('language.option', { language: LOCALE_META[option].nativeName })}
                accessibilityState={{ checked: option === locale }}
                onPress={() => { void setLocale(option); setVisible(false); }}
                style={[styles.option, option === locale && styles.selected]}
              >
                <Text style={styles.optionText}>{LOCALE_META[option].nativeName}</Text>
                <Text style={styles.check}>{option === locale ? '✓' : ''}</Text>
              </Pressable>
            ))}
          </View>
        </SafeAreaView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: { minHeight: 38, borderRadius: 8, borderWidth: 1, borderColor: '#d8dee8', backgroundColor: '#fff', paddingHorizontal: 10, justifyContent: 'center' },
  triggerText: { color: '#334155', fontSize: 12, fontWeight: '800' },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(15, 23, 42, 0.45)' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 28, gap: 8 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 8 },
  title: { color: '#111827', fontSize: 22, fontWeight: '800' },
  close: { minHeight: 40, justifyContent: 'center', paddingHorizontal: 8 },
  closeText: { color: '#2563eb', fontWeight: '800' },
  option: { minHeight: 52, borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0', paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  selected: { borderColor: '#2563eb', backgroundColor: '#eff6ff' },
  optionText: { color: '#111827', fontSize: 16, fontWeight: '700' },
  check: { color: '#2563eb', fontSize: 18, fontWeight: '900' },
  pressed: { opacity: 0.72 },
});
