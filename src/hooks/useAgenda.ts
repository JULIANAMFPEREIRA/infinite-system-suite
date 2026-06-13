import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "./useEmpresa";
import { useAuth } from "@/contexts/AuthContext";

export interface Visita {
  id: string;
  empresa_id: string;
  cliente_id: string | null;
  titulo: string;
  descricao: string | null;
  data_inicio: string;
  data_fim: string;
  status: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  visita_tecnicos?: { id: string; tecnico_id: string; fornecedores?: { nome: string } | null }[];
  clientes?: { nome: string } | null;
}

export const useVisitas = (range?: { from: string; to: string }) => {
  const empresaId = useEmpresa();
  return useQuery({
    queryKey: ["visitas", empresaId, range?.from, range?.to],
    queryFn: async () => {
      let q = supabase
        .from("agenda_visitas" as any)
        .select("*, clientes(nome), agenda_visita_tecnicos(id, tecnico_id, fornecedores(nome))")
        .order("data_inicio", { ascending: true });
      if (empresaId) q = q.eq("empresa_id", empresaId);
      if (range) {
        q = q.gte("data_inicio", range.from).lte("data_inicio", range.to);
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as Visita[];
    },
  });
};

export const useProximasVisitas = (limit = 5) => {
  const empresaId = useEmpresa();
  return useQuery({
    queryKey: ["visitas_proximas", empresaId, limit],
    queryFn: async () => {
      const nowIso = new Date().toISOString();
      let q = supabase
        .from("agenda_visitas" as any)
        .select("*, clientes(nome), agenda_visita_tecnicos(id, tecnico_id, fornecedores(nome))")
        .gte("data_inicio", nowIso)
        .neq("status", "cancelada")
        .order("data_inicio", { ascending: true })
        .limit(limit);
      if (empresaId) q = q.eq("empresa_id", empresaId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as Visita[];
    },
  });
};

interface SaveVisitaInput {
  id?: string;
  cliente_id: string | null;
  titulo: string;
  descricao: string | null;
  data_inicio: string;
  data_fim: string;
  status?: string;
  tecnico_ids: string[];
}

export const useSaveVisita = () => {
  const qc = useQueryClient();
  const empresaId = useEmpresa();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: SaveVisitaInput) => {
      const { id, tecnico_ids, ...fields } = input;
      let visitaId = id;

      if (id) {
        const { error } = await supabase
          .from("agenda_visitas" as any)
          .update(fields as any)
          .eq("id", id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("agenda_visitas" as any)
          .insert({
            ...fields,
            empresa_id: empresaId ?? "a0000000-0000-0000-0000-000000000001",
            created_by: user?.id ?? null,
          } as any)
          .select("id")
          .single();
        if (error) throw error;
        visitaId = (data as any).id;
      }

      // Replace técnicos
      await supabase.from("agenda_visita_tecnicos" as any).delete().eq("visita_id", visitaId!);
      if (tecnico_ids.length > 0) {
        const rows = tecnico_ids.map((t) => ({ visita_id: visitaId!, tecnico_id: t }));
        const { error: insErr } = await supabase.from("agenda_visita_tecnicos" as any).insert(rows as any);
        if (insErr) throw insErr;
      }

      return visitaId!;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["visitas"] });
      qc.invalidateQueries({ queryKey: ["visitas_proximas"] });
    },
  });
};

export const useDeleteVisita = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("agenda_visitas" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["visitas"] });
      qc.invalidateQueries({ queryKey: ["visitas_proximas"] });
    },
  });
};

export const useClientesLista = () => {
  const empresaId = useEmpresa();
  return useQuery({
    queryKey: ["clientes_lista_agenda", empresaId],
    queryFn: async () => {
      let q = supabase.from("clientes").select("id, nome").order("nome");
      if (empresaId) q = q.eq("empresa_id", empresaId);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });
};

export const useTecnicosLista = () => {
  const empresaId = useEmpresa();
  return useQuery({
    queryKey: ["tecnicos_lista_agenda", empresaId],
    queryFn: async () => {
      let q = supabase
        .from("fornecedores")
        .select("id, nome, tipo, subtipo_parceiro")
        .eq("deletado", false)
        .eq("ativo", true)
        .order("nome");
      if (empresaId) q = q.eq("empresa_id", empresaId);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });
};