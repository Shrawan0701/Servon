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

export default function Partners({ onNavigate }) {
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  const partnerTracks = [
    {
      icon: "briefcase",
      title: "Authorized Regional Resellers",
      subtitle: "For POS Dealers, IT Consultants & Restaurant Agencies",
      benefits: [
        "Attractive recurring revenue share on active subscriptions",
        "Dedicated partner dashboard to onboard & manage outlets",
        "Priority technical support & sales collateral for pitches",
        "Co-marketing opportunities & regional client leads",
      ],
    },
    {
      icon: "share-social",
      title: "Referral Network Partners",
      subtitle: "For Food Bloggers, Consultants & Hospitality Influencers",
      benefits: [
        "Generous commission for every activated restaurant account",
        "Zero setup cost or minimum commitment required",
        "Transparent tracking & timely payouts via Razorpay/Payouts",
        "Custom referral links and promotional kits provided",
      ],
    },
   
  ];

  return (
    <WebPageLayout
      onNavigate={onNavigate}
      title="Partner With Servon"
      subtitle="Join our ecosystem of distributors, restaurant consultants, and technology providers empowering modern Indian hospitality."
    >
      <View style={s.container}>
        {/* Value Prop Hero Card */}
        

        {/* 3 Partnership Tracks */}
        <View style={s.tracksGrid}>
          {partnerTracks.map((track, idx) => (
            <View key={idx} style={s.trackCard}>
              <View style={s.trackHeader}>
                <View style={s.trackIconBox}>
                  <Ionicons name={track.icon} size={22} color="#008060" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.trackTitle}>{track.title}</Text>
                  <Text style={s.trackSubtitle}>{track.subtitle}</Text>
                </View>
              </View>

              <View style={s.divider} />

              <View style={s.benefitList}>
                {track.benefits.map((benefit, bIdx) => (
                  <View key={bIdx} style={s.benefitRow}>
                    <Ionicons name="checkmark-circle" size={16} color="#008060" />
                    <Text style={s.benefitText}>{benefit}</Text>
                  </View>
                ))}
              </View>
            </View>
          ))}
        </View>

        {/* Direct Partner Inquiry Box */}
        <View style={s.partnerCTA}>
          <View style={{ flex: 1 }}>
            <Text style={s.ctaHeading}>Ready to become a Servon Partner?</Text>
            <Text style={s.ctaSubtext}>
              Send us your company profile, and preferred partnership track. Our partnerships team responds within 24 hours.
            </Text>
            <View style={s.emailBadge}>
              <Ionicons name="mail-open" size={14} color="#008060" />
              <Text style={s.emailBadgeText}>support@servon.cloud</Text>
            </View>
          </View>

          
        </View>
      </View>
    </WebPageLayout>
  );
}

const s = StyleSheet.create({
  container: {
    width: '100%',
    maxWidth: 1000,
    alignSelf: 'center',
    paddingVertical: 12,
  },
  heroCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    borderRadius: 20,
    padding: 28,
    marginBottom: 32,
    gap: 20,
    flexWrap: 'wrap',
  },
  heroIconWrap: {
    width: 60,
    height: 60,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 128, 96, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#008060',
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 6,
  },
  heroText: {
    fontSize: 14,
    lineHeight: 22,
    color: '#94A3B8',
    maxWidth: 720,
  },
  tracksGrid: {
    gap: 20,
  },
  trackCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 24,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 12,
    elevation: 2,
  },
  trackHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  trackIconBox: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#E6F4EA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  trackTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  trackSubtitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 16,
  },
  benefitList: {
    gap: 10,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  benefitText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
    flex: 1,
  },
  partnerCTA: {
    marginTop: 36,
    backgroundColor: '#F0FDF4',
    borderRadius: 20,
    padding: 28,
    borderWidth: 1.5,
    borderColor: '#DCFCE7',
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 20,
  },
  ctaHeading: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 4,
  },
  ctaSubtext: {
    fontSize: 13,
    color: '#475569',
    maxWidth: 580,
    lineHeight: 20,
    marginBottom: 12,
  },
  emailBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    gap: 6,
  },
  emailBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#008060',
  },
  applyBtn: {
    backgroundColor: '#008060',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
    cursor: isWeb ? 'pointer' : 'default',
  },
  applyBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
  },
});