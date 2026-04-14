import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BookingCard } from "@/components/BookingCard";
import { useAuth } from "@/context/AuthContext";
import { BookingStatus, useBookings } from "@/context/BookingsContext";
import { useColors } from "@/hooks/useColors";

const FILTERS: { id: string; label: string }[] = [
  { id: "all", label: "All" },
  { id: "pending", label: "Pending" },
  { id: "accepted", label: "Accepted" },
  { id: "in_progress", label: "Active" },
  { id: "completed", label: "Done" },
  { id: "cancelled", label: "Cancelled" },
];

export default function BookingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { bookings, getBookingsByUser, cancelBooking, refreshBookings } =
    useBookings();

  const [filter, setFilter] = useState("all");
  const [refreshing, setRefreshing] = useState(false);

  if (!user) return null;

  const myBookings =
    user.role === "admin"
      ? bookings
      : user.role === "worker"
      ? bookings.filter(
          (b) => b.workerId === user.id || b.status === "pending"
        )
      : getBookingsByUser(user.id);

  const filtered =
    filter === "all"
      ? myBookings
      : myBookings.filter((b) => b.status === filter);

  async function handleRefresh() {
    setRefreshing(true);
    await refreshBookings();
    setRefreshing(false);
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) + 16,
            backgroundColor: colors.background,
          },
        ]}
      >
        <Text style={[styles.title, { color: colors.foreground }]}>
          {user.role === "admin"
            ? "All Bookings"
            : user.role === "worker"
            ? "My Jobs"
            : "My Bookings"}
        </Text>
        <Text style={[styles.count, { color: colors.mutedForeground }]}>
          {filtered.length} booking{filtered.length !== 1 ? "s" : ""}
        </Text>
      </View>

      {/* Filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filtersRow}
        style={{ backgroundColor: colors.background }}
      >
        {FILTERS.map((f) => (
          <TouchableOpacity
            key={f.id}
            style={[
              styles.filterChip,
              {
                backgroundColor:
                  filter === f.id ? colors.primary : colors.card,
                borderColor:
                  filter === f.id ? colors.primary : colors.border,
              },
            ]}
            onPress={() => setFilter(f.id)}
          >
            <Text
              style={[
                styles.filterChipText,
                {
                  color:
                    filter === f.id ? "#fff" : colors.mutedForeground,
                },
              ]}
            >
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView
        contentContainerStyle={[
          styles.list,
          { paddingBottom: insets.bottom + 34 },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {filtered.length === 0 ? (
          <View style={styles.empty}>
            <Feather name="inbox" size={48} color={colors.mutedForeground} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              No bookings found
            </Text>
          </View>
        ) : (
          filtered.map((b) => (
            <BookingCard
              key={b.id}
              booking={b}
              showUserActions={user.role === "user"}
              onCancel={() => cancelBooking(b.id)}
            />
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 12 },
  title: { fontSize: 26, fontWeight: "800", letterSpacing: -0.5 },
  count: { fontSize: 14, marginTop: 2 },
  filtersRow: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 4,
  },
  filterChipText: { fontSize: 13, fontWeight: "600" },
  list: { paddingHorizontal: 20, paddingTop: 4 },
  empty: {
    alignItems: "center",
    paddingTop: 60,
    gap: 12,
  },
  emptyText: { fontSize: 16, fontWeight: "500" },
});
