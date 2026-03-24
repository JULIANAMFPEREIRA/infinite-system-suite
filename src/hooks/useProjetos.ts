import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "./useEmpresa";
import type { TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

export const useProjetos = () => {
  const empresaId = useEmpresa();

  return useQuery({
    queryKey: ["projetos", empresaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projetos")
        .select("*, clientes(nome), fornecedores(nome)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!empresaId,
  });
};

export const useProjetoItens = (projetoId: string | null) => {
  return useQuery({
    queryKey: ["projeto_itens", projetoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projeto_itens")
        .select("*")
        .eq("projeto_id", projetoId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!projetoId,
  });
};

export const useCreateProjeto = () => {
  const qc = useQueryClient();
  const empresaId = useEmpresa();

  return useMutation({
    mutationFn: async (projeto: Omit<TablesInsert<"projetos">, "empresa_id">) => {
      const { data, error } = await supabase
        .from("projetos")
        .insert({ ...projeto, empresa_id: empresaId! })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["projetos"] }),
  });
};

export const useUpdateProjeto = () => {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: TablesUpdate<"projetos"> & { id: string }) => {
      const { error } = await supabase.from("projetos").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["projetos"] }),
  });
};

export const useCreateProjetoItem = () => {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (item: TablesInsert<"projeto_itens">) => {
      const { data, error } = await supabase.from("projeto_itens").insert(item).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ["projeto_itens", vars.projeto_id] }),
  });
};

export const useDeleteProjetoItem = () => {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, projetoId }: { id: string; projetoId: string }) => {
      const { error } = await supabase.from("projeto_itens").delete().eq("id", id);
      if (error) throw error;
      return projetoId;
    },
    onSuccess: (projetoId) => qc.invalidateQueries({ queryKey: ["projeto_itens", projetoId] }),
  });
};

export const useClientes = () => {
  return useQuery({
    queryKey: ["clientes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clientes").select("id, nome").order("nome");
      if (error) throw error;
      return data;
    },
  });
};

export const useArquitetos = () => {
  return useQuery({
    queryKey: ["arquitetos"],
    queryFn: async () => {
      const { data, error } = await supabase.from("fornecedores").select("id, nome, rt_percentual").eq("tipo", "arquiteto").order("nome");
      if (error) throw error;
      return data;
    },
  });
};
