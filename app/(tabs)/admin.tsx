import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import React, { useEffect, useState } from "react";
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { supabase } from "@/lib/supabase";

import { StatCard } from "@/components/StatCard";
import { AttendanceStatus, useAttendance } from "@/context/AttendanceContext";
import { AuthUser, useAuth } from "@/context/AuthContext";
import { useBookings } from "@/context/BookingsContext";
import { useServicePrices } from "@/context/ServicePricesContext";
import { useColors } from "@/hooks/useColors";

type AdminTab = "overview" | "attendance" | "charges";

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const STATUS_OPTIONS: { id: AttendanceStatus; label: string; emoji: string; color: string }[] = [
  { id: "present", label: "Present", emoji: "✅", color: "#22c55e" },
  { id: "half_day", label: "Half Day", emoji: "🌓", color: "#f59e0b" },
  { id: "absent", label: "Absent", emoji: "❌", color: "#ef4444" },
  { id: "holiday", label: "Holiday", emoji: "🏖️", color: "#3b82f6" },
];

export default function AdminScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { bookings } = useBookings();
  const { prices, updatePrice } = useServicePrices();
  const {
    markAttendance,
    updateDailyRate,
    getDailyRate,
    getMonthlyAttendance,
    calculateMonthlySalary,
    attendance,
  } = useAttendance();

  const { logout } = useAuth();
  const [activeTab, setActiveTab] = useState<AdminTab>("overview");
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [editingPrices, setEditingPrices] = useState<Record<string, string>>({});
  const [editingRates, setEditingRates] = useState<Record<string, string>>({});
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear] = useState(new Date().getFullYear());
  const [selectedWorkerId, setSelectedWorkerId] = useState<string | null>(null);

  // Add worker form states
  const [showAddWorker, setShowAddWorker] = useState(false);
  const [nwName, setNwName] = useState("");
  const [nwEmail, setNwEmail] = useState("");
  const [nwPhone, setNwPhone] = useState("");
  const [nwPassword, setNwPassword] = useState("");
  const [workerLoading, setWorkerLoading] = useState(false);

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    const initial: Record<string, string> = {};
    prices.forEach((p) => { initial[p.id] = p.price.toString(); });
    setEditingPrices(initial);
  }, [prices]);

  async function loadUsers() {
    const { data: profiles, error } = await supabase.from('profiles').select('*');
    if (error) {
      console.error("Error fetching users:", error);
      return;
    }

    const all: AuthUser[] = (profiles || []).map((p) => ({
      id: p.id,
      name: p.name || "Unknown",
      email: "Registered User", // Avoid exposing real emails for security since they only exist in auth.users
      phone: p.phone || "N/A",
      role: p.role as any,
      worker_status: p.worker_status || "available",
    }));

    setUsers(all);

    const workers = all.filter((u) => u.role === "worker");
    const rates: Record<string, string> = {};
    workers.forEach((w) => { rates[w.id] = getDailyRate(w.id).toString(); });
    setEditingRates(rates);

    if (workers.length > 0 && !selectedWorkerId) {
      setSelectedWorkerId(workers[0].id);
    }
  }

  async function handleCreateWorker() {
    if (!nwName || !nwEmail || !nwPhone || !nwPassword) {
      Alert.alert("Error", "Please fill in all details");
      return;
    }
    setWorkerLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: nwEmail.trim(),
        password: nwPassword,
      });

      if (error) {
        Alert.alert("Error", error.message);
        setWorkerLoading(false);
        return;
      }

      if (data?.user) {
        await supabase.from("profiles").upsert({
          id: data.user.id,
          name: nwName,
          phone: nwPhone,
          role: "worker"
        });

        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert(
          "Worker Registered", 
          "The worker has been securely created. Because the session swapped, you will now be logged out. Please sign back in.",
          [{ text: "OK", onPress: () => logout() }]
        );
      }
    } catch (e: any) {
      Alert.alert("Registration Failed", e.message);
      setWorkerLoading(false);
    }
  }

  async function handleSavePrices() {
    for (const [id, val] of Object.entries(editingPrices)) {
      const num = parseInt(val, 10);
      if (!isNaN(num) && num > 0) {
        await updatePrice(id, num);
      }
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert("✅ Saved", "Service charges updated successfully!");
  }

  async function handleSaveRate(workerId: string) {
    const val = editingRates[workerId];
    const num = parseInt(val, 10);
    if (!isNaN(num) && num > 0) {
      await updateDailyRate(workerId, num);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("✅ Saved", "Daily rate updated!");
    }
  }

  function getDaysInMonth(year: number, month: number) {
    return new Date(year, month, 0).getDate();
  }

  function formatDate(year: number, month: number, day: number): string {
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  function getAttendanceForDay(workerId: string, date: string): AttendanceStatus | null {
    const rec = attendance.find((a) => a.workerId === workerId && a.date === date);
    return rec?.status ?? null;
  }

  const workerList = users.filter((u) => u.role === "worker");
  const customerList = users.filter((u) => u.role === "user");
  const selectedWorker = workerList.find((w) => w.id === selectedWorkerId);
  const daysInMonth = getDaysInMonth(selectedYear, selectedMonth);

  // Overview stats
  const totalEarnings = bookings.filter((b) => b.status === "completed").reduce((sum, b) => sum + b.price, 0);
  const pendingCount = bookings.filter((b) => b.status === "pending").length;
  const completedCount = bookings.filter((b) => b.status === "completed").length;
  const activeCount = bookings.filter((b) => b.status === "accepted" || b.status === "in_progress").length;
  const carWashEarnings = bookings.filter((b) => b.status === "completed" && b.serviceType === "car_wash").reduce((sum, b) => sum + b.price, 0);
  const bikeWashEarnings = bookings.filter((b) => b.status === "completed" && b.serviceType === "bike_wash").reduce((sum, b) => sum + b.price, 0);
  const tankEarnings = bookings.filter((b) => b.status === "completed" && b.serviceType === "water_tank").reduce((sum, b) => sum + b.price, 0);

  const TABS: { id: AdminTab; label: string; emoji: string }[] = [
    { id: "overview", label: "Overview", emoji: "📊" },
    { id: "attendance", label: "Attendance", emoji: "📅" },
    { id: "charges", label: "Charges", emoji: "💰" },
  ];

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Header */}
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
          🛡️ Admin Panel
        </Text>

        {/* Tab Switcher */}
        <View style={[styles.tabBar, { backgroundColor: colors.muted }]}>
          {TABS.map((tab) => (
            <TouchableOpacity
              key={tab.id}
              style={[
                styles.tabItem,
                activeTab === tab.id && { backgroundColor: colors.primary },
              ]}
              onPress={() => {
                setActiveTab(tab.id);
                Haptics.selectionAsync();
              }}
            >
              <Text style={styles.tabEmoji}>{tab.emoji}</Text>
              <Text
                style={[
                  styles.tabLabel,
                  { color: activeTab === tab.id ? "#fff" : colors.mutedForeground },
                ]}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* ── OVERVIEW TAB ── */}
      {activeTab === "overview" && (
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 34 }]}
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.earningsCard, { backgroundColor: "#22c55e10", borderColor: "#22c55e30" }]}>
            <Text style={[styles.earningsLabel, { color: colors.mutedForeground }]}>💵 Total Revenue</Text>
            <Text style={[styles.earningsAmount, { color: "#22c55e" }]}>
              ₹{totalEarnings.toLocaleString("en-IN")}
            </Text>
          </View>

          <View style={styles.statsGrid}>
            <StatCard icon="clock" label="⏳ Pending" value={pendingCount.toString()} color="#f59e0b" />
            <StatCard icon="activity" label="⚡ Active" value={activeCount.toString()} color="#3b82f6" />
          </View>
          <View style={[styles.statsGrid, { marginTop: 10 }]}>
            <StatCard icon="check-circle" label="✅ Completed" value={completedCount.toString()} color="#22c55e" />
            <StatCard icon="users" label="👥 Customers" value={customerList.length.toString()} color="#dc2626" />
          </View>

          {bookings.filter((b) => b.status === "pending").length > 0 && (
            <View style={[styles.queueContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.queueTitle, { color: colors.foreground }]}>
                ⏳ Pending Service Queue ({bookings.filter((b) => b.status === "pending").length})
              </Text>
              {bookings.filter((b) => b.status === "pending").map((b) => {
                const isDelayed = b.notes?.includes("DELAYED_QUEUE");
                return (
                  <View key={b.id} style={[styles.queueItem, { borderColor: isDelayed ? "#ef4444" : colors.border }]}>
                    <View style={styles.queueItemTop}>
                      <Text style={[styles.queueItemLabel, { color: colors.foreground }]}>
                        {b.serviceLabel} - ₹{b.price}
                      </Text>
                      {isDelayed && (
                        <View style={styles.delayedBadge}>
                          <Text style={styles.delayedBadgeText}>DELAYED</Text>
                        </View>
                      )}
                    </View>
                    <Text style={[styles.queueItemSub, { color: colors.mutedForeground }]}>
                      📌 {b.location}
                    </Text>
                    {b.notes ? (
                      <Text style={[styles.queueItemNotes, { color: isDelayed ? "#ef4444" : colors.mutedForeground }]}>
                        📝 {b.notes}
                      </Text>
                    ) : null}

                    <Text style={[styles.assignTitle, { color: colors.mutedForeground }]}>
                      Assign to worker:
                    </Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.assignRow}>
                      {workerList.map((w) => (
                        <TouchableOpacity
                          key={w.id}
                          style={[
                            styles.assignChip,
                            {
                              backgroundColor: w.worker_status === "available" ? "#22c55e" : "#64748b",
                            },
                          ]}
                          onPress={async () => {
                            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                            try {
                              const { error } = await supabase
                                .from("bookings")
                                .update({ worker_id: w.id, status: "accepted" })
                                .eq("id", b.id);
                              
                              if (error) throw error;
                              Alert.alert("Success", `Assigned job to ${w.name}!`);
                              loadUsers();
                            } catch (e: any) {
                              Alert.alert("Error", e.message || "Failed to assign.");
                            }
                          }}
                        >
                          <Text style={styles.assignChipText}>{w.name}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                );
              })}
            </View>
          )}

          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>📊 By Service</Text>
          {[
            { label: "🚗 Car Wash", earnings: carWashEarnings, color: "#dc2626" },
            { label: "🏍️ Bike Wash", earnings: bikeWashEarnings, color: "#7c3aed" },
            { label: "💧 Tank Cleaning", earnings: tankEarnings, color: "#059669" },
          ].map((s) => (
            <View
              key={s.label}
              style={[styles.serviceEarningsRow, { backgroundColor: colors.card, borderColor: colors.border }]}
            >
              <Text style={[styles.serviceEarningsLabel, { color: colors.foreground }]}>{s.label}</Text>
              <Text style={[styles.serviceEarningsValue, { color: s.color }]}>₹{s.earnings}</Text>
            </View>
          ))}

          <View style={styles.sectionHeaderWrap}>
            <Text style={[styles.sectionTitle, { color: colors.foreground, marginTop: 0, marginBottom: 0 }]}>🔧 Workers</Text>
            <TouchableOpacity onPress={() => setShowAddWorker(!showAddWorker)} style={[styles.inlineBtn, { backgroundColor: colors.primary }]}>
              <Feather name={showAddWorker ? "x" : "plus"} size={14} color="#fff" />
              <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>{showAddWorker ? "Close" : "New"}</Text>
            </TouchableOpacity>
          </View>

          {showAddWorker && (
            <View style={[styles.addWorkerForm, { backgroundColor: colors.card, borderColor: colors.border }]}>
               <TextInput style={[styles.nwInput, { color: colors.foreground, borderColor: colors.border }]} placeholder="Name" placeholderTextColor={colors.mutedForeground} value={nwName} onChangeText={setNwName} />
               <TextInput style={[styles.nwInput, { color: colors.foreground, borderColor: colors.border }]} placeholder="Email" placeholderTextColor={colors.mutedForeground} value={nwEmail} onChangeText={setNwEmail} keyboardType="email-address" autoCapitalize="none" />
               <TextInput style={[styles.nwInput, { color: colors.foreground, borderColor: colors.border }]} placeholder="Phone" placeholderTextColor={colors.mutedForeground} value={nwPhone} onChangeText={setNwPhone} keyboardType="phone-pad" />
               <TextInput style={[styles.nwInput, { color: colors.foreground, borderColor: colors.border }]} placeholder="Password (min 6 chars)" placeholderTextColor={colors.mutedForeground} value={nwPassword} onChangeText={setNwPassword} secureTextEntry />
               <TouchableOpacity style={[styles.createWorkerBtn, { backgroundColor: colors.primary }]} onPress={handleCreateWorker} disabled={workerLoading}>
                 {workerLoading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.createWorkerBtnText}>Create Worker</Text>}
               </TouchableOpacity>
               <Text style={[styles.warningText, { color: colors.mutedForeground }]}>⚠️ Note: Creating a worker will temporarily log you out of your Admin session.</Text>
            </View>
          )}
          {workerList.map((w) => {
            const wBookings = bookings.filter((b) => b.workerId === w.id && b.status === "completed");
            return (
              <View key={w.id} style={[styles.userCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={[styles.avatar, { backgroundColor: "#7c3aed20" }]}>
                  <Text style={{ fontSize: 20 }}>🔧</Text>
                </View>
                <View style={styles.userInfo}>
                  <Text style={[styles.userName, { color: colors.foreground }]}>{w.name}</Text>
                  <Text style={[styles.userMeta, { color: colors.mutedForeground }]}>{w.email}</Text>
                  <Text style={[styles.userMeta, { color: colors.mutedForeground }]}>{w.phone}</Text>
                  <View style={[styles.statusMiniBadge, { backgroundColor: w.worker_status === "available" ? "#22c55e20" : w.worker_status === "busy" ? "#f59e0b20" : "#64748b20" }]}>
                    <Text style={{ fontSize: 10, fontWeight: "800", color: w.worker_status === "available" ? "#22c55e" : w.worker_status === "busy" ? "#f59e0b" : "#64748b" }}>
                      {w.worker_status ? w.worker_status.toUpperCase() : "AVAILABLE"}
                    </Text>
                  </View>
                </View>
                <View style={styles.workerStats}>
                  <Text style={[styles.statValue, { color: "#7c3aed" }]}>
                    ₹{wBookings.reduce((s, b) => s + b.price, 0)}
                  </Text>
                  <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>
                    {wBookings.length} jobs
                  </Text>
                </View>
              </View>
            );
          })}

          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>👤 Customers</Text>
          {customerList.map((c) => {
            const cBookings = bookings.filter((b) => b.userId === c.id);
            return (
              <View key={c.id} style={[styles.userCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={[styles.avatar, { backgroundColor: "#dc262620" }]}>
                  <Text style={{ fontSize: 20 }}>👤</Text>
                </View>
                <View style={styles.userInfo}>
                  <Text style={[styles.userName, { color: colors.foreground }]}>{c.name}</Text>
                  <Text style={[styles.userMeta, { color: colors.mutedForeground }]}>{c.email}</Text>
                  <Text style={[styles.userMeta, { color: colors.mutedForeground }]}>{c.phone}</Text>
                </View>
                <View style={styles.workerStats}>
                  <Text style={[styles.statValue, { color: "#dc2626" }]}>{cBookings.length}</Text>
                  <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>bookings</Text>
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* ── ATTENDANCE TAB ── */}
      {activeTab === "attendance" && (
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 34 }]}
          showsVerticalScrollIndicator={false}
        >
          {/* Worker selector */}
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>👷 Select Worker</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.workerChips}>
            {workerList.map((w) => (
              <TouchableOpacity
                key={w.id}
                style={[
                  styles.workerChip,
                  {
                    backgroundColor: selectedWorkerId === w.id ? colors.primary : colors.card,
                    borderColor: selectedWorkerId === w.id ? colors.primary : colors.border,
                  },
                ]}
                onPress={() => { setSelectedWorkerId(w.id); Haptics.selectionAsync(); }}
              >
                <Text style={{ fontSize: 14 }}>🔧</Text>
                <Text style={[styles.workerChipText, { color: selectedWorkerId === w.id ? "#fff" : colors.foreground }]}>
                  {w.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Month selector */}
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>📆 Month</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.monthChips}>
            {MONTHS.map((m, i) => (
              <TouchableOpacity
                key={m}
                style={[
                  styles.monthChip,
                  {
                    backgroundColor: selectedMonth === i + 1 ? colors.primary : colors.card,
                    borderColor: selectedMonth === i + 1 ? colors.primary : colors.border,
                  },
                ]}
                onPress={() => { setSelectedMonth(i + 1); Haptics.selectionAsync(); }}
              >
                <Text style={[styles.monthChipText, { color: selectedMonth === i + 1 ? "#fff" : colors.foreground }]}>
                  {m}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Daily Rate */}
          {selectedWorkerId && selectedWorker && (
            <>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                💵 Daily Wage Rate — {selectedWorker.name}
              </Text>
              <View style={styles.rateRow}>
                <View style={[styles.rateInputWrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <Text style={styles.ratePrefix}>₹</Text>
                  <TextInput
                    style={[styles.rateInput, { color: colors.foreground }]}
                    value={editingRates[selectedWorkerId] ?? ""}
                    onChangeText={(v) => setEditingRates((prev) => ({ ...prev, [selectedWorkerId]: v }))}
                    keyboardType="numeric"
                    placeholder="500"
                    placeholderTextColor={colors.mutedForeground}
                  />
                  <Text style={[styles.rateSuffix, { color: colors.mutedForeground }]}>/day</Text>
                </View>
                <TouchableOpacity
                  style={[styles.saveRateBtn, { backgroundColor: colors.primary }]}
                  onPress={() => handleSaveRate(selectedWorkerId)}
                >
                  <Feather name="save" size={16} color="#fff" />
                </TouchableOpacity>
              </View>

              {/* Salary Summary */}
              {(() => {
                const sal = calculateMonthlySalary(selectedWorkerId, selectedYear, selectedMonth);
                return (
                  <View style={[styles.salarySummary, { backgroundColor: "#22c55e10", borderColor: "#22c55e30" }]}>
                    <Text style={[styles.salaryTitle, { color: colors.foreground }]}>
                      📊 {MONTHS[selectedMonth - 1]} {selectedYear} Summary
                    </Text>
                    <View style={styles.salaryGrid}>
                      {[
                        { label: "✅ Present", value: `${sal.presentDays} days`, color: "#22c55e" },
                        { label: "🌓 Half Days", value: `${sal.halfDays} days`, color: "#f59e0b" },
                        { label: "❌ Absent", value: `${sal.absentDays} days`, color: "#ef4444" },
                      ].map((s) => (
                        <View key={s.label} style={styles.salaryItem}>
                          <Text style={[styles.salaryItemValue, { color: s.color }]}>{s.value}</Text>
                          <Text style={[styles.salaryItemLabel, { color: colors.mutedForeground }]}>{s.label}</Text>
                        </View>
                      ))}
                    </View>
                    <View style={[styles.salaryTotal, { borderColor: "#22c55e30" }]}>
                      <Text style={[styles.salaryTotalLabel, { color: colors.mutedForeground }]}>
                        💰 Net Salary (₹{sal.dailyRate}/day)
                      </Text>
                      <Text style={[styles.salaryTotalValue, { color: "#22c55e" }]}>
                        ₹{sal.totalSalary.toLocaleString("en-IN")}
                      </Text>
                    </View>
                  </View>
                );
              })()}

              {/* Calendar grid */}
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                📅 Mark Attendance
              </Text>
              <View style={styles.calendarGrid}>
                {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
                  const dateStr = formatDate(selectedYear, selectedMonth, day);
                  const status = getAttendanceForDay(selectedWorkerId, dateStr);
                  const statusConfig = STATUS_OPTIONS.find((s) => s.id === status);
                  return (
                    <TouchableOpacity
                      key={day}
                      style={[
                        styles.calDay,
                        {
                          backgroundColor: statusConfig ? statusConfig.color + "20" : colors.card,
                          borderColor: statusConfig ? statusConfig.color : colors.border,
                        },
                      ]}
                      onPress={() => {
                        Haptics.selectionAsync();
                        Alert.alert(
                          `📅 Day ${day} — ${MONTHS[selectedMonth - 1]}`,
                          `Mark attendance for ${selectedWorker.name}`,
                          STATUS_OPTIONS.map((opt) => ({
                            text: `${opt.emoji} ${opt.label}`,
                            onPress: () =>
                              markAttendance(selectedWorkerId, selectedWorker.name, dateStr, opt.id),
                            style: status === opt.id ? "destructive" : "default",
                          }))
                        );
                      }}
                    >
                      <Text style={[styles.calDayNum, { color: colors.foreground }]}>{day}</Text>
                      {statusConfig && (
                        <Text style={styles.calDayEmoji}>{statusConfig.emoji}</Text>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Legend */}
              <View style={styles.legend}>
                {STATUS_OPTIONS.map((opt) => (
                  <View key={opt.id} style={styles.legendItem}>
                    <Text style={styles.legendEmoji}>{opt.emoji}</Text>
                    <Text style={[styles.legendLabel, { color: colors.mutedForeground }]}>{opt.label}</Text>
                  </View>
                ))}
              </View>
            </>
          )}

          {workerList.length === 0 && (
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>🔧</Text>
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No workers registered yet</Text>
            </View>
          )}
        </ScrollView>
      )}

      {/* ── CHARGES TAB ── */}
      {activeTab === "charges" && (
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 34 }]}
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.infoCard, { backgroundColor: colors.accent, borderColor: colors.border }]}>
            <Text style={styles.infoEmoji}>ℹ️</Text>
            <Text style={[styles.infoText, { color: colors.accentForeground }]}>
              Edit the prices below and tap "Save Changes" to update service charges for all customers.
            </Text>
          </View>

          {prices.map((service) => (
            <View
              key={service.id}
              style={[styles.chargeCard, { backgroundColor: colors.card, borderColor: colors.border }]}
            >
              <View style={styles.chargeHeader}>
                <Text style={styles.chargeEmoji}>{service.emoji}</Text>
                <View style={styles.chargeInfo}>
                  <Text style={[styles.chargeName, { color: colors.foreground }]}>{service.label}</Text>
                  <Text style={[styles.chargeDesc, { color: colors.mutedForeground }]}>{service.description}</Text>
                </View>
                <View style={[styles.currentPriceBadge, { backgroundColor: colors.primaryLight }]}>
                  <Text style={[styles.currentPriceText, { color: colors.primary }]}>
                    ₹{service.price}
                  </Text>
                </View>
              </View>

              <View style={[styles.priceInputWrap, { backgroundColor: colors.background, borderColor: colors.border }]}>
                <Text style={[styles.pricePrefix, { color: colors.mutedForeground }]}>₹</Text>
                <TextInput
                  style={[styles.priceInput, { color: colors.foreground }]}
                  value={editingPrices[service.id] ?? service.price.toString()}
                  onChangeText={(v) =>
                    setEditingPrices((prev) => ({ ...prev, [service.id]: v }))
                  }
                  keyboardType="numeric"
                  placeholder={service.price.toString()}
                  placeholderTextColor={colors.mutedForeground}
                />
                <Text style={[styles.priceSuffix, { color: colors.mutedForeground }]}>per visit</Text>
              </View>
            </View>
          ))}

          <TouchableOpacity
            style={[styles.saveBtn, { backgroundColor: colors.primary }]}
            onPress={handleSavePrices}
            activeOpacity={0.85}
          >
            <Feather name="save" size={18} color="#fff" />
            <Text style={styles.saveBtnText}>💾 Save Changes</Text>
          </TouchableOpacity>

          <View style={[styles.noteCard, { backgroundColor: colors.muted }]}>
            <Text style={[styles.noteText, { color: colors.mutedForeground }]}>
              📌 Note: Updated prices apply to new bookings only. Existing bookings retain their original prices.
            </Text>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 12 },
  title: { fontSize: 24, fontWeight: "800", letterSpacing: -0.5, marginBottom: 14 },
  tabBar: {
    flexDirection: "row",
    borderRadius: 14,
    padding: 4,
    gap: 2,
  },
  tabItem: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    borderRadius: 10,
    gap: 4,
  },
  tabEmoji: { fontSize: 14 },
  tabLabel: { fontSize: 12, fontWeight: "700" },
  scroll: { paddingHorizontal: 20, paddingTop: 8 },
  earningsCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    marginBottom: 12,
  },
  earningsLabel: { fontSize: 13, fontWeight: "500" },
  earningsAmount: { fontSize: 34, fontWeight: "900", marginTop: 4, letterSpacing: -1 },
  statsGrid: { flexDirection: "row", gap: 10 },
  sectionTitle: { fontSize: 16, fontWeight: "800", marginTop: 20, marginBottom: 12, letterSpacing: -0.2 },
  serviceEarningsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  serviceEarningsLabel: { fontSize: 14, fontWeight: "600" },
  serviceEarningsValue: { fontSize: 16, fontWeight: "800" },
  userCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 8,
    gap: 12,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  userInfo: { flex: 1 },
  userName: { fontSize: 15, fontWeight: "700" },
  userMeta: { fontSize: 12, marginTop: 1 },
  workerStats: { alignItems: "flex-end" },
  statValue: { fontSize: 16, fontWeight: "800" },
  statLabel: { fontSize: 11, marginTop: 2 },
  // Attendance styles
  workerChips: { gap: 8, paddingBottom: 4 },
  workerChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    gap: 6,
  },
  workerChipText: { fontSize: 13, fontWeight: "700" },
  monthChips: { gap: 8, paddingBottom: 4 },
  monthChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  monthChipText: { fontSize: 13, fontWeight: "600" },
  rateRow: { flexDirection: "row", gap: 10, alignItems: "center" },
  rateInputWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 6,
  },
  ratePrefix: { fontSize: 16, fontWeight: "700", color: "#22c55e" },
  rateInput: { flex: 1, fontSize: 16, fontWeight: "700" },
  rateSuffix: { fontSize: 13 },
  saveRateBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  salarySummary: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginTop: 4,
    marginBottom: 4,
    gap: 12,
  },
  salaryTitle: { fontSize: 14, fontWeight: "700" },
  salaryGrid: { flexDirection: "row", gap: 10 },
  salaryItem: { flex: 1, alignItems: "center" },
  salaryItemValue: { fontSize: 16, fontWeight: "800" },
  salaryItemLabel: { fontSize: 11, marginTop: 2, textAlign: "center" },
  salaryTotal: {
    borderTopWidth: 1,
    paddingTop: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  salaryTotalLabel: { fontSize: 13, fontWeight: "600" },
  salaryTotalValue: { fontSize: 22, fontWeight: "900" },
  calendarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  calDay: {
    width: "13%",
    aspectRatio: 1,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  calDayNum: { fontSize: 11, fontWeight: "700" },
  calDayEmoji: { fontSize: 8, marginTop: 1 },
  legend: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 12,
  },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  legendEmoji: { fontSize: 14 },
  legendLabel: { fontSize: 12 },
  empty: { alignItems: "center", paddingTop: 60, gap: 12 },
  emptyEmoji: { fontSize: 48 },
  emptyText: { fontSize: 16, fontWeight: "500" },
  // Charges styles
  infoCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
    gap: 10,
  },
  infoEmoji: { fontSize: 18 },
  infoText: { flex: 1, fontSize: 13, lineHeight: 18 },
  chargeCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
    gap: 12,
  },
  chargeHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  chargeEmoji: { fontSize: 28 },
  chargeInfo: { flex: 1 },
  chargeName: { fontSize: 16, fontWeight: "700" },
  chargeDesc: { fontSize: 12, marginTop: 2 },
  currentPriceBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  currentPriceText: { fontSize: 13, fontWeight: "800" },
  priceInputWrap: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 8,
  },
  pricePrefix: { fontSize: 18, fontWeight: "700" },
  priceInput: { flex: 1, fontSize: 18, fontWeight: "700" },
  priceSuffix: { fontSize: 13 },
  saveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    borderRadius: 14,
    gap: 8,
    marginTop: 4,
    shadowColor: "#dc2626",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  saveBtnText: { color: "#fff", fontSize: 16, fontWeight: "800" },
  noteCard: {
    borderRadius: 12,
    padding: 14,
    marginTop: 12,
  },
  noteText: { fontSize: 12, lineHeight: 18 },
  sectionHeaderWrap: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 20,
    marginBottom: 12,
  },
  inlineBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  addWorkerForm: {
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 16,
    gap: 10,
  },
  nwInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
  },
  createWorkerBtn: {
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  createWorkerBtnText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },
  warningText: {
    fontSize: 11,
    textAlign: "center",
    marginTop: 4,
  },
  statusMiniBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 4,
  },
  queueContainer: {
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 16,
    marginBottom: 16,
    gap: 12,
  },
  queueTitle: {
    fontSize: 14,
    fontWeight: "700",
  },
  queueItem: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 6,
    marginBottom: 8,
  },
  queueItemTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  queueItemLabel: {
    fontSize: 14,
    fontWeight: "700",
  },
  delayedBadge: {
    backgroundColor: "#ef444420",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  delayedBadgeText: {
    color: "#ef4444",
    fontSize: 10,
    fontWeight: "800",
  },
  queueItemSub: {
    fontSize: 12,
  },
  queueItemNotes: {
    fontSize: 12,
    fontStyle: "italic",
  },
  assignTitle: {
    fontSize: 12,
    fontWeight: "600",
    marginTop: 6,
  },
  assignRow: {
    flexDirection: "row",
    gap: 8,
    paddingVertical: 4,
  },
  assignChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  assignChipText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },
});
