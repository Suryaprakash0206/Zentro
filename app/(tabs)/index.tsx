import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import React, { useEffect } from "react";
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ServiceCard } from "@/components/ServiceCard";
import { StatCard } from "@/components/StatCard";
import { useAuth } from "@/context/AuthContext";
import { useBookings } from "@/context/BookingsContext";
import { useServicePrices } from "@/context/ServicePricesContext";
import { useColors } from "@/hooks/useColors";

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const { bookings, getBookingsByUser } = useBookings();
  const { getPrice } = useServicePrices();

  useEffect(() => {
    if (!user) {
      router.replace("/welcome");
    }
  }, [user]);

  if (!user) return null;

  if (user.role === "admin") {
    const totalEarnings = bookings
      .filter((b) => b.status === "completed")
      .reduce((sum, b) => sum + b.price, 0);
    const pending = bookings.filter((b) => b.status === "pending").length;
    const completed = bookings.filter((b) => b.status === "completed").length;
    const active = bookings.filter(
      (b) => b.status === "accepted" || b.status === "in_progress"
    ).length;

    return (
      <ScrollView
        style={[styles.root, { backgroundColor: colors.background }]}
        contentContainerStyle={[
          styles.scroll,
          {
            paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0),
            paddingBottom: insets.bottom + 34,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.adminHeader}>
          <View>
            <Text style={[styles.greeting, { color: colors.mutedForeground }]}>
              🛡️ Admin Dashboard
            </Text>
            <Text style={[styles.name, { color: colors.foreground }]}>
              {user.name}
            </Text>
          </View>
          <View style={[styles.logoBadge]}>
            <View style={styles.miniLogoWrap}>
              <Image
                source={require("@/assets/images/zentro_logo.png")}
                style={styles.miniLogo}
                contentFit="cover"
              />
            </View>
          </View>
        </View>

        <View style={styles.statsGrid}>
          <StatCard icon="dollar-sign" label="💰 Total Earnings" value={`₹${totalEarnings.toLocaleString("en-IN")}`} color="#22c55e" trend="+12% this week" />
          <StatCard icon="clock" label="⏳ Pending" value={pending.toString()} color="#f59e0b" />
        </View>
        <View style={[styles.statsGrid, { marginTop: 10 }]}>
          <StatCard icon="activity" label="⚡ Active Jobs" value={active.toString()} color="#3b82f6" />
          <StatCard icon="check-circle" label="✅ Completed" value={completed.toString()} color="#22c55e" />
        </View>

        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
          📋 Recent Bookings
        </Text>
        {bookings.slice(-5).reverse().map((b) => (
          <TouchableOpacity
            key={b.id}
            style={[styles.recentRow, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => router.push("/(tabs)/bookings")}
          >
            <View style={[styles.recentIcon, { backgroundColor: colors.primary + "15" }]}>
              <Feather name="calendar" size={16} color={colors.primary} />
            </View>
            <View style={styles.recentInfo}>
              <Text style={[styles.recentTitle, { color: colors.foreground }]}>{b.serviceLabel}</Text>
              <Text style={[styles.recentSub, { color: colors.mutedForeground }]}>{b.userName}</Text>
            </View>
            <Text style={[styles.recentPrice, { color: colors.primary }]}>₹{b.price}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    );
  }

  if (user.role === "worker") {
    const myBookings = bookings.filter((b) => b.workerId === user.id && b.status !== "cancelled");
    const earnings = myBookings.filter((b) => b.status === "completed").reduce((sum, b) => sum + b.price, 0);
    const pending = bookings.filter((b) => b.status === "pending").length;
    const activeJobs = myBookings.filter((b) => b.status === "accepted" || b.status === "in_progress").length;

    return (
      <ScrollView
        style={[styles.root, { backgroundColor: colors.background }]}
        contentContainerStyle={[
          styles.scroll,
          {
            paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0),
            paddingBottom: insets.bottom + 34,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.adminHeader}>
          <View>
            <Text style={[styles.greeting, { color: colors.mutedForeground }]}>
              🔧 Welcome back,
            </Text>
            <Text style={[styles.name, { color: colors.foreground }]}>{user.name}</Text>
          </View>
          <View style={styles.miniLogoWrap}>
            <Image
              source={require("@/assets/images/zentro_logo.png")}
              style={styles.miniLogo}
              contentFit="cover"
            />
          </View>
        </View>

        <View style={styles.statsGrid}>
          <StatCard icon="dollar-sign" label="💵 My Earnings" value={`₹${earnings.toLocaleString("en-IN")}`} color="#22c55e" />
          <StatCard icon="list" label="📋 Available" value={pending.toString()} color="#f59e0b" />
        </View>
        <View style={[styles.statsGrid, { marginTop: 10 }]}>
          <StatCard icon="activity" label="⚡ Active" value={activeJobs.toString()} color="#3b82f6" />
          <StatCard icon="check-circle" label="✅ Completed" value={myBookings.filter((b) => b.status === "completed").length.toString()} color="#22c55e" />
        </View>

        <TouchableOpacity
          style={[styles.quickActionBtn, { backgroundColor: "#7c3aed" }]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push("/(tabs)/jobs");
          }}
        >
          <Text style={styles.quickActionEmoji}>💼</Text>
          <Text style={styles.quickActionText}>View Available Jobs</Text>
          <Feather name="chevron-right" size={18} color="#fff" />
        </TouchableOpacity>
      </ScrollView>
    );
  }

  // User role
  const myBookings = getBookingsByUser(user.id);
  const activeBooking = myBookings.find(
    (b) => b.status === "accepted" || b.status === "in_progress" || b.status === "pending"
  );

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: colors.background }]}
      contentContainerStyle={[
        styles.scroll,
        {
          paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0),
          paddingBottom: insets.bottom + 34,
        },
      ]}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.userHeader}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.greeting, { color: colors.mutedForeground }]}>
            👋 Welcome back,
          </Text>
          <Text style={[styles.name, { color: colors.foreground }]}>{user.name}</Text>
        </View>
        <View style={styles.miniLogoWrap}>
          <Image
            source={require("@/assets/images/zentro_logo.png")}
            style={styles.miniLogo}
            contentFit="cover"
          />
        </View>
      </View>

      {/* Active booking banner */}
      {activeBooking && (
        <View style={[styles.activeBanner, { backgroundColor: colors.primary + "12", borderColor: colors.primary + "30" }]}>
          <Text style={{ fontSize: 20 }}>⏰</Text>
          <View style={styles.activeBannerText}>
            <Text style={[styles.activeBannerTitle, { color: colors.primary }]}>Active Booking</Text>
            <Text style={[styles.activeBannerSub, { color: colors.foreground }]}>
              {activeBooking.serviceLabel} — {activeBooking.status}
            </Text>
          </View>
          <TouchableOpacity onPress={() => router.push("/(tabs)/bookings")}>
            <Feather name="chevron-right" size={18} color={colors.primary} />
          </TouchableOpacity>
        </View>
      )}

      {/* Services */}
      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>🧹 Our Services</Text>
      <ServiceCard icon="truck" title="🚗 Car Wash" subtitle="Full exterior & interior cleaning" price={getPrice("car_wash").toString()} color="#dc2626" onPress={() => router.push("/book")} />
      <ServiceCard icon="wind" title="🏍️ Bike Wash" subtitle="Thorough bike cleaning & polishing" price={getPrice("bike_wash").toString()} color="#7c3aed" onPress={() => router.push("/book")} />
      <ServiceCard icon="droplet" title="💧 Water Tank Cleaning" subtitle="Deep tank cleaning & sanitization" price={getPrice("water_tank").toString()} color="#059669" onPress={() => router.push("/book")} />

      <TouchableOpacity
        style={[styles.bookNowBtn, { backgroundColor: colors.primary }]}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          router.push("/book");
        }}
        activeOpacity={0.85}
      >
        <Text style={styles.bookNowText}>📅 Book a Service Now</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingTop: 16 },
  adminHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 24,
  },
  userHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 20,
  },
  greeting: { fontSize: 14 },
  name: { fontSize: 22, fontWeight: "800", marginTop: 2, letterSpacing: -0.3 },
  logoBadge: {},
  miniLogoWrap: {
    width: 46,
    height: 46,
    borderRadius: 23,
    overflow: "hidden",
    shadowColor: "#dc2626",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  miniLogo: { width: 46, height: 46 },
  statsGrid: { flexDirection: "row", gap: 10 },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "800",
    marginTop: 24,
    marginBottom: 14,
    letterSpacing: -0.3,
  },
  recentRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 8,
    gap: 12,
  },
  recentIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  recentInfo: { flex: 1 },
  recentTitle: { fontSize: 14, fontWeight: "600" },
  recentSub: { fontSize: 12, marginTop: 2 },
  recentPrice: { fontSize: 14, fontWeight: "700" },
  activeBanner: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 20,
    gap: 12,
  },
  activeBannerText: { flex: 1 },
  activeBannerTitle: { fontSize: 12, fontWeight: "700", textTransform: "uppercase" },
  activeBannerSub: { fontSize: 14, fontWeight: "600", marginTop: 2 },
  bookNowBtn: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    borderRadius: 14,
    marginTop: 20,
    shadowColor: "#dc2626",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  bookNowText: { color: "#fff", fontSize: 16, fontWeight: "800" },
  quickActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 14,
    gap: 10,
    marginTop: 20,
  },
  quickActionEmoji: { fontSize: 20 },
  quickActionText: { flex: 1, color: "#fff", fontSize: 16, fontWeight: "700" },
});
