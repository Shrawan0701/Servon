import React, { useState, useMemo } from 'react';
import {
  Text,
  StyleSheet,
  View,
  TouchableOpacity,
  TextInput,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { WebPageLayout } from './WebPageLayout';
import { Ionicons } from "@expo/vector-icons";

const isWeb = Platform.OS === "web";

export default function FAQPage({ onNavigate }) {
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  const [openIndex, setOpenIndex] = useState(null);
  const [activeCategory, setActiveCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");

  const categories = ["All", "General", "Features & Tech", "Pricing & Billing", "Operations"];

  const faqData = [
    {
      category: "General",
      q: "How long does setup take?",
      a: "Most restaurants can get started within minutes. Upload your menu, generate QR codes, and begin taking orders immediately without any complex onboarding."
    },
    {
      category: "Features & Tech",
      q: "What is Chef Mode™?",
      a: "Chef Mode™ is a privacy and security feature that hides sensitive business insights—like daily revenue, profit margins, and sales stats—from staff-facing screens with a single toggle."
    },
    {
      category: "General",
      q: "Does Servon require special hardware?",
      a: "No. Servon runs smoothly on your existing smartphones, tablets, laptops, and PCs. You don't need expensive proprietary POS terminals."
    },
    {
      category: "Operations",
      q: "Can customers order without downloading an app?",
      a: "Yes! Customers simply scan table QR codes using their standard smartphone camera and access your web-based menu instantly without installing anything."
    },
    {
      category: "Operations",
      q: "Does Servon work offline if the internet goes down?",
      a: "Yes. Servon includes a native Offline Mode that allows you to accept orders and print bills offline. All data automatically syncs to the cloud once connectivity restores."
    },
    {
      category: "Features & Tech",
      q: "Can I connect standard thermal receipt printers?",
      a: "Absolutely. Servon supports Bluetooth, USB, Wi-Fi, and LAN thermal receipt printers for instant Kitchen Order Tickets (KOT) and customer billing."
    },
    {
      category: "Pricing & Billing",
      q: "How can I see Servon before choosing a plan?",
      a: "Book a product demo with the Servon team to explore the features and discuss your restaurant's requirements."
    },
    {
      category: "Operations",
      q: "Can Servon manage multiple outlet locations under one account?",
      a: "Yes. You can toggle between multiple restaurant locations, sync central menu updates, and view aggregated enterprise reports from a single admin dashboard."
    },
    {
      category: "Features & Tech",
      q: "How does Voice AI assistance work?",
      a: "Voice AI allows floor staff or cashiers to add items, split bills, and apply discounts through simple spoken voice commands, drastically speeding up peak-hour ordering."
    },
    {
      category: "Pricing & Billing",
      q: "Are there any hidden transaction fees or commissions?",
      a: "Zero hidden fees. Servon charges a flat subscription fee based on your chosen plan. We take 0% commission on your table or QR orders."
    }
  ];

  const filteredFaqs = useMemo(() => {
    return faqData.filter((item) => {
      const matchesCategory = activeCategory === "All" || item.category === activeCategory;
      const matchesSearch = item.q.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            item.a.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [activeCategory, searchQuery]);

  const toggleFaq = (index) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <WebPageLayout
      onNavigate={onNavigate}
      title="Frequently Asked Questions"
      subtitle="Everything you need to know about Servon POS, ordering, and restaurant operations."
    >
      <View style={s.container}>

        {/* SEARCH BAR */}
        <View style={s.searchContainer}>
          <Ionicons name="search-outline" size={20} color="#6C7D63" style={s.searchIcon} />
          <TextInput
            style={s.searchInput}
            placeholder="Search questions (e.g. offline, printer, pricing)..."
            placeholderTextColor="#B7C5AC"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")}>
              <Ionicons name="close-circle" size={18} color="#B7C5AC" />
            </TouchableOpacity>
          )}
        </View>

        {/* CATEGORY TABS */}
        <View style={s.categoriesContainer}>
          {categories.map((cat) => {
            const isActive = activeCategory === cat;
            return (
              <TouchableOpacity
                key={cat}
                activeOpacity={0.8}
                style={[s.categoryChip, isActive && s.categoryChipActive]}
                onPress={() => {
                  setActiveCategory(cat);
                  setOpenIndex(null);
                }}
              >
                <Text style={[s.categoryText, isActive && s.categoryTextActive]}>
                  {cat}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* FAQ LIST */}
        <View style={s.faqList}>
          {filteredFaqs.length > 0 ? (
            filteredFaqs.map((item, i) => {
              const isOpen = openIndex === i;
              return (
                <View
                  key={i}
                  style={[s.card, isOpen && s.cardOpen]}
                >
                  <TouchableOpacity
                    activeOpacity={0.7}
                    style={s.cardHeader}
                    onPress={() => toggleFaq(i)}
                  >
                    <Text style={s.questionText}>{item.q}</Text>
                    <View style={[s.iconWrapper, isOpen && s.iconWrapperOpen]}>
                      <Ionicons
                        name={isOpen ? "chevron-up" : "chevron-down"}
                        size={18}
                        color={isOpen ? "#477047" : "#6C7D63"}
                      />
                    </View>
                  </TouchableOpacity>

                  {isOpen && (
                    <View style={s.answerWrapper}>
                      <Text style={s.answerText}>{item.a}</Text>
                    </View>
                  )}
                </View>
              );
            })
          ) : (
            <View style={s.emptyState}>
              <Ionicons name="help-circle-outline" size={48} color="#B7C5AC" />
              <Text style={s.emptyStateTitle}>No answers found</Text>
              <Text style={s.emptyStateSub}>Try searching with different keywords or switch categories.</Text>
            </View>
          )}
        </View>

        {/* SUPPORT CALLOUT */}
        <View style={[s.supportBanner, isMobile && s.supportBannerMobile]}>
          <View style={{ flex: 1 }}>
            <Text style={s.supportTitle}>Still have questions?</Text>
            <Text style={s.supportSub}>Can't find the answer you're looking for? Please chat with our friendly team.</Text>
          </View>
          <TouchableOpacity
            style={s.supportBtn}
            onPress={() => onNavigate?.("contact")}
            activeOpacity={0.85}
          >
            <Text style={s.supportBtnText}>Get in Touch</Text>
            <Ionicons name="arrow-forward" size={16} color="#FFFEF8" />
          </TouchableOpacity>
        </View>

      </View>
    </WebPageLayout>
  );
}

const s = StyleSheet.create({
  container: {
    width: "100%",
    maxWidth: 840,
    alignSelf: "center",
    paddingVertical: 10,
  },

  // SEARCH
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFEF8",
    borderWidth: 1,
    borderColor: "#DEE5D5",
    borderRadius: 14,
    paddingHorizontal: 16,
    height: 52,
    marginBottom: 20,
    shadowColor: "#193A2C",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 1,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: "#193A2C",
    ...(isWeb && { outlineStyle: "none" }),
  },

  // CATEGORIES
  categoriesContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 28,
  },
  categoryChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: "#EDF2E5",
    borderWidth: 1,
    borderColor: "#DEE5D5",
    cursor: isWeb ? "pointer" : "default",
  },
  categoryChipActive: {
    backgroundColor: "#477047",
    borderColor: "#477047",
  },
  categoryText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#52664D",
  },
  categoryTextActive: {
    color: "#FFFEF8",
  },

  // FAQ LIST
  faqList: {
    gap: 14,
  },
  card: {
    backgroundColor: "#FFFEF8",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#DEE5D5",
    paddingHorizontal: 22,
    paddingVertical: 18,
    shadowColor: "#193A2C",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 6,
    elevation: 1,
  },
  cardOpen: {
    borderColor: "#477047",
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    cursor: isWeb ? "pointer" : "default",
  },
  questionText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#193A2C",
    flex: 1,
    paddingRight: 16,
  },
  iconWrapper: {
    width: 32,
    height: 32,
    borderRadius: 12,
    backgroundColor: "#F0F3E8",
    alignItems: "center",
    justifyContent: "center",
  },
  iconWrapperOpen: {
    backgroundColor: "#EAF1DF",
  },
  answerWrapper: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: "#EDF2E5",
  },
  answerText: {
    fontSize: 14,
    color: "#52664D",
    lineHeight: 22,
  },

  // EMPTY STATE
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#193A2C",
    marginTop: 12,
  },
  emptyStateSub: {
    fontSize: 14,
    color: "#6C7D63",
    marginTop: 4,
  },

  // SUPPORT BANNER
  supportBanner: {
    marginTop: 48,
    backgroundColor: "#193A2C",
    borderRadius: 12,
    padding: 28,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 20,
  },
  supportBannerMobile: {
    flexDirection: "column",
    alignItems: "flex-start",
  },
  supportTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: "#FFFEF8",
    marginBottom: 4,
  },
  supportSub: {
    fontSize: 14,
    color: "#B7C5AC",
    lineHeight: 20,
  },
  supportBtn: {
    backgroundColor: "#477047",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    cursor: isWeb ? "pointer" : "default",
  },
  supportBtnText: {
    color: "#FFFEF8",
    fontWeight: "700",
    fontSize: 14,
  },
});
