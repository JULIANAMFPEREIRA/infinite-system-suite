import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "./useEmpresa";
import type { TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

export const useFinanceiroPagar = () => {
  return useQuery({
    queryKey: ["financeiro_pagar"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financeiro_pagar")
        .select("*, fornecedores(nome), projetos(nome)")
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
      const { error } = await supabase.from("financeiro_pagar").insert({ ...conta, empresa_id: empresaId! });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["financeiro_pagar"] }),
  });
};

export const useCreateContaReceber = () => {
  const qc = useQueryClient();
  const empresaId = useEmpresa();
  return useMutation({
    mutationFn: async (conta: Omit<TablesInsert<"financeiro_receber">, "empresa_id">) => {
      const { error } = await supabase.from("financeiro_receber").insert({ ...conta, empresa_id: empresaId! });
      if (error) throw error;
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
        .select("*, fornecedores(nome), projetos(nome)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
};
