import React from 'react';
import { Text, StyleSheet, View, useWindowDimensions } from 'react-native';
import { WebPageLayout } from './WebPageLayout';
import { Ionicons } from "@expo/vector-icons";

export default function FeaturesPage({ onNavigate }) {
  const { width } = useWindowDimensions();

  // Simple, clean responsive logic
  const isMobile = width < 768;
  const itemWidth = isMobile ? '100%' : '48%'; 

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
          name: "Seamless Billing",
          desc: "Generate split-bills, process localized digital payments, and print KOT receipts with zero terminal lag.",
          icon: "receipt"
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
          name: "AI Business Advisor",
          desc: "Consult with a specialized assistant that analyzes your sales, ingredient costs, and menu performance to find extra profit.",
          icon: "chatbubbles"
        }
      ]
    }
  ];

  return (
    <WebPageLayout 
      onNavigate={onNavigate}
      title="Platform Features" 
      subtitle="A comprehensive overview of the Servon Restaurant OS.">
      
      <View style={styles.container}>
        {categories.map((cat, i) => (
          <View key={i} style={styles.categorySection}>
            <Text style={styles.categoryTitle}>{cat.title}</Text>
            
            <View style={styles.gridContainer}>
              {cat.items.map((item, idx) => (
                <View key={idx} style={[styles.card, { width: itemWidth }]}>
                  <View style={styles.iconBadge}>
                    <Ionicons name={item.icon} size={22} color="#121417" />
                  </View>
                  
                  <Text style={styles.cardTitle}>{item.name}</Text>
                  <Text style={styles.cardDesc}>{item.desc}</Text>
                </View>
              ))}
            </View>
          </View>
        ))}
      </View>
    </WebPageLayout>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingHorizontal: 24,
    maxWidth: 1000, 
    alignSelf: 'center',
    marginVertical: 30,
  },
  categorySection: {
    marginBottom: 40,
  },
  categoryTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#008060',
    marginBottom: 20,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 20, 
  },
  card: {
    backgroundColor: '#FFFFFF', 
    padding: 30,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#EBE9E0',
    marginBottom: 10,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  iconBadge: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#F4F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#121417',
    marginBottom: 12,
  },
  cardDesc: {
    fontSize: 15,
    color: '#4A4A4A',
    lineHeight: 24,
  }
});