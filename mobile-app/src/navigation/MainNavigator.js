import React from "react";
import { Platform } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context"; 
import { useAuth } from "../context/AuthContext"; // <-- 1. IMPORT AUTH CONTEXT

// Import your screens
import DashboardScreen from "../screens/DashboardScreen";
import OrdersScreen from "../screens/OrdersScreen";
import MenuScreen from "../screens/MenuScreen";
import TablesScreen from "../screens/TablesScreen";
import AnalyticsScreen from "../screens/AnalyticsScreen";
import ProfileScreen from "../screens/ProfileScreen";
import ReferralsScreen from "../screens/ReferralsScreen"; 
import ReviewsScreen from '../screens/ReviewsScreen';
import AdvisorScreen from "../screens/AdvisorScreen";
const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

// 1. The Premium Bottom Tabs
function TabNavigator() {
  const insets = useSafeAreaInsets(); 
  const { isChefMode } = useAuth(); // <-- 2. GRAB CHEF MODE STATE

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused, color }) => {
          let iconName;
          if (route.name === 'Dashboard') iconName = focused ? 'grid' : 'grid-outline';
          else if (route.name === 'Orders') iconName = focused ? 'receipt' : 'receipt-outline';
          else if (route.name === 'Menu') iconName = focused ? 'restaurant' : 'restaurant-outline';
          else if (route.name === 'Tables') iconName = focused ? 'scan' : 'scan-outline';
          else if (route.name === 'Analytics') iconName = focused ? 'bar-chart' : 'bar-chart-outline';

          return <Ionicons name={iconName} size={22} color={color} />;
        },
        tabBarActiveTintColor: '#111',
        tabBarInactiveTintColor: '#888',
        tabBarStyle: {
          backgroundColor: '#fff',
          borderTopWidth: 1,
          borderTopColor: '#E5E7EB',
          // DYNAMIC HEIGHT AND PADDING FOR SYSTEM NAV BAR:
          height: Platform.OS === 'ios' ? 85 : 65 + insets.bottom,
          paddingBottom: Platform.OS === 'ios' ? 25 : 8 + insets.bottom,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          marginTop: 2,
        }
      })}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} />
      <Tab.Screen name="Orders" component={OrdersScreen} />
      <Tab.Screen name="Menu" component={MenuScreen} />
      <Tab.Screen name="Tables" component={TablesScreen} />
      
      {/* 3. THE LOCK: Hide Analytics completely if Chef Mode is active */}
      {!isChefMode && (
        <Tab.Screen name="Analytics" component={AnalyticsScreen} />
      )}
    </Tab.Navigator>
  );
}

// 2. The Main Wrapper (Holds Tabs + Profile Page + Referrals Page)
export default function MainNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Tabs" component={TabNavigator} />
      <Stack.Screen name="Profile" component={ProfileScreen} />
      <Stack.Screen name="Referrals" component={ReferralsScreen} /> 
      <Stack.Screen name="Reviews" component={ReviewsScreen} />
      <Stack.Screen name="Advisor" component={AdvisorScreen} options={{ title: 'AI Business Advisor' }} />
    </Stack.Navigator>
  );
}