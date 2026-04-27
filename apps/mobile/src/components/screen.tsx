import { SafeAreaView, ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';

export function Screen({
  children,
  contentStyle,
}: {
  children: React.ReactNode;
  contentStyle?: ViewStyle;
}) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={[styles.content, contentStyle]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

export function Section({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[styles.section, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#08111f',
  },
  content: {
    gap: 18,
    padding: 20,
    paddingBottom: 36,
  },
  section: {
    gap: 12,
  },
});
