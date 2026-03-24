import { BarChart3 } from "lucide-react";
import { useProjetos } from "@/hooks/useProjetos";
import { useFinanceiroReceber, useFinanceiroPagar } from "@/hooks/useFinanceiro";

const fmt = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

const Relatorios = () => {
  const { data: projetos, isLoading: lp } = useProjetos();
  const { data: receber, isLoading: lr } = useFinanceiroReceber();
  const { data: pagar, isLoading: lpg } = useFinanceiroPagar();

  const isLoading = lp || lr || lpg;

  const topProjetos = projetos?.slice().sort((a, b) => (b.venda_total ?? 0) - (a.venda_total ?? 0)).slice(0, 5) ?? [];
  const totalReceita = receber?.reduce((a, r) => a + (r.valor ?? 0), 0) ?? 0;
  const totalDespesa = pagar?.reduce((a, p) => a + (p.valor ?? 0), 0) ?? 0;

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center gap-2">
        <BarChart3 size={18} className="text-primary" />
        <h1 className="text-lg font-bold text-foreground">Relatórios</h1>
      </div>

      {isLoading ? (
        <p className="text-center py-8 text-xs text-muted-foreground">Carregando...</p>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="bg-card border border-border rounded-lg p-4">
              <p className="text-xs text-muted-foreground">Total de Projetos</p>
              <p className="text-2xl font-bold text-foreground">{projetos?.length ?? 0}</p>
            </div>
            <div className="bg-card border border-border rounded-lg p-4">
              <p className="text-xs text-muted-foreground">Receita Total</p>
              <p className="text-2xl font-bold text-success">{fmt(totalReceita)}</p>
            </div>
            <div className="bg-card border border-border rounded-lg p-4">
              <p className="text-xs text-muted-foreground">Despesas Totais</p>
              <p className="text-2xl font-bold text-destructive">{fmt(totalDespesa)}</p>
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-foreground">Ranking de Projetos (por Venda)</h3>
            <div className="border border-border rounded overflow-hidden">
              <table className="w-full text-xs">
                <thead><tr className="bg-secondary/60">
                  <th className="text-left px-2.5 py-2 font-semibold border-b border-border">#</th>
                  <th className="text-left px-2.5 py-2 font-semibold border-b border-border">Projeto</th>
                  <th className="text-left px-2.5 py-2 font-semibold border-b border-border">Cliente</th>
                  <th className="text-right px-2.5 py-2 font-semibold border-b border-border">Venda</th>
                  <th className="text-right px-2.5 py-2 font-semibold border-b border-border">Margem</th>
                </tr></thead>
                <tbody>
                  {topProjetos.map((p, i) => (
                    <tr key={p.id} className="border-b border-border last:border-b-0 hover:bg-secondary/30">
                      <td className="px-2.5 py-1.5 text-muted-foreground">{i + 1}</td>
                      <td className="px-2.5 py-1.5 font-medium">{p.nome}</td>
                      <td className="px-2.5 py-1.5">{(p.clientes as any)?.nome ?? "—"}</td>
                      <td className="px-2.5 py-1.5 text-right font-medium">{fmt(p.venda_total ?? 0)}</td>
                      <td className="px-2.5 py-1.5 text-right"><span className={(p.margem_prevista ?? 0) > 0 ? "text-success" : "text-destructive"}>{(p.margem_prevista ?? 0).toFixed(1)}%</span></td>
                    </tr>
                  ))}
                  {topProjetos.length === 0 && <tr><td colSpan={5} className="text-center py-4 text-muted-foreground">Nenhum projeto.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Relatorios;
