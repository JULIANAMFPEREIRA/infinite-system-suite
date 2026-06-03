import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const invokeGoogle = async (action: string, body?: any) => {
  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const session = (await supabase.auth.getSession()).data.session;
  const url = `https://${projectId}.supabase.co/functions/v1/google-auth?action=${action}`;
  
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  };
  if (session?.access_token) {
    headers["Authorization"] = `Bearer ${session.access_token}`;
  }

  const res = await fetch(url, {
    method: body ? "POST" : "GET",
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  
  if (!res.ok) {
    const errData = await res.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(errData.error || "Request failed");
  }
  return res.json();
};

export const useGoogleCalendarStatus = () => {
  return useQuery({
    queryKey: ["google-calendar-status"],
    queryFn: async () => {
      try {
        const data = await invokeGoogle("status");
        return data as { connected: boolean };
      } catch {
        return { connected: false };
      }
    },
    refetchInterval: 60000,
  });
};

export const useGoogleAuthUrl = () => {
  return useMutation({
    mutationFn: async () => {
      console.log("Chamando auth-url...");
      const data = await invokeGoogle("auth-url");
      console.log("Resposta auth-url:", data);
      return data as { url: string };
    },
  });
};

export const useGoogleCallback = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (code: string) => {
      return await invokeGoogle("callback", { code });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["google-calendar-status"] });
      qc.invalidateQueries({ queryKey: ["google-calendar-events"] });
    },
  });
};

export const useGoogleDisconnect = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      return await invokeGoogle("disconnect");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["google-calendar-status"] });
      qc.invalidateQueries({ queryKey: ["google-calendar-events"] });
    },
  });
};

export const useGoogleCalendarEvents = (enabled: boolean) => {
  return useQuery({
    queryKey: ["google-calendar-events"],
    queryFn: async () => {
      try {
        const data = await invokeGoogle("events");
        return (data?.events ?? []) as Array<{
          id: string;
          summary: string;
          start: string;
          end: string;
          description: string;
        }>;
      } catch {
        return [];
      }
    },
    enabled,
    refetchInterval: 120000,
  });
};

export const useCreateGoogleEvent = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (event: { summary: string; description?: string; startDateTime: string; endDateTime: string }) => {
      return await invokeGoogle("create-event", event);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["google-calendar-events"] });
    },
  });
};

export const useUpdateGoogleEvent = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (event: { eventId: string; summary: string; description?: string; startDateTime: string; endDateTime: string }) => {
      return await invokeGoogle("update-event", event);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["google-calendar-events"] });
    },
  });
};

export const useDeleteGoogleEvent = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (eventId: string) => {
      return await invokeGoogle("delete-event", { eventId });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["google-calendar-events"] });
    },
  });
};

export const useSyncVisitaToCalendar = () => {
  return useMutation({
    mutationFn: async ({ action, visita }: { action: "create" | "update" | "delete"; visita: any }) => {
      const { data, error } = await supabase.functions.invoke("google-calendar-sync", {
        body: { action, visita },
      });
      if (error) throw error;
      return data;
    },
  });
};
