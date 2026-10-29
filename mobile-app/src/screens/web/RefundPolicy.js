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

export default function RefundPolicy({ onNavigate }) {
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  const lastUpdated = "August 2, 2026";

  const sections = [
    {
      title: "1. Overview",
      content:
        "This policy describes subscription billing, cancellations and refunds for Servon Labs Private Limited ('Servon', 'we', 'us', or 'our'). Please review the plan details and contact our team with any questions before initiating a paid subscription.",
    },
    {
      title: "2. Subscription Billing & Non-Refundable Nature",
      content:
        "Servon operates on a software-as-a-service (SaaS) subscription model (Monthly, Quarterly, or Yearly). Payments are processed securely via our payment gateway partner, Razorpay. Because access to digital software services is granted immediately upon payment confirmation, standard subscription charges are non-refundable once billed.",
    },
    {
      title: "3. No Auto-Debit & Subscription Expiry",
      content:
        "Servon does not practice automatic recurring auto-debits from your bank account or card. Every subscription period is prepaid manually by you. You may choose to stop or cancel your Servon subscription at any time directly by contacting our support team at admin@servon.cloud. Upon cancellation or non-renewal, your account will remain active and fully functional until the conclusion of your current prepaid billing cycle. You will not be billed automatically for subsequent billing cycles following your cancellation.",
    },
    {
      title: "4. Exceptional Refund Scenarios",
      content:
        "While standard fees are non-refundable, Servon Labs Private Limited may evaluate refund requests on a case-by-case basis under the following exceptional circumstances:\n\n• Double/Duplicate Charges: If a technical error occurs during Razorpay processing resulting in duplicate charges for a single billing cycle, the duplicate amount will be refunded in full.\n• Prolonged Service Outage: If Servon core cloud infrastructure experiences unscheduled platform downtime exceeding 72 consecutive hours during a billing month.\n• Unauthorized Transactions: Proven fraudulent payment usage verified by Razorpay or your financial institution.",
    },
    {
      title: "5. Processing & Refund Timelines",
      content:
        "Approved refund requests are processed within 5 to 7 business days from the date of approval. Refunds will be credited back exclusively to the original payment method (UPI, Bank Account, Credit/Debit Card) used during the initial Razorpay checkout transaction. Bank settlement times may vary depending on your issuing bank.",
    },
    {
      title: "6. Contact & Dispute Escalation",
      content:
        "For any billing inquiries, payment discrepancies, or refund requests, please email our finance team directly at admin@servon.cloud with your registered business name, transaction ID, and details of the issue. We endeavor to resolve all payment queries within 24–48 business hours.",
    },
  ];

  return (
    <WebPageLayout
      onNavigate={onNavigate}
      title="Cancellation & Refund Policy"
      subtitle="Clear and transparent information regarding your subscription billing, cancellations, and refunds with Servon Labs Private Limited."
    >
      <View style={s.container}>
        {/* Header Metadata */}


        {/* Content Sections */}
        <View style={s.contentBlock}>
          {sections.map((sec, idx) => (
            <View key={idx} style={s.sectionCard}>
              <Text accessibilityRole="heading" style={s.sectionTitle}>{sec.title}</Text>
              <Text style={s.sectionText}>{sec.content}</Text>
            </View>
          ))}
        </View>

        {/* Support Banner */}
        <View style={s.supportBox}>
          <View style={{ flex: 1 }}>
            <Text style={s.supportHeading}>Have billing or payment questions?</Text>
            <Text style={s.supportText}>
              Our billing support team at Servon Labs is here to help you resolve any issues promptly.
            </Text>
          </View>
          <TouchableOpacity
            style={s.contactBtn}
            onPress={() => onNavigate?.('Contact')}
            activeOpacity={0.85}
          >
            <Ionicons name="mail" size={16} color="#FFF" />
            <Text style={s.contactBtnText}>Email Support</Text>
          </TouchableOpacity>
        </View>
      </View>
    </WebPageLayout>
  );
}

const s = StyleSheet.create({
  container: {
    width: '100%',
    maxWidth: 900,
    alignSelf: 'center',
    paddingVertical: 12,
  },
  metaCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#DCFCE7',
    borderRadius: 14,
    padding: 16,
    marginBottom: 28,
    gap: 14,
  },
  metaIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  metaTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#193A2C',
  },
  metaSubtitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#477047',
    marginTop: 2,
  },
  contentBlock: {
    gap: 20,
  },
  sectionCard: {
    backgroundColor: '#FFFEF8',
    borderRadius: 12,
    padding: 24,
    borderWidth: 1,
    borderColor: '#DEE5D5',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#193A2C',
    marginBottom: 12,
  },
  sectionText: {
    fontSize: 14,
    lineHeight: 22,
    color: '#52664D',
    fontWeight: '500',
  },
  supportBox: {
    marginTop: 32,
    backgroundColor: '#193A2C',
    borderRadius: 12,
    padding: 24,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  supportHeading: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFEF8',
    marginBottom: 4,
  },
  supportText: {
    fontSize: 13,
    color: '#B7C5AC',
  },
  contactBtn: {
    backgroundColor: '#477047',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
    gap: 8,
    cursor: isWeb ? 'pointer' : 'default',
  },
  contactBtnText: {
    color: '#FFFEF8',
    fontWeight: '700',
    fontSize: 14,
  },
});
