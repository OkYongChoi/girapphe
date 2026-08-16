import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { Alert, FlatList, Pressable, SafeAreaView, StyleSheet, Text, TextInput, View } from 'react-native';
import { AuthRequired } from '@/components/auth-required';
import { mobileApi, type PersonalNote } from '@/api';
import { useI18n } from '@/i18n';

export default function NotesScreen() {
  return <AuthRequired><NotesContent /></AuthRequired>;
}

function NotesContent() {
  const { direction, formatDate, formatNumber, locale, t } = useI18n();
  const [items, setItems] = useState<PersonalNote[]>([]);
  const [title, setTitle] = useState('');
  const [topic, setTopic] = useState('');
  const [content, setContent] = useState('');
  const [query, setQuery] = useState('');
  const [selectedTopic, setSelectedTopic] = useState('all');
  const [sortBy, setSortBy] = useState<'created' | 'updated' | 'title'>('created');
  const [editing, setEditing] = useState<PersonalNote | null>(null);
  const [isTrash, setIsTrash] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (view = isTrash) => {
    setLoading(true); setError(null);
    try { setItems((await mobileApi.notes(view ? 'trash' : 'active')).items); }
    catch (reason) { setError(reason instanceof Error ? reason.message : t('notes.loadError')); }
    finally { setLoading(false); }
  }, [isTrash, t]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  async function addNote() {
    if (!title.trim() || submitting) return;
    setSubmitting(true); setError(null);
    try {
      if (editing) {
        await mobileApi.mutate({ action: 'update-note', id: editing.id, title, topic, content });
      } else {
        await mobileApi.mutate({ action: 'create-note', title, topic, content, requestId: `${Date.now()}-${Math.random()}` });
      }
      setTitle(''); setTopic(''); setContent(''); setEditing(null); await load(false);
    } catch (reason) { setError(reason instanceof Error ? reason.message : t('notes.saveError')); }
    finally { setSubmitting(false); }
  }

  async function changeView(nextTrash: boolean) { setIsTrash(nextTrash); await load(nextTrash); }
  function deleteNote(note: PersonalNote) {
    Alert.alert(t('notes.trashConfirmTitle'), t('notes.trashConfirmBody', { title: note.title, days: formatNumber(14) }), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('notes.moveToTrash'), style: 'destructive', onPress: () => void mobileApi.mutate({ action: 'delete-note', id: note.id }).then(() => load(false)).catch((reason) => setError(reason.message)) },
    ]);
  }
  async function restoreNote(note: PersonalNote) {
    try { await mobileApi.mutate({ action: 'restore-note', id: note.id }); await load(true); }
    catch (reason) { setError(reason instanceof Error ? reason.message : t('notes.restoreError')); }
  }
  function startEdit(note: PersonalNote) { setEditing(note); setTitle(note.title); setTopic(note.topic); setContent(note.content); }
  const topics = Array.from(new Set(items.map((item) => item.topic))).sort();
  const visibleItems = items.filter((item) => {
    const matchesQuery = !query.trim() || `${item.title} ${item.topic} ${item.content}`.toLowerCase().includes(query.trim().toLowerCase());
    return matchesQuery && (selectedTopic === 'all' || item.topic === selectedTopic);
  }).sort((a, b) => sortBy === 'title' ? a.title.localeCompare(b.title, locale) : +new Date(b[sortBy === 'updated' ? 'updated_at' : 'created_at']) - +new Date(a[sortBy === 'updated' ? 'updated_at' : 'created_at']));

  return (
    <SafeAreaView style={[styles.safeArea, { direction }]}>
      <FlatList data={visibleItems} keyExtractor={(item) => item.id} contentContainerStyle={styles.content}
        ListHeaderComponent={<View>
          <Text style={styles.kicker}>{t('notes.private')}</Text><Text style={styles.title}>{t('notes.title')}</Text>
          <View style={styles.tabs}><Pressable accessibilityRole="tab" accessibilityState={{ selected: !isTrash }} onPress={() => void changeView(false)} style={[styles.tab, !isTrash && styles.activeTab]}><Text>{t('notes.myNotes')}</Text></Pressable><Pressable accessibilityRole="tab" accessibilityState={{ selected: isTrash }} onPress={() => void changeView(true)} style={[styles.tab, isTrash && styles.activeTab]}><Text>{t('notes.trash')}</Text></Pressable></View>
          {!isTrash && <View style={styles.form}><TextInput accessibilityLabel={t('notes.titlePlaceholder')} value={title} onChangeText={setTitle} placeholder={t('notes.titlePlaceholder')} style={styles.input}/><TextInput accessibilityLabel={t('notes.topicPlaceholder')} value={topic} onChangeText={setTopic} placeholder={t('notes.topicPlaceholder')} style={styles.input}/><TextInput accessibilityLabel={t('notes.contentPlaceholder')} value={content} onChangeText={setContent} placeholder={t('notes.contentPlaceholder')} multiline style={[styles.input, styles.contentInput]}/><Pressable accessibilityRole="button" disabled={!title.trim() || submitting} onPress={() => void addNote()} style={[styles.addButton, (!title.trim() || submitting) && styles.disabled]}><Text style={styles.addButtonText}>{submitting ? t('notes.saving') : editing ? t('notes.saveChanges') : t('notes.add')}</Text></Pressable>{editing ? <Pressable accessibilityRole="button" onPress={() => { setEditing(null); setTitle(''); setTopic(''); setContent(''); }}><Text style={styles.action}>{t('notes.cancelEdit')}</Text></Pressable> : null}</View>}
          <TextInput accessibilityLabel={t('notes.search')} value={query} onChangeText={setQuery} placeholder={t('notes.search')} style={styles.input}/>
          <View style={styles.filterRow}><Pressable accessibilityRole="button" accessibilityState={{ selected: selectedTopic === 'all' }} onPress={() => setSelectedTopic('all')} style={[styles.filter, selectedTopic === 'all' && styles.activeTab]}><Text>{t('notes.allTopics')}</Text></Pressable>{topics.map((value) => <Pressable accessibilityRole="button" accessibilityState={{ selected: selectedTopic === value }} key={value} onPress={() => setSelectedTopic(value)} style={[styles.filter, selectedTopic === value && styles.activeTab]}><Text>{value}</Text></Pressable>)}</View>
          <View style={styles.filterRow}>{(['created', 'updated', 'title'] as const).map((value) => <Pressable accessibilityRole="button" accessibilityState={{ selected: sortBy === value }} key={value} onPress={() => setSortBy(value)} style={[styles.filter, sortBy === value && styles.activeTab]}><Text>{value === 'created' ? t('notes.recentlyAdded') : value === 'updated' ? t('notes.recentlyUpdated') : t('notes.alphabetical')}</Text></Pressable>)}</View>
          {error && <Text style={styles.error}>{error}</Text>}
          {loading && <Text style={styles.meta}>{t('common.loading')}</Text>}
        </View>}
        ListEmptyComponent={!loading ? <Text style={styles.meta}>{isTrash ? t('notes.emptyTrash') : t('notes.empty')}</Text> : null}
        renderItem={({ item }) => <View style={styles.note}><Text style={styles.noteTitle}>{item.title}</Text><Text style={styles.meta}>{item.topic ? `${item.topic} · ` : ''}{formatDate(item.updated_at)}</Text>{item.content ? <Text style={styles.noteContent}>{item.content}</Text> : null}{!isTrash ? <Pressable accessibilityRole="button" accessibilityLabel={`${t('notes.edit')} ${item.title}`} onPress={() => startEdit(item)}><Text style={styles.action}>{t('notes.edit')}</Text></Pressable> : null}<Pressable accessibilityRole="button" accessibilityLabel={`${isTrash ? t('notes.restore') : t('notes.moveToTrash')} ${item.title}`} onPress={() => isTrash ? void restoreNote(item) : deleteNote(item)}><Text style={styles.action}>{isTrash ? t('notes.restore') : t('notes.moveToTrash')}</Text></Pressable></View>}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({ safeArea:{flex:1,backgroundColor:'#f7f8fb'},content:{padding:20,paddingBottom:32,gap:12},kicker:{color:'#47606f',fontSize:13,fontWeight:'800',textTransform:'uppercase'},title:{color:'#111827',fontSize:32,fontWeight:'800',marginBottom:14},tabs:{flexDirection:'row',gap:8,marginBottom:12},tab:{backgroundColor:'#fff',borderColor:'#d8dee8',borderWidth:1,borderRadius:8,paddingHorizontal:14,paddingVertical:10},activeTab:{backgroundColor:'#dbeafe',borderColor:'#2563eb'},filterRow:{flexDirection:'row',gap:8,overflow:'hidden'},filter:{backgroundColor:'#fff',borderColor:'#d8dee8',borderWidth:1,borderRadius:8,paddingHorizontal:10,paddingVertical:8},form:{backgroundColor:'#fff',borderRadius:12,padding:14,gap:10,marginBottom:14},input:{borderColor:'#d8dee8',borderWidth:1,borderRadius:8,padding:12,fontSize:15,backgroundColor:'#fff'},contentInput:{minHeight:96,textAlignVertical:'top'},addButton:{backgroundColor:'#111827',borderRadius:8,padding:13},disabled:{opacity:.45},addButtonText:{color:'#fff',fontWeight:'800',textAlign:'center'},note:{backgroundColor:'#fff',borderRadius:12,padding:16,gap:6},noteTitle:{color:'#111827',fontSize:17,fontWeight:'800'},noteContent:{color:'#374151',fontSize:15,lineHeight:22},meta:{color:'#607080',fontSize:13},action:{color:'#2563eb',fontWeight:'800',marginTop:4},error:{color:'#b91c1c',marginBottom:12} });
