import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export interface ServicePrice {
  id: string;
  label: string;
  emoji: string;
  price: number;
  description: string;
}

interface ServicePricesContextType {
  prices: ServicePrice[];
  updatePrice: (id: string, price: number) => Promise<void>;
  getPrice: (id: string) => number;
}

const ServicePricesContext = createContext<ServicePricesContextType | null>(null);

export const DEFAULT_PRICES: ServicePrice[] = [
  {
    id: "car_wash",
    label: "Car Wash",
    emoji: "🚗",
    price: 499,
    description: "Full exterior & interior cleaning",
  },
  {
    id: "bike_wash",
    label: "Bike Wash",
    emoji: "🏍️",
    price: 249,
    description: "Thorough bike cleaning & polishing",
  },
  {
    id: "water_tank",
    label: "Water Tank Cleaning",
    emoji: "💧",
    price: 799,
    description: "Deep tank cleaning & sanitization",
  },
];

import { useAuth } from "@/context/AuthContext";

export function ServicePricesProvider({ children }: { children: React.ReactNode }) {
  const [prices, setPrices] = useState<ServicePrice[]>(DEFAULT_PRICES);
  const { user } = useAuth();

  useEffect(() => {
    loadPrices();
  }, [user]);

  async function loadPrices() {
    try {
      const { data, error } = await supabase.from("services").select("*");
      if (error) throw error;
      
      if (data && data.length > 0) {
        setPrices(
          data.map((row) => ({
            id: row.id,
            label: row.label,
            emoji: row.emoji || "",
            price: Number(row.price),
            description: row.description || "",
          }))
        );
      }
    } catch (e) {
      console.error("Error fetching service prices", e);
    }
  }

  async function updatePrice(id: string, price: number) {
    try {
      const { error } = await supabase
        .from("services")
        .update({ price })
        .eq("id", id);
      
      if (error) throw error;

      setPrices((prev) => prev.map((p) => (p.id === id ? { ...p, price } : p)));
    } catch (e) {
      console.error("Error updating price", e);
    }
  }

  function getPrice(id: string): number {
    return prices.find((p) => p.id === id)?.price ?? 499;
  }

  return (
    <ServicePricesContext.Provider value={{ prices, updatePrice, getPrice }}>
      {children}
    </ServicePricesContext.Provider>
  );
}

export function useServicePrices() {
  const ctx = useContext(ServicePricesContext);
  if (!ctx) throw new Error("useServicePrices must be used within ServicePricesProvider");
  return ctx;
}
