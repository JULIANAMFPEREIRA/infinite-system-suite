import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "./useEmpresa";
import { logAtividade } from "./useAuditLog";
import type { TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

export const useProjetos = () => {
  const empresaId = useEmpresa();

  return useQuery({
    queryKey: ["projetos", empresaId],
    queryFn: async () => {
      const [projRes, cliRes, fornRes] = await Promise.all([
        supabase
          .from("projetos")
          .select("*")
          .eq("deletado", false)
          .order("created_at", { ascending: false }),
        supabase.from("clientes").select("id, nome"),
        supabase.from("fornecedores").select("id, nome"),
      ]);

      if (projRes.error) throw projRes.error;

      const cliMap = Object.fromEntries((cliRes.data ?? []).map((c: any) => [c.id, c]));
      const fornMap = Object.fromEntries((fornRes.data ?? []).map((f: any) => [f.id, f]));

      return (projRes.data ?? []).map((p: any) => ({
        ...p,
        clientes: cliMap[p.cliente_id] || null,
        fornecedores: fornMap[p.fornecedor_id] || null,
      }));
    },
    enabled: !!empresaId,
  });
};

export const useProjetoItens = (projetoId: string | null) => {
  return useQuery({
    queryKey: ["projeto_itens", projetoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projeto_itens")
        .select("*")
        .eq("projeto_id", projetoId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!projetoId,
  });
};

export const useCreateProjeto = () => {
  const qc = useQueryClient();
  const empresaId = useEmpresa();

  return useMutation({
    mutationFn: async (projeto: Omit<TablesInsert<"projetos">, "empresa_id">) => {
      const { data, error } = await supabase
        .from("projetos")
        .insert({ ...projeto, empresa_id: empresaId! })
        .select()
        .single();
      if (error) throw error;
      await logAtividade("projetos", "criacao", data.id, empresaId, null, data);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["projetos"] }),
  });
};

export const useUpdateProjeto = () => {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: TablesUpdate<"projetos"> & { id: string }) => {
      const { error } = await supabase.from("projetos").update(updates).eq("id", id);
      if (error) throw error;
      await logAtividade("projetos", "edicao", id, null, null, updates as any);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["projetos"] }),
  });
};

export const useCreateProjetoItem = () => {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (item: TablesInsert<"projeto_itens">) => {
      const { data, error } = await supabase
        .from("projeto_itens")
        .upsert(item, { onConflict: "projeto_id,descricao,tipo", ignoreDuplicates: false })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ["projeto_itens", vars.projeto_id] }),
  });
};

export const useDeleteProjetoItem = () => {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, projetoId }: { id: string; projetoId: string }) => {
      const { error } = await supabase.from("projeto_itens").delete().eq("id", id);
      if (error) throw error;
      return projetoId;
    },
    onSuccess: (projetoId) => qc.invalidateQueries({ queryKey: ["projeto_itens", projetoId] }),
  });
};

export const useClientes = () => {
  return useQuery({
    queryKey: ["clientes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clientes").select("id, nome").eq("deletado", false).order("nome");
      if (error) throw error;
      return data;
    },
  });
};

export const useArquitetos = () => {
  return useQuery({
    queryKey: ["arquitetos"],
    queryFn: async () => {
      // 1) Architects from fornecedores (canonical source used by FK arquiteto_id)
      const { data: forn, error } = await supabase
        .from("fornecedores")
        .select("id, nome, rt_percentual, email")
        .eq("tipo", "arquiteto")
        .eq("deletado", false)
        .order("nome");
      if (error) throw error;

      // 2) Fallback: users with role 'arquiteto' that don't yet have a fornecedor record.
      // We auto-create a fornecedor for them so they appear in selects without breaking
      // the arquiteto_id foreign key. This guarantees newly registered architects show up.
      try {
        const { data: roleRows } = await supabase
          .from("user_roles")
          .select("user_id, empresa_id")
          .eq("role", "arquiteto");
        const userIds = (roleRows ?? []).map((r) => r.user_id);
        if (userIds.length > 0) {
          const { data: profs } = await supabase
            .from("profiles")
            .select("id, full_name, empresa_id")
            .in("id", userIds);
          const existingNames = new Set((forn ?? []).map((f: any) => (f.nome ?? "").toUpperCase()));
          const missing = (profs ?? []).filter(
            (p: any) => p.full_name && !existingNames.has((p.full_name ?? "").toUpperCase())
          );
          if (missing.length > 0) {
            const inserts = missing.map((p: any) => ({
              empresa_id: p.empresa_id,
              nome: (p.full_name ?? "").toUpperCase(),
              tipo: "arquiteto" as const,
            }));
            const { data: created } = await supabase
              .from("fornecedores")
              .insert(inserts)
              .select("id, nome, rt_percentual, email");
            if (created && created.length > 0) {
              return [...(forn ?? []), ...created].sort((a: any, b: any) =>
                (a.nome ?? "").localeCompare(b.nome ?? "")
              );
            }
          }
        }
      } catch (_) { /* fallback only; ignore errors */ }

      return forn ?? [];
    },
  });
};
