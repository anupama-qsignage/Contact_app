import * as Contacts from 'expo-contacts';
import React, { useEffect, useState } from 'react';
import { Alert, FlatList, PermissionsAndroid, Platform, StyleSheet, Text, View } from 'react-native';
import CallLogs from 'react-native-call-log';

interface CallLogEntry {
  phoneNumber: string;
  name?: string;
  type: string;
  duration: number;
  dateTime: number;
}

interface AggregatedCallLog {
  phoneNumber: string;
  name: string | null;
  callCount: number;
  totalDuration: number;
}

export default function CallLog() {
  const [permissionStatus, setPermissionStatus] = useState<string>('checking');
  const [aggregatedLogs, setAggregatedLogs] = useState<AggregatedCallLog[]>([]);
  const [contacts, setContacts] = useState<Contacts.Contact[]>([]);

  useEffect(() => {
    const requestCallLogPermission = async () => {
      try {
        if (Platform.OS !== 'android') {
          setPermissionStatus('not_android');
          return;
        }

        // Check current permission status first
        const checkResult = await PermissionsAndroid.check(
          PermissionsAndroid.PERMISSIONS.READ_CALL_LOG
        );

        console.log('Current permission status:', checkResult);

        if (checkResult) {
          // Permission already granted
          setPermissionStatus('granted');
          loadCallLogs();
          return;
        }

        // Request permission
        console.log('Requesting call log permission...');
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.READ_CALL_LOG,
          {
            title: 'Call Log Permission',
            message: 'This app needs access to your call logs to display call history.',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          }
        );

        console.log('Permission request result:', granted);

        if (granted === PermissionsAndroid.RESULTS.GRANTED) {
          setPermissionStatus('granted');
          loadCallLogs();
        } else if (granted === PermissionsAndroid.RESULTS.DENIED) {
          setPermissionStatus('denied');
          Alert.alert(
            'Permission Denied',
            'Call log permission is required to view call history. Please grant permission in app settings.'
          );
        } else {
          setPermissionStatus('never_ask_again');
          Alert.alert(
            'Permission Blocked',
            'Call log permission was blocked. Please enable it in app settings.'
          );
        }
      } catch (e) {
        console.error('Error requesting permission:', e);
        setPermissionStatus('error');
      }
    };

    const loadContacts = async () => {
      try {
        const { status } = await Contacts.requestPermissionsAsync();
        if (status === 'granted') {
          const { data } = await Contacts.getContactsAsync({
            fields: [Contacts.Fields.Name, Contacts.Fields.PhoneNumbers],
          });
          setContacts(data || []);
          return data || [];
        }
        return [];
      } catch (error) {
        console.error('Error loading contacts:', error);
        return [];
      }
    };

    const findContactName = (phoneNumber: string, contactList: Contacts.Contact[]): string | null => {
      if (!phoneNumber) return null;
      
      // Normalize phone number (remove spaces, dashes, etc.)
      const normalizedNumber = phoneNumber.replace(/[\s\-\(\)]/g, '');
      
      for (const contact of contactList) {
        if (contact.phoneNumbers) {
          for (const phone of contact.phoneNumbers) {
            if (!phone.number) continue;
            const normalizedContactNumber = phone.number.replace(/[\s\-\(\)]/g, '');
            // Check if numbers match (exact or last 10 digits)
            if (
              normalizedContactNumber === normalizedNumber ||
              normalizedContactNumber.slice(-10) === normalizedNumber.slice(-10) ||
              normalizedNumber.slice(-10) === normalizedContactNumber.slice(-10)
            ) {
              return contact.name || null;
            }
          }
        }
      }
      return null;
    };

    const normalizePhoneNumber = (phoneNumber: string): string => {
      if (!phoneNumber) return '';
      // Normalize phone number (remove spaces, dashes, etc.) and take last 10 digits
      const normalized = phoneNumber.replace(/[\s\-\(\)]/g, '');
      return normalized.slice(-10); // Use last 10 digits for grouping
    };

    const loadCallLogs = async () => {
      try {
        // Load up to 100 call logs (you can increase this number if needed)
        const logs = await CallLogs.load(500);
        // console.log('Call logs loaded:', logs);
        
        // Load contacts to match names
        const contactList = await loadContacts();
        
        // Group call logs by phone number
        const groupedMap = new Map<string, {
          phoneNumber: string;
          name: string | null;
          callCount: number;
          totalDuration: number;
        }>();
        
        logs.forEach((log: any) => {
          if (!log.phoneNumber) return;
          
          const normalizedNumber = normalizePhoneNumber(log.phoneNumber);
          if (!normalizedNumber) return;
          
          // Use normalized number as key to group same numbers with different formats
          const key = normalizedNumber;
          
          // Find contact name for this number
          const contactName = findContactName(log.phoneNumber, contactList) || log.name || null;
          
          if (groupedMap.has(key)) {
            const existing = groupedMap.get(key)!;
            existing.callCount += 1;
            existing.totalDuration += log.duration || 0;
            // Keep the first phone number format found, or update if we have a better formatted one
            if (!existing.phoneNumber || (log.phoneNumber && log.phoneNumber.length > existing.phoneNumber.length)) {
              existing.phoneNumber = log.phoneNumber;
            }
            // Update name if we found one and didn't have one before
            if (!existing.name && contactName) {
              existing.name = contactName;
            }
          } else {
            groupedMap.set(key, {
              phoneNumber: log.phoneNumber,
              name: contactName,
              callCount: 1,
              totalDuration: log.duration || 0,
            });
          }
        });
        
        // Convert map to array and sort by total duration (descending)
        const aggregated = Array.from(groupedMap.values()).sort(
          (a, b) => b.totalDuration - a.totalDuration
        );
        
        setAggregatedLogs(aggregated);
      } catch (error) {
        console.error('Error loading call logs:', error);
      }
    };

    requestCallLogPermission();
  }, []);

  const formatDuration = (seconds: number): string => {
    if (seconds < 60) {
      return `${seconds}s`;
    } else if (seconds < 3600) {
      const minutes = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return secs > 0 ? `${minutes}m ${secs}s` : `${minutes}m`;
    } else {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      const secs = seconds % 60;
      if (minutes > 0) {
        return secs > 0 ? `${hours}h ${minutes}m ${secs}s` : `${hours}h ${minutes}m`;
      }
      return secs > 0 ? `${hours}h ${secs}s` : `${hours}h`;
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Call Log</Text>
      {permissionStatus === 'checking' && (
        <Text style={styles.status}>Checking permission...</Text>
      )}
      {permissionStatus === 'granted' && (
        <View style={styles.logsContainer}>
          <Text style={styles.subtitle}>Call Summary ({aggregatedLogs.length} contacts)</Text>
          {aggregatedLogs.length === 0 ? (
            <Text style={styles.status}>No call logs found</Text>
          ) : (
            <FlatList
              data={aggregatedLogs}
              keyExtractor={(item, index) => `${item.phoneNumber}-${index}`}
              renderItem={({ item: log }) => (
                <View style={styles.logItem}>
                  <Text style={styles.contactName}>
                    {log.name || log.phoneNumber || 'Unknown'}
                  </Text>
                  {log.name && log.phoneNumber && (
                    <Text style={styles.phoneNumber}>{log.phoneNumber}</Text>
                  )}
                  <Text style={styles.logDetails}>
                    Calls: {log.callCount} | Total Duration: {formatDuration(log.totalDuration)}
                  </Text>
                </View>
              )}
              contentContainerStyle={styles.listContent}
            />
          )}
        </View>
      )}
      {permissionStatus === 'denied' && (
        <Text style={styles.status}>Permission denied. Please grant permission in settings.</Text>
      )}
      {permissionStatus === 'never_ask_again' && (
        <Text style={styles.status}>
          Permission blocked. Please enable it in app settings.
        </Text>
      )}
      {permissionStatus === 'not_android' && (
        <Text style={styles.status}>Call logs are only available on Android.</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  subtitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 12,
  },
  status: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
  },
  logsContainer: {
    flex: 1,
    marginTop: 8,
  },
  listContent: {
    paddingBottom: 20,
  },
  logItem: {
    backgroundColor: '#f5f5f5',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  contactName: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
    color: '#000',
  },
  phoneNumber: {
    fontSize: 14,
    fontWeight: '400',
    marginBottom: 4,
    color: '#666',
  },
  logDetails: {
    fontSize: 12,
    color: '#666',
  },
});

