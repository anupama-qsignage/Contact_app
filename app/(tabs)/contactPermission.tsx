
import React, { useEffect, useState, useCallback } from 'react';
import { StyleSheet, View, Text, FlatList, ActivityIndicator, RefreshControl } from 'react-native';
import * as Contacts from 'expo-contacts';

type ContactItem = Contacts.Contact;

export default function App() {
  const [status, setStatus] = useState<'undetermined' | 'granted' | 'denied'>('undetermined');
  const [contacts, setContacts] = useState<ContactItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  const loadContacts = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.Name, Contacts.Fields.PhoneNumbers, Contacts.Fields.Emails],
        sort: Contacts.SortTypes.FirstName,
        pageOffset: 0,
        pageSize: 2000, // large enough for most phones; Expo will paginate internally if needed
      });
      setContacts(data || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      const { status: s } = await Contacts.requestPermissionsAsync();
      setStatus(s as 'granted' | 'denied' | 'undetermined');
      if (s === 'granted') {
        await loadContacts();
      }
    })();
  }, [loadContacts]);

  const onRefresh = useCallback(async () => {
    if (status !== 'granted') return;
    setRefreshing(true);
    await loadContacts();
    setRefreshing(false);
  }, [status, loadContacts]);

  if (loading && status === 'granted') {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
        <Text style={styles.muted}>Loading contacts…</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {status !== 'granted' ? (
        <View style={styles.center}>
          <Text style={styles.title}>Contacts Permission</Text>
          <Text style={styles.muted}>
            Permission {status === 'denied' ? 'denied' : 'not granted yet'}.
            Open Settings to allow contact access.
          </Text>
        </View>
      ) : contacts.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.title}>No contacts found</Text>
          <Text style={styles.muted}>Try adding some contacts, then pull to refresh.</Text>
        </View>
      ) : (
        <FlatList
          data={contacts}
          keyExtractor={(item: ContactItem) => (item as any).id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.name}>{item.name || '(No name)'}</Text>

              {item.phoneNumbers?.length ? (
                <View style={styles.section}>
                  {item.phoneNumbers.map((p, i) => (
                    <Text key={i} style={styles.value}>
                      {p.label ? `${p.label}: ` : ''}{p.number}
                    </Text>
                  ))}
                </View>
              ) : null}

              {item.emails?.length ? (
                <View style={styles.section}>
                  {item.emails.map((e, i) => (
                    <Text key={i} style={styles.value}>
                      {e.label ? `${e.label}: ` : ''}{e.email}
                    </Text>
                  ))}
                </View>
              ) : null}
            </View>
          )}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
          contentContainerStyle={{ padding: 16 }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  title: { fontSize: 18, fontWeight: '600', marginBottom: 8 },
  muted: { color: '#666' },
  card: { backgroundColor: '#f7f7f7', borderRadius: 12, padding: 12 },
  name: { fontSize: 16, fontWeight: '600', marginBottom: 6 },
  section: { marginTop: 4 },
  value: { fontSize: 14, color: '#333', marginVertical: 2 },
  sep: { height: 10 },
});

