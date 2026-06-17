import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const EMPRESA_ID = "a0000000-0000-0000-0000-000000000001";

/**
 * Tipos / Subcategorias são armazenados na própria tabela `categorias`
 * usando `tipo = 'subcategoria'` como identificador. A tabela `subcategorias`
 * foi descontinuada (permanece vazia no banco).
 *
 * O parâmetro `categoriaId` é mantido por compatibilidade de assinatura,
 * mas não há vínculo de parent — sempre retorna todas as subcategorias.
 */
export const useSubcategorias = (_categoriaId?: string) => {
  return useQuery({
    queryKey: ["subcategorias-via-categorias"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categorias")
        .select("id, nome, tipo, empresa_id")
        .eq("empresa_id", EMPRESA_ID)
        .eq("tipo", "subcategoria")
        .order("nome");
      if (error) {
        console.error("useSubcategorias error:", error);
        throw error;
      }
      return (data ?? []).map((c: any) => ({
        id: c.id as string,
        nome: c.nome as string,
        categoria_id: null as string | null,
        empresa_id: c.empresa_id as string,
      }));
    },
    enabled: true,
  });
};