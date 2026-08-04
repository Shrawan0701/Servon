import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Pressable,
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
  green:      "#00785C",
  greenDeep:  "#005A44",
  greenLight: "#E6F3EF",
  border:     "#EBE9E0",
  muted:      "#636E72",
  accent:     "#D4AF37",
  ink:        "#0F172A",
  error:      "#E63946",
  paper:      "#FFFDF7",
  paperBorder:"#E9E4D4",
};

const MONO = Platform.select({
  ios: "Courier",
  android: "monospace",
  web: "'SFMono-Regular', 'Menlo', 'Consolas', monospace",
  default: "monospace",
});

const BUSINESS_TYPES = ["Hotel", "Restaurant", "Resort", "Cafe", "Other"];

// ─── FEATURE SLIDER DATA (Core Capabilities section) ───────────────────
const FEATURES = [
  {
    i: "cloud-offline-outline",
    t: "Smart Offline Mode",
    d: "Zero-downtime billing, orders, & KOTs without internet. Auto-syncs when online.",
    detail: "Internet drops don't stop service. Billing, order-taking and KOT printing keep running locally, and every record syncs back the moment your connection returns - no lost orders, no re-entry.",
    c: "#E0F2FE",
    accent: "#0EA5E9",
    tag: "RELIABILITY",
  },
  {
    i: "mic-outline",
    t: "Voice AI Advisor",
    d: "Talk directly with your AI. Ask for daily revenue, top items, or insights hands-free.",
    detail: "Tap once and speak. Ask what today's profit looks like or which dish is underperforming, and get a spoken answer back - built for hands full of plates, not spreadsheets.",
    c: "#FCE7F3",
    accent: "#DB2777",
    tag: "AI & VOICE",
  },
  {
    i: "notifications-outline",
    t: "AI Briefs & Live Alerts",
    d: "Proactive business summaries and real-time alerts for spikes, delays, and stock.",
    detail: "Servon watches your floor even when you can't. Get pushed a plain-language summary each evening, and an instant nudge the moment a station stalls or an ingredient runs low.",
    c: "#FEF3C7",
    accent: "#D97706",
    tag: "AI & AUTOMATION",
  },
  {
    i: "qr-code-outline",
    t: "Smart QR Ordering",
    d: "Frictionless ordering via browser. No app installs, no wait times for guests.",
    detail: "Guests scan, browse and order straight from their phone's browser. No app store, no login, no waiting on a server to walk over - orders land in your kitchen the second they're placed.",
    c: "#E6F3EF",
    accent: "#00785C",
    tag: "GUEST EXPERIENCE",
  },
  {
    i: "shield-half-outline",
    t: "Chef Mode™ Privacy",
    d: "Hide financial data from staff with a single master toggle instantly.",
    detail: "One switch hides revenue, margins and expense data from every staff-facing screen instantly, while owners and managers keep full visibility from their own login.",
    c: "#F3E8FF",
    accent: "#9333EA",
    tag: "PRIVACY & CONTROL",
  },
  {
    i: "receipt-outline",
    t: "Seamless Billing",
    d: "GST invoicing with integrated digital feedback and reviews.",
    detail: "Every bill is GST-compliant by default and doubles as a feedback channel, so closing a check and collecting an honest review happen in the same motion.",
    c: "#EBF8FF",
    accent: "#2563EB",
    tag: "BILLING",
  },
  {
    i: "bar-chart-outline",
    t: "Granular Analytics",
    d: "Real-time insights into best sellers, peak hours, and server performance.",
    detail: "See exactly which dishes, hours and staff are driving results, updated live, so decisions about menu, staffing and promotions are backed by today's numbers, not last month's.",
    c: "#FFF4E6",
    accent: "#EA580C",
    tag: "ANALYTICS",
  },
  {
    i: "calculator-outline",
    t: "Expense ERP",
    d: "Log procurement and payroll to see your true net profit daily.",
    detail: "Log procurement, vendor payments and payroll as they happen, and Servon nets it against revenue automatically to show your real daily profit, not just top-line sales.",
    c: "#FEE2E2",
    accent: "#DC2626",
    tag: "FINANCE",
  },
  {
    i: "flash-outline",
    t: "Kitchen Sync",
    d: "Zero-lag cloud-based KOT routing to keep your chefs in harmony.",
    detail: "Orders route to the right kitchen station the instant they're placed, cloud-synced across every device on the floor, so chefs never chase a ticket that already moved.",
    c: "#F0FDF4",
    accent: "#16A34A",
    tag: "KITCHEN OPS",
  },
  {
    i: "star-outline",
    t: "Verified In-App Reviews",
    d: "QR-based feedback on every bill, with full control over what goes public.",
    detail: "A QR code on every printed bill collects a verified rating tied to a real order, and you decide what surfaces publicly, so feedback is honest without being a liability.",
    c: "#FEF3C7",
    accent: "#CA8A04",
    tag: "REPUTATION",
  },
];

// ─── HOVERABLE (web-aware lift-on-hover wrapper; degrades gracefully on native) ──
const Hoverable = ({ children, style, onPress, liftY = 6, disabled }) => {
  const [hovered, setHovered] = useState(false);
  const webHoverProps = Platform.OS === 'web'
    ? { onMouseEnter: () => setHovered(true), onMouseLeave: () => setHovered(false) }
    : {};
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      {...webHoverProps}
      style={[
        style,
        Platform.OS === 'web' && {
          transform: [{ translateY: hovered ? -liftY : 0 }],
          transition: 'transform 220ms ease, box-shadow 220ms ease, border-color 220ms ease',
          cursor: onPress ? 'pointer' : 'default',
        },
      ]}
    >
      {children}
    </Pressable>
  );
};

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

const SectionTag = ({ text, color = C.green, styles, align = 'center' }) => (
  <View style={[styles.tagWrap, { alignSelf: align }]}>
    <View style={[styles.tagDot, { backgroundColor: color }]} />
    <Text style={[styles.tagText, { color }]}>{text.toUpperCase()}</Text>
  </View>
);

