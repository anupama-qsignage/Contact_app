import * as ExpoContacts from 'expo-contacts';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Dimensions, FlatList, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Bubble from '../bubble';

type BubbleState = { 
  id: string; 
  size: number; 
  x: number; 
  y: number;
  contactId: string;
  contactName: string;
};

export default function Contacts() {
  const { width, height } = Dimensions.get('window');
  const [bubbles, setBubbles] = useState<BubbleState[]>([]);
  const [allContacts, setAllContacts] = useState<ExpoContacts.Contact[]>([]);
  const [selectedContactIds, setSelectedContactIds] = useState<Set<string>>(new Set());
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [permissionStatus, setPermissionStatus] = useState<'undetermined' | 'granted' | 'denied'>('undetermined');

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

  useEffect(() => {
    loadContacts();
  }, [loadContacts]);

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

  const addContactToBubbles = (contact: ExpoContacts.Contact) => {
    const size = getBubbleSize();
    const position = generateRandomPosition(size);
    const contactId = (contact as any).id || `contact-${Date.now()}`;
    const bubbleId = `bubble-${contactId}-${Date.now()}`;
    
    const newBubble: BubbleState = {
      id: bubbleId,
      size,
      x: position.x,
      y: position.y,
      contactId: contactId,
      contactName: contact.name || 'Unknown',
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
