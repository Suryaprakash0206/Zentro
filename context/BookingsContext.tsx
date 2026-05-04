import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export type ServiceType = "car_wash" | "bike_wash" | "water_tank";
export type BookingStatus =
  | "pending"
  | "accepted"
  | "in_progress"
  | "completed"
  | "cancelled";

export interface Booking {
  id: string;
  userId: string;
  userName: string;
  userPhone: string;
  workerId?: string;
  workerName?: string;
  workerPhone?: string;
  serviceType: ServiceType;
  serviceLabel: string;
  price: number;
  status: BookingStatus;
  location: string;
  locationLink?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  scheduledDate?: string;
}

interface BookingsContextType {
  bookings: Booking[];
  isLoading: boolean;
  createBooking: (
    data: Omit<
      Booking,
      "id" | "status" | "createdAt" | "updatedAt" | "workerId" | "workerName" | "workerPhone"
    >
  ) => Promise<Booking>;
  acceptBooking: (
    bookingId: string,
    workerId: string,
    workerName: string
  ) => Promise<void>;
  updateStatus: (bookingId: string, status: BookingStatus) => Promise<void>;
  cancelBooking: (bookingId: string) => Promise<void>;
  getBookingsByUser: (userId: string) => Booking[];
  getBookingsByWorker: (workerId: string) => Booking[];
  getPendingBookings: () => Booking[];
  refreshBookings: () => Promise<void>;
}

import { useAuth } from "@/context/AuthContext";

const BookingsContext = createContext<BookingsContextType | null>(null);

export function BookingsProvider({ children }: { children: React.ReactNode }) {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    loadBookings();

    const channel = supabase
      .channel("public:bookings")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bookings" },
        () => {
          loadBookings();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  async function loadBookings() {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("bookings")
        .select(`
          *,
          user:profiles!bookings_user_id_fkey(name, phone),
          worker:profiles!bookings_worker_id_fkey(name, phone)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;

      if (data) {
        const formatted: Booking[] = data.map((b: any) => ({
          id: b.id,
          userId: b.user_id,
          userName: b.user?.name || "Unknown User",
          userPhone: b.user?.phone || "",
          workerId: b.worker_id,
          workerName: b.worker?.name,
          workerPhone: b.worker?.phone,
          serviceType: b.service_type,
          serviceLabel: b.service_label,
          price: Number(b.price),
          status: b.status,
          location: b.location,
          locationLink: b.location_link,
          notes: b.notes,
          createdAt: b.created_at,
          updatedAt: b.updated_at,
          scheduledDate: b.scheduled_date,
        }));
        setBookings(formatted);
      }
    } catch (e) {
      console.error("Error fetching bookings", e);
    } finally {
      setIsLoading(false);
    }
  }

  async function createBooking(
    data: Omit<
      Booking,
      "id" | "status" | "createdAt" | "updatedAt" | "workerId" | "workerName" | "workerPhone"
    >
  ): Promise<Booking> {
    try {
      const payload = {
        user_id: data.userId,
        service_type: data.serviceType,
        service_label: data.serviceLabel,
        price: data.price,
        location: data.location,
        location_link: data.locationLink,
        notes: data.notes,
        scheduled_date: data.scheduledDate,
      };

      const { data: inserted, error } = await supabase
        .from("bookings")
        .insert(payload)
        .select()
        .single();

      if (error) throw error;
      
      const newBooking: Booking = {
        ...data,
        id: inserted.id,
        status: "pending",
        createdAt: inserted.created_at,
        updatedAt: inserted.updated_at,
        scheduledDate: inserted.scheduled_date,
      };
      
      setBookings((prev) => [newBooking, ...prev]);
      return newBooking;
    } catch (e) {
      console.error("Error creating booking", e);
      throw e;
    }
  }

  async function acceptBooking(
    bookingId: string,
    workerId: string,
    workerName: string
  ) {
    try {
      const { error } = await supabase
        .from("bookings")
        .update({
          worker_id: workerId,
          status: "accepted",
        })
        .eq("id", bookingId);

      if (error) throw error;

      try {
        await supabase
          .from("profiles")
          .update({ worker_status: "busy" })
          .eq("id", workerId);
      } catch (err) {
        console.warn("Could not mark worker status as busy", err);
      }

      setBookings((prev) =>
        prev.map((b) =>
          b.id === bookingId
            ? {
                ...b,
                workerId,
                workerName,
                status: "accepted",
                updatedAt: new Date().toISOString(),
              }
            : b
        )
      );
    } catch (e) {
      console.error("Error accepting booking", e);
    }
  }

  async function updateStatus(bookingId: string, status: BookingStatus) {
    try {
      const { error } = await supabase
        .from("bookings")
        .update({ status })
        .eq("id", bookingId);

      if (error) throw error;

      if (status === "completed") {
        const targetBooking = bookings.find((b) => b.id === bookingId);
        if (targetBooking?.workerId) {
          try {
            await supabase
              .from("profiles")
              .update({ worker_status: "available" })
              .eq("id", targetBooking.workerId);
          } catch (err) {
            console.warn("Could not mark worker status as available", err);
          }
        }
      }

      setBookings((prev) =>
        prev.map((b) =>
          b.id === bookingId
            ? { ...b, status, updatedAt: new Date().toISOString() }
            : b
        )
      );
    } catch (e) {
      console.error("Error updating booking status", e);
    }
  }

  async function cancelBooking(bookingId: string) {
    try {
      const { error } = await supabase
        .from("bookings")
        .update({ status: "cancelled" })
        .eq("id", bookingId);

      if (error) throw error;

      setBookings((prev) =>
        prev.map((b) =>
          b.id === bookingId
            ? {
                ...b,
                status: "cancelled",
                updatedAt: new Date().toISOString(),
              }
            : b
        )
      );
    } catch (e) {
      console.error("Error cancelling booking", e);
    }
  }

  function getBookingsByUser(userId: string) {
    return bookings.filter((b) => b.userId === userId);
  }

  function getBookingsByWorker(workerId: string) {
    return bookings.filter(
      (b) => b.workerId === workerId && b.status !== "cancelled"
    );
  }

  function getPendingBookings() {
    return bookings.filter((b) => b.status === "pending");
  }

  async function refreshBookings() {
    await loadBookings();
  }

  return (
    <BookingsContext.Provider
      value={{
        bookings,
        isLoading,
        createBooking,
        acceptBooking,
        updateStatus,
        cancelBooking,
        getBookingsByUser,
        getBookingsByWorker,
        getPendingBookings,
        refreshBookings,
      }}
    >
      {children}
    </BookingsContext.Provider>
  );
}

export function useBookings() {
  const ctx = useContext(BookingsContext);
  if (!ctx) throw new Error("useBookings must be used within BookingsProvider");
  return ctx;
}
