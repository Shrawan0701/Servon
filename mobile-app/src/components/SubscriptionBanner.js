import { View, TouchableOpacity, StyleSheet } from "react-native";
import LocalizedText from "./LocalizedText";
import { useAuth } from "../context/AuthContext";
import { useNavigation } from "@react-navigation/native";

export default function SubscriptionBanner({ compact = false }) {
  const { business } = useAuth();
  const navigation = useNavigation();

  if (!business) return null;

  const status = business.subscription_status;
  const endDate = business.subscription_end_date ? new Date(business.subscription_end_date) : null;
  const now = new Date();
  const daysLeft = endDate ? Math.max(0, Math.ceil((endDate - now) / (1000 * 60 * 60 * 24))) : 0;
  const hasExpired = status === "EXPIRED" || (endDate && endDate < now);

  if (status === "INACTIVE") {
    return (
      <View style={[styles.banner, { backgroundColor: "#1a1a1a" }, compact && styles.compactInactive]}>
        <LocalizedText translate style={[styles.bannerText, compact && styles.compactInactiveText]}>Your account is inactive. Activate Servon to start receiving orders.</LocalizedText>
        <TouchableOpacity onPress={() => navigation.navigate("Profile")}>
          <LocalizedText translate style={[styles.bannerAction, compact && styles.compactInactiveText]}>Activate -&gt;</LocalizedText>
        </TouchableOpacity>
      </View>
    );
  }

  if (hasExpired) {
    return (
      <View style={[styles.banner, { backgroundColor: "#dc3545" }, compact && styles.compactExpired]}>
        <LocalizedText translate style={[styles.bannerText, compact && styles.compactExpiredText]}>Subscription expired. Renew now to continue your services.</LocalizedText>
        <TouchableOpacity onPress={() => navigation.navigate("Profile")}>
          <LocalizedText translate style={[styles.bannerAction, compact && styles.compactExpiredText]}>Renew -&gt;</LocalizedText>
        </TouchableOpacity>
      </View>
    );
  }

  if (status === "ACTIVE" && daysLeft <= 5) {
    return (
      <View style={[styles.banner, { backgroundColor: "#fd7e14" }, compact && styles.compactWarning]}>
        <LocalizedText style={[styles.bannerText, compact && styles.compactWarningText]} values={{ count: daysLeft }}>
          {daysLeft === 0 ? "Subscription expires today." : daysLeft === 1 ? "Subscription expires in {count} day." : "Subscription expires in {count} days."}
        </LocalizedText>
        <TouchableOpacity onPress={() => navigation.navigate("Profile")}>
          <LocalizedText translate style={[styles.bannerAction, compact && styles.compactWarningText]}>Renew -&gt;</LocalizedText>
        </TouchableOpacity>
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  banner: {
    padding: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  bannerText: { color: "#fff", fontSize: 13, flex: 1 },
  bannerAction: { color: "#fff", fontSize: 13, fontWeight: "700", marginLeft: 12 },
  compactInactive: { backgroundColor: "#EDF1EC", borderWidth: 1, borderColor: "#D8E1D5", borderRadius: 8, paddingHorizontal: 16, minHeight: 48 },
  compactInactiveText: { color: "#344E3E", lineHeight: 20 },
  compactExpired: { backgroundColor: "#FDF0ED", borderWidth: 1, borderColor: "#F0D0C9", borderRadius: 8, paddingHorizontal: 16, minHeight: 48 },
  compactExpiredText: { color: "#943F32", lineHeight: 20 },
  compactWarning: { backgroundColor: "#FFF7E8", borderWidth: 1, borderColor: "#EBDBB9", borderRadius: 8, paddingHorizontal: 16, minHeight: 48 },
  compactWarningText: { color: "#80581C", lineHeight: 20 },
});
