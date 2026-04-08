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
        .order("data", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!projetoId,
  });
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
    }) => {
      const { data, error } = await supabase
        .from("visitas_tecnicas")
        .insert({ ...visita, empresa_id: empresaId! })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["visitas_tecnicas", vars.projeto_id] });
    },
  });
};

export const useUpdateVisita = () => {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, projeto_id, ...updates }: { id: string; projeto_id: string } & Record<string, any>) => {
      const { error } = await supabase.from("visitas_tecnicas").update(updates as any).eq("id", id);
      if (error) throw error;
      return projeto_id;
    },
    onSuccess: (projetoId) => {
      qc.invalidateQueries({ queryKey: ["visitas_tecnicas", projetoId] });
    },
  });
};
