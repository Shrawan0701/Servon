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
  const isMobile = width < 768;

  const features = [
    "Unlimited Table QR Generations",
    "Unlimited Monthly Orders",
    "Full ERP & Inventory Suite",
    "Multi-Device Kitchen Sync",
    "Real-time Dashboard Access",
    "Advanced Analytics & Reports",
    "Priority Support Access",
    "No Hidden Charges",
  ];

  return (
    <WebPageLayout
      onNavigate={onNavigate}
      title="Simple pricing for modern restaurants"
      subtitle="One transparent plan with everything you need to run and scale operations smoothly."
    >
      <View style={[ts.wrapper, isMobile && ts.wrapperMobile]}>
        
        {/* LEFT COLUMN: FEATURES & VALUE PROP */}
        <View style={ts.leftSection}>
          <Text style={ts.badge}>ALL FEATURES INCLUDED</Text>

          <Text style={[ts.heading, isMobile && ts.headingMobile]}>
            Built for restaurants that want simplicity, speed, and complete operational control.
          </Text>

          <Text style={[ts.description, isMobile && ts.descriptionMobile]}>
            No complicated plans. No surprise costs. Servon gives you the complete restaurant operating system in one affordable monthly subscription.
          </Text>

          <View style={ts.featureGrid}>
            {features.map((f) => (
              <View key={f} style={ts.featureItem}>
                <View style={ts.checkBadge}>
                  <Ionicons
                    name="checkmark"
                    size={14}
                    color="#008060"
                  />
                </View>
                <Text style={ts.featureText}>{f}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* RIGHT COLUMN: PRICE CARD */}
        <View style={ts.priceCardWrapper}>
          <View style={ts.priceCard}>
            <Text style={ts.priceLabel}>STARTING AT</Text>

            <View style={ts.priceRow}>
              <Text style={ts.currency}>₹</Text>
              <Text style={ts.price}>999</Text>
            </View>

            <Text style={ts.perMonth}>per month</Text>

            <Text style={ts.note}>
              Cancel anytime. No setup fees. No long-term contracts.
            </Text>

            <TouchableOpacity
              style={ts.primaryBtn}
              onPress={() => onNavigate('signup')}
              activeOpacity={0.85}
            >
              <Text style={ts.btnText}>Get Started</Text>
            </TouchableOpacity>
          </View>
        </View>

      </View>
    </WebPageLayout>
  );
}

const ts = StyleSheet.create({
  wrapper: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 40,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    width: '100%',
  },
  wrapperMobile: {
    gap: 32,
    paddingVertical: 0,
  },

  leftSection: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 480,
    width: '100%',
  },

  badge: {
    color: '#008060',
    fontWeight: '700',
    letterSpacing: 1.2,
    marginBottom: 12,
    fontSize: 12,
  },

  heading: {
    fontSize: 32,
    lineHeight: 40,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 16,
    letterSpacing: -0.6,
  },
  headingMobile: {
    fontSize: 24,
    lineHeight: 32,
  },

  description: {
    fontSize: 15,
    lineHeight: 24,
    color: '#475569',
    marginBottom: 28,
    maxWidth: 600,
  },
  descriptionMobile: {
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 20,
  },

  featureGrid: {
    gap: 12,
  },

  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  checkBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#E6F4EA',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },

  featureText: {
    fontSize: 15,
    color: '#1E293B',
    fontWeight: '600',
    flex: 1,
    lineHeight: 22,
  },

  priceCardWrapper: {
    flexGrow: 1,
    flexShrink: 0,
    flexBasis: 320,
    maxWidth: 400,
    width: '100%',
  },

  priceCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 36,
    borderWidth: 1,
    borderColor: '#E2E8F0',

    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },

    elevation: 4,
  },

  priceLabel: {
    fontSize: 12,
    letterSpacing: 1.5,
    fontWeight: '800',
    color: '#008060',
    marginBottom: 16,
    textAlign: 'center',
  },

  priceRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'center',
  },

  currency: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 6,
    marginRight: 4,
  },

  price: {
    fontSize: 64,
    fontWeight: '800',
    color: '#0F172A',
    lineHeight: 68,
    letterSpacing: -1.5,
  },

  perMonth: {
    fontSize: 15,
    color: '#64748B',
    fontWeight: '600',
    marginTop: 4,
    marginBottom: 16,
    textAlign: 'center',
  },

  note: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 18,
    marginBottom: 28,
    textAlign: 'center',
  },

  primaryBtn: {
    backgroundColor: '#0F172A',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    cursor: isWeb ? 'pointer' : 'default',
  },

  btnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
});