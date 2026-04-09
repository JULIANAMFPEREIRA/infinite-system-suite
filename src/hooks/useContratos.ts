import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "./useEmpresa";
import { logAtividade } from "./useAuditLog";

export const useContratos = () => {
  const empresaId = useEmpresa();
  return useQuery({
    queryKey: ["contratos", empresaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contratos")
        .select("*, projetos(nome), clientes(nome)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!empresaId,
  });
};

export const useCreateContrato = () => {
  const qc = useQueryClient();
  const empresaId = useEmpresa();
  return useMutation({
    mutationFn: async (contrato: { projeto_id?: string | null; cliente_id?: string | null; status?: string; descricao?: string | null; valor?: number; data_envio?: string | null; data_assinatura?: string | null }) => {
      const { data, error } = await supabase.from("contratos").insert({ ...contrato, empresa_id: empresaId! } as any).select().single();
      if (error) throw error;
      await logAtividade("contratos", "criacao", data.id, empresaId, null, { ...contrato, projeto_id: contrato.projeto_id });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["contratos"] }),
  });
};

export const useUpdateContrato = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & Record<string, any>) => {
      const { error } = await supabase.from("contratos").update(updates as any).eq("id", id);
      if (error) throw error;
      await logAtividade("contratos", "edicao", id, null, null, updates);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["contratos"] }),
  });
};

export const useDeleteContrato = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("contratos").delete().eq("id", id);
      if (error) throw error;
      await logAtividade("contratos", "exclusao", id, null);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["contratos"] }),
  });
};
