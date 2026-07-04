import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  useWindowDimensions,
  Animated,
  ScrollView,
  Platform,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
// You need to go up 3 levels to reach the root assets folder: 
// web -> screens -> src -> root/assets
import servonLogo from '../../../assets/servon-logo.png';



const C = {
  bg:         "#FAF9F6",
  surface:    "#FFFFFF",
  charcoal:   "#121417",
  green:      "#008060",
  greenLight: "#E6F3EF",
  border:     "#EBE9E0",
  muted:      "#636E72",
  accent:     "#D4AF37",
  error:      "#E63946",
};

const REVIEWS = [
  {
    quote:
      "Servon completely cleaned up our restaurant operations. Orders flow smoothly from tables to kitchen, and my staff finally stopped running around in chaos during peak hours.",
    name: "Arjun Mehta",
    initials: "AM"
  },
  {
    quote:
      "The QR ordering experience feels premium and super fast. Customers love how simple it is, and our staff can focus more on service instead of taking manual orders.",
    name: "Priya Sharma",
    initials: "PS"
  },
  {
    quote:
      "Chef Mode™ Privacy is honestly brilliant. Managers get the control they need while kitchen staff stay focused only on operations. It keeps everything professional and organized.",
    name: "Vikram Rao",
    initials: "VR"
  },
  {
    quote:
      "Analytics and expense tracking gave us clarity we never had before. We can actually see what's working, what's wasting money, and make decisions much faster.",
    name: "Kabir Desai",
    initials: "KD"
  }
];

const BUSINESS_TYPES = ["Hotel", "Restaurant", "Resort", "Cafe", "Other"];

const Field = ({ label, required, value, onChangeText, error, styles, ...inputProps }) => (
  <View style={styles.formGroup}>
    <Text style={styles.formLabel}>
      {label}{required ? <Text style={styles.requiredStar}> *</Text> : null}
    </Text>
    <TextInput
      style={[styles.formInput, error && { borderColor: '#EF4444', borderWidth: 2 }]}
      placeholderTextColor="#94A3B8"
      value={value}
      onChangeText={onChangeText}
      {...inputProps}
    />
    {error ? <Text style={{ color: '#EF4444', fontSize: 12, marginTop: 4 }}>{error}</Text> : null}
  </View>
);

const SectionTag = ({ text, color = C.green, styles }) => (
  <View style={styles.tagWrap}>
    <View style={[styles.tagDot, { backgroundColor: color }]} />
    <Text style={[styles.tagText, { color }]}>{text.toUpperCase()}</Text>
  </View>
);

