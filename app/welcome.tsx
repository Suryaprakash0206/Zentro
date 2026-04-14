import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import React, { useEffect, useRef } from "react";
import {
  Animated,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";

const FEATURES = [
  { emoji: "🚗", title: "Car Wash", desc: "Spotless exterior & interior cleaning at your doorstep" },
  { emoji: "🏍️", title: "Bike Wash", desc: "Deep clean & polish for your two-wheeler" },
  { emoji: "💧", title: "Tank Cleaning", desc: "Safe, hygienic water tank sanitization" },
];

export default function WelcomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    const nativeDriver = Platform.OS !== "web";
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 700,
        useNativeDriver: nativeDriver,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: nativeDriver,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 6,
        tension: 80,
        useNativeDriver: nativeDriver,
      }),
    ]).start();
  }, []);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Top red hero section */}
      <View style={[styles.hero, { backgroundColor: colors.primary, paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) + 20 }]}>
        <Animated.View style={[styles.logoWrap, { transform: [{ scale: scaleAnim }] }]}>
          <Image
            source={require("@/assets/images/zentro_logo.jpeg")}
            style={styles.logo}
            contentFit="cover"
          />
        </Animated.View>
        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
          <Text style={styles.appName}>Zentro</Text>
          <Text style={styles.tagline}>✨ Premium Cleaning, On Demand</Text>
        </Animated.View>
      </View>

      {/* Wave divider */}
      <View style={[styles.waveDivider, { backgroundColor: colors.primary }]}>
        <View style={[styles.waveBottom, { backgroundColor: colors.background }]} />
      </View>

      {/* Features */}
      <Animated.View
        style={[
          styles.featuresSection,
          { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
        ]}
      >
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
          🌟 What We Offer
        </Text>
        {FEATURES.map((f, i) => (
          <View
            key={i}
            style={[
              styles.featureRow,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <Text style={styles.featureEmoji}>{f.emoji}</Text>
            <View style={styles.featureText}>
              <Text style={[styles.featureTitle, { color: colors.foreground }]}>
                {f.title}
              </Text>
              <Text style={[styles.featureDesc, { color: colors.mutedForeground }]}>
                {f.desc}
              </Text>
            </View>
            <View style={[styles.featureCheck, { backgroundColor: colors.primaryLight }]}>
              <Feather name="check" size={14} color={colors.primary} />
            </View>
          </View>
        ))}
      </Animated.View>

      {/* CTA Buttons */}
      <Animated.View
        style={[
          styles.ctaSection,
          {
            opacity: fadeAnim,
            paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 20),
          },
        ]}
      >
        <TouchableOpacity
          style={[styles.getStartedBtn, { backgroundColor: colors.primary }]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            router.push("/login");
          }}
          activeOpacity={0.85}
        >
          <Text style={styles.getStartedText}>🚀 Get Started</Text>
          <Feather name="arrow-right" size={20} color="#fff" />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.loginLink]}
          onPress={() => router.push("/login")}
        >
          <Text style={[styles.loginLinkText, { color: colors.mutedForeground }]}>
            Already have an account?{" "}
            <Text style={{ color: colors.primary, fontWeight: "700" }}>
              Sign In
            </Text>
          </Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  hero: {
    alignItems: "center",
    paddingBottom: 50,
    paddingHorizontal: 24,
  },
  logoWrap: {
    width: 140,
    height: 140,
    borderRadius: 70,
    overflow: "hidden",
    backgroundColor: "#fff",
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 10,
  },
  logo: {
    width: 140,
    height: 140,
  },
  appName: {
    fontSize: 40,
    fontWeight: "900",
    color: "#ffffff",
    textAlign: "center",
    letterSpacing: -1.5,
  },
  tagline: {
    fontSize: 15,
    color: "rgba(255,255,255,0.85)",
    textAlign: "center",
    marginTop: 6,
    fontWeight: "500",
  },
  waveDivider: {
    height: 40,
  },
  waveBottom: {
    height: 40,
    borderTopLeftRadius: 36,
    borderTopRightRadius: 36,
    marginTop: 0,
  },
  featuresSection: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 14,
    letterSpacing: -0.3,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 10,
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  featureEmoji: { fontSize: 28 },
  featureText: { flex: 1 },
  featureTitle: { fontSize: 15, fontWeight: "700" },
  featureDesc: { fontSize: 12, marginTop: 2, lineHeight: 16 },
  featureCheck: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaSection: {
    paddingHorizontal: 20,
    paddingTop: 12,
    gap: 12,
  },
  getStartedBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 17,
    borderRadius: 16,
    gap: 10,
    shadowColor: "#dc2626",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  getStartedText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "800",
  },
  loginLink: { alignItems: "center", paddingVertical: 4 },
  loginLinkText: { fontSize: 14 },
});
