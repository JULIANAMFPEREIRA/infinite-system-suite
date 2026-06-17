import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "./useEmpresa";

export const useCategorias = () => {
  const empresaId = useEmpresa();
  return useQuery({
    queryKey: ["categorias", empresaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categorias")
        .select("id, nome, tipo, empresa_id")
        .eq("empresa_id", "a0000000-0000-0000-0000-000000000001")
        .order("nome");
      if (error) {
        console.error("useCategorias error:", error);
        throw error;
      }
      console.log("useCategorias data:", data);
      return data;
    },
    enabled: true,
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

export const useUpdateCategoria = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (cat: { id: string; nome: string; tipo: string }) => {
      const { error } = await supabase.from("categorias").update({ nome: cat.nome, tipo: cat.tipo } as any).eq("id", cat.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["categorias"] }),
  });
};

export const useDeleteCategoria = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("categorias").delete().eq("id", id);
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
      const { data, error } = await supabase
        .from("formas_pagamento")
        .select("*")
        .eq("empresa_id", "a0000000-0000-0000-0000-000000000001")
        .order("nome");
      if (error) {
        console.error("useFormasPagamento error:", error);
        throw error;
      }
      return data;
    },
    enabled: true,
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

export const useUpdateFormaPagamento = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (fp: { id: string; nome: string }) => {
      const { error } = await supabase.from("formas_pagamento").update({ nome: fp.nome } as any).eq("id", fp.id);
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
