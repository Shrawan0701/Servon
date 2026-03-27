import React from 'react';
import { Text, StyleSheet, View, ScrollView } from 'react-native';
import { WebPageLayout } from './WebPageLayout';

export default function PrivacyPolicy({ onNavigate }) {
  return (
    <WebPageLayout 
      onNavigate={onNavigate}
      title="Privacy Policy" 
      subtitle="Your data sovereignty is our highest priority.">
      
      <Text style={ts.h}>1. Introduction to Data Privacy</Text>
      <Text style={ts.p}>Servon Technologies ("we", "us", or "our") is committed to protecting the privacy of restaurant owners and their customers. This policy outlines how we handle data within our POS and ERP ecosystem. We operate under a strict "Zero-Data-Monetization" policy, meaning your business insights are never sold.</Text>
      
      <Text style={ts.h}>2. Information Ownership</Text>
      <Text style={ts.p}>Unlike traditional aggregators, Servon acts solely as a data processor. You, the restaurant owner, remain the sole Data Controller. Every phone number collected via QR scans, every transaction record, and every inventory log belongs exclusively to your legal entity.</Text>
      
      <View style={ts.card}>
        <Text style={[ts.p, { fontWeight: '700', color: '#008060' }]}>DATA ENCRYPTION STANDARD</Text>
        <Text style={ts.p}>All financial records are encrypted using AES-256 at rest. Access via 'Chef Mode' is logged and audited to prevent unauthorized staff access to sensitive P&L data.</Text>
      </View>

      <Text style={ts.h}>3. Information We Collect</Text>
      <Text style={ts.p}>• Personal Account Data: Name, email, and phone number for authentication.</Text>
      <Text style={ts.p}>• Business Data: Menu items, pricing, inventory levels, and staff payroll details.</Text>
      <Text style={ts.p}>• Transactional Logs: Order timestamps, table numbers, and payment status.</Text>

      <Text style={ts.h}>4. Use of Information</Text>
      <Text style={ts.p}>We use your data strictly to facilitate restaurant operations: generating KOTs, calculating real-time net profit, and automating GST-ready reports. We do not use your data for marketing third-party services to your diners.</Text>

      <Text style={ts.h}>5. Third-Party Services</Text>
      <Text style={ts.p}>Servon integrates with UPI providers. Payment data is processed directly by the respective banks; Servon does not store credit card numbers or UPI PINs.</Text>
    </WebPageLayout>
  );
}

const ts = StyleSheet.create({
  h: { fontSize: 22, fontWeight: '800', color: '#121417', marginTop: 40, marginBottom: 15 },
  p: { fontSize: 16, color: '#4A4A4A', lineHeight: 26, marginBottom: 15 },
  card: { backgroundColor: '#F0FDF4', padding: 30, borderRadius: 20, borderWidth: 1, borderColor: '#EBE9E0', marginTop: 20 }
});