const PremiumDashboard = () => {
  const { width } = useWindowDimensions();
  const dm = getDashboardStyles(width);

 const isMobile = width < 600;

return (
  <View style={dm.wrapper}>
    {/* Browser Header Bar */}
    <View style={dm.browserChrome}>
      <View style={dm.windowControls}>
        <View style={[dm.wDot, { backgroundColor: "#FF5F56" }]} />
        <View style={[dm.wDot, { backgroundColor: "#FFBD2E" }]} />
        <View style={[dm.wDot, { backgroundColor: "#27C93F" }]} />
      </View>
      <View style={dm.urlBar}>
        <Ionicons name="shield-checkmark" size={12} color={C.green} />
        <Text style={dm.urlText} numberOfLines={1}>servon.cloud/dashboard/analytics-live</Text>
      </View>
    </View>

    {/* Main App Workspace */}
    <View style={dm.mainLayout}>
      {/* Side Navigation - Hidden on mobile screen sizes to give room */}
      {!isMobile && (
        <View style={dm.sideNav}>
          <View style={dm.sideLogo}>
            <Ionicons name="storefront" size={16} color="#FFFFFF" />
          </View>
          {['grid', 'receipt', 'fast-food', 'people', 'stats-chart', 'settings'].map((icon, idx) => (
            <View key={idx} style={[dm.sideIcon, idx === 0 && dm.sideIconActive]}>
              <Ionicons name={icon} size={18} color={idx === 0 ? C.green : "#CBD5E0"} />
            </View>
          ))}
        </View>
      )}

      {/* Main Content Pane */}
      <View style={dm.contentPane}>
        {/* Top Header */}
        <View style={dm.headerRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <Text style={dm.paneTitle}>Live Overview</Text>
            <View style={dm.livePulseBadge}>
              <View style={dm.pulseDot} />
              <Text style={dm.liveText}>LIVE</Text>
            </View>
          </View>

          <View style={dm.datePicker}>
            <Text style={dm.dateText}>Mar 25</Text>
            <Ionicons name="calendar-outline" size={12} color={C.muted} />
          </View>
        </View>

        {/* Responsive KPI Grid: 2 columns on mobile, 4 on desktop */}
        <View style={dm.kpiGrid}>
          <View style={dm.kpiCard}>
            <Text style={dm.kpiLab}>Revenue</Text>
            <Text style={dm.kpiVal}>₹1,84,200</Text>
            <Text style={[dm.deltaText, { color: C.green }]}>+12.4% ↑</Text>
          </View>

          <View style={dm.kpiCard}>
            <Text style={dm.kpiLab}>Active Orders</Text>
            <Text style={dm.kpiVal}>142</Text>
            <Text style={[dm.deltaText, { color: C.accent }]}>18 in KDS</Text>
          </View>

          <View style={dm.kpiCard}>
            <Text style={dm.kpiLab}>Avg Order</Text>
            <Text style={dm.kpiVal}>₹1,297</Text>
            <Text style={[dm.deltaText, { color: C.green }]}>+5.2% ↑</Text>
          </View>

          <View style={dm.kpiCard}>
            <Text style={dm.kpiLab}>Occupancy</Text>
            <Text style={dm.kpiVal}>84%</Text>
            <Text style={[dm.deltaText, { color: "#3182CE" }]}>21/25 Tables</Text>
          </View>
        </View>

        {/* Hourly Sales Visual Chart Bar */}
        <View style={dm.chartSection}>
          <View style={dm.chartHeader}>
            <Text style={dm.sectionSubTitle}>Peak Rush Velocity</Text>
            <Text style={dm.chartPeakLabel}>8:00 - 9:30 PM</Text>
          </View>
          <View style={dm.barChartContainer}>
            {[35, 45, 60, 80, 100, 70, 90, 65, 40].map((height, i) => (
              <View key={i} style={dm.barWrapper}>
                <View style={[dm.chartBar, { height: `${height}%`, backgroundColor: i === 4 ? C.green : '#E2E8F0' }]} />
              </View>
            ))}
          </View>
        </View>

        {/* Kitchen Live Stream List */}
        <View style={dm.bottomSection}>
          <View style={dm.bottomHeader}>
            <Text style={dm.panelTitle}>Kitchen Stream (KDS)</Text>
            <Text style={dm.viewAllText}>View All (18)</Text>
          </View>

          {[
            { t: "T-04", i: "Butter Chicken x2, Naan", s: "PREP", c: C.accent, time: "4m ago", val: "₹1,120" },
            { t: "T-12", i: "Dal Makhani, Paneer Tikka", s: "READY", c: C.green, time: "12m ago", val: "₹850" },
            { t: "T-09", i: "Special Veg Biryani", s: "NEW", c: "#3182CE", time: "Just now", val: "₹640" },
          ].map((o, idx) => (
            <View key={idx} style={dm.orderRow}>
              <View style={dm.tableBadge}>
                <Text style={dm.tableText}>{o.t}</Text>
              </View>
              <View style={{ flex: 1, marginHorizontal: 8 }}>
                <Text style={dm.itemText} numberOfLines={1}>{o.i}</Text>
                <Text style={dm.timeText}>{o.time} • {o.val}</Text>
              </View>
              <View style={[dm.statusBadge, { borderColor: o.c, backgroundColor: o.c + '15' }]}>
                <Text style={[dm.statusText, { color: o.c }]}>{o.s}</Text>
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
          data so you can talk to your restaurant like a co-pilot.
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

// ─── FEEDBACK RECEIPT MOCKUP (used by the In-App Reviews section) ──────
// A small hand-rolled "QR" grid — three solid corner eyes plus a
// deterministic noise fill. It's a stand-in graphic, not a scannable code.

const QR_GRID_SIZE = 9;

const ReceiptQRMock = ({ s }) => {
  const cells = [];
  for (let r = 0; r < QR_GRID_SIZE; r++) {
    for (let c = 0; c < QR_GRID_SIZE; c++) {
      const inTL = r < 3 && c < 3;
      const inTR = r < 3 && c > QR_GRID_SIZE - 4;
      const inBL = r > QR_GRID_SIZE - 4 && c < 3;

      let filled;
      if (inTL) {
        filled = !(r === 1 && c === 1);
      } else if (inTR) {
        filled = !(r === 1 && c - (QR_GRID_SIZE - 3) === 1);
      } else if (inBL) {
        filled = !(r - (QR_GRID_SIZE - 3) === 1 && c === 1);
      } else {
        filled = ((r * 5 + c * 3 + r * c) % 7) < 3;
      }

      cells.push(
        <View
          key={`${r}-${c}`}
          style={[s.qrCell, filled && s.qrCellFilled]}
        />
      );
    }
  }
  return <View style={s.qrGrid}>{cells}</View>;
};

const FeedbackReceiptMockup = ({ s }) => (
  <View style={s.receiptMockWrap}>
    <View style={s.printerBar}>
      <View style={s.printerSlot} />
    </View>

    <View style={s.receiptPaper}>
      <Text style={s.receiptStoreName}>SERVON KITCHEN</Text>
      <Text style={s.receiptMeta}>TABLE 12 · CHECK #0842</Text>

      <View style={s.receiptDivider} />

      {[
        { label: "Butter Chicken", value: "₹320" },
        { label: "Dal Makhani", value: "₹260" },
        { label: "Roti x4", value: "₹160" },
      ].map((row, i) => (
        <View key={i} style={s.receiptLineRow}>
          <Text style={s.receiptLineLabel}>{row.label}</Text>
          <View style={s.receiptLineLeader} />
          <Text style={s.receiptLineValue}>{row.value}</Text>
        </View>
      ))}

      <View style={s.receiptDivider} />

      <View style={s.receiptLineRow}>
        <Text style={s.receiptTotalLabel}>TOTAL</Text>
        <View style={s.receiptLineLeader} />
        <Text style={s.receiptTotalValue}>₹740</Text>
      </View>

      <View style={s.receiptQRSection}>
        <ReceiptQRMock s={s} />
        <Text style={s.receiptScanLabel}>SCAN TO RATE YOUR VISIT</Text>
        <View style={s.receiptStarRow}>
          {[1, 2, 3, 4, 5].map((n) => (
            <Ionicons key={n} name="star" size={11} color={C.charcoal} />
          ))}
        </View>
      </View>
    </View>

    <View style={s.receiptTearRow}>
      {Array.from({ length: 16 }).map((_, i) => (
        <View key={i} style={s.receiptTearTooth} />
      ))}
    </View>
  </View>
);

// ─── IN-APP REVIEWS — FEATURE SECTION ───────────────────────────────────

export const ReviewFeatureSection = ({ s }) => (
  <View style={s.reviewFeatureSection}>
    <View style={s.reviewFeatureInner}>
      
      {/* LEFT COLUMN: TEXT & STEPS */}
      <View style={s.reviewFeatureTextCol}>
        <SectionTag text="In-App Reviews" styles={s} align="flex-start" />

        <Text style={s.reviewFeatureH2}>
          Every bill asks{"\n"}the question for you
        </Text>

        <Text style={s.reviewFeatureSub}>
          No follow-up texts, no campaigns, no asking a guest to leave a
          public review on Google. The feedback loop is already printed
          on the check.
        </Text>

        <View style={s.receiptStepsList}>
          {/* STEP 1 */}
          <View style={s.receiptStepRow}>
            <View style={s.stepBadge}>
              <Text style={s.receiptStepMark}>STEP 1</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.receiptStepTitle}>A code lands on the bill</Text>
              <Text style={s.receiptStepDesc}>
                Every printed check carries a QR tied to that exact table,
                order, date and time. Nothing extra to set up.
              </Text>
            </View>
          </View>

          <View style={s.receiptStepDivider} />

          {/* STEP 2 */}
          <View style={s.receiptStepRow}>
            <View style={s.stepBadge}>
              <Text style={s.receiptStepMark}>STEP 2</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.receiptStepTitle}>Guests rate in seconds</Text>
              <Text style={s.receiptStepDesc}>
                A scan opens a star rating and a short note. No app,
                no account, no login required.
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* RIGHT COLUMN: RECEIPT MOCKUP */}
      <View style={s.reviewFeatureVisualCol}>
        <FeedbackReceiptMockup s={s} />
      </View>

    </View>
  </View>
);

// ─── FEATURE SLIDER — one big feature slide at a time ──────────────────
// Horizontal, paginated ScrollView: swipe/drag on touch & trackpad, plus
// arrow buttons and dot indicators. The section's outer size is untouched;
// only the inner content became one large slide instead of a 3-col grid.

const FeatureCarousel = ({ s, width }) => {
  const scrollRef = useRef(null);
  const [index, setIndex] = useState(0);
  const [slideWidth, setSlideWidth] = useState(0);
  const isMobile = width < 768;

  // Re-sync scroll offset whenever the measured width changes (resize).
  useEffect(() => {
    if (scrollRef.current && slideWidth) {
      scrollRef.current.scrollTo({ x: index * slideWidth, animated: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slideWidth]);

  const goTo = (next) => {
    const clamped = Math.max(0, Math.min(FEATURES.length - 1, next));
    setIndex(clamped);
    scrollRef.current?.scrollTo({ x: clamped * slideWidth, animated: true });
  };

  // ── AUTO SLIDE EFFECT (3 Seconds) ──
  useEffect(() => {
    if (!slideWidth) return;

    const timer = setInterval(() => {
      setIndex((prevIndex) => {
        const nextIndex = (prevIndex + 1) % FEATURES.length;
        scrollRef.current?.scrollTo({ x: nextIndex * slideWidth, animated: true });
        return nextIndex;
      });
    }, 3000);

    return () => clearInterval(timer);
  }, [slideWidth]);

  const handleMomentumEnd = (e) => {
    if (!slideWidth) return;
    const raw = e.nativeEvent.contentOffset.x / slideWidth;
    const clamped = Math.max(0, Math.min(FEATURES.length - 1, Math.round(raw)));
    setIndex(clamped);
  };

  return (
    <View>
      <View
        style={s.featureCarouselWrap}
        onLayout={(e) => setSlideWidth(e.nativeEvent.layout.width)}
      >
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          decelerationRate="fast"
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={handleMomentumEnd}
          scrollEventThrottle={16}
        >
          {FEATURES.map((f, i) => (
            <View key={i} style={{ width: slideWidth }}>
              <View style={s.featureSlidePad}>
                <View style={s.featureSlideCard}>
                  <View style={s.featureSlideContentCol}>
                    <View style={s.featureSlideEyebrowRow}>
                      <Text style={s.featureSlideCount}>
                        {String(i + 1).padStart(2, "0")} / {String(FEATURES.length).padStart(2, "0")}
                      </Text>
                      <View style={[s.featureSlideTagPill, { borderColor: f.accent + "55" }]}>
                        <View style={[s.featureSlideTagDot, { backgroundColor: f.accent }]} />
                        <Text style={[s.featureSlideTagText, { color: f.accent }]}>{f.tag}</Text>
                      </View>
                    </View>

                    <Text style={s.featureSlideTitle}>{f.t}</Text>
                    <Text style={s.featureSlideDesc}>{f.detail}</Text>

                    <View style={s.featureSlideIncludedRow}>
                      <Ionicons name="checkmark-circle" size={16} color={f.accent} />
                      <Text style={[s.featureSlideIncludedText, { color: f.accent }]}>
                        Included in every Servon plan
                      </Text>
                    </View>
                  </View>

                  <View style={s.featureSlideVisualCol}>
                    <View style={[s.featureSlideVisualPanel, { borderColor: f.accent + "33" }]}>
                      <View style={[s.featureSlideRing1, { borderColor: f.accent + "22" }]} />
                      <View style={[s.featureSlideRing2, { borderColor: f.accent + "3A" }]} />
                      <View style={[s.featureSlideIconBig, { backgroundColor: f.c }]}>
                        <Ionicons name={f.i} size={isMobile ? 40 : 52} color={C.charcoal} />
                      </View>
                    </View>
                  </View>
                </View>
              </View>
            </View>
          ))}
        </ScrollView>
      </View>

      {/* DOTS ONLY (ARROWS REMOVED) */}
      <View style={s.featureDotsRow}>
        {FEATURES.map((_, i) => (
          <TouchableOpacity key={i} onPress={() => goTo(i)} hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}>
            <View style={[s.featureDot, i === index && s.featureDotActive]} />
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

// ─── MAIN APP ─────────────────────────────────────────────────────────

export default function LandingPage({ onNavigate, openDemo, setOpenDemoOnLanding }) {  // Live viewport width — re-renders this component whenever the window/
  // device size actually changes, unlike the old Dimensions.get() snapshot.
  const { width } = useWindowDimensions();
  const isWide = width > 600;
  const s = getMainStyles(width);

  const scrollY = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [activeFaq, setActiveFaq] = useState(null);

  // ─── DEMO MODAL STATE ───────────────────────────────────────────────
  const [demoModalVisible, setDemoModalVisible] = useState(false);
  const [showFloatingDemo, setShowFloatingDemo] = useState(false);

  // ─── PRICING TOGGLE STATE ────────────────────────────────────────────
  const [billingCycle, setBillingCycle] = useState('quarterly');

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

useEffect(() => {
  if (openDemo) {
    setDemoModalVisible(true);
    // Reset the flag so closing/reopening works smoothly
    if (setOpenDemoOnLanding) {
      setOpenDemoOnLanding(false);
    }
  }
}, [openDemo]);

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
    // 1. Page Title & Canonical URL
    document.title = "Servon |Restaurant Management System & POS Software India";

    const canonical = document.createElement('link');
    canonical.rel = 'canonical';
    canonical.href = 'https://www.servon.cloud/';
    document.head.appendChild(canonical);

    // 2. Google Analytics (gtag.js)
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

    // 3. Essential Meta Tags
    const metaTags = [
      { name: 'description', content: 'Servon is the leading all-in-one restaurant management system and POS software in India. Cloud GST billing, QR ordering, kitchen display (KOT), inventory ERP, and AI profit advisor for cafes, fine dining, and hotels.' },
      { name: 'keywords', content: 'restaurant management system, hotel management system, restaurant POS software, GST billing software for restaurants, hotel billing software, QR ordering system, kitchen order ticket software, KOT app, Servon, cafe management software India' },
      { name: 'robots', content: 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1' },
      
      // Open Graph (Facebook / LinkedIn) & Site Name Override
      { property: 'og:site_name', content: 'Servon' },
      { property: 'og:title', content: 'Servon | The All-in-One Restaurant OS & POS System' },
      { property: 'og:description', content: 'Streamline billing, QR ordering, KOT sync, and net profit tracking. Built specifically for high-growth Indian restaurants and hotels.' },
      { property: 'og:type', content: 'website' },
      { property: 'og:url', content: 'https://www.servon.cloud/' },
      { property: 'og:image', content: 'https://www.servon.cloud/favicon.png' },
      
      // Twitter Cards
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: 'Servon | #1 Restaurant Operating System' },
      { name: 'twitter:description', content: 'Flat-fee POS, QR ordering, and ERP for Indian restaurants.' },
      { name: 'twitter:image', content: 'https://www.servon.cloud/favicon.png' },
    ];

    metaTags.forEach(tag => {
      const meta = document.createElement('meta');
      if (tag.name) meta.name = tag.name;
      if (tag.property) meta.setAttribute('property', tag.property);
      meta.content = tag.content;
      document.head.appendChild(meta);
    });

    // 4. Schema.org JSON-LD Structured Data
    const schemaScript = document.createElement('script');
    schemaScript.type = 'application/ld+json';
    schemaScript.innerHTML = JSON.stringify({
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "WebSite",
          "name": "Servon",
          "alternateName": ["Servon Technologies", "Servon POS", "Servon Labs"],
          "url": "https://www.servon.cloud/"
        },
        {
          "@type": "SoftwareApplication",
          "name": "Servon",
          "operatingSystem": "Web, Android, iOS",
          "applicationCategory": "BusinessApplication",
          "aggregateRating": {
            "@type": "AggregateRating",
            "ratingValue": "4.9",
            "ratingCount": "120"
          },
          "offers": {
            "@type": "Offer",
            "price": "999",
            "priceCurrency": "INR"
          },
          "description": "Premium POS and restaurant management system with GST billing, QR ordering, and live inventory tracking."
        },
        {
          "@type": "Organization",
          "name": "Servon Labs",
          "url": "https://www.servon.cloud",
          "logo": "https://www.servon.cloud/favicon.png",
          "sameAs": [
            "https://www.linkedin.com/company/servon"
          ]
        }
      ]
    });
    document.head.appendChild(schemaScript);

    // 5. Favicon Injection (PNG & ICO Shortcuts)
    const favicon = document.createElement('link');
    favicon.rel = 'icon';
    favicon.type = 'image/png';
    favicon.href = 'https://www.servon.cloud/favicon.png';
    document.head.appendChild(favicon);

    const faviconIco = document.createElement('link');
    faviconIco.rel = 'shortcut icon';
    faviconIco.href = 'https://www.servon.cloud/favicon.ico';
    document.head.appendChild(faviconIco);

    const appleIcon = document.createElement('link');
    appleIcon.rel = 'apple-touch-icon';
    appleIcon.href = 'https://www.servon.cloud/favicon.png';
    document.head.appendChild(appleIcon);

    // 6. "Book a Demo" Modal Scrollbar
    if (!document.getElementById('servon-demo-modal-scrollbar-style')) {
      const modalScrollStyle = document.createElement('style');
      modalScrollStyle.id = 'servon-demo-modal-scrollbar-style';
      modalScrollStyle.innerHTML = `
        #servonDemoModalScroll {
          scrollbar-width: thin;
          scrollbar-color: #C7C2B8 #F1EFE9;
        }
        #servonDemoModalScroll::-webkit-scrollbar {
          width: 8px;
        }
        #servonDemoModalScroll::-webkit-scrollbar-track {
          background: #F1EFE9;
          border-radius: 8px;
        }
        #servonDemoModalScroll::-webkit-scrollbar-thumb {
          background: #C7C2B8;
          border-radius: 8px;
        }
        #servonDemoModalScroll::-webkit-scrollbar-thumb:hover {
          background: #ADA795;
        }
      `;
      document.head.appendChild(modalScrollStyle);
    }
  }
}, []);

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 1000, useNativeDriver: true }).start();
  }, []);

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
          <View style={s.heroGrid} pointerEvents="none" />

          <Animated.View style={{ opacity: fadeAnim, alignItems: 'center', width: '100%', zIndex: 2 }}>

            <View style={s.heroEyebrow}>
              <View style={s.heroEyebrowDotPulse} />
              <Text style={s.heroEyebrowText}>BUILT FOR HIGH-GROWTH INDIAN RESTAURANTS</Text>
            </View>

           <Text style={s.heroH1}>
  Run Your{"\n"}
  Restaurant. <Text style={{ color: C.green }}>We Handle</Text>{"\n"}
  the Chaos.
</Text>

            <Text style={s.heroSub}>
              The premium operating system for high-growth Indian restaurants.
              Deploy QR ordering, manage live kitchen sync, and protect your margins.
            </Text>

            <View style={s.heroBtnGroup}>
              {/* ─── DEMO BUTTON (HERO) — sole primary CTA ─── */}
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
                  <View style={s.demoBtnHeroArrow}>
                    <Ionicons name="arrow-forward" size={14} color="#121417" />
                  </View>
                </LinearGradient>
              </TouchableOpacity>
            </View>

            <View style={s.heroTrustRow}>
              <View style={s.heroTrustItem}>
                <Ionicons name="checkmark-circle" size={14} color={C.green} />
                <Text style={s.heroTrustText}>10-day free trial</Text>
              </View>
              
              <View style={s.heroTrustItem}>
                <Ionicons name="checkmark-circle" size={14} color={C.green} />
                <Text style={s.heroTrustText}>Live in minutes</Text>
              </View>
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

          <FeatureCarousel s={s} width={width} />
        </View>

        {/* VOICE AI SHOWCASE SECTION */}
<View style={s.voiceSectionContainer}>
  <View style={s.voiceSectionInner}>
    
    {/* Left Side: Interactive UI Mockup */}
    <View style={s.voiceMockupCard}>
      <View style={s.voiceBadgeHeader}>
        <Ionicons name="mic" size={16} color={C.green} />
        <Text style={s.voiceBadgeHeaderText}>Voice AI Active</Text>
      </View>

      {/* User Prompt Bubble */}
      <View style={s.userVoiceBubble}>
        <Text style={s.userVoiceText}>"How much profit did we make today?"</Text>
      </View>

      {/* Live Waveform Indicator */}
      <View style={s.waveformCard}>
        <Ionicons name="sparkles" size={18} color={C.green} />
        <View style={s.waveformBars}>
          <View style={[s.bar, { height: 10 }]} />
          <View style={[s.bar, { height: 22 }]} />
          <View style={[s.bar, { height: 32 }]} />
          <View style={[s.bar, { height: 18 }]} />
          <View style={[s.bar, { height: 28 }]} />
          <View style={[s.bar, { height: 12 }]} />
        </View>
        <Text style={s.listeningText}>Listening...</Text>
      </View>

      {/* AI Voice Answer Card */}
      <View style={s.aiVoiceResponseCard}>
        <View style={s.aiResponseHeader}>
          <Ionicons name="volume-medium-outline" size={16} color="#4F46E5" />
          <Text style={s.aiResponseTitle}>Servon</Text>
        </View>
        <Text style={s.aiResponseText}>
          "Today's net profit is ₹14,250-up 18% from yesterday. Paneer Butter Masala was your top margin driver."
        </Text>
      </View>

      {/* Suggested Chips */}
      <View style={s.suggestedPromptsRow}>
        <Text style={s.suggestedLabel}>Try asking:</Text>
       
        <View style={s.promptChip}>
          <Text style={s.chipText}>"Compare this week with last week"</Text>
        </View>
      </View>
    </View>

    {/* Right Side: Section Copy & Features */}
    <View style={s.voiceTextContainer}>
      <SectionTag text="Voice AI " color={C.green} styles={s} align="flex-start" />

      <Text style={s.voiceH2}>
        Speak to your restaurant.{"\n"}
       
      </Text>

      <Text style={s.voiceDesc}>
        When your hands are full during rush hours, just tap and talk. Servon's Voice AI gives you instant, spoken answers about sales on the spot.
      </Text>

      <View style={s.voiceFeatureList}>
        <View style={s.voiceFeatItem}>
          <View style={[s.voiceIconBox, { backgroundColor: "#FCE7F3" }]}>
            <Ionicons name="mic-outline" size={20} color="#DB2777" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.voiceFeatTitle}>Tap & Speak Intelligence</Text>
            <Text style={s.voiceFeatDesc}>
              Instant speech-to-text conversion optimized for Indian restaurant terminology.
            </Text>
          </View>
        </View>

        <View style={s.voiceFeatItem}>
          <View style={[s.voiceIconBox, { backgroundColor: "#E0E7FF" }]}>
            <Ionicons name="volume-high-outline" size={20} color="#4F46E5" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.voiceFeatTitle}>Audio Responses</Text>
            <Text style={s.voiceFeatDesc}>
              Hear clear, actionable business summaries generated by voice synthesis.
            </Text>
          </View>
        </View>

        <View style={s.voiceFeatItem}>
          <View style={[s.voiceIconBox, { backgroundColor: "#DCFCE7" }]}>
            <Ionicons name="flash-outline" size={20} color="#16A34A" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.voiceFeatTitle}>Hands-Free Rush Management</Text>
            <Text style={s.voiceFeatDesc}>
              Check live sales while walking the kitchen floor or managing service.
            </Text>
          </View>
        </View>
      </View>
    </View>

  </View>
