import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/hooks/useEmpresa";

export const useTransportadoras = () => {
  const empresaId = useEmpresa();
  return useQuery({
    queryKey: ["transportadoras", empresaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transportadoras")
        .select("*")
        .eq("empresa_id", empresaId!)
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return data;
    },
    enabled: !!empresaId,
  });
};

export const useCreateTransportadora = () => {
  const empresaId = useEmpresa();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { nome: string; tipo: string }) => {
      if (!empresaId) throw new Error("Empresa não encontrada");
      const { error } = await supabase
        .from("transportadoras")
        .insert({ empresa_id: empresaId, nome: payload.nome, tipo: payload.tipo } as any);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["transportadoras"] }),
  });
};

export const useDeleteTransportadora = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("transportadoras")
        .update({ ativo: false } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["transportadoras"] }),
  });
};
