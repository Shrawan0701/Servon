import React from 'react';
import {
  Text,
  StyleSheet,
  View,
  TouchableOpacity,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { WebPageLayout } from './WebPageLayout';
import { Ionicons } from "@expo/vector-icons";

const isWeb = Platform.OS === "web";

export default function AboutPage({ onNavigate }) {
  const { width } = useWindowDimensions();
  const isMobile = width < 800;

  const stats = [
    { label: "Guest ordering", value: "QR" },
    { label: "Kitchen workflow", value: "KOT" },
    { label: "Business insights", value: "AI" },
  ];

  const coreValues = [
    {
      title: "Data Ownership",
      desc: "Your customer contacts, sales history, and revenue numbers belong strictly to you. Servon never sells or shares your restaurant data.",
      icon: "shield-checkmark-outline",
    },
    {
      title: "Kitchen-First Speed",
      desc: "In high-pressure rush hours, every second counts. Our interface is stripped of fluff so staff can take orders and dispatch KOTs instantly.",
      icon: "flash-outline",
    },
    {
      title: "Transparent Pricing",
      desc: "No hidden transaction cuts, surprise add-ons, or forced proprietary hardware locks. Simple flat-rate billing that scales with you.",
      icon: "pricetag-outline",
    },
  ];

  return (
    <WebPageLayout
      onNavigate={onNavigate}
      title="Built for Real Kitchens"
      subtitle="Servon provides independent restaurant owners with fast, reliable, and private point-of-sale software."
    >
      <View style={s.container}>

        {/* STATS BANNER */}
        <View style={[s.statsRow, isMobile && s.statsRowMobile]}>
          {stats.map((stat, idx) => (
            <View key={idx} style={s.statBox}>
              <Text style={s.statValue}>{stat.value}</Text>
              <Text style={s.statLabel}>{stat.label}</Text>
            </View>
          ))}
        </View>

        {/* MISSION STATEMENT CARD */}
        <View style={s.cardSection}>
          <Text style={s.kicker}>OUR PURPOSE</Text>
          <Text accessibilityRole="heading" style={s.cardTitle}>Why We Built Servon</Text>
          <Text style={s.bodyText}>
            Operating a restaurant is demanding enough without complex software getting in the way. Servon was created to give owners direct control over their billing, kitchen workflow, and customer data.
          </Text>
          <Text style={s.bodyText}>
            By eliminating per-order commissions and expensive hardware dependencies, Servon keeps your margins intact while providing floor staff with an intuitive tool that works seamlessly online or offline.
          </Text>
        </View>

        {/* CORE VALUES GRID */}
        <View style={s.valuesSection}>
          <View style={s.valuesHeaderBlock}>
            <Text style={s.kicker}>CORE PRINCIPLES</Text>
            <Text accessibilityRole="heading" style={s.cardTitle}>How We Productize Servon</Text>
          </View>

          <View style={[s.grid, isMobile && s.gridMobile]}>
            {coreValues.map((value, idx) => (
              <View
                key={idx}
                style={[
                  s.valueCard,
                  isMobile ? s.valueCardMobile : s.valueCardDesktop
                ]}
              >
                <View style={s.iconBadge}>
                  <Ionicons name={value.icon} size={22} color="#477047" />
                </View>
                <Text accessibilityRole="heading" style={s.valueCardTitle}>{value.title}</Text>
                <Text style={s.valueCardDesc}>{value.desc}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* ARCHITECTURE & WORKFLOW CARD */}
        <View style={s.cardSection}>
          <Text style={s.kicker}>RELIABILITY FIRST</Text>
          <Text accessibilityRole="heading" style={s.cardTitle}>Zero Downtime Operational Flow</Text>
          <Text style={s.bodyText}>
            Internet outages shouldn't bring your service to a halt. Servon utilizes a local-first sync architecture—allowing your cashiers to print receipts and your kitchen staff to process KOTs uninterrupted, even during total network disconnections.
          </Text>
        </View>

        {/* CTA CALLOUT BANNER */}
        <View style={[s.ctaCard, isMobile && s.ctaCardMobile]}>
          <View style={{ flex: 1 }}>
            <Text accessibilityRole="heading" style={s.ctaTitle}>Ready to streamline your operations?</Text>
            <Text style={s.ctaSub}>
              Get in touch for a product walkthrough tailored to your restaurant.
            </Text>
          </View>
          <TouchableOpacity
            style={s.ctaBtn}
            onPress={() => onNavigate?.("pricing")}
            activeOpacity={0.85}
          >
            <Text style={s.ctaBtnText}>Explore Plans</Text>
            <Ionicons name="arrow-forward" size={16} color="#FFFEF8" />
          </TouchableOpacity>
        </View>

      </View>
    </WebPageLayout>
  );
}

const s = StyleSheet.create({
  container: {
    width: '100%',
    maxWidth: 960,
    alignSelf: 'center',
    paddingVertical: 10,
  },

  kicker: {
    fontSize: 11,
    fontWeight: '600',
    color: '#477047',
    letterSpacing: 1.2,
    marginBottom: 6,
  },

  cardTitle: {
    fontSize: 22,
    fontWeight: '600',
    color: '#193A2C',
    marginBottom: 14,
    letterSpacing: -0.3,
  },

  bodyText: {
    fontSize: 15,
    color: '#52664D',
    lineHeight: 25,
    marginBottom: 12,
  },

  // STATS BANNER
  statsRow: {
    flexDirection: 'row',
    backgroundColor: '#FFFEF8',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#DEE5D5',
    padding: 24,
    marginBottom: 28,
    justifyContent: 'space-around',
    shadowColor: '#193A2C',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 8,
    elevation: 1,
  },
  statsRowMobile: {
    flexDirection: 'column',
    gap: 20,
    alignItems: 'center',
  },
  statBox: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 32,
    fontWeight: '600',
    color: '#477047',
    letterSpacing: -1,
  },
  statLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6C7D63',
    marginTop: 4,
  },

  // MAIN CARD SECTIONS
  cardSection: {
    backgroundColor: '#FFFEF8',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#DEE5D5',
    padding: 32,
    marginBottom: 28,
    shadowColor: '#193A2C',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 8,
    elevation: 1,
  },

  // CORE VALUES
  valuesSection: {
    marginBottom: 28,
  },
  valuesHeaderBlock: {
    marginBottom: 16,
    paddingLeft: 4,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  gridMobile: {
    flexDirection: 'column',
    gap: 16,
  },
  valueCard: {
    backgroundColor: '#FFFEF8',
    padding: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#DEE5D5',
    shadowColor: '#193A2C',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 6,
    elevation: 1,
  },
  valueCardDesktop: {
    flex: 1,
    minWidth: 260,
  },
  valueCardMobile: {
    width: '100%',
  },
  iconBadge: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#EAF1DF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  valueCardTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#193A2C',
    marginBottom: 8,
  },
  valueCardDesc: {
    fontSize: 14,
    color: '#6C7D63',
    lineHeight: 22,
  },

  // CTA CARD
  ctaCard: {
    backgroundColor: '#193A2C',
    borderRadius: 12,
    padding: 32,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 20,
    marginTop: 8,
  },
  ctaCardMobile: {
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  ctaTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFEF8',
    marginBottom: 4,
  },
  ctaSub: {
    fontSize: 14,
    color: '#B7C5AC',
    lineHeight: 20,
  },
  ctaBtn: {
    backgroundColor: '#477047',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    cursor: isWeb ? "pointer" : "default",
  },
  ctaBtnText: {
    color: '#FFFEF8',
    fontWeight: '700',
    fontSize: 14,
  },
});