</View>


        {/* ── IN-APP REVIEWS ── */}
        <ReviewFeatureSection s={s} />

        {/* ── PRICING ── */}
        <View style={s.priceSection}>
  <View style={s.priceHeaderCenter}>
    <SectionTag text="PRICING" styles={s} />
    <Text style={s.priceTitleMain}>One check. Everything included.</Text>
    <Text style={s.priceSubMain}>
      No add-on tiers to decode, no line items that appear later.
    </Text>

    {/* Billing cycle toggle */}
    <View style={s.cycleToggleWrap}>
      {[
        { id: 'monthly', label: 'Monthly' },
        { id: 'quarterly', label: 'Quarterly', tag: 'Save 37%' },
        { id: 'yearly', label: 'Yearly', tag: 'Save 50%' },
      ].map((opt) => (
        <TouchableOpacity
          key={opt.id}
          onPress={() => setBillingCycle(opt.id)}
          activeOpacity={0.85}
          style={[s.cycleOption, billingCycle === opt.id && s.cycleOptionActive]}
        >
          <Text style={[s.cycleOptionText, billingCycle === opt.id && s.cycleOptionTextActive]}>
            {opt.label}
          </Text>
          {opt.tag && (
            <View style={[s.cycleTag, billingCycle === opt.id && s.cycleTagActive]}>
              <Text style={[s.cycleTagText, billingCycle === opt.id && s.cycleTagTextActive]}>{opt.tag}</Text>
            </View>
          )}
        </TouchableOpacity>
      ))}
    </View>
  </View>

  {/* SINGLE UNIFIED PLAN CARD */}
  {(() => {
    const PLAN_BY_CYCLE = {
      monthly:   { price: "₹999",   period: "/month",   note: "Standard monthly billing" },
      quarterly: { price: "₹2,500", period: "/4 months", note: "Save ~₹1,500 (37% off)" },
      yearly:    { price: "₹6,000", period: "/year",    note: "Save ~₹6,000 (50% off)" },
    };
    const plan = PLAN_BY_CYCLE[billingCycle];
    return (
      <View style={s.singlePlanWrap}>
        <View style={s.singlePlanCard}>
          {/* Top punch holes — receipt motif */}
          <View style={s.billPunchRow}>
            {Array.from({ length: 14 }).map((_, i) => (
              <View key={i} style={s.billPunchHole} />
            ))}
          </View>

          <View style={s.singlePlanHeaderRow}>
            <View>
              <Text style={s.billKicker}>RESTAURANT PREMIUM</Text>
              <Text style={s.singlePlanName}>Pro Plan</Text>
            </View>
            <View style={s.billStamp}>
              <Text style={s.billStampText}>MOST{"\n"}ORDERED</Text>
            </View>
          </View>

          <View style={s.billDivider} />

          <View style={s.billItemList}>
            {[
              "Unlimited QR Menu Scans & Orders",
              "Full Chef Mode™ Financial Privacy",
              "Live Kitchen Dashboard (KOT Sync)",
              "AI Business Advisor & Voice AI",
              "Real-time AI Alerts & Daily Summaries",
              "Smart Offline Mode (Zero Downtime)",
              "Verified In-App Reviews",
              "Inventory & Expense ERP Suite",
              "Export PDF & CSV Reports",
              "24/7 Priority Support",
            ].map((item, idx) => (
              <View key={idx} style={s.billItemRow}>
                <Text style={s.billItemLabel}>{item}</Text>
                <View style={s.billItemLeader} />
                <Ionicons name="checkmark" size={15} color="#10B981" />
              </View>
            ))}
          </View>

          <View style={s.billDividerDashed} />

          <View style={s.singlePlanPriceRow}>
            <View>
              <Text style={s.singlePlanEverythingText}>EVERYTHING, ONE PLAN</Text>
              <Text style={s.singlePlanSavingsText}>{plan.note}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                <Text style={s.singlePlanPrice}>{plan.price}</Text>
                <Text style={s.billPricePeriod}>{plan.period}</Text>
              </View>
            </View>
          </View>

          <TouchableOpacity
            style={s.billCta}
            onPress={() => onNavigate?.("login")}
            activeOpacity={0.88}
          >
            <Text style={s.billCtaText}>Get Started</Text>
            <Ionicons name="arrow-forward" size={16} color="#FFF" />
          </TouchableOpacity>

          <View style={s.trialSubBadge}>
            <Ionicons name="shield-checkmark-outline" size={13} color="#10B981" />
            <Text style={s.trialSubText}>10-day free trial · No credit card required</Text>
          </View>

          {/* Bottom tear line */}
          <View style={s.billTearRow}>
            {Array.from({ length: 26 }).map((_, i) => (
              <View key={i} style={s.billTearTriangle} />
            ))}
          </View>
        </View>
      </View>
    );
  })()}
