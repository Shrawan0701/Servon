import React from 'react';
import {
  Text,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { WebPageLayout } from './WebPageLayout';
import { Ionicons } from "@expo/vector-icons";

export default function AboutPage({ onNavigate }) {
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  const coreValues = [
    {
      title: "Privacy",
      desc: "We believe what you earn and how you operate is your business only. Data sovereignty is non-negotiable.",
      icon: "shield-checkmark",
    },
    {
      title: "Simplicity",
      desc: "Technology should seamlessly fade into the background of a high-speed, high-stress kitchen.",
      icon: "flash",
    },
    {
      title: "Affordability",
      desc: "Enterprise-grade infrastructure shouldn't be locked behind prohibitive pricing or massive chain budgets.",
      icon: "pricetag",
    },
  ];

  return (
    <WebPageLayout 
      onNavigate={onNavigate}
      title="The Servon Story" 
      subtitle="Empowering modern Indian hospitality through data sovereignty and complete operational ownership."
    >
      <View style={ts.container}>
        
        {/* STORY SECTION 1 */}
        <View style={ts.storySection}>
          <View style={ts.headingGroup}>
            <View style={ts.accentLine} />
            <Text style={[ts.h, isMobile && ts.hMobile]}>The Commission Crisis</Text>
          </View>
          <Text style={[ts.p, isMobile && ts.pMobile]}>
            By 2026, the Indian restaurant industry reached a critical breaking point. Third-party aggregators were consuming up to 30% of gross revenue, effectively taking control over customer relationships and squeezing margins to thin margins. Servon was built to stop this revenue bleed and hand ownership back to restaurant operators.
          </Text>
        </View>

        {/* STORY SECTION 2 */}
        <View style={ts.storySection}>
          <View style={ts.headingGroup}>
            <View style={ts.accentLine} />
            <Text style={[ts.h, isMobile && ts.hMobile]}>Our Digital Fortress</Text>
          </View>
          <Text style={[ts.p, isMobile && ts.pMobile]}>
            We don't just supply a basic point of sale. We engineer a 'Digital Fortress' where your customer data stays yours, sensitive financial reports remain locked via Chef Mode™, and kitchen operations move synchronously using enterprise-grade ERP tools.
          </Text>
        </View>

        {/* CORE VALUES GRID */}
        <View style={[ts.valuesCard, isMobile && ts.valuesCardMobile]}>
          <Text style={ts.valuesHeader}>OUR CORE VALUES</Text>
          <Text style={[ts.valuesTitle, isMobile && ts.valuesTitleMobile]}>
            Principles that drive our platform
          </Text>

          <View style={[ts.grid, isMobile && ts.gridMobile]}>
            {coreValues.map((value, idx) => (
              <View 
                key={idx} 
                style={[
                  ts.valueCard, 
                  isMobile ? ts.valueCardMobile : ts.valueCardDesktop
                ]}
              >
                <View style={ts.iconBadge}>
                  <Ionicons name={value.icon} size={20} color="#008060" />
                </View>
                <Text style={ts.valueCardTitle}>{value.title}</Text>
                <Text style={ts.valueCardDesc}>{value.desc}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* STORY SECTION 3 */}
        <View style={ts.storySection}>
          <View style={ts.headingGroup}>
            <View style={ts.accentLine} />
            <Text style={[ts.h, isMobile && ts.hMobile]}>Built for the Indian Kitchen</Text>
          </View>
          <Text style={[ts.p, isMobile && ts.pMobile]}>
            From bustling bistros in Bengaluru to sprawling dining halls in Delhi, Servon is purpose-built for the high-volume, dynamic environment of Indian food service. We deliver the split-second speed, zero-lag reliability, and financial transparency that modern operators demand.
          </Text>
        </View>

      </View>
    </WebPageLayout>
  );
}

const ts = StyleSheet.create({
  container: {
    width: '100%',
    maxWidth: 900,
    alignSelf: 'center',
  },

  storySection: {
    marginBottom: 40,
  },

  headingGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },

  accentLine: {
    width: 4,
    height: 24,
    backgroundColor: '#008060',
    borderRadius: 2,
    marginRight: 12,
  },

  h: { 
    fontSize: 26, 
    fontWeight: '800', 
    color: '#0F172A', 
    letterSpacing: -0.5,
  },
  hMobile: {
    fontSize: 21,
  },

  p: { 
    fontSize: 16, 
    color: '#475569', 
    lineHeight: 28,
  },
  pMobile: {
    fontSize: 15,
    lineHeight: 24,
  },

  // VALUES BOX
  valuesCard: { 
    backgroundColor: '#FFFFFF', 
    padding: 40, 
    borderRadius: 24, 
    borderWidth: 1, 
    borderColor: '#E2E8F0', 
    marginVertical: 20,
    marginBottom: 48,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  valuesCardMobile: {
    padding: 24,
    borderRadius: 16,
  },

  valuesHeader: {
    fontSize: 12,
    fontWeight: '800',
    color: '#008060',
    letterSpacing: 1.5,
    marginBottom: 8,
  },

  valuesTitle: { 
    fontSize: 24, 
    fontWeight: '800', 
    color: '#0F172A',
    marginBottom: 32,
    letterSpacing: -0.5,
  },
  valuesTitleMobile: {
    fontSize: 20,
    marginBottom: 24,
  },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 20,
  },
  gridMobile: {
    flexDirection: 'column',
    gap: 16,
  },

  valueCard: {
    backgroundColor: '#FAF9F6',
    padding: 24,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  valueCardDesktop: {
    flexBasis: '30%',
    flexGrow: 1,
  },
  valueCardMobile: {
    width: '100%',
  },

  iconBadge: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#E6F4EA',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },

  valueCardTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 8,
  },

  valueCardDesc: {
    fontSize: 14,
    color: '#64748B',
    lineHeight: 22,
  },
});