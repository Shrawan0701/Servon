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
  <View style={dm.sideLogo}>
    <Ionicons name="storefront" size={width > 600 ? 16 : 13} color="#FFFFFF" />
  </View>
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

// ─── AI BUSINESS ADVISOR — CHAT MOCKUP ─────────────────────────────────

const AIAdvisorMockup = () => {
  const { width } = useWindowDimensions();
  const dm = getAdvisorStyles(width);

  return (
    <View style={dm.wrapper}>
      <View style={dm.header}>
        <View style={dm.headerLeft}>
          <View style={dm.botIcon}>
            <Ionicons name="sparkles" size={16} color={C.green} />
          </View>
          <Text style={dm.headerTitle}>AI Business Advisor</Text>
        </View>
        <Ionicons name="ellipsis-horizontal" size={16} color={C.muted} />
      </View>

      <View style={dm.chatBody}>
        <View style={dm.userBubbleWrap}>
          <View style={dm.userBubble}>
            <Text style={dm.userBubbleText}>What should I do to increase profitability?</Text>
          </View>
        </View>

        <View style={dm.aiBubbleWrap}>
          <View style={dm.aiBubble}>
            <Text style={dm.aiBubbleText}>Based on this week's data, here is where to focus:</Text>
            {[
              "Push Special Thali and Kadhai Paneer, your top sellers, with combo pricing",
              "Run offers during your peak hours to pull in more walk-ins",
              "Roti has low order volume, try bundling it with your main courses",
            ].map((line, i) => (
              <View key={i} style={dm.aiBulletRow}>
                <View style={dm.aiBulletDot} />
                <Text style={dm.aiBulletText}>{line}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>

      <View style={dm.inputRow}>
        <Text style={dm.inputPlaceholder}>Ask about your business...</Text>
        <View style={dm.sendBtn}>
          <Ionicons name="send" size={14} color="#FFF" />
        </View>
      </View>
    </View>
  );
};

// ─── DAILY AI SUMMARY — NOTIFICATION CARD MOCKUP ───────────────────────

const DailySummaryMockup = () => {
  const { width } = useWindowDimensions();
  const dm = getAdvisorStyles(width);

  return (
    <View style={dm.summaryWrapper}>
      <View style={dm.summaryHeaderRow}>
        <Text style={dm.summaryTitle}>Daily Summary</Text>
        <Ionicons name="close" size={16} color={C.muted} />
      </View>
      <Text style={dm.summaryDate}>Today, 6:30 PM</Text>

      <View style={dm.summaryNoteBox}>
        <Ionicons name="bar-chart" size={14} color={C.green} />
        <Text style={dm.summaryNoteText}>
          5 orders totaling ₹2,631 today. Top items were Special Thali, Kadhai Paneer and Roti. Keep up the momentum.
        </Text>
      </View>

      <View style={dm.summaryStatsRow}>
        <View style={dm.summaryStatBox}>
          <Text style={dm.summaryStatVal}>5</Text>
          <Text style={dm.summaryStatLab}>ORDERS</Text>
        </View>
        <View style={dm.summaryStatBox}>
          <Text style={dm.summaryStatVal}>₹2,631</Text>
          <Text style={dm.summaryStatLab}>REVENUE</Text>
        </View>
        <View style={dm.summaryStatBox}>
          <Text style={dm.summaryStatVal}>₹526</Text>
          <Text style={dm.summaryStatLab}>AVG ORDER</Text>
        </View>
      </View>

      <View style={dm.summaryBtn}>
        <Text style={dm.summaryBtnText}>Got It</Text>
      </View>
    </View>
  );
};

// ─── AI BUSINESS ADVISOR — MARKETING SPOTLIGHT SECTION ─────────────────

const AIAdvisorSection = ({ s }) => (
  <View style={s.advisorSection}>
    <View style={s.advisorGlow} />
    <View style={s.advisorInner}>
      <View style={s.advisorTextCol}>
        <View style={s.advisorBadge}>
          <View style={s.advisorBadgeDot} />
          <Text style={s.advisorBadgeText}>AI BUSINESS ADVISOR</Text>
        </View>

        <Text style={s.advisorH2}>
          Ask your business anything.{"\n"}
          <Text style={{ color: C.green }}>Get the answer instantly.</Text>
        </Text>

        <Text style={s.advisorSub}>
          Servon's AI Business Advisor reads your live sales, menu and expense
          data so you can talk to your restaurant like a co-pilot, right from
          the app or the website. No spreadsheets, no digging through reports.
        </Text>

        <View style={s.advisorFeatureList}>
          {[
            {
              icon: "chatbubble-ellipses-outline",
              t: "Chat With Your Business",
              d: "Ask about profit, slow days or best sellers and get a clear, plain-language answer in seconds.",
            },
            {
              icon: "notifications-outline",
              t: "Daily AI Summary",
              d: "A smart notification card lands on its own with your orders, revenue and top items for the day.",
            },
            {
              icon: "bulb-outline",
              t: "Actionable Recommendations",
              d: "Get specific next steps, like which items to push or which hours need a promotion, not just raw numbers.",
            },
          ].map((f, i) => (
            <View key={i} style={s.advisorFeatureRow}>
              <View style={s.advisorFeatureIcon}>
                <Ionicons name={f.icon} size={18} color={C.green} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.advisorFeatureTitle}>{f.t}</Text>
                <Text style={s.advisorFeatureDesc}>{f.d}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>

      <View style={s.advisorVisualCol}>
        <AIAdvisorMockup />
        <View style={s.summaryFloatWrap}>
          <DailySummaryMockup />
        </View>
      </View>
    </View>
  </View>
);

// ─── IN-APP REVIEWS — FEATURE SECTION ───────────────────────────────────

const ReviewFeatureSection = ({ s }) => (
  <View style={s.reviewFeatureSection}>
    <View style={s.reviewFeatureHeader}>
      <SectionTag text="In-App Reviews" styles={s} />
      <Text style={s.reviewFeatureH2}>Reputation, handled for you</Text>
      <Text style={s.reviewFeatureSub}>
        Every bill becomes a feedback opportunity, without asking a single
        customer to leave a public review on Google.
      </Text>
    </View>

    <View style={s.reviewStepsGrid}>
      {[
        {
          n: "STEP 1",
          icon: "receipt-outline",
          t: "QR On Every Bill",
          d: "Each printed bill carries a QR code tied to that exact table, order, date and time.",
        },
        {
          n: "STEP 2",
          icon: "star-outline",
          t: "Instant Feedback",
          d: "Guests scan, rate their experience with stars and add a quick note. No app download, no login required.",
        },
        
      ].map((step, i) => (
        <View key={i} style={s.reviewStepCard}>
          <Text style={s.reviewStepNumber}>{step.n}</Text>
          <View style={s.reviewStepIcon}>
            <Ionicons name={step.icon} size={22} color={C.green} />
          </View>
          <Text style={s.reviewStepTitle}>{step.t}</Text>
          <Text style={s.reviewStepDesc}>{step.d}</Text>
        </View>
      ))}
    </View>
  </View>
);

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
  // 1. Basic UI Validation
  if (!formData.name || !formData.email || !formData.businessName || !formData.businessType) {
    setFormErrors({
      name: !formData.name ? 'Name is required' : '',
      email: !formData.email ? 'Email is required' : '',
      businessName: !formData.businessName ? 'Business name is required' : '',
      businessType: !formData.businessType ? 'Please select a business type' : '',
    });
    return;
  }

  setIsSubmitting(true);
  setSubmitError('');
  setSubmitSuccess(false);

  try {
    // Web3Forms standard API endpoint
    const ENDPOINT_URL = 'https://api.web3forms.com/submit'; 

    const response = await fetch(ENDPOINT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        // PASTE YOUR WEB3FORMS ACCESS KEY HERE
        access_key: "e02acc71-490b-4dae-a5d2-be08862400dc", 
        
        // Email subject line that will show up in your inbox
        subject: `New Servon Demo Request - ${formData.businessName}`,
        
        // Form Data Fields
        name: formData.name,
        email: formData.email,
        phone: formData.phone || 'Not Provided',
        businessName: formData.businessName,
        businessType: formData.businessType,
        message: formData.message || 'No additional message',
      }),
    });

    const result = await response.json();

    if (result.success) {
      setSubmitSuccess(true);
      // Reset form on success
      setFormData({ name: '', email: '', phone: '', businessName: '', businessType: '', message: '' });
    } else {
      throw new Error(result.message || 'Failed to send request.');
    }
  } catch (error) {
    setSubmitError(error.message || 'Something went wrong. Please try again.');
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
        'QR ordering, kitchen sync, Chef Mode privacy, AI business advisor, in-app reviews, expense tracking, and GST billing — all in one platform.';
      document.head.appendChild(metaDesc);

      const metaKeywords = document.createElement('meta');
      metaKeywords.name = 'keywords';
      metaKeywords.content =
        'restaurant POS India, QR menu ordering, restaurant billing software, kitchen order system, ' +
        'KOT software, GST billing restaurant, restaurant management app, Chef Mode, AI business advisor, ' +
        'restaurant reviews software, expense tracking restaurant, UPI payments restaurant, Servon';
      document.head.appendChild(metaKeywords);

      const metaOGTitle = document.createElement('meta');
      metaOGTitle.setAttribute('property', 'og:title');
      metaOGTitle.content = 'Servon | The Restaurant OS for India';
      document.head.appendChild(metaOGTitle);

      const metaOGDesc = document.createElement('meta');
      metaOGDesc.setAttribute('property', 'og:description');
      metaOGDesc.content =
        'QR ordering, live kitchen sync, Chef Mode privacy, an AI business advisor, and expense ERP — ' +
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
              <Text style={s.navLoginText}>Login</Text>
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

            

            <PremiumDashboard />
          </Animated.View>
        </View>

                <AIAdvisorSection s={s} />


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
                            { i: "chatbubble-ellipses-outline", t: "AI Business Advisor", d: "Chat with an AI that knows your sales, menu and expenses inside out.",             c: "#EDE9FE" },

              { i: "receipt-outline",    t: "Seamless Billing",      d: "GST invoicing with integrated digital feedback and reviews.",                               c: "#EBF8FF" },
              { i: "bar-chart-outline",  t: "Granular Analytics",    d: "Real-time insights into best sellers, peak hours, and server performance.",                c: "#FFF4E6" },
              { i: "calculator-outline", t: "Expense ERP",           d: "Log procurement and payroll to see your true net profit daily.",                           c: "#FEE2E2" },
              { i: "flash-outline",      t: "Kitchen Sync",          d: "Zero-lag cloud-based KOT routing to keep your chefs in harmony.",                         c: "#F0FDF4" },
              { i: "star-outline",       t: "Verified In-App Reviews", d: "QR-based feedback on every bill, with full control over what goes public.",             c: "#FEF3C7" },
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

        {/* ── AI BUSINESS ADVISOR SPOTLIGHT ── */}
       

        {/* ── IN-APP REVIEWS ── */}
        <ReviewFeatureSection s={s} />

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
                "AI Business Advisor & Daily AI Summary",
                "Verified In-App Reviews",
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
                q: "What can the AI Business Advisor actually do?",
                a: "It reads your live sales, menu and expense data so you can ask plain-language questions like what should I do to increase profitability, and get a clear, specific answer. It also sends an automatic daily summary of your orders, revenue and top items."
              },
              {
                q: "How do in-app reviews work?",
                a: "Every printed bill carries a QR code tied to that table and order. Guests scan it, leave a star rating and a quick note, no app or login needed, and you see every review inside Servon by order, table, date and items."
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
  <Text style={s.fCompanyLine}>Servon Labs Private Limited, Pune, Maharashtra</Text>
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
                  <Text style={s.modalSubmitBtnText}>Contact Us</Text>
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
                Demo request sent successfully! We'll contact you soon.
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
  alignItems: 'center',
  justifyContent: 'center',
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

// ─── AI ADVISOR + DAILY SUMMARY MOCKUP STYLES ──────────────────────────

const getAdvisorStyles = (width) => StyleSheet.create({
  wrapper: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: C.border,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 30,
    elevation: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  botIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: C.greenLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontSize: 14, fontWeight: '800', color: C.charcoal },
  chatBody: { padding: 18, gap: 14 },
  userBubbleWrap: { alignItems: 'flex-end' },
  userBubble: {
    backgroundColor: C.charcoal,
    borderRadius: 16,
    borderBottomRightRadius: 4,
    paddingHorizontal: 16,
    paddingVertical: 10,
    maxWidth: '85%',
  },
  userBubbleText: { color: '#FFF', fontSize: 13, fontWeight: '600', lineHeight: 19 },
  aiBubbleWrap: { alignItems: 'flex-start' },
  aiBubble: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    borderBottomLeftRadius: 4,
    paddingHorizontal: 16,
    paddingVertical: 12,
    maxWidth: '92%',
    borderWidth: 1,
    borderColor: '#EDF2F7',
  },
  aiBubbleText: { fontSize: 13, fontWeight: '600', color: C.charcoal, lineHeight: 19, marginBottom: 8 },
  aiBulletRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 6 },
  aiBulletDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: C.green, marginTop: 7 },
  aiBulletText: { flex: 1, fontSize: 12, color: C.muted, lineHeight: 18, fontWeight: '500' },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  inputPlaceholder: { flex: 1, fontSize: 12, color: '#94A3B8', fontWeight: '500' },
  sendBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: C.green,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Daily summary mockup
  summaryWrapper: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: C.border,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 10,
  },
  summaryHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  summaryTitle: { fontSize: 16, fontWeight: '900', color: C.charcoal },
  summaryDate: { fontSize: 11, color: C.muted, fontWeight: '600', marginTop: 2, marginBottom: 14 },
  summaryNoteBox: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: C.greenLight,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  summaryNoteText: { flex: 1, fontSize: 12, color: '#0F5132', lineHeight: 18, fontWeight: '600' },
  summaryStatsRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  summaryStatBox: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#EEF1F5',
  },
  summaryStatVal: { fontSize: 15, fontWeight: '900', color: C.charcoal },
  summaryStatLab: { fontSize: 9, fontWeight: '800', color: C.muted, marginTop: 4, letterSpacing: 0.5 },
  summaryBtn: {
    backgroundColor: C.charcoal,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  summaryBtnText: { color: '#FFF', fontWeight: '800', fontSize: 13 },
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

  // ── AI BUSINESS ADVISOR SECTION ──
  advisorSection: {
    paddingVertical: width > 600 ? 110 : 64,
    paddingHorizontal: width > 600 ? 30 : 18,
    backgroundColor: '#FAF9F6',
    position: 'relative',
    overflow: 'hidden',
  },
  advisorGlow: {
    position: 'absolute',
    top: '10%',
    left: '-15%',
    width: 560,
    height: 560,
    borderRadius: 280,
    backgroundColor: '#E6F3EF',
    opacity: 0.5,
  },
  advisorInner: {
    maxWidth: 1200,
    alignSelf: 'center',
    width: '100%',
    flexDirection: width > 900 ? 'row' : 'column',
    alignItems: width > 900 ? 'center' : 'stretch',
    gap: width > 900 ? 60 : 48,
    zIndex: 2,
  },
  advisorTextCol: { flex: width > 900 ? 1 : undefined },
  advisorBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#FFF',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 24,
    gap: 8,
  },
  advisorBadgeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.green },
  advisorBadgeText: { fontSize: 11, fontWeight: '900', color: C.green, letterSpacing: 1.5 },
  advisorH2: {
    fontSize: width > 800 ? 42 : width > 400 ? 30 : 26,
    fontWeight: '900',
    color: C.charcoal,
    letterSpacing: -1.2,
    lineHeight: width > 800 ? 50 : width > 400 ? 38 : 33,
    marginBottom: 20,
  },
  advisorSub: {
    fontSize: width > 600 ? 16 : 14,
    color: C.muted,
    lineHeight: width > 600 ? 25 : 22,
    marginBottom: 36,
    maxWidth: 520,
  },
  advisorFeatureList: { gap: 24 },
  advisorFeatureRow: { flexDirection: 'row', gap: 16, alignItems: 'flex-start' },
  advisorFeatureIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: C.greenLight,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  advisorFeatureTitle: { fontSize: width > 600 ? 16 : 15, fontWeight: '800', color: C.charcoal, marginBottom: 4 },
  advisorFeatureDesc: { fontSize: width > 600 ? 14 : 13, color: C.muted, lineHeight: 20, fontWeight: '500' },
  advisorVisualCol: {
    flex: width > 900 ? 1 : undefined,
    alignItems: width > 900 ? 'flex-end' : 'center',
    position: 'relative',
    paddingTop: width > 900 ? 0 : 10,
    paddingBottom: width > 900 ? 90 : 140,
    width: '100%',
  },
  summaryFloatWrap: {
    position: width > 900 ? 'absolute' : 'relative',
    left: width > 900 ? -40 : undefined,
    bottom: width > 900 ? -60 : undefined,
    marginTop: width > 900 ? 0 : 20,
  },

  // ── IN-APP REVIEWS SECTION ──
  reviewFeatureSection: {
    paddingVertical: width > 600 ? 100 : 60,
    paddingHorizontal: width > 600 ? 30 : 16,
    backgroundColor: '#FFFFFF',
  },
  reviewFeatureHeader: { alignItems: 'center', marginBottom: width > 600 ? 56 : 36 },
  reviewFeatureH2: {
    fontSize: width > 600 ? 30 : 22,
    fontWeight: '900',
    color: C.charcoal,
    textAlign: 'center',
    letterSpacing: -0.8,
    marginTop: 4,
    marginBottom: 14,
  },
  reviewFeatureSub: {
    fontSize: width > 600 ? 16 : 14,
    color: C.muted,
    textAlign: 'center',
    maxWidth: 560,
    lineHeight: 24,
  },
  reviewStepsGrid: {
    flexDirection: width > 800 ? 'row' : 'column',
    gap: 20,
    maxWidth: 1100,
    alignSelf: 'center',
    width: '100%',
  },
  reviewStepCard: {
    flex: width > 800 ? 1 : undefined,
    backgroundColor: '#FAF9F6',
    borderRadius: 20,
    padding: width > 600 ? 28 : 22,
    borderWidth: 1,
    borderColor: C.border,
  },
  reviewStepNumber: { fontSize: 12, fontWeight: '900', color: C.green, marginBottom: 14, letterSpacing: 1 },
  reviewStepIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: C.greenLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  reviewStepTitle: { fontSize: width > 600 ? 17 : 16, fontWeight: '800', color: C.charcoal, marginBottom: 10 },
  reviewStepDesc: { fontSize: width > 600 ? 14 : 13.5, color: C.muted, lineHeight: 21, fontWeight: '500' },

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
  fCompanyLine: {
  fontSize: 13,
  color: "#64748B",
  fontWeight: '500',
  marginBottom: 8,
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