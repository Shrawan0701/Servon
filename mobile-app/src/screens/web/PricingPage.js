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
      period: "/ 4 months",
      savingsNote: "Effective ~₹625/mo · Save 37%",
      badgeText: "BEST VALUE",
      isPopular: true,
    },
    {
      id: "yearly",
      kicker: "MAXIMUM SAVINGS",
      planName: "Yearly",
      price: "₹6,000",
      period: "/ year",
      savingsNote: "Effective ₹500/mo · Save 50%",
      badgeText: "50% OFF",
      isPopular: false,
    },
  ];

  const featuresList = [
    "10-Day Full Access Free Trial",
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
      q: "Can I try Servon before committing to a paid plan?",
      a: "Yes! Every account starts with a 10-day unlimited free trial. No credit card or upfront deposit is required.",
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
                  <Ionicons name="sparkles" size={12} color="#FFFFFF" />
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
                onPress={() => onNavigate?.("login")}
                activeOpacity={0.88}
              >
                <Text style={s.ctaText}>Start 10-Day Free Trial</Text>
                <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
              </TouchableOpacity>

              <View style={s.subBadge}>
                <Ionicons name="shield-checkmark-outline" size={14} color="#008060" />
                <Text style={s.subBadgeText}>No credit card required</Text>
              </View>

              <View style={s.divider} />

              {/* Feature Checklist */}
              <Text style={s.featureHeaderText}>Included in this plan:</Text>
              <View style={s.featureList}>
                {featuresList.map((feature, idx) => (
                  <View key={idx} style={s.featureRow}>
                    <View style={s.checkBadge}>
                      <Ionicons name="checkmark" size={13} color="#008060" />
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
                      color="#0F172A"
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
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 28,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    position: "relative",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
  },
  cardMobileFull: {
    width: "100%",
  },
  cardPopular: {
    borderColor: "#008060",
    borderWidth: 2,
    shadowOpacity: 0.1,
    shadowRadius: 20,
  },
  popularBadge: {
    position: "absolute",
    top: -14,
    alignSelf: "center",
    backgroundColor: "#008060",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  popularBadgeText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "800",
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
    fontWeight: "800",
    letterSpacing: 1,
    color: "#64748B",
    marginBottom: 4,
  },
  kickerPopular: {
    color: "#008060",
  },
  planName: {
    fontSize: 22,
    fontWeight: "800",
    color: "#0F172A",
  },
  savingsTag: {
    backgroundColor: "#E6F4EA",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  savingsTagText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#008060",
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
    fontWeight: "900",
    color: "#0F172A",
    letterSpacing: -1,
  },
  pricePeriod: {
    fontSize: 14,
    fontWeight: "600",
    color: "#64748B",
    marginLeft: 6,
  },
  savingsNote: {
    fontSize: 13,
    fontWeight: "600",
    color: "#008060",
    marginTop: 4,
  },
  ctaButton: {
    backgroundColor: "#0F172A",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
    cursor: isWeb ? "pointer" : "default",
  },
  ctaButtonPopular: {
    backgroundColor: "#008060",
  },
  ctaText: {
    color: "#FFFFFF",
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
    color: "#64748B",
  },
  divider: {
    height: 1,
    backgroundColor: "#F1F5F9",
    marginVertical: 20,
  },
  featureHeaderText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0F172A",
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
    backgroundColor: "#E6F4EA",
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
    fontWeight: "800",
    color: "#0F172A",
    textAlign: "center",
  },
  faqSectionSub: {
    fontSize: 15,
    color: "#64748B",
    marginTop: 6,
    marginBottom: 32,
    textAlign: "center",
  },
  faqList: {
    width: "100%",
    gap: 12,
  },
  faqCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
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
    color: "#0F172A",
    flex: 1,
    marginRight: 12,
  },
  faqAnswer: {
    fontSize: 14,
    color: "#475569",
    marginTop: 12,
    lineHeight: 22,
  },

  // ENTERPRISE BANNER
  contactBanner: {
    marginTop: 50,
    maxWidth: 1140,
    width: "100%",
    backgroundColor: "#0F172A",
    borderRadius: 18,
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
    fontWeight: "800",
    color: "#FFFFFF",
    marginBottom: 6,
  },
  contactSub: {
    fontSize: 14,
    color: "#94A3B8",
    lineHeight: 20,
  },
  contactBtn: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
  },
  contactBtnText: {
    color: "#0F172A",
    fontWeight: "700",
    fontSize: 14,
  },
});