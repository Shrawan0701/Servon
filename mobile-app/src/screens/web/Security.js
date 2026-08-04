import React from 'react';
import {
  Text,
  StyleSheet,
  View,
  TouchableOpacity,
  Platform,
  useWindowDimensions,
} from 'react-native';

import { WebPageLayout } from './WebPageLayout';
import { Ionicons } from "@expo/vector-icons";

const isWeb = Platform.OS === "web";

export default function Security({ onNavigate }) {
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  const securityPillars = [
    {
      icon: "eye-off-outline",
      title: "Chef Mode™ Financial Privacy",
      description:
        "Protect sensitive restaurant revenue and margin data. Kitchen staff and floor servers view operational metrics (KOT, active orders) without access to total collection figures or profitability metrics.",
    },
    {
      icon: "lock-closed-outline",
      title: "Bank-Grade Data Encryption",
      description:
        "All data transferred between your mobile app, web terminal, and cloud servers is encrypted using 256-bit TLS/SSL encryption. Databases are encrypted at rest with AES-256 standards.",
    },
    {
      icon: "card-outline",
      title: "PCI-DSS Compliant Payments",
      description:
        "Servon never stores raw payment card numbers, UPI PINs, or sensitive banking credentials. All payment processing is directly tokenized and handled via Razorpay's PCI-DSS Level 1 infrastructure.",
    },
    {
      icon: "wifi-outline",
      title: "Offline-First Sync Integrity",
      description:
        "Order and billing data captured during internet outages are stored locally using encrypted database storage and synchronized seamlessly with collision-free resolution once connectivity resumes.",
    },
    {
      icon: "server-outline",
      title: "High-Availability Infrastructure",
      description:
        "Our backend services operate on cloud architecture featuring automated daily backups, redundant multi-region failovers, and a 99.9% uptime target for uninterrupted kitchen operations.",
    },
    {
      icon: "key-outline",
      title: "Role-Based Access Control (RBAC)",
      description:
        "Enforce strict permission hierarchies. Assign specific roles (Owner/Manager and Chef) with granular access limits across menu editing, discounts, reports, and staff management.",
    },
  ];

  return (
    <WebPageLayout
      onNavigate={onNavigate}
      title="Security & Data Protection"
      subtitle="How Servon Labs Private Limited safeguards your restaurant's financial privacy, operational data, and customer information."
    >
      <View style={s.container}>
        {/* LIGHT SECURITY SHIELD BANNER */}
        <View style={s.bannerCard}>
          <View style={s.bannerIconBox}>
            <Ionicons name="shield-checkmark-outline" size={28} color="#008060" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.bannerKicker}>DATA PRIVACY FIRST</Text>
            <Text style={s.bannerTitle}>Built for Absolute Business Privacy</Text>
            <Text style={s.bannerText}>
              Your restaurant's financial figures, inventory margins, and customer data belong exclusively to you. We maintain stringent technical safeguards to ensure uncompromised data integrity.
            </Text>
          </View>
        </View>

        {/* 6 SECURITY PILLARS GRID */}
        <View style={s.grid}>
          {securityPillars.map((item, idx) => (
            <View key={idx} style={s.card}>
              <View style={s.cardHeader}>
                <View style={s.iconWrap}>
                  <Ionicons name={item.icon} size={20} color="#008060" />
                </View>
                <Text style={s.cardTitle}>{item.title}</Text>
              </View>
              <Text style={s.cardDesc}>{item.description}</Text>
            </View>
          ))}
        </View>

        {/* RESPONSIBLE DISCLOSURE BOX */}
        <View style={s.disclosureCard}>
          <View style={{ flex: 1, minWidth: 260 }}>
            <Text style={s.disclosureTitle}>Report a Security Concern</Text>
            <Text style={s.disclosureText}>
              Have you discovered a potential security vulnerability or data concern? 
            </Text>
          </View>
          <TouchableOpacity
            style={s.emailBtn}
            onPress={() => onNavigate?.('Contact')}
            activeOpacity={0.85}
          >
            <Ionicons name="mail-unread-outline" size={16} color="#FFF" />
            <Text style={s.emailBtnText}>Report to Security Team</Text>
          </TouchableOpacity>
        </View>
      </View>
    </WebPageLayout>
  );
}

const s = StyleSheet.create({
  container: {
    width: '100%',
    maxWidth: 1000,
    alignSelf: 'center',
    paddingVertical: 12,
  },

  // LIGHT BANNER CARD
  bannerCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 28,
    marginBottom: 32,
    gap: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 8,
    elevation: 1,
  },
  bannerIconBox: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: '#E6F4EA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerKicker: {
    fontSize: 11,
    fontWeight: '800',
    color: '#008060',
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  bannerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 6,
    letterSpacing: -0.3,
  },
  bannerText: {
    fontSize: 14,
    lineHeight: 24,
    color: '#475569',
    maxWidth: 720,
  },

  // GRID SECTION
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 20,
    justifyContent: 'space-between',
  },
  card: {
    flexGrow: 1,
    flexBasis: 280,
    maxWidth: 480,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 6,
    elevation: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#E6F4EA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    flex: 1,
  },
  cardDesc: {
    fontSize: 13,
    lineHeight: 21,
    color: '#475569',
    fontWeight: '400',
  },

  // DISCLOSURE BOX
  disclosureCard: {
    marginTop: 36,
    backgroundColor: '#F8FAFC',
    borderRadius: 18,
    padding: 24,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  disclosureTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 4,
  },
  disclosureText: {
    fontSize: 13,
    color: '#64748B',
    maxWidth: 600,
    lineHeight: 18,
  },
  emailBtn: {
    backgroundColor: '#008060',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 10,
    gap: 8,
    cursor: isWeb ? 'pointer' : 'default',
  },
  emailBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
  },
});