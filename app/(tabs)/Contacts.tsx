import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ExpoContacts from 'expo-contacts';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Dimensions, FlatList, Modal, PermissionsAndroid, Platform, Pressable, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
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
  phoneNumber?: string; // Phone number for making calls
};

export default function Contacts() {
  const router = useRouter();
  const { width, height } = Dimensions.get('window');
  const [bubbles, setBubbles] = useState<BubbleState[]>([]);
  const [allContacts, setAllContacts] = useState<ExpoContacts.Contact[]>([]);
  const [selectedContactIds, setSelectedContactIds] = useState<Set<string>>(new Set());
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [permissionStatus, setPermissionStatus] = useState<'undetermined' | 'granted' | 'denied'>('undetermined');
  const [callLogs, setCallLogs] = useState<any[]>([]);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [contactToDelete, setContactToDelete] = useState<{ id: string; name: string } | null>(null);
  const [maxLimitModalVisible, setMaxLimitModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeDeleteBubbleId, setActiveDeleteBubbleId] = useState<string | null>(null);
  const deleteButtonTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const deleteButtonShowTimeRef = useRef<number | null>(null);

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
    saveBubblesToStorage();
  }, [bubbles, selectedContactIds]);

  useEffect(() => {
    if (callLogs.length > 0 && bubbles.length > 0) {
      updateBubbleDurations(callLogs);
    }
  }, [callLogs, allContacts]);

  // Restore phone numbers for bubbles when contacts are loaded
  useEffect(() => {
    if (allContacts.length > 0 && bubbles.length > 0) {
      setBubbles(prev => {
        let hasChanges = false;
        const updated = prev.map(bubble => {
          // If bubble already has phone number, keep it
          if (bubble.phoneNumber) {
            return bubble;
          }
          // Otherwise, try to find and restore from contacts
          const contact = allContacts.find(c => (c as any).id === bubble.contactId);
          if (contact && contact.phoneNumbers && contact.phoneNumbers.length > 0) {
            hasChanges = true;
            return {
              ...bubble,
              phoneNumber: contact.phoneNumbers[0].number,
            };
          }
          return bubble;
        });
        // Only update state if there were actual changes
        return hasChanges ? updated : prev;
      });
    }
  }, [allContacts, bubbles.length]);

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
          const newSize = getBubbleSize(duration);
          // Restore phone number from contact if missing
          const phoneNumber = bubble.phoneNumber || 
            (contact.phoneNumbers && contact.phoneNumbers.length > 0
              ? contact.phoneNumbers[0].number
              : undefined);
          return { 
            ...bubble, 
            callDuration: duration,
            size: newSize, // Update size based on new duration
            phoneNumber: phoneNumber, // Restore phone number if missing
          };
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

  const getBubbleSize = (duration: number): number => {
    // Use percentage of screen width (vw equivalent)
    const MIN_SIZE_PERCENT = 0.15; // 15% of screen width
    const MAX_SIZE_PERCENT = 0.50; // 50% of screen width
    
    const MIN_SIZE = width * MIN_SIZE_PERCENT;
    const MAX_SIZE = width * MAX_SIZE_PERCENT;
    
    if (duration === 0) return MIN_SIZE;
    
    // Convert duration from seconds to minutes
    const durationMinutes = duration / 60;
    
    // Calculate size increase: 0.5% of screen width per 10 minutes
    // Example: On 400px wide screen, 0.5% = 2px per 10 minutes
    // On 800px wide screen, 0.5% = 4px per 10 minutes
    const sizeIncreasePercent = (durationMinutes / 10) * 0.005; // 0.5% per 10 minutes
    const calculatedSize = MIN_SIZE + (width * sizeIncreasePercent);
    
    return Math.min(calculatedSize, MAX_SIZE);
  };

  const handleAddContactPress = () => {
    // Check if maximum limit reached (7 bubbles) before opening modal
    if (bubbles.length >= 7) {
      setMaxLimitModalVisible(true);
      return;
    }
    setShowModal(true);
  };

  const closeMaxLimitModal = () => {
    setMaxLimitModalVisible(false);
  };

  const addContactToBubbles = async (contact: ExpoContacts.Contact) => {
    // Calculate call duration for this contact first
    const duration = callLogs.length > 0 
      ? findCallDurationForContact(contact, callLogs)
      : 0;
    
    const size = getBubbleSize(duration);
    const position = generateRandomPosition(size);
    const contactId = (contact as any).id || `contact-${Date.now()}`;
    const bubbleId = `bubble-${contactId}-${Date.now()}`;
    
    // Get the first available phone number
    const phoneNumber = contact.phoneNumbers && contact.phoneNumbers.length > 0
      ? contact.phoneNumbers[0].number
      : undefined;
    
    const newBubble: BubbleState = {
      id: bubbleId,
      size,
      x: position.x,
      y: position.y,
      contactId: contactId,
      contactName: contact.name || 'Unknown',
      callDuration: duration,
      phoneNumber: phoneNumber,
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
    // Storage will be saved automatically by the useEffect hook when bubbles/selectedContactIds change
  };

  const hideDeleteButton = useCallback(() => {
    setActiveDeleteBubbleId(null);
    deleteButtonShowTimeRef.current = null;
    if (deleteButtonTimeoutRef.current) {
      clearTimeout(deleteButtonTimeoutRef.current);
      deleteButtonTimeoutRef.current = null;
    }
  }, []);

  const showDeleteButtonForBubble = useCallback((bubbleId: string) => {
    // Hide any previously active delete button
    hideDeleteButton();
    
    // Set the new active bubble
    setActiveDeleteBubbleId(bubbleId);
    deleteButtonShowTimeRef.current = Date.now();
    
    // Auto-hide after 5 seconds
    deleteButtonTimeoutRef.current = setTimeout(() => {
      hideDeleteButton();
    }, 5000);
  }, [hideDeleteButton]);

  // Hide delete button when navigating away
  useFocusEffect(
    useCallback(() => {
      return () => {
        hideDeleteButton();
      };
    }, [hideDeleteButton])
  );

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (deleteButtonTimeoutRef.current) {
        clearTimeout(deleteButtonTimeoutRef.current);
      }
    };
  }, []);

  const handleDeleteBubble = (contactId: string) => {
    const bubble = bubbles.find(b => b.contactId === contactId);
    const contactName = bubble?.contactName || 'Unknown';
    setContactToDelete({ id: contactId, name: contactName });
    setDeleteModalVisible(true);
    hideDeleteButton(); // Hide delete button when opening delete modal
  };

  const confirmDelete = () => {
    if (contactToDelete) {
      removeBubble(contactToDelete.id);
      setDeleteModalVisible(false);
      setContactToDelete(null);
    }
  };

  const cancelDelete = () => {
    setDeleteModalVisible(false);
    setContactToDelete(null);
  };

  const handleScreenTap = () => {
    // Only hide if delete button has been shown for at least 100ms
    // This prevents accidental hiding when the delete button first appears
    if (deleteButtonShowTimeRef.current && Date.now() - deleteButtonShowTimeRef.current > 100) {
      hideDeleteButton();
    }
  };

  const handleBubbleTap = (contactId: string) => {
    const bubble = bubbles.find(b => b.contactId === contactId);
    if (bubble && bubble.phoneNumber) {
      router.push({
        pathname: '/makeacall',
        params: {
          contactName: bubble.contactName,
          phoneNumber: bubble.phoneNumber,
        },
      });
    } else {
      Alert.alert('No Phone Number', 'This contact does not have a phone number.');
    }
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

  // Filter contacts based on search query
  const filteredContacts = useMemo(() => {
    if (!searchQuery.trim()) {
      return allContacts;
    }
    const query = searchQuery.toLowerCase().trim();
    return allContacts.filter(contact => {
      const name = (contact.name || '').toLowerCase();
      // Also search in phone numbers if available
      const phoneNumbers = (contact.phoneNumbers || [])
        .map(p => p.number || '')
        .join(' ')
        .toLowerCase();
      return name.includes(query) || phoneNumbers.includes(query);
    });
  }, [allContacts, searchQuery]);

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
    <Pressable 
      style={styles.container}
      onPress={handleScreenTap}
    >
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
          onDelete={() => handleDeleteBubble(b.contactId)}
          onDeleteButtonShow={() => showDeleteButtonForBubble(b.id)}
          hideDeleteButton={activeDeleteBubbleId !== b.id}
          onTap={() => handleBubbleTap(b.contactId)}
        />
      ))}
      
      <TouchableOpacity
        style={styles.fab}
        onPress={handleAddContactPress}
        activeOpacity={0.8}
      >
        <Ionicons name="add" size={32} color="#fff" />
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
              onPress={() => {
                setShowModal(false);
                setSearchQuery(''); // Clear search when closing modal
              }}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={styles.closeButton}>Done</Text>
            </TouchableOpacity>
          </View>

          {/* Search Bar */}
          {!loading && permissionStatus === 'granted' && (
            <View style={styles.searchContainer}>
              <TextInput
                style={styles.searchInput}
                placeholder="Search contacts..."
                placeholderTextColor="#999"
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          )}
          
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
              data={filteredContacts}
              keyExtractor={(item) => (item as any).id || `contact-${Date.now()}`}
              renderItem={renderContactItem}
              contentContainerStyle={styles.listContent}
              ListEmptyComponent={
                searchQuery.trim() ? (
                  <View style={styles.emptyContainer}>
                    <Text style={styles.emptyText}>No contacts found</Text>
                  </View>
                ) : null
              }
            />
          )}
        </View>
      </Modal>

      {/* Custom Delete Confirmation Modal */}
      <Modal
        visible={deleteModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={cancelDelete}
      >
        <View style={styles.deleteModalOverlay}>
          <View style={styles.deleteModalContent}>
            <View style={styles.deleteModalHeader}>
              <Text style={styles.deleteModalTitle}>Delete Contact</Text>
            </View>
            
            <View style={styles.deleteModalBody}>
              <Text style={styles.deleteModalMessage}>
                Are you sure you want to remove
              </Text>
              <Text style={styles.deleteModalContactName}>
                {contactToDelete?.name || 'this contact'}
              </Text>
              <Text style={styles.deleteModalMessage}>
                from your MY7?
              </Text>
            </View>

            <View style={styles.deleteModalButtons}>
              <TouchableOpacity
                style={[styles.deleteModalButton, styles.deleteModalCancelButton]}
                onPress={cancelDelete}
                activeOpacity={0.7}
              >
                <Text style={styles.deleteModalCancelText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.deleteModalButton, styles.deleteModalConfirmButton]}
                onPress={confirmDelete}
                activeOpacity={0.7}
              >
                <Text style={styles.deleteModalConfirmText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Maximum Limit Reached Modal */}
      <Modal
        visible={maxLimitModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={closeMaxLimitModal}
      >
        <View style={styles.deleteModalOverlay}>
          <View style={styles.deleteModalContent}>
            <View style={styles.deleteModalHeader}>
              <Text style={styles.deleteModalTitle}>Maximum Limit Reached</Text>
            </View>
            
            <View style={styles.deleteModalBody}>
              <Text style={styles.deleteModalMessage}>
                You can only add up to 7 contacts.
              </Text>
              <Text style={styles.deleteModalMessage}>
                Please remove a contact first to add a new one.
              </Text>
            </View>

            <View style={styles.deleteModalButtons}>
              <TouchableOpacity
                style={[styles.deleteModalButton, styles.deleteModalConfirmButton]}
                onPress={closeMaxLimitModal}
                activeOpacity={0.7}
              >
                <Text style={styles.deleteModalConfirmText}>OK</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </Pressable>
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
  fab: {
    position: 'absolute',
    bottom: 30,
    right: 30,
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#4A90E2',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
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
  searchContainer: {
    padding: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  searchInput: {
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    paddingHorizontal: 15,
    paddingVertical: 12,
    fontSize: 16,
    color: '#000',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
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
  // Delete Modal Styles
  deleteModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteModalContent: {
    backgroundColor: '#ffff',
    borderRadius: 20,
    width: '85%',
    maxWidth: 400,
    overflow: 'hidden',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  deleteModalHeader: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    backgroundColor: '#f8f8f8',
  },
  deleteModalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
  },
  deleteModalBody: {
    padding: 30,
    alignItems: 'center',
  },
  deleteModalMessage: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
  },
  deleteModalContactName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#4D6970',
    marginVertical: 8,
    textAlign: 'center',
  },
  deleteModalButtons: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  deleteModalButton: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteModalCancelButton: {
    borderRightWidth: 1,
    borderRightColor: '#e0e0e0',
    backgroundColor: '#f8f8f8',
  },
  deleteModalCancelText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '600',
  },
  deleteModalConfirmButton: {
    backgroundColor: '#ff4444',
  },
  deleteModalConfirmText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: 'bold',
  },
});
