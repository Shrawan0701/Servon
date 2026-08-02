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

export default function PricingPage({ onNavigate }) {
  const { width } = useWindowDimensions();

  const plans = [
    {
      id: "monthly",
      kicker: "MONTHLY FLEX",
      planName: "Monthly",
      price: "₹999",
      period: "/month",
      savingsNote: "Standard Monthly Plan",
      stampText: null,
      isPopular: false,
    },
    {
      id: "quarterly",
      kicker: "MOST POPULAR",
      planName: "Quarterly",
      price: "₹2,500",
      period: "/4 months",
      savingsNote: "Save ~₹1,500 (37% OFF)",
      stampText: "BEST\nVALUE",
      isPopular: true,
    },
    {
      id: "yearly",
      kicker: "MAXIMUM SAVINGS",
      planName: "Yearly",
      price: "₹6,000",
      period: "/year",
      savingsNote: "Save ~₹6,000 (50% OFF)",
      stampText: "50%\nOFF",
      isPopular: false,
    },
  ];

  return (
    <WebPageLayout
      onNavigate={onNavigate}
      title="Simple, transparent pricing"
      subtitle="Choose the billing plan that fits your restaurant. All plans include full feature access."
    >
      <View style={ts.container}>
        {/* 3 RECEIPT CARDS GRID */}
        <View style={ts.grid}>
          {plans.map((plan) => (
            <View
              key={plan.id}
              style={[ts.billCard, plan.isPopular && ts.billCardPopular]}
            >
              {/* Top Punch Holes */}
              <View style={ts.billPunchRow}>
                {Array.from({ length: 10 }).map((_, i) => (
                  <View key={i} style={ts.billPunchHole} />
                ))}
              </View>

              {/* Header & Stamp */}
              <View style={ts.billHeaderRow}>
                <View>
                  <Text style={ts.billKicker}>{plan.kicker}</Text>
                  <Text style={ts.billPlanName}>{plan.planName}</Text>
                </View>
                {plan.stampText && (
                  <View style={ts.billStamp}>
                    <Text style={ts.billStampText}>{plan.stampText}</Text>
                  </View>
                )}
              </View>

              {/* Price Display */}
              <View style={ts.billPriceBlock}>
                <View style={{ flexDirection: "row", alignItems: "baseline" }}>
                  <Text style={ts.billPriceTag}>{plan.price}</Text>
                  <Text style={ts.billPricePeriod}>{plan.period}</Text>
                </View>
                <Text style={ts.billSavingsText}>{plan.savingsNote}</Text>
              </View>

              <View style={ts.billDivider} />

              {/* Included Features List */}
              <View style={ts.billItemList}>
                {[
                  { text: "10-Day Full Access Free Trial", highlight: true },
                  { text: "Offline Mode (Works Without Internet)", highlight: true },
                  { text: "Voice AI Assistance & Commands", highlight: true },
                  { text: "Real-time AI Alerts & Daily Summaries", highlight: true },
                  { text: "Unlimited QR Menu Scans & Orders" },
                  { text: "Full Chef Mode™ Financial Privacy" },
                  { text: "Live Kitchen Dashboard (KOT Sync)" },
                  { text: "Verified In-App Reviews" },
                  { text: "Inventory & Expense ERP Suite" },
                  { text: "Export PDF & CSV Reports" },
                  { text: "24/7 Priority Support" },
                ].map((item, idx) => (
                  <View key={idx} style={ts.billItemRow}>
                    <Text
                      style={[
                        ts.billItemLabel,
                        item.highlight && ts.billItemHighlight,
                      ]}
                    >
                      {item.text}
                    </Text>
                    <View style={ts.billItemLeader} />
                    <Ionicons
                      name="checkmark-circle"
                      size={16}
                      color={item.highlight ? "#008060" : "#10B981"}
                    />
                  </View>
                ))}
              </View>

              <View style={ts.billDividerDashed} />

              {/* CTA Button */}
              <TouchableOpacity
                style={[ts.billCta, plan.isPopular && ts.billCtaPopular]}
                onPress={() => onNavigate?.("signup")}
                activeOpacity={0.88}
              >
                <Text style={ts.billCtaText}>Start 10-Day Free Trial</Text>
                <Ionicons name="arrow-forward" size={16} color="#FFF" />
              </TouchableOpacity>

              {/* Sub Badge */}
              <View style={ts.trialSubBadge}>
                <Ionicons name="shield-checkmark" size={13} color="#008060" />
                <Text style={ts.trialSubText}>No credit card required</Text>
              </View>

              {/* Bottom Tear Line */}
              <View style={ts.billTearRow}>
                {Array.from({ length: 22 }).map((_, i) => (
                  <View key={i} style={ts.billTearTriangle} />
                ))}
              </View>
            </View>
          ))}
        </View>
      </View>
    </WebPageLayout>
  );
}

const ts = StyleSheet.create({
  container: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: 12,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 24,
    justifyContent: 'center',
    alignItems: 'stretch',
    width: '100%',
    maxWidth: 1200,
  },
  billCard: {
    flex: 1,
    minWidth: 320,
    maxWidth: 370,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingTop: 16,
    paddingHorizontal: 20,
    paddingBottom: 28,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    position: 'relative',
    overflow: 'hidden',

    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.06,
    shadowRadius: 20,
    elevation: 4,
  },
  billCardPopular: {
    borderColor: '#008060',
    borderWidth: 2,
    shadowOpacity: 0.12,
    shadowRadius: 28,
  },
  billPunchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
    paddingHorizontal: 4,
  },
  billPunchHole: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#E2E8F0',
  },
  billHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  billKicker: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: '#008060',
  },
  billPlanName: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0F172A',
  },
  billStamp: {
    borderWidth: 1.5,
    borderColor: '#D97706',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    transform: [{ rotate: '-4deg' }],
    backgroundColor: '#FEF3C7',
  },
  billStampText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#B45309',
    textAlign: 'center',
    lineHeight: 11,
  },
  billPriceBlock: {
    marginBottom: 10,
  },
  billPriceTag: {
    fontSize: 32,
    fontWeight: '900',
    color: '#0F172A',
  },
  billPricePeriod: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
    marginLeft: 4,
  },
  billSavingsText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#008060',
    marginTop: 2,
  },
  billDivider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 10,
  },
  billItemList: {
    gap: 8,
    marginVertical: 6,
  },
  billItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  billItemLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
  billItemHighlight: {
    color: '#008060',
    fontWeight: '800',
  },
  billItemLeader: {
    flex: 1,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    borderStyle: 'dashed',
    marginHorizontal: 6,
  },
  billDividerDashed: {
    borderBottomWidth: 1,
    borderBottomColor: '#CBD5E1',
    borderStyle: 'dashed',
    marginVertical: 14,
  },
  billCta: {
    backgroundColor: '#0F172A',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    gap: 6,
    cursor: isWeb ? 'pointer' : 'default',
  },
  billCtaPopular: {
    backgroundColor: '#008060',
  },
  billCtaText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
  },
  trialSubBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginTop: 10,
  },
  trialSubText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  billTearRow: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    overflow: 'hidden',
  },
  billTearTriangle: {
    width: 0,
    height: 0,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderBottomWidth: 5,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: '#F8FAFC',
  },
});