import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import * as Location from "expo-location";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
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
import { supabase } from "@/lib/supabase";

export default function AddAddressScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams();
  const { user } = useAuth();

  const id = params.id as string;

  const [fullAddress, setFullAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [country, setCountry] = useState("");
  const [pincode, setPincode] = useState("");
  const [isDefault, setIsDefault] = useState(false);

  const [loading, setLoading] = useState(false);
  const [fetchingDetails, setFetchingDetails] = useState(false);

  useEffect(() => {
    if (id && user) {
      loadAddress(id);
    }
  }, [id, user]);

  async function loadAddress(addressId: string) {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("addresses")
        .select("*")
        .eq("id", addressId)
        .single();

      if (!error && data) {
        setFullAddress(data.full_address);
        setCity(data.city || "");
        setState(data.state || "");
        setCountry(data.country || "");
        setPincode(data.pincode || "");
        setIsDefault(data.is_default);
      } else {
        const localStr = await AsyncStorage.getItem(`local_addresses_${user?.id}`);
        if (localStr) {
          const list = JSON.parse(localStr);
          const found = list.find((a: any) => a.id === addressId);
          if (found) {
            setFullAddress(found.full_address);
            setCity(found.city || "");
            setState(found.state || "");
            setCountry(found.country || "");
            setPincode(found.pincode || "");
            setIsDefault(found.is_default);
          }
        }
      }
    } catch (e: any) {
      console.warn("Could not load address from remote. Falling back to local storage.", e.message || e);
    } finally {
      setLoading(false);
    }
  }

  // Lookup details via geocoding
  async function handleLookupDetails() {
    if (!fullAddress.trim()) {
      Alert.alert("Input needed", "Please enter full address string to fetch details.");
      return;
    }

    try {
      setFetchingDetails(true);
      const results = await Location.geocodeAsync(fullAddress);
      if (results.length === 0) {
        Alert.alert("No results", "Could not find geographical coordinates for this address.");
        return;
      }

      const { latitude, longitude } = results[0];

      const [reverse] = await Location.reverseGeocodeAsync({
        latitude,
        longitude,
      });

      if (reverse) {
        setCity(reverse.city || reverse.subregion || "");
        setState(reverse.region || "");
        setCountry(reverse.country || "");
        setPincode(reverse.postalCode || "");
        Alert.alert("Success 🎉", "Coordinates and geographical details resolved successfully!");
      }
    } catch (e: any) {
      console.error("Geocoding lookup error", e);
      Alert.alert("Lookup Failed", e.message || "Failed to parse address details.");
    } finally {
      setFetchingDetails(false);
    }
  }

  async function handleSave() {
    if (!user) return;
    if (!fullAddress.trim()) {
      Alert.alert("Required Field", "Please fill in full address field.");
      return;
    }

    setLoading(true);
    try {
      // Resolve latitude/longitude if not fetched yet
      let latitude = 0;
      let longitude = 0;

      try {
        const results = await Location.geocodeAsync(fullAddress);
        if (results.length > 0) {
          latitude = results[0].latitude;
          longitude = results[0].longitude;
        }
      } catch {
        // fallback to default coordinates if lookup fails completely
      }

      const localStr = await AsyncStorage.getItem(`local_addresses_${user.id}`);
      let currentList = localStr ? JSON.parse(localStr) : [];

      if (id) {
        currentList = currentList.map((a: any) =>
          a.id === id
            ? {
                ...a,
                full_address: fullAddress,
                city,
                state,
                country,
                pincode,
                latitude,
                longitude,
              }
            : a
        );
      } else {
        currentList.unshift({
          id: Math.random().toString(36).substr(2, 9),
          user_id: user.id,
          full_address: fullAddress,
          city,
          state,
          country,
          pincode,
          latitude,
          longitude,
          is_default: isDefault,
        });
      }

      await AsyncStorage.setItem(`local_addresses_${user.id}`, JSON.stringify(currentList));

      try {
        if (id) {
          // Edit existing
          await supabase
            .from("addresses")
            .update({
              full_address: fullAddress,
              city,
              state,
              country,
              pincode,
              latitude,
              longitude,
            })
            .eq("id", id);
        } else {
          // Insert new
          await supabase.from("addresses").insert({
            user_id: user.id,
            full_address: fullAddress,
            city,
            state,
            country,
            pincode,
            latitude,
            longitude,
            is_default: isDefault,
          });
        }
      } catch (err) {
        console.warn("Saving to remote addresses table failed, but saved locally.", err);
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Success", id ? "Address updated successfully!" : "Address added successfully!");
      router.back();
    } catch (e: any) {
      console.error("Error saving address", e);
      Alert.alert("Error", e.message || "Failed to save address.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.header,
          { paddingTop: insets.top + 8, borderBottomColor: colors.border },
        ]}
      >
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>
          {id ? "✏️ Edit Address" : "➕ Add Address"}
        </Text>
        <View style={styles.rightHeader} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.formGroup}>
            <Text style={[styles.label, { color: colors.foreground }]}>
              Full Address
            </Text>
            <View
              style={[
                styles.inputWrapper,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <TextInput
                style={[styles.input, { color: colors.foreground }]}
                placeholder="Ex. 123 Main St, New Delhi, India"
                placeholderTextColor={colors.mutedForeground}
                value={fullAddress}
                onChangeText={setFullAddress}
                multiline
                numberOfLines={3}
              />
              <TouchableOpacity
                style={[
                  styles.lookupBtn,
                  { backgroundColor: colors.primary + "15" },
                ]}
                onPress={handleLookupDetails}
                disabled={fetchingDetails}
              >
                {fetchingDetails ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <>
                    <Feather name="search" size={14} color={colors.primary} />
                    <Text style={[styles.lookupText, { color: colors.primary }]}>
                      Resolve Details
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.row}>
            <View style={[styles.formGroup, { flex: 1 }]}>
              <Text style={[styles.label, { color: colors.foreground }]}>
                City
              </Text>
              <TextInput
                style={[
                  styles.inputRow,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                    color: colors.foreground,
                  },
                ]}
                placeholder="Ex. New Delhi"
                placeholderTextColor={colors.mutedForeground}
                value={city}
                onChangeText={setCity}
              />
            </View>

            <View style={[styles.formGroup, { flex: 1 }]}>
              <Text style={[styles.label, { color: colors.foreground }]}>
                Pincode
              </Text>
              <TextInput
                style={[
                  styles.inputRow,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                    color: colors.foreground,
                  },
                ]}
                placeholder="Ex. 110001"
                placeholderTextColor={colors.mutedForeground}
                value={pincode}
                onChangeText={setPincode}
              />
            </View>
          </View>

          <View style={styles.row}>
            <View style={[styles.formGroup, { flex: 1 }]}>
              <Text style={[styles.label, { color: colors.foreground }]}>
                State
              </Text>
              <TextInput
                style={[
                  styles.inputRow,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                    color: colors.foreground,
                  },
                ]}
                placeholder="Ex. Delhi"
                placeholderTextColor={colors.mutedForeground}
                value={state}
                onChangeText={setState}
              />
            </View>

            <View style={[styles.formGroup, { flex: 1 }]}>
              <Text style={[styles.label, { color: colors.foreground }]}>
                Country
              </Text>
              <TextInput
                style={[
                  styles.inputRow,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                    color: colors.foreground,
                  },
                ]}
                placeholder="Ex. India"
                placeholderTextColor={colors.mutedForeground}
                value={country}
                onChangeText={setCountry}
              />
            </View>
          </View>

          {!id && (
            <TouchableOpacity
              style={[
                styles.checkboxRow,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
              onPress={() => setIsDefault(!isDefault)}
            >
              <View
                style={[
                  styles.checkbox,
                  {
                    borderColor: colors.border,
                    backgroundColor: isDefault
                      ? colors.primary
                      : "transparent",
                  },
                ]}
              >
                {isDefault && <Feather name="check" size={14} color="#fff" />}
              </View>
              <Text style={[styles.checkboxLabel, { color: colors.foreground }]}>
                Set as Default Address
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.saveBtn, { backgroundColor: colors.primary }]}
            onPress={handleSave}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.saveBtnText}>
                {id ? "Save Changes" : "Save Address"}
              </Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: "800" },
  rightHeader: { width: 24 },
  scroll: { padding: 24, gap: 16 },
  formGroup: { gap: 6 },
  label: { fontSize: 14, fontWeight: "700" },
  inputWrapper: {
    borderWidth: 1.5,
    borderRadius: 14,
    padding: 12,
    gap: 8,
  },
  input: {
    fontSize: 15,
    minHeight: 64,
    textAlignVertical: "top",
  },
  lookupBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
  },
  lookupText: { fontSize: 12, fontWeight: "700" },
  row: { flexDirection: "row", gap: 12 },
  inputRow: {
    borderWidth: 1.5,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 15,
  },
  checkboxRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 8,
    gap: 12,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxLabel: { fontSize: 14, fontWeight: "600" },
  saveBtn: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    borderRadius: 14,
    marginTop: 14,
  },
  saveBtnText: { color: "#fff", fontSize: 15, fontWeight: "800" },
});
