import { PenTool } from "lucide-react";
import { useProjetos } from "@/hooks/useProjetos";

const statusLabel: Record<string, string> = { orcamento: "Aguardando", aprovado: "Aprovado", em_andamento: "Assinado", concluido: "Concluído", cancelado: "Cancelado" };
const statusColor: Record<string, string> = { orcamento: "bg-secondary text-secondary-foreground", aprovado: "bg-success/15 text-success", em_andamento: "bg-primary/15 text-primary", concluido: "bg-info/15 text-info", cancelado: "bg-destructive/15 text-destructive" };

const Contratos = () => {
  const { data: projetos, isLoading } = useProjetos();

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center gap-2">
        <PenTool size={18} className="text-primary" />
        <h1 className="text-lg font-bold text-foreground">Contratos</h1>
      </div>
      <p className="text-xs text-muted-foreground">Status contratual dos projetos — base para gestão de contratos e assinatura digital.</p>

      {isLoading ? (
        <p className="text-center py-8 text-xs text-muted-foreground">Carregando...</p>
      ) : (
        <div className="border border-border rounded overflow-hidden">
          <table className="w-full text-xs">
            <thead><tr className="bg-secondary/60">
              <th className="text-left px-2.5 py-2 font-semibold border-b border-border">Projeto</th>
              <th className="text-left px-2.5 py-2 font-semibold border-b border-border">Cliente</th>
              <th className="text-center px-2.5 py-2 font-semibold border-b border-border">Status Contrato</th>
            </tr></thead>
            <tbody>
              {projetos?.map(p => (
                <tr key={p.id} className="border-b border-border last:border-b-0 hover:bg-secondary/30">
                  <td className="px-2.5 py-1.5 font-medium">{p.nome}</td>
                  <td className="px-2.5 py-1.5">{(p.clientes as any)?.nome ?? "—"}</td>
                  <td className="px-2.5 py-1.5 text-center">
                    <span className={`px-1.5 py-0.5 rounded text-[11px] font-medium ${statusColor[p.status ?? "orcamento"]}`}>{statusLabel[p.status ?? "orcamento"]}</span>
                  </td>
                </tr>
              ))}
              {(!projetos || projetos.length === 0) && <tr><td colSpan={3} className="text-center py-4 text-muted-foreground">Nenhum projeto.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default Contratos;
