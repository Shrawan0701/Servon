import React from 'react';
import { Text, StyleSheet, View, TouchableOpacity, TextInput } from 'react-native';
import { WebPageLayout } from './WebPageLayout';
import { Ionicons } from "@expo/vector-icons";

export default function ContactPage({ onNavigate }) {
  return (
    <WebPageLayout 
      onNavigate={onNavigate}
      title="Contact Us" 
      subtitle="We are standing by to help you grow your brand.">
      
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 30 }}>
        <View style={[ts.card, { flex: 1, minWidth: 300 }]}>
          <Text style={ts.h}>General Inquiry</Text>
          <Text style={ts.p}>Interested in a demo or have specific questions about our ERP modules?</Text>
          
          <View style={ts.infoRow}>
            <Ionicons name="mail-outline" size={20} color="#008060" />
            <Text style={ts.infoText}>support@servon.cloud</Text>
          </View>
          
          

        
        </View>

        <View style={[ts.card, { flex: 1, minWidth: 300 }]}>
          <Text style={ts.h}>Sales & Onboarding</Text>
          <Text style={ts.p}>Ready to go live today? Our onboarding specialists can help you import your menu in bulk.</Text>
          <Text style={ts.infoText}>Available Mon - Sat (9 AM - 9 PM IST)</Text>
          <Text style={[ts.infoText, { marginTop: 10, fontWeight: '800' }]}>support@servon.cloud</Text>
        </View>
      </View>

     </WebPageLayout>
  );
}

const ts = StyleSheet.create({
  h: { fontSize: 22, fontWeight: '800', color: '#121417', marginTop: 10, marginBottom: 15 },
  p: { fontSize: 16, color: '#4A4A4A', lineHeight: 26, marginBottom: 20 },
  card: { backgroundColor: '#FFF', padding: 40, borderRadius: 28, borderWidth: 1, borderColor: '#EBE9E0' },
  infoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
  infoText: { fontSize: 16, color: '#121417', marginLeft: 12, fontWeight: '600' },
  whatsappBtn: { backgroundColor: '#121417', paddingVertical: 18, borderRadius: 12, marginTop: 25, alignItems: 'center' },
  waText: { color: '#FFF', fontWeight: '800' }
});