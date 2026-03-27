import React from "react";
import { View, ScrollView, StyleSheet, Text, TouchableOpacity, Dimensions } from "react-native";
const { width } = Dimensions.get("window");

export const WebPageLayout = ({ title, subtitle, children, onNavigate }) => {
  return (
    <View style={s.root}>
      {/* GLOBAL BLACK NAVBAR */}
      <View style={s.nav}>
        <View style={s.navInner}>
          <TouchableOpacity onPress={() => onNavigate("landing")}>
            <Text style={s.logo}>Servon<Text style={{color: '#008060'}}>.</Text></Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.navBtn} onPress={() => onNavigate("login")}>
            <Text style={s.navBtnText}>Sign In</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={s.scrollContent}>
        <View style={s.header}>
          <Text style={s.pageTitle}>{title}</Text>
          {subtitle && <Text style={s.pageSub}>{subtitle}</Text>}
        </View>
        
        <View style={s.mainBody}>
          {children}
        </View>

        {/* GLOBAL BLACK FOOTER */}
        <View style={f.footer}>
          <View style={f.footerTop}>
            <View style={f.fBrand}>
              <Text style={f.fLogo}>Servon<Text style={{ color: '#008060' }}>.</Text></Text>
              <Text style={f.fTag}>The infrastructure for modern Indian hospitality. Built for ownership.</Text>
            </View>
            <View style={f.fLinksGrid}>
              <View style={f.fCol}>
                <Text style={f.fH}>PRODUCT</Text>
                {[{n:"Features",s:"Features"},{n:"Pricing",s:"Pricing"},{n:"FAQ",s:"FAQ"}].map(l => (
                  <TouchableOpacity key={l.s} onPress={() => onNavigate(l.s)}><Text style={f.fL}>{l.n}</Text></TouchableOpacity>
                ))}
              </View>
              <View style={f.fCol}>
                <Text style={f.fH}>LEGAL</Text>
                {[{n:"Privacy",s:"PrivacyPolicy"},{n:"Terms",s:"TermsOfService"}].map(l => (
                  <TouchableOpacity key={l.s} onPress={() => onNavigate(l.s)}><Text style={f.fL}>{l.n}</Text></TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
          <View style={f.divider} />
          <Text style={f.copy}>© 2026 Servon. All rights reserved.</Text>
        </View>
      </ScrollView>
    </View>
  );
};

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FAF9F6' },
  nav: { height: 80, backgroundColor: '#000', zIndex: 100 },
  navInner: { maxWidth: 1200, alignSelf: 'center', width: '100%', height: '100%', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 30 },
  logo: { color: '#FFF', fontSize: 22, fontWeight: '900' },
  navBtn: { backgroundColor: '#FFF', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 8 },
  navBtnText: { color: '#000', fontWeight: '700', fontSize: 13 },
  scrollContent: { flexGrow: 1 },
  header: { paddingTop: 100, paddingBottom: 60, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#EEE' },
  pageTitle: { fontSize: 44, fontWeight: '900', color: '#121417' },
  pageSub: { fontSize: 18, color: '#636E72', marginTop: 15, textAlign: 'center', maxWidth: 600 },
  mainBody: { maxWidth: 900, alignSelf: 'center', width: '100%', padding: 30, paddingBottom: 100 },
});

const f = StyleSheet.create({
  footer: { backgroundColor: "#000", paddingVertical: 80, paddingHorizontal: 30 },
  footerTop: { maxWidth: 1200, alignSelf: 'center', width: '100%', flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap' },
  fBrand: { flex: 1, minWidth: 280, marginBottom: 40 },
  fLogo: { fontSize: 24, fontWeight: '900', color: "#FFF" },
  fTag: { color: "#94A3B8", marginTop: 20, fontSize: 15, lineHeight: 24, maxWidth: 300 },
  fLinksGrid: { flexDirection: 'row', gap: 60 },
  fH: { fontWeight: '900', color: "#FFF", marginBottom: 20, fontSize: 12, letterSpacing: 1 },
  fL: { color: "#94A3B8", marginBottom: 12, fontSize: 15, fontWeight: '500' },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.1)', marginVertical: 40, maxWidth: 1200, alignSelf: 'center', width: '100%' },
  copy: { textAlign: 'center', color: '#64748B', fontSize: 13 }
});