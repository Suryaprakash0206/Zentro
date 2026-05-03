import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import * as Linking from "expo-linking";
import { useRouter } from "expo-router";
import React, { useState, useEffect } from "react";
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

type Step = "email" | "otp" | "reset" | "done";

export default function ForgotPasswordScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { sendResetOtp, verifyResetOtp, updatePassword } = useAuth();

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    // 1. Check initial launch via deep link URL
    Linking.getInitialURL().then((url) => {
      if (url) handleURL(url);
    });

    // 2. Listener for foreground deep links
    const sub = Linking.addEventListener("url", (event) => {
      handleURL(event.url);
    });

    return () => sub.remove();
  }, []);

  const handleURL = async (url: string) => {
    if (!url) return;
    try {
      console.log("Deep link caught:", url);
      let accessToken = "";
      let refreshToken = "";

      if (url.includes("#")) {
        const hash = url.split("#")[1];
        const params = new URLSearchParams(hash);
        accessToken = params.get("access_token") || "";
        refreshToken = params.get("refresh_token") || "";
      } else if (url.includes("?")) {
        const query = url.split("?")[1];
        const params = new URLSearchParams(query);
        accessToken = params.get("access_token") || "";
        refreshToken = params.get("refresh_token") || "";
      }

      if (accessToken && refreshToken) {
        setLoading(true);
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        setLoading(false);

        if (!error) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          setStep("reset");
        } else {
          setError(error.message);
        }
      }
    } catch (e: any) {
      console.error("Link parsing error", e);
    }
  };

  async function handleSendOtp() {
    setError("");
    if (!email.trim()) {
      setError("Please enter your email address");
      return;
    }
    setLoading(true);
    const result = await sendResetOtp(email.trim());
    setLoading(false);

    if (result.success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setStep("otp");
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      let errMsg = result.error || "Failed to send OTP. Please try again.";
      if (errMsg.toLowerCase().includes("rate limit") || errMsg.toLowerCase().includes("too many requests")) {
        errMsg = "⏳ Email Rate Limit Exceeded.\nSupabase limits email OTPs in development. Please wait a few minutes, or go to your Supabase Dashboard > Authentication > Providers > Email and increase the hourly rate limit.";
      }
      setError(errMsg);
    }
  }

  async function handleVerifyOtp() {
    setError("");
    if (!otp || otp.length < 6) {
      setError("Please enter the 6-digit OTP code");
      return;
    }
    setLoading(true);
    const result = await verifyResetOtp(email.trim(), otp.trim());
    setLoading(false);

    if (result.success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setStep("reset");
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(result.error || "Invalid OTP code. Please try again.");
    }
  }

  async function handleResetPassword() {
    setError("");
    if (!newPassword || !confirmPassword) {
      setError("Please fill in both fields");
      return;
    }
    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("❌ Passwords do not match");
      return;
    }
    setLoading(true);
    const result = await updatePassword(newPassword);
    setLoading(false);

    if (result.success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setStep("done");
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(result.error || "Failed to reset password. Please try again.");
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
              paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) + 8,
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

          {step === "email" && (
            <View style={styles.section}>
              <Text style={[styles.title, { color: colors.foreground }]}>
                🔐 Forgot Password?
              </Text>
              <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
                Enter your registered email to receive a 6-digit verification code.
              </Text>

              <View style={[styles.inputWrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
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

              {error ? <Text style={styles.errorText}>{error}</Text> : null}

              <TouchableOpacity
                style={[styles.btn, { backgroundColor: colors.primary }, loading && { opacity: 0.7 }]}
                onPress={handleSendOtp}
                disabled={loading}
                activeOpacity={0.85}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.btnText}>📩 Send Code</Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          {step === "otp" && (
            <View style={styles.section}>
              <Text style={[styles.title, { color: colors.foreground }]}>
                🔢 Enter Code
              </Text>
              <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
                We've sent a 6-digit code to <Text style={{fontWeight:'700'}}>{email}</Text>. Enter it below to verify.
              </Text>

              <View style={[styles.inputWrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={styles.inputEmoji}>🔑</Text>
                <TextInput
                  style={[styles.input, { color: colors.foreground, letterSpacing: 4, fontWeight: '700' }]}
                  placeholder="000000"
                  placeholderTextColor={colors.mutedForeground}
                  value={otp}
                  onChangeText={setOtp}
                  keyboardType="number-pad"
                  maxLength={6}
                />
              </View>

              {error ? <Text style={styles.errorText}>{error}</Text> : null}

              <TouchableOpacity
                style={[styles.btn, { backgroundColor: colors.primary }, loading && { opacity: 0.7 }]}
                onPress={handleVerifyOtp}
                disabled={loading}
                activeOpacity={0.85}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.btnText}>🛡️ Verify OTP</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.resendBtn} 
                onPress={() => setStep("email")}
                disabled={loading}
              >
                <Text style={[styles.resendText, { color: colors.primary }]}>
                  Wrong email? Go back
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {step === "reset" && (
            <View style={styles.section}>
              <View style={[styles.successBadge, { backgroundColor: "#22c55e15", borderColor: "#22c55e30" }]}>
                <Text style={styles.successIcon}>✅</Text>
                <Text style={[styles.successText, { color: "#22c55e" }]}>
                  Code verified! Set your new password below.
                </Text>
              </View>

              <Text style={[styles.title, { color: colors.foreground }]}>
                🔑 New Password
              </Text>

              <View style={[styles.inputWrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={styles.inputEmoji}>🔒</Text>
                <TextInput
                  style={[styles.input, { color: colors.foreground }]}
                  placeholder="New password"
                  placeholderTextColor={colors.mutedForeground}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  secureTextEntry={!showPw}
                />
                <TouchableOpacity onPress={() => setShowPw((v) => !v)}>
                  <Feather name={showPw ? "eye-off" : "eye"} size={18} color={colors.mutedForeground} />
                </TouchableOpacity>
              </View>

              <View style={[styles.inputWrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={styles.inputEmoji}>🔒</Text>
                <TextInput
                  style={[styles.input, { color: colors.foreground }]}
                  placeholder="Confirm new password"
                  placeholderTextColor={colors.mutedForeground}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={!showConfirmPw}
                />
                <TouchableOpacity onPress={() => setShowConfirmPw((v) => !v)}>
                  <Feather name={showConfirmPw ? "eye-off" : "eye"} size={18} color={colors.mutedForeground} />
                </TouchableOpacity>
              </View>

              {error ? <Text style={styles.errorText}>{error}</Text> : null}

              <TouchableOpacity
                style={[styles.btn, { backgroundColor: colors.primary }, loading && { opacity: 0.7 }]}
                onPress={handleResetPassword}
                disabled={loading}
                activeOpacity={0.85}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.btnText}>✨ Reset Password</Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          {step === "done" && (
            <View style={styles.section}>
              <View style={styles.doneContainer}>
                <View style={[styles.doneIconWrap, { backgroundColor: "#22c55e15" }]}>
                  <Text style={styles.doneIcon}>🎉</Text>
                </View>
                <Text style={[styles.doneTitle, { color: colors.foreground }]}>
                  Password Reset!
                </Text>
                <Text style={[styles.doneSubtitle, { color: colors.mutedForeground }]}>
                  Your password has been successfully updated. You can now sign in with your new password.
                </Text>
                <TouchableOpacity
                  style={[styles.btn, { backgroundColor: colors.primary }]}
                  onPress={() => router.replace("/login")}
                  activeOpacity={0.85}
                >
                  <Text style={styles.btnText}>🚀 Go to Sign In</Text>
                </TouchableOpacity>
              </View>
            </View>
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
  logoArea: { alignItems: "center", marginBottom: 20 },
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
  section: { gap: 14 },
  title: { fontSize: 24, fontWeight: "800", letterSpacing: -0.5 },
  subtitle: { fontSize: 14, lineHeight: 20, marginTop: -4 },
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
  btn: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    borderRadius: 14,
    marginTop: 4,
  },
  btnText: { color: "#fff", fontSize: 16, fontWeight: "800" },
  successBadge: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    gap: 10,
  },
  successIcon: { fontSize: 20 },
  successText: { flex: 1, fontSize: 13, fontWeight: "600" },
  doneContainer: { alignItems: "center", gap: 16, paddingTop: 20 },
  doneIconWrap: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
  },
  doneIcon: { fontSize: 48 },
  doneTitle: { fontSize: 26, fontWeight: "900", letterSpacing: -0.5 },
  doneSubtitle: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
    paddingHorizontal: 10,
  },
  resendBtn: { alignItems: "center", marginTop: 8 },
  resendText: { fontSize: 13, fontWeight: "700" },
});
