import React from 'react';
import { Text, StyleSheet, View, ScrollView } from 'react-native';
import { WebPageLayout } from './WebPageLayout';
import { Ionicons } from "@expo/vector-icons";

export default function FeaturesPage({ onNavigate }) {
 const categories = [
  {
    title: "Security & Privacy",
    items: [
      {
        name: "Chef Mode™",
        desc: "Hide sensitive revenue insights, analytics, and financial reports from staff-facing screens with a single secure toggle.",
        icon: "shield-half"
      },
      {
        name: "Audit Logs",
        desc: "Track staff activity, order edits, cancellations, and operational actions with complete transparency and accountability.",
        icon: "finger-print"
      }
    ]
  },

  {
    title: "Customer Experience",
    items: [
      {
        name: "Smart QR Ordering",
        desc: "Customers can instantly browse menus and place orders directly from their phones without downloading any application.",
        icon: "qr-code"
      },
      {
        name: "Dynamic Digital Menus",
        desc: "Update prices, mark items unavailable, and launch special offers in real-time across every table instantly.",
        icon: "grid"
      }
    ]
  },

  {
    title: "Kitchen & Operations",
    items: [
      {
        name: "Kitchen Sync",
        desc: "Orders move instantly from tables to kitchen screens with zero confusion, reducing delays and improving coordination.",
        icon: "flame"
      },
      {
        name: "Live Order Tracking",
        desc: "Monitor order preparation status in real-time so staff and managers always know what’s happening in the kitchen.",
        icon: "pulse"
      }
    ]
  },

  {
    title: "Business Intelligence",
    items: [
      {
        name: "Granular Analytics",
        desc: "Get insights into peak hours, top-selling dishes, staff performance, and operational trends from one dashboard.",
        icon: "bar-chart"
      },
      {
        name: "Expense ERP",
        desc: "Track procurement, operational expenses, and day-to-day business costs to better understand restaurant profitability.",
        icon: "calculator"
      }
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