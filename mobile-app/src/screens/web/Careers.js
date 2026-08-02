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

export default function Careers({ onNavigate }) {
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  const culturePoints = [
    {
      icon: "rocket",
      title: "High Ownership, Fast Scale",
      description:
        "We are building modern core infrastructure for Indian dining. You will work on real-world, high-concurrency systems used daily in bustling kitchens.",
    },
    {
      icon: "code-working",
      title: "Product-Led Engineering",
      description:
        "We value clean code, offline-first reliability, AI automation, and seamless UX over corporate bureaucracy. Good ideas win regardless of title.",
    },
    {
      icon: "heart-circle",
      title: "Merchant-First Mindset",
      description:
        "Every feature we ship directly protects restaurant margins, speeds up KOTs, or simplifies owner operations across India.",
    },
  ];

  return (
    <WebPageLayout
      onNavigate={onNavigate}
      title="Careers at Servon Labs"
      subtitle="Help us build the next generation of software infrastructure for Indian hospitality."
    >
      <View style={s.container}>
        {/* Culture Intro Card */}
        <View style={s.introCard}>
          <View style={s.introIconWrap}>
            <Ionicons name="briefcase" size={30} color="#008060" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.introTitle}>Building the Future of Restaurant Tech</Text>
            <Text style={s.introText}>
              At Servon Labs Private Limited, we are mission-driven problem solvers based in Pune, Maharashtra. We empower restaurant owners, cloud kitchens, and cafes with intelligent, offline-capable POS and AI management suites.
            </Text>
          </View>
        </View>

        {/* Culture Grid */}
        <Text style={s.sectionHeader}>Why Work With Us?</Text>
        <View style={s.cultureGrid}>
          {culturePoints.map((item, idx) => (
            <View key={idx} style={s.cultureCard}>
              <View style={s.cardIconBox}>
                <Ionicons name={item.icon} size={20} color="#008060" />
              </View>
              <Text style={s.cardTitle}>{item.title}</Text>
              <Text style={s.cardDesc}>{item.description}</Text>
            </View>
          ))}
        </View>

        {/* General Application / Open Inquiries Card */}
        <View style={s.noJobBox}>
          <View style={s.noJobHeader}>
            <View style={s.badgeWrap}>
              <Ionicons name="mail-open" size={16} color="#008060" />
              <Text style={s.badgeText}>Direct Talent Pipeline</Text>
            </View>
            <Text style={s.noJobTitle}>Don't see an open role for your skill set?</Text>
          </View>

          <Text style={s.noJobText}>
            We are always on the lookout for exceptionally talented full-stack engineers (React Native, Node.js), sales leaders, and UI/UX designers who are passionate about hospitality technology.
          </Text>

          <View style={s.contactCard}>
            <View style={{ flex: 1 }}>
              <Text style={s.contactCardTitle}>Send your resume directly to our team</Text>
              <Text style={s.contactCardSub}>
                Include your resume, GitHub/portfolio link, and a brief note on what you'd love to build at Servon.
              </Text>
              <View style={s.emailPill}>
                <Ionicons name="copy-outline" size={14} color="#008060" />
                <Text style={s.emailPillText}>admin@servon.cloud</Text>
              </View>
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
    maxWidth: 950,
    alignSelf: 'center',
    paddingVertical: 12,
  },
  introCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    borderRadius: 20,
    padding: 28,
    marginBottom: 36,
    gap: 20,
    flexWrap: 'wrap',
  },
  introIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 128, 96, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#008060',
  },
  introTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 6,
  },
  introText: {
    fontSize: 14,
    lineHeight: 22,
    color: '#94A3B8',
    maxWidth: 700,
  },
  sectionHeader: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 16,
  },
  cultureGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 18,
    marginBottom: 36,
  },
  cultureCard: {
    flexGrow: 1,
    flexBasis: 260,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 22,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cardIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#E6F4EA',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 6,
  },
  cardDesc: {
    fontSize: 13,
    lineHeight: 20,
    color: '#475569',
  },
  noJobBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 20,
    padding: 28,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  noJobHeader: {
    marginBottom: 10,
  },
  badgeWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
    gap: 6,
    marginBottom: 8,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#008060',
  },
  noJobTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  noJobText: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 22,
    marginBottom: 20,
  },
  contactCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  contactCardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 4,
  },
  contactCardSub: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 10,
    maxWidth: 520,
  },
  emailPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    gap: 6,
  },
  emailPillText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#008060',
  },
  emailBtn: {
    backgroundColor: '#008060',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 11,
    borderRadius: 10,
    gap: 8,
    cursor: isWeb ? 'pointer' : 'default',
  },
  emailBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
  },
});