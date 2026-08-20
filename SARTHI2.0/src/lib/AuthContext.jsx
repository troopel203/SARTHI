import { createContext, useContext, useEffect, useState } from "react";
import { findUser, setCurrentUser, backendMode } from "./db";
import { supabase } from "./supabaseClient";

const AuthContext = createContext(null);
const KEY = "sarthi_user_id";

export function AuthProvider({ children }) {
  if (backendMode === "production") return <SupabaseAuthProvider>{children}</SupabaseAuthProvider>;
  return <DemoAuthProvider>{children}</DemoAuthProvider>;
}

// --- Demo mode: pick-an-account, no password -------------------------------
function DemoAuthProvider({ children }) {
  const [userId, setUserId] = useState(() => localStorage.getItem(KEY));

  useEffect(() => {
    if (userId) localStorage.setItem(KEY, userId);
    else localStorage.removeItem(KEY);
  }, [userId]);

  const user = userId ? findUser(userId) : null;

  const login = (id) => setUserId(id);
  const logout = () => setUserId(null);

  return <AuthContext.Provider value={{ user, login, logout, mode: "demo", authError: null }}>{children}</AuthContext.Provider>;
}

// --- Production mode: real Supabase email/password auth --------------------
function SupabaseAuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  async function loadProfile(session) {
    if (!session?.user) {
      setUser(null);
      await setCurrentUser(null);
      setLoading(false);
      return;
    }
    const { data: profile, error } = await supabase.from("profiles").select("*").eq("id", session.user.id).single();
    if (error || !profile) {
      setUser(null);
      setLoading(false);
      return;
    }
    const mapped = { id: profile.id, role: profile.role, name: profile.name, entityId: profile.entity_id, entityLabel: profile.entity_label };
    setUser(mapped);
    await setCurrentUser(mapped);
    setLoading(false);
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => loadProfile(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => loadProfile(session));
    return () => sub.subscription.unsubscribe();
  }, []);

  // Sign up: creates the auth user AND their role/entity profile row in one go.
  async function signUp({ email, password, role, name, entityId, entityLabel }) {
    setAuthError(null);
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) {
      setAuthError(error.message);
      return false;
    }
    if (data.user) {
      const { error: profileError } = await supabase
        .from("profiles")
        .insert({ id: data.user.id, role, name, entity_id: entityId, entity_label: entityLabel });
      if (profileError) {
        setAuthError(profileError.message);
        return false;
      }
    }
    return true;
  }

  async function login(email, password) {
    setAuthError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setAuthError(error.message);
      return false;
    }
    return true;
  }

  async function logout() {
    await supabase.auth.signOut();
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, signUp, loading, mode: "production", authError }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