</View>

 <View style={s.finalCtaSection}>
  {/* Ambient Background Glows */}
  <View style={s.finalCtaGlowTop} />
  <View style={s.finalCtaGlowBottom} />
  <View style={s.finalCtaGridOverlay} />

  {/* Pill Eyebrow */}
  <View style={s.finalCtaBadge}>
    <View style={s.finalCtaBadgeDot} />
    <Text style={s.finalCtaEyebrow}>READY WHEN YOU ARE</Text>
  </View>

  {/* Main Heading & Subtitle */}
  <Text style={s.finalCtaH2}>
    See Servon running{"\n"}
    <Text style={s.finalCtaH2Accent}>on your own menu.</Text>
  </Text>

  <Text style={s.finalCtaSub}>
    Book a 20-minute walkthrough. We'll set it up with your dishes, your tables, and your exact workflow.
  </Text>

  {/* CTA Button */}
  <TouchableOpacity
    activeOpacity={0.88}
    onPress={() => setDemoModalVisible(true)}
    style={s.finalCtaBtnWrap}
  >
    <View style={s.finalCtaBtn}>
      <Ionicons name="calendar" size={18} color="#0F172A" />
      <Text style={s.finalCtaBtnText}>Book a Live Demo</Text>
      <Ionicons name="arrow-forward" size={16} color="#0F172A" />
    </View>
  </TouchableOpacity>

  {/* Trust Signals Footer */}
  <View style={s.ctaTrustRow}>
    <View style={s.ctaTrustItem}>
      <Ionicons name="flash-outline" size={13} color="#10B981" />
      <Text style={s.ctaTrustText}>Instant Setup</Text>
    </View>
    <View style={s.ctaTrustDot} />
    <View style={s.ctaTrustItem}>
      <Ionicons name="shield-checkmark-outline" size={13} color="#10B981" />
      <Text style={s.ctaTrustText}>Zero Commitment</Text>
    </View>
    <View style={s.ctaTrustDot} />
    <View style={s.ctaTrustItem}>
      <Ionicons name="sparkles-outline" size={13} color="#10B981" />
      <Text style={s.ctaTrustText}>100% Free</Text>
    </View>
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
                  <View style={[s.faqIconWrap, activeFaq === i && s.faqIconWrapActive]}>
                    <Ionicons
                      name={activeFaq === i ? "remove" : "add"}
                      size={16}
                      color={activeFaq === i ? "#FFFFFF" : C.charcoal}
                    />
                  </View>
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

        {/* ── FINAL CTA BAND ── */}
      

        {/* ── FOOTER ── */}
      <View style={s.footer}>
  <View style={s.footerTop}>
    <View style={s.fBrand}>
      <Text style={s.fLogo}>
        Servon<Text style={{ color: C.green }}>.</Text>
      </Text>
      <Text style={s.fTag}>
        The infrastructure for the next generation of Indian hospitality. Built for ownership.
      </Text>
    </View>

    <View style={s.fLinksGrid}>
      {/* PRODUCT */}
      <View style={s.fCol}>
        <Text style={s.fH}>PRODUCT</Text>
        {[
          { name: "Features", slug: "Features" },
          { name: "Pricing", slug: "Pricing" },
          { name: "FAQ", slug: "FAQ" },
        ].map((l) => (
          <TouchableOpacity key={l.slug} onPress={() => onNavigate(l.slug)}>
            <Text style={s.fL}>{l.name}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* COMPANY */}
      <View style={s.fCol}>
        <Text style={s.fH}>COMPANY</Text>
        {[
          { name: "About", slug: "About" },
          { name: "Careers", slug: "Careers" },
          { name: "Partner With Us", slug: "Partners" },
          { name: "Contact Us", slug: "Contact" },
        ].map((l) => (
          <TouchableOpacity key={l.slug} onPress={() => onNavigate(l.slug)}>
            <Text style={s.fL}>{l.name}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* LEGAL & COMPLIANCE */}
      <View style={s.fCol}>
        <Text style={s.fH}>LEGAL</Text>
        {[
          { name: "Privacy", slug: "PrivacyPolicy" },
          { name: "Terms", slug: "TermsOfService" },
          { name: "Refund Policy", slug: "RefundPolicy" },
          { name: "Security", slug: "Security" },
        ].map((l) => (
          <TouchableOpacity key={l.slug} onPress={() => onNavigate(l.slug)}>
            <Text style={s.fL}>{l.name}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  </View>

  <View style={s.fDivider} />

  <View style={s.footerBottom}>
    <Text style={s.fCompanyLine}>
      Servon Labs Private Limited • Pune, India
    </Text>
    <Text style={s.copy}>© 2026 Servon . All rights reserved.</Text>
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
              showsVerticalScrollIndicator={true}
              persistentScrollbar={Platform.OS === 'android'}
              nativeID="servonDemoModalScroll"
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

const getDashboardStyles = (width) => {
  const isMobile = width < 600;

  return StyleSheet.create({
    wrapper: {
      width: '100%',
      maxWidth: 940,
      alignSelf: 'center',
      marginTop: isMobile ? 20 : 60,
      backgroundColor: '#FFF',
      borderRadius: isMobile ? 16 : 24,
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
      paddingHorizontal: isMobile ? 12 : 16,
      borderBottomWidth: 1,
      borderBottomColor: '#EDF2F7',
    },
    windowControls: {
      flexDirection: 'row',
      gap: 6,
    },
    wDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
    },
    urlBar: {
      flex: 1,
      height: 26,
      backgroundColor: '#FFF',
      borderRadius: 6,
      marginHorizontal: isMobile ? 10 : 20,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: 6,
      borderWidth: 1,
      borderColor: '#EEE',
      paddingHorizontal: 8,
    },
    urlText: {
      fontSize: 10,
      color: C.muted,
    },
    mainLayout: {
      flexDirection: 'row',
      backgroundColor: '#FFF',
    },
    sideNav: {
      width: isMobile ? 44 : 64,
      backgroundColor: '#F8FAFC',
      borderRightWidth: 1,
      borderRightColor: '#EDF2F7',
      alignItems: 'center',
      paddingTop: 16,
      gap: 16,
    },
    sideLogo: {
      width: isMobile ? 24 : 32,
      height: isMobile ? 24 : 32,
      backgroundColor: C.green,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sideIcon: {
      width: isMobile ? 28 : 36,
      height: isMobile ? 28 : 36,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sideIconActive: {
      backgroundColor: C.greenLight,
    },
    contentPane: {
      flex: 1,
      padding: isMobile ? 12 : 20,
    },
    headerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 14,
    },
    paneTitle: {
      fontSize: isMobile ? 16 : 20,
      fontWeight: '900',
      color: C.charcoal,
    },
    livePulseBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#DEF7EC',
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 12,
      gap: 4,
    },
    pulseDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: C.green,
    },
    liveText: {
      fontSize: 9,
      fontWeight: '800',
      color: C.green,
    },
    datePicker: {
      flexDirection: 'row',
      gap: 6,
      alignItems: 'center',
      backgroundColor: '#F1F5F9',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 8,
    },
    dateText: {
      fontSize: 10,
      fontWeight: '700',
      color: C.muted,
    },
    kpiGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: isMobile ? 8 : 12,
      marginBottom: 14,
    },
    kpiCard: {
      width: isMobile ? '48%' : '23.5%',
      backgroundColor: '#F8FAFC',
      padding: isMobile ? 10 : 14,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: '#E2E8F0',
    },
    kpiLab: {
      fontSize: 10,
      color: C.muted,
      fontWeight: '700',
    },
    kpiVal: {
      fontSize: isMobile ? 15 : 18,
      fontWeight: '900',
      color: C.charcoal,
      marginVertical: 2,
    },
    deltaText: {
      fontSize: 9,
      fontWeight: '700',
    },
    chartSection: {
      backgroundColor: '#F8FAFC',
      padding: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: '#E2E8F0',
      marginBottom: 14,
    },
    chartHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    sectionSubTitle: {
      fontSize: 11,
      fontWeight: '700',
      color: C.charcoal,
    },
    chartPeakLabel: {
      fontSize: 9,
      color: C.muted,
    },
    barChartContainer: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      height: 36,
      gap: 4,
      paddingTop: 4,
    },
    barWrapper: {
      flex: 1,
      height: '100%',
      justifyContent: 'flex-end',
    },
    chartBar: {
      width: '100%',
      borderRadius: 3,
    },
    bottomSection: {
      backgroundColor: '#F8FAFC',
      padding: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: '#E2E8F0',
    },
    bottomHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 10,
    },
    panelTitle: {
      fontSize: isMobile ? 11 : 13,
      fontWeight: '800',
      color: C.charcoal,
    },
    viewAllText: {
      fontSize: 10,
      color: C.green,
      fontWeight: '700',
    },
    orderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 6,
      borderBottomWidth: 1,
      borderBottomColor: '#EDF2F7',
    },
    tableBadge: {
      backgroundColor: '#E2E8F0',
      paddingHorizontal: 6,
      paddingVertical: 3,
      borderRadius: 6,
    },
    tableText: {
      fontSize: 10,
      fontWeight: '900',
      color: C.charcoal,
    },
    itemText: {
      fontSize: isMobile ? 11 : 12,
      color: C.charcoal,
      fontWeight: '600',
    },
    timeText: {
      fontSize: 9,
      color: C.muted,
    },
    statusBadge: {
      paddingHorizontal: 6,
      paddingVertical: 3,
      borderRadius: 6,
      borderWidth: 1,
    },
    statusText: {
      fontSize: 9,
      fontWeight: '900',
    },
  });
};

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
    paddingHorizontal: width > 600 ? 14 : 22,
    paddingLeft: width > 600 ? 34 : 22,
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
    fontSize: width > 600 ? 17 : 14,
  },
  demoBtnHeroArrow: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
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
    paddingRight: 6,
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

  // Paste these styles inside getMainStyles = (width) => ({ ... })

