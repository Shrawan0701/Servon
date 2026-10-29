import React, { useState } from 'react';
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

export default function PricingPage({ onNavigate }) {
  const { width } = useWindowDimensions();
  const isMobile = width < 900;

  const [openFaq, setOpenFaq] = useState(null);

  const toggleFaq = (index) => {
    setOpenFaq(openFaq === index ? null : index);
  };

  const plans = [
    {
      id: "monthly",
      kicker: "MONTHLY FLEX",
      planName: "Monthly",
      price: "₹999",
      period: "/ month",
      savingsNote: "Standard flexibility, cancel anytime",
      badgeText: null,
      isPopular: false,
    },
    {
      id: "quarterly",
      kicker: "MOST POPULAR",
      planName: "Quarterly",
      price: "₹2,500",
      period: "/ 3 months",
      savingsNote: "Effective ~₹833/mo · Save 17%",
      badgeText: "BEST VALUE",
      isPopular: true,
    },
    {
      id: "yearly",
      kicker: "MAXIMUM SAVINGS",
      planName: "Yearly",
      price: "₹8,999",
      period: "/ year",
      savingsNote: "Effective ~₹750/mo · Save 25%",
      badgeText: "25% OFF",
      isPopular: false,
    },
  ];

  const featuresList = [
    "Offline Mode (Works Without Internet)",
    "Voice AI Assistance & Smart Commands",
    "Real-time AI Alerts & Daily Summaries",
    "Unlimited QR Menu Scans & Orders",
    "Chef Mode™ Financial Privacy Toggle",
    "Live Kitchen Display (KDS & KOT Sync)",
    "Inventory & Recipe Cost Tracking",
    "Export PDF, Excel & CSV Reports",
    "24/7 Priority Support & Onboarding",
  ];

  const faqs = [
    {
      q: "Can I see Servon before choosing a plan?",
      a: "Book a product demo with our team to explore ordering, kitchen operations, inventory and reports before choosing a plan.",
    },
    {
      q: "Does Servon work if my restaurant internet goes down?",
      a: "Yes. Servon includes native Offline Mode. Bills and kitchen orders sync locally and automatically push to the cloud once connectivity resumes.",
    },
    {
      q: "Are there any hidden setup fees or hardware lock-ins?",
      a: "Zero hidden fees. Servon runs on your existing devices (Android, iOS, PC, thermal printers) without requiring expensive custom hardware.",
    },
    {
      q: "Can I change or upgrade my plan later?",
      a: "You can switch between Monthly, Quarterly, and Yearly plans at any time directly from your admin panel.",
    },
  ];

  return (
    <WebPageLayout
      onNavigate={onNavigate}
      title="Simple, transparent pricing"
      subtitle="Choose the billing plan that fits your business. All plans include complete access to every feature."
    >
      <View style={s.container}>
        {/* PRICING CARDS GRID */}
        <View style={[s.grid, isMobile && s.gridMobile]}>
          {plans.map((plan) => (
            <View
              key={plan.id}
              style={[
                s.card,
                plan.isPopular && s.cardPopular,
                isMobile && s.cardMobileFull,
              ]}
            >
              {/* Popular Badge */}
              {plan.isPopular && (
                <View style={s.popularBadge}>
                  <Ionicons name="sparkles" size={12} color="#FFFEF8" />
                  <Text style={s.popularBadgeText}>MOST POPULAR</Text>
                </View>
              )}

              {/* Card Header */}
              <View style={s.cardHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={[s.kicker, plan.isPopular && s.kickerPopular]}>
                    {plan.kicker}
                  </Text>
                  <Text style={s.planName}>{plan.planName}</Text>
                </View>

                {plan.badgeText && !plan.isPopular && (
                  <View style={s.savingsTag}>
                    <Text style={s.savingsTagText}>{plan.badgeText}</Text>
                  </View>
                )}
              </View>

              {/* Pricing Section */}
              <View style={s.priceContainer}>
                <View style={s.priceRow}>
                  <Text style={s.priceAmount}>{plan.price}</Text>
                  <Text style={s.pricePeriod}>{plan.period}</Text>
                </View>
                <Text style={s.savingsNote}>{plan.savingsNote}</Text>
              </View>

              {/* CTA Button */}
              <TouchableOpacity
                style={[s.ctaButton, plan.isPopular && s.ctaButtonPopular]}
                onPress={() => onNavigate?.("landing", { openDemo: true })}
                activeOpacity={0.88}
              >
                <Text style={s.ctaText}>Book a Demo</Text>
                <Ionicons name="arrow-forward" size={16} color="#FFFEF8" />
              </TouchableOpacity>

              <View style={s.subBadge}>
                <Ionicons name="shield-checkmark-outline" size={14} color="#477047" />
                <Text style={s.subBadgeText}>Product walkthrough with our team</Text>
              </View>

              <View style={s.divider} />

              {/* Feature Checklist */}
              <Text style={s.featureHeaderText}>Included in this plan:</Text>
              <View style={s.featureList}>
                {featuresList.map((feature, idx) => (
                  <View key={idx} style={s.featureRow}>
                    <View style={s.checkBadge}>
                      <Ionicons name="checkmark" size={13} color="#477047" />
                    </View>
                    <Text style={s.featureText}>{feature}</Text>
                  </View>
                ))}
              </View>
            </View>
          ))}
        </View>

        {/* FREQUENTLY ASKED QUESTIONS */}
        <View style={s.faqSection}>
          <Text style={s.faqSectionTitle}>Frequently Asked Questions</Text>
          <Text style={s.faqSectionSub}>Everything you need to know about Servon plans and billing.</Text>

          <View style={s.faqList}>
            {faqs.map((item, idx) => {
              const isOpen = openFaq === idx;
              return (
                <View key={idx} style={s.faqCard}>
                  <TouchableOpacity
                    style={s.faqHeader}
                    onPress={() => toggleFaq(idx)}
                    activeOpacity={0.7}
                  >
                    <Text style={s.faqQuestion}>{item.q}</Text>
                    <Ionicons
                      name={isOpen ? "chevron-up" : "chevron-down"}
                      size={20}
                      color="#193A2C"
                    />
                  </TouchableOpacity>
                  {isOpen && <Text style={s.faqAnswer}>{item.a}</Text>}
                </View>
              );
            })}
          </View>
        </View>

        {/* ENTERPRISE / DEMO BANNER */}

      </View>
    </WebPageLayout>
  );
}

const s = StyleSheet.create({
  container: {
    width: "100%",
    alignItems: "center",
    paddingVertical: 10,
  },
  grid: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "stretch",
    gap: 24,
    width: "100%",
    maxWidth: 1140,
  },
  gridMobile: {
    flexDirection: "column",
    alignItems: "center",
  },
  card: {
    flex: 1,
    minWidth: 300,
    backgroundColor: "#FFFEF8",
    borderRadius: 12,
    padding: 28,
    borderWidth: 1,
    borderColor: "#DEE5D5",
    position: "relative",
    shadowColor: "#193A2C",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
  },
  cardMobileFull: {
    width: "100%",
  },
  cardPopular: {
    borderColor: "#477047",
    borderWidth: 2,
    shadowOpacity: 0.1,
    shadowRadius: 20,
  },
  popularBadge: {
    position: "absolute",
    top: -14,
    alignSelf: "center",
    backgroundColor: "#477047",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  popularBadgeText: {
    color: "#FFFEF8",
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginTop: 6,
  },
  kicker: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1,
    color: "#6C7D63",
    marginBottom: 4,
  },
  kickerPopular: {
    color: "#477047",
  },
  planName: {
    fontSize: 22,
    fontWeight: '600',
    color: "#193A2C",
  },
  savingsTag: {
    backgroundColor: "#EAF1DF",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  savingsTagText: {
    fontSize: 11,
    fontWeight: '600',
    color: "#477047",
  },
  priceContainer: {
    marginVertical: 20,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "baseline",
  },
  priceAmount: {
    fontSize: 38,
    fontWeight: '600',
    color: "#193A2C",
    letterSpacing: -1,
  },
  pricePeriod: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6C7D63",
    marginLeft: 6,
  },
  savingsNote: {
    fontSize: 13,
    fontWeight: "600",
    color: "#477047",
    marginTop: 4,
  },
  ctaButton: {
    backgroundColor: "#193A2C",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
    cursor: isWeb ? "pointer" : "default",
  },
  ctaButtonPopular: {
    backgroundColor: "#477047",
  },
  ctaText: {
    color: "#FFFEF8",
    fontWeight: "700",
    fontSize: 14,
  },
  subBadge: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 12,
  },
  subBadgeText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6C7D63",
  },
  divider: {
    height: 1,
    backgroundColor: "#EDF2E5",
    marginVertical: 20,
  },
  featureHeaderText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#193A2C",
    marginBottom: 12,
  },
  featureList: {
    gap: 10,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  checkBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#EAF1DF",
    alignItems: "center",
    justifyContent: "center",
  },
  featureText: {
    fontSize: 13,
    fontWeight: "500",
    color: "#334155",
    flex: 1,
  },

  // FAQ SECTION
  faqSection: {
    marginTop: 64,
    width: "100%",
    maxWidth: 800,
    alignItems: "center",
  },
  faqSectionTitle: {
    fontSize: 26,
    fontWeight: '600',
    color: "#193A2C",
    textAlign: "center",
  },
  faqSectionSub: {
    fontSize: 15,
    color: "#6C7D63",
    marginTop: 6,
    marginBottom: 32,
    textAlign: "center",
  },
  faqList: {
    width: "100%",
    gap: 12,
  },
  faqCard: {
    backgroundColor: "#FFFEF8",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#DEE5D5",
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  faqHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  faqQuestion: {
    fontSize: 15,
    fontWeight: "700",
    color: "#193A2C",
    flex: 1,
    marginRight: 12,
  },
  faqAnswer: {
    fontSize: 14,
    color: "#52664D",
    marginTop: 12,
    lineHeight: 22,
  },

  // ENTERPRISE BANNER
  contactBanner: {
    marginTop: 50,
    maxWidth: 1140,
    width: "100%",
    backgroundColor: "#193A2C",
    borderRadius: 12,
    padding: 32,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 24,
  },
  contactBannerMobile: {
    flexDirection: "column",
    alignItems: "flex-start",
    padding: 24,
  },
  contactTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: "#FFFEF8",
    marginBottom: 6,
  },
  contactSub: {
    fontSize: 14,
    color: "#B7C5AC",
    lineHeight: 20,
  },
  contactBtn: {
    backgroundColor: "#FFFEF8",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
  },
  contactBtnText: {
    color: "#193A2C",
    fontWeight: "700",
    fontSize: 14,
  },
});
