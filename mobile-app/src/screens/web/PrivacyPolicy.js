import React from 'react';
import {
  Text,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { WebPageLayout } from './WebPageLayout';
import { Ionicons } from "@expo/vector-icons";

export default function PrivacyPolicy({ onNavigate }) {
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  const collectedDataItems = [
    {
      label: "Personal Account Data",
      detail: "Name, email, and phone number for authentication and business profile verification.",
    },
    {
      label: "Business Operations Data",
      detail: "Menu items, customized pricing, inventory levels, and staff access roles.",
    },
    {
      label: "Transactional Logs",
      detail: "Order timestamps, table QR scans, KOT records, and real-time payment status.",
    },
  ];

  return (
    <WebPageLayout 
      onNavigate={onNavigate}
      title="Privacy Policy" 
      subtitle="Your data sovereignty is our highest priority."
    >
      <View style={ts.container}>
        
        {/* SECTION 1 */}
        <View style={ts.section}>
          <View style={ts.headingGroup}>
            <View style={ts.accentLine} />
            <Text style={[ts.h, isMobile && ts.hMobile]}>1. Introduction to Data Privacy</Text>
          </View>
          <Text style={[ts.p, isMobile && ts.pMobile]}>
            Servon Technologies ("we", "us", or "our") is committed to protecting the privacy of restaurant owners and their customers. This policy outlines how we handle data within our POS and ERP ecosystem. We operate under a strict "Zero-Data-Monetization" policy, meaning your business insights are never sold or shared with external aggregators.
          </Text>
        </View>

        {/* SECTION 2 */}
        <View style={ts.section}>
          <View style={ts.headingGroup}>
            <View style={ts.accentLine} />
            <Text style={[ts.h, isMobile && ts.hMobile]}>2. Information Ownership</Text>
          </View>
          <Text style={[ts.p, isMobile && ts.pMobile]}>
            Unlike traditional delivery aggregators, Servon acts solely as a data processor. You, the restaurant owner, remain the sole Data Controller. Every phone number collected via QR scans, every transaction record, and every inventory log belongs exclusively to your legal entity.
          </Text>

          {/* ENCRYPTION HIGHLIGHT CARD */}
          <View style={[ts.card, isMobile && ts.cardMobile]}>
            <View style={ts.iconBadge}>
              <Ionicons name="lock-closed" size={20} color="#008060" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={ts.cardHeader}>DATA ENCRYPTION STANDARD</Text>
              <Text style={ts.cardText}>
                All financial records are encrypted using AES-256 at rest. Access via 'Chef Mode' is logged and audited to prevent unauthorized staff access to sensitive profit and loss data.
              </Text>
            </View>
          </View>
        </View>

        {/* SECTION 3 */}
        <View style={ts.section}>
          <View style={ts.headingGroup}>
            <View style={ts.accentLine} />
            <Text style={[ts.h, isMobile && ts.hMobile]}>3. Information We Collect</Text>
          </View>
          
          <View style={ts.dataList}>
            {collectedDataItems.map((item, idx) => (
              <View key={idx} style={ts.dataItem}>
                <View style={ts.checkBadge}>
                  <Ionicons name="checkmark-circle" size={18} color="#008060" />
                </View>
                <View style={ts.dataTextGroup}>
                  <Text style={ts.dataLabel}>{item.label}: </Text>
                  <Text style={ts.dataDetail}>{item.detail}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* SECTION 4 */}
        <View style={ts.section}>
          <View style={ts.headingGroup}>
            <View style={ts.accentLine} />
            <Text style={[ts.h, isMobile && ts.hMobile]}>4. Use of Information</Text>
          </View>
          <Text style={[ts.p, isMobile && ts.pMobile]}>
            We use your data strictly to facilitate restaurant operations: generating instant KOTs, calculating real-time net profit margins, and automating export-ready accounting reports. We do not use your customer records to market third-party services to your diners.
          </Text>
        </View>

        {/* SECTION 5 */}
        <View style={ts.section}>
          <View style={ts.headingGroup}>
            <View style={ts.accentLine} />
            <Text style={[ts.h, isMobile && ts.hMobile]}>5. Third-Party Services</Text>
          </View>
          <Text style={[ts.p, isMobile && ts.pMobile]}>
            Servon integrates directly with certified UPI providers and banking gateways. Payment transactions are processed directly by the respective banking infrastructure; Servon never stores raw credit card numbers or UPI PINs on its servers.
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

  section: {
    marginBottom: 36,
  },

  headingGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },

  accentLine: {
    width: 4,
    height: 22,
    backgroundColor: '#008060',
    borderRadius: 2,
    marginRight: 12,
  },

  h: { 
    fontSize: 22, 
    fontWeight: '800', 
    color: '#0F172A', 
    letterSpacing: -0.4,
  },
  hMobile: {
    fontSize: 19,
  },

  p: { 
    fontSize: 15, 
    color: '#475569', 
    lineHeight: 26,
  },
  pMobile: {
    fontSize: 14,
    lineHeight: 22,
  },

  // CARD STYLE
  card: { 
    backgroundColor: '#FFFFFF', 
    padding: 24, 
    borderRadius: 16, 
    borderWidth: 1, 
    borderColor: '#E2E8F0', 
    marginTop: 20,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  cardMobile: {
    padding: 18,
    flexDirection: 'column',
    gap: 12,
  },

  iconBadge: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#E6F4EA',
    alignItems: 'center',
    justifyContent: 'center',
  },

  cardHeader: {
    fontSize: 12,
    fontWeight: '800',
    color: '#008060',
    letterSpacing: 1.2,
    marginBottom: 6,
  },

  cardText: {
    fontSize: 14,
    color: '#334155',
    lineHeight: 22,
  },

  // DATA LIST STYLE
  dataList: {
    gap: 12,
    marginTop: 8,
  },

  dataItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },

  checkBadge: {
    marginTop: 2,
  },

  dataTextGroup: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },

  dataLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    lineHeight: 24,
  },

  dataDetail: {
    fontSize: 15,
    color: '#475569',
    lineHeight: 24,
  },
});