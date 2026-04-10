import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "./useEmpresa";

export const useCategorias = () => {
  const empresaId = useEmpresa();
  return useQuery({
    queryKey: ["categorias", empresaId],
    queryFn: async () => {
      const { data, error } = await supabase.from("categorias").select("*").eq("deletado", false).order("nome");
      if (error) throw error;
      return data;
    },
    enabled: !!empresaId,
  });
};

export const useCreateCategoria = () => {
  const qc = useQueryClient();
  const empresaId = useEmpresa();
  return useMutation({
    mutationFn: async (cat: { nome: string; tipo?: string }) => {
      const { error } = await supabase.from("categorias").insert({ ...cat, empresa_id: empresaId! });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["categorias"] }),
  });
};

export const useDeleteCategoria = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("categorias").update({ deletado: true } as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["categorias"] }),
  });
};

export const useFormasPagamento = () => {
  const empresaId = useEmpresa();
  return useQuery({
    queryKey: ["formas_pagamento", empresaId],
    queryFn: async () => {
      const { data, error } = await supabase.from("formas_pagamento").select("*").eq("ativo", true).order("nome");
      if (error) throw error;
      return data;
    },
    enabled: !!empresaId,
  });
};

export const useCreateFormaPagamento = () => {
  const qc = useQueryClient();
  const empresaId = useEmpresa();
  return useMutation({
    mutationFn: async (fp: { nome: string }) => {
      const { error } = await supabase.from("formas_pagamento").insert({ ...fp, empresa_id: empresaId! });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["formas_pagamento"] }),
  });
};

export const useDeleteFormaPagamento = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("formas_pagamento").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["formas_pagamento"] }),
  });
};