const PremiumDashboard = () => {
  const { width } = useWindowDimensions();
  const dm = getDashboardStyles(width);

  return (
  <View style={dm.wrapper}>
    <View style={dm.browserChrome}>
      <View style={dm.windowControls}>
        <View style={[dm.wDot, { backgroundColor: "#FF5F56" }]} />
        <View style={[dm.wDot, { backgroundColor: "#FFBD2E" }]} />
        <View style={[dm.wDot, { backgroundColor: "#27C93F" }]} />
      </View>
      <View style={dm.urlBar}>
        <Ionicons name="shield-checkmark" size={12} color={C.green} />
        <Text style={dm.urlText}>servon.cloud/dashboard/analytics-live</Text>
      </View>
    </View>

    <View style={dm.mainLayout}>
      <View style={dm.sideNav}>
        <View style={dm.sideLogo} />
        {['grid', 'receipt', 'fast-food', 'people', 'settings'].map((icon, idx) => (
          <View key={idx} style={[dm.sideIcon, idx === 0 && dm.sideIconActive]}>
            <Ionicons name={icon} size={18} color={idx === 0 ? C.green : "#CBD5E0"} />
          </View>
        ))}
      </View>

      <View style={dm.contentPane}>
        <View style={dm.headerRow}>
          <Text style={dm.paneTitle}>Live Overview</Text>
          <View style={dm.datePicker}>
            <Text style={dm.dateText}>Mar 25, 2026</Text>
            <Ionicons name="calendar-outline" size={12} color={C.muted} />
          </View>
        </View>

        <View style={dm.kpiGrid}>
          <View style={dm.kpiCard}>
            <Text style={dm.kpiLab}>Revenue</Text>
            <Text style={dm.kpiVal}>₹1,84,200</Text>
            <Text style={[dm.deltaText, {color: C.green}]}>+12.4% ↑</Text>
          </View>
          <View style={dm.kpiCard}>
            <Text style={dm.kpiLab}>Orders</Text>
            <Text style={dm.kpiVal}>142</Text>
            <Text style={[dm.deltaText, {color: C.accent}]}>Active</Text>
          </View>
        </View>

        <View style={dm.bottomSection}>
          <Text style={dm.panelTitle}>Kitchen Stream</Text>
          {[
            { t: "T-04", i: "Butter Chicken", s: "PREP", c: C.accent },
            { t: "T-12", i: "Dal Makhani", s: "READY", c: C.green },
            { t: "T-09", i: "Veg Biryani", s: "NEW", c: "#3182CE" }
          ].map((o, idx) => (
            <View key={idx} style={dm.orderRow}>
              <Text style={dm.tableText}>{o.t}</Text>
              <Text style={dm.itemText}>{o.i}</Text>
              <View style={[dm.statusBadge, {borderColor: o.c}]}>
                <Text style={[dm.statusText, {color: o.c}]}>{o.s}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>
    </View>
  </View>
  );
};

// ─── MAIN APP ─────────────────────────────────────────────────────────

export default function LandingPage({ onNavigate }) {
  // Live viewport width — re-renders this component whenever the window/
  // device size actually changes, unlike the old Dimensions.get() snapshot.
  const { width } = useWindowDimensions();
  const isWide = width > 600;
  const s = getMainStyles(width);

  const scrollY = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const autoScrollRef = useRef(null);
  const [activeStep, setActiveStep] = useState(0);
  const [activeFaq, setActiveFaq] = useState(null);

  // ─── DEMO MODAL STATE ───────────────────────────────────────────────
  const [demoModalVisible, setDemoModalVisible] = useState(false);
  const [showFloatingDemo, setShowFloatingDemo] = useState(false);

  // ─── FORM STATE ──────────────────────────────────────────────────────
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    businessName: '',
    businessType: '',
    message: '',
  });
  const [formErrors, setFormErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState(false);
  // ─────────────────────────────────────────────────────────────────────

  // ─── API URL ──────────────────────────────────────────────────────────
  const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

  // TEMP: backend route /api/demo-request doesn't exist yet.
  // Flip this to false once it's built, to re-enable the real fetch call below.
  const USE_MOCK_SUBMIT = true;

  // ─── VALIDATION ──────────────────────────────────────────────────────
  const validateForm = () => {
    const errors = {};
    let isValid = true;

    if (!formData.name.trim() || formData.name.trim().length < 2) {
      errors.name = 'Full name is required (min 2 characters)';
      isValid = false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!formData.email.trim()) {
      errors.email = 'Email is required';
      isValid = false;
    } else if (!emailRegex.test(formData.email.trim())) {
      errors.email = 'Please enter a valid email address';
      isValid = false;
    }

    if (!formData.businessName.trim() || formData.businessName.trim().length < 2) {
      errors.businessName = 'Business name is required (min 2 characters)';
      isValid = false;
    }

    if (!formData.businessType) {
      errors.businessType = 'Please select a business type';
      isValid = false;
    }

    setFormErrors(errors);
    return isValid;
  };

  // ─── SUBMIT HANDLER ──────────────────────────────────────────────────
  const handleSubmit = async () => {
    // Validate
    if (!validateForm()) return;

    setIsSubmitting(true);
    setSubmitError('');
    setSubmitSuccess(false);

    // TEMP MOCK PATH — remove this whole `if` block once the backend
    // route exists, and set USE_MOCK_SUBMIT to false above.
    if (USE_MOCK_SUBMIT) {
      setTimeout(() => {
        setIsSubmitting(false);
        setSubmitSuccess(true);
        setFormData({
          name: '',
          email: '',
          phone: '',
          businessName: '',
          businessType: '',
          message: '',
        });
        setFormErrors({});
        setTimeout(() => {
          setSubmitSuccess(false);
          setDemoModalVisible(false);
        }, 3000);
      }, 800);
      return;
    }

    try {
      const payload = {
        name: formData.name.trim(),
        email: formData.email.trim().toLowerCase(),
        phone: formData.phone.trim() || undefined,
        business_name: formData.businessName.trim(),
        business_type: formData.businessType.toLowerCase(),
        message: formData.message.trim() || undefined,
      };

      const response = await fetch(`${API_URL}/api/demo-request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (response.ok) {
        setSubmitSuccess(true);
        // Reset form
        setFormData({
          name: '',
          email: '',
          phone: '',
          businessName: '',
          businessType: '',
          message: '',
        });
        setFormErrors({});
        // Close modal after success
        setTimeout(() => {
          setSubmitSuccess(false);
          setDemoModalVisible(false);
        }, 3000);
      } else {
        setSubmitError(data.message || 'Something went wrong. Please try again.');
      }
    } catch (error) {
      console.error('Submit error:', error);
      setSubmitError('Network error. Please check your connection and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Web-only head tags (GA + SEO + Favicon) ──────────────────────────
  useEffect(() => {
    if (Platform.OS === 'web') {
      // Page title
      document.title = "Servon | Track Your Business";

      // ── Google Analytics (gtag.js) ──────────────────────────────────
      const gtagScript = document.createElement('script');
      gtagScript.async = true;
      gtagScript.src = 'https://www.googletagmanager.com/gtag/js?id=G-2D5DS8141R';
      document.head.appendChild(gtagScript);

      const inlineScript = document.createElement('script');
      inlineScript.innerHTML = `
        window.dataLayer = window.dataLayer || [];
        function gtag(){dataLayer.push(arguments);}
        gtag('js', new Date());
        gtag('config', 'G-2D5DS8141R');
      `;
      document.head.appendChild(inlineScript);
      // ───────────────────────────────────────────────────────────────

      // ── SEO Meta Tags ───────────────────────────────────────────────
      const metaDesc = document.createElement('meta');
      metaDesc.name = 'description';
      metaDesc.content =
        'Servon is the premium POS and restaurant management system for Indian restaurants. ' +
        'QR ordering, kitchen sync, Chef Mode privacy, expense tracking, and GST billing — all in one platform.';
      document.head.appendChild(metaDesc);

      const metaKeywords = document.createElement('meta');
      metaKeywords.name = 'keywords';
      metaKeywords.content =
        'restaurant POS India, QR menu ordering, restaurant billing software, kitchen order system, ' +
        'KOT software, GST billing restaurant, restaurant management app, Chef Mode, ' +
        'expense tracking restaurant, UPI payments restaurant, Servon';
      document.head.appendChild(metaKeywords);

      const metaOGTitle = document.createElement('meta');
      metaOGTitle.setAttribute('property', 'og:title');
      metaOGTitle.content = 'Servon | The Restaurant OS for India';
      document.head.appendChild(metaOGTitle);

      const metaOGDesc = document.createElement('meta');
      metaOGDesc.setAttribute('property', 'og:description');
      metaOGDesc.content =
        'QR ordering, live kitchen sync, Chef Mode privacy, and expense ERP — ' +
        'the all-in-one operating system built for high-growth Indian restaurants.';
      document.head.appendChild(metaOGDesc);

      const metaOGType = document.createElement('meta');
      metaOGType.setAttribute('property', 'og:type');
      metaOGType.content = 'website';
      document.head.appendChild(metaOGType);

      const metaRobots = document.createElement('meta');
      metaRobots.name = 'robots';
      metaRobots.content = 'index, follow';
      document.head.appendChild(metaRobots);
      // ───────────────────────────────────────────────────────────────

     // Favicon
    const favicon = document.createElement('link');
    favicon.rel = 'icon';
    favicon.type = 'image/png';
    favicon.href = servonLogo;
    document.head.appendChild(favicon);

    // Apple touch icon
    const appleIcon = document.createElement('link');
    appleIcon.rel = 'apple-touch-icon';
    appleIcon.href = servonLogo;
    document.head.appendChild(appleIcon);
    }
  }, []);
  // ─────────────────────────────────────────────────────────────────────

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 1000, useNativeDriver: true }).start();

    const interval = setInterval(() => {
      setActiveStep((prev) => {
        const next = (prev + 1) % REVIEWS.length;
        autoScrollRef.current?.scrollTo({ x: next * width, animated: true });
        return next;
      });
    }, 3500);

    return () => clearInterval(interval);
  }, []);

  const handleScroll = (event) => {
    const slideSize = event.nativeEvent.layoutMeasurement.width;
    const index = event.nativeEvent.contentOffset.x / slideSize;
    const roundIndex = Math.round(index);
    if (activeStep !== roundIndex) {
      setActiveStep(roundIndex);
    }
  };

  const navOpacity = scrollY.interpolate({
    inputRange: [0, 100],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });

  return (
    <View style={s.container}>
      {/* NAVBAR */}
      <View style={s.nav}>
        <Animated.View style={[s.navBg, { opacity: navOpacity }]} />
        <View style={s.navInner}>
          <Text style={s.logo}>Servon<Text style={{ color: C.green }}>.</Text></Text>
          <View style={s.navRight}>
            <TouchableOpacity onPress={() => onNavigate?.("login")}>
              <Text style={s.navLoginText}>Sign In</Text>
            </TouchableOpacity>

            {/* ─── DEMO BUTTON (NAV) ─── */}
            <TouchableOpacity
              style={s.demoBtnNav}
              activeOpacity={0.7}
              onPress={() => setDemoModalVisible(true)}
            >
              <Ionicons name="calendar-outline" size={14} color={C.charcoal} />
              <Text style={s.demoBtnNavText}>Book Demo</Text>
            </TouchableOpacity>

            <TouchableOpacity style={s.navCta} onPress={() => onNavigate?.("signup")}>
              <Text style={s.navCtaText}>Get Started </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <ScrollView
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { 
            useNativeDriver: false,
            listener: (event) => {
              setShowFloatingDemo(event.nativeEvent.contentOffset.y > 400);
            }
          }
        )}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
      >
        {/* ── HERO ── */}
        <View style={s.hero}>
          <View style={s.heroGlowTop} />
          <View style={s.heroGlowBottom} />

          <Animated.View style={{ opacity: fadeAnim, alignItems: 'center', width: '100%', zIndex: 2 }}>
            <View style={s.cursonBadge}>
              <View style={s.cursonBadgeDot} />
              <Text style={s.cursonBadgeText}>Live across India</Text>
            </View>

            <Text style={s.heroH1}>
              Command Your{"\n"}
              <Text style={{ color: C.green }}>Revenue.</Text> Own{"\n"}
              Your Data.
            </Text>

            <Text style={s.heroSub}>
              The premium operating system for high-growth Indian restaurants.
              Deploy QR ordering, manage live kitchen sync, and protect your margins.
            </Text>

            <View style={[s.heroBtnGroup, { flexDirection: "row", gap: 14, flexWrap: "wrap", justifyContent: "center" }]}>
              <TouchableOpacity
                style={s.heroPrimaryBtn}
                onPress={() => onNavigate("signup")}
              >
                <Text style={s.heroPrimaryText}>Start Now</Text>
                <Ionicons name="arrow-forward" size={18} color="#FFF" />
              </TouchableOpacity>

              {/* ─── DEMO BUTTON (HERO) ─── */}
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => setDemoModalVisible(true)}
              >
                <LinearGradient
                  colors={['#1E2226', '#121417']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={s.demoBtnHero}
                >
                  <Ionicons name="calendar-outline" size={18} color="#FFFFFF" />
                  <Text style={s.demoBtnHeroText}>Book a Demo</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>

            <Text style={s.heroFoot}>Trusted by 100+ outlets across the country.</Text>

            <PremiumDashboard />
          </Animated.View>
        </View>

        {/* ── CORE CAPABILITIES ── */}
        <View style={s.darkSection}>
          <View style={s.darkSectionGlow} />

          <View style={s.darkSectionHeader}>
            <View style={s.darkBadge}>
              <Text style={s.darkBadgeText}>THE ECOSYSTEM</Text>
            </View>
            <Text style={s.darkSectionH2}>
              Everything you need to{"\n"}
              <Text style={{ color: '#94A3B8' }}>eliminate restaurant chaos.</Text>
            </Text>
          </View>

          <View style={s.featureGrid}>
            {[
              { i: "qr-code-outline",    t: "Smart QR Ordering",    d: "Frictionless ordering via browser. No app installs, no wait times for guests.",            c: "#E6F3EF" },
              { i: "shield-half-outline", t: "Chef Mode™ Privacy",   d: "Hide financial data from staff with a single master toggle instantly.",                    c: "#F3E8FF" },
              { i: "receipt-outline",    t: "Seamless Billing",      d: "GST invoicing with integrated digital feedback and reviews.",                               c: "#EBF8FF" },
              { i: "bar-chart-outline",  t: "Granular Analytics",    d: "Real-time insights into best sellers, peak hours, and server performance.",                c: "#FFF4E6" },
              { i: "calculator-outline", t: "Expense ERP",           d: "Log procurement and payroll to see your true net profit daily.",                           c: "#FEE2E2" },
              { i: "flash-outline",      t: "Kitchen Sync",          d: "Zero-lag cloud-based KOT routing to keep your chefs in harmony.",                         c: "#F0FDF4" },
            ].map((f, i) => (
              <View key={i} style={s.darkFeatCard}>
                <View style={[s.featIcon, { backgroundColor: f.c }]}>
                  <Ionicons name={f.i} size={24} color={C.charcoal} />
                </View>
                <Text style={s.darkFeatTitle}>{f.t}</Text>
                <Text style={s.darkFeatDesc}>{f.d}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* ── REVIEWS ── */}
        <View style={s.reviewSection}>
          <View style={s.sectionHeader}>
            <SectionTag text="Success Stories" styles={s} />
            <Text style={s.sectionH2}>What Our Users Say</Text>
          </View>

          <ScrollView
            ref={autoScrollRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={handleScroll}
            scrollEventThrottle={16}
            style={{ width: width }}
          >
            {REVIEWS.map((rev, i) => (
              <View key={i} style={s.slideContainer}>
                <View style={s.reviewCard}>
                  <View style={s.starRow}>
                    {[1,2,3,4,5].map(st => (
                      <Ionicons key={st} name="star" size={width > 600 ? 20 : 16} color="#FFB84D" />
                    ))}
                  </View>

                  <View style={s.quoteWrapper}>
                    <Ionicons name="quote" size={24} color="#E2E8F0" style={s.quoteIcon} />
                    <Text style={s.reviewQuote}>{rev.quote}</Text>
                  </View>

                  <View style={s.reviewerDivider} />

                  <Text style={s.reviewerName}>{rev.name}</Text>
                  <Text style={s.reviewerHotel}>{rev.hotel}</Text>
                </View>
              </View>
            ))}
          </ScrollView>

          <View style={s.dotRow}>
            {REVIEWS.map((_, i) => (
              <View key={i} style={[s.dot, activeStep === i && s.dotActive]} />
            ))}
          </View>
        </View>

        {/* ── PRICING ── */}
        <View style={s.priceSection}>
          <View style={s.priceHeaderCenter}>
            <View style={s.pricePill}>
              <Text style={s.pricePillText}>PRICING</Text>
            </View>
            <Text style={s.priceTitleMain}>Simple, transparent{"\n"}pricing</Text>
            <Text style={s.priceSubMain}>
              No hidden fees. Upgrade when{"\n"}you're ready.
            </Text>
          </View>

          <View style={s.proCard}>
            <View style={s.proCardHeader}>
              <View>
                <Text style={s.proCardTag}>RESTAURANT PREMIUM</Text>
                <View style={s.proPriceRow}>
                  <Text style={s.proTitle}>Pro</Text>
                  <Text style={s.proFeaturesLabel}> / Features</Text>
                </View>
              </View>
              <View style={s.bluePopularBadge}>
                <Text style={s.bluePopularText}>POPULAR</Text>
              </View>
            </View>

            <View style={s.proFeatureList}>
              {[
                "Unlimited QR Menu Scans & Orders",
                "Full Chef Mode™ Financial Privacy",
                "Live Kitchen Dashboard (KOT Sync)",
                "Inventory & Expense ERP Suite",
                "Export PDF & CSV Reports",
                "24/7 Priority Support"
              ].map((item, idx) => (
                <View key={idx} style={s.proItem}>
                  <View style={s.blueCheck}>
                    <Ionicons name="checkmark-circle" size={20} color="#4F46E5" />
                  </View>
                  <Text style={s.proItemText}>{item}</Text>
                </View>
              ))}
            </View>

            <TouchableOpacity style={s.proBtn} onPress={() => onNavigate?.("signup")}>
              <Text style={s.proBtnText}>Get Started</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── FAQ ── */}
        <View style={s.faqSection}>
          <View style={s.faqHeaderRow}>
            <View style={s.faqHeaderLeft}>
              <View style={s.faqBadge}>
                <Text style={s.faqBadgeText}>FAQ</Text>
              </View>
              <Text style={s.faqMainTitle}>Common questions</Text>
            </View>
            <Text style={s.faqSubTitle}>Everything you need to know about Servon.</Text>
          </View>

          <View style={s.faqList}>
            {[
              {
                q: "How long does setup take?",
                a: "Most restaurants can get started within minutes. Upload your menu, generate QR codes, and begin taking orders without complicated onboarding."
              },
              {
                q: "What is Chef Mode™?",
                a: "Chef Mode™ is a privacy feature that hides sensitive business insights like revenue and expense data from staff-facing screens with a single toggle."
              },
              {
                q: "Does Servon require special hardware?",
                a: "No. Servon works smoothly on your existing phones, tablets, laptops, and desktop systems without needing expensive hardware."
              },
              {
                q: "Can customers order without downloading an app?",
                a: "Yes. Customers simply scan the QR code and access the digital menu directly from their browser for a fast and seamless ordering experience."
              }
            ].map((f, i) => (
              <TouchableOpacity
                key={i}
                activeOpacity={0.9}
                style={[s.faqItem, activeFaq === i && s.faqItemActive]}
                onPress={() => setActiveFaq(activeFaq === i ? null : i)}
              >
                <View style={s.faqQuestionRow}>
                  <Text style={s.faqQ}>{f.q}</Text>
                  <Ionicons
                    name={activeFaq === i ? "chevron-up" : "chevron-down"}
                    size={20}
                    color={activeFaq === i ? C.charcoal : C.muted}
                  />
                </View>

                {activeFaq === i && (
                  <View style={s.faqAnswerContent}>
                    <View style={s.faqAnswerDivider} />
                    <Text style={s.faqA}>{f.a}</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ── FOOTER ── */}
        <View style={s.footer}>
          <View style={s.footerTop}>
            <View style={s.fBrand}>
              <Text style={s.fLogo}>Servon<Text style={{ color: C.green }}>.</Text></Text>
              <Text style={s.fTag}>
                The infrastructure for the next generation of Indian hospitality. Built for ownership.
              </Text>
            </View>

            <View style={s.fLinksGrid}>
              <View style={s.fCol}>
                <Text style={s.fH}>PRODUCT</Text>
                {[
                  { name: "Features", slug: "Features" },
                  { name: "Pricing", slug: "Pricing" },
                  { name: "FAQ", slug: "FAQ" }
                ].map(l => (
                  <TouchableOpacity key={l.slug} onPress={() => onNavigate(l.slug)}>
                    <Text style={s.fL}>{l.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={s.fCol}>
                <Text style={s.fH}>COMPANY</Text>
                {[
                  { name: "About", slug: "About" },
                  { name: "Contact Us", slug: "Contact" }
                ].map(l => (
                  <TouchableOpacity key={l.slug} onPress={() => onNavigate(l.slug)}>
                    <Text style={s.fL}>{l.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={s.fCol}>
                <Text style={s.fH}>LEGAL</Text>
                {[
                  { name: "Privacy", slug: "PrivacyPolicy" },
                  { name: "Terms", slug: "TermsOfService" }
                ].map(l => (
                  <TouchableOpacity key={l.slug} onPress={() => onNavigate(l.slug)}>
                    <Text style={s.fL}>{l.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>

          <View style={s.fDivider} />

          <View style={s.footerBottom}>
            <Text style={s.copy}>© 2026 Servon. All rights reserved.</Text>
          </View>
        </View>

      </ScrollView>

      {/* ─── FLOATING DEMO BUTTON ─── */}
      {showFloatingDemo && (
        <TouchableOpacity
          activeOpacity={0.85}
          style={s.floatingBtnWrap}
          onPress={() => setDemoModalVisible(true)}
        >
          <LinearGradient
            colors={['#1E2226', '#121417']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={s.floatingBtn}
          >
            <Ionicons name="calendar-outline" size={16} color="#FFFFFF" />
            <Text style={s.floatingBtnText}>Book Demo</Text>
          </LinearGradient>
        </TouchableOpacity>
      )}

      {/* ─── DEMO MODAL ─── */}
      {demoModalVisible && (
        <View style={s.modalOverlay}>
          <TouchableOpacity 
            style={s.modalBackdrop} 
            activeOpacity={1} 
            onPress={() => {
              setDemoModalVisible(false);
              setSubmitError('');
              setSubmitSuccess(false);
            }}
          />
          <View style={s.modalCard}>
            <View style={s.modalHeaderRow}>
              <View style={s.modalHeaderText}>
                <Text style={s.modalTitle}>Book a Demo</Text>
              </View>
              <TouchableOpacity
                style={s.modalCloseBtn}
                onPress={() => {
                  setDemoModalVisible(false);
                  setSubmitError('');
                  setSubmitSuccess(false);
                }}
              >
                <Ionicons name="close" size={20} color="#1E293B" />
              </TouchableOpacity>
            </View>

            <Text style={s.modalSubtitle}>
              See Servon in action. Tell us a bit about your business and we'll set up a walkthrough.
            </Text>

            <ScrollView
              style={s.modalScroll}
              showsVerticalScrollIndicator={false}
            >
              {/* Name */}
              <Field
                label="Full Name"
                required
                placeholder="Your full name"
                value={formData.name}
                onChangeText={(text) => setFormData(prev => ({ ...prev, name: text }))}
                error={formErrors.name}
                styles={s}
              />

              {/* Email */}
              <Field
                label="Email Address"
                required
                placeholder="you@example.com"
                keyboardType="email-address"
                autoCapitalize="none"
                value={formData.email}
                onChangeText={(text) => setFormData(prev => ({ ...prev, email: text }))}
                error={formErrors.email}
                styles={s}
              />

              {/* Phone */}
              <Field
                label="Phone Number"
                placeholder="Optional"
                keyboardType="phone-pad"
                value={formData.phone}
                onChangeText={(text) => setFormData(prev => ({ ...prev, phone: text }))}
                styles={s}
              />

              {/* Business Name */}
              <Field
                label="Business / Hotel Name"
                required
                placeholder="e.g. Taj Residency"
                value={formData.businessName}
                onChangeText={(text) => setFormData(prev => ({ ...prev, businessName: text }))}
                error={formErrors.businessName}
                styles={s}
              />

              {/* Business Type */}
              <View style={s.formGroup}>
                <Text style={s.formLabel}>
                  Business Type<Text style={s.requiredStar}> *</Text>
                </Text>
                <View style={s.pillRow}>
                  {BUSINESS_TYPES.map((type) => (
                    <TouchableOpacity
                      key={type}
                      style={[
                        s.pill,
                        formData.businessType === type && s.pillActive,
                        formErrors.businessType && { borderColor: '#EF4444' }
                      ]}
                      onPress={() => {
                        setFormData(prev => ({ ...prev, businessType: type }));
                        setFormErrors(prev => ({ ...prev, businessType: '' }));
                      }}
                      activeOpacity={0.8}
                    >
                      <Text style={[s.pillText, formData.businessType === type && s.pillTextActive]}>
                        {type}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {formErrors.businessType ? (
                  <Text style={{ color: '#EF4444', fontSize: 12, marginTop: 4 }}>{formErrors.businessType}</Text>
                ) : null}
              </View>

              {/* Message */}
              <View style={s.formGroup}>
                <Text style={s.formLabel}>Message</Text>
                <TextInput
                  style={[s.formInput, s.formTextArea]}
                  placeholder="Tell us a bit more about what you need (optional)"
                  placeholderTextColor="#94A3B8"
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                  value={formData.message}
                  onChangeText={(text) => setFormData(prev => ({ ...prev, message: text }))}
                />
              </View>
            </ScrollView>

            {/* Submit Button */}
            <TouchableOpacity
              style={[s.modalSubmitBtn, isSubmitting && { opacity: 0.6 }]}
              onPress={handleSubmit}
              disabled={isSubmitting}
              activeOpacity={0.85}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#FFF" size="small" />
              ) : (
                <>
                  <Text style={s.modalSubmitBtnText}>Send Request</Text>
                  <Ionicons name="send" size={16} color="#FFF" />
                </>
              )}
            </TouchableOpacity>

            {/* Error Message */}
            {submitError ? (
              <Text style={{ color: '#EF4444', textAlign: 'center', marginTop: 12, fontSize: 14 }}>
                {submitError}
              </Text>
            ) : null}

            {/* Success Message */}
            {submitSuccess ? (
              <Text style={{ color: '#008060', textAlign: 'center', marginTop: 12, fontSize: 14, fontWeight: '600' }}>
                ✅ Demo request sent successfully! We'll contact you soon.
              </Text>
            ) : null}

            <Text style={s.modalFinePrint}>
              By submitting, you agree to be contacted by the Servon team about this request.
            </Text>
          </View>
        </View>
      )}

    </View>
  );
}

// ─── DASHBOARD STYLES ─────────────────────────────────────────────────

const getDashboardStyles = (width) => StyleSheet.create({
  wrapper: {
    width: '100%',
    maxWidth: 940,
    alignSelf: 'center',
    marginTop: 60,
    backgroundColor: '#FFF',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: C.border,
    overflow: 'hidden',
    shadowOpacity: 0.1,
    shadowRadius: 30,
    elevation: 10,
  },
  browserChrome: {
    height: 44,
    backgroundColor: '#F8FAFC',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#EDF2F7',
  },
  windowControls: { flexDirection: 'row', gap: 8 },
  wDot: { width: 10, height: 10, borderRadius: 5 },
  urlBar: {
    flex: 1,
    height: 26,
    backgroundColor: '#FFF',
    borderRadius: 6,
    marginHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
    borderWidth: 1,
    borderColor: '#EEE',
  },
  urlText: { fontSize: 10, color: C.muted },
  mainLayout: { height: width > 600 ? 440 : 320, flexDirection: 'row' },
  sideNav: {
    width: width > 600 ? 64 : 44,
    backgroundColor: '#F8FAFC',
    borderRightWidth: 1,
    borderRightColor: '#EDF2F7',
    alignItems: 'center',
    paddingTop: 16,
    gap: 16,
  },
  sideLogo: {
    width: width > 600 ? 32 : 24,
    height: width > 600 ? 32 : 24,
    backgroundColor: C.green,
    borderRadius: 8,
  },
  sideIcon: {
    width: width > 600 ? 36 : 28,
    height: width > 600 ? 36 : 28,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sideIconActive: { backgroundColor: C.greenLight },
  contentPane: { flex: 1, padding: width > 600 ? 25 : 14 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  paneTitle: { fontSize: width > 600 ? 20 : 15, fontWeight: '900', color: C.charcoal },
  datePicker: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    padding: 6,
    borderRadius: 8,
  },
  dateText: { fontSize: 9, fontWeight: '700' },
  kpiGrid: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  kpiCard: {
    flex: 1,
    padding: width > 600 ? 18 : 12,
    borderRadius: 16,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#EEE',
  },
  kpiLab: { fontSize: 10, color: C.muted, fontWeight: '700' },
  kpiVal: { fontSize: width > 600 ? 22 : 16, fontWeight: '900', color: C.charcoal, marginVertical: 4 },
  deltaText: { fontSize: 10, fontWeight: '800' },
  bottomSection: {
    flex: 1,
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: width > 600 ? 18 : 12,
    borderWidth: 1,
    borderColor: '#EEE',
  },
  panelTitle: { fontSize: width > 600 ? 13 : 11, fontWeight: '800', marginBottom: 12 },
  orderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  tableText: { width: 36, fontWeight: '900', fontSize: width > 600 ? 12 : 10 },
  itemText: { flex: 1, fontSize: width > 600 ? 12 : 10, color: C.muted, fontWeight: '600' },
  statusBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, borderWidth: 1 },
  statusText: { fontSize: 9, fontWeight: '900' },
});

// ─── MAIN STYLES ──────────────────────────────────────────────────────

const getMainStyles = (width) => StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },

  // ── NAV ──
  nav: { position: 'absolute', top: 0, left: 0, right: 0, height: 70, zIndex: 1000 },
  navBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(250, 249, 246, 0.98)',
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  navInner: {
    maxWidth: 1200,
    alignSelf: 'center',
    width: '100%',
    height: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: width > 600 ? 30 : 16,
  },
  logo: { fontSize: width > 600 ? 24 : 20, fontWeight: '900', color: C.charcoal, letterSpacing: -1 },
  navRight: { flexDirection: 'row', alignItems: 'center', gap: width > 600 ? 24 : 10 },
  navLoginText: { fontSize: width > 600 ? 15 : 13, fontWeight: '700', color: C.charcoal },
  navCta: {
    backgroundColor: C.charcoal,
    paddingHorizontal: width > 600 ? 20 : 14,
    paddingVertical: width > 600 ? 10 : 8,
    borderRadius: 10,
  },
  navCtaText: { color: '#FFF', fontWeight: '800', fontSize: width > 600 ? 13 : 11 },

  // ── DEMO BUTTONS ──
  demoBtnNav: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: width > 600 ? 16 : 10,
    paddingVertical: width > 600 ? 9 : 7,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: C.charcoal,
    backgroundColor: 'transparent',
  },
  demoBtnNavText: {
    color: C.charcoal,
    fontWeight: '700',
    fontSize: width > 600 ? 13 : 11,
  },
  demoBtnHero: {
    paddingHorizontal: width > 600 ? 32 : 22,
    paddingVertical: width > 600 ? 18 : 14,
    borderRadius: 100,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  demoBtnHeroText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: width > 600 ? 16 : 14,
  },
  floatingBtnWrap: {
    position: 'absolute',
    bottom: width > 600 ? 32 : 20,
    right: width > 600 ? 32 : 16,
    borderRadius: 100,
    zIndex: 999,
  },
  floatingBtn: {
    borderRadius: 100,
    paddingHorizontal: width > 600 ? 22 : 16,
    paddingVertical: width > 600 ? 16 : 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  floatingBtnText: {
    color: '#FFF',
    fontWeight: '800',
    fontSize: width > 600 ? 14 : 12,
  },

  // ── MODAL ──
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15,23,42,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2000,
    padding: 16,
  },
  modalBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  modalCard: {
    width: '100%',
    maxWidth: 560,
    maxHeight: '90%',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    display: 'flex',
    flexDirection: 'column',
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 40,
    elevation: 12,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  modalHeaderText: {
    flex: 1,
  },
  modalCloseBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  modalTitle: {
    fontSize: 26,
    fontWeight: '900',
    color: C.charcoal,
    letterSpacing: -0.5,
  },
  modalSubtitle: {
    fontSize: 15,
    color: C.muted,
    marginTop: 10,
    marginBottom: 24,
    lineHeight: 22,
  },
  modalScroll: {
    flexGrow: 1,
    flexShrink: 1,
    marginBottom: 16,
  },
  formGroup: {
    marginBottom: 20,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: C.charcoal,
    marginBottom: 8,
  },
  requiredStar: {
    color: '#EF4444',
  },
  formInput: {
    width: '100%',
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: C.charcoal,
    backgroundColor: '#FCFCFA',
  },
  formTextArea: {
    height: 100,
    paddingTop: 14,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  pill: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: C.border,
    backgroundColor: '#FFFFFF',
  },
  pillActive: {
    backgroundColor: C.charcoal,
    borderColor: C.charcoal,
  },
  pillText: {
    fontSize: 14,
    fontWeight: '600',
    color: C.charcoal,
  },
  pillTextActive: {
    color: '#FFFFFF',
  },
  modalSubmitBtn: {
    backgroundColor: C.charcoal,
    borderRadius: 12,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 4,
    flexShrink: 0,
  },
  modalSubmitBtnText: {
    color: '#FFF',
    fontWeight: '800',
    fontSize: 16,
  },
  modalFinePrint: {
    fontSize: 11,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 16,
    flexShrink: 0,
  },

  // ── HERO ──
  hero: {
    paddingTop: width > 600 ? 160 : 120,
    paddingBottom: width > 600 ? 100 : 60,
    alignItems: 'center',
    paddingHorizontal: width > 600 ? 30 : 20,
    backgroundColor: '#FAF9F6',
    overflow: 'hidden',
    position: 'relative',
  },
  heroGlowTop: {
    position: 'absolute',
    top: -100,
    left: -100,
    width: 500,
    height: 500,
    borderRadius: 250,
    backgroundColor: '#E6F3EF',
    opacity: 0.6,
  },
  heroGlowBottom: {
    position: 'absolute',
    bottom: 200,
    right: -100,
    width: 600,
    height: 600,
    borderRadius: 300,
    backgroundColor: '#F3E8FF',
    opacity: 0.4,
  },
  cursonBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 28,
    shadowColor: "#000",
    shadowOpacity: 0.03,
    shadowRadius: 10,
  },
  cursonBadgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#4F46E5',
    marginRight: 10,
  },
  cursonBadgeText: { fontSize: 13, fontWeight: '600', color: '#64748B' },
  heroH1: {
    fontSize: width > 800 ? 60 : width > 400 ? 38 : 30,
    fontWeight: '900',
    color: '#121417',
    textAlign: 'center',
    lineHeight: width > 800 ? 68 : width > 400 ? 46 : 38,
    letterSpacing: -2,
    marginBottom: 24,
  },
  heroSub: {
    fontSize: width > 600 ? 16 : 14,
    color: '#636E72',
    textAlign: 'center',
    maxWidth: 600,
    lineHeight: width > 600 ? 25 : 22,
    marginBottom: 32,
    paddingHorizontal: 4,
  },
  heroBtnGroup: { marginBottom: 20 },
  heroPrimaryBtn: {
    backgroundColor: '#121417',
    paddingHorizontal: width > 600 ? 40 : 30,
    paddingVertical: width > 600 ? 20 : 16,
    borderRadius: 100,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 5,
  },
  heroPrimaryText: { color: '#FFF', fontWeight: '800', fontSize: width > 600 ? 18 : 16 },
  heroFoot: {
    fontSize: 13,
    color: C.muted,
    fontWeight: '500',
    marginTop: 8,
    marginBottom: 0,
  },

  // ── DARK FEATURES SECTION ──
  darkSection: {
    paddingVertical: width > 600 ? 100 : 60,
    paddingHorizontal: width > 600 ? 30 : 16,
    backgroundColor: '#1A1C1E',
    width: '100%',
    position: 'relative',
    overflow: 'hidden',
  },
  darkSectionGlow: {
    position: 'absolute',
    top: '20%',
    right: '-10%',
    width: 600,
    height: 600,
    borderRadius: 300,
    backgroundColor: '#2D3135',
    opacity: 0.5,
  },
  darkSectionHeader: {
    alignItems: 'center',
    marginBottom: width > 600 ? 70 : 40,
    zIndex: 2,
  },
  darkBadge: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    marginBottom: 20,
  },
  darkBadgeText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#94A3B8',
    letterSpacing: 2,
  },
  darkSectionH2: {
    fontSize: width > 600 ? 34 : 24,
    fontWeight: '900',
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: width > 600 ? 42 : 32,
    letterSpacing: -1,
  },
  featureGrid: {
    flexDirection: width > 768 ? 'row' : 'column',
    flexWrap: width > 768 ? 'wrap' : 'nowrap',
    gap: 16,
    maxWidth: 1200,
    alignSelf: 'center',
    width: '100%',
    zIndex: 2,
  },
  darkFeatCard: {
    width: width > 900 ? "31.5%" : width > 768 ? "48%" : "100%",
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 24,
    padding: width > 600 ? 36 : 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  featIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  darkFeatTitle: {
    fontSize: width > 600 ? 20 : 17,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 12,
    flexShrink: 1,
  },
  darkFeatDesc: {
    fontSize: width > 600 ? 15 : 14,
    color: '#94A3B8',
    lineHeight: 22,
    flexShrink: 1,
  },

  // ── REVIEWS ──
  reviewSection: {
    paddingVertical: width > 600 ? 100 : 60,
    backgroundColor: "#FAF9F6",
    alignItems: 'center',
  },
  sectionHeader: { marginBottom: 40, alignItems: 'center' },
  sectionH2: {
    fontSize: width > 600 ? 28 : 20,
    fontWeight: '900',
    color: C.charcoal,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  slideContainer: {
    width: width,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  reviewCard: {
    width: width > 800 ? 700 : width - 32,
    backgroundColor: "#FFF",
    borderRadius: width > 600 ? 28 : 20,
    padding: width > 600 ? 50 : 28,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: "#F1F5F9",
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 20,
    elevation: 4,
  },
  starRow: { flexDirection: 'row', gap: 4, marginBottom: 20 },
  quoteWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginVertical: width > 600 ? 24 : 16,
  },
  quoteIcon: { marginRight: 8, marginTop: -8 },
  reviewQuote: {
    fontSize: width > 600 ? 18 : 15,
    fontWeight: '600',
    color: "#121417",
    textAlign: 'center',
    lineHeight: width > 600 ? 28 : 24,
    flex: 1,
  },
  reviewerDivider: { width: 40, height: 2, backgroundColor: "#121417", marginBottom: 16 },
  reviewerName: { fontSize: width > 600 ? 18 : 16, fontWeight: '900', color: "#121417" },
  reviewerHotel: { fontSize: 13, color: "#636E72", marginTop: 4, fontWeight: '500' },
  dotRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginTop: 28,
  },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#E2E8F0" },
  dotActive: { backgroundColor: "#121417", width: 28 },

  // ── PRICING ──
  priceSection: {
    paddingVertical: width > 600 ? 100 : 60,
    paddingHorizontal: 16,
    backgroundColor: '#FAF9F6',
    alignItems: 'center',
  },
  priceHeaderCenter: { alignItems: 'center', marginBottom: 40 },
  pricePill: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    marginBottom: 16,
  },
  pricePillText: { fontSize: 10, fontWeight: '900', color: '#4F46E5', letterSpacing: 1 },
  priceTitleMain: {
    fontSize: width > 600 ? 28 : 22,
    fontWeight: '900',
    color: '#121417',
    textAlign: 'center',
    lineHeight: width > 600 ? 34 : 28,
    letterSpacing: -1,
  },
  priceSubMain: {
    fontSize: width > 600 ? 16 : 14,
    color: '#636E72',
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 24,
  },
  proCard: {
    width: width > 600 ? 440 : width - 32,
    backgroundColor: '#FFF',
    borderRadius: 24,
    padding: width > 600 ? 30 : 22,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: "#4F46E5",
    shadowOpacity: 0.05,
    shadowRadius: 20,
    elevation: 5,
  },
  proCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 32,
  },
  proCardTag: { fontSize: 11, fontWeight: '700', color: '#94A3B8', marginBottom: 6 },
  proPriceRow: { flexDirection: 'row', alignItems: 'baseline' },
  proTitle: { fontSize: 30, fontWeight: '900', color: '#121417' },
  proFeaturesLabel: { fontSize: 14, color: '#94A3B8', fontWeight: '500' },
  bluePopularBadge: {
    backgroundColor: '#4F46E5',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  bluePopularText: { color: '#FFF', fontSize: 10, fontWeight: '900' },
  proFeatureList: { gap: 18, marginBottom: 36 },
  proItem: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  blueCheck: { width: 24, height: 24, justifyContent: 'center', alignItems: 'center' },
  proItemText: { fontSize: width > 600 ? 15 : 14, fontWeight: '600', color: '#475569', flex: 1 },
  proBtn: {
    backgroundColor: '#121417',
    width: '100%',
    paddingVertical: 18,
    borderRadius: 12,
    alignItems: 'center',
  },
  proBtnText: { color: '#FFF', fontWeight: '800', fontSize: 16 },

  // ── FAQ ──
  faqSection: {
    paddingVertical: width > 600 ? 100 : 60,
    paddingHorizontal: width > 600 ? 30 : 16,
    maxWidth: 1100,
    alignSelf: 'center',
    width: '100%',
  },
  faqHeaderRow: {
    flexDirection: width > 600 ? 'row' : 'column',
    justifyContent: 'space-between',
    alignItems: width > 600 ? 'flex-end' : 'flex-start',
    marginBottom: width > 600 ? 60 : 36,
    gap: 16,
  },
  faqHeaderLeft: {
    flexDirection: width > 480 ? 'row' : 'column',
    alignItems: width > 480 ? 'center' : 'flex-start',
    gap: width > 480 ? 20 : 12,
  },
  faqBadge: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  faqBadgeText: { fontSize: 11, fontWeight: '900', color: '#4F46E5', letterSpacing: 1 },
  faqMainTitle: {
    fontSize: width > 600 ? 30 : 22,
    fontWeight: '900',
    color: C.charcoal,
    letterSpacing: -1,
  },
  faqSubTitle: {
    fontSize: width > 600 ? 16 : 14,
    color: C.muted,
    fontWeight: '500',
    maxWidth: width > 600 ? 300 : '100%',
    lineHeight: 24,
  },
  faqList: { gap: 12 },
  faqItem: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    paddingHorizontal: width > 600 ? 28 : 18,
    paddingVertical: width > 600 ? 24 : 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  faqItemActive: { borderColor: C.charcoal, borderBottomWidth: 3 },
  faqQuestionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  faqQ: {
    fontSize: width > 600 ? 17 : 15,
    fontWeight: '700',
    color: C.charcoal,
    flex: 1,
  },
  faqAnswerContent: { marginTop: 16 },
  faqAnswerDivider: { height: 1, backgroundColor: '#F1F5F9', marginBottom: 16 },
  faqA: {
    fontSize: width > 600 ? 15 : 14,
    color: C.muted,
    lineHeight: 24,
    fontWeight: '500',
  },

  // ── FOOTER ──
  footer: {
    backgroundColor: "#000000",
    paddingTop: width > 600 ? 80 : 52,
    paddingBottom: 36,
    paddingHorizontal: width > 600 ? 60 : 24,
  },
  footerTop: {
    flexDirection: width > 768 ? 'row' : 'column',
    maxWidth: 1200,
    alignSelf: 'center',
    width: '100%',
    gap: width > 768 ? 0 : 40,
  },
  fBrand: {
    flex: width > 768 ? 1 : undefined,
    marginBottom: width > 768 ? 0 : 0,
  },
  fLogo: {
    fontSize: 26,
    fontWeight: '900',
    color: "#FFFFFF",
    letterSpacing: -1,
  },
  fTag: {
    color: "#94A3B8",
    marginTop: 16,
    lineHeight: 24,
    fontSize: 14,
    maxWidth: width > 768 ? 300 : '100%',
  },
  fLinksGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flex: width > 768 ? 2 : undefined,
    width: width > 768 ? undefined : '100%',
    flexWrap: 'nowrap',
  },
  fCol: {
    flex: 1,
  },
  fH: {
    fontWeight: '900',
    color: "#FFFFFF",
    marginBottom: 20,
    fontSize: width > 600 ? 12 : 11,
    letterSpacing: 1.5,
  },
  fL: {
    color: "#94A3B8",
    marginBottom: 15,
    fontWeight: '500',
    fontSize: 15,
    paddingVertical: 2,
  },
  fDivider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.07)",
    maxWidth: 1200,
    alignSelf: 'center',
    width: '100%',
    marginTop: 52,
    marginBottom: 28,
  },
  footerBottom: { alignItems: 'center' },
  copy: { fontSize: 13, color: "#64748B", fontWeight: '500' },

  // ── SHARED ──
  tagWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
    alignSelf: 'center',
  },
  tagDot: { width: 6, height: 6, borderRadius: 3 },
  tagText: { fontSize: 11, fontWeight: '900', letterSpacing: 2 },
});