import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import { supabase } from "@/lib/supabase";

export default function RegisterScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { register } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleRegister() {
    setError("");
    if (!name || !email || !phone || !password) {
      setError("Please fill in all fields");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    setLoading(true);
    const result = await register(name, email.trim(), phone, password, "user");
    setLoading(false);

    if (result.success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // Auto-Detect Location Permission & Coordinates
      let locationSaved = false;
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === "granted") {
          const location = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });

          const { latitude, longitude } = location.coords;
          const [addressObj] = await Location.reverseGeocodeAsync({
            latitude,
            longitude,
          });

          let fullAddress = "Current GPS Location";
          let city = "";
          let state = "";
          let country = "";
          let pincode = "";

          if (addressObj) {
            city = addressObj.city || addressObj.subregion || "";
            state = addressObj.region || "";
            country = addressObj.country || "";
            pincode = addressObj.postalCode || "";

            const parts = [
              addressObj.streetNumber,
              addressObj.street,
              addressObj.district,
              city,
              state,
              country,
            ].filter(Boolean);

            fullAddress = parts.join(", ") || "Current GPS Location";
          }

          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user) {
            await supabase.from("addresses").insert({
              user_id: session.user.id,
              latitude,
              longitude,
              full_address: fullAddress,
              city,
              state,
              country,
              pincode,
              is_default: true,
            });
            locationSaved = true;
          }
        }
      } catch (err) {
        console.error("Failed to automatically detect location on register", err);
      }

      if (locationSaved) {
        router.replace("/(tabs)");
      } else {
        // Fallback to manual address selection
        router.replace("/add-address");
      }
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(`❌ ${result.error || "Registration failed"}`);
    }
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            {
              paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0),
              paddingBottom: insets.bottom + 40,
            },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Feather name="arrow-left" size={22} color={colors.foreground} />
          </TouchableOpacity>

          {/* Logo */}
          <View style={styles.logoArea}>
            <View style={styles.logoWrap}>
              <Image
                source={require("@/assets/images/zentro_logo.png")}
                style={styles.logo}
                contentFit="cover"
              />
            </View>
          </View>

          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.foreground }]}>
              🎉 Create Account
            </Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
              Join Zentro today
            </Text>
          </View>

          <View style={styles.form}>
            {[
              { field: name, setField: setName, emoji: "👤", placeholder: "Full name", type: "default" as const, cap: "words" as const },
              { field: email, setField: setEmail, emoji: "📧", placeholder: "Email address", type: "email-address" as const, cap: "none" as const },
              { field: phone, setField: setPhone, emoji: "📱", placeholder: "Phone number", type: "phone-pad" as const, cap: "none" as const },
            ].map(({ field, setField, emoji, placeholder, type, cap }) => (
              <View
                key={placeholder}
                style={[styles.inputWrap, { backgroundColor: colors.card, borderColor: colors.border }]}
              >
                <Text style={styles.inputEmoji}>{emoji}</Text>
                <TextInput
                  style={[styles.input, { color: colors.foreground }]}
                  placeholder={placeholder}
                  placeholderTextColor={colors.mutedForeground}
                  value={field}
                  onChangeText={setField}
                  autoCapitalize={cap}
                  keyboardType={type}
                  autoCorrect={false}
                />
              </View>
            ))}

            <View
              style={[styles.inputWrap, { backgroundColor: colors.card, borderColor: colors.border }]}
            >
              <Text style={styles.inputEmoji}>🔒</Text>
              <TextInput
                style={[styles.input, { color: colors.foreground }]}
                placeholder="Password"
                placeholderTextColor={colors.mutedForeground}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPw}
              />
              <TouchableOpacity onPress={() => setShowPw((v) => !v)}>
                <Feather name={showPw ? "eye-off" : "eye"} size={18} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <TouchableOpacity
              style={[styles.registerBtn, { backgroundColor: colors.primary }, loading && { opacity: 0.7 }]}
              onPress={handleRegister}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.registerBtnText}>🎉 Create Account</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.loginLink} onPress={() => router.back()}>
              <Text style={[styles.loginLinkText, { color: colors.mutedForeground }]}>
                Already have an account?{" "}
                <Text style={{ color: colors.primary, fontWeight: "700" }}>Sign In</Text>
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  scroll: { flexGrow: 1, paddingHorizontal: 24 },
  backBtn: { marginBottom: 8, padding: 4, alignSelf: "flex-start" },
  logoArea: { alignItems: "center", marginBottom: 16 },
  logoWrap: {
    width: 70,
    height: 70,
    borderRadius: 35,
    overflow: "hidden",
    shadowColor: "#dc2626",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  logo: { width: 70, height: 70 },
  header: { marginBottom: 24 },
  title: { fontSize: 26, fontWeight: "800", letterSpacing: -0.5 },
  subtitle: { fontSize: 14, marginTop: 4 },
  form: { gap: 12 },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 10,
  },
  inputEmoji: { fontSize: 18 },
  input: { flex: 1, fontSize: 15 },
  errorText: { color: "#ef4444", fontSize: 13, textAlign: "center" },
  registerBtn: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    borderRadius: 14,
    marginTop: 4,
  },
  registerBtnText: { color: "#fff", fontSize: 16, fontWeight: "800" },
  loginLink: { alignItems: "center", paddingVertical: 8 },
  loginLinkText: { fontSize: 14 },
});
