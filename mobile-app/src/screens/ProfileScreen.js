import { useState, useCallback } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Alert, ActivityIndicator, Image, Linking, Platform, Switch
} from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { getProfile, updateProfile, getSubscriptionDetails, createPaymentOrder, setAdminPin } from "../api";
import { useAuth } from "../context/AuthContext";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import ChefPinModal from "../components/ChefPinModal";

export default function ProfileScreen() {
  const { logout, business, updateBusiness, isChefMode, setIsChefMode } = useAuth();
  const navigation = useNavigation();
  
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({});

  const [subDetails, setSubDetails] = useState(null);
  const [paying, setPaying] = useState(false);

  // --- CHEF MODE STATES ---
  const [newPin, setNewPin] = useState("");
  const [savingPin, setSavingPin] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [isUpdatingPin, setIsUpdatingPin] = useState(false); // <-- NEW POLISH STATE

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  const loadData = async () => {
    try {
      const [profileRes, subRes] = await Promise.all([
        getProfile(),
        getSubscriptionDetails()
      ]);
      
      setProfile(profileRes.data);
      setForm({ ...profileRes.data });
      setSubDetails(subRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const setField = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await updateProfile({
        businessName: form.business_name,
        ownerName: form.owner_name,
        phone: form.phone,
        description: form.description,
        address: form.address,
        city: form.city,
        state: form.state,
        pincode: form.pincode,
        gstNumber: form.gst_number,
        cgstPercentage: form.cgst_percentage,
        sgstPercentage: form.sgst_percentage,
      });
      setProfile(res.data);
      await updateBusiness(res.data);
      setEditing(false);
    } catch (err) {
      Alert.alert("Error", err.response?.data?.error || "Update failed");
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    if (Platform.OS === "web") {
      const confirmLogout = window.confirm("Are you sure you want to logout?");
      if (confirmLogout) logout();
    } else {
      Alert.alert("Logout", "Are you sure you want to logout?", [
        { text: "Cancel", style: "cancel" },
        { text: "Logout", style: "destructive", onPress: logout },
      ]);
    }
  };

  const handleRenew = async () => {
    try {
      setPaying(true);
      const orderRes = await createPaymentOrder();

      if (!orderRes || !orderRes.data || !orderRes.data.orderId) {
        Alert.alert("Error", "Order ID not received");
        return;
      }

      const orderId = orderRes.data.orderId;
      const checkoutUrl = `${process.env.EXPO_PUBLIC_API_URL}/api/subscription/checkout/${orderId}`;

      if (Platform.OS === "web") window.location.href = checkoutUrl;
      else Linking.openURL(checkoutUrl);
    } catch (err) {
      Alert.alert("Error", "Unable to start payment");
    } finally {
      setPaying(false);
    }
  };

  // --- CHEF MODE FUNCTIONS ---
  const handleSetPin = async () => {
    if (newPin.length !== 4) return Alert.alert("Invalid", "PIN must be exactly 4 digits");
    setSavingPin(true);
    try {
      await setAdminPin(newPin);
      setProfile(prev => ({ ...prev, admin_pin: newPin })); 
      setNewPin("");
      setIsUpdatingPin(false); // Close the update UI on success
      Alert.alert("Success", "Security PIN updated successfully!");
    } catch (err) {
      Alert.alert("Error", "Failed to update PIN");
    } finally {
      setSavingPin(false);
    }
  };

const toggleChefMode = () => {
    if (isChefMode) {
      // 1. IF THEY ARE UNLOCKING: Always show the modal! Don't block them!
      setShowPinModal(true);
    } else {
      // 2. IF THEY ARE LOCKING: Make sure they have a PIN set first.
      if (!profile?.admin_pin) {
        return Alert.alert("Hold on!", "You must set an Admin PIN below before turning on Chef Mode.");
      }
      
      // Enter Chef Mode and boot to Dashboard
      if (Platform.OS === 'web') {
        const confirm = window.confirm("Entering Chef Mode. The app will hide revenue and billing until unlocked. Continue?");
        if (confirm) {
          setIsChefMode(true);
          navigation.navigate("Dashboard"); 
        }
      } else {
        Alert.alert(
          "Enter Chef Mode?", 
          "The app will hide all revenue, analytics, and billing buttons until unlocked with your PIN.",
          [
            { text: "Cancel", style: "cancel" },
            { 
              text: "Lock App", 
              onPress: () => {
                setIsChefMode(true);
                navigation.navigate("Dashboard"); 
              }
            }
          ]
        );
      }
    }
  };
  
  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#111" />
      </View>
    );
  }

  const statusColorMap = { ACTIVE: "#198754", INACTIVE: "#dc3545", EXPIRED: "#dc3545" };
  const subStatus = subDetails?.subscription_status || business?.subscription_status;
  const endDate = subDetails?.subscription_end_date;
  const daysLeft = endDate ? Math.ceil((new Date(endDate) - new Date()) / (1000 * 60 * 60 * 24)) : null;

  const fields = [
    { key: "business_name", label: "Business Name" },
    { key: "owner_name", label: "Owner Name" },
    { key: "phone", label: "Phone", type: "phone-pad" },
    { key: "email", label: "Email", editable: false },
    { key: "description", label: "Description", multiline: true },
    { key: "address", label: "Address", multiline: true },
    { key: "city", label: "City" },
    { key: "state", label: "State" },
    { key: "pincode", label: "Pincode", type: "number-pad" },
  ];

  const billingFields = [
    { key: "gst_number", label: "GSTIN Number (optional)", autoCapitalize: "characters" },
    { key: "cgst_percentage", label: "CGST Percentage (%)", type: "numeric" },
    { key: "sgst_percentage", label: "SGST Percentage (%)", type: "numeric" },
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#f8f9fa" }}>
      <View style={styles.navHeader}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ flexDirection: "row", alignItems: "center" }}>
           <Ionicons name="chevron-back" size={24} color="#111" />
           <Text style={{ fontSize: 16, fontWeight: "600", marginLeft: 4 }}>Dashboard</Text>
        </TouchableOpacity>
      </View>

      <ScrollView>
        <View style={{ padding: 20 }}>
          
          {/* CHEF MODE BANNER: Shown prominently at the top if active */}
          {isChefMode && (
            <View style={styles.chefModeBanner}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Ionicons name="lock-closed" size={24} color="#92400E" />
                <View>
                  <Text style={{ fontWeight: '800', color: '#92400E', fontSize: 16 }}>Chef Mode Active</Text>
                  <Text style={{ color: '#B45309', fontSize: 12 }}>Revenue and billing are hidden.</Text>
                </View>
              </View>
              <TouchableOpacity style={styles.unlockBtn} onPress={toggleChefMode}>
                <Text style={styles.unlockBtnText}>Unlock</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* HIDE SENSITIVE PROFILE INFO IF CHEF MODE IS ON */}
          {!isChefMode && (
            <>
              <View style={{ alignItems: "center", marginBottom: 24 }}>
                {profile?.logo_url ? (
                  <Image source={{ uri: profile.logo_url }} style={styles.logo} />
                ) : (
                  <View style={[styles.logo, { backgroundColor: "#111", alignItems: "center", justifyContent: "center" }]}>
                    <Text style={{ color: "#fff", fontSize: 28, fontWeight: "800" }}>
                      {profile?.business_name?.[0]?.toUpperCase()}
                    </Text>
                  </View>
                )}
                <Text style={{ fontSize: 20, fontWeight: "800", color: "#111", marginTop: 12 }}>
                  {profile?.business_name}
                </Text>
                <Text style={{ fontSize: 14, color: "#888" }}>{profile?.email}</Text>
              </View>

              <View style={styles.planCard}>
                <View style={styles.rowBetween}>
                  <View>
                    <Text style={styles.planName}>Servon Monthly</Text>
                    <Text style={styles.planPrice}>₹999 / month</Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: statusColorMap[subStatus] || "#aaa" }]}>
                    <Text style={styles.statusText}>{subStatus}</Text>
                  </View>
                </View>

                {endDate && (
                  <View style={styles.dateInfo}>
                    <Text style={styles.dateInfoLabel}>Valid Until</Text>
                    <Text style={styles.dateInfoValue}>
                      {new Date(endDate).toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" })}
                    </Text>
                  </View>
                )}

                {subStatus === "ACTIVE" && daysLeft !== null && (
                  <Text style={[styles.daysLeft, { color: daysLeft <= 5 ? "#dc3545" : "#198754" }]}>
                    {daysLeft > 0 ? `${daysLeft} days remaining` : "Expires today"}
                  </Text>
                )}

                {(subStatus !== "ACTIVE" || (daysLeft !== null && daysLeft <= 5)) && (
                  <TouchableOpacity style={styles.renewBtn} onPress={handleRenew} disabled={paying}>
                    {paying ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.renewBtnText}>
                        {subStatus === "ACTIVE" ? "Renew Subscription" : "Activate Subscription"} — ₹999
                      </Text>
                    )}
                  </TouchableOpacity>
                )}
                
                <TouchableOpacity 
                  style={styles.referBtn}
                  onPress={() => navigation.navigate("Referrals")}
                >
                  <Ionicons name="gift" size={20} color="#fff" />
                  <Text style={styles.referBtnText}>Refer & Get 1 Month Free</Text>
                </TouchableOpacity>

                <Text style={styles.note}>Manual renewal only. No auto-debit.</Text>
              </View>

              <View style={styles.divider} />
              
              <Text style={styles.sectionHeader}>Billing & Taxes</Text>
              <View style={styles.cardSection}>
                {billingFields.map((f) => (
                  <View key={f.key} style={{ marginBottom: 14 }}>
                    <Text style={styles.label}>{f.label}</Text>
                    <TextInput
                      style={[styles.input, (!editing || f.editable === false) && styles.inputReadonly]}
                      value={editing ? String(form[f.key] || "") : String(profile?.[f.key] || "0")}
                      onChangeText={(v) => editing && setField(f.key, v)}
                      editable={editing && f.editable !== false}
                      keyboardType={f.type || "default"}
                      autoCapitalize={f.autoCapitalize || "none"}
                    />
                  </View>
                ))}
              </View>

              <Text style={[styles.sectionHeader, { marginTop: 10 }]}>Basic Details</Text>
              <View style={styles.cardSection}>
                {fields.map((f) => (
                  <View key={f.key} style={{ marginBottom: 14 }}>
                    <Text style={styles.label}>{f.label}</Text>
                    <TextInput
                      style={[styles.input, (!editing || f.editable === false) && styles.inputReadonly, f.multiline && { height: 80 }]}
                      value={editing ? form[f.key] || "" : profile?.[f.key] || "—"}
                      onChangeText={(v) => editing && setField(f.key, v)}
                      editable={editing && f.editable !== false}
                      keyboardType={f.type || "default"}
                      multiline={f.multiline || false}
                      autoCapitalize="none"
                    />
                  </View>
                ))}
              </View>

              {/* ----- POLISHED SECURITY / CHEF MODE SECTION ----- */}
              <Text style={[styles.sectionHeader, { marginTop: 10 }]}>Security & Kitchen Settings</Text>
              <View style={styles.cardSection}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <View style={{ flex: 1, paddingRight: 10 }}>
                    <Text style={{ fontSize: 16, fontWeight: "700", color: "#111" }}>Lock to Chef Mode</Text>
                    <Text style={{ fontSize: 12, color: "#6B7280", marginTop: 4 }}>
                      Hides all revenue and billing options. Requires Admin PIN to unlock.
                    </Text>
                  </View>
                  <Switch 
                    value={isChefMode} 
                    onValueChange={toggleChefMode}
                    trackColor={{ false: "#D1D5DB", true: "#10B981" }}
                    thumbColor="#fff"
                  />
                </View>

                {/* Only allow setting PIN if they aren't currently locked in Chef Mode */}
                {!isChefMode && (
                  <View style={{ borderTopWidth: 1, borderTopColor: "#E5E7EB", paddingTop: 16 }}>
                    <Text style={styles.label}>Admin PIN (For unlocking Chef Mode)</Text>
                    
                    {profile?.admin_pin && !isUpdatingPin ? (
                      // SAVED STATE UI
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: "#F9FAFB", padding: 14, borderRadius: 10, borderWidth: 1, borderColor: "#E5E7EB" }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                          <Ionicons name="shield-checkmark" size={20} color="#10B981" />
                          <Text style={{ fontSize: 20, fontWeight: "800", letterSpacing: 4, color: "#111", paddingTop: 4 }}>••••</Text>
                        </View>
                        <TouchableOpacity onPress={() => setIsUpdatingPin(true)}>
                          <Text style={{ color: "#3B82F6", fontWeight: "700", fontSize: 14 }}>Update</Text>
                        </TouchableOpacity>
                      </View>
                    ) : (
                      // UPDATING / SETTING STATE UI
                      <View style={{ flexDirection: 'row', gap: 10 }}>
                        <TextInput
                          style={[styles.input, { flex: 1, letterSpacing: 8, fontWeight: "800", textAlign: "center" }]}
                          value={newPin}
                          onChangeText={setNewPin}
                          maxLength={4}
                          keyboardType="number-pad"
                          secureTextEntry
                          placeholder="••••"
                          autoFocus={isUpdatingPin}
                        />
                        <TouchableOpacity 
                          style={[styles.btn, { paddingHorizontal: 20, backgroundColor: newPin.length === 4 ? "#111" : "#D1D5DB", justifyContent: 'center' }]}
                          onPress={handleSetPin}
                          disabled={newPin.length !== 4 || savingPin}
                        >
                          {savingPin ? <ActivityIndicator color="#fff" /> : <Text style={{ color: "#fff", fontWeight: "700" }}>Save</Text>}
                        </TouchableOpacity>
                        
                        {profile?.admin_pin && isUpdatingPin && (
                          <TouchableOpacity 
                            style={[styles.btn, { backgroundColor: "#F3F4F6", borderWidth: 1, borderColor: "#E5E7EB", justifyContent: 'center' }]}
                            onPress={() => {
                              setIsUpdatingPin(false);
                              setNewPin("");
                            }}
                          >
                            <Text style={{ color: "#6B7280", fontWeight: "700" }}>Cancel</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    )}
                  </View>
                )}
              </View>

              {/* ----- REVIEWS BUTTON ----- */}
              {!editing && (
                <TouchableOpacity 
                  style={[styles.btn, { backgroundColor: "#F3F4F6", borderWidth: 1, borderColor: "#E5E7EB", marginTop: 16, flexDirection: "row", justifyContent: "center", gap: 8 }]} 
                  onPress={() => navigation.navigate("Reviews")}
                >
                  <Ionicons name="star" size={18} color="#F59E0B" />
                  <Text style={{ color: "#111", fontWeight: "700", fontSize: 15 }}>View Ratings & Reviews</Text>
                </TouchableOpacity>
              )}

              {/* ----- EDIT & SAVE BUTTONS ----- */}
              {editing ? (
                <View style={{ flexDirection: "row", gap: 12, marginTop: 16 }}>
                  <TouchableOpacity
                    style={[styles.btn, { flex: 1, backgroundColor: "#fff", borderWidth: 1.5, borderColor: "#111" }]}
                    onPress={() => {
                      setEditing(false);
                      setForm({ ...profile });
                    }}
                  >
                    <Text style={{ color: "#111", fontWeight: "700", fontSize: 15 }}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.btn, { flex: 1 }]} onPress={handleSave} disabled={saving}>
                    {saving ? <ActivityIndicator color="#fff" /> : <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>Save</Text>}
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity style={[styles.btn, { marginTop: 12 }]} onPress={() => setEditing(true)}>
                  <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>Edit Profile Data</Text>
                </TouchableOpacity>
              )}

              {/* ----- LOGOUT BUTTON ----- */}
              <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
                <Text style={styles.logoutText}>Logout of Account</Text>
              </TouchableOpacity>
            </>
          )}

        </View>
      </ScrollView>

      {/* RENDER THE CHEF PIN MODAL WHEN THEY TRY TO EXIT */}
      {showPinModal && (
        <ChefPinModal 
          visible={showPinModal} 
          onClose={() => setShowPinModal(false)}
          onSuccess={() => {
            setShowPinModal(false);
            setIsChefMode(false); // Unlock the app!
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  navHeader: { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#ebebeb", backgroundColor: "#fff" },
  logo: { width: 84, height: 84, borderRadius: 16 },
  label: { fontSize: 13, fontWeight: "600", color: "#555", marginBottom: 6 },
  input: { borderWidth: 1.5, borderColor: "#ddd", borderRadius: 10, padding: 13, fontSize: 15, color: "#111", backgroundColor: "#fff" },
  inputReadonly: { backgroundColor: "#f8f9fa", borderColor: "#ebebeb", color: "#555" },
  btn: { backgroundColor: "#111", borderRadius: 10, padding: 16, alignItems: "center" },
  logoutBtn: { marginTop: 20, marginBottom: 40, borderRadius: 10, borderWidth: 1.5, borderColor: "#dc3545", padding: 16, alignItems: "center", backgroundColor: "#fff" },
  logoutText: { color: "#dc3545", fontWeight: "700", fontSize: 15 },
  divider: { height: 1, backgroundColor: "#ddd", marginVertical: 24 },
  sectionHeader: { fontSize: 18, fontWeight: "800", color: "#111", marginBottom: 12 },
  cardSection: { backgroundColor: "#fff", padding: 16, borderRadius: 16, borderWidth: 1, borderColor: "#E5E7EB" },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  planCard: { backgroundColor: "#fff", borderRadius: 14, padding: 20, borderWidth: 1, borderColor: "#ebebeb", marginBottom: 8 },
  planName: { fontSize: 18, fontWeight: "700", color: "#111" },
  planPrice: { fontSize: 24, fontWeight: "800", color: "#111", marginTop: 4 },
  statusBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  statusText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  dateInfo: { marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: "#f0f0f0" },
  dateInfoLabel: { fontSize: 12, color: "#888" },
  dateInfoValue: { fontSize: 16, fontWeight: "700", color: "#111", marginTop: 2 },
  daysLeft: { marginTop: 8, fontSize: 14, fontWeight: "600" },
  renewBtn: { backgroundColor: "#111", borderRadius: 10, padding: 16, alignItems: "center", marginTop: 16, marginBottom: 8 },
  renewBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  referBtn: { backgroundColor: "#10B981", borderRadius: 10, padding: 14, alignItems: "center", marginTop: 8, marginBottom: 8, flexDirection: 'row', justifyContent: 'center', gap: 8 },
  referBtnText: { color: "#fff", fontWeight: "800", fontSize: 15 },
  note: { fontSize: 11, color: "#aaa", textAlign: "center", marginTop: 8 },
  
  // New Chef Mode Styles
  chefModeBanner: { backgroundColor: "#FEF3C7", padding: 16, borderRadius: 12, borderWidth: 1, borderColor: "#F59E0B", flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  unlockBtn: { backgroundColor: "#92400E", paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  unlockBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 }
});