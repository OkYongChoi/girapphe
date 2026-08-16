import { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { Alert, FlatList, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { AuthRequired } from '@/components/auth-required';
import { mobileApi, type MobileCard } from '@/api';

export default function ReviewScreen() { return <AuthRequired><ReviewContent /></AuthRequired>; }

function ReviewContent() {
  const router = useRouter();
  const [cards, setCards] = useState<MobileCard[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [domain, setDomain] = useState('all');
  const load = useCallback(async () => { setLoading(true); setError(null); try { setCards((await mobileApi.saved()).cards); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not load the review queue.'); } finally { setLoading(false); } }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  function remove(card: MobileCard) { Alert.alert('Remove from review?', `“${card.title}” will no longer be scheduled for review.`, [{ text:'Cancel', style:'cancel' }, { text:'Remove', style:'destructive', onPress: () => void mobileApi.mutate({ action:'remove-saved', cardId:card.id }).then(load).catch((reason) => setError(reason.message)) }]); }
  function reset() { Alert.alert('Reset all progress?', 'This clears your web and mobile learning progress and cannot be undone.', [{ text:'Cancel', style:'cancel' }, { text:'Reset', style:'destructive', onPress: () => void mobileApi.mutate({ action:'reset-progress' }).then(load).catch((reason) => setError(reason.message)) }]); }
  const domains = Array.from(new Set(cards.map((card) => card.domain))).sort();
  const visibleCards = cards.filter((card) => (domain === 'all' || card.domain === domain) && (!query.trim() || `${card.title} ${card.summary} ${card.domain}`.toLowerCase().includes(query.trim().toLowerCase())));
  return <SafeAreaView style={styles.safeArea}><FlatList data={visibleCards} keyExtractor={(card) => card.id} contentContainerStyle={styles.content}
    ListHeaderComponent={<View><Text style={styles.kicker}>Learning queue</Text><Text style={styles.title}>Review</Text><Text style={styles.sub}>{visibleCards.length} of {cards.length} concepts marked unclear</Text><TextInput value={query} onChangeText={setQuery} placeholder="Search review concepts" style={styles.input}/><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>{['all',...domains].map((value) => <Pressable key={value} onPress={() => setDomain(value)} style={[styles.filter, domain === value && styles.filterActive]}><Text>{value === 'all' ? 'All domains' : value}</Text></Pressable>)}</ScrollView><Pressable onPress={reset} style={styles.reset}><Text style={styles.resetText}>Reset all progress</Text></Pressable>{error ? <Text style={styles.error}>{error}</Text> : null}{loading ? <Text style={styles.sub}>Loading…</Text> : null}</View>}
    ListEmptyComponent={!loading ? <View style={styles.empty}><Text style={styles.emptyTitle}>No review concepts</Text><Text style={styles.sub}>Mark a concept as unclear in Practice to add it here.</Text><Pressable onPress={() => router.push('/(tabs)/practice')} style={styles.primary}><Text style={styles.primaryText}>Start practice</Text></Pressable></View> : null}
    renderItem={({item}) => <View style={styles.card}><Text style={styles.cardTitle}>{item.title}</Text><Text style={styles.sub}>{item.domain}</Text><Text numberOfLines={3} style={styles.copy}>{item.summary}</Text><Pressable onPress={() => remove(item)}><Text style={styles.link}>Remove</Text></Pressable></View>}
  /></SafeAreaView>;
}
const styles=StyleSheet.create({safeArea:{flex:1,backgroundColor:'#f7f8fb'},content:{padding:20,paddingBottom:32,gap:12},kicker:{color:'#47606f',fontSize:13,fontWeight:'800',textTransform:'uppercase'},title:{color:'#111827',fontSize:32,fontWeight:'800'},sub:{color:'#607080',fontSize:14,lineHeight:21,marginTop:4},input:{borderColor:'#d8dee8',borderWidth:1,borderRadius:8,padding:12,fontSize:15,backgroundColor:'#fff',marginTop:12},filters:{gap:8,paddingTop:8},filter:{backgroundColor:'#fff',borderColor:'#d8dee8',borderWidth:1,borderRadius:8,paddingHorizontal:10,paddingVertical:8},filterActive:{backgroundColor:'#dbeafe',borderColor:'#2563eb'},reset:{alignSelf:'flex-start',borderColor:'#fecaca',borderWidth:1,borderRadius:8,paddingHorizontal:10,paddingVertical:8,marginTop:10},resetText:{color:'#b91c1c',fontWeight:'800'},error:{color:'#b91c1c',marginTop:10},card:{backgroundColor:'#fff',borderRadius:12,padding:16,gap:7},cardTitle:{color:'#111827',fontSize:17,fontWeight:'800'},copy:{color:'#374151',fontSize:15,lineHeight:22},link:{color:'#2563eb',fontWeight:'800',marginTop:4},empty:{backgroundColor:'#fff',borderRadius:12,padding:24,alignItems:'center',gap:8,marginTop:10},emptyTitle:{color:'#111827',fontWeight:'800',fontSize:18},primary:{backgroundColor:'#111827',borderRadius:8,paddingHorizontal:16,paddingVertical:12,marginTop:8},primaryText:{color:'#fff',fontWeight:'800'}});
