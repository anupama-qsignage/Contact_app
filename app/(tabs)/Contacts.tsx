import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ExpoContacts from 'expo-contacts';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Dimensions, FlatList, Modal, PermissionsAndroid, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import CallLogs from 'react-native-call-log';
import Bubble from '../bubble';

const STORAGE_KEY = 'contact_bubbles';
const SELECTED_CONTACTS_KEY = 'selected_contact_ids';

type BubbleState = { 
  id: string; 
  size: number; 
  x: number; 
  y: number;
  contactId: string;
  contactName: string;
  callDuration: number; // Total call duration in seconds
};

export default function Contacts() {
  const { width, height } = Dimensions.get('window');
  const [bubbles, setBubbles] = useState<BubbleState[]>([]);
  const [allContacts, setAllContacts] = useState<ExpoContacts.Contact[]>([]);
  const [selectedContactIds, setSelectedContactIds] = useState<Set<string>>(new Set());
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [permissionStatus, setPermissionStatus] = useState<'undetermined' | 'granted' | 'denied'>('undetermined');
  const [callLogs, setCallLogs] = useState<any[]>([]);

  const bubbleMapRef = useRef<Map<string, BubbleState>>(new Map());
  const syncMap = (arr: BubbleState[]) => {
    const m = bubbleMapRef.current;
    m.clear();
    arr.forEach(b => m.set(b.id, b));
  };

  const loadContacts = useCallback(async () => {
    try {
      setLoading(true);
      const { status } = await ExpoContacts.requestPermissionsAsync();
      setPermissionStatus(status);
      
      if (status === 'granted') {
        const { data } = await ExpoContacts.getContactsAsync({
          fields: [ExpoContacts.Fields.Name, ExpoContacts.Fields.PhoneNumbers],
          sort: ExpoContacts.SortTypes.FirstName,
        });
        setAllContacts(data || []);
      }
    } catch (error) {
      console.error('Error loading contacts:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load bubbles from storage on mount
  useEffect(() => {
    loadBubblesFromStorage();
    loadContacts();
    loadCallLogsForBubbles();
  }, [loadContacts]);

  // Save bubbles to storage whenever they change
  useEffect(() => {
    if (bubbles.length > 0 || selectedContactIds.size > 0) {
      saveBubblesToStorage();
    }
  }, [bubbles, selectedContactIds]);

  useEffect(() => {
    if (callLogs.length > 0 && bubbles.length > 0) {
      updateBubbleDurations(callLogs);
    }
  }, [callLogs, allContacts]);

  const saveBubblesToStorage = async () => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(bubbles));
      await AsyncStorage.setItem(SELECTED_CONTACTS_KEY, JSON.stringify(Array.from(selectedContactIds)));
    } catch (error) {
      console.error('Error saving bubbles to storage:', error);
    }
  };

  const loadBubblesFromStorage = async () => {
    try {
      const savedBubbles = await AsyncStorage.getItem(STORAGE_KEY);
      const savedContactIds = await AsyncStorage.getItem(SELECTED_CONTACTS_KEY);
      
      if (savedBubbles) {
        const parsedBubbles = JSON.parse(savedBubbles);
        setBubbles(parsedBubbles);
        syncMap(parsedBubbles);
      }
      
      if (savedContactIds) {
        const parsedIds = JSON.parse(savedContactIds);
        setSelectedContactIds(new Set(parsedIds));
      }
    } catch (error) {
      console.error('Error loading bubbles from storage:', error);
    }
  };

  const clearStorage = async () => {
    Alert.alert(
      'Clear All Bubbles',
      'Are you sure you want to remove all bubbles? This action cannot be undone.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            try {
              await AsyncStorage.removeItem(STORAGE_KEY);
              await AsyncStorage.removeItem(SELECTED_CONTACTS_KEY);
              setBubbles([]);
              setSelectedContactIds(new Set());
              syncMap([]);
            } catch (error) {
              console.error('Error clearing storage:', error);
              Alert.alert('Error', 'Failed to clear storage.');
            }
          },
        },
      ]
    );
  };

  const loadCallLogsForBubbles = async () => {
    if (Platform.OS !== 'android') return;
    
    try {
      const checkResult = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.READ_CALL_LOG
      );

      if (!checkResult) {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.READ_CALL_LOG,
          {
            title: 'Call Log Permission',
            message: 'This app needs access to your call logs to display call duration.',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          }
        );
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          return;
        }
      }

      const logs = await CallLogs.load(500);
      setCallLogs(logs);
      updateBubbleDurations(logs);
    } catch (error) {
      console.error('Error loading call logs:', error);
    }
  };

  const normalizePhoneNumber = (phoneNumber: string): string => {
    if (!phoneNumber) return '';
    return phoneNumber.replace(/[\s\-\(\)]/g, '').slice(-10);
  };

  const findCallDurationForContact = (contact: ExpoContacts.Contact, logs: any[]): number => {
    if (!contact.phoneNumbers || contact.phoneNumbers.length === 0) return 0;
    
    let totalDuration = 0;
    const contactPhoneNumbers = contact.phoneNumbers
      .map(p => p.number)
      .filter((num): num is string => Boolean(num))
      .map(normalizePhoneNumber);

    for (const log of logs) {
      if (!log.phoneNumber) continue;
      const logNumber = normalizePhoneNumber(log.phoneNumber);
      
      for (const contactNumber of contactPhoneNumbers) {
        if (logNumber === contactNumber || 
            logNumber.slice(-10) === contactNumber.slice(-10) ||
            contactNumber.slice(-10) === logNumber.slice(-10)) {
          totalDuration += log.duration || 0;
          break;
        }
      }
    }
    
    return totalDuration;
  };

  const updateBubbleDurations = (logs: any[]) => {
    setBubbles(prev => {
      return prev.map(bubble => {
        const contact = allContacts.find(c => (c as any).id === bubble.contactId);
        if (contact) {
          const duration = findCallDurationForContact(contact, logs);
          return { ...bubble, callDuration: duration };
        }
        return bubble;
      });
    });
  };

  const generateRandomPosition = (size: number): { x: number; y: number } => {
    const maxX = width - size;
    const maxY = height - size;
    return {
      x: Math.random() * maxX,
      y: Math.random() * maxY,
    };
  };

  const getBubbleSize = (): number => {
    return 120; // Fixed size for all bubbles
  };

  const addContactToBubbles = async (contact: ExpoContacts.Contact) => {
    const size = getBubbleSize();
    const position = generateRandomPosition(size);
    const contactId = (contact as any).id || `contact-${Date.now()}`;
    const bubbleId = `bubble-${contactId}-${Date.now()}`;
    
    // Calculate call duration for this contact
    const duration = callLogs.length > 0 
      ? findCallDurationForContact(contact, callLogs)
      : 0;
    
    const newBubble: BubbleState = {
      id: bubbleId,
      size,
      x: position.x,
      y: position.y,
      contactId: contactId,
      contactName: contact.name || 'Unknown',
      callDuration: duration,
    };

    setBubbles(prev => {
      const updated = [...prev, newBubble];
      syncMap(updated);
      return updated;
    });
    setSelectedContactIds(prev => new Set(prev).add(contactId));
  };

  const removeBubble = (contactId: string) => {
    setBubbles(prev => {
      const updated = prev.filter(b => b.contactId !== contactId);
      syncMap(updated);
      return updated;
    });
    setSelectedContactIds(prev => {
      const updated = new Set(prev);
      updated.delete(contactId);
      return updated;
    });
  };

  const canMoveTo = (id: string, x: number, y: number) => {
    const curr = bubbleMapRef.current.get(id);
    if (!curr) return true;
    const r1 = curr.size / 2;

    // keep inside screen bounds
    if (x < 0 || y < 0) return false;
    if (x + curr.size > width) return false;
    if (y + curr.size > height) return false;

    // Check against other bubbles
    for (const [otherId, b] of bubbleMapRef.current.entries()) {
      if (otherId === id) continue;
      const r2 = b.size / 2;
      const c1x = x + r1;
      const c1y = y + r1;
      const c2x = b.x + r2;
      const c2y = b.y + r2;
      const dx = c1x - c2x;
      const dy = c1y - c2y;
      const distSq = dx * dx + dy * dy;
      const minDist = r1 + r2; // no margin, just touching allowed
      if (distSq < minDist * minDist) {
        return false; // would overlap
      }
    }
    return true;
  };

  const onChange = (id: string, x: number, y: number) => {
    setBubbles(prev => {
      const next = prev.map(b => (b.id === id ? { ...b, x, y } : b));
      syncMap(next);
      return next;
    });
  };

  useMemo(() => syncMap(bubbles), [bubbles]);

  const renderContactItem = ({ item }: { item: ExpoContacts.Contact }) => {
    const contactId = (item as any).id || `contact-${Date.now()}`;
    const isSelected = selectedContactIds.has(contactId);
    
    return (
      <TouchableOpacity
        style={[styles.contactItem, isSelected && styles.contactItemSelected]}
        onPress={() => {
          if (isSelected) {
            removeBubble(contactId);
          } else {
            addContactToBubbles(item);
          }
        }}
      >
        <View style={styles.contactInfo}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {item.name ? item.name.substring(0, 2).toUpperCase() : '??'}
            </Text>
          </View>
          <Text style={styles.contactName}>{item.name || 'Unknown'}</Text>
        </View>
        {isSelected && <Text style={styles.checkmark}>✓</Text>}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.clearButton}
        onPress={clearStorage}
      >
        <Text style={styles.clearButtonText}>Clear All</Text>
      </TouchableOpacity>
      
      {bubbles.map(b => (
        <Bubble
          key={b.id}
          id={b.id}
          size={b.size}
          startX={b.x}
          startY={b.y}
          onChange={onChange}
          canMoveTo={canMoveTo}
          contactName={b.contactName}
          callDuration={b.callDuration}
        />
      ))}
      
      <TouchableOpacity
        style={styles.addButton}
        onPress={() => setShowModal(true)}
      >
        <Text style={styles.addButtonText}>+ Add Contact</Text>
      </TouchableOpacity>

      <Modal
        visible={showModal}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setShowModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Contacts</Text>
            <TouchableOpacity 
              style={styles.doneButton}
              onPress={() => setShowModal(false)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={styles.closeButton}>Done</Text>
            </TouchableOpacity>
          </View>
          
          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator size="large" />
              <Text style={styles.loadingText}>Loading contacts...</Text>
            </View>
          ) : permissionStatus !== 'granted' ? (
            <View style={styles.center}>
              <Text style={styles.errorText}>
                Contacts permission is required. Please grant permission in settings.
              </Text>
              <TouchableOpacity style={styles.retryButton} onPress={loadContacts}>
                <Text style={styles.retryButtonText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <FlatList
              data={allContacts}
              keyExtractor={(item) => (item as any).id || `contact-${Date.now()}`}
              renderItem={renderContactItem}
              contentContainerStyle={styles.listContent}
            />
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#0b0f1a' 
  },
  clearButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    backgroundColor: '#ff4444',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    zIndex: 1000,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  clearButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  addButton: {
    position: 'absolute',
    bottom: 30,
    alignSelf: 'center',
    backgroundColor: '#4A90E2',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 50,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    backgroundColor: '#f5f5f5',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000',
  },
  doneButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    minWidth: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButton: {
    fontSize: 18,
    color: '#4A90E2',
    fontWeight: '600',
  },
  listContent: {
    padding: 10,
  },
  contactItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    marginVertical: 5,
    backgroundColor: '#f9f9f9',
    borderRadius: 10,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  contactItemSelected: {
    backgroundColor: '#E3F2FD',
    borderColor: '#4A90E2',
  },
  contactInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#4A90E2',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  contactName: {
    fontSize: 16,
    color: '#000',
    fontWeight: '500',
  },
  checkmark: {
    fontSize: 24,
    color: '#4A90E2',
    fontWeight: 'bold',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    color: '#666',
  },
  errorText: {
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#4A90E2',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
});
