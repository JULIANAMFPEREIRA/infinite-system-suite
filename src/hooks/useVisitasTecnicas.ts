import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "./useEmpresa";

export const useVisitasTecnicas = (projetoId: string | null) => {
  return useQuery({
    queryKey: ["visitas_tecnicas", projetoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("visitas_tecnicas")
        .select("*, fornecedores(nome)")
        .eq("projeto_id", projetoId!)
        .eq("deletado", false)
        .order("data", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!projetoId,
  });
};

// Helper to sync with Google Calendar (fire-and-forget, no errors block main flow)
const syncToGoogleCalendar = async (action: "create" | "update" | "delete", visita: any) => {
  try {
    await supabase.functions.invoke("google-calendar-sync", {
      body: { action, visita },
    });
  } catch {
    // Silently fail - Google Calendar sync is non-blocking
  }
};

export const useCreateVisita = () => {
  const qc = useQueryClient();
  const empresaId = useEmpresa();

  return useMutation({
    mutationFn: async (visita: {
      projeto_id: string;
      tecnico_id?: string | null;
      data?: string | null;
      descricao?: string | null;
      produtos_levados?: any[];
      servicos_executados?: string | null;
      valor_pago_tecnico?: number;
      status_pagamento?: string;
      hora?: string | null;
    }) => {
      const { data, error } = await supabase
        .from("visitas_tecnicas")
        .insert({ ...visita, empresa_id: empresaId! })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data, vars) => {
      qc.invalidateQueries({ queryKey: ["visitas_tecnicas", vars.projeto_id] });
      // Auto-sync to Google Calendar
      syncToGoogleCalendar("create", data);
    },
  });
};

export const useUpdateVisita = () => {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, projeto_id, ...updates }: { id: string; projeto_id: string } & Record<string, any>) => {
      const { error } = await supabase.from("visitas_tecnicas").update(updates as any).eq("id", id);
      if (error) throw error;

      // Fetch the updated visita for sync
      const { data: updated } = await supabase
        .from("visitas_tecnicas")
        .select("*")
        .eq("id", id)
        .single();

      return { projeto_id, visita: updated };
    },
    onSuccess: ({ projeto_id, visita }) => {
      qc.invalidateQueries({ queryKey: ["visitas_tecnicas", projeto_id] });
      if (visita) {
        if (visita.deletado) {
          syncToGoogleCalendar("delete", visita);
        } else {
          syncToGoogleCalendar("update", visita);
        }
      }
    },
  });
};
