import { useState, useEffect, useRef } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Alert, ActivityIndicator, Image,
  Platform, Switch, useWindowDimensions,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import * as ImagePicker from "expo-image-picker";
import * as WebBrowser from "expo-web-browser";
import {
  getProfile, updateProfile, getSubscriptionDetails,
  createPaymentOrder, verifyPayment, setAdminPin, uploadLogo
} from "../api";
import { useAuth } from "../context/AuthContext";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import ChefPinModal from "../components/ChefPinModal";

// ─── Design tokens ────────────────────────────────────────────────────────────
const IS_WEB    = Platform.OS === "web";
const H_PAD     = IS_WEB ? 0 : 20;
const GREEN     = "#10B981";
const BG        = "#FAF8F5";
const CARD      = "#FFFFFF";
const BORDER    = "#EDE9E3";
const T_PRIMARY = "#1A1410";
const T_MUTED   = "#6B6560";
const T_FAINT   = "#A8A29E";
const ACCENT    = "#10B981";
const SIDEBAR_W = 260;

// ─── Load Razorpay JS SDK on web once ────────────────────────────────────────
function loadRazorpayScript() {
  return new Promise((resolve) => {
    if (document.getElementById("razorpay-sdk")) return resolve(true);
    const script = document.createElement("script");
    script.id = "razorpay-sdk";
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload  = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export default function ProfileScreen({ onNavigate }) {
  const { logout, business, updateBusiness, isChefMode, setIsChefMode } = useAuth();
  const navigation = useNavigation();
  const { width: screenWidth } = useWindowDimensions();

  const isSmallWeb  = IS_WEB && screenWidth < 600;
  const isMediumWeb = IS_WEB && screenWidth >= 600 && screenWidth < 900;

  const [profile, setProfile]             = useState(null);
  const [loading, setLoading]             = useState(true);
  const [saving, setSaving]               = useState(false);
  const [form, setForm]                   = useState({});
  const [hasChanges, setHasChanges]       = useState(false);
  const [subDetails, setSubDetails]       = useState(null);
  const [paying, setPaying]               = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const [newPin, setNewPin]               = useState("");
  const [savingPin, setSavingPin]         = useState(false);
  const [showPinModal, setShowPinModal]   = useState(false);
  const [isUpdatingPin, setIsUpdatingPin] = useState(false);
  const [activeSection, setActiveSection] = useState("subscription");
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);
  const [showSuccessModal, setShowSuccessModal]   = useState(false);

  const pollingRef = useRef(null);

  useEffect(() => {
    loadData();
    return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
  }, []);

  const loadData = async () => {
    try {
      const [profileRes, subRes] = await Promise.all([
        getProfile(),
        getSubscriptionDetails(),
      ]);
      setProfile(profileRes.data);
      setForm({ ...profileRes.data });
      setSubDetails(subRes.data);
      return subRes.data;
    } catch (err) {
      console.log("Load error:", err?.message);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const setField = (k, v) => {
    setForm((p) => ({ ...p, [k]: v }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await updateProfile({
        businessName:   form.business_name,
        ownerName:      form.owner_name,
        phone:          form.phone,
        description:    form.description,
        address:        form.address,
        city:           form.city,
        state:          form.state,
        pincode:        form.pincode,
        gstNumber:      form.gst_number,
        cgstPercentage: form.cgst_percentage,
        sgstPercentage: form.sgst_percentage,
      });
      setProfile(res.data);
      setForm({ ...res.data });
      await updateBusiness(res.data);
      setHasChanges(false);
      Alert.alert("Saved!", "Your profile has been updated.");
    } catch (err) {
      Alert.alert("Error", err.response?.data?.error || "Update failed");
    } finally {
      setSaving(false);
    }
  };

  const handleDiscard = () => {
    setForm({ ...profile });
    setHasChanges(false);
  };

  const handleLogoPress = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission required", "Please allow photo library access to upload a logo.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    const formData = new FormData();
    formData.append("logo", { uri: asset.uri, name: "logo.jpg", type: "image/jpeg" });
    setLogoUploading(true);
    try {
      const res = await uploadLogo(formData);
      const updated = { ...profile, logo_url: res.data.logo_url };
      setProfile(updated);
      setForm(updated);
      await updateBusiness(updated);
      Alert.alert("Success", "Logo updated!");
    } catch (err) {
      Alert.alert("Error", err.response?.data?.error || "Logo upload failed");
    } finally {
      setLogoUploading(false);
    }
  };

  const handleLogout = () => {
    if (Platform.OS === "web") {
      if (window.confirm("Are you sure you want to logout?")) logout();
    } else {
      Alert.alert("Logout", "Are you sure you want to logout?", [
        { text: "Cancel", style: "cancel" },
        { text: "Logout", style: "destructive", onPress: logout },
      ]);
    }
  };

  // ─── PAYMENT ─────────────────────────────────────────────────────────────────
  const handleRenew = async () => {
    try {
      setPaying(true);
      const orderRes = await createPaymentOrder();
      const { orderId, key, amount, currency } = orderRes.data;

      // ── WEB: Razorpay JS SDK opens its own native popup directly ─────────────
      if (IS_WEB) {
        const loaded = await loadRazorpayScript();
        if (!loaded || !window.Razorpay) {
          Alert.alert("Error", "Could not load payment gateway. Check your connection.");
          setPaying(false);
          return;
        }

        const rzp = new window.Razorpay({
          key,
          order_id: orderId,
          amount: String(amount),
          currency,
          name: "Servon",
          description: "Servon Monthly Subscription",
          theme: { color: "#1A1410" },
          modal: {
            ondismiss: () => setPaying(false),
          },
          handler: async (response) => {
            try {
              await verifyPayment({
                razorpay_order_id:   response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature:  response.razorpay_signature,
              });
              await loadData();
              setShowSuccessModal(true);
            } catch {
              Alert.alert("Verification Error", "Payment received but verification failed. Please contact support.");
            } finally {
              setPaying(false);
            }
          },
        });

        rzp.on("payment.failed", () => {
          Alert.alert("Payment Failed", "Please try again.");
          setPaying(false);
        });

        rzp.open();
        return;
      }

      // ── ANDROID / iOS (Expo Go): in-app browser + poll backend ───────────────
      const checkoutUrl = `${process.env.EXPO_PUBLIC_API_URL}/api/subscription/checkout/${orderId}`;

      await WebBrowser.openBrowserAsync(checkoutUrl, {
        toolbarColor: "#1A1410",
        showTitle: false,
        enableBarCollapsing: false,
        presentationStyle: WebBrowser.WebBrowserPresentationStyle.FORM_SHEET,
      });

      // Browser closed — poll backend every 2s up to 30s
      let attempts = 0;
      pollingRef.current = setInterval(async () => {
        attempts++;
        try {
          const sub = await getSubscriptionDetails();
          if (sub.data?.subscription_status === "ACTIVE") {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
            await loadData();
            setShowSuccessModal(true);
            setPaying(false);
          } else if (attempts >= 15) {
            // 30s elapsed, user probably didn't pay — just reset quietly
            clearInterval(pollingRef.current);
            pollingRef.current = null;
            setPaying(false);
          }
        } catch {
          clearInterval(pollingRef.current);
          pollingRef.current = null;
          setPaying(false);
        }
      }, 2000);

    } catch (err) {
      Alert.alert("Error", "Unable to start payment. Please try again.");
      setPaying(false);
    }
  };

  const handleSetPin = async () => {
    if (newPin.length !== 4) return Alert.alert("Invalid", "PIN must be exactly 4 digits");
    setSavingPin(true);
    try {
      await setAdminPin(newPin);
      setProfile((prev) => ({ ...prev, admin_pin: newPin }));
      setNewPin("");
      setIsUpdatingPin(false);
      Alert.alert("Success", "Security PIN updated successfully!");
    } catch {
      Alert.alert("Error", "Failed to update PIN");
    } finally {
      setSavingPin(false);
    }
  };

  const toggleChefMode = () => {
    if (isChefMode) {
      setShowPinModal(true);
    } else {
      if (!profile?.admin_pin) {
        return Alert.alert("Hold on!", "You must set an Admin PIN below before turning on Chef Mode.");
      }
      if (Platform.OS === "web") {
        if (window.confirm("Entering Chef Mode will hide revenue and billing. Continue?")) {
          setIsChefMode(true);
          navigation.navigate("Dashboard");
        }
      } else {
        Alert.alert(
          "Enter Chef Mode?",
          "The app will hide all revenue, analytics, and billing until unlocked with your PIN.",
          [
            { text: "Cancel", style: "cancel" },
            { text: "Open", onPress: () => { setIsChefMode(true); navigation.navigate("Dashboard"); } },
          ]
        );
      }
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: BG }}>
        <ActivityIndicator size="large" color={GREEN} />
      </View>
    );
  }

  const statusColorMap = { ACTIVE: "#059669", INACTIVE: "#DC2626", EXPIRED: "#DC2626" };
  const statusBgMap    = { ACTIVE: "#ECFDF5", INACTIVE: "#FEF2F2", EXPIRED: "#FEF2F2" };
  const subStatus = subDetails?.subscription_status || business?.subscription_status;
  const endDate   = subDetails?.subscription_end_date;
  const daysLeft  = endDate ? Math.ceil((new Date(endDate) - new Date()) / (1000 * 60 * 60 * 24)) : null;

  const billingFields = [
    { key: "gst_number",      label: "GSTIN Number", placeholder: "Enter GSTIN (optional)", autoCapitalize: "characters" },
    { key: "cgst_percentage", label: "CGST %",        placeholder: "e.g. 9", keyboardType: "numeric" },
    { key: "sgst_percentage", label: "SGST %",        placeholder: "e.g. 9", keyboardType: "numeric" },
  ];

  const basicFields = [
    { key: "business_name", label: "Business Name", placeholder: "e.g. Spice Garden" },
    { key: "owner_name",    label: "Owner Name",    placeholder: "Your full name" },
    { key: "phone",         label: "Phone",         placeholder: "10-digit number", keyboardType: "phone-pad" },
    { key: "email",         label: "Email",         placeholder: "-", editable: false },
    { key: "description",   label: "Description",   placeholder: "Short description", multiline: true },
    { key: "address",       label: "Address",       placeholder: "Street address", multiline: true },
    { key: "city",          label: "City",          placeholder: "e.g. Mumbai" },
    { key: "state",         label: "State",         placeholder: "e.g. Maharashtra" },
    { key: "pincode",       label: "Pincode",       placeholder: "6-digit pincode", keyboardType: "number-pad" },
  ];

  const renderField = ({ key, label, placeholder, editable = true, keyboardType = "default", multiline = false, autoCapitalize = "none" }) => (
    <View key={key} style={styles.fieldRow}>
      <View style={styles.fieldLabelRow}>
        <Text style={styles.fieldLabel}>{label}</Text>
        {!editable && (
          <View style={styles.lockedTag}>
            <Ionicons name="lock-closed" size={9} color={T_FAINT} />
            <Text style={styles.lockedTagText}>locked</Text>
          </View>
        )}
      </View>
      <View style={[styles.inputWrapper, !editable && styles.inputWrapperLocked]}>
        <TextInput
          style={[styles.textInput, multiline && styles.textInputMultiline, !editable && styles.textInputLocked]}
          value={String(form[key] ?? "")}
          onChangeText={(v) => editable && setField(key, v)}
          editable={editable}
          keyboardType={keyboardType}
          multiline={multiline}
          placeholder={placeholder}
          placeholderTextColor="#C4C4C4"
          autoCapitalize={autoCapitalize}
        />
        {editable && <Ionicons name="pencil-outline" size={13} color={T_FAINT} style={{ marginLeft: 6 }} />}
      </View>
    </View>
  );

  const webNavItems = [
    { id: "subscription", label: "Subscription",     icon: "flash-outline" },
    { id: "billing",      label: "Billing & Taxes",  icon: "receipt-outline" },
    { id: "details",      label: "Business Details", icon: "storefront-outline" },
    { id: "security",     label: "Security",         icon: "shield-outline" },
  ];

  // ─── SUCCESS MODAL ────────────────────────────────────────────────────────────
  const SuccessModal = () => (
    <View style={styles.successOverlay}>
      <View style={styles.successCard}>
        <View style={styles.successIconWrap}>
          <Ionicons name="checkmark-circle" size={64} color={GREEN} />
        </View>
        <Text style={styles.successTitle}>You're All Set!</Text>
        <Text style={styles.successSub}>
          Payment received. Your Servon subscription is now active for the next 30 days.
        </Text>
        <View style={styles.successDivider} />
        <TouchableOpacity style={styles.successBtn} onPress={() => setShowSuccessModal(false)} activeOpacity={0.85}>
          <Ionicons name="arrow-forward" size={16} color="#fff" />
          <Text style={styles.successBtnText}>Continue to Dashboard</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  // ─── WEB LAYOUT ───────────────────────────────────────────────────────────────
  if (IS_WEB) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.webTopNav}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            {isSmallWeb && (
              <TouchableOpacity onPress={() => setShowMobileSidebar(!showMobileSidebar)} style={styles.hamburgerBtn}>
                <Ionicons name={showMobileSidebar ? "close" : "menu"} size={22} color={T_PRIMARY} />
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
              <Ionicons name="chevron-back" size={18} color={T_PRIMARY} />
              <Text style={styles.backText}>Dashboard</Text>
            </TouchableOpacity>
          </View>
          {hasChanges && (
            <View style={styles.unsavedPill}>
              <View style={styles.unsavedDot} />
              <Text style={styles.unsavedPillText}>{isSmallWeb ? "Unsaved" : "Unsaved changes"}</Text>
            </View>
          )}
        </View>

        <View style={styles.webLayout}>
          {(!isSmallWeb || showMobileSidebar) && (
            <>
              {isSmallWeb && (
                <TouchableOpacity style={styles.sidebarOverlay} activeOpacity={1} onPress={() => setShowMobileSidebar(false)} />
              )}
              <View style={[styles.webSidebar, isSmallWeb && styles.webSidebarOverlay, isMediumWeb && { width: 200 }]}>
                <View style={styles.sidebarProfileCard}>
                  <TouchableOpacity onPress={handleLogoPress} activeOpacity={0.85} style={styles.sidebarLogoWrap}>
                    {logoUploading ? (
                      <View style={[styles.sidebarLogo, styles.logoPlaceholder]}><ActivityIndicator color="#fff" /></View>
                    ) : profile?.logo_url ? (
                      <Image source={{ uri: profile.logo_url }} style={styles.sidebarLogo} />
                    ) : (
                      <View style={[styles.sidebarLogo, styles.logoPlaceholder]}>
                        <Text style={styles.logoInitial}>{profile?.business_name?.[0]?.toUpperCase()}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                  <Text style={styles.sidebarName} numberOfLines={1}>{profile?.business_name}</Text>
                  <Text style={styles.sidebarEmail} numberOfLines={1}>{profile?.email}</Text>
                  <View style={[styles.sidebarStatusPill, { backgroundColor: statusBgMap[subStatus] || "#F3F4F6" }]}>
                    <View style={[styles.statusDot, { backgroundColor: statusColorMap[subStatus] || "#9CA3AF" }]} />
                    <Text style={[styles.sidebarStatusText, { color: statusColorMap[subStatus] || "#6B7280" }]}>{subStatus}</Text>
                  </View>
                </View>

                <View style={styles.sidebarNav}>
                  {webNavItems.map((item) => (
                    <TouchableOpacity
                      key={item.id}
                      style={[styles.sidebarNavItem, activeSection === item.id && styles.sidebarNavItemActive]}
                      onPress={() => { setActiveSection(item.id); if (isSmallWeb) setShowMobileSidebar(false); }}
                      activeOpacity={0.7}
                    >
                      {activeSection === item.id && <View style={styles.sidebarNavIndicator} />}
                      <Ionicons name={item.icon} size={16} color={activeSection === item.id ? ACCENT : T_MUTED} />
                      <Text style={[styles.sidebarNavText, activeSection === item.id && styles.sidebarNavTextActive]}>{item.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <View style={styles.sidebarFooter}>
                  <TouchableOpacity style={styles.sidebarFooterBtn} onPress={() => navigation.navigate("Reviews")} activeOpacity={0.7}>
                    <Ionicons name="star-outline" size={15} color="#F59E0B" />
                    <Text style={styles.sidebarFooterBtnText}>Ratings & Reviews</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.sidebarLogoutBtn} onPress={handleLogout} activeOpacity={0.7}>
                    <Ionicons name="log-out-outline" size={15} color="#DC2626" />
                    <Text style={styles.sidebarLogoutText}>Logout</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </>
          )}

          <ScrollView style={styles.webMainScroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={[styles.webMainContent, isSmallWeb && styles.webMainContentSmall]}>
            {isChefMode && (
              <View style={[styles.chefModeBanner, isSmallWeb && { flexDirection: "column", gap: 12, alignItems: "flex-start" }]}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                  <View style={styles.chefBannerIcon}><Ionicons name="lock-closed" size={20} color="#92400E" /></View>
                  <View>
                    <Text style={styles.chefBannerTitle}>Chef Mode Active</Text>
                    <Text style={styles.chefBannerSub}>Revenue and billing are hidden from view.</Text>
                  </View>
                </View>
                <TouchableOpacity style={styles.unlockBtn} onPress={toggleChefMode}>
                  <Ionicons name="lock-open-outline" size={14} color="#92400E" />
                  <Text style={styles.unlockBtnText}>Unlock</Text>
                </TouchableOpacity>
              </View>
            )}

            {!isChefMode && (
              <>
                {activeSection === "subscription" && (
                  <View>
                    <WebSectionHeader title="Subscription" subtitle="Manage your plan and billing" />
                    <View style={[styles.webPlanCard, isSmallWeb && styles.webPlanCardSmall]}>
                      <View style={[styles.webPlanCardLeft, isSmallWeb && { width: "100%" }]}>
                        <Text style={styles.webPlanLabel}>SERVON MONTHLY</Text>
                        <Text style={[styles.webPlanPrice, isSmallWeb && { fontSize: 28 }]}>
                          ₹999 <Text style={styles.webPlanPriceSub}>/ month</Text>
                        </Text>
                        {endDate && (
                          <View style={styles.planDateRow}>
                            <Ionicons name="calendar-outline" size={14} color={T_MUTED} />
                            <Text style={styles.planDateLabel}>Valid until</Text>
                            <Text style={styles.planDateValue}>{new Date(endDate).toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" })}</Text>
                          </View>
                        )}
                        {subStatus === "ACTIVE" && daysLeft !== null && (
                          <View style={[styles.daysLeftPill, { backgroundColor: daysLeft <= 5 ? "#FEF2F2" : "#ECFDF5" }]}>
                            <Ionicons name={daysLeft <= 5 ? "warning-outline" : "checkmark-circle-outline"} size={14} color={daysLeft <= 5 ? "#DC2626" : "#059669"} />
                            <Text style={[styles.daysLeftText, { color: daysLeft <= 5 ? "#DC2626" : "#059669" }]}>{daysLeft > 0 ? `${daysLeft} days remaining` : "Expires today"}</Text>
                          </View>
                        )}
                      </View>
                      <View style={[styles.webPlanCardRight, isSmallWeb && styles.webPlanCardRightSmall]}>
                        <View style={[styles.statusBadge, { backgroundColor: statusBgMap[subStatus] || "#F3F4F6", marginBottom: 16, alignSelf: isSmallWeb ? "flex-start" : "flex-end" }]}>
                          <View style={[styles.statusDot, { backgroundColor: statusColorMap[subStatus] || "#9CA3AF" }]} />
                          <Text style={[styles.statusText, { color: statusColorMap[subStatus] || "#6B7280" }]}>{subStatus}</Text>
                        </View>
                        {(subStatus !== "ACTIVE" || (daysLeft !== null && daysLeft <= 5)) && (
                          <TouchableOpacity style={styles.webRenewBtn} onPress={handleRenew} disabled={paying} activeOpacity={0.85}>
                            {paying ? <ActivityIndicator color="#fff" /> : <><Ionicons name="flash" size={15} color="#fff" /><Text style={styles.webRenewBtnText}>{subStatus === "ACTIVE" ? "Renew" : "Activate"} · ₹999</Text></>}
                          </TouchableOpacity>
                        )}
                        <TouchableOpacity style={styles.webReferBtn} onPress={() => navigation.navigate("Referrals")} activeOpacity={0.85}>
                          <Ionicons name="gift-outline" size={15} color={ACCENT} />
                          <Text style={styles.webReferBtnText}>Refer & Get 1 Month Free</Text>
                        </TouchableOpacity>
                        <Text style={styles.note}>Manual renewal only · No auto-debit</Text>
                      </View>
                    </View>
                  </View>
                )}

                {activeSection === "billing" && (
                  <View>
                    <WebSectionHeader title="Billing & Taxes" subtitle="Configure your GST and tax settings" />
                    <View style={[styles.webFormGrid, isSmallWeb && { flexDirection: "column" }]}>
                      <View style={{ flex: 1 }}><View style={styles.card}>{billingFields.map(renderField)}</View></View>
                      {!isSmallWeb && (
                        <View style={styles.webFormSideInfo}>
                          <View style={styles.webInfoBox}>
                            <Ionicons name="information-circle-outline" size={20} color={T_MUTED} />
                            <Text style={styles.webInfoTitle}>Tax Setup</Text>
                            <Text style={styles.webInfoText}>Enter your GSTIN and tax percentages to have them automatically applied on bills and invoices.</Text>
                          </View>
                        </View>
                      )}
                    </View>
                    {hasChanges && <WebSaveBar onSave={handleSave} onDiscard={handleDiscard} saving={saving} isSmall={isSmallWeb} />}
                  </View>
                )}

                {activeSection === "details" && (
                  <View>
                    <WebSectionHeader title="Business Details" subtitle="Update your restaurant information" />
                    <View style={[styles.webTwoCol, isSmallWeb && { flexDirection: "column" }]}>
                      <View style={{ flex: 1 }}><View style={styles.card}>{basicFields.slice(0, 5).map(renderField)}</View></View>
                      <View style={{ flex: 1 }}><View style={styles.card}>{basicFields.slice(5).map(renderField)}</View></View>
                    </View>
                    {hasChanges && <WebSaveBar onSave={handleSave} onDiscard={handleDiscard} saving={saving} isSmall={isSmallWeb} />}
                  </View>
                )}

                {activeSection === "security" && (
                  <View>
                    <WebSectionHeader title="Security & Kitchen" subtitle="Manage Chef Mode and Admin PIN" />
                    <View style={styles.webSecurityLayout}>
                      <View style={styles.webSecurityCard}>
                        <View style={styles.webSecurityCardHeader}>
                          <View style={styles.webSecurityIcon}><Ionicons name="restaurant-outline" size={20} color={T_MUTED} /></View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.webSecurityTitle}>Chef Mode</Text>
                            <Text style={styles.webSecuritySub}>Hides revenue, analytics & billing. Unlock with Admin PIN.</Text>
                          </View>
                          <Switch value={isChefMode} onValueChange={toggleChefMode} trackColor={{ false: "#D1D5DB", true: GREEN }} thumbColor="#fff" />
                        </View>
                      </View>
                      {!isChefMode && (
                        <View style={styles.webSecurityCard}>
                          <View style={styles.webSecurityCardHeader}>
                            <View style={[styles.webSecurityIcon, { backgroundColor: "#ECFDF5" }]}><Ionicons name="keypad-outline" size={20} color={ACCENT} /></View>
                            <View style={{ flex: 1 }}>
                              <Text style={styles.webSecurityTitle}>Admin PIN</Text>
                              <Text style={styles.webSecuritySub}>4-digit PIN used to unlock Chef Mode.</Text>
                            </View>
                          </View>
                          <View style={{ marginTop: 16 }}>
                            {profile?.admin_pin && !isUpdatingPin ? (
                              <View style={styles.pinDisplay}>
                                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                                  <View style={styles.pinShieldWrap}><Ionicons name="shield-checkmark" size={16} color={GREEN} /></View>
                                  <Text style={styles.pinDots}>••••</Text>
                                </View>
                                <TouchableOpacity style={styles.pinUpdateBtn} onPress={() => setIsUpdatingPin(true)}>
                                  <Text style={styles.pinUpdateBtnText}>Update PIN</Text>
                                </TouchableOpacity>
                              </View>
                            ) : (
                              <View style={[styles.pinInputRow, isSmallWeb && { flexWrap: "wrap" }]}>
                                <View style={[styles.inputWrapper, { flex: 1, minWidth: 100 }]}>
                                  <TextInput style={[styles.textInput, { letterSpacing: 8, fontWeight: "800", textAlign: "center" }]} value={newPin} onChangeText={setNewPin} maxLength={4} keyboardType="number-pad" secureTextEntry placeholder="••••" placeholderTextColor="#C4C4C4" autoFocus={isUpdatingPin} />
                                </View>
                                <TouchableOpacity style={[styles.saveBtn, { paddingHorizontal: 20, backgroundColor: newPin.length === 4 ? T_PRIMARY : "#D1D5DB", flex: 0 }]} onPress={handleSetPin} disabled={newPin.length !== 4 || savingPin}>
                                  {savingPin ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.saveBtnText}>Save</Text>}
                                </TouchableOpacity>
                                {profile?.admin_pin && isUpdatingPin && (
                                  <TouchableOpacity style={[styles.discardBtn, { flex: 0, paddingHorizontal: 16 }]} onPress={() => { setIsUpdatingPin(false); setNewPin(""); }}>
                                    <Text style={styles.discardBtnText}>Cancel</Text>
                                  </TouchableOpacity>
                                )}
                              </View>
                            )}
                          </View>
                        </View>
                      )}
                    </View>
                  </View>
                )}
              </>
            )}
          </ScrollView>
        </View>

        {showPinModal && <ChefPinModal visible={showPinModal} onClose={() => setShowPinModal(false)} onSuccess={() => { setShowPinModal(false); setIsChefMode(false); }} />}
        {showSuccessModal && <SuccessModal />}
      </SafeAreaView>
    );
  }

  // ─── MOBILE LAYOUT ────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.navHeader}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={20} color={T_PRIMARY} />
          <Text style={styles.backText}>Dashboard</Text>
        </TouchableOpacity>
        {hasChanges && (
          <View style={styles.unsavedPill}>
            <View style={styles.unsavedDot} />
            <Text style={styles.unsavedPillText}>Unsaved</Text>
          </View>
        )}
      </View>

      <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.inner}>
          {isChefMode && (
            <View style={styles.chefModeBanner}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <View style={styles.chefBannerIcon}><Ionicons name="lock-closed" size={20} color="#92400E" /></View>
                <View>
                  <Text style={styles.chefBannerTitle}>Chef Mode Active</Text>
                  <Text style={styles.chefBannerSub}>Revenue and billing are hidden.</Text>
                </View>
              </View>
              <TouchableOpacity style={styles.unlockBtn} onPress={toggleChefMode}>
                <Ionicons name="lock-open-outline" size={14} color="#92400E" />
                <Text style={styles.unlockBtnText}>Unlock</Text>
              </TouchableOpacity>
            </View>
          )}

          {!isChefMode && (
            <>
              <View style={styles.heroSection}>
                <TouchableOpacity onPress={handleLogoPress} activeOpacity={0.85} style={styles.logoWrap}>
                  {profile?.logo_url ? (
                    <Image source={{ uri: profile.logo_url }} style={styles.logo} />
                  ) : (
                    <View style={[styles.logo, styles.logoPlaceholder]}>
                      <Text style={styles.logoInitial}>{profile?.business_name?.[0]?.toUpperCase()}</Text>
                    </View>
                  )}
                </TouchableOpacity>
                <Text style={styles.heroName}>{profile?.business_name}</Text>
                <Text style={styles.heroEmail}>{profile?.email}</Text>
              </View>

              <View style={styles.planCard}>
                <View style={styles.planTop}>
                  <View>
                    <Text style={styles.planName}>Servon Monthly</Text>
                    <Text style={styles.planPrice}>₹999 <Text style={styles.planPriceSub}>/ month</Text></Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: statusBgMap[subStatus] || "#F3F4F6" }]}>
                    <View style={[styles.statusDot, { backgroundColor: statusColorMap[subStatus] || "#9CA3AF" }]} />
                    <Text style={[styles.statusText, { color: statusColorMap[subStatus] || "#6B7280" }]}>{subStatus}</Text>
                  </View>
                </View>
                {endDate && (
                  <View style={styles.planDateRow}>
                    <Ionicons name="calendar-outline" size={14} color={T_MUTED} />
                    <Text style={styles.planDateLabel}>Valid until</Text>
                    <Text style={styles.planDateValue}>{new Date(endDate).toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" })}</Text>
                  </View>
                )}
                {subStatus === "ACTIVE" && daysLeft !== null && (
                  <View style={[styles.daysLeftPill, { backgroundColor: daysLeft <= 5 ? "#FEF2F2" : "#ECFDF5" }]}>
                    <Ionicons name={daysLeft <= 5 ? "warning-outline" : "checkmark-circle-outline"} size={14} color={daysLeft <= 5 ? "#DC2626" : "#059669"} />
                    <Text style={[styles.daysLeftText, { color: daysLeft <= 5 ? "#DC2626" : "#059669" }]}>{daysLeft > 0 ? `${daysLeft} days remaining` : "Expires today"}</Text>
                  </View>
                )}
                {(subStatus !== "ACTIVE" || (daysLeft !== null && daysLeft <= 5)) && (
                  <TouchableOpacity style={styles.renewBtn} onPress={handleRenew} disabled={paying} activeOpacity={0.85}>
                    {paying
                      ? <><ActivityIndicator color="#fff" size="small" /><Text style={[styles.renewBtnText, { marginLeft: 8 }]}>Processing...</Text></>
                      : <><Ionicons name="flash" size={16} color="#fff" /><Text style={styles.renewBtnText}>{subStatus === "ACTIVE" ? "Renew Subscription" : "Activate Subscription"} · ₹999</Text></>
                    }
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={styles.referBtn} onPress={() => navigation.navigate("Referrals")} activeOpacity={0.85}>
                  <Ionicons name="gift-outline" size={16} color="#fff" />
                  <Text style={styles.referBtnText}>Refer & Get 1 Month Free</Text>
                </TouchableOpacity>
                <Text style={styles.note}>Manual renewal only · No auto-debit</Text>
              </View>

              <SectionLabel title="Billing & Taxes" icon="receipt-outline" />
              <View style={styles.card}>{billingFields.map(renderField)}</View>

              <SectionLabel title="Basic Details" icon="person-outline" />
              <View style={styles.card}>{basicFields.map(renderField)}</View>

              {hasChanges && (
                <View style={styles.saveBar}>
                  <View style={styles.saveBarTop}>
                    <Ionicons name="alert-circle-outline" size={15} color="#92400E" />
                    <Text style={styles.saveBarText}>You have unsaved changes</Text>
                  </View>
                  <View style={styles.saveBarBtns}>
                    <TouchableOpacity style={styles.discardBtn} onPress={handleDiscard} disabled={saving}><Text style={styles.discardBtnText}>Discard</Text></TouchableOpacity>
                    <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
                      {saving ? <ActivityIndicator color="#fff" size="small" /> : <><Ionicons name="checkmark-circle" size={16} color="#fff" /><Text style={styles.saveBtnText}>Save Changes</Text></>}
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              <SectionLabel title="Security & Kitchen" icon="shield-outline" />
              <View style={styles.card}>
                <View style={styles.chefToggleRow}>
                  <View style={styles.chefToggleLeft}>
                    <View style={styles.chefToggleIcon}><Ionicons name="restaurant-outline" size={18} color={T_MUTED} /></View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.chefToggleTitle}>Open Chef Mode</Text>
                      <Text style={styles.chefToggleSub}>Hides revenue & billing. Unlock with Admin PIN.</Text>
                    </View>
                  </View>
                  <Switch value={isChefMode} onValueChange={toggleChefMode} trackColor={{ false: "#D1D5DB", true: GREEN }} thumbColor="#fff" />
                </View>
                {!isChefMode && (
                  <View style={styles.pinSection}>
                    <Text style={styles.pinLabel}>Admin PIN</Text>
                    <View style={{ marginTop: 10 }}>
                      {profile?.admin_pin && !isUpdatingPin ? (
                        <View style={styles.pinDisplay}>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                            <View style={styles.pinShieldWrap}><Ionicons name="shield-checkmark" size={16} color={GREEN} /></View>
                            <Text style={styles.pinDots}>••••</Text>
                          </View>
                          <TouchableOpacity style={styles.pinUpdateBtn} onPress={() => setIsUpdatingPin(true)}>
                            <Text style={styles.pinUpdateBtnText}>Update PIN</Text>
                          </TouchableOpacity>
                        </View>
                      ) : (
                        <View style={styles.pinInputRow}>
                          <View style={[styles.inputWrapper, { flex: 1 }]}>
                            <TextInput style={[styles.textInput, { letterSpacing: 8, fontWeight: "800", textAlign: "center" }]} value={newPin} onChangeText={setNewPin} maxLength={4} keyboardType="number-pad" secureTextEntry placeholder="••••" placeholderTextColor="#C4C4C4" autoFocus={isUpdatingPin} />
                          </View>
                          <TouchableOpacity style={[styles.saveBtn, { paddingHorizontal: 20, backgroundColor: newPin.length === 4 ? T_PRIMARY : "#D1D5DB" }]} onPress={handleSetPin} disabled={newPin.length !== 4 || savingPin}>
                            {savingPin ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.saveBtnText}>Save</Text>}
                          </TouchableOpacity>
                          {profile?.admin_pin && isUpdatingPin && (
                            <TouchableOpacity style={styles.discardBtn} onPress={() => { setIsUpdatingPin(false); setNewPin(""); }}>
                              <Text style={styles.discardBtnText}>Cancel</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      )}
                    </View>
                  </View>
                )}
              </View>

              <TouchableOpacity style={styles.ghostBtn} onPress={() => navigation.navigate("Reviews")} activeOpacity={0.8}>
                <Ionicons name="star" size={16} color="#F59E0B" />
                <Text style={styles.ghostBtnText}>View Ratings & Reviews</Text>
                <Ionicons name="chevron-forward" size={15} color={T_FAINT} style={{ marginLeft: "auto" }} />
              </TouchableOpacity>

              <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.8}>
                <Ionicons name="log-out-outline" size={16} color="#DC2626" />
                <Text style={styles.logoutText}>Logout of Account</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </ScrollView>

      {showPinModal && <ChefPinModal visible={showPinModal} onClose={() => setShowPinModal(false)} onSuccess={() => { setShowPinModal(false); setIsChefMode(false); }} />}
      {showSuccessModal && <SuccessModal />}
    </SafeAreaView>
  );
}

function WebSectionHeader({ title, subtitle }) {
  return (
    <View style={{ marginBottom: 24 }}>
      <Text style={{ fontSize: 22, fontWeight: "800", color: T_PRIMARY, marginBottom: 4 }}>{title}</Text>
      <Text style={{ fontSize: 14, color: T_MUTED }}>{subtitle}</Text>
    </View>
  );
}

function WebSaveBar({ onSave, onDiscard, saving, isSmall }) {
  return (
    <View style={[styles.webSaveBar, isSmall && { flexDirection: "column", gap: 12, alignItems: "flex-start" }]}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#F59E0B" }} />
        <Text style={{ fontSize: 13, color: "#92400E", fontWeight: "600" }}>Unsaved changes</Text>
      </View>
      <View style={{ flexDirection: "row", gap: 10 }}>
        <TouchableOpacity style={styles.webDiscardBtn} onPress={onDiscard} disabled={saving}><Text style={styles.discardBtnText}>Discard</Text></TouchableOpacity>
        <TouchableOpacity style={styles.webSaveBtnInline} onPress={onSave} disabled={saving}>
          {saving ? <ActivityIndicator color="#fff" size="small" /> : <><Ionicons name="checkmark-circle" size={15} color="#fff" /><Text style={styles.saveBtnText}>Save Changes</Text></>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

function SectionLabel({ title, icon }) {
  return (
    <View style={slStyles.row}>
      <View style={slStyles.iconWrap}><Ionicons name={icon} size={13} color={T_MUTED} /></View>
      <Text style={slStyles.title}>{title}</Text>
    </View>
  );
}

const slStyles = StyleSheet.create({
  row:      { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 28, marginBottom: 10 },
  iconWrap: { width: 26, height: 26, borderRadius: 7, backgroundColor: CARD, borderWidth: 1, borderColor: BORDER, alignItems: "center", justifyContent: "center" },
  title:    { fontSize: 14, fontWeight: "800", color: T_PRIMARY, letterSpacing: 0.1 },
});

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: BG },
  webTopNav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 14, backgroundColor: CARD, borderBottomWidth: 1, borderBottomColor: BORDER, ...Platform.select({ web: { boxShadow: "0 1px 4px rgba(0,0,0,0.04)" } }) },
  hamburgerBtn: { padding: 6, marginRight: 4 },
  webLayout: { flex: 1, flexDirection: "row" },
  webMainScroll: { flex: 1, backgroundColor: BG },
  webMainContent: { padding: 36, paddingBottom: 60 },
  webMainContentSmall: { padding: 16, paddingBottom: 40 },
  webSidebar: { width: SIDEBAR_W, backgroundColor: CARD, borderRightWidth: 1, borderRightColor: BORDER, paddingTop: 24, flexDirection: "column", ...Platform.select({ web: { boxShadow: "1px 0 6px rgba(0,0,0,0.03)" } }) },
  webSidebarOverlay: { position: "absolute", top: 0, left: 0, bottom: 0, zIndex: 100, width: SIDEBAR_W, ...Platform.select({ web: { boxShadow: "2px 0 16px rgba(0,0,0,0.12)" } }) },
  sidebarOverlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 99, backgroundColor: "rgba(0,0,0,0.3)" },
  sidebarProfileCard: { alignItems: "center", paddingHorizontal: 20, paddingBottom: 24, borderBottomWidth: 1, borderBottomColor: BORDER, marginBottom: 12 },
  sidebarLogoWrap: { position: "relative", marginBottom: 12 },
  sidebarLogo: { width: 72, height: 72, borderRadius: 18 },
  logoPlaceholder: { backgroundColor: T_PRIMARY, alignItems: "center", justifyContent: "center" },
  logoInitial: { color: "#fff", fontSize: 28, fontWeight: "900" },
  sidebarName: { fontSize: 15, fontWeight: "800", color: T_PRIMARY, textAlign: "center", marginBottom: 3 },
  sidebarEmail: { fontSize: 12, color: T_MUTED, textAlign: "center", marginBottom: 10 },
  sidebarStatusPill: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  sidebarStatusText: { fontSize: 11, fontWeight: "700" },
  sidebarNav: { flex: 1, paddingHorizontal: 12, paddingTop: 8 },
  sidebarNavItem: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 11, paddingHorizontal: 12, borderRadius: 10, marginBottom: 2, position: "relative" },
  sidebarNavItemActive: { backgroundColor: "#F0FDF9" },
  sidebarNavText: { fontSize: 14, fontWeight: "600", color: T_MUTED, flex: 1 },
  sidebarNavTextActive: { color: ACCENT, fontWeight: "700" },
  sidebarNavIndicator: { position: "absolute", left: 0, top: 8, bottom: 8, width: 3, borderRadius: 2, backgroundColor: ACCENT },
  sidebarFooter: { paddingHorizontal: 12, paddingTop: 16, paddingBottom: 16, borderTopWidth: 1, borderTopColor: BORDER, gap: 4 },
  sidebarFooterBtn: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10 },
  sidebarFooterBtnText: { fontSize: 13, fontWeight: "600", color: T_MUTED },
  sidebarLogoutBtn: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10 },
  sidebarLogoutText: { fontSize: 13, fontWeight: "600", color: "#DC2626" },
  webPlanCard: { backgroundColor: CARD, borderRadius: 18, borderWidth: 1, borderColor: BORDER, flexDirection: "row", padding: 28, gap: 24, ...Platform.select({ web: { boxShadow: "0 2px 12px rgba(0,0,0,0.06)" } }) },
  webPlanCardSmall: { flexDirection: "column", padding: 20, gap: 16 },
  webPlanCardLeft: { flex: 1 },
  webPlanCardRight: { alignItems: "flex-end", minWidth: 190 },
  webPlanCardRightSmall: { alignItems: "flex-start", minWidth: 0, width: "100%" },
  webPlanLabel: { fontSize: 11, fontWeight: "800", color: T_MUTED, letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 },
  webPlanPrice: { fontSize: 36, fontWeight: "900", color: T_PRIMARY, letterSpacing: -1, marginBottom: 16 },
  webPlanPriceSub: { fontSize: 15, fontWeight: "500", color: T_MUTED },
  webRenewBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: T_PRIMARY, borderRadius: 10, paddingVertical: 12, paddingHorizontal: 20, marginBottom: 8, width: "100%" },
  webRenewBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  webReferBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: "#ECFDF5", borderRadius: 10, borderWidth: 1.5, borderColor: "#A7F3D0", paddingVertical: 11, paddingHorizontal: 16, marginBottom: 8, width: "100%" },
  webReferBtnText: { color: ACCENT, fontWeight: "700", fontSize: 13 },
  webFormGrid: { flexDirection: "row", gap: 20, alignItems: "flex-start" },
  webFormSideInfo: { width: 220 },
  webInfoBox: { backgroundColor: CARD, borderRadius: 14, borderWidth: 1, borderColor: BORDER, padding: 20, gap: 8 },
  webInfoTitle: { fontSize: 14, fontWeight: "700", color: T_PRIMARY },
  webInfoText: { fontSize: 13, color: T_MUTED, lineHeight: 20 },
  webTwoCol: { flexDirection: "row", gap: 20 },
  webSaveBar: { marginTop: 24, flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#FFFBEB", borderRadius: 12, padding: 16, borderWidth: 1, borderColor: "#FCD34D" },
  webDiscardBtn: { backgroundColor: "#F1F0ED", borderRadius: 8, paddingHorizontal: 16, paddingVertical: 10, alignItems: "center", justifyContent: "center" },
  webSaveBtnInline: { backgroundColor: T_PRIMARY, borderRadius: 8, paddingHorizontal: 20, paddingVertical: 10, flexDirection: "row", alignItems: "center", gap: 6 },
  webSecurityLayout: { gap: 16 },
  webSecurityCard: { backgroundColor: CARD, borderRadius: 16, borderWidth: 1, borderColor: BORDER, padding: 24, ...Platform.select({ web: { boxShadow: "0 1px 6px rgba(0,0,0,0.05)" } }) },
  webSecurityCardHeader: { flexDirection: "row", alignItems: "center", gap: 14 },
  webSecurityIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: BG, borderWidth: 1, borderColor: BORDER, alignItems: "center", justifyContent: "center" },
  webSecurityTitle: { fontSize: 15, fontWeight: "700", color: T_PRIMARY },
  webSecuritySub: { fontSize: 13, color: T_MUTED, marginTop: 3 },
  navHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingVertical: 14, backgroundColor: CARD, borderBottomWidth: 1, borderBottomColor: BORDER, ...Platform.select({ ios: { shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4 }, android: { elevation: 2 } }) },
  backBtn: { flexDirection: "row", alignItems: "center", gap: 4 },
  backText: { fontSize: 15, fontWeight: "700", color: T_PRIMARY },
  unsavedPill: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "#FEF3C7", borderWidth: 1, borderColor: "#FCD34D", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  unsavedDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#F59E0B" },
  unsavedPillText: { fontSize: 11, color: "#92400E", fontWeight: "700" },
  scrollContent: { paddingBottom: 40 },
  inner: { paddingHorizontal: H_PAD },
  chefModeBanner: { marginTop: 20, backgroundColor: "#FFFBEB", borderRadius: 14, padding: 16, borderWidth: 1, borderColor: "#FCD34D", flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  chefBannerIcon: { width: 40, height: 40, borderRadius: 10, backgroundColor: "#FEF3C7", alignItems: "center", justifyContent: "center" },
  chefBannerTitle: { fontSize: 15, fontWeight: "800", color: "#92400E" },
  chefBannerSub: { fontSize: 12, color: "#B45309", marginTop: 2 },
  unlockBtn: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "#FEF3C7", borderWidth: 1.5, borderColor: "#F59E0B", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
  unlockBtnText: { color: "#92400E", fontWeight: "800", fontSize: 13 },
  heroSection: { alignItems: "center", paddingTop: 28, paddingBottom: 24 },
  logoWrap: { position: "relative", marginBottom: 14 },
  logo: { width: 88, height: 88, borderRadius: 22 },
  heroName: { fontSize: 20, fontWeight: "900", color: T_PRIMARY, textAlign: "center" },
  heroEmail: { fontSize: 13, color: T_MUTED, marginTop: 3, textAlign: "center" },
  planCard: { backgroundColor: CARD, borderRadius: 18, padding: 20, borderWidth: 1, borderColor: BORDER, ...Platform.select({ ios: { shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8 }, android: { elevation: 2 } }) },
  planTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 },
  planName: { fontSize: 13, fontWeight: "700", color: T_MUTED, letterSpacing: 0.3, textTransform: "uppercase", marginBottom: 6 },
  planPrice: { fontSize: 28, fontWeight: "900", color: T_PRIMARY, letterSpacing: -0.5 },
  planPriceSub: { fontSize: 14, fontWeight: "500", color: T_MUTED },
  statusBadge: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusText: { fontSize: 12, fontWeight: "800" },
  planDateRow: { flexDirection: "row", alignItems: "center", gap: 7, backgroundColor: BG, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10, marginBottom: 12 },
  planDateLabel: { fontSize: 12, color: T_MUTED, fontWeight: "600" },
  planDateValue: { fontSize: 13, fontWeight: "700", color: T_PRIMARY, marginLeft: 4 },
  daysLeftPill: { flexDirection: "row", alignItems: "center", gap: 7, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10, marginBottom: 14 },
  daysLeftText: { fontSize: 13, fontWeight: "700" },
  renewBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: T_PRIMARY, borderRadius: 12, paddingVertical: 15, marginBottom: 10, ...Platform.select({ ios: { shadowColor: T_PRIMARY, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8 }, android: { elevation: 4 } }) },
  renewBtnText: { color: "#fff", fontWeight: "800", fontSize: 15 },
  referBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: GREEN, borderRadius: 12, paddingVertical: 14, marginBottom: 12 },
  referBtnText: { color: "#fff", fontWeight: "800", fontSize: 15 },
  note: { fontSize: 11, color: T_FAINT, textAlign: "center", fontWeight: "500" },
  card: { backgroundColor: CARD, borderRadius: 16, borderWidth: 1, borderColor: BORDER, overflow: "hidden", ...Platform.select({ ios: { shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 6 }, android: { elevation: 1 } }) },
  fieldRow: { paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#F1F0ED" },
  fieldLabelRow: { flexDirection: "row", alignItems: "center", marginBottom: 8, gap: 6 },
  fieldLabel: { fontSize: 11, fontWeight: "800", color: T_MUTED, letterSpacing: 0.5, textTransform: "uppercase" },
  lockedTag: { flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: "#F8FAFC", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, borderWidth: 1, borderColor: BORDER },
  lockedTagText: { fontSize: 9, color: T_FAINT, fontWeight: "600" },
  inputWrapper: { flexDirection: "row", alignItems: "center", backgroundColor: "#FAFAF8", borderWidth: 1.5, borderColor: BORDER, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
  inputWrapperLocked: { backgroundColor: "#F8F6F3", borderColor: "#EDE9E3" },
  textInput: { flex: 1, fontSize: 15, color: T_PRIMARY, fontWeight: "600", padding: 0 },
  textInputMultiline: { height: 72, textAlignVertical: "top" },
  textInputLocked: { color: T_FAINT, fontWeight: "500" },
  saveBar: { marginTop: 16, backgroundColor: "#FFFBEB", borderRadius: 14, padding: 16, borderWidth: 1, borderColor: "#FCD34D" },
  saveBarTop: { flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 12 },
  saveBarText: { fontSize: 13, color: "#92400E", fontWeight: "700" },
  saveBarBtns: { flexDirection: "row", gap: 10 },
  discardBtn: { flex: 1, backgroundColor: "#F1F0ED", borderRadius: 10, padding: 14, alignItems: "center", justifyContent: "center" },
  discardBtnText: { color: T_MUTED, fontWeight: "700", fontSize: 14 },
  saveBtn: { flex: 2, backgroundColor: T_PRIMARY, borderRadius: 10, padding: 14, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 6 },
  saveBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  chefToggleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, gap: 12 },
  chefToggleLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  chefToggleIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: BG, borderWidth: 1, borderColor: BORDER, alignItems: "center", justifyContent: "center" },
  chefToggleTitle: { fontSize: 15, fontWeight: "700", color: T_PRIMARY },
  chefToggleSub: { fontSize: 12, color: T_MUTED, marginTop: 2, lineHeight: 17 },
  pinSection: { borderTopWidth: 1, borderTopColor: "#F1F0ED", padding: 16 },
  pinLabel: { fontSize: 11, fontWeight: "800", color: T_MUTED, letterSpacing: 0.5, textTransform: "uppercase" },
  pinDisplay: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: BG, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: BORDER },
  pinShieldWrap: { width: 32, height: 32, borderRadius: 8, backgroundColor: "#ECFDF5", alignItems: "center", justifyContent: "center" },
  pinDots: { fontSize: 22, fontWeight: "900", color: T_PRIMARY, letterSpacing: 6, paddingTop: 4 },
  pinUpdateBtn: { backgroundColor: CARD, borderWidth: 1.5, borderColor: BORDER, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
  pinUpdateBtnText: { color: T_PRIMARY, fontWeight: "700", fontSize: 13 },
  pinInputRow: { flexDirection: "row", gap: 10 },
  ghostBtn: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 16, backgroundColor: CARD, borderWidth: 1, borderColor: BORDER, borderRadius: 14, padding: 16, ...Platform.select({ ios: { shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4 }, android: { elevation: 1 } }) },
  ghostBtnText: { color: T_PRIMARY, fontWeight: "700", fontSize: 15 },
  logoutBtn: { marginTop: 10, marginBottom: 20, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 14, borderWidth: 1.5, borderColor: "#FECACA", backgroundColor: "#FFF5F5", padding: 16 },
  logoutText: { color: "#DC2626", fontWeight: "700", fontSize: 15 },
  successOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "center", alignItems: "center", zIndex: 9999 },
  successCard: { backgroundColor: CARD, padding: 40, borderRadius: 24, alignItems: "center", width: "85%", maxWidth: 400, ...Platform.select({ web: { boxShadow: "0 20px 60px rgba(0,0,0,0.2)" } }) },
  successIconWrap: { width: 96, height: 96, borderRadius: 48, backgroundColor: "#ECFDF5", alignItems: "center", justifyContent: "center", marginBottom: 4 },
  successTitle: { fontSize: 22, fontWeight: "900", marginTop: 16, color: T_PRIMARY, textAlign: "center" },
  successSub: { fontSize: 14, color: T_MUTED, textAlign: "center", marginTop: 10, lineHeight: 22 },
  successDivider: { width: "100%", height: 1, backgroundColor: BORDER, marginVertical: 24 },
  successBtn: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: T_PRIMARY, paddingHorizontal: 32, paddingVertical: 14, borderRadius: 12 },
  successBtnText: { color: "#fff", fontWeight: "800", fontSize: 15 },
});