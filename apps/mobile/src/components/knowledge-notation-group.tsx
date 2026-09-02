import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import type { KnowledgeBundleNotationBlock } from '@/knowledge-bundle-notation';
import {
  knowledgeBundleNotationAccessibilityText,
  knowledgeBundleNotationBlocksHaveNotation,
} from '@/knowledge-bundle-notation';
import KnowledgeNotationDom from '@/components/knowledge-notation-dom';

type Props = {
  accessibilityLabel?: string;
  blocks: KnowledgeBundleNotationBlock[];
  children: ReactNode;
  direction: 'ltr' | 'rtl';
  style?: StyleProp<ViewStyle>;
};

/**
 * Keeps plain cards entirely native, while notation-rich cards cross the Expo
 * DOM boundary once for the whole card instead of once per field.
 */
export function KnowledgeNotationGroup({ accessibilityLabel, blocks, children, direction, style }: Props) {
  if (!knowledgeBundleNotationBlocksHaveNotation(blocks)) return <>{children}</>;

  const sourceLabel = knowledgeBundleNotationAccessibilityText(blocks);
  const combinedLabel = accessibilityLabel && !sourceLabel.split('\n').includes(accessibilityLabel)
    ? `${accessibilityLabel}\n${sourceLabel}`
    : sourceLabel;
  return (
    <View style={[styles.root, style]}>
      <KnowledgeNotationDom
        bundleBlocks={blocks}
        direction={direction}
        dom={{
          accessibilityLabel: combinedLabel,
          bounces: false,
          directionalLockEnabled: true,
          matchContents: true,
          nestedScrollEnabled: false,
          showsHorizontalScrollIndicator: true,
          showsVerticalScrollIndicator: false,
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { alignSelf: 'stretch' },
});
