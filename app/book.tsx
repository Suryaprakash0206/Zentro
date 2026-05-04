import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useState, useEffect } from "react";
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
import { useBookings, ServiceType } from "@/context/BookingsContext";
import { useServicePrices } from "@/context/ServicePricesContext";
import { useColors } from "@/hooks/useColors";
import { supabase } from "@/lib/supabase";

const SERVICE_META: {
  id: ServiceType;
  label: string;
  icon: keyof typeof Feather.glyphMap;
  color: string;
  description: string;
}[] = [
  {
    id: "car_wash",
    label: "Car Wash",
    icon: "truck",
    color: "#0ea5e9",
    description: "Full exterior & interior cleaning",
  },
  {
    id: "bike_wash",
    label: "Bike Wash",
    icon: "wind",
    color: "#8b5cf6",
    description: "Thorough bike cleaning & polishing",
  },
  {
    id: "water_tank",
    label: "Water Tank Cleaning",
    icon: "droplet",
    color: "#22c55e",
    description: "Deep tank cleaning & sanitization",
  },
];

export default function BookScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const { createBooking } = useBookings();
  const { getPrice } = useServicePrices();

  const SERVICES = SERVICE_META.map((s) => ({ ...s, price: getPrice(s.id) }));

  const [selectedService, setSelectedService] = useState<ServiceType | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [calMonth, setCalMonth] = useState<number>(new Date().getMonth());
  const [calYear, setCalYear] = useState<number>(new Date().getFullYear());
  const [location, setLocation] = useState("");
  const [locationLink, setLocationLink] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (user) {
      loadDefaultAddress();
    }
  }, [user]);

  async function loadDefaultAddress() {
    try {
      const { data, error } = await supabase
        .from("addresses")
        .select("*")
        .eq("user_id", user?.id)
        .eq("is_default", true)
        .maybeSingle();

      if (!error && data && data.full_address) {
        setLocation(data.full_address);
        if (data.latitude && data.longitude) {
          setLocationLink(`https://www.google.com/maps/search/?api=1&query=${data.latitude},${data.longitude}`);
        }
      } else {
        const localStr = await AsyncStorage.getItem(`local_addresses_${user?.id}`);
        if (localStr) {
          const list = JSON.parse(localStr);
          const def = list.find((a: any) => a.is_default) || list[0];
          if (def && def.full_address) {
            setLocation(def.full_address);
            if (def.latitude && def.longitude) {
              setLocationLink(`https://www.google.com/maps/search/?api=1&query=${def.latitude},${def.longitude}`);
            }
          } else {
            promptAddressRedirect();
          }
        } else {
          promptAddressRedirect();
        }
      }
    } catch (e) {
      console.warn("Could not load default address for booking.", e);
    }
  }

  function promptAddressRedirect() {
    Alert.alert(
      "Location Required",
      "Please set your location in profile before booking a service.",
      [
        {
          text: "Go to Profile",
          onPress: () => router.push("/(tabs)/profile"),
        },
      ]
    );
  }

  function selectService(id: ServiceType) {
    Haptics.selectionAsync();
    setSelectedService(id);

    const meta = SERVICES.find((s) => s.id === id);
    if (!meta) return;

    if (!location.trim()) {
      promptAddressRedirect();
      return;
    }

    Alert.alert(
      "Confirm Booking",
      `Are you sure you want to book ${meta.label} for ₹${meta.price} on ${selectedDate}?\n\nService Address:\n${location}`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Confirm Booking",
          style: "default",
          onPress: () => confirmImmediateBooking(id),
        },
      ]
    );
  }

  async function confirmImmediateBooking(serviceId: ServiceType) {
    if (!user) return;
    if (!location.trim()) {
      promptAddressRedirect();
      return;
    }
    setError("");
    setLoading(true);

    try {
      const { data: availableWorkers } = await supabase
        .from("profiles")
        .select("id, worker_status")
        .eq("role", "worker")
        .eq("worker_status", "available");

      const hasAvailableWorkers = !!availableWorkers && availableWorkers.length > 0;

      let bookingNotes = description.trim() || `Direct booking for ${SERVICES.find((s) => s.id === serviceId)?.label}`;
      if (!hasAvailableWorkers) {
        bookingNotes = `[DELAYED_QUEUE] All workers busy. Expected follow up within 1 hour. ${bookingNotes}`.trim();
        Alert.alert(
          "All Workers Busy",
          "All our workers are currently busy. Our team will contact you within 1 hour.",
          [{ text: "OK" }]
        );
      }

      const meta = SERVICES.find((s) => s.id === serviceId);
      if (meta) {
        await createBooking({
          userId: user.id,
          userName: user.name,
          userPhone: user.phone,
          serviceType: serviceId,
          serviceLabel: meta.label,
          price: meta.price,
          location: location.trim(),
          locationLink: locationLink.trim() || undefined,
          notes: bookingNotes || undefined,
          scheduledDate: selectedDate,
        });
      }

      setLoading(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace("/(tabs)/bookings");
    } catch (err: any) {
      setLoading(false);
      setError(err.message || "Failed to book. Database error.");
    }
  }

  async function handleBook() {
    if (!user) return;
    if (!selectedService) {
      setError("Please select a service");
      return;
    }
    if (!description.trim()) {
      setError("Please enter a service description");
      return;
    }
    if (!location.trim()) {
      promptAddressRedirect();
      return;
    }
    setError("");
    setLoading(true);

    try {
      const { data: availableWorkers } = await supabase
        .from("profiles")
        .select("id, worker_status")
        .eq("role", "worker")
        .eq("worker_status", "available");

      const hasAvailableWorkers = !!availableWorkers && availableWorkers.length > 0;

      let bookingNotes = description.trim();
      if (!hasAvailableWorkers) {
        bookingNotes = `[DELAYED_QUEUE] All workers busy. Expected follow up within 1 hour. ${bookingNotes}`.trim();
        Alert.alert(
          "All Workers Busy",
          "All our workers are currently busy. Our team will contact you within 1 hour.",
          [{ text: "OK" }]
        );
      }

      const meta = SERVICES.find((s) => s.id === selectedService);
      if (meta) {
        await createBooking({
          userId: user.id,
          userName: user.name,
          userPhone: user.phone,
          serviceType: selectedService,
          serviceLabel: meta.label,
          price: meta.price,
          location: location.trim(),
          locationLink: locationLink.trim() || undefined,
          notes: bookingNotes || undefined,
          scheduledDate: selectedDate,
        });
      }

      setLoading(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace("/(tabs)/bookings");
    } catch (err: any) {
      setLoading(false);
      setError(err.message || "Failed to book. Database error.");
    }
  }

  const selectedMetas = SERVICES.filter((s) => selectedService === s.id);
  const totalAmount = selectedMetas.reduce((acc, s) => acc + s.price, 0);

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
              paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) + 16,
              paddingBottom: insets.bottom + 40,
            },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Feather name="arrow-left" size={22} color={colors.foreground} />
          </TouchableOpacity>

          <Text style={[styles.title, { color: colors.foreground }]}>📅 Book Services</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            Select your desired services and date 🛠️
          </Text>

          {/* Full Month Grid Calendar */}
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground, marginTop: 12 }]}>
            Select Booking Date
          </Text>
          <View style={[styles.fullCalendarCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {/* Header */}
            <View style={styles.calendarHeader}>
              <TouchableOpacity
                style={[styles.calendarNavBtn, { borderColor: colors.border }]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  if (calMonth === 0) {
                    setCalMonth(11);
                    setCalYear(calYear - 1);
                  } else {
                    setCalMonth(calMonth - 1);
                  }
                }}
              >
                <Feather name="chevron-left" size={18} color={colors.foreground} />
              </TouchableOpacity>

              <Text style={[styles.calendarMonthTitle, { color: colors.foreground }]}>
                {new Date(calYear, calMonth).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
              </Text>

              <TouchableOpacity
                style={[styles.calendarNavBtn, { borderColor: colors.border }]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  if (calMonth === 11) {
                    setCalMonth(0);
                    setCalYear(calYear + 1);
                  } else {
                    setCalMonth(calMonth + 1);
                  }
                }}
              >
                <Feather name="chevron-right" size={18} color={colors.foreground} />
              </TouchableOpacity>
            </View>

            {/* Weekdays Row */}
            <View style={styles.weekdaysRow}>
              {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((wd, i) => (
                <Text key={i} style={[styles.weekdayText, { color: colors.mutedForeground }]}>
                  {wd}
                </Text>
              ))}
            </View>

            {/* Grid of Days */}
            <View style={styles.daysGrid}>
              {(() => {
                const now = new Date();
                const firstDayOfWeek = new Date(calYear, calMonth, 1).getDay();
                const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();

                const calendarSlots = [];
                for (let i = 0; i < firstDayOfWeek; i++) {
                  calendarSlots.push(null);
                }
                for (let i = 1; i <= daysInMonth; i++) {
                  calendarSlots.push(i);
                }

                return calendarSlots.map((day, idx) => {
                  if (day === null) {
                    return <View key={`empty-${idx}`} style={styles.calendarDaySlot} />;
                  }

                  const d = new Date(calYear, calMonth, day);
                  const dayIso = d.toISOString().split("T")[0];
                  const isPast = d.setHours(0,0,0,0) < new Date().setHours(0,0,0,0);
                  const isSel = dayIso === selectedDate;

                  return (
                    <TouchableOpacity
                      key={`day-${day}`}
                      style={[
                        styles.calendarDaySlot,
                        {
                          backgroundColor: isSel ? colors.primary : "transparent",
                          borderColor: isSel ? colors.primary : "transparent",
                          opacity: isPast ? 0.35 : 1,
                        },
                      ]}
                      onPress={() => {
                        if (!isPast) {
                          Haptics.selectionAsync();
                          setSelectedDate(dayIso);
                        }
                      }}
                      disabled={isPast}
                    >
                      <Text
                        style={[
                          styles.fullCalendarDayText,
                          {
                            color: isSel ? "#fff" : colors.foreground,
                            fontWeight: isSel ? "700" : "500",
                          },
                        ]}
                      >
                        {day}
                      </Text>
                    </TouchableOpacity>
                  );
                });
              })()}
            </View>
          </View>

          {/* Service Selection Grid */}
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
            Choose Service
          </Text>
          <View style={styles.servicesGrid}>
            {SERVICES.map((s) => {
              const isSel = selectedService === s.id;
              return (
                <TouchableOpacity
                  key={s.id}
                  style={[
                    styles.serviceItem,
                    {
                      backgroundColor: isSel ? s.color + "15" : colors.card,
                      borderColor: isSel ? s.color : colors.border,
                    },
                  ]}
                  onPress={() => selectService(s.id)}
                  activeOpacity={0.8}
                >
                  <View style={[styles.serviceIcon, { backgroundColor: s.color + "20" }]}>
                    <Feather name={s.icon} size={24} color={s.color} />
                  </View>
                  <Text
                    style={[
                      styles.serviceItemLabel,
                      { color: isSel ? s.color : colors.foreground },
                    ]}
                  >
                    {s.label}
                  </Text>
                  <Text style={[styles.serviceDesc, { color: colors.mutedForeground }]}>
                    {s.description}
                  </Text>
                  <Text style={[styles.servicePrice, { color: s.color }]}>₹{s.price}</Text>
                  {isSel && (
                    <View style={[styles.checkmark, { backgroundColor: s.color }]}>
                      <Feather name="check" size={12} color="#fff" />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Stored Location View - Read-only */}
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
            Location (Single source of truth)
          </Text>
          <View
            style={[
              styles.locationCard,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <View style={styles.locationHeader}>
              <Feather name="map-pin" size={18} color="#ef4444" />
              <Text style={[styles.locationTitle, { color: colors.foreground }]}>
                Saved Service Address
              </Text>
            </View>
            <Text style={[styles.addressText, { color: colors.foreground }]}>
              {location || "No default address set in profile."}
            </Text>
            <TouchableOpacity
              style={[styles.changeLocBtn, { borderColor: colors.border }]}
              onPress={() => router.push("/(tabs)/profile")}
            >
              <Feather name="edit" size={14} color={colors.mutedForeground} />
              <Text style={[styles.changeLocText, { color: colors.mutedForeground }]}>
                Change Location in Profile
              </Text>
            </TouchableOpacity>
          </View>

          {/* Description Field */}
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
            Service Description (Mandatory)
          </Text>
          <View
            style={[
              styles.inputWrap,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <Feather name="file-text" size={18} color={colors.mutedForeground} />
            <TextInput
              style={[styles.input, { color: colors.foreground }]}
              placeholder="Describe your service need clearly..."
              placeholderTextColor={colors.mutedForeground}
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={3}
            />
          </View>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          {/* Summary Section */}
          {selectedService && (
            <View
              style={[
                styles.summary,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <Text style={[styles.sectionLabel, { color: colors.mutedForeground, marginTop: 0, marginBottom: 8 }]}>
                📝 Service Summary
              </Text>

              {selectedMetas.map((sm) => (
                <View key={sm.id} style={[styles.selectedServiceItem, { borderBottomColor: colors.border }]}>
                  <Text style={[styles.summaryItemLabel, { color: colors.foreground }]}>
                    ✅ {sm.label}
                  </Text>
                  <Text style={[styles.summaryItemDesc, { color: colors.mutedForeground }]}>
                    ℹ️ {sm.description}
                  </Text>
                  <Text style={[styles.summaryItemPrice, { color: sm.color }]}>
                    Cost: ₹{sm.price}
                  </Text>
                </View>
              ))}

              <View style={[styles.summaryRow, { marginTop: 10, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10 }]}>
                <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>
                  Service Address
                </Text>
                <Text style={[styles.summaryValue, { color: colors.foreground }]}>
                  {location || "N/A"}
                </Text>
              </View>

              <View style={styles.summaryRow}>
                <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>
                  Total Price
                </Text>
                <Text style={[styles.summaryAmount, { color: colors.primary }]}>
                  ₹{totalAmount}
                </Text>
              </View>
            </View>
          )}

          <TouchableOpacity
            style={[
              styles.bookBtn,
              {
                backgroundColor: colors.primary,
                opacity: !selectedService || !description.trim() || !location ? 0.6 : 1,
              },
            ]}
            onPress={handleBook}
            disabled={loading || !selectedService || !description.trim() || !location}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Feather name="calendar" size={18} color="#fff" />
                <Text style={styles.bookBtnText}>Confirm Booking</Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  scroll: { flexGrow: 1, paddingHorizontal: 20 },
  backBtn: { marginBottom: 12, padding: 4, alignSelf: "flex-start" },
  title: { fontSize: 26, fontWeight: "800", letterSpacing: -0.5 },
  subtitle: { fontSize: 14, marginTop: 4, marginBottom: 24 },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginTop: 18,
    marginBottom: 10,
  },
  servicesGrid: { gap: 10, marginBottom: 14 },
  serviceItem: {
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 16,
    position: "relative",
  },
  serviceIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  serviceItemLabel: { fontSize: 16, fontWeight: "700" },
  serviceDesc: { fontSize: 13, marginTop: 2 },
  servicePrice: { fontSize: 18, fontWeight: "800", marginTop: 8 },
  checkmark: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  locationCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    gap: 8,
    marginBottom: 4,
  },
  locationHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  locationTitle: {
    fontSize: 14,
    fontWeight: "700",
  },
  addressText: {
    fontSize: 13,
    fontWeight: "500",
    lineHeight: 18,
  },
  changeLocBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 8,
    gap: 6,
    marginTop: 4,
  },
  changeLocText: {
    fontSize: 12,
    fontWeight: "600",
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "flex-start",
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 10,
  },
  input: { flex: 1, fontSize: 15, minHeight: 60, textAlignVertical: "top" },
  errorText: {
    color: "#ef4444",
    fontSize: 13,
    textAlign: "center",
    marginTop: 8,
  },
  summary: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    marginTop: 18,
    gap: 8,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  summaryLabel: { fontSize: 14 },
  summaryValue: { fontSize: 14, fontWeight: "600", flex: 1, textAlign: "right" },
  summaryAmount: { fontSize: 20, fontWeight: "800" },
  bookBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    borderRadius: 14,
    gap: 8,
    marginTop: 20,
  },
  bookBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  selectedServiceItem: {
    borderBottomWidth: 1,
    paddingBottom: 10,
    marginBottom: 8,
    gap: 2,
  },
  summaryItemLabel: {
    fontSize: 14,
    fontWeight: "700",
  },
  summaryItemDesc: {
    fontSize: 12,
    lineHeight: 16,
  },
  summaryItemPrice: {
    fontSize: 14,
    fontWeight: "800",
    marginTop: 2,
  },
  fullCalendarCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginTop: 6,
    marginBottom: 16,
  },
  calendarHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  calendarNavBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  calendarMonthTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  weekdaysRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 10,
  },
  weekdayText: {
    fontSize: 12,
    fontWeight: "600",
    width: 38,
    textAlign: "center",
  },
  daysGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-start",
    gap: 8,
  },
  calendarDaySlot: {
    width: 41,
    height: 41,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  fullCalendarDayText: {
    fontSize: 14,
  },
});
