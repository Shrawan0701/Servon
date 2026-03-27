import React from 'react';
import { Text, StyleSheet, View, TouchableOpacity } from 'react-native';
import { WebPageLayout } from './WebPageLayout';
import { Ionicons } from "@expo/vector-icons";

export default function PricingPage({ onNavigate }) {
  return (
    <WebPageLayout 
      onNavigate={onNavigate}
      title="Pricing Plans" 
      subtitle="Simple, flat-rate pricing designed for hospitality scaling.">
      
      <View style={ts.pricingHero}>
        <Text style={ts.tag}>ONE PLAN. ALL ACCESS.</Text>
        <Text style={ts.priceMain}>₹999<Text style={{ fontSize: 24, color: '#636E72' }}>/month</Text></Text>
        <Text style={ts.p}>Billed monthly. Cancel anytime.</Text>
        
        <View style={ts.featureList}>
          {[
            "Unlimited Table QR Generations",
            "Unlimited Monthly Orders",
            "Full ERP & Inventory Suite",
            "Multi-Device Kitchen Sync",
            "Real-time Dashboard Access",
            "GST-Ready PDF Reports",
            "No Per-Order Commissions"
          ].map(f => (
            <View key={f} style={ts.checkRow}>
              <Ionicons name="checkmark-circle" size={20} color="#008060" />
              <Text style={[ts.p, { marginLeft: 10, marginBottom: 0 }]}>{f}</Text>
            </View>
          ))}
        </View>

        <TouchableOpacity 
          style={ts.primaryBtn}
          onPress={() => onNavigate('signup')}>
          <Text style={ts.btnText}>Start Now</Text>
        </TouchableOpacity>
      </View>

  </WebPageLayout>
  );
}

const ts = StyleSheet.create({
  h: { fontSize: 24, fontWeight: '800', color: '#121417', marginTop: 60, marginBottom: 20 },
  p: { fontSize: 16, color: '#4A4A4A', lineHeight: 26, marginBottom: 15 },
  pricingHero: { backgroundColor: '#121417', borderRadius: 32, padding: 60, alignItems: 'center' },
  tag: { color: '#008060', fontWeight: '900', letterSpacing: 2, marginBottom: 20 },
  priceMain: { fontSize: 80, fontWeight: '900', color: '#FFF', marginBottom: 10 },
  featureList: { width: '100%', marginTop: 40, marginBottom: 50 },
  checkRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  primaryBtn: { backgroundColor: '#008060', paddingHorizontal: 50, paddingVertical: 22, borderRadius: 16 },
  btnText: { color: '#FFF', fontWeight: '800', fontSize: 18 }
});