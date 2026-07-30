import React from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
} from "react-native";

export const WebPageLayout = ({ title, subtitle, children, onNavigate }) => {
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  return (
    <View style={s.root}>
      {/* NAVBAR */}
      <View style={s.nav}>
        <View style={s.navInner}>
          <TouchableOpacity onPress={() => onNavigate("landing")} activeOpacity={0.8}>
            <Text style={s.logo}>
              Servon<Text style={{ color: "#008060" }}>.</Text>
            </Text>
          </TouchableOpacity>

          {/* Desktop Links */}
         
          {/* Right Action Cluster */}
          <View style={s.navRightGroup}>
            <TouchableOpacity onPress={() => onNavigate("login")} activeOpacity={0.8}>
              <Text style={s.loginText}>Login</Text>
            </TouchableOpacity>

           
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
        {/* HERO HEADER */}
        <View style={[s.header, isMobile && s.headerMobile]}>
          <Text style={[s.pageTitle, isMobile && s.pageTitleMobile]}>{title}</Text>
          {subtitle && <Text style={[s.pageSub, isMobile && s.pageSubMobile]}>{subtitle}</Text>}
        </View>

        {/* MAIN BODY */}
        <View style={[s.mainBody, isMobile && s.mainBodyMobile]}>{children}</View>

        {/* FOOTER */}
        <View style={[f.footer, isMobile && f.footerMobile]}>
          <View style={[f.footerTop, isMobile && f.footerTopMobile]}>
            <View style={f.fBrand}>
              <Text style={f.fLogo}>
                Servon<Text style={{ color: "#008060" }}>.</Text>
              </Text>
              <Text style={f.fTag}>
                The infrastructure for the next generation of Indian hospitality. Built for ownership.
              </Text>
            </View>

            <View style={[f.fLinksGrid, isMobile && f.fLinksGridMobile]}>
              <View style={f.fCol}>
                <Text style={f.fH}>PRODUCT</Text>
                {[
                  { n: "Features", s: "Features" },
                  { n: "Pricing", s: "Pricing" },
                  { n: "FAQ", s: "FAQ" },
                ].map((l) => (
                  <TouchableOpacity key={l.s} onPress={() => onNavigate(l.s)}>
                    <Text style={f.fL}>{l.n}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={f.fCol}>
                <Text style={f.fH}>COMPANY</Text>
                {[
                  { n: "About", s: "About" },
                  { n: "Contact Us", s: "Contact" },
                ].map((l) => (
                  <TouchableOpacity key={l.s} onPress={() => onNavigate(l.s)}>
                    <Text style={f.fL}>{l.n}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={f.fCol}>
                <Text style={f.fH}>LEGAL</Text>
                {[
                  { n: "Privacy", s: "PrivacyPolicy" },
                  { n: "Terms", s: "TermsOfService" },
                ].map((l) => (
                  <TouchableOpacity key={l.s} onPress={() => onNavigate(l.s)}>
                    <Text style={f.fL}>{l.n}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>

          <View style={f.divider} />
          
          <Text style={f.subCopy}>Servon Labs Private Limited, Pune, Maharashtra</Text>
          <Text style={f.copy}>© 2026 Servon. All rights reserved.</Text>
        </View>
      </ScrollView>

      {/* FLOATING ACTION BUTTON */}
      
    </View>
  );
};

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#FAF9F6" },
  
  // NAVBAR
  nav: {
    height: 72,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#EAEAEA",
    justifyContent: "center",
    zIndex: 100,
  },
  navInner: {
    maxWidth: 1200,
    alignSelf: "center",
    width: "100%",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  logo: { 
    color: "#000000", 
    fontSize: 22, 
    fontWeight: "800", 
    letterSpacing: -0.5 
  },
  desktopNavLinks: { 
    flexDirection: "row", 
    gap: 36, 
    alignItems: "center" 
  },
  navLinkText: { 
    color: "#555555", 
    fontSize: 15, 
    fontWeight: "500" 
  },
  navRightGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 20,
  },
  loginText: {
    color: "#000000",
    fontWeight: "600",
    fontSize: 14,
  },
  bookDemoBtn: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#000000",
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 8,
  },
  bookDemoText: { 
    color: "#000000", 
    fontWeight: "700", 
    fontSize: 13 
  },

  scrollContent: { flexGrow: 1 },

  // HERO HEADER
  header: {
    paddingTop: 60,
    paddingBottom: 48,
    paddingHorizontal: 20,
    alignItems: "center",
    backgroundColor: "#FAF9F6",
  },
  headerMobile: {
    paddingTop: 40,
    paddingBottom: 32,
  },
  pageTitle: {
    fontSize: 40,
    fontWeight: "800",
    color: "#000000",
    textAlign: "center",
    letterSpacing: -0.8,
  },
  pageTitleMobile: {
    fontSize: 30,
  },
  pageSub: {
    fontSize: 16,
    color: "#666666",
    marginTop: 12,
    textAlign: "center",
    maxWidth: 580,
    lineHeight: 24,
  },
  pageSubMobile: {
    fontSize: 14,
    lineHeight: 20,
  },

  mainBody: {
    maxWidth: 1100,
    alignSelf: "center",
    width: "100%",
    paddingHorizontal: 24,
    paddingBottom: 60,
  },
  mainBodyMobile: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },

  // FLOATING BUTTON
  floatingFab: {
    position: "absolute",
    bottom: 24,
    right: 24,
    backgroundColor: "#1D2125",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  floatingFabText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
});

const f = StyleSheet.create({
  // PURE BLACK FOOTER MATCHING LANDING PAGE
  footer: { 
    backgroundColor: "#000000", 
    paddingTop: 80, 
    paddingBottom: 40, 
    paddingHorizontal: 32 
  },
  footerMobile: { 
    paddingTop: 50, 
    paddingHorizontal: 20 
  },
  footerTop: {
    maxWidth: 1100,
    alignSelf: "center",
    width: "100%",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  footerTopMobile: {
    flexDirection: "column",
    gap: 40,
  },
  fBrand: { 
    flex: 1, 
    maxWidth: 320 
  },
  fLogo: { 
    fontSize: 24, 
    fontWeight: "800", 
    color: "#FFFFFF" 
  },
  fTag: { 
    color: "#888888", 
    marginTop: 16, 
    fontSize: 14, 
    lineHeight: 22 
  },
  fLinksGrid: { 
    flexDirection: "row", 
    gap: 72 
  },
  fLinksGridMobile: { 
    gap: 32,
    flexWrap: "wrap",
  },
  fCol: {
    minWidth: 100,
  },
  fH: { 
    fontWeight: "800", 
    color: "#FFFFFF", 
    marginBottom: 20, 
    fontSize: 12, 
    letterSpacing: 1.2 
  },
  fL: { 
    color: "#888888", 
    marginBottom: 14, 
    fontSize: 14, 
    fontWeight: "500" 
  },
  divider: {
    height: 1,
    backgroundColor: "#1A1A1A",
    marginVertical: 40,
    maxWidth: 1100,
    alignSelf: "center",
    width: "100%",
  },
  subCopy: { 
    textAlign: "center", 
    color: "#555555", 
    fontSize: 12,
    marginBottom: 6,
  },
  copy: { 
    textAlign: "center", 
    color: "#555555", 
    fontSize: 12 
  },
});