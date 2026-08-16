import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { Alert, FlatList, Pressable, SafeAreaView, StyleSheet, Text, TextInput, View } from 'react-native';
import { AuthRequired } from '@/components/auth-required';
import { mobileApi } from '@/api';
import { useI18n } from '@/i18n';
import { localizeDomain, localizeType } from '@stem-brain/shared';

type Node = { id: string; label: string; domain: string; level: number; difficulty: number; type: string };
type Edge = { id: number; source: string; target: string; type: string; weight: number };
type User = { user_id: string; mastered: number; reinforcing: number; total: number; last_updated: string | null };
type ViewName = 'nodes' | 'edges' | 'users';

const LTR_ISOLATE = '\u2066';
const POP_DIRECTIONAL_ISOLATE = '\u2069';

function isolateLTR(value: string | number): string {
  return `${LTR_ISOLATE}${value}${POP_DIRECTIONAL_ISOLATE}`;
}

export default function AdminScreen() {
  return <AuthRequired><AdminContent /></AuthRequired>;
}

function AdminContent() {
  const { direction, formatNumber, isRTL, locale, t } = useI18n();
  const [view, setView] = useState<ViewName>('nodes');
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [id, setId] = useState('');
  const [label, setLabel] = useState('');
  const [domain, setDomain] = useState('mathematics');
  const [type, setType] = useState('concept');
  const [level, setLevel] = useState('1');
  const [difficulty, setDifficulty] = useState('2');
  const [source, setSource] = useState('');
  const [target, setTarget] = useState('');
  const [weight, setWeight] = useState('1');

  const load = useCallback(async (next = view) => {
    setLoading(true);
    setError(null);
    try {
      if (next === 'nodes') setNodes((await mobileApi.adminNodes()).nodes);
      if (next === 'edges') {
        const result = await mobileApi.adminEdges();
        setEdges(result.edges);
        setNodes(result.nodes.map((node) => ({ ...node, domain: '', level: 0, difficulty: 0, type: '' })));
      }
      if (next === 'users') setUsers((await mobileApi.adminUsers()).users);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t('admin.loadError'));
    } finally { setLoading(false); }
  }, [t, view]);

  useFocusEffect(useCallback(() => { void load(); }, [load, locale]));

  function select(next: ViewName) { setView(next); void load(next); }
  async function createNode() {
    try {
      await mobileApi.mutate({ action: 'admin-create-node', id, label, domain, type, level: Number(level), difficulty: Number(difficulty) });
      setId(''); setLabel(''); await load('nodes');
    } catch (reason) { setError(reason instanceof Error ? reason.message : t('admin.createNodeError')); }
  }
  async function createEdge() {
    try {
      await mobileApi.mutate({ action: 'admin-create-edge', source, target, type, weight: Number(weight) });
      setSource(''); setTarget(''); await load('edges');
    } catch (reason) { setError(reason instanceof Error ? reason.message : t('admin.createEdgeError')); }
  }
  function deleteItem(action: 'admin-delete-node' | 'admin-delete-edge', targetId: string | number) {
    Alert.alert(t('admin.deleteTitle'), t('admin.deleteBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.delete'), style: 'destructive', onPress: () => void mobileApi.mutate({ action, id: targetId }).then(() => load()).catch((reason) => setError(reason.message)) },
    ]);
  }

  const tabLabel = (value: ViewName) => value === 'nodes' ? t('admin.nodes') : value === 'edges' ? t('admin.edges') : t('admin.users');
  const data: Array<Node | Edge | User> = view === 'nodes' ? nodes : view === 'edges' ? edges : users;
  const input = (value: string, setter: (next: string) => void, key: Parameters<typeof t>[0], keyboardType?: 'numeric' | 'decimal-pad', forceLTR = false) => (
    <TextInput accessibilityLabel={t(key)} value={value} onChangeText={setter} keyboardType={keyboardType} placeholder={t(key)} style={[styles.input, forceLTR && styles.ltrText]} />
  );

  return (
    <SafeAreaView style={[styles.safeArea, { direction }]}>
      <FlatList<Node | Edge | User>
        data={data}
        keyExtractor={(item) => view === 'nodes' ? (item as Node).id : view === 'edges' ? String((item as Edge).id) : (item as User).user_id}
        contentContainerStyle={styles.content}
        ListHeaderComponent={(
          <View>
            <Text style={styles.kicker}>{t('admin.restricted')}</Text><Text style={styles.title}>{t('admin.title')}</Text>
            <View style={styles.tabs}>{(['nodes', 'edges', 'users'] as ViewName[]).map((value) => <Pressable accessibilityRole="tab" accessibilityState={{ selected: view === value }} key={value} onPress={() => select(value)} style={[styles.tab, view === value && styles.active]}><Text style={styles.tabText}>{tabLabel(value)}</Text></Pressable>)}</View>
            {view === 'nodes' ? <View style={styles.form}>{input(id, setId, 'admin.nodeId', undefined, true)}{input(label, setLabel, 'admin.label')}{input(domain, setDomain, 'admin.domain', undefined, true)}{input(type, setType, 'admin.type', undefined, true)}{input(level, setLevel, 'admin.level', 'numeric', true)}{input(difficulty, setDifficulty, 'admin.difficulty', 'numeric', true)}<Pressable accessibilityRole="button" onPress={() => void createNode()} style={styles.button}><Text style={styles.buttonText}>{t('admin.addNode')}</Text></Pressable></View> : null}
            {view === 'edges' ? <View style={styles.form}>{input(source, setSource, 'admin.sourceId', undefined, true)}{input(target, setTarget, 'admin.targetId', undefined, true)}{input(type, setType, 'admin.edgeType', undefined, true)}{input(weight, setWeight, 'admin.weight', 'decimal-pad', true)}<Pressable accessibilityRole="button" onPress={() => void createEdge()} style={styles.button}><Text style={styles.buttonText}>{t('admin.addEdge')}</Text></Pressable></View> : null}
            {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}{loading ? <Text style={styles.meta}>{t('common.loading')}</Text> : null}
          </View>
        )}
        renderItem={({ item }) => view === 'nodes' ? (
          <View style={styles.item}><Text style={styles.itemTitle}>{(item as Node).label}</Text><Text style={styles.meta}>{isolateLTR((item as Node).id)} · {localizeDomain(locale, (item as Node).domain)}</Text><Pressable accessibilityRole="button" accessibilityLabel={`${t('common.delete')} ${(item as Node).label}`} onPress={() => deleteItem('admin-delete-node', (item as Node).id)}><Text style={styles.delete}>{t('common.delete')}</Text></Pressable></View>
        ) : view === 'edges' ? (
          <View style={styles.item}><Text style={styles.itemTitle}>{isolateLTR((item as Edge).source)} {isRTL ? '←' : '→'} {isolateLTR((item as Edge).target)}</Text><Text style={styles.meta}>{localizeType(locale, (item as Edge).type)} · {formatNumber((item as Edge).weight)}</Text><Pressable accessibilityRole="button" accessibilityLabel={t('common.delete')} onPress={() => deleteItem('admin-delete-edge', (item as Edge).id)}><Text style={styles.delete}>{t('common.delete')}</Text></Pressable></View>
        ) : (
          <View style={styles.item}><Text style={styles.itemTitle}>{isolateLTR((item as User).user_id)}</Text><Text style={styles.meta}>{t('admin.userSummary', { mastered: formatNumber((item as User).mastered), reinforcing: formatNumber((item as User).reinforcing), total: formatNumber((item as User).total) })}</Text></View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#111827' }, content: { padding: 20, paddingBottom: 32, gap: 10 }, kicker: { color: '#a5b4fc', fontWeight: '800', textTransform: 'uppercase' }, title: { color: '#fff', fontSize: 30, fontWeight: '800', marginBottom: 12 },
  tabs: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }, tab: { backgroundColor: '#1f2937', paddingHorizontal: 12, paddingVertical: 9, borderRadius: 8 }, tabText: { color: '#fff' }, active: { backgroundColor: '#4f46e5' },
  form: { gap: 8, backgroundColor: '#1f2937', padding: 12, borderRadius: 10, marginBottom: 12 }, input: { backgroundColor: '#fff', borderRadius: 7, padding: 10 }, ltrText: { textAlign: 'left', writingDirection: 'ltr' }, button: { backgroundColor: '#4f46e5', padding: 12, borderRadius: 7 }, buttonText: { color: '#fff', fontWeight: '800', textAlign: 'center' },
  item: { backgroundColor: '#1f2937', padding: 14, borderRadius: 10, gap: 5 }, itemTitle: { color: '#fff', fontWeight: '800' }, meta: { color: '#cbd5e1', fontSize: 13 }, delete: { color: '#fca5a5', fontWeight: '800', marginTop: 3 }, error: { color: '#fca5a5', marginBottom: 8 },
});
