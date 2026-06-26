import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: { id: string; full_name: string | null; empresa_id: string | null } | null;
  roles: AppRole[];
  empresaId: string | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<AuthContextType["profile"]>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [rolesLoaded, setRolesLoaded] = useState(false);

  const fetchProfileAndRoles = async (userId: string) => {
    const { data: prof } = await supabase
      .from("profiles")
      .select("id, full_name, empresa_id")
      .eq("id", userId)
      .single();
    setProfile(prof);

    const { data: userRoles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    setRoles(userRoles?.map((r) => r.role) ?? []);

    return prof;
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          setRolesLoaded(false);
          setLoading(true);
          setTimeout(() => {
            fetchProfileAndRoles(session.user.id).finally(() => {
              setRolesLoaded(true);
              setLoading(false);
            });
          }, 0);
        } else {
          setProfile(null);
          setRoles([]);
          setRolesLoaded(true);
          setLoading(false);
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfileAndRoles(session.user.id).finally(() => {
          setRolesLoaded(true);
          setLoading(false);
        });
      } else {
        setRolesLoaded(true);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName }, emailRedirectTo: window.location.origin },
    });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    setRoles([]);
  };

  return (
    <AuthContext.Provider value={{ user, session, profile, roles, empresaId: profile?.empresa_id ?? null, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};
