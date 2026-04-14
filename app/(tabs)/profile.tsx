import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React from "react";
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/context/AuthContext";
import { useBookings } from "@/context/BookingsContext";
import { useColors } from "@/hooks/useColors";

const ROLE_CONFIG = {
  user: { color: "#0ea5e9", icon: "user" as const, label: "Customer" },
  worker: { color: "#8b5cf6", icon: "tool" as const, label: "Worker" },
  admin: { color: "#f59e0b", icon: "shield" as const, label: "Admin" },
};

export default function ProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, logout } = useAuth();
  const { bookings } = useBookings();

  if (!user) return null;

  const roleConfig = ROLE_CONFIG[user.role];

  const userBookings =
    user.role === "user"
      ? bookings.filter((b) => b.userId === user.id)
      : user.role === "worker"
      ? bookings.filter((b) => b.workerId === user.id)
      : bookings;

  const completed = userBookings.filter((b) => b.status === "completed").length;
  const totalSpent =
    user.role === "user"
      ? userBookings
          .filter((b) => b.status === "completed")
          .reduce((sum, b) => sum + b.price, 0)
      : 0;
  const totalEarned =
    user.role === "worker"
      ? userBookings
          .filter((b) => b.status === "completed")
          .reduce((sum, b) => sum + b.price, 0)
      : 0;

  async function handleLogout() {
    if (Platform.OS === "web") {
      const ok = window.confirm("Are you sure you want to sign out?");
      if (ok) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        await logout();
        router.replace("/welcome");
      }
      return;
    }

    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: async () => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          await logout();
          router.replace("/welcome");
        },
      },
    ]);
  }

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: colors.background }]}
      contentContainerStyle={[
        styles.scroll,
        {
          paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) + 16,
          paddingBottom: insets.bottom + 34,
        },
      ]}
      showsVerticalScrollIndicator={false}
    >
      {/* Profile Hero */}
      <View style={styles.profileHero}>
        <View
          style={[
            styles.avatarLarge,
            { backgroundColor: roleConfig.color + "20" },
          ]}
        >
          <Feather name={roleConfig.icon} size={36} color={roleConfig.color} />
        </View>
        <Text style={[styles.profileName, { color: colors.foreground }]}>
          {user.name}
        </Text>
        <View
          style={[
            styles.roleBadge,
            { backgroundColor: roleConfig.color + "15" },
          ]}
        >
          <Text style={[styles.roleLabel, { color: roleConfig.color }]}>
            {roleConfig.label}
          </Text>
        </View>
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <View
          style={[
            styles.statItem,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.statNumber, { color: colors.foreground }]}>
            {userBookings.length}
          </Text>
          <Text style={[styles.statLbl, { color: colors.mutedForeground }]}>
            {user.role === "admin" ? "Total" : "Bookings"}
          </Text>
        </View>
        <View
          style={[
            styles.statItem,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.statNumber, { color: colors.foreground }]}>
            {completed}
          </Text>
          <Text style={[styles.statLbl, { color: colors.mutedForeground }]}>
            Completed
          </Text>
        </View>
        {user.role === "user" ? (
          <View
            style={[
              styles.statItem,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.statNumber, { color: "#0ea5e9" }]}>
              ₹{totalSpent}
            </Text>
            <Text style={[styles.statLbl, { color: colors.mutedForeground }]}>
              Spent
            </Text>
          </View>
        ) : user.role === "worker" ? (
          <View
            style={[
              styles.statItem,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.statNumber, { color: "#22c55e" }]}>
              ₹{totalEarned}
            </Text>
            <Text style={[styles.statLbl, { color: colors.mutedForeground }]}>
              Earned
            </Text>
          </View>
        ) : null}
      </View>

      {/* Info */}
      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
        Account Info
      </Text>
      {[
        { icon: "user" as const, label: "Full Name", value: user.name },
        { icon: "mail" as const, label: "Email", value: user.email },
        { icon: "phone" as const, label: "Phone", value: user.phone },
        {
          icon: roleConfig.icon,
          label: "Role",
          value: roleConfig.label,
        },
      ].map((item) => (
        <View
          key={item.label}
          style={[
            styles.infoRow,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <View
            style={[
              styles.infoIcon,
              { backgroundColor: colors.secondary },
            ]}
          >
            <Feather name={item.icon} size={16} color={colors.mutedForeground} />
          </View>
          <View style={styles.infoContent}>
            <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>
              {item.label}
            </Text>
            <Text style={[styles.infoValue, { color: colors.foreground }]}>
              {item.value}
            </Text>
          </View>
        </View>
      ))}

      {/* Logout */}
      <TouchableOpacity
        style={[styles.logoutBtn, { borderColor: "#ef4444" + "40" }]}
        onPress={handleLogout}
        activeOpacity={0.85}
      >
        <Feather name="log-out" size={18} color="#ef4444" />
        <Text style={styles.logoutText}>Sign Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingHorizontal: 20 },
  profileHero: { alignItems: "center", marginBottom: 28 },
  avatarLarge: {
    width: 88,
    height: 88,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  profileName: { fontSize: 22, fontWeight: "800", letterSpacing: -0.3 },
  roleBadge: {
    marginTop: 6,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },
  roleLabel: { fontSize: 13, fontWeight: "700" },
  statsRow: { flexDirection: "row", gap: 10, marginBottom: 24 },
  statItem: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  statNumber: { fontSize: 20, fontWeight: "800" },
  statLbl: { fontSize: 11, marginTop: 3, fontWeight: "500" },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 12,
    letterSpacing: -0.2,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 8,
    gap: 12,
  },
  infoIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  infoContent: { flex: 1 },
  infoLabel: { fontSize: 12, fontWeight: "500" },
  infoValue: { fontSize: 15, fontWeight: "600", marginTop: 2 },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    borderRadius: 14,
    borderWidth: 1.5,
    gap: 8,
    marginTop: 16,
  },
  logoutText: { color: "#ef4444", fontSize: 15, fontWeight: "700" },
});
