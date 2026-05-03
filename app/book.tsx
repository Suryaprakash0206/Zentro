import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
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
import { useBookings, ServiceType } from "@/context/BookingsContext";
import { useServicePrices } from "@/context/ServicePricesContext";
import { useColors } from "@/hooks/useColors";

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
  const [addressOption, setAddressOption] = useState<"default" | "different">("default");
  const [location, setLocation] = useState("");
  const [locationLink, setLocationLink] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const selected = SERVICES.find((s) => s.id === selectedService);

  // Pre-fill default address when mounting screen or changing selection
  useEffect(() => {
    if (user?.address && addressOption === "default") {
      setLocation(user.address);
    }
  }, [user, addressOption]);

  async function handleBook() {
    if (!user) return;
    if (!selectedService) {
      setError("Please select a service");
      return;
    }
    if (!location.trim()) {
      setError("Please enter your location");
      return;
    }
    setError("");
    setLoading(true);

    try {
      await createBooking({
        userId: user.id,
        userName: user.name,
        userPhone: user.phone,
        serviceType: selectedService,
        serviceLabel: selected!.label,
        price: selected!.price,
        location: location.trim(),
        locationLink: locationLink.trim() || undefined,
        notes: notes.trim() || undefined,
      });

      setLoading(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace("/(tabs)/bookings");
    } catch (err: any) {
      setLoading(false);
      setError(err.message || "Failed to book service. Database error.");
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
              paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) + 16,
              paddingBottom: insets.bottom + 40,
            },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => router.back()}
          >
            <Feather name="arrow-left" size={22} color={colors.foreground} />
          </TouchableOpacity>

          <Text style={[styles.title, { color: colors.foreground }]}>📅 Book a Service</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            Choose a service and share your location 📍
          </Text>

          {/* Service Selection */}
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
            Select Service
          </Text>
          <View style={styles.servicesGrid}>
            {SERVICES.map((s) => (
              <TouchableOpacity
                key={s.id}
                style={[
                  styles.serviceItem,
                  {
                    backgroundColor:
                      selectedService === s.id ? s.color + "15" : colors.card,
                    borderColor:
                      selectedService === s.id ? s.color : colors.border,
                  },
                ]}
                onPress={() => {
                  setSelectedService(s.id);
                  Haptics.selectionAsync();
                }}
                activeOpacity={0.8}
              >
                <View
                  style={[
                    styles.serviceIcon,
                    { backgroundColor: s.color + "20" },
                  ]}
                >
                  <Feather name={s.icon} size={24} color={s.color} />
                </View>
                <Text
                  style={[
                    styles.serviceItemLabel,
                    {
                      color:
                        selectedService === s.id
                          ? s.color
                          : colors.foreground,
                    },
                  ]}
                >
                  {s.label}
                </Text>
                <Text
                  style={[styles.serviceDesc, { color: colors.mutedForeground }]}
                >
                  {s.description}
                </Text>
                <Text style={[styles.servicePrice, { color: s.color }]}>
                  ₹{s.price}
                </Text>
                {selectedService === s.id && (
                  <View
                    style={[styles.checkmark, { backgroundColor: s.color }]}
                  >
                    <Feather name="check" size={12} color="#fff" />
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>

          {/* Address Selection */}
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
            Address Selection
          </Text>
          <View style={styles.addressOptionsRow}>
            <TouchableOpacity
              style={[
                styles.addressOptionBtn,
                {
                  backgroundColor: addressOption === "default" ? colors.primary + "15" : colors.card,
                  borderColor: addressOption === "default" ? colors.primary : colors.border,
                },
              ]}
              onPress={() => setAddressOption("default")}
            >
              <Feather
                name={addressOption === "default" ? "check-circle" : "circle"}
                size={16}
                color={addressOption === "default" ? colors.primary : colors.mutedForeground}
              />
              <Text style={[styles.addressOptionText, { color: colors.foreground }]}>
                Use Default Address
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.addressOptionBtn,
                {
                  backgroundColor: addressOption === "different" ? colors.primary + "15" : colors.card,
                  borderColor: addressOption === "different" ? colors.primary : colors.border,
                },
              ]}
              onPress={() => setAddressOption("different")}
            >
              <Feather
                name={addressOption === "different" ? "check-circle" : "circle"}
                size={16}
                color={addressOption === "different" ? colors.primary : colors.mutedForeground}
              />
              <Text style={[styles.addressOptionText, { color: colors.foreground }]}>
                Use Different Address
              </Text>
            </TouchableOpacity>
          </View>

          {/* Address Input */}
          <View
            style={[
              styles.inputWrap,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <Feather name="map-pin" size={18} color={colors.mutedForeground} />
            <TextInput
              style={[styles.input, { color: colors.foreground }]}
              placeholder="Enter your full address"
              placeholderTextColor={colors.mutedForeground}
              value={location}
              onChangeText={setLocation}
              multiline
              editable={addressOption === "different"}
            />
          </View>

          <View
            style={[
              styles.inputWrap,
              { backgroundColor: colors.card, borderColor: colors.border },
              { marginTop: 10 },
            ]}
          >
            <Feather name="link" size={18} color={colors.mutedForeground} />
            <TextInput
              style={[styles.input, { color: colors.foreground }]}
              placeholder="Google Maps link (optional)"
              placeholderTextColor={colors.mutedForeground}
              value={locationLink}
              onChangeText={setLocationLink}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View
            style={[
              styles.inputWrap,
              { backgroundColor: colors.card, borderColor: colors.border },
              { marginTop: 10 },
            ]}
          >
            <Feather
              name="file-text"
              size={18}
              color={colors.mutedForeground}
            />
            <TextInput
              style={[styles.input, { color: colors.foreground }]}
              placeholder="Additional notes (optional)"
              placeholderTextColor={colors.mutedForeground}
              value={notes}
              onChangeText={setNotes}
              multiline
            />
          </View>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          {/* Summary */}
          {selected && (
            <View
              style={[
                styles.summary,
                { backgroundColor: selected.color + "10", borderColor: selected.color + "30" },
              ]}
            >
              <View style={styles.summaryRow}>
                <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>
                  Service
                </Text>
                <Text style={[styles.summaryValue, { color: colors.foreground }]}>
                  {selected.label}
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>
                  Amount
                </Text>
                <Text style={[styles.summaryAmount, { color: selected.color }]}>
                  ₹{selected.price}
                </Text>
              </View>
            </View>
          )}

          <TouchableOpacity
            style={[
              styles.bookBtn,
              {
                backgroundColor: selected?.color ?? colors.primary,
                opacity: !selectedService || !location ? 0.5 : 1,
              },
            ]}
            onPress={handleBook}
            disabled={loading || !selectedService || !location}
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
    marginBottom: 12,
  },
  servicesGrid: { gap: 10, marginBottom: 24 },
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
  addressOptionsRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 14,
  },
  addressOptionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderRadius: 14,
    paddingVertical: 14,
    gap: 8,
  },
  addressOptionText: { fontSize: 13, fontWeight: "700" },
  inputWrap: {
    flexDirection: "row",
    alignItems: "flex-start",
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 10,
  },
  input: { flex: 1, fontSize: 15, minHeight: 20 },
  errorText: {
    color: "#ef4444",
    fontSize: 13,
    textAlign: "center",
    marginTop: 4,
  },
  summary: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    marginTop: 16,
    gap: 8,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  summaryLabel: { fontSize: 14 },
  summaryValue: { fontSize: 14, fontWeight: "600" },
  summaryAmount: { fontSize: 20, fontWeight: "800" },
  bookBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    borderRadius: 14,
    gap: 8,
    marginTop: 16,
  },
  bookBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
