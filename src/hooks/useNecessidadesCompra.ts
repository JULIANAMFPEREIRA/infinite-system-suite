import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "./useEmpresa";

export const useNecessidadesCompra = (projetoId?: string) => {
  const empresaId = useEmpresa();
  return useQuery({
    queryKey: ["necessidades_compra", empresaId, projetoId],
    enabled: !!empresaId,
    queryFn: async () => {
      const [necRes, projRes, prodRes, itemRes, cliRes] = await Promise.all([
        supabase
          .from("necessidades_compra" as any)
          .select("*")
          .eq("empresa_id", empresaId!)
          .order("created_at", { ascending: false }),
        supabase.from("projetos").select("id, nome, deletado, cliente_id").eq("deletado", false),
        supabase.from("produtos").select("id, nome"),
        supabase.from("projeto_itens").select("id, preco_custo"),
        supabase.from("clientes").select("id, nome, deletado").eq("deletado", false),
      ]);

      if (necRes.error) throw necRes.error;

      const projetosMap = Object.fromEntries((projRes.data ?? []).map((p: any) => [p.id, p]));
      const produtosMap = Object.fromEntries((prodRes.data ?? []).map((p: any) => [p.id, p]));
      const itensMap = Object.fromEntries((itemRes.data ?? []).map((i: any) => [i.id, i]));
      const clientesMap = Object.fromEntries((cliRes.data ?? []).map((c: any) => [c.id, c]));

      let data = (necRes.data ?? [])
        .map((n: any) => {
          const projeto = projetosMap[n.projeto_id];
          if (!projeto) return null;
          const cliente = clientesMap[projeto.cliente_id];
          if (!cliente) return null;

          return {
            ...n,
            projetos: { ...projeto, clientes: cliente },
            produtos: produtosMap[n.produto_id] || null,
            projeto_itens: itensMap[n.projeto_item_id] || null,
          };
        })
        .filter(Boolean);

      if (projetoId) {
        data = data.filter((n: any) => n.projeto_id === projetoId);
      }

      return data as any[];
    },
  });
};

export const useNecessidadesPendentesCount = () => {
  const empresaId = useEmpresa();
  return useQuery({
    queryKey: ["necessidades_compra_counts", empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("necessidades_compra" as any)
        .select("projeto_id")
        .eq("empresa_id", empresaId!)
        .eq("status", "pendente");
      if (error) throw error;
      const counts: Record<string, number> = {};
      (data as any[])?.forEach((r: any) => {
        counts[r.projeto_id] = (counts[r.projeto_id] || 0) + 1;
      });
      return counts;
    },
  });
};

export const useCreateNecessidade = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (item: {
      empresa_id: string;
      projeto_id: string;
      projeto_item_id?: string;
      produto_id?: string;
      descricao: string;
      quantidade: number;
    }) => {
      const { data, error } = await supabase
        .from("necessidades_compra" as any)
        .insert(item)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["necessidades_compra"] });
      qc.invalidateQueries({ queryKey: ["necessidades_compra_counts"] });
    },
  });
};

export const useConverterEmCompra = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (nec: any) => {
      // 1. Create compra
      const { data: compra, error: errCompra } = await supabase
        .from("compras")
        .insert({
          empresa_id: nec.empresa_id,
          projeto_id: nec.projeto_id,
          projeto_item_id: nec.projeto_item_id || null,
          produto_id: nec.produto_id || null,
          descricao: nec.descricao,
          quantidade: nec.quantidade,
          status: "pendente",
        })
        .select()
        .single();
      if (errCompra) throw errCompra;

      // 2. Update necessidade status
      const { error: errUpdate } = await supabase
        .from("necessidades_compra" as any)
        .update({ status: "comprado", compra_id: compra.id } as any)
        .eq("id", nec.id);
      if (errUpdate) throw errUpdate;

      return compra;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["necessidades_compra"] });
      qc.invalidateQueries({ queryKey: ["necessidades_compra_counts"] });
      qc.invalidateQueries({ queryKey: ["compras"] });
    },
  });
};

export const useCheckEstoque = () => {
  return async (produtoId: string | undefined, qtdNecessaria: number): Promise<boolean> => {
    if (!produtoId) return false; // no product linked, can't check
    const { count, error } = await supabase
      .from("estoque_itens")
      .select("*", { count: "exact", head: true })
      .eq("produto_id", produtoId)
      .eq("status", "disponivel");
    if (error) return false;
    return (count ?? 0) >= qtdNecessaria;
  };
};
