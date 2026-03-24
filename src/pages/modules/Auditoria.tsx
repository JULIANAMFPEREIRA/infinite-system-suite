import { Shield } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/hooks/useEmpresa";

const acaoLabel: Record<string, string> = { criacao: "Criação", edicao: "Edição", exclusao: "Exclusão" };
const acaoColor: Record<string, string> = { criacao: "bg-success/15 text-success", edicao: "bg-warning/15 text-warning", exclusao: "bg-destructive/15 text-destructive" };

const Auditoria = () => {
  const empresaId = useEmpresa();
  const { data: logs, isLoading } = useQuery({
    queryKey: ["audit_logs", empresaId],
    queryFn: async () => {
      const { data, error } = await supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(100);
      if (error) throw error;
      return data;
    },
    enabled: !!empresaId,
  });

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center gap-2">
        <Shield size={18} className="text-primary" />
        <h1 className="text-lg font-bold text-foreground">Logs e Auditoria</h1>
      </div>

      {isLoading ? (
        <p className="text-center py-8 text-xs text-muted-foreground">Carregando...</p>
      ) : !logs?.length ? (
        <p className="text-center py-8 text-xs text-muted-foreground">Nenhum log registrado ainda.</p>
      ) : (
        <div className="border border-border rounded overflow-hidden">
          <table className="w-full text-xs">
            <thead><tr className="bg-secondary/60">
              <th className="text-left px-2.5 py-2 font-semibold border-b border-border">Data</th>
              <th className="text-left px-2.5 py-2 font-semibold border-b border-border">Tabela</th>
              <th className="text-center px-2.5 py-2 font-semibold border-b border-border">Ação</th>
              <th className="text-left px-2.5 py-2 font-semibold border-b border-border">Registro</th>
            </tr></thead>
            <tbody>
              {logs.map(l => (
                <tr key={l.id} className="border-b border-border last:border-b-0 hover:bg-secondary/30">
                  <td className="px-2.5 py-1.5 text-muted-foreground">{new Date(l.created_at).toLocaleString("pt-BR")}</td>
                  <td className="px-2.5 py-1.5 font-medium">{l.tabela}</td>
                  <td className="px-2.5 py-1.5 text-center"><span className={`px-1.5 py-0.5 rounded text-[11px] font-medium ${acaoColor[l.acao] ?? ""}`}>{acaoLabel[l.acao] ?? l.acao}</span></td>
                  <td className="px-2.5 py-1.5 text-muted-foreground font-mono text-[10px]">{l.registro_id?.slice(0, 8) ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default Auditoria;
