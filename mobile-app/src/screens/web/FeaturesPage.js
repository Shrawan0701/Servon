import React from "react";
import { Text, StyleSheet, View, useWindowDimensions } from "react-native";
import { WebPageLayout } from "./WebPageLayout";
import { Ionicons } from "@expo/vector-icons";

export default function FeaturesPage({ onNavigate }) {
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  const categories = [
    {
      title: "Security & Privacy",
      items: [
        {
          name: "Chef Mode™",
          desc: "Hide sensitive revenue insights, analytics, and financial reports from staff-facing screens with a single secure toggle.",
          icon: "shield-half",
        },
        {
          name: "Audit Logs",
          desc: "Track staff activity, order edits, cancellations, and operational actions with complete transparency and accountability.",
          icon: "finger-print",
        },
      ],
    },
    {
      title: "Customer Experience",
      items: [
        {
          name: "Smart QR Ordering",
          desc: "Customers can instantly browse menus and place orders directly from their phones without downloading any application.",
          icon: "qr-code",
        },
        {
          name: "Dynamic Digital Menus",
          desc: "Update prices, mark items unavailable, and launch special offers in real-time across every table instantly.",
          icon: "grid",
        },
      ],
    },
    {
      title: "Kitchen & Operations",
      items: [
        {
          name: "Kitchen Sync",
          desc: "Orders move instantly from tables to kitchen screens with zero confusion, reducing delays and improving coordination.",
          icon: "flame",
        },
        {
          name: "Seamless Billing",
          desc: "Generate split-bills, process localized digital payments, and print KOT receipts with zero terminal lag.",
          icon: "receipt",
        },
      ],
    },
    {
      title: "Business Intelligence",
      items: [
        {
          name: "Granular Analytics",
          desc: "Get insights into peak hours, top-selling dishes, staff performance, and operational trends from one dashboard.",
          icon: "bar-chart",
        },
        {
          name: "AI Business Advisor",
          desc: "Consult with a specialized assistant that analyzes your sales, ingredient costs, and menu performance to find extra profit.",
          icon: "chatbubbles",
        },
      ],
    },
  ];

  return (
    <WebPageLayout
      onNavigate={onNavigate}
      title="Platform Features"
      subtitle="A comprehensive overview of the Servon Restaurant OS infrastructure."
    >
      <View style={styles.container}>
        {categories.map((cat, i) => (
          <View key={i} style={styles.categorySection}>
            <View style={styles.categoryHeader}>
              <Text style={styles.categoryTitle}>{cat.title}</Text>
              <View style={styles.categoryLine} />
            </View>

            <View style={styles.gridContainer}>
              {cat.items.map((item, idx) => (
                <View
                  key={idx}
                  style={[styles.card, isMobile ? styles.cardMobile : styles.cardDesktop]}
                >
                  <View style={styles.iconBadge}>
                    <Ionicons name={item.icon} size={20} color="#008060" />
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
    width: "100%",
  },
  categorySection: {
    marginBottom: 48,
  },
  categoryHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
    gap: 16,
  },
  categoryTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#008060",
    letterSpacing: -0.3,
  },
  categoryLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#E2E8F0",
  },
  gridContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
  },
  card: {
    backgroundColor: "#FFFFFF",
    padding: 24,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    alignItems: "flex-start",
  },
  cardDesktop: {
    flexBasis: "48.5%",
    flexGrow: 1,
  },
  cardMobile: {
    width: "100%",
  },
  iconBadge: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "#E6F4EA",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#0F172A",
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  cardDesc: {
    fontSize: 14,
    color: "#475569",
    lineHeight: 22,
  },
});