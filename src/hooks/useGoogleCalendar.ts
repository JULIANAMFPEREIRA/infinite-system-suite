import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useGoogleCalendarStatus = () => {
  return useQuery({
    queryKey: ["google-calendar-status"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("google-auth", {
        body: null,
        method: "GET",
      });
      // Use invoke with query params workaround
      const { data: res, error: err } = await supabase.functions.invoke("google-auth?action=status");
      if (err) return { connected: false };
      return res as { connected: boolean };
    },
    refetchInterval: 60000,
  });
};

export const useGoogleAuthUrl = () => {
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("google-auth?action=auth-url");
      if (error) throw error;
      return data as { url: string };
    },
  });
};

export const useGoogleCallback = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (code: string) => {
      const { data, error } = await supabase.functions.invoke("google-auth?action=callback", {
        body: { code },
      });
      if (error) throw error;
      return data;
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
      const { data, error } = await supabase.functions.invoke("google-auth?action=disconnect");
      if (error) throw error;
      return data;
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
      const { data, error } = await supabase.functions.invoke("google-auth?action=events");
      if (error) return [];
      return (data?.events ?? []) as Array<{
        id: string;
        summary: string;
        start: string;
        end: string;
        description: string;
      }>;
    },
    enabled,
    refetchInterval: 120000,
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
