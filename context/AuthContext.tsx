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
  sendResetOtp: (email: string) => Promise<{ success: boolean; error?: string }>;
  verifyResetOtp: (email: string, otp: string) => Promise<{ success: boolean; error?: string }>;
  updatePassword: (password: string) => Promise<{ success: boolean; error?: string }>;
  updateProfile: (name: string, phone: string) => Promise<{ success: boolean; error?: string }>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check active session
    supabase.auth.getSession()
      .then(({ data: { session }, error }) => {
        if (error) {
          const msg = error.message.toLowerCase();
          console.warn("Auth Session Warning:", error.message);
          
          // If the token is invalid or missing, clear everything and show login
          if (msg.includes("refresh_token_not_found") || msg.includes("invalid refresh token") || msg.includes("not found")) {
            supabase.auth.signOut().finally(() => {
              setUser(null);
              setIsLoading(false);
            });
          } else {
            setIsLoading(false);
          }
          return;
        }
        
        if (session?.user) {
          fetchProfile(session.user);
        } else {
          setIsLoading(false);
        }
      })
      .catch((err) => {
        console.error("Critical Auth Error:", err);
        setIsLoading(false);
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
      // Trigger OTP directly to Gmail
      const { error } = await supabase.auth.signInWithOtp({
        email: email.toLowerCase().trim(),
      });

      if (error) return { success: false, error: error.message };
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }

  async function verifyResetOtp(email: string, otp: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email: email.toLowerCase().trim(),
        token: otp,
        type: "email",
      });

      if (error) return { success: false, error: error.message };
      if (!data.session) return { success: false, error: "Verification failed" };

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

      // Update local state
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
