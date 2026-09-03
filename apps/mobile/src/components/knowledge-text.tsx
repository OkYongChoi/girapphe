import { StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { hasKnowledgeNotation } from '@stem-brain/shared';
import KnowledgeNotationDom from '@/components/knowledge-notation-dom';
import { knowledgeSourceAccessibilityText } from '@/knowledge-bundle-notation';

type Direction = 'ltr' | 'rtl';

type Props = {
  value: string;
  direction: Direction;
  inline?: boolean;
  legacyDollarMath?: boolean;
  numberOfLines?: number;
  prefix?: string;
  style?: StyleProp<TextStyle>;
};

const CONTAINER_STYLE_KEYS = [
  'alignSelf', 'backgroundColor', 'borderBottomColor', 'borderBottomEndRadius', 'borderBottomLeftRadius',
  'borderBottomRightRadius', 'borderBottomStartRadius', 'borderBottomWidth', 'borderColor', 'borderEndColor',
  'borderEndWidth', 'borderLeftColor', 'borderLeftWidth', 'borderRadius', 'borderRightColor', 'borderRightWidth',
  'borderStartColor', 'borderStartWidth', 'borderStyle', 'borderTopColor', 'borderTopEndRadius', 'borderTopLeftRadius',
  'borderTopRightRadius', 'borderTopStartRadius', 'borderTopWidth', 'borderWidth', 'flex', 'flexBasis', 'flexGrow',
  'flexShrink', 'margin', 'marginBottom', 'marginEnd', 'marginHorizontal', 'marginLeft', 'marginRight', 'marginStart',
  'marginTop', 'marginVertical', 'maxWidth', 'minWidth', 'opacity', 'overflow', 'padding', 'paddingBottom', 'paddingEnd',
  'paddingHorizontal', 'paddingLeft', 'paddingRight', 'paddingStart', 'paddingTop', 'paddingVertical', 'width',
] as const;

function containerStyle(style: TextStyle): ViewStyle {
  const result: Record<string, unknown> = {};
  for (const key of CONTAINER_STYLE_KEYS) {
    const value = style[key];
    if (value !== undefined) result[key] = value;
  }
  return result as ViewStyle;
}

function textStyle(style: TextStyle) {
  return {
    ...(typeof style.color === 'string' ? { color: style.color } : {}),
    ...(typeof style.fontFamily === 'string' ? { fontFamily: style.fontFamily } : {}),
    ...(typeof style.fontSize === 'number' ? { fontSize: style.fontSize } : {}),
    ...(style.fontStyle ? { fontStyle: style.fontStyle } : {}),
    ...(style.fontWeight ? { fontWeight: style.fontWeight } : {}),
    ...(typeof style.letterSpacing === 'number' ? { letterSpacing: style.letterSpacing } : {}),
    ...(typeof style.lineHeight === 'number' ? { lineHeight: style.lineHeight } : {}),
    ...(style.textAlign ? { textAlign: style.textAlign } : {}),
    ...(style.textTransform ? { textTransform: style.textTransform } : {}),
  };
}

export function KnowledgeText({ value, direction, inline = false, legacyDollarMath = false, numberOfLines, prefix = '', style }: Props) {
  const accessibilitySource = `${prefix}${knowledgeSourceAccessibilityText(value, legacyDollarMath)}`;
  if (!hasKnowledgeNotation(value, { legacyDollarMath })) {
    return <Text numberOfLines={numberOfLines} style={[style, { writingDirection: direction }]}>{accessibilitySource}</Text>;
  }

  const flattened = StyleSheet.flatten(style) ?? {};
  return (
    <View style={[containerStyle(flattened), !inline && styles.block]}>
      <KnowledgeNotationDom
        source={value}
        prefix={prefix}
        direction={direction}
        inline={inline}
        legacyDollarMath={legacyDollarMath}
        numberOfLines={numberOfLines}
        textStyle={textStyle(flattened)}
        dom={{
          accessibilityLabel: accessibilitySource,
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
  block: { alignSelf: 'stretch' },
});
