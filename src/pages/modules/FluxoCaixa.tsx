import { useState } from "react";
import { TrendingUp, ArrowUpRight, ArrowDownRight, Plus } from "lucide-react";
import { useFinanceiroPagar, useFinanceiroReceber, useCreateContaPagar, useCreateContaReceber } from "@/hooks/useFinanceiro";
import { useEmpresa } from "@/hooks/useEmpresa";
import { toast } from "sonner";

const fmt = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

const FluxoCaixa = () => {
  const empresaId = useEmpresa();
  const { data: receber, isLoading: lr } = useFinanceiroReceber();
  const { data: pagar, isLoading: lp } = useFinanceiroPagar();
  const createReceber = useCreateContaReceber();
  const createPagar = useCreateContaPagar();

  const [showManual, setShowManual] = useState(false);
  const [manualTipo, setManualTipo] = useState<"receita" | "despesa">("receita");
  const [manualDesc, setManualDesc] = useState("");
  const [manualValor, setManualValor] = useState(0);
  const [manualData, setManualData] = useState(new Date().toISOString().split("T")[0]);

  const totalReceber = receber?.reduce((a, r) => a + (r.valor ?? 0), 0) ?? 0;
  const totalRecebido = receber?.filter(r => r.status === "pago").reduce((a, r) => a + (r.valor ?? 0), 0) ?? 0;
  const totalPagar = pagar?.reduce((a, p) => a + (p.valor ?? 0), 0) ?? 0;
  const totalPago = pagar?.filter(p => p.status === "pago").reduce((a, p) => a + (p.valor ?? 0), 0) ?? 0;
  const saldo = totalRecebido - totalPago;
  const isLoading = lr || lp;

  const handleManualSave = async () => {
    if (!manualDesc.trim()) { toast.error("Descrição obrigatória"); return; }
    try {
      if (manualTipo === "receita") {
        await createReceber.mutateAsync({ descricao: `[Manual] ${manualDesc}`, valor: manualValor, data_vencimento: manualData, status: "pago", data_pagamento: manualData });
      } else {
        await createPagar.mutateAsync({ descricao: `[Manual] ${manualDesc}`, valor: manualValor, data_vencimento: manualData, status: "pago", data_pagamento: manualData });
      }
      toast.success("Lançamento registrado!");
      setManualDesc(""); setManualValor(0); setShowManual(false);
    } catch (err: any) { toast.error(err.message); }
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp size={18} className="text-primary" />
          <h1 className="text-lg font-bold text-foreground">Fluxo de Caixa</h1>
        </div>
        <button onClick={() => setShowManual(!showManual)} className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-primary text-primary-foreground text-xs font-medium hover:brightness-105">
          <Plus size={14} /> Lançamento Manual
        </button>
      </div>

      {showManual && (
        <div className="bg-card border border-border rounded p-3 space-y-3">
          <h2 className="text-xs font-semibold text-foreground">Novo Lançamento Manual</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="space-y-1"><label className="text-[11px] text-muted-foreground">Tipo</label>
              <select value={manualTipo} onChange={e => setManualTipo(e.target.value as any)} className="w-full h-8 px-2 text-xs bg-background border border-border rounded">
                <option value="receita">Receita (Entrada)</option><option value="despesa">Despesa (Saída)</option>
              </select>
            </div>
            <div className="space-y-1"><label className="text-[11px] text-muted-foreground">Descrição</label><input value={manualDesc} onChange={e => setManualDesc(e.target.value)} className="w-full h-8 px-2 text-xs bg-background border border-border rounded" /></div>
            <div className="space-y-1"><label className="text-[11px] text-muted-foreground">Valor</label><input type="number" value={manualValor} onChange={e => setManualValor(Number(e.target.value))} className="w-full h-8 px-2 text-xs bg-background border border-border rounded" /></div>
            <div className="space-y-1"><label className="text-[11px] text-muted-foreground">Data</label><input type="date" value={manualData} onChange={e => setManualData(e.target.value)} className="w-full h-8 px-2 text-xs bg-background border border-border rounded" /></div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleManualSave} className="px-4 py-1.5 rounded bg-primary text-primary-foreground text-xs font-medium">Salvar</button>
            <button onClick={() => setShowManual(false)} className="px-4 py-1.5 rounded bg-secondary text-secondary-foreground text-xs">Cancelar</button>
          </div>
        </div>
      )}

      {isLoading ? <p className="text-center py-8 text-xs text-muted-foreground">Carregando...</p> : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="bg-card border border-border rounded-lg p-4 space-y-1">
              <div className="flex items-center gap-1.5 text-success"><ArrowUpRight size={16} /><span className="text-xs font-medium">Entradas (Recebido)</span></div>
              <p className="text-lg font-bold text-success">{fmt(totalRecebido)}</p>
              <p className="text-[11px] text-muted-foreground">Total previsto: {fmt(totalReceber)}</p>
            </div>
            <div className="bg-card border border-border rounded-lg p-4 space-y-1">
              <div className="flex items-center gap-1.5 text-destructive"><ArrowDownRight size={16} /><span className="text-xs font-medium">Saídas (Pago)</span></div>
              <p className="text-lg font-bold text-destructive">{fmt(totalPago)}</p>
              <p className="text-[11px] text-muted-foreground">Total previsto: {fmt(totalPagar)}</p>
            </div>
            <div className="bg-card border border-border rounded-lg p-4 space-y-1">
              <div className="flex items-center gap-1.5 text-primary"><TrendingUp size={16} /><span className="text-xs font-medium">Saldo</span></div>
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
