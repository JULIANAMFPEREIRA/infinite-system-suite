import { UserCheck } from "lucide-react";
import { useComissoes } from "@/hooks/useFinanceiro";

const Comissoes = () => {
  const { data: comissoes, isLoading } = useComissoes();

  const statusColor = (s: string) => s === "pago" ? "bg-success/15 text-success" : "bg-warning/15 text-warning";

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center gap-2">
        <UserCheck size={18} className="text-primary" />
        <h1 className="text-lg font-bold text-foreground">Comissões (RT)</h1>
      </div>
      <p className="text-xs text-muted-foreground">Comissões geradas automaticamente a partir dos projetos.</p>

      {isLoading ? <p className="text-xs text-muted-foreground text-center py-8">Carregando...</p> : (
        <div className="border border-border rounded overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-secondary/60">
                <th className="text-left px-2.5 py-2 font-semibold border-b border-border">Arquiteto</th>
                <th className="text-left px-2.5 py-2 font-semibold border-b border-border">Projeto</th>
                <th className="text-right px-2.5 py-2 font-semibold border-b border-border">%</th>
                <th className="text-right px-2.5 py-2 font-semibold border-b border-border">Valor</th>
                <th className="text-center px-2.5 py-2 font-semibold border-b border-border">Vencimento</th>
                <th className="text-center px-2.5 py-2 font-semibold border-b border-border">Status</th>
              </tr>
            </thead>
            <tbody>
              {comissoes?.map(c => (
                <tr key={c.id} className="border-b border-border last:border-b-0 hover:bg-secondary/30">
                  <td className="px-2.5 py-1.5">{(c.fornecedores as any)?.nome ?? "—"}</td>
                  <td className="px-2.5 py-1.5">{(c.projetos as any)?.nome ?? "—"}</td>
                  <td className="px-2.5 py-1.5 text-right">{c.percentual ?? 0}%</td>
                  <td className="px-2.5 py-1.5 text-right font-medium">R$ {(c.valor ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
                  <td className="px-2.5 py-1.5 text-center">{c.data_vencimento ?? "—"}</td>
                  <td className="px-2.5 py-1.5 text-center">
                    <span className={`px-1.5 py-0.5 rounded text-[11px] font-medium ${statusColor(c.status ?? "pendente")}`}>{c.status}</span>
                  </td>
                </tr>
              ))}
              {(!comissoes || comissoes.length === 0) && <tr><td colSpan={6} className="text-center py-4 text-muted-foreground">Nenhuma comissão encontrada.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default Comissoes;
