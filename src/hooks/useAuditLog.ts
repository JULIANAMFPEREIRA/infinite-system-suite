import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useEmpresa } from "./useEmpresa";
import { useQuery } from "@tanstack/react-query";
import type { Database } from "@/integrations/supabase/types";

type AcaoAudit = Database["public"]["Enums"]["acao_audit"];

export const useLogAtividade = () => {
  const { user } = useAuth();
  const empresaId = useEmpresa();

  const logAtividade = async (
    tabela: string,
    acao: AcaoAudit,
    registroId: string | null,
    dadosAnteriores?: Record<string, any> | null,
    dadosNovos?: Record<string, any> | null
  ) => {
    if (!empresaId) return;
    await supabase.from("audit_logs").insert({
      tabela,
      acao,
      registro_id: registroId,
      empresa_id: empresaId,
      usuario_id: user?.id ?? null,
      dados_anteriores: dadosAnteriores ?? null,
      dados_novos: dadosNovos ?? null,
    });
  };

  return logAtividade;
};

export const useAuditLogsProjeto = (projetoId: string | null) => {
  return useQuery({
    queryKey: ["audit_logs_projeto", projetoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_logs")
        .select("*")
        .or(`registro_id.eq.${projetoId},dados_novos->>projeto_id.eq.${projetoId}`)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
    enabled: !!projetoId,
  });
};

export const useAuditLogs = () => {
  const empresaId = useEmpresa();
  return useQuery({
    queryKey: ["audit_logs", empresaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data;
    },
    enabled: !!empresaId,
  });
};
