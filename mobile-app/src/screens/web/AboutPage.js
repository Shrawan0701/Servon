import React from 'react';
import { Text, StyleSheet, View, Image } from 'react-native';
import { WebPageLayout } from './WebPageLayout';

export default function AboutPage({ onNavigate }) {
  return (
    <WebPageLayout 
      onNavigate={onNavigate}
      title="The Servon Story" 
      subtitle="Empowering hospitality through data sovereignty.">
      
      <Text style={ts.h}>The Commission Crisis</Text>
      <Text style={ts.p}>By 2026, the Indian restaurant industry faced a critical turning point. Third-party aggregators were consuming up to 30% of gross revenue, and owners were losing direct relationships with their diners. Servon was built to stop this bleed.</Text>
      
      <Text style={ts.h}>Our Digital Fortress</Text>
      <Text style={ts.p}>We don't just provide a POS. We provide a 'Digital Fortress' where your customer data is safe, your revenue is protected via Chef Mode™, and your operations are streamlined via real-time ERP tools.</Text>

      <View style={ts.visionCard}>
        <Text style={ts.visionTitle}>Our Core Values</Text>
        <Text style={ts.p}>• <strong>Privacy:</strong> We believe what you earn is your business only.</Text>
        <Text style={ts.p}>• <strong>Simplicity:</strong> Technology should disappear into the workflow of a busy kitchen.</Text>
        <Text style={ts.p}>• <strong>Affordability:</strong> High-end tech shouldn't only be for massive chains.</Text>
      </View>

      <Text style={ts.h}>Built for the Indian Kitchen</Text>
      <Text style={ts.p}>From local bistros in Bangalore to massive dining halls in Delhi, Servon is designed for the high-volume, high-energy environment of Indian hospitality. We understand the need for speed, reliability, and financial clarity.</Text>
    </WebPageLayout>
  );
}

const ts = StyleSheet.create({
  h: { fontSize: 22, fontWeight: '800', color: '#121417', marginTop: 40, marginBottom: 15 },
  p: { fontSize: 16, color: '#4A4A4A', lineHeight: 26, marginBottom: 15 },
  visionCard: { backgroundColor: '#F9FBF9', padding: 40, borderRadius: 28, borderWidth: 1, borderColor: '#008060', marginTop: 40 },
  visionTitle: { fontSize: 20, fontWeight: '900', marginBottom: 20, color: '#008060' }
});