import React, { useState } from 'react';
import { Modal, View, Text as NativeText, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native";
import LocalizedText from "../components/LocalizedText";
import { Ionicons } from '@expo/vector-icons';
import { verifyAdminPin } from '../api';

export default function ChefPinModal({ visible, onClose, onSuccess }) {
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handlePress = async (num) => {
    if (pin.length >= 4) return;
    const newPin = pin + num;
    setPin(newPin);
    setError("");

    if (newPin.length === 4) {
      setLoading(true);
      try {
        const res = await verifyAdminPin(newPin);
        if (res.data.success) {
          setPin("");
          onSuccess();
        }
      } catch (err) {
        setError("Incorrect PIN. Try again.");
        setPin("");
      } finally {
        setLoading(false);
      }
    }
  };

  const handleDelete = () => setPin(pin.slice(0, -1));

  return (
    <Modal visible={visible} transparent={true} animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose} disabled={loading}>
            <Ionicons name="close" size={28} color="#111" />
          </TouchableOpacity>
          
          <Ionicons name="lock-closed" size={40} color="#111" style={{ alignSelf: 'center', marginBottom: 10 }} />
          <LocalizedText translate style={styles.title}>Owner Access</LocalizedText>
          <LocalizedText translate style={styles.subtitle}>Enter 4-digit PIN to exit Chef Mode</LocalizedText>

          <View style={styles.dotsContainer}>
            {[0, 1, 2, 3].map(i => (
              <View key={i} style={[styles.dot, pin.length > i && styles.dotFilled]} />
            ))}
          </View>

          {error ? <LocalizedText style={styles.error}>{error}</LocalizedText> : null}
          {loading ? <ActivityIndicator size="large" color="#111" style={{ marginVertical: 10 }} /> : null}

          <View style={styles.dialpad}>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
              <TouchableOpacity key={num} style={styles.key} onPress={() => handlePress(num.toString())}>
                <LocalizedText style={styles.keyText}>{num}</LocalizedText>
              </TouchableOpacity>
            ))}
            <View style={styles.key} />
            <TouchableOpacity style={styles.key} onPress={() => handlePress("0")}>
              <LocalizedText translate style={styles.keyText}>0</LocalizedText>
            </TouchableOpacity>
            <TouchableOpacity style={styles.key} onPress={handleDelete}>
              <Ionicons name="backspace-outline" size={28} color="#111" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { 
    flex: 1, 
    backgroundColor: "rgba(0,0,0,0.7)", 
    justifyContent: "center", 
    alignItems: "center" 
  },
  modal: { 
    backgroundColor: "#fff", 
    borderRadius: 24, 
    padding: 30, 
    width: "90%",
    maxWidth: 380,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10
  },
  closeBtn: { position: 'absolute', top: 20, right: 20, zIndex: 10 },
  title: { fontSize: 24, fontWeight: "800", textAlign: "center", color: "#111" },
  subtitle: { fontSize: 14, color: "#6B7280", textAlign: "center", marginTop: 5, marginBottom: 20 },
  dotsContainer: { flexDirection: "row", justifyContent: "center", gap: 15, marginBottom: 30 },
  dot: { width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: "#D1D5DB" },
  dotFilled: { backgroundColor: "#111", borderColor: "#111" },
  error: { color: "#EF4444", textAlign: "center", fontWeight: "600", marginBottom: 10 },
  dialpad: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 15 },
  key: { width: 70, height: 70, borderRadius: 35, backgroundColor: "#F3F4F6", justifyContent: "center", alignItems: "center" },
  keyText: { fontSize: 24, fontWeight: "700", color: "#111" }
});