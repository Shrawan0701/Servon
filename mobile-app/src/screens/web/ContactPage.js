import React, { useState } from 'react';
import {
  Text,
  StyleSheet,
  View,
  TouchableOpacity,
  TextInput,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { WebPageLayout } from './WebPageLayout';
import { Ionicons } from "@expo/vector-icons";

const isWeb = Platform.OS === 'web';

export default function ContactPage({ onNavigate }) {
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  const [form, setForm] = useState({ name: '', email: '', message: '' });
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = () => {
    if (form.name && form.email && form.message) {
      setSubmitted(true);
    }
  };

  return (
    <WebPageLayout
      onNavigate={onNavigate}
      title="Get in Touch"
      subtitle="We are standing by to help you scale operations, protect revenue, and grow your brand."
    >
      <View style={styles.container}>
        <View style={[styles.wrapper, isMobile && styles.wrapperMobile]}>
          
          {/* LEFT COLUMN: CONTACT CARDS */}
          <View style={[styles.infoCol, isMobile && styles.colMobile]}>
            {/* CARD 1: GENERAL INQUIRY */}
            <View style={[styles.card, isMobile && styles.cardMobile]}>
              <View style={styles.iconBadge}>
                <Ionicons name="mail" size={20} color="#008060" />
              </View>
              <Text style={styles.cardHeader}>General Inquiry</Text>
              <Text style={styles.cardDesc}>
                Interested in a demo or have specific questions about our ERP modules and Chef Mode™?
              </Text>
              <View style={styles.infoRow}>
                <Ionicons name="mail-outline" size={18} color="#008060" />
                <Text style={styles.infoText}>support@servon.cloud</Text>
              </View>
            </View>

            {/* CARD 2: SALES & ONBOARDING */}
            <View style={[styles.card, isMobile && styles.cardMobile]}>
              <View style={styles.iconBadge}>
                <Ionicons name="call" size={20} color="#008060" />
              </View>
              <Text style={styles.cardHeader}>Sales & Onboarding</Text>
              <Text style={styles.cardDesc}>
                Ready to go live today? Our onboarding specialists will help you import menus and set up QR ordering instantly.
              </Text>
              
              <View style={styles.infoRow}>
                <Ionicons name="time-outline" size={18} color="#64748B" />
                <Text style={styles.subInfoText}>Mon - Sat (9 AM - 9 PM IST)</Text>
              </View>

              <View style={[styles.infoRow, { marginTop: 8 }]}>
                <Ionicons name="mail-outline" size={18} color="#008060" />
                <Text style={styles.infoText}>support@servon.cloud</Text>
              </View>
            </View>
          </View>

          {/* RIGHT COLUMN: CONTACT FORM */}
         

        </View>
      </View>
    </WebPageLayout>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    maxWidth: 1000,
    alignSelf: 'center',
  },

  wrapper: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 32,
    alignItems: 'flex-start',
  },
  wrapperMobile: {
    flexDirection: 'column',
    flexWrap: 'nowrap',
    gap: 24,
  },

  infoCol: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 380,
    width: '100%',
    gap: 20,
  },

  formCol: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 440,
    width: '100%',
  },

  colMobile: {
    flexBasis: 'auto',
    flexGrow: 0,
    flexShrink: 0,
    width: '100%',
  },

  card: {
    backgroundColor: '#FFFFFF',
    padding: 32,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  cardMobile: {
    padding: 24,
    borderRadius: 16,
  },

  iconBadge: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#E6F4EA',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },

  cardHeader: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 8,
    letterSpacing: -0.4,
  },

  cardDesc: {
    fontSize: 14,
    color: '#64748B',
    lineHeight: 22,
    marginBottom: 20,
  },

  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },

  infoText: {
    fontSize: 15,
    color: '#0F172A',
    fontWeight: '700',
  },

  subInfoText: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '500',
  },

  // FORM CARD
  formCard: {
    backgroundColor: '#FFFFFF',
    padding: 36,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  formCardMobile: {
    padding: 24,
    borderRadius: 16,
  },

  formTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 6,
    letterSpacing: -0.4,
  },

  formSub: {
    fontSize: 14,
    color: '#64748B',
    lineHeight: 20,
    marginBottom: 24,
  },

  formGroup: {
    gap: 6,
  },

  label: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 10,
    marginBottom: 4,
  },

  input: {
    backgroundColor: '#FAF9F6',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: '#0F172A',
  },

  textArea: {
    height: 100,
    paddingTop: 12,
  },

  submitBtn: {
    backgroundColor: '#0F172A',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 20,
    cursor: isWeb ? 'pointer' : 'default',
  },

  submitBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },

  // SUCCESS STATE
  successState: {
    alignItems: 'center',
    paddingVertical: 32,
  },

  successBadge: {
    marginBottom: 16,
  },

  successTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 8,
  },

  successDesc: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 22,
  },
});