import { BarChart3, Download } from "lucide-react";
import { useProjetos } from "@/hooks/useProjetos";
import { useFinanceiroReceber, useFinanceiroPagar } from "@/hooks/useFinanceiro";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const fmt = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

const Relatorios = () => {
  const { data: projetos, isLoading: lp } = useProjetos();
  const { data: receber, isLoading: lr } = useFinanceiroReceber();
  const { data: pagar, isLoading: lpg } = useFinanceiroPagar();

  const isLoading = lp || lr || lpg;

  const topProjetos = projetos?.slice().sort((a, b) => (b.venda_total ?? 0) - (a.venda_total ?? 0)).slice(0, 10) ?? [];
  const totalReceita = receber?.reduce((a, r) => a + (r.valor ?? 0), 0) ?? 0;
  const totalDespesa = pagar?.reduce((a, p) => a + (p.valor ?? 0), 0) ?? 0;

  const exportPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text("Relatorio INFINIT SYSTEM", 14, 20);
    doc.setFontSize(10);
    doc.text(`Gerado em: ${new Date().toLocaleDateString("pt-BR")}`, 14, 28);

    doc.setFontSize(12);
    doc.text("Resumo Financeiro", 14, 40);
    autoTable(doc, {
      startY: 45,
      head: [["Metrica", "Valor"]],
      body: [
        ["Total de Projetos", String(projetos?.length ?? 0)],
        ["Receita Total", fmt(totalReceita)],
        ["Despesas Totais", fmt(totalDespesa)],
        ["Resultado", fmt(totalReceita - totalDespesa)],
      ],
    });

    doc.text("Ranking de Projetos por Venda", 14, (doc as any).lastAutoTable.finalY + 15);
    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 20,
      head: [["#", "Projeto", "Venda", "Margem %"]],
      body: topProjetos.map((p, i) => [
        String(i + 1),
        p.nome,
        fmt(p.venda_total ?? 0),
        `${(p.margem_prevista ?? 0).toFixed(1)}%`,
      ]),
    });

    doc.save("relatorio-infinit.pdf");
  };

  const exportCSV = () => {
    const headers = "Projeto,Venda,Custo Previsto,Margem %\n";
    const rows = topProjetos.map(p => `"${p.nome}",${p.venda_total ?? 0},${p.custo_previsto ?? 0},${(p.margem_prevista ?? 0).toFixed(1)}`).join("\n");
    const blob = new Blob([headers + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "relatorio-infinit.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 size={18} className="text-primary" />
          <h1 className="text-lg font-bold text-foreground">Relatórios</h1>
        </div>
        <div className="flex gap-2">
          <button onClick={exportPDF} className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-primary text-primary-foreground text-xs font-medium hover:brightness-105"><Download size={14} /> PDF</button>
          <button onClick={exportCSV} className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-secondary text-secondary-foreground text-xs font-medium hover:bg-secondary/80"><Download size={14} /> CSV</button>
        </div>
      </div>

      {isLoading ? <p className="text-center py-8 text-xs text-muted-foreground">Carregando...</p> : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
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
            <div className="bg-card border border-border rounded-lg p-4">
              <p className="text-xs text-muted-foreground">Resultado</p>
              <p className={`text-2xl font-bold ${(totalReceita - totalDespesa) >= 0 ? "text-success" : "text-destructive"}`}>{fmt(totalReceita - totalDespesa)}</p>
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
