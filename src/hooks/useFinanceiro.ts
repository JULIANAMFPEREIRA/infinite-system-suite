import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "./useEmpresa";
import { logAtividade } from "./useAuditLog";
import type { TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

export const useFinanceiroPagar = () => {
  return useQuery({
    queryKey: ["financeiro_pagar"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financeiro_pagar")
        .select("*, fornecedores(nome), projetos(nome)")
        .eq("deletado", false)
        .order("data_vencimento", { ascending: true });
      if (error) throw error;
      return data;
    },
  });
};

export const useFinanceiroReceber = () => {
  return useQuery({
    queryKey: ["financeiro_receber"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financeiro_receber")
        .select("*, clientes(nome), projetos(nome)")
        .eq("deletado", false)
        .order("data_vencimento", { ascending: true });
      if (error) throw error;
      return data;
    },
  });
};

export const useCreateContaPagar = () => {
  const qc = useQueryClient();
  const empresaId = useEmpresa();
  return useMutation({
    mutationFn: async (conta: Omit<TablesInsert<"financeiro_pagar">, "empresa_id">) => {
      const { data, error } = await supabase.from("financeiro_pagar").insert({ ...conta, empresa_id: empresaId! }).select().single();
      if (error) throw error;
      await logAtividade("financeiro_pagar", "criacao", data.id, empresaId, null, { ...conta, projeto_id: conta.projeto_id });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["financeiro_pagar"] }),
  });
};

export const useCreateContaReceber = () => {
  const qc = useQueryClient();
  const empresaId = useEmpresa();
  return useMutation({
    mutationFn: async (conta: Omit<TablesInsert<"financeiro_receber">, "empresa_id">) => {
      const { data, error } = await supabase.from("financeiro_receber").insert({ ...conta, empresa_id: empresaId! }).select().single();
      if (error) throw error;
      await logAtividade("financeiro_receber", "criacao", data.id, empresaId, null, { ...conta, projeto_id: conta.projeto_id });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["financeiro_receber"] }),
  });
};

export const useUpdateContaPagar = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: TablesUpdate<"financeiro_pagar"> & { id: string }) => {
      const { error } = await supabase.from("financeiro_pagar").update(updates).eq("id", id);
      if (error) throw error;
      await logAtividade("financeiro_pagar", "edicao", id, null, null, updates as any);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["financeiro_pagar"] }),
  });
};

export const useUpdateContaReceber = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: TablesUpdate<"financeiro_receber"> & { id: string }) => {
      const { error } = await supabase.from("financeiro_receber").update(updates).eq("id", id);
      if (error) throw error;
      await logAtividade("financeiro_receber", "edicao", id, null, null, updates as any);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["financeiro_receber"] }),
  });
};

export const useDeleteContaPagar = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("financeiro_pagar").update({ deletado: true } as any).eq("id", id);
      if (error) throw error;
      await logAtividade("financeiro_pagar", "exclusao", id, null);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["financeiro_pagar"] }),
  });
};

export const useDeleteContaReceber = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("financeiro_receber").update({ deletado: true } as any).eq("id", id);
      if (error) throw error;
      await logAtividade("financeiro_receber", "exclusao", id, null);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["financeiro_receber"] }),
  });
};

export const useComissoes = () => {
  return useQuery({
    queryKey: ["comissoes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("comissoes")
        .select("*, fornecedores(nome), projetos(nome, cliente_id, clientes(nome), orcamento_id)")
        .eq("deletado", false)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
};
