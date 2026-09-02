import { StyleSheet, Text, View } from 'react-native';
import type { KnowledgeBundleContent, Locale } from '@stem-brain/shared';
import { eventChronologyLabel, knowledgeBundleConfidenceLabel, knowledgeBundleQuestionStatusLabel, knowledgeBundleRecallPrompt } from '@/knowledge-bundle-ui';
import {
  buildKnowledgeBundleNotationBlocks,
  knowledgeBundleNotationAccessibilityText,
  knowledgeBundleNotationBlocksHaveNotation,
} from '@/knowledge-bundle-notation';
import KnowledgeNotationDom from '@/components/knowledge-notation-dom';
import { KnowledgeText } from '@/components/knowledge-text';

type Direction = 'ltr' | 'rtl';

function Lines({ values, direction, tone = 'plain' }: { values: string[]; direction: Direction; tone?: 'plain' | 'good' | 'warn' }) {
  if (!values.length) return null;
  return (
    <View style={styles.lines}>
      {values.map((value, index) => (
        <View key={`${index}-${value}`} style={styles.lineRow}>
          <Text style={[styles.bullet, tone === 'good' && styles.good, tone === 'warn' && styles.warn]}>•</Text>
          <KnowledgeText
            value={value}
            direction={direction}
            style={[styles.line, styles.lineContent, tone === 'good' && styles.good, tone === 'warn' && styles.warn]}
          />
        </View>
      ))}
    </View>
  );
}

function Pairs({ values, direction }: { values: Array<{ first: string; second: string }>; direction: Direction }) {
  if (!values.length) return null;
  return (
    <View style={styles.pairs}>
      {values.map((value, index) => (
        <View key={`${index}-${value.first}`} style={styles.pair}>
          <KnowledgeText value={value.first} direction={direction} style={styles.pairTitle} />
          <KnowledgeText value={value.second} direction={direction} style={styles.pairDetail} />
        </View>
      ))}
    </View>
  );
}

function hierarchyDepth(content: Extract<KnowledgeBundleContent, { type: 'structure' }>, id: string) {
  let depth = 0;
  let parent = content.components.find((item) => item.id === id)?.parent_id;
  const seen = new Set([id]);
  while (parent && !seen.has(parent) && depth < content.components.length) {
    seen.add(parent); depth += 1; parent = content.components.find((item) => item.id === parent)?.parent_id;
  }
  return depth;
}

