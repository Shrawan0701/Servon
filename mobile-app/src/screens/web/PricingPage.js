import React from 'react';
import {
  Text,
  StyleSheet,
  View,
  TouchableOpacity,
  Platform,
} from 'react-native';

import { WebPageLayout } from './WebPageLayout';
import { Ionicons } from "@expo/vector-icons";

const isWeb = Platform.OS === "web";

export default function PricingPage({ onNavigate }) {

  const features = [
    "Unlimited Table QR Generations",
    "Unlimited Monthly Orders",
    "Full ERP & Inventory Suite",
    "Multi-Device Kitchen Sync",
    "Real-time Dashboard Access",
    "Advanced Analytics & Reports",
    "Priority Support Access",
    "No Hidden Charges"
  ];

  return (
    <WebPageLayout
      onNavigate={onNavigate}
      title="Simple pricing for modern restaurants"
      subtitle="One transparent plan with everything you need to run and scale operations smoothly."
    >

      <View style={ts.wrapper}>

        <View style={ts.leftSection}>

          <Text style={ts.badge}>
            ALL FEATURES INCLUDED
          </Text>

          <Text style={ts.heading}>
            Built for restaurants that want simplicity, speed, and complete operational control.
          </Text>

          <Text style={ts.description}>
            No complicated plans. No surprise costs. Servon gives you the complete restaurant operating system in one affordable monthly subscription.
          </Text>

          <View style={ts.featureGrid}>
            {features.map((f) => (
              <View key={f} style={ts.featureItem}>
                <Ionicons
                  name="checkmark-circle"
                  size={20}
                  color="#008060"
                />

                <Text style={ts.featureText}>
                  {f}
                </Text>
              </View>
            ))}
          </View>

        </View>

        <View style={ts.priceCardWrapper}>
          <View style={ts.priceCard}>

            <Text style={ts.priceLabel}>
              STARTING AT
            </Text>

            <View style={ts.priceRow}>
              <Text style={ts.currency}>₹</Text>

              <Text style={ts.price}>
                999
              </Text>
            </View>

            <Text style={ts.perMonth}>
              per month
            </Text>

            <Text style={ts.note}>
              Cancel anytime. No setup fees. No long-term contracts.
            </Text>

            <TouchableOpacity
              style={ts.primaryBtn}
              onPress={() => onNavigate('signup')}
            >
              <Text style={ts.btnText}>
                Get Started
              </Text>
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
    gap: 32,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    width: '100%',
  },

  leftSection: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 400,
    width: '100%',
  },

  badge: {
    color: '#008060',
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: 12,
    fontSize: 13,
  },

  heading: {
    fontSize: 36,
    lineHeight: 44,
    fontWeight: '900',
    color: '#121417',
    marginBottom: 16,
    letterSpacing: -0.5,
  },

  description: {
    fontSize: 16,
    lineHeight: 26,
    color: '#5F6B76',
    marginBottom: 28,
    maxWidth: 640,
  },

  featureGrid: {
    gap: 14,
    marginTop: 8,
  },

  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  featureText: {
    marginLeft: 10,
    fontSize: 15,
    color: '#1E1E1E',
    fontWeight: '500',
    flex: 1,
    lineHeight: 22,
  },

  priceCardWrapper: {
    flexGrow: 1,
    flexShrink: 0,
    flexBasis: 320,
    maxWidth: 380,
    width: '100%',
  },

  priceCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 32,
    borderWidth: 1,
    borderColor: '#E7EAEE',

    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },

    elevation: 3,
  },

  priceLabel: {
    fontSize: 12,
    letterSpacing: 1.5,
    fontWeight: '800',
    color: '#008060',
    marginBottom: 12,
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
    color: '#121417',
    marginTop: 6,
    marginRight: 2,
  },

  price: {
    fontSize: 64,
    fontWeight: '900',
    color: '#121417',
    lineHeight: 72,
  },

  perMonth: {
    fontSize: 16,
    color: '#5F6B76',
    fontWeight: '600',
    marginBottom: 16,
    textAlign: 'center',
  },

  note: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
    marginBottom: 24,
    textAlign: 'center',
  },

  primaryBtn: {
    backgroundColor: '#121417',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    cursor: isWeb ? 'pointer' : 'default',
  },

  btnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 16,
  },

});