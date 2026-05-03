import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
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

type Step = "form" | "otp";

export default function RegisterScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { register } = useAuth();

  const [step, setStep] = useState<Step>("form");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [address, setAddress] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // OTP-specific states
  const [generatedOtp, setGeneratedOtp] = useState("");
  const [userOtp, setUserOtp] = useState("");

  // Email regex for inline real-time validation
  const isValidEmail = (text: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text);
  };

  const emailHasError = email.length > 0 && !isValidEmail(email);

  // Address auto-fill using expo-location
  async function handleAutoFillLocation() {
    setError("");
    setLoading(true);
    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setError("Permission to access location was denied");
        setLoading(false);
        return;
      }

      let location = await Location.getCurrentPositionAsync({});
      const { latitude, longitude } = location.coords;

      // Reverse geocode via built-in Location API or direct Google API if configured
      let reverseGeo = await Location.reverseGeocodeAsync({ latitude, longitude });
      if (reverseGeo && reverseGeo.length > 0) {
        const item = reverseGeo[0];
        const readableAddress = [
          item.streetNumber,
          item.street,
          item.city,
          item.region,
          item.postalCode,
          item.country,
        ]
          .filter(Boolean)
          .join(", ");

        setAddress(readableAddress || `${latitude}, ${longitude}`);
      } else {
        setAddress(`${latitude}, ${longitude}`);
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      console.error("Location error:", e);
      setError("Failed to fetch current location. Please enter it manually.");
    } finally {
      setLoading(false);
    }
  }

  // Prepares the OTP code and advances step
  async function handleFormSubmit() {
    setError("");
    if (!name.trim() || !email.trim() || !phone.trim() || !password || !address.trim()) {
      setError("Please fill in all fields");
      return;
    }
    if (emailHasError) {
      setError("Please enter a valid email address");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setLoading(true);
    try {
      // 1. Create random 6-digit OTP
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      setGeneratedOtp(otp);

      // 2. Alert / Console feedback for easy testing/debugging in development
      Alert.alert(
        "📩 OTP Code Sent",
        `A 6-digit code has been sent to ${email}.\n\nYour code is: ${otp}`,
        [{ text: "OK" }]
      );
      console.log(`[DEVELOPMENT] OTP Code for ${email} is: ${otp}`);

      setStep("otp");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      setError(e.message || "Failed to proceed to verification.");
    } finally {
      setLoading(false);
    }
  }

  // Completes the OTP verification and creates user
  async function handleOtpVerify() {
    setError("");
    if (userOtp.trim() !== generatedOtp) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError("Invalid OTP code. Please try again.");
      return;
    }

    setLoading(true);
    const result = await register(name, email.trim(), phone, password, "user", address.trim());
    setLoading(false);

    if (result.success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace("/(tabs)");
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(`❌ ${result.error || "Registration failed. Please try again."}`);
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

          {/* Logo Area */}
          <View style={styles.logoArea}>
            <View style={styles.logoWrap}>
              <Image
                source={require("@/assets/images/zentro_logo.png")}
                style={styles.logo}
                contentFit="cover"
              />
            </View>
          </View>

          {step === "form" && (
            <>
              <View style={styles.header}>
                <Text style={[styles.title, { color: colors.foreground }]}>
                  🎉 Create Account
                </Text>
                <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
                  Join Zentro today
                </Text>
              </View>

              <View style={styles.form}>
                {/* Name Field */}
                <View style={[styles.inputWrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <Text style={styles.inputEmoji}>👤</Text>
                  <TextInput
                    style={[styles.input, { color: colors.foreground }]}
                    placeholder="Full name"
                    placeholderTextColor={colors.mutedForeground}
                    value={name}
                    onChangeText={setName}
                    autoCapitalize="words"
                    autoCorrect={false}
                  />
                </View>

                {/* Email Field with real-time error */}
                <View style={[styles.inputWrap, { backgroundColor: colors.card, borderColor: emailHasError ? "#ef4444" : colors.border }]}>
                  <Text style={styles.inputEmoji}>📧</Text>
                  <TextInput
                    style={[styles.input, { color: colors.foreground }]}
                    placeholder="Email address"
                    placeholderTextColor={colors.mutedForeground}
                    value={email}
                    onChangeText={setEmail}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    autoCorrect={false}
                  />
                </View>
                {emailHasError && (
                  <Text style={styles.inlineError}>⚠️ Please enter a valid email format</Text>
                )}

                {/* Phone Field */}
                <View style={[styles.inputWrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <Text style={styles.inputEmoji}>📱</Text>
                  <TextInput
                    style={[styles.input, { color: colors.foreground }]}
                    placeholder="Phone number"
                    placeholderTextColor={colors.mutedForeground}
                    value={phone}
                    onChangeText={setPhone}
                    autoCapitalize="none"
                    keyboardType="phone-pad"
                  />
                </View>

                {/* Complete Address Field with Auto Fill */}
                <View style={[styles.inputWrap, { backgroundColor: colors.card, borderColor: colors.border, alignItems: "flex-start" }]}>
                  <Text style={[styles.inputEmoji, { marginTop: 4 }]}>🏠</Text>
                  <TextInput
                    style={[styles.input, { color: colors.foreground, minHeight: 48 }]}
                    placeholder="Street, City, State, Country, Zip/Postal Code"
                    placeholderTextColor={colors.mutedForeground}
                    value={address}
                    onChangeText={setAddress}
                    multiline
                    numberOfLines={2}
                  />
                </View>
                <TouchableOpacity
                  style={[styles.locationBtn, { borderColor: colors.primary }]}
                  onPress={handleAutoFillLocation}
                  activeOpacity={0.8}
                >
                  <Feather name="map-pin" size={14} color={colors.primary} />
                  <Text style={[styles.locationBtnText, { color: colors.primary }]}>
                    Use Current Location
                  </Text>
                </TouchableOpacity>

                {/* Password Field */}
                <View style={[styles.inputWrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
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
                  onPress={handleFormSubmit}
                  disabled={loading}
                  activeOpacity={0.85}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.registerBtnText}>✨ Send OTP Code</Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity style={styles.loginLink} onPress={() => router.back()}>
                  <Text style={[styles.loginLinkText, { color: colors.mutedForeground }]}>
                    Already have an account?{" "}
                    <Text style={{ color: colors.primary, fontWeight: "700" }}>Sign In</Text>
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          {step === "otp" && (
            <>
              <View style={styles.header}>
                <Text style={[styles.title, { color: colors.foreground }]}>
                  🔢 Verification Required
                </Text>
                <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
                  We've sent a 6-digit verification code to <Text style={{fontWeight:'700'}}>{email}</Text>
                </Text>
              </View>

              <View style={styles.form}>
                <View style={[styles.inputWrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <Text style={styles.inputEmoji}>🔑</Text>
                  <TextInput
                    style={[styles.input, { color: colors.foreground, letterSpacing: 4, fontWeight: "700" }]}
                    placeholder="000000"
                    placeholderTextColor={colors.mutedForeground}
                    value={userOtp}
                    onChangeText={setUserOtp}
                    keyboardType="number-pad"
                    maxLength={6}
                  />
                </View>

                {error ? <Text style={styles.errorText}>{error}</Text> : null}

                <TouchableOpacity
                  style={[styles.registerBtn, { backgroundColor: colors.primary }, loading && { opacity: 0.7 }]}
                  onPress={handleOtpVerify}
                  disabled={loading}
                  activeOpacity={0.85}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.registerBtnText}>🛡️ Verify and Create Account</Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity 
                  style={styles.loginLink} 
                  onPress={() => {
                    setStep("form");
                    setUserOtp("");
                  }}
                >
                  <Text style={[styles.loginLinkText, { color: colors.primary, fontWeight: "600" }]}>
                    Go back to form
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          )}
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
  subtitle: { fontSize: 14, marginTop: 4, lineHeight: 20 },
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
  inlineError: { color: "#ef4444", fontSize: 12, marginTop: -4, paddingLeft: 4 },
  errorText: { color: "#ef4444", fontSize: 13, textAlign: "center", marginTop: 4 },
  registerBtn: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    borderRadius: 14,
    marginTop: 4,
  },
  registerBtnText: { color: "#fff", fontSize: 16, fontWeight: "800" },
  locationBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderRadius: 12,
    paddingVertical: 10,
    gap: 8,
    borderStyle: "dashed",
    marginTop: -2,
    marginBottom: 4,
  },
  locationBtnText: { fontSize: 13, fontWeight: "700" },
  loginLink: { alignItems: "center", paddingVertical: 8 },
  loginLinkText: { fontSize: 14 },
});
