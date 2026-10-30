// src/screens/SupportScreen.js

import React, { useState, useMemo } from 'react';
import {
    View,
    Text as NativeText,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Linking,
    Platform,
    TextInput,
    useWindowDimensions,
} from "react-native";
import LocalizedText, { localizeText } from "../components/LocalizedText";
import { useLocale } from "../context/LocaleContext";
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

// ===== FAQ DATA =====
const FAQS = [
    // ===== SUBSCRIPTION & PAYMENT =====
    {
        id: 'sub1',
        category: 'Subscription & Payment',
        question: 'How does subscription and renewal work?',
        answer: 'Servon does NOT have auto-debit. All subscriptions are manual. When your plan expires, you will receive reminders to renew. You need to manually visit the Subscription section and complete the payment again. No automatic charges are made to your account.',
    },
    {
        id: 'sub2',
        category: 'Subscription & Payment',
        question: 'How does Razorpay payment work?',
        answer: "When you subscribe, we create a secure Razorpay order. You're redirected to Razorpay's secure payment page (Web) or the Razorpay SDK (Mobile). After successful payment, your subscription is activated instantly. All payments are secure and PCI-DSS compliant. No auto-debit, no card details are saved.",
    },
    {
        id: 'sub3',
        category: 'Subscription & Payment',
        question: 'What are the available plans and pricing?',
        answer: 'Servon offers 3 plans: Monthly ₹999, Quarterly ₹2,500 (Save 17%), and Yearly ₹8,999 (Save 25%). All plans give you full access to all features. No auto-debit, manual renewal only.',
    },

    // ===== APP FEATURES =====
    {
        id: 'feature1',
        category: 'App Features',
        question: 'How does AI Advisor work?',
        answer: "AI Advisor analyzes your restaurant's live data including daily sales, order patterns, customer reviews, and seasonal trends. It uses this data to generate personalized insights and recommendations to help you grow your business. The more data you have, the smarter the recommendations become!",
    },
    {
        id: 'feature2',
        category: 'App Features',
        question: 'How is the Daily AI Summary generated?',
        answer: "Every day at 3:00 AM, our system automatically collects your previous day's sales data, order history, and key metrics. It then generates a concise summary highlighting your top-performing items, revenue trends, and actionable insights to help you make better business decisions.",
    },
    {
        id: 'feature3',
        category: 'App Features',
        question: 'How does Offline Mode work?',
        answer: 'Servon automatically saves all your data locally on your device. When you\'re offline, you can still view orders, menu items, and tables. Once you\'re back online, all changes sync automatically with our servers. You\'ll see an "Offline" indicator when you\'re disconnected.',
    },
    {
        id: 'feature4',
        category: 'App Features',
        question: 'What are the main features of Servon?',
        answer: 'Servon offers: 1) Real-time order management, 2) Professional billing with GST invoicing, 3) Kitchen notification system, 4) Advanced revenue analytics, 5) Table management with QR codes, 6) AI Business Advisor, 7) Daily AI summaries, 8) Offline mode, 9) Referral program, and 10) Chef Mode for kitchen staff.',
    },

    // ===== MENU & ORDERS =====
    {
        id: 'menu1',
        category: 'Menu & Orders',
        question: 'How do I add a new menu item?',
        answer: 'Go to the Menu tab → Tap the "+" button → Fill in item details (name, price, category, image) → Tap "Save". Your item will appear in the menu immediately.',
    },
    {
        id: 'menu2',
        category: 'Menu & Orders',
        question: 'How do I view my orders?',
        answer: 'Go to the Orders tab. You will see all active orders. Use the filters to view orders by status (New, Confirmed, Preparing, Served, Paid).',
    },
    {
        id: 'menu3',
        category: 'Menu & Orders',
        question: 'How do I generate a bill?',
        answer: 'Go to Orders → Select the order → Tap "Print" → Review the bill with GST calculations → Tap "Print" again to generate the final bill. You can also apply discounts before printing.',
    },

    // ===== TABLES & QR =====
    {
        id: 'table1',
        category: 'Tables & QR',
        question: 'How do I create a table?',
        answer: 'Go to the Tables tab → Tap "Add Table" → Enter a table number → Tap "Save". A unique QR code will be generated for the table. Customers can scan it to view the menu and place orders directly.',
    },

    // ===== PROFILE & SECURITY =====
    {
        id: 'profile1',
        category: 'Profile & Security',
        question: 'How do I update my profile?',
        answer: 'Go to Profile → Tap the edit icon → Update your business name, address, GST details, or logo → Tap "Save Changes". Your updates will be reflected across the app.',
    },
    {
        id: 'profile2',
        category: 'Profile & Security',
        question: 'How do I set up Chef Mode?',
        answer: 'Go to Profile → Security → Toggle "Chef Mode" ON. This will hide revenue, analytics, and billing from the dashboard. Use your Admin PIN to unlock and return to normal mode.',
    },
    {
        id: 'profile3',
        category: 'Profile & Security',
        question: 'How do I set up Admin PIN?',
        answer: 'Go to Profile → Security → Enter a 4-digit PIN → Tap "Save". This PIN is required to unlock Chef Mode and secure sensitive business data.',
    },

    // ===== GST & BILLING =====
    {
        id: 'gst1',
        category: 'GST & Billing',
        question: 'How do I set up GST?',
        answer: 'Go to Profile → Billing & Taxes → Enter your GSTIN number and tax percentages (CGST/SGST). They will be applied automatically on all bills. Make sure to save changes after updating.',
    },

    // ===== DISCOUNTS =====
    {
        id: 'discount1',
        category: 'Discounts',
        question: 'How do I apply discounts to bills?',
        answer: 'Go to Orders → Select an active order → Tap "Print" → In the discount section, choose either Percentage Off or Flat ₹ Off → Enter the discount value → The system will automatically calculate the final amount with GST applied.',
    },

    // ===== REFERRAL =====
    {
        id: 'referral1',
        category: 'Referral Program',
        question: 'How does the Referral Program work?',
        answer: 'Go to Profile → Referral Program → Share your unique referral code with friends and fellow restaurateurs. When they sign up and subscribe, you earn rewards. Get 2 successful referrals and you\'ll receive 1 month of free subscription!',
    },
];

