import { View, Text, TouchableOpacity, StyleSheet } from "react-native"; 
import { useAuth } from "../context/AuthContext"; 
import { useNavigation } from "@react-navigation/native"; 

export default function SubscriptionBanner() { 
  const { business } = useAuth(); 
  const navigation = useNavigation(); 

  if (!business) return null; 

  const status = business.subscription_status; 
  const endDate = business.subscription_end_date ? new Date(business.subscription_end_date) : null; 
  const now = new Date(); 
  const daysLeft = endDate ? Math.ceil((endDate - now) / (1000 * 60 * 60 * 24)) : 0; 

  if (status === "INACTIVE") { 
    return ( 
      <View style={[styles.banner, { backgroundColor: "#1a1a1a" }]}> 
        <Text style={styles.bannerText}>Your account is inactive. Activate Servon to start receiving orders.</Text>
        {/* CHANGED TO Profile */}
        <TouchableOpacity onPress={() => navigation.navigate("Profile")}> 
          <Text style={styles.bannerAction}>Activate →</Text> 
        </TouchableOpacity> 
      </View> 
    ); 
  } 
   
  if (status === "EXPIRED") { 
    return ( 
      <View style={[styles.banner, { backgroundColor: "#dc3545" }]}> 
        <Text style={styles.bannerText}>Subscription expired. Renew to continue.</Text> 
        {/* CHANGED TO Profile */}
        <TouchableOpacity onPress={() => navigation.navigate("Profile")}> 
          <Text style={styles.bannerAction}>Renew →</Text> 
        </TouchableOpacity> 
      </View> 
    ); 
  } 
   
  if (status === "ACTIVE" && daysLeft <= 5) { 
    return ( 
      <View style={[styles.banner, { backgroundColor: "#fd7e14" }]}> 
        <Text style={styles.bannerText}>Subscription expires in {daysLeft} day{daysLeft !== 1 ? "s" : ""}.</Text> 
        {/* CHANGED TO Profile */}
        <TouchableOpacity onPress={() => navigation.navigate("Profile")}> 
          <Text style={styles.bannerAction}>Renew →</Text> 
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
});