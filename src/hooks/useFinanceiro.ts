import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "./useEmpresa";
import { logAtividade } from "./useAuditLog";
import { sanitizePayload } from "@/lib/sanitize";
import type { TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

export const useFinanceiroPagar = () => {
  return useQuery({
    queryKey: ["financeiro_pagar"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financeiro_pagar")
        .select(`
          *,
          fornecedores(nome),
          projetos(nome),
          categorias(nome),
          tipo_manual,
          origem
        `)
        .eq("deletado", false)
        .order("data_vencimento", { ascending: true });

      if (error) throw error;
      return data ?? [];
    },
  });
};

export const useFinanceiroReceber = () => {
  return useQuery({
    queryKey: ["financeiro_receber"],
    queryFn: async () => {
      const [receberRes, cliRes, projRes] = await Promise.all([
        supabase
          .from("financeiro_receber")
          .select("*")
          .eq("deletado", false)
          .order("data_vencimento", { ascending: true }),
        supabase.from("clientes").select("id, nome"),
        supabase.from("projetos").select("id, nome"),
      ]);

      if (receberRes.error) throw receberRes.error;

      const cliMap = Object.fromEntries((cliRes.data ?? []).map((c: any) => [c.id, c]));
      const projMap = Object.fromEntries((projRes.data ?? []).map((p: any) => [p.id, p]));

      return (receberRes.data ?? []).map((r: any) => ({
        ...r,
        clientes: cliMap[r.cliente_id] || null,
        projetos: projMap[r.projeto_id] || null,
      }));
    },
  });
};

export const useCreateContaPagar = () => {
  const qc = useQueryClient();
  const empresaId = useEmpresa();
  return useMutation({
    mutationFn: async (conta: Omit<TablesInsert<"financeiro_pagar">, "empresa_id">) => {
      const { data, error } = await supabase.from("financeiro_pagar").insert(sanitizePayload({ ...conta, empresa_id: empresaId! })).select().single();
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
      const { data, error } = await supabase.from("financeiro_receber").insert(sanitizePayload({ ...conta, empresa_id: empresaId! })).select().single();
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
      const { error } = await supabase.from("financeiro_pagar").update(sanitizePayload(updates as any)).eq("id", id);
      
      // Invalidar e refazer a query
      await qc.invalidateQueries({
        queryKey: ["financeiro_pagar"]
      });

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
      const { error } = await supabase.from("financeiro_receber").update(sanitizePayload(updates as any)).eq("id", id);
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
      const [comRes, fornRes, projRes, cliRes] = await Promise.all([
        supabase
          .from("comissoes")
          .select("*")
          .eq("deletado", false)
          .order("created_at", { ascending: false }),
        supabase.from("fornecedores").select("id, nome"),
        supabase.from("projetos").select("id, nome, cliente_id, orcamento_id"),
        supabase.from("clientes").select("id, nome"),
      ]);

      if (comRes.error) throw comRes.error;

      const fornMap = Object.fromEntries((fornRes.data ?? []).map((f: any) => [f.id, f]));
      const cliMap = Object.fromEntries((cliRes.data ?? []).map((c: any) => [c.id, c]));
      const projMap = Object.fromEntries((projRes.data ?? []).map((p: any) => [p.id, {
        ...p,
        clientes: cliMap[p.cliente_id] || null
      }]));

      return (comRes.data ?? []).map((c: any) => ({
        ...c,
        fornecedores: fornMap[c.fornecedor_id] || null,
        projetos: projMap[c.projeto_id] || null,
      }));
    },
  });
};
