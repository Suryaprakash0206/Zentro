import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { User } from "@supabase/supabase-js";

export type UserRole = "user" | "worker" | "admin";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  avatar?: string;
}

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (
    name: string,
    email: string,
    phone: string,
    password: string,
    role: UserRole
  ) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        fetchProfile(session.user);
      } else {
        setIsLoading(false);
      }
    });

    // Listen to auth changes
    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (session?.user) {
          fetchProfile(session.user);
        } else {
          setUser(null);
          setIsLoading(false);
        }
      }
    );

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  async function fetchProfile(authUser: User) {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", authUser.id)
        .single();

      if (error) throw error;
      if (data) {
        setUser({
          id: data.id,
          name: data.name,
          email: authUser.email || "",
          phone: data.phone || "",
          role: data.role as UserRole,
          avatar: data.avatar_url,
        });
      }
    } catch (e) {
      console.error("Error fetching profile", e);
    } finally {
      setIsLoading(false);
    }
  }

  async function login(
    email: string,
    password: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) return { success: false, error: error.message };
      if (!data.user) return { success: false, error: "Login failed" };

      // Fetch entire profile to set state synchronously and avoid router race condition
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", data.user.id)
        .single();
        
      if (profileError || !profile) {
        await supabase.auth.signOut();
        return { success: false, error: "Your account setup was interrupted previously. Please register a brand new email." };
      }

      setUser({
        id: profile.id,
        name: profile.name,
        email: data.user.email || "",
        phone: profile.phone || "",
        role: profile.role as UserRole,
        avatar: profile.avatar_url,
      });
      
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }

  async function register(
    name: string,
    email: string,
    phone: string,
    password: string,
    role: UserRole
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) return { success: false, error: error.message };
      if (!data.user) return { success: false, error: "Registration failed, please try again." };

      // Check if profile exists (Supabase might create automatically via a DB trigger, but we'll insert/update here safely)
      const { error: profileError } = await supabase.from("profiles").upsert({
        id: data.user.id,
        name,
        phone,
        role,
      });

      if (profileError) return { success: false, error: profileError.message };

      setUser({
        id: data.user.id,
        name,
        email: email,
        phone,
        role,
      });

      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }

  async function logout() {
    setUser(null);
    await supabase.auth.signOut();
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
