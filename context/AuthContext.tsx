import React, { createContext, useContext, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "@/lib/supabase";
import { User } from "@supabase/supabase-js";

export type UserRole = "user" | "worker" | "admin";
export type WorkerStatus = "available" | "busy" | "offline";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  avatar?: string;
  worker_status?: WorkerStatus;
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
  sendResetOtp: (email: string) => Promise<{ success: boolean; error?: string }>;
  verifyResetOtp: (email: string, otp: string) => Promise<{ success: boolean; error?: string }>;
  updatePassword: (password: string) => Promise<{ success: boolean; error?: string }>;
  updateProfile: (name: string, phone: string) => Promise<{ success: boolean; error?: string }>;
  updateWorkerStatus: (status: WorkerStatus) => Promise<{ success: boolean; error?: string }>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession()
      .then(({ data: { session }, error }) => {
        if (error || !session) {
          if (error) {
            const msg = error.message.toLowerCase();
            if (
              msg.includes("refresh_token") || 
              msg.includes("invalid") || 
              msg.includes("not found") || 
              msg.includes("expired")
            ) {
              supabase.auth.signOut().finally(() => {
                setUser(null);
                setIsLoading(false);
              });
              return;
            }
          }
          setIsLoading(false);
          return;
        }
        
        if (session?.user) {
          fetchProfile(session.user);
        } else {
          setIsLoading(false);
        }
      })
      .catch((err) => {
        console.warn("Wiping broken Supabase session:", err.message || err);
        supabase.auth.signOut().finally(() => {
          setUser(null);
          setIsLoading(false);
        });
      });

    // Listen to auth changes
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session?.user) {
          fetchProfile(session.user);
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
          setIsLoading(false);
        } else {
          // Handle cases like TOKEN_REFRESHED error
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
          worker_status: data.worker_status || "available",
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

      // Save to profiles including the email field
      const { error: profileError } = await supabase.from("profiles").upsert({
        id: data.user.id,
        email, // Save email to profiles for easy lookup
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

  async function sendResetOtp(email: string): Promise<{ success: boolean; error?: string }> {
    try {
      // First try password reset/recovery OTP with deep link redirect
      const { error } = await supabase.auth.resetPasswordForEmail(email.toLowerCase().trim(), {
        redirectTo: "zentro://forgot-password",
      });
      if (error) {
        if (error.message.toLowerCase().includes("rate limit") || error.message.toLowerCase().includes("too many requests")) {
          return { success: false, error: error.message };
        }
        // Fallback to passwordless signInWithOtp
        const { error: otpError } = await supabase.auth.signInWithOtp({
          email: email.toLowerCase().trim(),
        });
        if (otpError) return { success: false, error: otpError.message };
      }
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }

  async function verifyResetOtp(email: string, otp: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Try verifyOtp with type: "recovery" first
      const { data, error } = await supabase.auth.verifyOtp({
        email: email.toLowerCase().trim(),
        token: otp.trim(),
        type: "recovery",
      });

      if (error) {
        // Fallback to type: "email"
        const { data: emailData, error: emailError } = await supabase.auth.verifyOtp({
          email: email.toLowerCase().trim(),
          token: otp.trim(),
          type: "email",
        });

        if (emailError) {
          // Fallback to type: "magiclink"
          const { data: mlData, error: mlError } = await supabase.auth.verifyOtp({
            email: email.toLowerCase().trim(),
            token: otp.trim(),
            type: "magiclink",
          });
          if (mlError) return { success: false, error: mlError.message };
          return { success: true };
        }
        return { success: true };
      }
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }

  async function updatePassword(password: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase.auth.updateUser({
        password,
      });

      if (error) return { success: false, error: error.message };
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }
  async function updateProfile(name: string, phone: string): Promise<{ success: boolean; error?: string }> {
    try {
      if (!user) return { success: false, error: "No active session" };

      const { error } = await supabase
        .from("profiles")
        .update({ name, phone })
        .eq("id", user.id);

      if (error) return { success: false, error: error.message };

      setUser({
        ...user,
        name,
        phone,
      });

      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }

  async function updateWorkerStatus(status: WorkerStatus): Promise<{ success: boolean; error?: string }> {
    try {
      if (!user) return { success: false, error: "No active session" };

      setUser({
        ...user,
        worker_status: status,
      });

      await AsyncStorage.setItem(`worker_status_${user.id}`, status);

      try {
        const { error } = await supabase
          .from("profiles")
          .update({ worker_status: status })
          .eq("id", user.id);

        if (error) throw error;
      } catch (err) {
        console.warn("Table profile worker_status update failed, using local storage instead.", err);
      }

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
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        login,
        register,
        logout,
        sendResetOtp,
        verifyResetOtp,
        updatePassword,
        updateProfile,
        updateWorkerStatus,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
