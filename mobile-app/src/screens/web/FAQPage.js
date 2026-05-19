import React, { useState } from 'react';
import { Text, StyleSheet, View, TouchableOpacity } from 'react-native';
import { WebPageLayout } from './WebPageLayout';
import { Ionicons } from "@expo/vector-icons";

export default function FAQPage({ onNavigate }) {
  const [open, setOpen] = useState(null);
  const faqData = [
   
    {
    q: "How long does setup take?",
    a: "Most restaurants can get started within minutes. Upload your menu, generate QR codes, and begin taking orders without complicated onboarding."
  },
  {
    q: "What is Chef Mode™?",
    a: "Chef Mode™ is a privacy feature that hides sensitive business insights like revenue and expense data from staff-facing screens with a single toggle."
  },
  {
    q: "Does Servon require special hardware?",
    a: "No. Servon works smoothly on your existing phones, tablets, laptops, and desktop systems without needing expensive hardware."
  },
  {
    q: "Can customers order without downloading an app?",
    a: "Yes. Customers simply scan the QR code and access the digital menu directly from their browser for a fast and seamless ordering experience."
  }
  ];

  return (
    <WebPageLayout 
      onNavigate={onNavigate}
      title="FAQ" 
      subtitle="The most frequent questions from restaurant owners.">
      
      <View style={{ marginTop: 40 }}>
        {faqData.map((item, i) => (
          <TouchableOpacity 
            key={i} 
            activeOpacity={0.8}
            style={[ts.card, { marginBottom: 20 }]} 
            onPress={() => setOpen(open === i ? null : i)}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontSize: 18, fontWeight: '800', flex: 1, color: '#121417' }}>{item.q}</Text>
              <Ionicons name={open === i ? "remove-circle" : "add-circle"} size={26} color={open === i ? "#008060" : "#636E72"} />
            </View>
            {open === i && (
              <View style={{ marginTop: 20, borderTopWidth: 1, borderTopColor: '#EEE', paddingTop: 20 }}>
                <Text style={ts.p}>{item.a}</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>
    </WebPageLayout>
  );
}

const ts = StyleSheet.create({
  p: { fontSize: 16, color: '#4A4A4A', lineHeight: 26 },
  card: { backgroundColor: '#FFF', padding: 35, borderRadius: 24, borderWidth: 1, borderColor: '#EBE9E0' }
});