voiceSectionContainer: {
  width: "100%",
  backgroundColor: C.bg,
  paddingVertical: width > 768 ? 90 : 50,
  paddingHorizontal: width > 768 ? 40 : 20,
  alignItems: "center",
},
voiceSectionInner: {
  maxWidth: 1200,
  width: "100%",
  flexDirection: width > 900 ? "row" : "column-reverse",
  gap: width > 900 ? 60 : 40,
  alignItems: "center",
},

// Visual Mockup Card Styles (Left Side)
voiceMockupCard: {
  flex: width > 900 ? 1 : undefined,
  width: "100%",
  backgroundColor: "#FFFFFF",
  borderRadius: 24,
  padding: 24,
  borderWidth: 1,
  borderColor: C.border,
  boxShadow: "0px 12px 32px rgba(0, 0, 0, 0.05)",
  gap: 16,
},
voiceBadgeHeader: {
  flexDirection: "row",
  alignItems: "center",
  gap: 8,
  alignSelf: "flex-start",
  backgroundColor: C.greenLight,
  paddingHorizontal: 12,
  paddingVertical: 6,
  borderRadius: 20,
},
voiceBadgeHeaderText: {
  fontSize: 12,
  fontWeight: "700",
  color: C.green,
},
userVoiceBubble: {
  alignSelf: "flex-end",
  backgroundColor: C.charcoal,
  paddingHorizontal: 16,
  paddingVertical: 10,
  borderRadius: 16,
  borderBottomRightRadius: 4,
  maxWidth: "85%",
},
userVoiceText: {
  color: "#FFFFFF",
  fontSize: 14,
  fontWeight: "500",
},
waveformCard: {
  flexDirection: "row",
  alignItems: "center",
  backgroundColor: C.bg,
  paddingHorizontal: 16,
  paddingVertical: 12,
  borderRadius: 14,
  gap: 12,
  borderWidth: 1,
  borderColor: C.border,
},
waveformBars: {
  flexDirection: "row",
  alignItems: "center",
  gap: 4,
  height: 36,
},
bar: {
  width: 4,
  backgroundColor: C.green,
  borderRadius: 2,
},
listeningText: {
  fontSize: 13,
  fontWeight: "600",
  color: C.muted,
  marginLeft: "auto",
},
aiVoiceResponseCard: {
  backgroundColor: "#F8FAFC",
  borderRadius: 16,
  padding: 16,
  borderWidth: 1,
  borderColor: "#E2E8F0",
  gap: 8,
},
aiResponseHeader: {
  flexDirection: "row",
  alignItems: "center",
  gap: 6,
},
aiResponseTitle: {
  fontSize: 13,
  fontWeight: "700",
  color: "#4F46E5",
},
aiResponseText: {
  fontSize: 14,
  color: C.charcoal,
  lineHeight: 20,
},
suggestedPromptsRow: {
  gap: 8,
  marginTop: 4,
},
suggestedLabel: {
  fontSize: 12,
  fontWeight: "600",
  color: C.muted,
},
promptChip: {
  backgroundColor: C.bg,
  paddingHorizontal: 12,
  paddingVertical: 8,
  borderRadius: 20,
  borderWidth: 1,
  borderColor: C.border,
  alignSelf: "flex-start",
},
chipText: {
  fontSize: 12,
  color: C.charcoal,
},