export function MobileKnowledgeBundleView({ content, locale }: { content: KnowledgeBundleContent; locale: Locale }) {
  const label = knowledgeBundleRecallPrompt(locale, content.type);
  const direction: Direction = locale === 'ar' ? 'rtl' : 'ltr';
  const notationBlocks = buildKnowledgeBundleNotationBlocks(content, locale);

  if (knowledgeBundleNotationBlocksHaveNotation(notationBlocks)) {
    const accessibilityText = knowledgeBundleNotationAccessibilityText(notationBlocks);
    return (
      <View accessibilityLabel={label} style={styles.root}>
        <KnowledgeNotationDom
          bundleBlocks={notationBlocks}
          direction={direction}
          dom={{
            accessibilityLabel: [label, accessibilityText].filter(Boolean).join('\n'),
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

  if (content.type === 'concept') return <View accessibilityLabel={label} style={styles.root}>{content.definition ? <KnowledgeText value={content.definition} direction={direction} style={styles.hero} /> : null}<Lines values={content.key_points} direction={direction} /><Lines values={content.examples} direction={direction} tone="good" /><Lines values={content.non_examples} direction={direction} tone="warn" /><Pairs values={content.misconceptions.map((item) => ({ first: item.claim, second: item.correction }))} direction={direction} /></View>;
  if (content.type === 'procedure') return <View accessibilityLabel={label} style={styles.root}>{content.goal ? <KnowledgeText value={content.goal} direction={direction} style={styles.hero} /> : null}<Lines values={content.prerequisites} direction={direction} />{content.steps.map((step, index) => <View key={`${index}-${step.title}`} style={styles.step}><Text style={styles.stepNumber}>{index + 1}</Text><View style={styles.flex}><KnowledgeText value={step.title} direction={direction} style={styles.pairTitle} />{step.detail ? <KnowledgeText value={step.detail} direction={direction} style={styles.pairDetail} /> : null}</View></View>)}<Pairs values={content.branches.map((item) => ({ first: item.condition, second: item.action }))} direction={direction} /><Pairs values={content.failure_modes.map((item) => ({ first: item.symptom, second: item.response }))} direction={direction} /><Lines values={content.done_when} direction={direction} tone="good" /></View>;
  if (content.type === 'comparison') return <View accessibilityLabel={label} style={styles.root}><View style={styles.chips}>{content.targets.map((target) => <KnowledgeText key={target} value={target} direction={direction} inline style={styles.chip} />)}</View>{content.criteria.map((item) => <View key={item.name} style={styles.compareRow}><KnowledgeText value={item.name} direction={direction} style={styles.compareName} /><View style={styles.compareValues}>{item.values.map((value, index) => <KnowledgeText key={`${index}-${value}`} value={value} direction={direction} style={styles.compareValue} />)}</View></View>)}<Lines values={content.commonalities} direction={direction} tone="good" /><Lines values={content.differences} direction={direction} tone="warn" /><Pairs values={content.choice_guide.map((item) => ({ first: item.condition, second: item.recommendation }))} direction={direction} /></View>;
  if (content.type === 'mechanism') return <View accessibilityLabel={label} style={styles.root}><Lines values={content.causes} direction={direction} />{content.stages.map((stage, index) => <View key={`${index}-${stage.title}`}><View style={styles.stage}><KnowledgeText value={stage.title} direction={direction} style={styles.pairTitle} />{stage.detail ? <KnowledgeText value={stage.detail} direction={direction} style={styles.pairDetail} /> : null}</View>{index < content.stages.length - 1 ? <Text style={styles.arrow}>↓</Text> : null}</View>)}<Lines values={content.results} direction={direction} tone="good" /><Lines values={content.conditions} direction={direction} /><Lines values={content.exceptions} direction={direction} tone="warn" /></View>;
  if (content.type === 'structure') return <View accessibilityLabel={label} style={styles.root}>{content.purpose ? <KnowledgeText value={content.purpose} direction={direction} style={styles.hero} /> : null}{content.components.map((item) => <View key={item.id} style={[styles.component, { marginStart: hierarchyDepth(content, item.id) * 18 }]}><KnowledgeText value={item.label} direction={direction} style={styles.pairTitle} />{item.role ? <KnowledgeText value={item.role} direction={direction} style={styles.pairDetail} /> : null}</View>)}<Pairs values={content.relations.map((item) => ({ first: `${item.source_id} → ${item.target_id}`, second: item.label }))} direction={direction} /><Lines values={content.boundaries} direction={direction} tone="warn" /></View>;
  if (content.type === 'question') return <View accessibilityLabel={label} style={styles.root}>{content.question ? <KnowledgeText value={content.question} direction={direction} style={styles.hero} /> : null}{content.context ? <KnowledgeText value={content.context} direction={direction} style={styles.pairDetail} /> : null}<Lines values={content.known_facts} direction={direction} tone="good" /><Lines values={content.hypotheses} direction={direction} /><Lines values={content.next_steps} direction={direction} />{content.answer_summary ? <KnowledgeText value={content.answer_summary} direction={direction} style={styles.answer} /> : null}<Text style={styles.status}>{knowledgeBundleQuestionStatusLabel(locale, content.status)}</Text></View>;
  if (content.type === 'decision') return <View accessibilityLabel={label} style={styles.root}>{content.decision ? <KnowledgeText value={content.decision} direction={direction} style={styles.hero} /> : null}{content.context ? <KnowledgeText value={content.context} direction={direction} style={styles.pairDetail} /> : null}<Pairs values={content.options.map((item) => ({ first: item.name, second: item.tradeoffs }))} direction={direction} /><Lines values={content.criteria} direction={direction} /><Lines values={content.rationale} direction={direction} tone="good" /><Lines values={content.reconsider_when} direction={direction} tone="warn" />{content.outcome ? <KnowledgeText value={content.outcome} direction={direction} style={styles.answer} /> : null}</View>;
  if (content.type === 'event') return <View accessibilityLabel={label} style={styles.root}>{content.event ? <KnowledgeText value={content.event} direction={direction} style={styles.hero} /> : null}{content.occurred_at || content.chronology ? <KnowledgeText value={content.chronology ? eventChronologyLabel(content.chronology) : content.occurred_at} direction={direction} inline style={styles.status} /> : null}{content.context ? <KnowledgeText value={content.context} direction={direction} style={styles.pairDetail} /> : null}<Lines values={content.changes} direction={direction} tone="good" /><Lines values={content.causes} direction={direction} /><Lines values={content.consequences} direction={direction} tone="warn" /></View>;
  if (content.type === 'expression') return <View accessibilityLabel={label} style={styles.root}><View style={styles.expressionHero}><KnowledgeText value={content.expression} direction={direction} style={styles.expressionText} />{content.pronunciation ? <KnowledgeText value={content.pronunciation} direction={direction} style={styles.pronunciation} /> : null}<KnowledgeText value={content.language} direction={direction} inline style={styles.language} /></View><Lines values={content.meanings} direction={direction} /><Pairs values={content.translations.map((item) => ({ first: item.language, second: item.text }))} direction={direction} />{content.register ? <KnowledgeText value={content.register} direction={direction} inline style={styles.status} /> : null}{content.nuance ? <KnowledgeText value={content.nuance} direction={direction} style={styles.pairDetail} /> : null}<Lines values={content.usage_contexts} direction={direction} />{content.examples.map((item, index) => <View key={`${index}-${item.text}`} style={styles.evidence}><KnowledgeText value={item.text} direction={direction} style={styles.pairTitle} />{item.translation ? <KnowledgeText value={item.translation} direction={direction} style={styles.pairDetail} /> : null}{item.note ? <KnowledgeText value={item.note} direction={direction} style={styles.source} /> : null}</View>)}<Pairs values={content.contrasts.map((item) => ({ first: item.expression, second: item.difference }))} direction={direction} /><Pairs values={content.common_mistakes.map((item) => ({ first: item.incorrect, second: item.correction }))} direction={direction} /></View>;
  return <View accessibilityLabel={label} style={styles.root}>{content.claim ? <KnowledgeText value={content.claim} direction={direction} style={styles.claim} /> : null}{content.evidence.map((item, index) => <View key={`${index}-${item.statement}`} style={styles.evidence}><KnowledgeText value={item.statement} direction={direction} style={styles.pairTitle} />{item.source ? <KnowledgeText value={item.source} direction={direction} style={styles.source} /> : null}</View>)}<Lines values={content.counterevidence} direction={direction} tone="warn" /><Lines values={content.scope} direction={direction} /><Lines values={content.limitations} direction={direction} tone="warn" />{content.confidence ? <Text style={styles.confidence}>{knowledgeBundleConfidenceLabel(locale, content.confidence)}</Text> : null}</View>;
}

const styles = StyleSheet.create({
  root: { gap: 9 }, flex: { flex: 1 }, hero: { color: '#312e81', backgroundColor: '#eef2ff', borderRadius: 8, padding: 10, fontSize: 14, lineHeight: 21, fontWeight: '700' },
  lines: { gap: 4 }, lineRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 }, bullet: { color: '#374151', fontSize: 13, lineHeight: 19 }, line: { color: '#374151', fontSize: 13, lineHeight: 19 }, lineContent: { flex: 1 }, good: { color: '#166534' }, warn: { color: '#9f1239' }, pairs: { gap: 7 },
  pair: { borderStartWidth: 3, borderStartColor: '#a78bfa', paddingStart: 9 }, pairTitle: { color: '#111827', fontSize: 13, fontWeight: '800' }, pairDetail: { color: '#4b5563', fontSize: 13, lineHeight: 18, marginTop: 2 },
  step: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, backgroundColor: '#f8fafc', borderRadius: 8, padding: 9 }, stepNumber: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#2563eb', color: '#fff', textAlign: 'center', paddingTop: 3, fontSize: 12, fontWeight: '900', overflow: 'hidden' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 }, chip: { color: '#1e3a8a', backgroundColor: '#dbeafe', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5, fontSize: 12, fontWeight: '800', overflow: 'hidden' },
  compareRow: { borderColor: '#e5e7eb', borderWidth: 1, borderRadius: 8, overflow: 'hidden' }, compareName: { color: '#111827', backgroundColor: '#f3f4f6', padding: 7, fontWeight: '800' }, compareValues: { flexDirection: 'row' }, compareValue: { flex: 1, color: '#374151', padding: 7, fontSize: 12 },
  stage: { borderColor: '#bfdbfe', borderWidth: 1, borderRadius: 8, backgroundColor: '#eff6ff', padding: 9 }, arrow: { color: '#2563eb', textAlign: 'center', fontWeight: '900' }, component: { borderStartColor: '#8b5cf6', borderStartWidth: 3, backgroundColor: '#faf5ff', padding: 8, borderRadius: 6 },
  claim: { color: '#111827', backgroundColor: '#eff6ff', borderStartColor: '#2563eb', borderStartWidth: 4, padding: 11, fontSize: 15, lineHeight: 22, fontWeight: '800' }, evidence: { borderColor: '#bbf7d0', borderWidth: 1, backgroundColor: '#f0fdf4', borderRadius: 8, padding: 9 }, source: { color: '#166534', fontSize: 11, marginTop: 4 }, confidence: { alignSelf: 'flex-start', color: '#5b21b6', backgroundColor: '#ede9fe', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5, fontSize: 11, fontWeight: '900', overflow: 'hidden' },
  answer: { color: '#14532d', backgroundColor: '#f0fdf4', borderRadius: 8, padding: 10, fontSize: 14, lineHeight: 20, fontWeight: '700' }, status: { alignSelf: 'flex-start', color: '#5b21b6', backgroundColor: '#ede9fe', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5, fontSize: 11, fontWeight: '900', overflow: 'hidden' },
  expressionHero: { borderRadius: 10, backgroundColor: '#fff7ed', borderColor: '#fed7aa', borderWidth: 1, padding: 12, gap: 3 }, expressionText: { color: '#9a3412', fontSize: 20, lineHeight: 27, fontWeight: '900' }, pronunciation: { color: '#7c2d12', fontSize: 13, fontStyle: 'italic' }, language: { color: '#9a3412', fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
});
