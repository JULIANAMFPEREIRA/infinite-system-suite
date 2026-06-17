import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const EMPRESA_ID = "a0000000-0000-0000-0000-000000000001";

export const useSubcategorias = (categoriaId?: string) => {
  return useQuery({
    queryKey: ["subcategorias", categoriaId ?? "all"],
    queryFn: async () => {
      let q = (supabase as any)
        .from("subcategorias")
        .select("id, nome, categoria_id, empresa_id")
        .eq("empresa_id", EMPRESA_ID)
        .order("nome");
      if (categoriaId) q = q.eq("categoria_id", categoriaId);
      const { data, error } = await q;
      if (error) {
        console.error("useSubcategorias error:", error);
        throw error;
      }
      return (data ?? []) as Array<{ id: string; nome: string; categoria_id: string | null; empresa_id: string }>;
    },
    enabled: true,
  });
};

export const useCreateSubcategoria = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (sub: { nome: string; categoria_id?: string | null }) => {
      const { error } = await (supabase as any)
        .from("subcategorias")
        .insert({
          nome: sub.nome,
          categoria_id: sub.categoria_id ?? null,
          empresa_id: EMPRESA_ID,
        });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["subcategorias"] }),
  });
};

export const useDeleteSubcategoria = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("subcategorias").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["subcategorias"] }),
  });
};