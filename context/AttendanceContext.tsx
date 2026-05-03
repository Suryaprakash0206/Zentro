import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export type AttendanceStatus = "present" | "absent" | "half_day" | "holiday";

export interface AttendanceRecord {
  id: string;
  workerId: string;
  workerName: string;
  date: string; // YYYY-MM-DD
  status: AttendanceStatus;
}

export interface WorkerSalaryConfig {
  workerId: string;
  dailyRate: number; // daily wage in ₹
}

interface AttendanceContextType {
  attendance: AttendanceRecord[];
  salaryConfigs: WorkerSalaryConfig[];
  markAttendance: (
    workerId: string,
    workerName: string,
    date: string,
    status: AttendanceStatus
  ) => Promise<void>;
  updateDailyRate: (workerId: string, rate: number) => Promise<void>;
  getDailyRate: (workerId: string) => number;
  getMonthlyAttendance: (
    workerId: string,
    year: number,
    month: number
  ) => AttendanceRecord[];
  calculateMonthlySalary: (
    workerId: string,
    year: number,
    month: number
  ) => {
    presentDays: number;
    halfDays: number;
    absentDays: number;
    totalSalary: number;
    dailyRate: number;
  };
}

const AttendanceContext = createContext<AttendanceContextType | null>(null);

import { useAuth } from "@/context/AuthContext";

const DEFAULT_DAILY_RATE = 500;

export function AttendanceProvider({ children }: { children: React.ReactNode }) {
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [salaryConfigs, setSalaryConfigs] = useState<WorkerSalaryConfig[]>([]);
  const { user } = useAuth();

  useEffect(() => {
    loadData();
  }, [user]);

  async function loadData() {
    try {
      // Load attendance
      const { data: attData, error: attError } = await supabase
        .from("attendance_records")
        .select("*, worker:profiles!attendance_records_worker_id_fkey(name)");
        
      if (!attError && attData) {
        setAttendance(
          attData.map((a: any) => ({
            id: a.id,
            workerId: a.worker_id,
            workerName: a.worker?.name || "Unknown Worker",
            date: a.date,
            status: a.status,
          }))
        );
      }

      // Load specific salary configurations
      const { data: salData, error: salError } = await supabase
        .from("worker_salary_configs")
        .select("*");
      
      if (!salError && salData) {
        setSalaryConfigs(
          salData.map((s: any) => ({
            workerId: s.worker_id,
            dailyRate: Number(s.daily_rate),
          }))
        );
      }
    } catch (e) {
      console.error("Error loading attendance data", e);
    }
  }

  async function markAttendance(
    workerId: string,
    workerName: string,
    date: string,
    status: AttendanceStatus
  ) {
    try {
      const { data, error } = await supabase
        .from("attendance_records")
        .upsert(
          { worker_id: workerId, date, status },
          { onConflict: "worker_id,date" }
        )
        .select()
        .single();
        
      if (error) throw error;

      setAttendance((prev) => {
        const existing = prev.filter(
          (a) => !(a.workerId === workerId && a.date === date)
        );
        return [
          ...existing,
          {
            id: data.id,
            workerId,
            workerName,
            date,
            status,
          },
        ];
      });
    } catch (e) {
      console.error("Error marking attendance", e);
    }
  }

  async function updateDailyRate(workerId: string, rate: number) {
    try {
      const { error } = await supabase
        .from("worker_salary_configs")
        .upsert(
          { worker_id: workerId, daily_rate: rate },
          { onConflict: "worker_id" }
        );
        
      if (error) throw error;

      setSalaryConfigs((prev) => {
        const existing = prev.filter((s) => s.workerId !== workerId);
        return [...existing, { workerId, dailyRate: rate }];
      });
    } catch (e) {
      console.error("Error updating daily rate", e);
    }
  }

  function getDailyRate(workerId: string): number {
    return (
      salaryConfigs.find((s) => s.workerId === workerId)?.dailyRate ??
      DEFAULT_DAILY_RATE
    );
  }

  function getMonthlyAttendance(
    workerId: string,
    year: number,
    month: number
  ): AttendanceRecord[] {
    const prefix = `${year}-${String(month).padStart(2, "0")}`;
    return attendance.filter(
      (a) => a.workerId === workerId && a.date.startsWith(prefix)
    );
  }

  function calculateMonthlySalary(
    workerId: string,
    year: number,
    month: number
  ) {
    const records = getMonthlyAttendance(workerId, year, month);
    const presentDays = records.filter((r) => r.status === "present").length;
    const halfDays = records.filter((r) => r.status === "half_day").length;
    const absentDays = records.filter((r) => r.status === "absent").length;
    const dailyRate = getDailyRate(workerId);
    const totalSalary = presentDays * dailyRate + halfDays * (dailyRate / 2);
    return { presentDays, halfDays, absentDays, totalSalary, dailyRate };
  }

  return (
    <AttendanceContext.Provider
      value={{
        attendance,
        salaryConfigs,
        markAttendance,
        updateDailyRate,
        getDailyRate,
        getMonthlyAttendance,
        calculateMonthlySalary,
      }}
    >
      {children}
    </AttendanceContext.Provider>
  );
}

export function useAttendance() {
  const ctx = useContext(AttendanceContext);
  if (!ctx) throw new Error("useAttendance must be used within AttendanceProvider");
  return ctx;
}
