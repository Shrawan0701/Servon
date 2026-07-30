import React from 'react';
import {
  Text,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { WebPageLayout } from './WebPageLayout';
import { Ionicons } from "@expo/vector-icons";

export default function TermsOfService({ onNavigate }) {
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  const restrictions = [
    "Attempting to reverse engineer or decompile the POS platform software.",
    "Utilizing the transaction pipeline or hardware integrations for unlawful money laundering.",
    "Bypassing or tampering with Chef Mode™ security protocols without explicit owner authorization.",
  ];

  return (
    <WebPageLayout 
      onNavigate={onNavigate}
      title="Terms of Service" 
      subtitle="Standard legal agreement and operational framework for the Servon platform."
    >
      <View style={ts.container}>
        
        {/* SECTION 1 */}
        <View style={ts.section}>
          <View style={ts.headingGroup}>
            <View style={ts.accentLine} />
            <Text style={[ts.h, isMobile && ts.hMobile]}>1. Acceptance of Terms</Text>
          </View>
          <Text style={[ts.p, isMobile && ts.pMobile]}>
            By accessing or using the Servon platform, you agree to be bound by these terms. If you are accepting on behalf of a restaurant entity or hospitality group, you represent that you possess full legal authority to bind that entity to this agreement.
          </Text>
        </View>

        {/* SECTION 2 */}
        <View style={ts.section}>
          <View style={ts.headingGroup}>
            <View style={ts.accentLine} />
            <Text style={[ts.h, isMobile && ts.hMobile]}>2. Subscription and Fees</Text>
          </View>
          <Text style={[ts.p, isMobile && ts.pMobile]}>
            Servon provides its software suite under a flat-rate subscription model starting at ₹999 per month. Fee adjustments are subject to a advance 30-day notice. We do not charge per-order commission fees. Your subscription covers continuous software updates, cloud syncing, and standard technical support access.
          </Text>

          {/* NO-COMMISSION HIGHLIGHT CARD */}
          <View style={[ts.promiseCard, isMobile && ts.promiseCardMobile]}>
            <View style={ts.iconBadge}>
              <Ionicons name="ribbon" size={20} color="#008060" />
            </View>
            <View style={ts.promiseTextGroup}>
              <Text style={ts.promiseTitle}>THE NO-COMMISSION PROMISE</Text>
              <Text style={ts.promiseDesc}>
                Servon will never charge commission percentages on your gross restaurant orders or dine-in sales. Our flat monthly model is permanent and fundamental to our mission.
              </Text>
            </View>
          </View>
        </View>

        {/* SECTION 3 */}
        <View style={ts.section}>
          <View style={ts.headingGroup}>
            <View style={ts.accentLine} />
            <Text style={[ts.h, isMobile && ts.hMobile]}>3. User Conduct & Restrictions</Text>
          </View>
          <Text style={[ts.p, isMobile && ts.pMobile, { marginBottom: 16 }]}>
            When utilizing our cloud services and kitchen management tools, users agree strictly not to engage in:
          </Text>

          <View style={ts.restrictionList}>
            {restrictions.map((text, idx) => (
              <View key={idx} style={ts.restrictionItem}>
                <View style={ts.bulletBadge}>
                  <Ionicons name="close-circle" size={18} color="#EF4444" />
                </View>
                <Text style={ts.restrictionText}>{text}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* SECTION 4 */}
        <View style={ts.section}>
          <View style={ts.headingGroup}>
            <View style={ts.accentLine} />
            <Text style={[ts.h, isMobile && ts.hMobile]}>4. Account Termination</Text>
          </View>
          <Text style={[ts.p, isMobile && ts.pMobile]}>
            You may request subscription termination at any time through your merchant console. Following account closure, we maintain a 7-day grace window allowing you to export complete historical menu, order, and tax records in CSV or PDF formats before data scrubbing.
          </Text>
        </View>

        {/* SECTION 5 */}
        <View style={ts.section}>
          <View style={ts.headingGroup}>
            <View style={ts.accentLine} />
            <Text style={[ts.h, isMobile && ts.hMobile]}>5. Limitation of Liability</Text>
          </View>
          <Text style={[ts.p, isMobile && ts.pMobile]}>
            Servon is not liable for revenue interruptions resulting from local hardware malfunctions or ISP network failures. While our platform supports offline queuing modes, final cloud sync and remote reporting require active connectivity.
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

  // PROMISE CARD
  promiseCard: {
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
  promiseCardMobile: {
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

  promiseTextGroup: {
    flex: 1,
  },

  promiseTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#008060',
    letterSpacing: 1.2,
    marginBottom: 6,
  },

  promiseDesc: {
    fontSize: 14,
    color: '#334155',
    lineHeight: 22,
    fontWeight: '500',
  },

  // RESTRICTION LIST
  restrictionList: {
    gap: 12,
  },

  restrictionItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },

  bulletBadge: {
    marginTop: 2,
  },

  restrictionText: {
    fontSize: 15,
    color: '#475569',
    lineHeight: 22,
    flex: 1,
  },
});