import React, { useState } from 'react';
import { Text, StyleSheet, View, TouchableOpacity } from 'react-native';
import { WebPageLayout } from './WebPageLayout';
import { Ionicons } from "@expo/vector-icons";

export default function FAQPage({ onNavigate }) {
  const [open, setOpen] = useState(null);
  const faqData = [
   
    { 
      q: "Is there any setup fee or hardware required?", 
      a: "There is zero setup fee. You do not need specialized hardware. Servon works on any device with a browser—Android tablets, iPads, or even old Windows PCs. Simply log in, upload your menu CSV, and you are live." 
    },
    { 
      q: "What happens if my restaurant's internet goes down?", 
      a: "Servon is designed with local caching. Front-of-house staff can still place orders on their devices. Once the internet returns, the system automatically syncs all offline KOTs to the cloud dashboard." 
    },
    { 
      q: "Can I export data for my CA?", 
      a: "Absolutely. In the Analytics tab, you can generate GST-ready reports for any custom date range. These export instantly as professional PDFs or detailed CSV files for your accountant." 
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