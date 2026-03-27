import React from 'react';
import { Text, StyleSheet, View, ScrollView } from 'react-native';
import { WebPageLayout } from './WebPageLayout';
import { Ionicons } from "@expo/vector-icons";

export default function FeaturesPage({ onNavigate }) {
  const categories = [
    {
      title: "Security & Privacy",
      items: [
        { name: "Chef Mode™", desc: "Instantly hide all financial analytics, individual bill amounts, and profit reports from staff logins. Keep your sensitive data private.", icon: "shield-half" },
        { name: "Audit Logs", desc: "Track every voided item, discount applied, and staff login time to eliminate internal theft.", icon: "finger-print" }
      ]
    },
    {
      title: "Front of House",
      items: [
        { name: "Dynamic QR Menus", desc: "Change prices, mark items as '86' (sold out), or run happy hour specials in real-time across all tables.", icon: "qr-code" },
        { name: "Direct UPI Billing", desc: "Let customers pay via their favorite UPI apps directly from the digital check. No hardware required.", icon: "wallet" }
      ]
    },
    {
      title: "Back of House & ERP",
      items: [
        { name: "Kitchen KOT Stream", desc: "Eliminate paper chits. Orders hit the kitchen tablet with specific preparation instructions and priority timers.", icon: "flame" },
        { name: "Live Expense Tracker", desc: "Log procurement of vegetables, meat, and dry goods. Servon subtracts these from sales to show true daily net profit.", icon: "calculator" }
      ]
    }
  ];

  return (
    <WebPageLayout 
      onNavigate={onNavigate}
      title="Platform Features" 
      subtitle="A comprehensive overview of the Servon Restaurant OS.">
      
      {categories.map((cat, i) => (
        <View key={i} style={{ marginBottom: 50 }}>
          <Text style={[ts.h, { color: '#008060' }]}>{cat.title}</Text>
          {cat.items.map((item, idx) => (
            <View key={idx} style={ts.card}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 15 }}>
                <Ionicons name={item.icon} size={24} color="#121417" />
                <Text style={[ts.h, { marginTop: 0, marginLeft: 15 }]}>{item.name}</Text>
              </View>
              <Text style={ts.p}>{item.desc}</Text>
            </View>
          ))}
        </View>
      ))}
    </WebPageLayout>
  );
}

const ts = StyleSheet.create({
  h: { fontSize: 22, fontWeight: '800', color: '#121417', marginTop: 40, marginBottom: 15 },
  p: { fontSize: 16, color: '#4A4A4A', lineHeight: 26 },
  card: { backgroundColor: '#FFF', padding: 30, borderRadius: 20, borderWidth: 1, borderColor: '#EBE9E0', marginBottom: 15 }
});