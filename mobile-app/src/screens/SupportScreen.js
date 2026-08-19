// src/screens/SupportScreen.js

import React, { useState, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Linking,
    Platform,
    TextInput,
    useWindowDimensions,
} from 'react-native';
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
        answer: 'Servon offers 3 plans: Monthly ₹999, Quarterly ₹2,500 (Save 15%), and Yearly ₹6,000 (Save 51%). All plans give you full access to all features. No auto-debit, manual renewal only.',
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
                    <Text style={styles.headerTitle}>Help & Support</Text>
                    <View style={{ width: 30 }} />
                </View>
            </View>

            <ScrollView
                contentContainerStyle={styles.scrollContentOuter}
                showsVerticalScrollIndicator={false}
                stickyHeaderIndices={[1]}
            >
                <View style={styles.introBlock}>
                    <Text style={styles.introTitle}>Search for anything</Text>
                    <Text style={styles.introSubtitle}>
                        Or browse a topic below to find your answer
                    </Text>

                    <View style={styles.searchBar}>
                        <Ionicons name="search" size={18} color="#9CA3AF" />
                        <TextInput
                            value={search}
                            onChangeText={setSearch}
                            placeholder="Search questions, e.g. GST, discount, offline"
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
                            <Text
                                style={[
                                    styles.pillText,
                                    activeCategory === 'All' && styles.pillTextActive,
                                ]}
                            >
                                All
                            </Text>
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
                                <Text
                                    style={[
                                        styles.pillText,
                                        activeCategory === cat && styles.pillTextActive,
                                    ]}
                                >
                                    {cat}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>

                <View style={styles.scrollContent}>
                    {/* Results count */}
                    <Text style={styles.resultsLabel}>
                        {visibleFAQs.length} {visibleFAQs.length === 1 ? 'answer' : 'answers'}
                        {activeCategory !== 'All' ? ` in ${activeCategory}` : ''}
                    </Text>

                    {visibleFAQs.length === 0 ? (
                        <View style={styles.emptyState}>
                            <Ionicons name="search-outline" size={30} color="#D1D5DB" />
                            <Text style={styles.emptyTitle}>No matches found</Text>
                            <Text style={styles.emptySubtitle}>
                                Try a different keyword or contact support below.
                            </Text>
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
                                        activeOpacity={0.6}
                                    >
                                        <View style={styles.faqRowTop}>
                                            <View style={styles.faqIconDot}>
                                                <Ionicons
                                                    name={CATEGORY_ICONS[faq.category] || 'help-circle-outline'}
                                                    size={14}
                                                    color="#10B981"
                                                />
                                            </View>
                                            <Text style={styles.faqQuestion}>{faq.question}</Text>
                                            <Ionicons
                                                name={isExpanded ? 'remove' : 'add'}
                                                size={18}
                                                color={isExpanded ? '#10B981' : '#9CA3AF'}
                                            />
                                        </View>
                                        {isExpanded && (
                                            <Text style={styles.faqAnswer}>{faq.answer}</Text>
                                        )}
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    )}

                    {/* Responsive Contact Section */}
                    <View style={[styles.contactSection, isSmallScreen && styles.contactSectionMobile]}>
                        <View style={[styles.contactLeft, isSmallScreen && styles.contactLeftMobile]}>
                            <Text style={styles.contactTitle}>Still stuck?</Text>
                            <Text style={styles.contactSubtitle}>
                                Our support team usually replies within a few hours.
                            </Text>
                        </View>
                        <TouchableOpacity
                            style={[styles.contactBtn, isSmallScreen && styles.contactBtnMobile]}
                            onPress={handleEmailSupport}
                            activeOpacity={0.85}
                        >
                            <Ionicons name="mail-outline" size={16} color="#111827" />
                            <Text style={styles.contactBtnText}>Email us at support@servon.cloud</Text>
                        </TouchableOpacity>
                    </View>

                    <View style={{ height: 40 }} />
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FAFAF8',
    },
    header: {
        backgroundColor: '#FAFAF8',
        borderBottomWidth: 1,
        borderBottomColor: '#EEEBE4',
        width: '100%',
    },
    headerInner: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 14,
        width: '100%',
    },
    backBtn: {
        width: 30,
        alignItems: 'flex-start',
        justifyContent: 'center',
        ...Platform.select({ web: { cursor: 'pointer' } }),
    },
    headerTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#111827',
    },
    scrollContentOuter: {
        paddingBottom: 20,
    },
    introBlock: {
        width: '100%',
        paddingHorizontal: 20,
        paddingTop: 24,
        paddingBottom: 16,
    },
    introTitle: {
        fontSize: 24,
        fontWeight: '800',
        color: '#111827',
        marginBottom: 4,
        letterSpacing: -0.3,
    },
    introSubtitle: {
        fontSize: 14,
        color: '#6B7280',
        marginBottom: 16,
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#E5E1D8',
        borderRadius: 14,
        paddingHorizontal: 14,
        paddingVertical: Platform.select({ web: 12, default: 10 }),
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.03,
        shadowRadius: 4,
        elevation: 1,
        width: '100%',
    },
    searchInput: {
        flex: 1,
        fontSize: 14,
        color: '#111827',
        ...Platform.select({ web: { outlineStyle: 'none' } }),
    },
    pillBarOuter: {
        backgroundColor: '#FAFAF8',
        borderBottomWidth: 1,
        borderBottomColor: '#EEEBE4',
        paddingVertical: 10,
        width: '100%',
    },
    pillBar: {
        paddingHorizontal: 20,
        gap: 8,
        flexDirection: 'row',
    },
    pill: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#E5E1D8',
        ...Platform.select({ web: { cursor: 'pointer' } }),
    },
    pillActive: {
        backgroundColor: '#111827',
        borderColor: '#111827',
    },
    pillText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#4B5563',
    },
    pillTextActive: {
        color: '#fff',
    },
    scrollContent: {
        paddingHorizontal: 20,
        paddingTop: 18,
        width: '100%',
    },
    resultsLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: '#9CA3AF',
        textTransform: 'uppercase',
        letterSpacing: 0.6,
        marginBottom: 12,
    },
    emptyState: {
        alignItems: 'center',
        paddingVertical: 48,
        gap: 8,
    },
    emptyTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: '#374151',
    },
    emptySubtitle: {
        fontSize: 13,
        color: '#9CA3AF',
        textAlign: 'center',
    },
    list: {
        backgroundColor: '#fff',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#EEEBE4',
        overflow: 'hidden',
        marginBottom: 20,
        width: '100%',
    },
    faqRow: {
        paddingHorizontal: 16,
        paddingVertical: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#F2F0EA',
        ...Platform.select({ web: { cursor: 'pointer' } }),
    },
    faqRowLast: {
        borderBottomWidth: 0,
    },
    faqRowTop: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    faqIconDot: {
        width: 28,
        height: 28,
        borderRadius: 8,
        backgroundColor: '#ECFDF5',
        alignItems: 'center',
        justifyContent: 'center',
    },
    faqQuestion: {
        flex: 1,
        fontSize: 14.5,
        fontWeight: '600',
        color: '#1F2937',
        lineHeight: 20,
    },
    faqAnswer: {
        fontSize: 13.5,
        color: '#6B7280',
        lineHeight: 21,
        marginTop: 10,
        marginLeft: 40,
    },
    // Desktop layout defaults
    contactSection: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#F4F2EC',
        borderRadius: 16,
        padding: 20,
        gap: 16,
        width: '100%',
    },
    contactSectionMobile: {
        flexDirection: 'column',
        alignItems: 'stretch',
        gap: 14,
        padding: 16,
    },
    contactLeft: {
        flex: 1,
    },
    contactLeftMobile: {
        width: '100%',
    },
    contactTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 2,
    },
    contactSubtitle: {
        fontSize: 12.5,
        color: '#6B7280',
        lineHeight: 18,
    },
    contactBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: '#fff',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E5E1D8',
        ...Platform.select({ web: { cursor: 'pointer' } }),
    },
    contactBtnMobile: {
        width: '100%',
    },
    contactBtnText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#111827',
    },
});