// Right Side Copy Styles
voiceTextContainer: {
  flex: width > 900 ? 1 : undefined,
  width: "100%",
  gap: 16,
},
voiceH2: {
  fontSize: width > 768 ? 36 : 28,
  fontWeight: "800",
  color: C.charcoal,
  lineHeight: width > 768 ? 44 : 34,
},
voiceDesc: {
  fontSize: 16,
  color: C.muted,
  lineHeight: 24,
},
voiceFeatureList: {
  gap: 16,
  marginTop: 8,
},
voiceFeatItem: {
  flexDirection: "row",
  alignItems: "flex-start",
  gap: 14,
},
voiceIconBox: {
  width: 42,
  height: 42,
  borderRadius: 12,
  justifyContent: "center",
  alignItems: "center",
},
voiceFeatTitle: {
  fontSize: 15,
  fontWeight: "700",
  color: C.charcoal,
  marginBottom: 2,
},
voiceFeatDesc: {
  fontSize: 13,
  color: C.muted,
  lineHeight: 18,
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
  heroGrid: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 420,
    backgroundImage: Platform.OS === 'web'
      ? 'linear-gradient(rgba(18,20,23,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(18,20,23,0.035) 1px, transparent 1px)'
      : undefined,
    backgroundSize: '42px 42px',
  },
  heroEyebrow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 26,
    gap: 9,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 10,
  },
  heroEyebrowDotPulse: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: C.green,
  },
  heroEyebrowText: { fontSize: 11, fontWeight: '800', color: C.muted, letterSpacing: 1.2 },
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
  heroBtnGroup: { marginBottom: 22, alignItems: 'center' },
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
  heroTrustRow: {
    flexDirection: width > 500 ? 'row' : 'column',
    alignItems: 'center',
    gap: width > 500 ? 16 : 8,
    marginBottom: 8,
  },
  heroTrustItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  heroTrustText: { fontSize: 13, fontWeight: '600', color: C.muted },
  heroTrustDivider: {
    width: width > 500 ? 1 : 0,
    height: width > 500 ? 12 : 0,
    backgroundColor: '#D8D5CB',
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
    position: 'relative',
  },
  darkFeatArrowWrap: {
    position: 'absolute',
    top: width > 600 ? 30 : 20,
    right: width > 600 ? 30 : 20,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
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

  // ── FEATURE SLIDER (one big feature at a time) ──
  featureCarouselWrap: {
    width: '100%',
    maxWidth: 1200,
    alignSelf: 'center',
    position: 'relative',
    zIndex: 2,
  },
  featureSlidePad: {
    paddingHorizontal: width > 600 ? 4 : 0,
  },
  featureSlideCard: {
    minHeight: width > 900 ? 440 : width > 600 ? 480 : 560,
    flexDirection: width > 900 ? 'row' : 'column',
    alignItems: 'stretch',
    backgroundColor: 'rgba(255,255,255,0.035)',
    borderRadius: width > 600 ? 32 : 22,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: width > 900 ? 56 : width > 600 ? 40 : 26,
    gap: width > 900 ? 40 : 28,
  },
  featureSlideContentCol: {
    flex: width > 900 ? 1.15 : undefined,
    justifyContent: 'center',
  },
  featureSlideEyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 22,
  },
  featureSlideCount: {
    fontFamily: MONO,
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 1,
  },
  featureSlideTagPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  featureSlideTagDot: { width: 5, height: 5, borderRadius: 2.5 },
  featureSlideTagText: { fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  featureSlideTitle: {
    fontSize: width > 900 ? 40 : width > 600 ? 32 : 26,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -1,
    lineHeight: width > 900 ? 46 : width > 600 ? 38 : 32,
    marginBottom: 18,
  },
  featureSlideDesc: {
    fontSize: width > 600 ? 16 : 14,
    color: '#94A3B8',
    lineHeight: width > 600 ? 26 : 22,
    maxWidth: 480,
  },
  featureSlideIncludedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 28,
  },
  featureSlideIncludedText: {
    fontSize: 13,
    fontWeight: '700',
  },
  featureSlideVisualCol: {
    flex: width > 900 ? 1 : undefined,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureSlideVisualPanel: {
    width: '100%',
    maxWidth: width > 900 ? 340 : 300,
    aspectRatio: 1,
    borderRadius: 28,
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.02)',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  featureSlideRing1: {
    position: 'absolute',
    width: '78%',
    height: '78%',
    borderRadius: 999,
    borderWidth: 1,
  },
  featureSlideRing2: {
    position: 'absolute',
    width: '58%',
    height: '58%',
    borderRadius: 999,
    borderWidth: 1,
  },
  featureSlideIconBig: {
    width: width > 900 ? 108 : 88,
    height: width > 900 ? 108 : 88,
    borderRadius: width > 900 ? 32 : 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureArrow: {
    position: 'absolute',
    top: '50%',
    marginTop: -22,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 5,
  },
  featureArrowLeft: { left: width > 900 ? -22 : 6 },
  featureArrowRight: { right: width > 900 ? -22 : 6 },
  featureArrowDisabled: { opacity: 0.35 },
  featureDotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 28,
  },
  featureMiniArrow: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 6,
  },
  featureDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  featureDotActive: {
    width: 22,
    backgroundColor: '#FFFFFF',
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

  // ── IN-APP REVIEWS SECTION (receipt / printer motif) ──
  reviewFeatureSection: {
    paddingVertical: width > 600 ? 110 : 64,
    paddingHorizontal: width > 600 ? 30 : 18,
    backgroundColor: '#FAFAFA', // Subtle contrast against white background
  },
  reviewFeatureInner: {
    maxWidth: 1200,
    alignSelf: 'center',
    width: '100%',
    flexDirection: width > 900 ? 'row' : 'column',
    alignItems: width > 900 ? 'center' : 'stretch',
    gap: width > 900 ? 60 : 48,
  },
  reviewFeatureTextCol: { flex: width > 900 ? 1 : undefined },
  reviewFeatureVisualCol: {
    flex: width > 900 ? 1 : undefined,
    alignItems: width > 900 ? 'center' : 'center',
    justifyContent: 'center',
    width: '100%',
  },
  reviewFeatureH2: {
    fontSize: width > 800 ? 42 : width > 400 ? 30 : 26,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: -1.2,
    lineHeight: width > 800 ? 50 : width > 400 ? 38 : 32,
    marginTop: 18,
    marginBottom: 18,
  },
  reviewFeatureSub: {
    fontSize: width > 600 ? 16 : 14,
    color: '#475569',
    lineHeight: width > 600 ? 26 : 22,
    marginBottom: 36,
    maxWidth: 480,
    textAlign: 'left',
  },

  // Steps container
  receiptStepsList: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    padding: width > 600 ? 28 : 20,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 12,
    elevation: 2,
  },
  receiptStepRow: { 
    flexDirection: 'row', 
    gap: 16, 
    alignItems: 'flex-start' 
  },
  stepBadge: {
    backgroundColor: '#E6F4EA',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  receiptStepMark: {
    fontFamily: MONO,
    fontSize: 11,
    fontWeight: '800',
    color: '#008060',
    letterSpacing: 1,
  },
  receiptStepTitle: { 
    fontSize: width > 600 ? 16 : 15, 
    fontWeight: '800', 
    color: '#0F172A', 
    marginBottom: 4 
  },
  receiptStepDesc: { 
    fontSize: width > 600 ? 14 : 13, 
    color: '#64748B', 
    lineHeight: 21, 
    fontWeight: '400' 
  },
  receiptStepDivider: {
    height: 1,
    borderTopWidth: 1,
    borderTopColor: '#CBD5E1',
    borderStyle: 'dashed',
    marginVertical: 22,
  },

  // Receipt printer mockup
  receiptMockWrap: { 
    alignItems: 'center', 
    width: '100%', 
    maxWidth: 320,
  },
  printerBar: {
    width: '92%',
    height: 30,
    backgroundColor: '#0F172A',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#1E293B',
    borderBottomWidth: 0,
  },
  printerSlot: {
    width: '55%',
    height: 4,
    borderRadius: 2,
    backgroundColor: '#334155',
  },
  receiptPaper: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: '#E2E8F0',
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 28,
    shadowColor: '#0F172A',
    shadowOpacity: 0.08,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  receiptStoreName: {
    fontFamily: MONO,
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
    letterSpacing: 1.2,
  },
  receiptMeta: {
    fontFamily: MONO,
    fontSize: 11,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 4,
    fontWeight: '500',
  },
  receiptDivider: {
    borderTopWidth: 1,
    borderTopColor: '#CBD5E1',
    borderStyle: 'dashed',
    marginVertical: 16,
  },
  receiptLineRow: { 
    flexDirection: 'row', 
    alignItems: 'flex-end', 
    marginBottom: 8 
  },
  receiptLineLabel: { 
    fontFamily: MONO, 
    fontSize: 12, 
    color: '#334155', 
    fontWeight: '600' 
  },
  receiptLineLeader: {
    flex: 1,
    height: 0,
    borderBottomWidth: 1,
    borderBottomColor: '#CBD5E1',
    borderStyle: 'dotted',
    marginHorizontal: 8,
    marginBottom: 4,
  },
  receiptLineValue: { 
    fontFamily: MONO, 
    fontSize: 12, 
    color: '#0F172A', 
    fontWeight: '700' 
  },
  receiptTotalLabel: { 
    fontFamily: MONO, 
    fontSize: 12, 
    color: '#0F172A', 
    fontWeight: '900', 
    letterSpacing: 1 
  },
  receiptTotalValue: { 
    fontFamily: MONO, 
    fontSize: 14, 
    color: '#008060', 
    fontWeight: '900' 
  },
  receiptQRSection: { 
    alignItems: 'center', 
    marginTop: 20 
  },
  qrGrid: {
    width: 96,
    height: 96,
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 6,
    borderRadius: 8,
  },
  qrCell: {
    width: `${100 / QR_GRID_SIZE}%`,
    height: `${100 / QR_GRID_SIZE}%`,
  },
  qrCellFilled: { backgroundColor: '#0F172A' },
  receiptScanLabel: {
    fontFamily: MONO,
    fontSize: 10,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: 1.5,
    marginTop: 12,
  },
  receiptStarRow: { 
    flexDirection: 'row', 
    gap: 4, 
    marginTop: 8 
  },
  receiptTearRow: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-between',
    marginTop: -1,
  },
  receiptTearTooth: {
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderTopWidth: 10,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#FFFFFF',
  },

  // ── PRICING SECTION (single receipt / bill-style plan card) ──
