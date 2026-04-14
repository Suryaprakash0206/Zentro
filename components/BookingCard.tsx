import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React from "react";
import {
  Linking,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { Booking, BookingStatus } from "@/context/BookingsContext";
import { useColors } from "@/hooks/useColors";

interface BookingCardProps {
  booking: Booking;
  showWorkerActions?: boolean;
  showUserActions?: boolean;
  onAccept?: () => void;
  onUpdateStatus?: (status: BookingStatus) => void;
  onCancel?: () => void;
}

const STATUS_COLORS: Record<BookingStatus, string> = {
  pending: "#f59e0b",
  accepted: "#3b82f6",
  in_progress: "#8b5cf6",
  completed: "#22c55e",
  cancelled: "#ef4444",
};

const STATUS_LABELS: Record<BookingStatus, string> = {
  pending: "Pending",
  accepted: "Accepted",
  in_progress: "In Progress",
  completed: "Completed",
  cancelled: "Cancelled",
};

export function BookingCard({
  booking,
  showWorkerActions,
  showUserActions,
  onAccept,
  onUpdateStatus,
  onCancel,
}: BookingCardProps) {
  const colors = useColors();
  const statusColor = STATUS_COLORS[booking.status];

  function openLocation() {
    if (booking.locationLink) {
      Linking.openURL(booking.locationLink);
    } else {
      const query = encodeURIComponent(booking.location);
      Linking.openURL(`https://maps.google.com/?q=${query}`);
    }
  }

  function formatDate(dateStr: string) {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return (
    <View
      style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
    >
      <View style={styles.header}>
        <View style={styles.serviceInfo}>
          <Text style={[styles.serviceLabel, { color: colors.foreground }]}>
            {booking.serviceLabel}
          </Text>
          <Text style={[styles.date, { color: colors.mutedForeground }]}>
            {formatDate(booking.createdAt)}
          </Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: statusColor + "20" }]}>
          <View style={[styles.dot, { backgroundColor: statusColor }]} />
          <Text style={[styles.statusText, { color: statusColor }]}>
            {STATUS_LABELS[booking.status]}
          </Text>
        </View>
      </View>

      <View style={[styles.divider, { backgroundColor: colors.border }]} />

      <View style={styles.details}>
        <View style={styles.detailRow}>
          <Feather name="map-pin" size={14} color={colors.mutedForeground} />
          <Text style={[styles.detailText, { color: colors.foreground }]} numberOfLines={1}>
            {booking.location}
          </Text>
          <TouchableOpacity onPress={openLocation} style={styles.mapBtn}>
            <Feather name="navigation" size={14} color={colors.primary} />
          </TouchableOpacity>
        </View>

        <View style={styles.detailRow}>
          <Feather name="user" size={14} color={colors.mutedForeground} />
          <Text style={[styles.detailText, { color: colors.foreground }]}>
            {showWorkerActions
              ? `${booking.userName} (${booking.userPhone})`
              : booking.workerName
              ? `${booking.workerName} ${booking.workerPhone ? `(${booking.workerPhone})` : ""}`
              : "Not assigned"}
          </Text>
        </View>

        <View style={styles.detailRow}>
          <Feather name="tag" size={14} color={colors.mutedForeground} />
          <Text style={[styles.priceText, { color: colors.primary }]}>₹{booking.price}</Text>
        </View>
      </View>

      {showWorkerActions && booking.status === "pending" && (
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: colors.primary }]}
          onPress={() => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            onAccept?.();
          }}
        >
          <Feather name="check-circle" size={16} color="#fff" />
          <Text style={styles.actionBtnText}>Accept Job</Text>
        </TouchableOpacity>
      )}

      {showWorkerActions && booking.status === "accepted" && (
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: "#8b5cf6" }]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            onUpdateStatus?.("in_progress");
          }}
        >
          <Feather name="play-circle" size={16} color="#fff" />
          <Text style={styles.actionBtnText}>Start Job</Text>
        </TouchableOpacity>
      )}

      {showWorkerActions && booking.status === "in_progress" && (
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: "#22c55e" }]}
          onPress={() => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            onUpdateStatus?.("completed");
          }}
        >
          <Feather name="check" size={16} color="#fff" />
          <Text style={styles.actionBtnText}>Mark Complete</Text>
        </TouchableOpacity>
      )}

      {showUserActions && booking.status === "pending" && (
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: "#ef4444" }]}
          onPress={() => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            onCancel?.();
          }}
        >
          <Feather name="x-circle" size={16} color="#fff" />
          <Text style={styles.actionBtnText}>Cancel Booking</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  serviceInfo: {
    flex: 1,
  },
  serviceLabel: {
    fontSize: 16,
    fontWeight: "700",
  },
  date: {
    fontSize: 12,
    marginTop: 2,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    gap: 5,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "600",
  },
  divider: {
    height: 1,
    marginVertical: 12,
  },
  details: {
    gap: 8,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  detailText: {
    flex: 1,
    fontSize: 14,
  },
  priceText: {
    fontSize: 16,
    fontWeight: "700",
  },
  mapBtn: {
    padding: 4,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 14,
    padding: 12,
    borderRadius: 12,
    gap: 8,
  },
  actionBtnText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },
});
