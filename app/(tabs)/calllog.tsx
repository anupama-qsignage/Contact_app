import React, { useEffect, useState } from 'react';
import { Alert, PermissionsAndroid, Platform, StyleSheet, Text, View } from 'react-native';
import CallLogs from 'react-native-call-log';

export default function CallLog() {
  const [permissionStatus, setPermissionStatus] = useState<string>('checking');
  const [callLogs, setCallLogs] = useState<any[]>([]);

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

    const loadCallLogs = async () => {
      try {
        const logs = await CallLogs.load(5);
        console.log('Call logs loaded:', logs);
        setCallLogs(logs);
      } catch (error) {
        console.error('Error loading call logs:', error);
      }
    };

    requestCallLogPermission();
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Call Log</Text>
      {permissionStatus === 'checking' && (
        <Text style={styles.status}>Checking permission...</Text>
      )}
      {permissionStatus === 'granted' && (
        <View style={styles.logsContainer}>
          <Text style={styles.subtitle}>Recent Calls ({callLogs.length})</Text>
          {callLogs.length === 0 ? (
            <Text style={styles.status}>No call logs found</Text>
          ) : (
            callLogs.map((log, index) => (
              <View key={index} style={styles.logItem}>
                <Text style={styles.phoneNumber}>{log.phoneNumber || 'Unknown'}</Text>
                <Text style={styles.logDetails}>
                  Type: {log.type} | Duration: {log.duration}s
                </Text>
              </View>
            ))
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
    marginTop: 8,
  },
  logItem: {
    backgroundColor: '#f5f5f5',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  phoneNumber: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  logDetails: {
    fontSize: 12,
    color: '#666',
  },
});
