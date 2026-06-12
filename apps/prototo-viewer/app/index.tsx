import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { tokenFromInput } from '@sherizan/proto-renderer';
import { loadRecents, type RecentEntry } from '../lib/recents';

export default function Home() {
  const router = useRouter();
  const [input, setInput] = useState('');
  const [invalid, setInvalid] = useState(false);
  const [recents, setRecents] = useState<RecentEntry[] | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      loadRecents(AsyncStorage).then((list) => {
        if (active) setRecents(list);
      });
      return () => {
        active = false;
      };
    }, []),
  );

  const open = (raw: string) => {
    const token = tokenFromInput(raw);
    if (!token) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    setInput('');
    router.push(`/p/${token}`);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.content} keyboardDismissMode="on-drag">
        <Text style={styles.title}>Prototo</Text>
        <Text style={styles.subtitle}>Open a shared prototype</Text>

        <TextInput
          style={[styles.input, invalid && styles.inputInvalid]}
          value={input}
          onChangeText={(t) => {
            setInput(t);
            setInvalid(false);
          }}
          placeholder="Paste a prototo.app link or 5-character code"
          placeholderTextColor="#9aa0a6"
          autoCapitalize="characters"
          autoCorrect={false}
          returnKeyType="go"
          onSubmitEditing={() => open(input)}
        />
        {invalid && <Text style={styles.invalid}>That doesn't look like a prototype link.</Text>}
        <Pressable
          style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
          onPress={() => open(input)}
          accessibilityRole="button"
        >
          <Text style={styles.buttonText}>Open</Text>
        </Pressable>

        <Text style={styles.section}>Recently viewed</Text>
        {recents === null ? (
          <ActivityIndicator style={{ marginTop: 16 }} />
        ) : recents.length === 0 ? (
          <Text style={styles.empty}>Prototypes you open show up here.</Text>
        ) : (
          recents.map((r) => (
            <Pressable
              key={r.token}
              style={({ pressed }) => [styles.recent, pressed && styles.recentPressed]}
              onPress={() => router.push(`/p/${r.token}`)}
              accessibilityRole="button"
            >
              <Text style={styles.recentTitle} numberOfLines={1}>
                {r.appName}
              </Text>
              <Text style={styles.recentMeta} numberOfLines={1}>
                {r.designerName} · {r.token}
              </Text>
            </Pressable>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f5f8' },
  content: { padding: 20, gap: 12 },
  title: { fontSize: 34, fontWeight: '700', color: '#0a0a0a', marginTop: 8 },
  subtitle: { fontSize: 16, color: '#5f6368', marginBottom: 8 },
  input: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#0a0a0a',
    borderWidth: 1,
    borderColor: '#e3e6ea',
  },
  inputInvalid: { borderColor: '#e5484d' },
  invalid: { color: '#e5484d', fontSize: 14 },
  button: {
    backgroundColor: '#0a0a0a',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonPressed: { opacity: 0.7 },
  buttonText: { color: '#ffffff', fontSize: 16, fontWeight: '600' },
  section: { fontSize: 13, fontWeight: '600', color: '#5f6368', marginTop: 20, textTransform: 'uppercase', letterSpacing: 0.5 },
  empty: { color: '#9aa0a6', fontSize: 15, marginTop: 4 },
  recent: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e3e6ea',
  },
  recentPressed: { opacity: 0.7 },
  recentTitle: { fontSize: 16, fontWeight: '600', color: '#0a0a0a' },
  recentMeta: { fontSize: 13, color: '#5f6368', marginTop: 2 },
});
