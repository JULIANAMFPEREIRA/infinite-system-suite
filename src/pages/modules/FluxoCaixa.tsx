import { TrendingUp, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { useFinanceiroPagar, useFinanceiroReceber } from "@/hooks/useFinanceiro";

const fmt = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

const FluxoCaixa = () => {
  const { data: receber, isLoading: lr } = useFinanceiroReceber();
  const { data: pagar, isLoading: lp } = useFinanceiroPagar();

  const totalReceber = receber?.reduce((a, r) => a + (r.valor ?? 0), 0) ?? 0;
  const totalRecebido = receber?.filter(r => r.status === "pago").reduce((a, r) => a + (r.valor ?? 0), 0) ?? 0;
  const totalPagar = pagar?.reduce((a, p) => a + (p.valor ?? 0), 0) ?? 0;
  const totalPago = pagar?.filter(p => p.status === "pago").reduce((a, p) => a + (p.valor ?? 0), 0) ?? 0;
  const saldo = totalRecebido - totalPago;

  const isLoading = lr || lp;

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center gap-2">
        <TrendingUp size={18} className="text-primary" />
        <h1 className="text-lg font-bold text-foreground">Fluxo de Caixa</h1>
      </div>

      {isLoading ? (
        <p className="text-center py-8 text-xs text-muted-foreground">Carregando...</p>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="bg-card border border-border rounded-lg p-4 space-y-1">
              <div className="flex items-center gap-1.5 text-success">
                <ArrowUpRight size={16} />
                <span className="text-xs font-medium">Entradas (Recebido)</span>
              </div>
              <p className="text-lg font-bold text-success">{fmt(totalRecebido)}</p>
              <p className="text-[11px] text-muted-foreground">Total previsto: {fmt(totalReceber)}</p>
            </div>
            <div className="bg-card border border-border rounded-lg p-4 space-y-1">
              <div className="flex items-center gap-1.5 text-destructive">
                <ArrowDownRight size={16} />
                <span className="text-xs font-medium">Saídas (Pago)</span>
              </div>
              <p className="text-lg font-bold text-destructive">{fmt(totalPago)}</p>
              <p className="text-[11px] text-muted-foreground">Total previsto: {fmt(totalPagar)}</p>
            </div>
            <div className="bg-card border border-border rounded-lg p-4 space-y-1">
              <div className="flex items-center gap-1.5 text-primary">
                <TrendingUp size={16} />
                <span className="text-xs font-medium">Saldo</span>
              </div>
              <p className={`text-lg font-bold ${saldo >= 0 ? "text-success" : "text-destructive"}`}>{fmt(saldo)}</p>
              <p className="text-[11px] text-muted-foreground">Previsto: {fmt(totalReceber - totalPagar)}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-foreground">Próximas Entradas</h3>
              <div className="border border-border rounded overflow-hidden">
                <table className="w-full text-xs">
                  <thead><tr className="bg-secondary/60"><th className="text-left px-2.5 py-1.5 font-semibold border-b border-border">Descrição</th><th className="text-right px-2.5 py-1.5 font-semibold border-b border-border">Valor</th><th className="text-left px-2.5 py-1.5 font-semibold border-b border-border">Venc.</th></tr></thead>
                  <tbody>
                    {receber?.filter(r => r.status === "pendente").slice(0, 5).map(r => (
                      <tr key={r.id} className="border-b border-border last:border-b-0 hover:bg-secondary/30">
                        <td className="px-2.5 py-1.5">{r.descricao ?? "—"}</td>
                        <td className="px-2.5 py-1.5 text-right text-success font-medium">{fmt(r.valor ?? 0)}</td>
                        <td className="px-2.5 py-1.5">{r.data_vencimento ?? "—"}</td>
                      </tr>
                    ))}
                    {!receber?.filter(r => r.status === "pendente").length && <tr><td colSpan={3} className="text-center py-3 text-muted-foreground">Nenhuma entrada pendente.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-foreground">Próximas Saídas</h3>
              <div className="border border-border rounded overflow-hidden">
                <table className="w-full text-xs">
                  <thead><tr className="bg-secondary/60"><th className="text-left px-2.5 py-1.5 font-semibold border-b border-border">Descrição</th><th className="text-right px-2.5 py-1.5 font-semibold border-b border-border">Valor</th><th className="text-left px-2.5 py-1.5 font-semibold border-b border-border">Venc.</th></tr></thead>
                  <tbody>
                    {pagar?.filter(p => p.status === "pendente").slice(0, 5).map(p => (
                      <tr key={p.id} className="border-b border-border last:border-b-0 hover:bg-secondary/30">
                        <td className="px-2.5 py-1.5">{p.descricao ?? "—"}</td>
                        <td className="px-2.5 py-1.5 text-right text-destructive font-medium">{fmt(p.valor ?? 0)}</td>
                        <td className="px-2.5 py-1.5">{p.data_vencimento ?? "—"}</td>
                      </tr>
                    ))}
                    {!pagar?.filter(p => p.status === "pendente").length && <tr><td colSpan={3} className="text-center py-3 text-muted-foreground">Nenhuma saída pendente.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default FluxoCaixa;