// ===== CATEGORY ORDER =====
const CATEGORIES = [
    'Subscription & Payment',
    'App Features',
    'Menu & Orders',
    'Tables & QR',
    'Profile & Security',
    'GST & Billing',
    'Discounts',
    'Referral Program',
];

// Visual-only: icon per category
const CATEGORY_ICONS = {
    'Subscription & Payment': 'card-outline',
    'App Features': 'sparkles-outline',
    'Menu & Orders': 'restaurant-outline',
    'Tables & QR': 'qr-code-outline',
    'Profile & Security': 'shield-checkmark-outline',
    'GST & Billing': 'receipt-outline',
    Discounts: 'pricetag-outline',
    'Referral Program': 'gift-outline',
};

export default function SupportScreen() {
    const { language } = useLocale();
    const navigation = useNavigation();
    const { width } = useWindowDimensions();
    const [expandedId, setExpandedId] = useState(null);
    const [search, setSearch] = useState('');
    const [activeCategory, setActiveCategory] = useState('All');

    const isSmallScreen = width < 600;

    const toggleFAQ = (id) => {
        setExpandedId(expandedId === id ? null : id);
    };

    const handleEmailSupport = () => {
        Linking.openURL('mailto:support@servon.cloud?subject=Support Request');
    };

    const query = search.trim().toLowerCase();
    const visibleFAQs = useMemo(() => {
        return FAQS.filter((f) => {
            const matchesCategory = activeCategory === 'All' || f.category === activeCategory;
            const matchesQuery =
                !query ||
                f.question.toLowerCase().includes(query) ||
                f.answer.toLowerCase().includes(query);
            return matchesCategory && matchesQuery;
        });
    }, [query, activeCategory]);

    const handleCategoryPress = (cat) => {
        setActiveCategory(cat);
    };

    return (
        <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
            {/* Header */}
            <View style={styles.header}>
                <View style={styles.headerInner}>
                    <TouchableOpacity
                        style={styles.backBtn}
                        onPress={() => navigation.goBack()}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                        <Ionicons name="chevron-back" size={22} color="#111827" />
                    </TouchableOpacity>
                    <LocalizedText translate style={styles.headerTitle}>Help & Support</LocalizedText>
                    <View style={{ width: 30 }} />
                </View>
            </View>

            <ScrollView
                contentContainerStyle={styles.scrollContentOuter}
                showsVerticalScrollIndicator={false}
                stickyHeaderIndices={[1]}
            >
                <View style={[styles.introBlock, !isSmallScreen && styles.introBlockWide]}>
                  <View style={styles.searchPanel}>
                    <LocalizedText translate style={styles.introTitle}>Search for anything</LocalizedText>
                    <LocalizedText translate style={styles.introSubtitle}>
                        Or browse a topic below to find your answer
                    </LocalizedText>

                    <View style={styles.searchBar}>
                        <Ionicons name="search" size={18} color="#9CA3AF" />
                        <TextInput
                            value={search}
                            onChangeText={setSearch}
                            placeholder={localizeText("Search questions, e.g. GST, discount, offline", language)}
                            placeholderTextColor="#9CA3AF"
                            style={styles.searchInput}
                        />
                        {search.length > 0 && (
                            <TouchableOpacity onPress={() => setSearch('')} hitSlop={8}>
                                <Ionicons name="close-circle" size={18} color="#9CA3AF" />
                            </TouchableOpacity>
                        )}
                    </View>
                  </View>
                  <View style={[styles.contactPanel, isSmallScreen && { width: "100%" }]}>
                    <LocalizedText style={styles.contactTitle}>Contact Support</LocalizedText>
                    <View style={styles.contactLinks}>
                      <TouchableOpacity style={styles.contactLink} onPress={handleEmailSupport} activeOpacity={0.8} accessibilityRole="link">
                        <View style={styles.contactIcon}><Ionicons name="mail-outline" size={20} color="#365E40" /></View>
                        <NativeText style={styles.contactValue}>support@servon.cloud</NativeText>
                        <Ionicons name="arrow-up-outline" size={15} color="#627166" style={{ transform: [{ rotate: '45deg' }] }} />
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.contactLink} onPress={() => Linking.openURL('tel:+919834386415')} activeOpacity={0.8} accessibilityRole="link">
                        <View style={styles.contactIcon}><Ionicons name="call-outline" size={20} color="#365E40" /></View>
                        <NativeText style={styles.contactValue}>9834386415</NativeText>
                        <Ionicons name="arrow-up-outline" size={15} color="#627166" style={{ transform: [{ rotate: '45deg' }] }} />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>

                {/* Sticky category pill bar */}
                <View style={styles.pillBarOuter}>
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.pillBar}
                    >
                        <TouchableOpacity
                            onPress={() => handleCategoryPress('All')}
                            style={[styles.pill, activeCategory === 'All' && styles.pillActive]}
                        >
                            <LocalizedText translate
                                style={[
                                    styles.pillText,
                                    activeCategory === 'All' && styles.pillTextActive,
                                ]}
                            >
                                All
                            </LocalizedText>
                        </TouchableOpacity>
                        {CATEGORIES.map((cat) => (
                            <TouchableOpacity
                                key={cat}
                                onPress={() => handleCategoryPress(cat)}
                                style={[styles.pill, activeCategory === cat && styles.pillActive]}
                            >
                                <Ionicons
                                    name={CATEGORY_ICONS[cat] || 'help-circle-outline'}
                                    size={14}
                                    color={activeCategory === cat ? '#fff' : '#4B5563'}
                                    style={{ marginRight: 6 }}
                                />
                                <LocalizedText
                                    style={[
                                        styles.pillText,
                                        activeCategory === cat && styles.pillTextActive,
                                    ]}
                                >
                                    {cat}
                                </LocalizedText>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>

                <View style={styles.scrollContent}>
                    {/* Results count */}
                    <LocalizedText style={styles.resultsLabel}>
                        {visibleFAQs.length} {visibleFAQs.length === 1 ? 'answer' : 'answers'}
                        {activeCategory !== 'All' ? ` in ${activeCategory}` : ''}
                    </LocalizedText>

                    {visibleFAQs.length === 0 ? (
                        <View style={styles.emptyState}>
                            <Ionicons name="search-outline" size={30} color="#D1D5DB" />
                            <LocalizedText translate style={styles.emptyTitle}>No matches found</LocalizedText>
                            <LocalizedText translate style={styles.emptySubtitle}>
                                Try a different keyword or contact support below.
                            </LocalizedText>
                        </View>
                    ) : (
                        <View style={styles.list}>
                            {visibleFAQs.map((faq, idx) => {
                                const isExpanded = expandedId === faq.id;
                                return (
                                    <TouchableOpacity
                                        key={faq.id}
                                        style={[
                                            styles.faqRow,
                                            idx === visibleFAQs.length - 1 && styles.faqRowLast,
                                        ]}
                                        onPress={() => toggleFAQ(faq.id)}
                                        accessibilityRole="button"
                                        accessibilityState={{ expanded: isExpanded }}
                                        activeOpacity={0.6}
                                    >
                                        <View style={styles.faqRowTop}>
                                            <View style={styles.faqIconDot}>
                                                <Ionicons
                                                    name={CATEGORY_ICONS[faq.category] || 'help-circle-outline'}
                                                    size={14}
                                                    color="#39805A"
                                                />
                                            </View>
                                            <LocalizedText style={styles.faqQuestion}>{faq.question}</LocalizedText>
                                            <Ionicons
                                                name={isExpanded ? 'remove' : 'add'}
                                                size={18}
                                                color={isExpanded ? '#39805A' : '#7B897F'}
                                            />
                                        </View>
                                        {isExpanded && (
                                            <LocalizedText style={styles.faqAnswer}>{faq.answer}</LocalizedText>
                                        )}
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    )}

                    <View style={{ height: 40 }} />
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F3F5F2' },
    header: { backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#DFE5DF', width: '100%' },
    headerInner: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingVertical: 12, width: '100%', maxWidth: 1200, alignSelf: 'center' },
    backBtn: { width: 40, height: 40, borderRadius: 8, backgroundColor: '#F0F4ED', alignItems: 'center', justifyContent: 'center', ...Platform.select({ web: { cursor: 'pointer' } }) },
    headerTitle: { flex: 1, fontSize: 19, fontWeight: '700', color: '#20332A', letterSpacing: -.3 },
    scrollContentOuter: { paddingBottom: 24, width: '100%', maxWidth: 1200, alignSelf: 'center' },
    introBlock: { width: '100%', paddingHorizontal: 20, paddingTop: 28, paddingBottom: 22, gap: 20 },
    introBlockWide: { flexDirection: 'row', alignItems: 'center', gap: 36 },
    searchPanel: { flexGrow: 1, flexShrink: 0, flexBasis: 'auto', minWidth: 0 },
    introTitle: { fontSize: 27, fontWeight: '700', color: '#20332A', marginBottom: 6, letterSpacing: -.6 },
    introSubtitle: { fontSize: 14, color: '#627166', marginBottom: 18, lineHeight: 21 },
    searchBar: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff', borderWidth: 1, borderColor: '#D5E0D1', borderRadius: 9, paddingHorizontal: 14, minHeight: 48, width: '100%' },
    searchInput: { flex: 1, minWidth: 0, fontSize: 14, paddingVertical: 13, color: '#20332A', ...Platform.select({ web: { outlineStyle: 'none' } }) },
    contactPanel: { width: 310, padding: 16, borderWidth: 1, borderColor: '#DFE5DF', borderRadius: 12, backgroundColor: '#fff', flexShrink: 0 },
    contactTitle: { fontSize: 14, fontWeight: '700', color: '#365E40', marginBottom: 10 },
    contactLinks: { gap: 8 },
    contactLink: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44, paddingVertical: 4, ...Platform.select({ web: { cursor: 'pointer' } }) },
    contactIcon: { width: 34, height: 34, borderRadius: 8, backgroundColor: '#EDF3E8', alignItems: 'center', justifyContent: 'center' },
    contactValue: { flex: 1, fontSize: 14, fontWeight: '600', color: '#283B30', flexShrink: 1 },
    pillBarOuter: { backgroundColor: '#F3F5F2', borderBottomWidth: 1, borderBottomColor: '#DDE4DC', paddingVertical: 12, width: '100%' },
    pillBar: { paddingHorizontal: 20, gap: 8, flexDirection: 'row' },
    pill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 13, paddingVertical: 11, minHeight: 44, borderRadius: 8, backgroundColor: '#fff', borderWidth: 1, borderColor: '#DFE5DF', ...Platform.select({ web: { cursor: 'pointer' } }) },
    pillActive: { backgroundColor: '#244F3B', borderColor: '#244F3B' },
    pillText: { fontSize: 13, fontWeight: '600', color: '#4A5E50' },
    pillTextActive: { color: '#fff' },
    scrollContent: { paddingHorizontal: 20, paddingTop: 20, width: '100%' },
    resultsLabel: { fontSize: 12, fontWeight: '600', color: '#627166', marginBottom: 14 },
    emptyState: { alignItems: 'center', paddingVertical: 48, gap: 10, borderWidth: 1, borderColor: '#DFE5DF', borderRadius: 12, backgroundColor: '#fff' },
    emptyTitle: { fontSize: 16, fontWeight: '600', color: '#344E3E' },
    emptySubtitle: { fontSize: 13, color: '#627166', textAlign: 'center', paddingHorizontal: 20, lineHeight: 20 },
    list: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#DFE5DF', overflow: 'hidden', marginBottom: 16, width: '100%' },
    faqRow: { paddingHorizontal: 18, paddingVertical: 17, borderBottomWidth: 1, borderBottomColor: '#E9EDE7', ...Platform.select({ web: { cursor: 'pointer' } }) },
    faqRowLast: { borderBottomWidth: 0 },
    faqRowTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    faqIconDot: { width: 32, height: 32, borderRadius: 8, backgroundColor: '#F0F4ED', alignItems: 'center', justifyContent: 'center' },
    faqQuestion: { flex: 1, minWidth: 0, fontSize: 15, fontWeight: '600', lineHeight: 22, color: '#283B30' },
    faqAnswer: { fontSize: 14, color: '#627166', lineHeight: 23, marginTop: 14, paddingLeft: 44, paddingRight: 8 },
});
