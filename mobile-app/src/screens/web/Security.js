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
      icon: "eye-off",
      title: "Chef Mode™ Financial Privacy",
      description:
        "Protect sensitive restaurant revenue and margin data. Kitchen staff and floor servers view operational metrics (KOT, active orders) without access to total collection figures or profitability metrics.",
    },
    {
      icon: "lock-closed",
      title: "Bank-Grade Data Encryption",
      description:
        "All data transferred between your mobile app, web terminal, and cloud servers is encrypted using 256-bit TLS/SSL encryption. Databases are encrypted at rest with AES-256 standards.",
    },
    {
      icon: "card",
      title: "PCI-DSS Compliant Payments",
      description:
        "Servon never stores raw payment card numbers, UPI PINs, or sensitive banking credentials. All payment processing is directly tokenized and handled via Razorpay's PCI-DSS Level 1 infrastructure.",
    },
    {
      icon: "wifi",
      title: "Offline-First Sync Integrity",
      description:
        "Order and billing data captured during internet outages are stored locally using encrypted database storage and synchronized seamlessly with collision-free resolution once connectivity resumes.",
    },
    {
      icon: "server",
      title: "High-Availability Infrastructure",
      description:
        "Our backend services operate on cloud architecture featuring automated daily backups, redundant multi-region failovers, and a 99.9% uptime target for uninterrupted kitchen operations.",
    },
    {
      icon: "key-working",
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
        {/* Security Shield Banner */}
        <View style={s.bannerCard}>
          <View style={s.bannerIconBox}>
            <Ionicons name="shield-checkmark" size={32} color="#008060" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.bannerTitle}>Built for Absolute Business Privacy</Text>
            <Text style={s.bannerText}>
              Your restaurant's financial figures, inventory margins, and customer data belong exclusively to you. We maintain stringent technical safeguards to ensure uncompromised data integrity.
            </Text>
          </View>
        </View>

        {/* 6 Security Pillars Grid */}
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

        {/* Responsible Disclosure Box */}
        <View style={s.disclosureCard}>
          <View style={{ flex: 1 }}>
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
            <Ionicons name="mail-unread" size={16} color="#FFF" />
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
  bannerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    borderRadius: 20,
    padding: 28,
    marginBottom: 32,
    gap: 20,
    flexWrap: 'wrap',
  },
  bannerIconBox: {
    width: 60,
    height: 60,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 128, 96, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#008060',
  },
  bannerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 6,
  },
  bannerText: {
    fontSize: 14,
    lineHeight: 22,
    color: '#94A3B8',
    maxWidth: 700,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 20,
    justifyContent: 'spaceBetween',
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
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 12,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  iconWrap: {
    width: 36,
    height: 36,
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
    lineHeight: 20,
    color: '#475569',
    fontWeight: '500',
  },
  disclosureCard: {
    marginTop: 36,
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
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
    backgroundColor: '#0F172A',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
    gap: 8,
    cursor: isWeb ? 'pointer' : 'default',
  },
  emailBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
});