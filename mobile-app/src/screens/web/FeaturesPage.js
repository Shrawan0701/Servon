import React from "react";
import {
  Text,
  StyleSheet,
  View,
  TouchableOpacity,
  useWindowDimensions,
} from "react-native";
import { WebPageLayout } from "./WebPageLayout";
import { Ionicons } from "@expo/vector-icons";

export default function FeaturesPage({ onNavigate }) {
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  const categories = [
    {
      title: "Security & Role Access",
      items: [
        {
          name: "Chef Mode™",
          desc: "Hide sensitive revenue insights, analytics, and financial reports from staff-facing screens with a single secure toggle.",
          icon: "shield-half-outline",
        },
        {
          name: "Audit Logs & Roles",
          desc: "Track staff activity, order edits, cancellations, and operational actions with complete transparency and role-based permissions.",
          icon: "finger-print-outline",
        },
      ],
    },
    {
      title: "Customer Experience",
      items: [
        {
          name: "Smart QR Ordering",
          desc: "Customers can instantly browse menus and place orders directly from their phones without downloading any application.",
          icon: "qr-code-outline",
        },
        {
          name: "Dynamic Digital Menus",
          desc: "Update prices, mark items unavailable, and launch special offers in real-time across every table instantly.",
          icon: "grid-outline",
        },
        {
          name: "Loyalty & Feedback",
          desc: "Collect customer feedback automatically and trigger repeat visit discounts via WhatsApp and SMS messaging.",
          icon: "heart-outline",
        },
      ],
    },
    {
      title: "Kitchen & Operations",
      items: [
        {
          name: "Kitchen Display (KDS) & Sync",
          desc: "Orders move instantly from tables to kitchen display screens with zero confusion, reducing delays and prep bottlenecks.",
          icon: "flame-outline",
        },
        {
          name: "Seamless Billing & GST",
          desc: "Generate split-bills, process localized digital payments, print KOT receipts, and auto-calculate GST with zero terminal lag.",
          icon: "receipt-outline",
        },
        {
          name: "Multi-Terminal Sync",
          desc: "Manage multiple billing counters and handheld captain devices simultaneously without data collisions or lag.",
          icon: "hardware-chip-outline",
        },
      ],
    },
    {
      title: "Inventory & Business Intelligence",
      items: [
        {
          name: "Granular Analytics",
          desc: "Get insights into peak hours, top-selling dishes, staff performance, and operational trends from one unified dashboard.",
          icon: "bar-chart-outline",
        },
        {
          name: "AI Business Advisor",
          desc: "Consult with a specialized assistant that analyzes your sales, ingredient costs, and menu performance to find extra profit.",
          icon: "sparkles-outline",
        },
        {
          name: "Recipe & Inventory Tracking",
          desc: "Automatically deduct raw ingredient stock per order to prevent kitchen wastage and track variance in real-time.",
          icon: "cube-outline",
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
                  style={[
                    styles.card,
                    isMobile ? styles.cardMobile : styles.cardDesktop,
                  ]}
                >
                  <View style={styles.iconBadge}>
                    <Ionicons name={item.icon} size={22} color="#008060" />
                  </View>

                  <Text style={styles.cardTitle}>{item.name}</Text>
                  <Text style={styles.cardDesc}>{item.desc}</Text>
                </View>
              ))}
            </View>
          </View>
        ))}

        {/* BOTTOM CTA BANNER */}
        <View style={[styles.ctaCard, isMobile && styles.ctaCardMobile]}>
          <View style={styles.ctaTextContainer}>
            <Text style={styles.ctaTitle}>Ready to transform your restaurant?</Text>
            <Text style={styles.ctaSub}>
              Experience how Servon can streamline operations and boost your profit margins.
            </Text>
          </View>
          <TouchableOpacity
            style={styles.ctaButton}
            onPress={() => onNavigate("contact")}
            activeOpacity={0.85}
          >
            <Text style={styles.ctaButtonText}>Book Live Demo</Text>
          </TouchableOpacity>
        </View>
      </View>
    </WebPageLayout>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
  },
  categorySection: {
    marginBottom: 44,
  },
  categoryHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
    gap: 16,
  },
  categoryTitle: {
    fontSize: 18,
    fontWeight: "800",
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
    gap: 20,
  },
  card: {
    backgroundColor: "#FFFFFF",
    padding: 24,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#EAEAEA",
    alignItems: "flex-start",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 1,
  },
  cardDesktop: {
    width: "48.5%",
    flexGrow: 1,
  },
  cardMobile: {
    width: "100%",
  },
  iconBadge: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#E6F4EA",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 18,
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

  // CTA Section
  ctaCard: {
    marginTop: 20,
    marginBottom: 40,
    backgroundColor: "#0F172A",
    borderRadius: 20,
    padding: 36,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 24,
  },
  ctaCardMobile: {
    flexDirection: "column",
    alignItems: "flex-start",
    padding: 24,
  },
  ctaTextContainer: {
    flex: 1,
  },
  ctaTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#FFFFFF",
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  ctaSub: {
    fontSize: 15,
    color: "#94A3B8",
    lineHeight: 22,
  },
  ctaButton: {
    backgroundColor: "#008060",
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
  },
  ctaButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
});