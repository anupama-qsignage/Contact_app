import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function MakeACall() {
  const router = useRouter();
  const params = useLocalSearchParams<{ contactName: string; phoneNumber: string }>();
  const { contactName, phoneNumber } = params;
  const [isCalling, setIsCalling] = useState(false);

  const cleanPhoneNumber = (phone: string): string => {
    // Remove all non-digit characters except +
    return phone.replace(/[^\d+]/g, '');
  };

  const makeNormalCall = async () => {
    if (!phoneNumber) {
      Alert.alert('Error', 'Phone number is missing.');
      return;
    }

    try {
      setIsCalling(true);
      const cleanedNumber = cleanPhoneNumber(phoneNumber);
      const url = `tel:${cleanedNumber}`;
      
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
      } else {
        Alert.alert('Error', 'Cannot make phone calls on this device.');
      }
    } catch (error) {
      console.error('Error making call:', error);
      Alert.alert('Error', 'Failed to initiate phone call.');
    } finally {
      setIsCalling(false);
    }
  };

  const makeWhatsAppCall = async () => {
    if (!phoneNumber) {
      Alert.alert('Error', 'Phone number is missing.');
      return;
    }

    try {
      setIsCalling(true);
      // Remove all non-digit characters for WhatsApp
      const cleanedNumber = phoneNumber.replace(/[^\d]/g, '');
      
      // Try WhatsApp deep link first
      const whatsappUrl = `whatsapp://send?phone=${cleanedNumber}`;
      const canOpenWhatsApp = await Linking.canOpenURL(whatsappUrl);
      
      if (canOpenWhatsApp) {
        await Linking.openURL(whatsappUrl);
      } else {
        // Fallback to web WhatsApp if app not installed
        const webUrl = `https://wa.me/${cleanedNumber}`;
        await Linking.openURL(webUrl);
      }
    } catch (error) {
      console.error('Error opening WhatsApp:', error);
      Alert.alert('Error', 'Failed to open WhatsApp.');
    } finally {
      setIsCalling(false);
    }
  };

  const handleCancel = () => {
    router.back();
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={handleCancel}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={24} color="#4A90E2" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Make a Call</Text>
        <View style={styles.placeholder} />
      </View>

      <View style={styles.content}>
        <View style={styles.contactInfo}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {contactName ? contactName.substring(0, 2).toUpperCase() : '??'}
            </Text>
          </View>
          <Text style={styles.contactName}>{contactName || 'Unknown'}</Text>
          {phoneNumber && (
            <Text style={styles.phoneNumber}>{phoneNumber}</Text>
          )}
        </View>

        <View style={styles.optionsContainer}>
          <Text style={styles.optionsTitle}>Choose how to call:</Text>

          <TouchableOpacity
            style={[styles.callButton, styles.whatsappButton]}
            onPress={makeWhatsAppCall}
            disabled={isCalling}
            activeOpacity={0.7}
          >
            <Ionicons name="logo-whatsapp" size={32} color="#fff" />
            <Text style={styles.callButtonText}>WhatsApp Call</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.callButton, styles.phoneButton]}
            onPress={makeNormalCall}
            disabled={isCalling}
            activeOpacity={0.7}
          >
            <Ionicons name="call" size={32} color="#fff" />
            <Text style={styles.callButtonText}>Phone Call</Text>
          </TouchableOpacity>
        </View>

        {isCalling && (
          <Text style={styles.callingText}>Initiating call...</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b0f1a',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 20,
    backgroundColor: '#1a1f2e',
    borderBottomWidth: 1,
    borderBottomColor: '#2a2f3e',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactInfo: {
    alignItems: 'center',
    marginBottom: 50,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#4A90E2',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  avatarText: {
    color: '#fff',
    fontSize: 36,
    fontWeight: 'bold',
  },
  contactName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
    textAlign: 'center',
  },
  phoneNumber: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
  },
  optionsContainer: {
    width: '100%',
    maxWidth: 400,
  },
  optionsTitle: {
    fontSize: 18,
    color: '#fff',
    marginBottom: 20,
    textAlign: 'center',
  },
  callButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginBottom: 16,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  whatsappButton: {
    backgroundColor: '#25D366',
  },
  phoneButton: {
    backgroundColor: '#4A90E2',
  },
  callButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 12,
  },
  callingText: {
    marginTop: 20,
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
});
