import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/hooks/useEmpresa";
import { toast } from "sonner";

export interface Parceiro {
  id: string;
  nome: string;
  email: string | null;
  telefone: string | null;
  subtipo_parceiro: string | null;
  ativo: boolean;
  rt_percentual: number | null;
}

export const SUBTIPOS_PARCEIRO = [
  { value: "arquiteto", label: "Arquiteto" },
  { value: "tecnico", label: "Técnico" },
  { value: "marceneiro", label: "Marceneiro" },
  { value: "eletricista", label: "Eletricista" },
  { value: "designer", label: "Designer" },
  { value: "outro", label: "Outro" },
];

export const useParceiros = () => {
  const empresaId = useEmpresa();
  return useQuery({
    queryKey: ["parceiros", empresaId],
    queryFn: async (): Promise<Parceiro[]> => {
      const { data, error } = await supabase
        .from("fornecedores")
        .select("id, nome, email, telefone, subtipo_parceiro, ativo, rt_percentual")
        .eq("empresa_id", empresaId!)
        .eq("deletado", false)
        .not("subtipo_parceiro", "is", null)
        .order("nome");
      if (error) throw error;
      return (data ?? []) as Parceiro[];
    },
    enabled: !!empresaId,
  });
};

export const useUpdateParceiro = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<Parceiro> & { id: string }) => {
      const { error } = await supabase.from("fornecedores").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["parceiros"] });
      toast.success("Parceiro atualizado");
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao atualizar parceiro"),
  });
};

export const useProjetoParceiros = (projetoId?: string) => {
  return useQuery({
    queryKey: ["projeto_parceiros", projetoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projeto_parceiros")
        .select("id, parceiro_id, fornecedores(id, nome, email, subtipo_parceiro)")
        .eq("projeto_id", projetoId!);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!projetoId,
  });
};

export const useParceiroProjetos = (parceiroId?: string) => {
  return useQuery({
    queryKey: ["parceiro_projetos", parceiroId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projeto_parceiros")
        .select("id, projeto_id, rt_tipo, rt_base, rt_percentual, rt_valor, rt_total, rt_recebido, projetos(id, nome, status, cliente_id, venda_total, clientes(nome))")
        .eq("parceiro_id", parceiroId!);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!parceiroId,
  });
};

export const useVincularParceiro = () => {
  const empresaId = useEmpresa();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ projeto_id, parceiro_id }: { projeto_id: string; parceiro_id: string }) => {
      const { error } = await supabase
        .from("projeto_parceiros")
        .insert({ empresa_id: empresaId!, projeto_id, parceiro_id });
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["projeto_parceiros", vars.projeto_id] });
      qc.invalidateQueries({ queryKey: ["parceiro_projetos", vars.parceiro_id] });
      toast.success("Parceiro vinculado ao projeto");
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao vincular"),
  });
};

export const useDesvincularParceiro = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("projeto_parceiros").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projeto_parceiros"] });
      qc.invalidateQueries({ queryKey: ["parceiro_projetos"] });
      toast.success("Vínculo removido");
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao remover vínculo"),
  });
};