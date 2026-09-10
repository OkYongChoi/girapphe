import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { MAX_KNOWLEDGE_TAG_CODE_POINTS, MAX_KNOWLEDGE_TAGS } from '@stem-brain/shared';
import {
  commitMobileKnowledgeTagDraft,
  filterMobileKnowledgeTagSuggestions,
  removeMobileKnowledgeTag,
  updateMobileKnowledgeTagDraft,
  type MobileKnowledgeTagNotice,
} from '@/mobile-knowledge-tags';

type KnowledgeTagPickerProps = {
  value: readonly string[];
  draft: string;
  suggestions: readonly string[];
  disabled?: boolean;
  onChange: (tags: string[]) => void;
  onDraftChange: (draft: string) => void;
  labels: {
    label: string;
    placeholder: string;
    select: string;
    search: string;
    noMatches: string;
    help: string;
    limit: string;
    length: string;
    invalid: string;
    close: string;
    remove: string;
  };
};

export function KnowledgeTagPicker({ value, draft, suggestions, disabled = false, onChange, onDraftChange, labels }: KnowledgeTagPickerProps) {
  const [notice, setNotice] = useState<MobileKnowledgeTagNotice>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestionQuery, setSuggestionQuery] = useState('');
  const visibleSuggestions = useMemo(
    () => filterMobileKnowledgeTagSuggestions(suggestions, value, suggestionQuery),
    [suggestionQuery, suggestions, value],
  );
  const hasUnselectedSuggestions = useMemo(
    () => filterMobileKnowledgeTagSuggestions(suggestions, value, '').length > 0,
    [suggestions, value],
  );
  const atLimit = value.length >= MAX_KNOWLEDGE_TAGS;
  const status = atLimit || notice === 'limit'
    ? labels.limit
    : notice === 'length'
      ? labels.length
      : notice === 'invalid'
        ? labels.invalid
        : labels.help;

  function closeSuggestions() {
    setShowSuggestions(false);
    setSuggestionQuery('');
  }

  function updateDraft(nextValue: string) {
    if (disabled) return;
    const next = updateMobileKnowledgeTagDraft(value, nextValue);
    if (next.tags.join('\0') !== value.join('\0')) onChange(next.tags);
    onDraftChange(next.draft);
    setNotice(next.notice);
    if (next.draft.trim()) closeSuggestions();
    if (next.tags.length >= MAX_KNOWLEDGE_TAGS) closeSuggestions();
  }

  function commitDraft() {
    if (disabled) return;
    const next = commitMobileKnowledgeTagDraft(value, draft);
    onChange(next.tags);
    onDraftChange(next.draft);
    setNotice(next.notice);
    if (next.tags.length >= MAX_KNOWLEDGE_TAGS) closeSuggestions();
  }

  function selectSuggestion(tag: string) {
    if (disabled) return;
    const next = commitMobileKnowledgeTagDraft(value, tag);
    onChange(next.tags);
    onDraftChange('');
    setNotice(next.notice);
    closeSuggestions();
  }

  return (
    <View accessibilityLabel={labels.label} style={styles.root}>
      <Text style={styles.label}>{labels.label}</Text>
      {value.length > 0 ? (
        <View accessibilityRole="list" style={styles.chips}>
          {value.map((tag) => (
            <View key={tag} style={styles.chip}>
              <Text style={styles.chipText}>#{tag}</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${labels.remove} #${tag}`}
                accessibilityState={{ disabled }}
                disabled={disabled}
                onPress={() => {
                  onChange(removeMobileKnowledgeTag(value, tag));
                  setNotice(null);
                }}
                style={[styles.removeButton, disabled && styles.disabled]}
              >
                <Text aria-hidden style={styles.removeText}>×</Text>
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}
      <TextInput
        accessibilityLabel={labels.label}
        accessibilityState={{ disabled: disabled || atLimit }}
        editable={!disabled && !atLimit}
        value={draft}
        onChangeText={updateDraft}
        onSubmitEditing={commitDraft}
        blurOnSubmit={false}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="done"
        placeholder={labels.placeholder}
        style={[styles.input, (disabled || atLimit) && styles.disabled]}
      />
      {!disabled && !atLimit && !draft.trim() && hasUnselectedSuggestions ? (
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: showSuggestions }}
          onPress={() => setShowSuggestions((current) => !current)}
          style={styles.suggestionToggle}
        >
          <Text style={styles.suggestionToggleText}>{labels.select}</Text>
        </Pressable>
      ) : null}
      {showSuggestions && !disabled && !draft.trim() ? (
        <View style={styles.suggestionPanel}>
          <TextInput
            accessibilityLabel={labels.search}
            value={suggestionQuery}
            onChangeText={setSuggestionQuery}
            placeholder={labels.search}
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.input}
          />
          {visibleSuggestions.length > 0 ? (
            <View accessibilityRole="list" style={styles.suggestions}>
              {visibleSuggestions.map((tag) => (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${labels.select}: #${tag}`}
                  key={tag}
                  onPress={() => selectSuggestion(tag)}
                  style={styles.suggestion}
                >
                  <Text style={styles.suggestionText}>#{tag}</Text>
                </Pressable>
              ))}
            </View>
          ) : <Text style={styles.status}>{labels.noMatches}</Text>}
          <Pressable accessibilityRole="button" onPress={closeSuggestions} style={styles.closeButton}>
            <Text style={styles.closeText}>{labels.close}</Text>
          </Pressable>
        </View>
      ) : null}
      <Text accessibilityLiveRegion={status === labels.help ? 'none' : 'polite'} style={styles.status}>
        {status}
      </Text>
      <Text style={styles.count}>{value.length}/{MAX_KNOWLEDGE_TAGS} · {MAX_KNOWLEDGE_TAG_CODE_POINTS}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 8 },
  label: { color: '#374151', fontSize: 13, fontWeight: '800' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { maxWidth: '100%', minHeight: 44, flexDirection: 'row', alignItems: 'center', borderRadius: 999, backgroundColor: '#f1f5f9', paddingLeft: 12 },
  chipText: { flexShrink: 1, color: '#334155', fontSize: 13, fontWeight: '700' },
  removeButton: { minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 999 },
  removeText: { color: '#475569', fontSize: 22, lineHeight: 24 },
  input: { minHeight: 44, borderColor: '#d8dee8', borderWidth: 1, borderRadius: 8, padding: 12, fontSize: 15, backgroundColor: '#fff' },
  disabled: { backgroundColor: '#f8fafc', opacity: 0.65 },
  suggestionToggle: { minHeight: 44, alignSelf: 'flex-start', justifyContent: 'center', borderColor: '#cbd5e1', borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, backgroundColor: '#fff' },
  suggestionToggleText: { color: '#1d4ed8', fontSize: 13, fontWeight: '800' },
  suggestionPanel: { gap: 8, borderColor: '#d8dee8', borderWidth: 1, borderRadius: 10, padding: 10, backgroundColor: '#fff' },
  suggestions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  suggestion: { minHeight: 44, maxWidth: '100%', justifyContent: 'center', borderRadius: 999, backgroundColor: '#eff6ff', paddingHorizontal: 12 },
  suggestionText: { flexShrink: 1, color: '#1d4ed8', fontSize: 13, fontWeight: '700' },
  closeButton: { minHeight: 44, alignSelf: 'flex-end', justifyContent: 'center', paddingHorizontal: 8 },
  closeText: { color: '#475569', fontSize: 13, fontWeight: '800' },
  status: { color: '#64748b', fontSize: 12, lineHeight: 17 },
  count: { color: '#64748b', fontSize: 11, fontVariant: ['tabular-nums'] },
});
