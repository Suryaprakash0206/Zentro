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
import { useBookings } from "@/context/BookingsContext";
import type { BookingStatus } from "@/context/BookingsContext";
import { useColors } from "@/hooks/useColors";

const FILTERS = [
  { id: "pending", label: "Available" },
  { id: "mine", label: "My Jobs" },
  { id: "completed", label: "Completed" },
];

export default function JobsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { bookings, acceptBooking, updateStatus, refreshBookings } =
    useBookings();

  const [filter, setFilter] = useState("pending");
  const [refreshing, setRefreshing] = useState(false);

  if (!user || user.role !== "worker") return null;

  const displayed =
    filter === "pending"
      ? bookings.filter((b) => b.status === "pending")
      : filter === "mine"
      ? bookings.filter(
          (b) =>
            b.workerId === user.id &&
            (b.status === "accepted" || b.status === "in_progress")
        )
      : bookings.filter(
          (b) => b.workerId === user.id && b.status === "completed"
        );

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
        <Text style={[styles.title, { color: colors.foreground }]}>Jobs</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          Accept and manage your service jobs
        </Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filtersRow}
        style={{ backgroundColor: colors.background, flexGrow: 0 }}
      >
        {FILTERS.map((f) => (
          <TouchableOpacity
            key={f.id}
            style={[
              styles.filterChip,
              {
                backgroundColor:
                  filter === f.id ? "#8b5cf6" : colors.card,
                borderColor:
                  filter === f.id ? "#8b5cf6" : colors.border,
              },
            ]}
            onPress={() => setFilter(f.id)}
          >
            <Text
              style={[
                styles.filterChipText,
                { color: filter === f.id ? "#fff" : colors.mutedForeground },
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
        {displayed.length === 0 ? (
          <View style={styles.empty}>
            <Feather name="briefcase" size={48} color={colors.mutedForeground} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              {filter === "pending"
                ? "No available jobs right now"
                : filter === "mine"
                ? "No active jobs"
                : "No completed jobs yet"}
            </Text>
          </View>
        ) : (
          displayed.map((b) => (
            <BookingCard
              key={b.id}
              booking={b}
              showWorkerActions={true}
              onAccept={() => acceptBooking(b.id, user.id, user.name)}
              onUpdateStatus={(status: BookingStatus) =>
                updateStatus(b.id, status)
              }
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
  subtitle: { fontSize: 14, marginTop: 2 },
  filtersRow: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    gap: 8,
  },
  filterChip: {
    width: 100,
    minWidth: 100,
    maxWidth: 100,
    height: 38,
    minHeight: 38,
    maxHeight: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 19,
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
  emptyText: { fontSize: 16, fontWeight: "500", textAlign: "center" },
});
