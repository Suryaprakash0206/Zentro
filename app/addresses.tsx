import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import * as Location from "expo-location";
import { useRouter, useNavigation } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import { supabase } from "@/lib/supabase";

export interface Address {
  id: string;
  user_id: string;
  latitude: number;
  longitude: number;
  full_address: string;
  city: string | null;
  state: string | null;
  country: string | null;
  pincode: string | null;
  is_default: boolean;
}

export default function AddressesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const navigation = useNavigation();
  const { user } = useAuth();

  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [detecting, setDetecting] = useState(false);

  useEffect(() => {
    if (user) {
      fetchAddresses();
    }
    const unsubscribe = navigation.addListener("focus", () => {
      if (user) {
        fetchAddresses();
      }
    });
    return unsubscribe;
  }, [user, navigation]);

  async function fetchAddresses() {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("addresses")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) {
        if (error.code === "PGRST205" || error.message?.includes("addresses")) {
          const localStr = await AsyncStorage.getItem(`local_addresses_${user.id}`);
          if (localStr) {
            setAddresses(JSON.parse(localStr));
          } else {
            setAddresses([]);
          }
          return;
        }
        throw error;
      }

      if (data) {
        setAddresses(data);
      }
    } catch (e: any) {
      console.warn("Falling back to local storage for addresses", e.message || e);
      const localStr = await AsyncStorage.getItem(`local_addresses_${user.id}`);
      if (localStr) {
        setAddresses(JSON.parse(localStr));
      } else {
        setAddresses([]);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleSetDefault(addressId: string) {
    if (!user) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const updated = addresses.map((a) => ({
      ...a,
      is_default: a.id === addressId,
    }));
    setAddresses(updated);
    await AsyncStorage.setItem(`local_addresses_${user.id}`, JSON.stringify(updated));

    try {
      const { error: resetErr } = await supabase
        .from("addresses")
        .update({ is_default: false })
        .eq("user_id", user.id);

      if (resetErr) throw resetErr;

      const { error: updateErr } = await supabase
        .from("addresses")
        .update({ is_default: true })
        .eq("id", addressId);

      if (updateErr) throw updateErr;
    } catch (e: any) {
      console.warn("Could not save to remote addresses table. Using local storage.", e.message || e);
    }
  }

  async function handleDelete(addressId: string) {
    if (!user) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);

    Alert.alert(
      "Delete Address",
      "Are you sure you want to delete this address?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            const updated = addresses.filter((a) => a.id !== addressId);
            setAddresses(updated);
            await AsyncStorage.setItem(`local_addresses_${user.id}`, JSON.stringify(updated));

            try {
              const { error } = await supabase
                .from("addresses")
                .delete()
                .eq("id", addressId);

              if (error) throw error;
            } catch (e: any) {
              console.warn("Delete failed on remote but removed locally", e.message || e);
            }
          },
        },
      ]
    );
  }

  async function handleDetectLocation() {
    if (!user) return;
    Haptics.selectionAsync();

    try {
      setDetecting(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permission Denied",
          "Permission to access location was denied. Please select your address manually."
        );
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const { latitude, longitude } = location.coords;

      const [addressObj] = await Location.reverseGeocodeAsync({
        latitude,
        longitude,
      });

      let fullAddress = "Detected Location";
      let city = "";
      let state = "";
      let country = "";
      let pincode = "";

      if (addressObj) {
        city = addressObj.city || addressObj.subregion || "";
        state = addressObj.region || "";
        country = addressObj.country || "";
        pincode = addressObj.postalCode || "";

        const parts = [
          addressObj.streetNumber,
          addressObj.street,
          addressObj.district,
          city,
          state,
          country,
        ].filter(Boolean);

        fullAddress = parts.join(", ") || "Current GPS Location";
      }

      const isFirst = addresses.length === 0;

      const newAddress = {
        id: Math.random().toString(36).substr(2, 9),
        user_id: user.id,
        latitude,
        longitude,
        full_address: fullAddress,
        city,
        state,
        country,
        pincode,
        is_default: isFirst,
      };

      const updated = [newAddress, ...addresses];
      setAddresses(updated);
      await AsyncStorage.setItem(`local_addresses_${user.id}`, JSON.stringify(updated));

      try {
        const { data, error } = await supabase
          .from("addresses")
          .insert({
            user_id: user.id,
            latitude,
            longitude,
            full_address: fullAddress,
            city,
            state,
            country,
            pincode,
            is_default: isFirst,
          })
          .select()
          .single();

        if (!error && data) {
          setAddresses((prev) =>
            prev.map((a) => (a.id === newAddress.id ? data : a))
          );
        }
      } catch (err) {
        console.warn("Could not insert to remote addresses table. Keeping in local storage.", err);
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Success 🎉", "Address automatically saved via GPS!");
    } catch (e: any) {
      console.error("Error detecting location", e);
      Alert.alert("Error", e.message || "Failed to detect your current location.");
    } finally {
      setDetecting(false);
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
          📍 Manage Addresses
        </Text>
        <View style={styles.rightHeader} />
      </View>

      <View style={styles.content}>
        <TouchableOpacity
          style={[styles.detectBtn, { backgroundColor: colors.primary }]}
          onPress={handleDetectLocation}
          disabled={detecting}
        >
          {detecting ? (
            <ActivityIndicator color="#fff" style={{ marginRight: 8 }} />
          ) : (
            <Feather
              name="navigation"
              size={18}
              color="#fff"
              style={{ marginRight: 8 }}
            />
          )}
          <Text style={styles.detectText}>
            {detecting ? "Locating you..." : "Auto-Detect Current GPS Location"}
          </Text>
        </TouchableOpacity>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : (
          <FlatList
            data={addresses}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
            renderItem={({ item }) => (
              <View
                style={[
                  styles.card,
                  {
                    backgroundColor: colors.card,
                    borderColor: item.is_default
                      ? colors.primary
                      : colors.border,
                  },
                ]}
              >
                <View style={styles.cardHeader}>
                  <Text style={[styles.addressLabel, { color: colors.foreground }]}>
                    {item.full_address}
                  </Text>
                  {item.is_default && (
                    <View
                      style={[
                        styles.defaultBadge,
                        { backgroundColor: colors.primary + "15" },
                      ]}
                    >
                      <Text
                        style={[styles.defaultText, { color: colors.primary }]}
                      >
                        Default
                      </Text>
                    </View>
                  )}
                </View>

                {item.city || item.pincode ? (
                  <Text style={[styles.subText, { color: colors.mutedForeground }]}>
                    {item.city}, {item.state} {item.pincode}
                  </Text>
                ) : null}

                <View style={[styles.actions, { borderTopColor: colors.border }]}>
                  {!item.is_default && (
                    <TouchableOpacity
                      style={styles.actionBtn}
                      onPress={() => handleSetDefault(item.id)}
                    >
                      <Feather
                        name="check-circle"
                        size={15}
                        color={colors.primary}
                      />
                      <Text
                        style={[
                          styles.actionLabel,
                          { color: colors.primary },
                        ]}
                      >
                        Set Default
                      </Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={styles.actionBtn}
                    onPress={() =>
                      router.push({
                        pathname: "/add-address",
                        params: { id: item.id },
                      })
                    }
                  >
                    <Feather name="edit" size={15} color={colors.mutedForeground} />
                    <Text
                      style={[
                        styles.actionLabel,
                        { color: colors.mutedForeground },
                      ]}
                    >
                      Edit
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.actionBtn}
                    onPress={() => handleDelete(item.id)}
                  >
                    <Feather name="trash-2" size={15} color="#ef4444" />
                    <Text style={[styles.actionLabel, { color: "#ef4444" }]}>
                      Delete
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
            ListEmptyComponent={() => (
              <View style={styles.empty}>
                <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                  No saved addresses found. Auto-detect or add one manually!
                </Text>
              </View>
            )}
          />
        )}
      </View>

      <View
        style={[
          styles.footer,
          { paddingBottom: insets.bottom + 12, backgroundColor: colors.card },
        ]}
      >
        <TouchableOpacity
          style={[styles.addBtn, { backgroundColor: colors.foreground }]}
          onPress={() => router.push("/add-address")}
        >
          <Feather name="plus" size={18} color={colors.background} />
          <Text style={[styles.addBtnText, { color: colors.background }]}>
            Add New Address Manually
          </Text>
        </TouchableOpacity>
      </View>
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
  content: { flex: 1, padding: 20 },
  detectBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 12,
    marginBottom: 20,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  detectText: { color: "#fff", fontSize: 15, fontWeight: "800" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  card: {
    padding: 16,
    borderRadius: 14,
    borderWidth: 1.5,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  addressLabel: { flex: 1, fontSize: 15, fontWeight: "700" },
  defaultBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  defaultText: { fontSize: 11, fontWeight: "800" },
  subText: { fontSize: 13, marginTop: 4 },
  actions: {
    flexDirection: "row",
    justifyContent: "space-around",
    borderTopWidth: 1,
    marginTop: 12,
    paddingTop: 10,
  },
  actionBtn: { flexDirection: "row", alignItems: "center", gap: 6 },
  actionLabel: { fontSize: 13, fontWeight: "700" },
  empty: { padding: 40, alignItems: "center" },
  emptyText: { textAlign: "center", fontSize: 14, lineHeight: 20 },
  footer: { padding: 20, borderTopWidth: 1, borderTopColor: "rgba(0,0,0,0.05)" },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  addBtnText: { fontSize: 15, fontWeight: "800" },
});
