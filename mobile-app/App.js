import { NavigationContainer } from "@react-navigation/native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider, useAuth } from "./src/context/AuthContext";
import AuthNavigator from "./src/navigation/AuthNavigator";
import MainNavigator from "./src/navigation/MainNavigator";
import { StatusBar } from "expo-status-bar";
import { View, ActivityIndicator } from "react-native";

function Root() {
  const { token, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#111" />
      </View>
    );
  }

  return token ? <MainNavigator /> : <AuthNavigator />;
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <NavigationContainer>
          <StatusBar style="dark" />
          <Root />
        </NavigationContainer>
      </AuthProvider>
    </SafeAreaProvider>
  );
}