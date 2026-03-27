import React from 'react';
import { Text, StyleSheet, View } from 'react-native';
import { WebPageLayout } from './WebPageLayout';

export default function TermsOfService({ onNavigate }) {
  return (
    <WebPageLayout 
      onNavigate={onNavigate}
      title="Terms of Service" 
      subtitle="Standard legal agreement for the Servon platform.">
      
      <Text style={ts.h}>1. Acceptance of Terms</Text>
      <Text style={ts.p}>By accessing the Servon platform, you agree to be bound by these terms. If you are using this on behalf of a restaurant or hospitality group, you represent that you have the authority to bind that entity to these terms.</Text>
      
      <Text style={ts.h}>2. Subscription and Fees</Text>
      <Text style={ts.p}>Servon provides its software under a subscription-based model at the rate of ₹999 per month. This fee is subject to change with a 30-day notice. We do not charge per-transaction fees. Your subscription includes all software updates and standard 24/7 technical support.</Text>
      
      <View style={ts.card}>
        <Text style={ts.p}><strong>The No-Commission Promise:</strong> Servon will never take a percentage of your restaurant's gross sales. Our flat-fee model is permanent and core to our value proposition.</Text>
      </View>

      <Text style={ts.h}>3. User Conduct and Restrictions</Text>
      <Text style={ts.p}>Users are prohibited from: (a) Attempting to reverse engineer the POS software; (b) Using the platform for money laundering; (c) Bypassing the Chef Mode™ security protocols without owner authorization.</Text>

      <Text style={ts.h}>4. Termination of Service</Text>
      <Text style={ts.p}>You may terminate your account at any time via the billing portal. Upon termination, we provide a 7-day grace period to export all your business data in CSV/PDF format before it is permanently deleted from our active servers.</Text>

      <Text style={ts.h}>5. Limitation of Liability</Text>
      <Text style={ts.p}>Servon is not liable for any revenue loss caused by local hardware failure or internet outages. While our system has offline capabilities, final data sync requires a connection.</Text>
    </WebPageLayout>
  );
}

const ts = StyleSheet.create({
  h: { fontSize: 22, fontWeight: '800', color: '#121417', marginTop: 40, marginBottom: 15 },
  p: { fontSize: 16, color: '#4A4A4A', lineHeight: 26, marginBottom: 15 },
  card: { backgroundColor: '#FFF', padding: 30, borderRadius: 20, borderWidth: 1, borderColor: '#121417', marginTop: 25 }
});