priceSection: {
    paddingTop: width > 600 ? 160 : 120, // 👈 Increased to 160 to clear top navbar
    paddingBottom: width > 600 ? 100 : 64,
    paddingHorizontal: 16,
    alignItems: 'center',
    width: '100%',
    backgroundColor: '#FAFAF8',
  },
  priceHeaderCenter: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 36,
    width: '100%',
  },
  priceTitleMain: {
    fontSize: width > 600 ? 38 : 28,
    fontWeight: '900',
    color: '#0F172A',
    textAlign: 'center',
    marginTop: 12,
    lineHeight: width > 600 ? 46 : 34,
    letterSpacing: -1.2,
    maxWidth: 520,
    fontFamily: Platform.OS === 'web' ? 'Inter, system-ui, sans-serif' : undefined,
  },
  priceSubMain: {
    fontSize: 15,
    fontWeight: '500',
    color: '#64748B',
    textAlign: 'center',
    marginTop: 10,
    maxWidth: 480,
    lineHeight: 22,
    marginBottom: 30,
  },
  cycleToggleWrap: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 100,
    padding: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
  },
  cycleOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: width > 500 ? 20 : 14,
    paddingVertical: 8,
    borderRadius: 100,
  },
  cycleOptionActive: {
    backgroundColor: '#0F172A',
  },
  cycleOptionText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
  },
  cycleOptionTextActive: {
    color: '#FFFFFF',
  },
  cycleTag: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  cycleTagActive: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  cycleTagText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#15803D',
  },
  cycleTagTextActive: {
    color: '#86EFAC',
  },

  singlePlanWrap: {
    width: '100%',
    maxWidth: 460,
    alignItems: 'center',
  },
  singlePlanCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingTop: 24,
    paddingHorizontal: 28,
    paddingBottom: 48,       // 👈 Increased from 40 to 48
    borderWidth: 1,
    borderColor: '#E2E8F0',
    position: 'relative',
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.05,
    shadowRadius: 24,
    elevation: 4,
  },
  billPunchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingHorizontal: 2,
  },
  billPunchHole: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#F1F5F9',
  },
  singlePlanHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  billKicker: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.5,
    color: '#64748B',
    textTransform: 'uppercase',
  },
  singlePlanName: {
    fontSize: 28,
    fontWeight: '900',
    color: '#0F172A',
    marginTop: 4,
    letterSpacing: -0.8,
  },
  billStamp: {
    borderWidth: 1.5,
    borderColor: '#D97706',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    transform: [{ rotate: '-6deg' }],
    backgroundColor: '#FFFBEB',
  },
  billStampText: {
    fontSize: 8.5,
    fontWeight: '900',
    color: '#B45309',
    textAlign: 'center',
    lineHeight: 10,
    letterSpacing: 0.5,
  },
  billDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 12,
  },
  billItemList: {
    gap: 12,
    marginVertical: 6,
  },
  billItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justify: 'space-between',
  },
  billItemLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
    letterSpacing: -0.2,
  },
  billItemLeader: {
    flex: 1,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    borderStyle: 'dashed',
    marginHorizontal: 8,
  },
  billDividerDashed: {
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    borderStyle: 'dashed',
    marginVertical: 16,
  },
  singlePlanPriceRow: {
    flexDirection: 'row',
    justify: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 16,
  },
  singlePlanEverythingText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#059669',
    letterSpacing: 1.2,
  },
  singlePlanSavingsText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 3,
  },
  singlePlanPrice: {
    fontSize: 32,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: -1,
  },
  billPricePeriod: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
    marginLeft: 3,
  },
  billCta: {
    backgroundColor: '#0F172A',
    flexDirection: 'row',
    alignItems: 'center',
    justify: 'center',
    paddingVertical: 15,
    borderRadius: 12,
    gap: 8,
    marginTop: 4,
  },
  billCtaText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 15,
  },
  trialSubBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justify: 'center',
    gap: 6,
    marginTop: 14,
    marginBottom: 20,       // 👈 Increased from 8 to 20 so text sits clear above tear line
  },
  trialSubText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  billTearRow: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justify: 'space-around',
    overflow: 'hidden',
  },
  billTearTriangle: {
    width: 0,
    height: 0,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderBottomWidth: 5,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: '#FAFAF8',
  },
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
  faqItemActive: { borderColor: C.charcoal },
  faqQuestionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  faqIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  faqIconWrapActive: {
    backgroundColor: C.charcoal,
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

  // ── FINAL CTA BAND ──
 finalCtaSection: {
    marginHorizontal: width > 600 ? 30 : 16,
    marginBottom: width > 600 ? 60 : 32,
    backgroundColor: '#0F172A', // Deep modern slate charcoal
    borderRadius: 32,
    paddingVertical: width > 600 ? 80 : 54,
    paddingHorizontal: 24,
    alignItems: 'center',
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.12,
    shadowRadius: 32,
    elevation: 8,
  },
  finalCtaGlowTop: {
    position: 'absolute',
    top: -180,
    alignSelf: 'center',
    width: 500,
    height: 350,
    borderRadius: 250,
    backgroundColor: '#10B981',
    opacity: 0.18,
  },
  finalCtaGlowBottom: {
    position: 'absolute',
    bottom: -150,
    right: -100,
    width: 350,
    height: 350,
    borderRadius: 175,
    backgroundColor: '#059669',
    opacity: 0.12,
  },
  finalCtaGridOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
    opacity: 0.03,
  },
  finalCtaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.25)',
    marginBottom: 22,
    zIndex: 2,
  },
  finalCtaBadgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#34D399',
  },
  finalCtaEyebrow: {
    fontSize: 11,
    fontWeight: '800',
    color: '#34D399',
    letterSpacing: 1.5,
    zIndex: 2,
  },
  finalCtaH2: {
    fontSize: width > 600 ? 42 : 28,
    fontWeight: '900',
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: width > 600 ? 50 : 36,
    letterSpacing: -1.2,
    marginBottom: 16,
    zIndex: 2,
  },
  finalCtaH2Accent: {
    color: '#34D399',
  },
  finalCtaSub: {
    fontSize: width > 600 ? 16 : 14,
    fontWeight: '500',
    color: '#94A3B8',
    textAlign: 'center',
    maxWidth: 500,
    lineHeight: 24,
    marginBottom: 36,
    zIndex: 2,
  },
  finalCtaBtnWrap: {
    zIndex: 2,
  },
  finalCtaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 32,
    paddingVertical: 18,
    borderRadius: 100,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 4,
  },
  finalCtaBtnText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.2,
  },
  ctaTrustRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justify: 'center',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 28,
    zIndex: 2,
  },
  ctaTrustItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  ctaTrustText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#CBD5E1',
  },
  ctaTrustDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: '#475569',
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
  },
  tagDot: { width: 6, height: 6, borderRadius: 3 },
  tagText: { fontSize: 11, fontWeight: '900', letterSpacing: 2 },
});