import { useMemo, useState } from "react";
import { BarChart3, Download } from "lucide-react";
import { useProjetos } from "@/hooks/useProjetos";
import { useFinanceiroReceber, useFinanceiroPagar } from "@/hooks/useFinanceiro";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const fmtN = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmt = (v: number) => `R$ ${fmtN(v)}`;

type TabKey = "projetos" | "receber" | "pagar" | "fluxo";

const STATUS_OPTS = ["todos", "pendente", "pago", "vencido"] as const;
const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const ANOS = [2024, 2025, 2026];

const isVencido = (c: any) =>
  c.status !== "pago" && c.data_vencimento && new Date(c.data_vencimento) < new Date(new Date().toDateString());

const matchStatus = (c: any, st: string) => {
  if (st === "todos") return true;
  if (st === "vencido") return isVencido(c);
  if (st === "pendente") return c.status === "pendente" || c.status === "parcial";
  return c.status === st;
};

const matchMesAno = (dateStr: string | null | undefined, mes: string, ano: string) => {
  if (!dateStr) return mes === "todos" && ano === "todos";
  const d = new Date(dateStr);
  const okMes = mes === "todos" || d.getMonth() + 1 === Number(mes);
  const okAno = ano === "todos" || d.getFullYear() === Number(ano);
  return okMes && okAno;
};

const Relatorios = () => {
  const { data: projetos, isLoading: lp } = useProjetos();
  const { data: receber, isLoading: lr } = useFinanceiroReceber();
  const { data: pagar, isLoading: lpg } = useFinanceiroPagar();

  const [tab, setTab] = useState<TabKey>("projetos");

  // Filtros A Receber
  const [rStatus, setRStatus] = useState<string>("todos");
  const [rMes, setRMes] = useState<string>("todos");
  const [rAno, setRAno] = useState<string>("todos");

  // Filtros A Pagar
  const [pStatus, setPStatus] = useState<string>("todos");
  const [pMes, setPMes] = useState<string>("todos");
  const [pAno, setPAno] = useState<string>("todos");

  const isLoading = lp || lr || lpg;

  const topProjetos = projetos?.slice().sort((a, b) => (b.venda_total ?? 0) - (a.venda_total ?? 0)).slice(0, 10) ?? [];
  const totalReceita = receber?.reduce((a, r) => a + (r.valor ?? 0), 0) ?? 0;
  const totalDespesa = pagar?.reduce((a, p) => a + (p.valor ?? 0), 0) ?? 0;

  // ============ A Receber ============
  const receberFiltered = useMemo(() => {
    return (receber ?? []).filter((c: any) =>
      matchStatus(c, rStatus) && matchMesAno(c.data_vencimento, rMes, rAno),
    );
  }, [receber, rStatus, rMes, rAno]);

  const rResumo = useMemo(() => {
    const list = receber ?? [];
    const totalAReceber = list
      .filter((c: any) => c.status === "pendente" || c.status === "parcial")
      .reduce((a: number, c: any) => a + (c.valor ?? 0), 0);
    const totalRecebido = list.filter((c: any) => c.status === "pago").reduce((a: number, c: any) => a + (c.valor ?? 0), 0);
    const totalVencido = list.filter((c: any) => isVencido(c)).reduce((a: number, c: any) => a + (c.valor ?? 0), 0);
    const ticketMedio = list.length ? list.reduce((a: number, c: any) => a + (c.valor ?? 0), 0) / list.length : 0;
    return { totalAReceber, totalRecebido, totalVencido, ticketMedio };
  }, [receber]);

  const rTotalTabela = receberFiltered.reduce((a: number, c: any) => a + (c.valor ?? 0), 0);

  // ============ A Pagar ============
  const pagarFiltered = useMemo(() => {
    return (pagar ?? []).filter((c: any) =>
      matchStatus(c, pStatus) && matchMesAno(c.data_vencimento, pMes, pAno),
    );
  }, [pagar, pStatus, pMes, pAno]);

  const pResumo = useMemo(() => {
    const list = pagar ?? [];
    const totalAPagar = list.filter((c: any) => c.status === "pendente").reduce((a: number, c: any) => a + (c.valor ?? 0), 0);
    const totalPago = list.filter((c: any) => c.status === "pago").reduce((a: number, c: any) => a + (c.valor ?? 0), 0);
    const totalVencido = list.filter((c: any) => isVencido(c)).reduce((a: number, c: any) => a + (c.valor ?? 0), 0);
    return { totalAPagar, totalPago, totalVencido };
  }, [pagar]);

  const pTotalTabela = pagarFiltered.reduce((a: number, c: any) => a + (c.valor ?? 0), 0);

  // ============ Fluxo de Caixa ============
  const fluxo = useMemo(() => {
    const map = new Map<string, { ano: number; mes: number; receitas: number; despesas: number }>();
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      map.set(key, { ano: d.getFullYear(), mes: d.getMonth(), receitas: 0, despesas: 0 });
    }
    (receber ?? []).forEach((c: any) => {
      if (c.status !== "pago" || !c.data_vencimento) return;
      const d = new Date(c.data_vencimento);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      const e = map.get(key);
      if (e) e.receitas += c.valor ?? 0;
    });
    (pagar ?? []).forEach((c: any) => {
      if (c.status !== "pago" || !c.data_vencimento) return;
      const d = new Date(c.data_vencimento);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      const e = map.get(key);
      if (e) e.despesas += c.valor ?? 0;
    });
    let acc = 0;
    return Array.from(map.values()).map((e) => {
      const saldo = e.receitas - e.despesas;
      acc += saldo;
      return { ...e, saldo, acumulado: acc };
    });
  }, [receber, pagar]);

  const fluxoTotais = fluxo.reduce(
    (a, e) => ({ receitas: a.receitas + e.receitas, despesas: a.despesas + e.despesas }),
    { receitas: 0, despesas: 0 },
  );

  // ============ Export ============
  const exportPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text("Relatorio INFINIT SYSTEM", 14, 20);
    doc.setFontSize(10);
    doc.text(`Gerado em: ${new Date().toLocaleDateString("pt-BR")}`, 14, 28);

    if (tab === "projetos") {
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
        body: topProjetos.map((p, i) => [String(i + 1), p.nome, fmt(p.venda_total ?? 0), `${(p.margem_prevista ?? 0).toFixed(1)}%`]),
      });
    } else if (tab === "receber") {
      doc.text("Contas a Receber", 14, 40);
      autoTable(doc, {
        startY: 45,
        head: [["Cliente", "Projeto", "Parcela", "Valor", "Vencimento", "Status"]],
        body: receberFiltered.map((c: any) => [
          c.clientes?.nome ?? "—",
          c.projetos?.nome ?? "—",
          String(c.parcela ?? 1),
          fmt(c.valor ?? 0),
          c.data_vencimento ? new Date(c.data_vencimento).toLocaleDateString("pt-BR") : "—",
          isVencido(c) ? "VENCIDO" : (c.status ?? "").toUpperCase(),
        ]),
        foot: [["", "", "TOTAL", fmt(rTotalTabela), "", ""]],
      });
    } else if (tab === "pagar") {
      doc.text("Contas a Pagar", 14, 40);
      autoTable(doc, {
        startY: 45,
        head: [["Descrição", "Fornecedor", "Projeto", "Categoria", "Valor", "Vencimento", "Status"]],
        body: pagarFiltered.map((c: any) => [
          c.descricao ?? "—",
          c.fornecedores?.nome ?? "—",
          c.projetos?.nome ?? "—",
          c.categorias?.nome ?? "—",
          fmt(c.valor ?? 0),
          c.data_vencimento ? new Date(c.data_vencimento).toLocaleDateString("pt-BR") : "—",
          isVencido(c) ? "VENCIDO" : (c.status ?? "").toUpperCase(),
        ]),
        foot: [["", "", "", "TOTAL", fmt(pTotalTabela), "", ""]],
      });
    } else {
      doc.text("Fluxo de Caixa - Últimos 12 meses", 14, 40);
      autoTable(doc, {
        startY: 45,
        head: [["Mês", "Receitas", "Despesas", "Saldo do Mês", "Saldo Acumulado"]],
        body: fluxo.map((e) => [
          `${MESES[e.mes]}/${e.ano}`,
          fmt(e.receitas),
          fmt(e.despesas),
          fmt(e.saldo),
          fmt(e.acumulado),
        ]),
        foot: [["TOTAL", fmt(fluxoTotais.receitas), fmt(fluxoTotais.despesas), fmt(fluxoTotais.receitas - fluxoTotais.despesas), ""]],
      });
    }

    doc.save(`relatorio-${tab}.pdf`);
  };

  const downloadCSV = (filename: string, headers: string, rows: string) => {
    const blob = new Blob([headers + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };

  const exportCSV = () => {
    if (tab === "projetos") {
      const headers = "Projeto,Venda,Custo Previsto,Margem %\n";
      const rows = topProjetos.map((p) => `"${p.nome}",${p.venda_total ?? 0},${p.custo_previsto ?? 0},${(p.margem_prevista ?? 0).toFixed(1)}`).join("\n");
      downloadCSV("relatorio-projetos.csv", headers, rows);
    } else if (tab === "receber") {
      const headers = "Cliente,Projeto,Parcela,Valor,Vencimento,Status\n";
      const rows = receberFiltered.map((c: any) =>
        `"${c.clientes?.nome ?? ""}","${c.projetos?.nome ?? ""}",${c.parcela ?? 1},${c.valor ?? 0},${c.data_vencimento ?? ""},${isVencido(c) ? "vencido" : c.status ?? ""}`
      ).join("\n");
      downloadCSV("relatorio-receber.csv", headers, rows);
    } else if (tab === "pagar") {
      const headers = "Descrição,Fornecedor,Projeto,Categoria,Valor,Vencimento,Status\n";
      const rows = pagarFiltered.map((c: any) =>
        `"${c.descricao ?? ""}","${c.fornecedores?.nome ?? ""}","${c.projetos?.nome ?? ""}","${c.categorias?.nome ?? ""}",${c.valor ?? 0},${c.data_vencimento ?? ""},${isVencido(c) ? "vencido" : c.status ?? ""}`
      ).join("\n");
      downloadCSV("relatorio-pagar.csv", headers, rows);
    } else {
      const headers = "Mês,Receitas,Despesas,Saldo do Mês,Saldo Acumulado\n";
      const rows = fluxo.map((e) => `${MESES[e.mes]}/${e.ano},${e.receitas.toFixed(2)},${e.despesas.toFixed(2)},${e.saldo.toFixed(2)},${e.acumulado.toFixed(2)}`).join("\n");
      downloadCSV("relatorio-fluxo.csv", headers, rows);
    }
  };

  const selectCls = "h-7 px-2 rounded border border-border bg-background text-xs";
  const cardCls = "bg-card border border-border rounded-lg p-4";

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
        <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)}>
          <TabsList>
            <TabsTrigger value="projetos">Projetos</TabsTrigger>
            <TabsTrigger value="receber">A Receber</TabsTrigger>
            <TabsTrigger value="pagar">A Pagar</TabsTrigger>
            <TabsTrigger value="fluxo">Fluxo de Caixa</TabsTrigger>
          </TabsList>

          {/* ============ PROJETOS (existente) ============ */}
          <TabsContent value="projetos" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div className={cardCls}>
                <p className="text-xs text-muted-foreground">Total de Projetos</p>
                <p className="text-2xl font-bold text-foreground">{projetos?.length ?? 0}</p>
              </div>
              <div className={cardCls}>
                <p className="text-xs text-muted-foreground">Receita Total</p>
                <p className="text-2xl font-bold text-success">{fmt(totalReceita)}</p>
              </div>
              <div className={cardCls}>
                <p className="text-xs text-muted-foreground">Despesas Totais</p>
                <p className="text-2xl font-bold text-destructive">{fmt(totalDespesa)}</p>
              </div>
              <div className={cardCls}>
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
          </TabsContent>

          {/* ============ A RECEBER ============ */}
          <TabsContent value="receber" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div className={cardCls}>
                <p className="text-xs text-muted-foreground">Total a Receber</p>
                <p className="text-2xl font-bold text-foreground">{fmt(rResumo.totalAReceber)}</p>
              </div>
              <div className={cardCls}>
                <p className="text-xs text-muted-foreground">Total Recebido</p>
                <p className="text-2xl font-bold text-success">{fmt(rResumo.totalRecebido)}</p>
              </div>
              <div className={cardCls}>
                <p className="text-xs text-muted-foreground">Total Vencido</p>
                <p className="text-2xl font-bold text-destructive">{fmt(rResumo.totalVencido)}</p>
              </div>
              <div className={cardCls}>
                <p className="text-xs text-muted-foreground">Ticket Médio</p>
                <p className="text-2xl font-bold text-foreground">{fmt(rResumo.ticketMedio)}</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <select className={selectCls} value={rStatus} onChange={(e) => setRStatus(e.target.value)}>
                {STATUS_OPTS.map((s) => <option key={s} value={s}>{s.toUpperCase()}</option>)}
              </select>
              <select className={selectCls} value={rMes} onChange={(e) => setRMes(e.target.value)}>
                <option value="todos">Todos os meses</option>
                {MESES.map((m, i) => <option key={i} value={String(i + 1)}>{m}</option>)}
              </select>
              <select className={selectCls} value={rAno} onChange={(e) => setRAno(e.target.value)}>
                <option value="todos">Todos os anos</option>
                {ANOS.map((a) => <option key={a} value={String(a)}>{a}</option>)}
              </select>
            </div>

            <div className="border border-border rounded overflow-hidden">
              <table className="w-full text-xs">
                <thead><tr className="bg-secondary/60">
                  <th className="text-left px-2.5 py-2 font-semibold border-b border-border">Cliente</th>
                  <th className="text-left px-2.5 py-2 font-semibold border-b border-border">Projeto</th>
                  <th className="text-left px-2.5 py-2 font-semibold border-b border-border">Parcela</th>
                  <th className="text-right px-2.5 py-2 font-semibold border-b border-border">Valor</th>
                  <th className="text-left px-2.5 py-2 font-semibold border-b border-border">Vencimento</th>
                  <th className="text-left px-2.5 py-2 font-semibold border-b border-border">Status</th>
                </tr></thead>
                <tbody>
                  {receberFiltered.map((c: any) => (
                    <tr key={c.id} className="border-b border-border last:border-b-0 hover:bg-secondary/30">
                      <td className="px-2.5 py-1.5">{c.clientes?.nome ?? "—"}</td>
                      <td className="px-2.5 py-1.5">{c.projetos?.nome ?? "—"}</td>
                      <td className="px-2.5 py-1.5">{c.parcela ?? 1}</td>
                      <td className="px-2.5 py-1.5 text-right font-medium">{fmt(c.valor ?? 0)}</td>
                      <td className="px-2.5 py-1.5">{c.data_vencimento ? new Date(c.data_vencimento).toLocaleDateString("pt-BR") : "—"}</td>
                      <td className="px-2.5 py-1.5"><span className={isVencido(c) ? "text-destructive" : c.status === "pago" ? "text-success" : "text-muted-foreground"}>{(isVencido(c) ? "VENCIDO" : c.status ?? "").toUpperCase()}</span></td>
                    </tr>
                  ))}
                  {receberFiltered.length === 0 && <tr><td colSpan={6} className="text-center py-4 text-muted-foreground">Nenhum registro.</td></tr>}
                </tbody>
                <tfoot>
                  <tr className="bg-secondary/40 font-semibold">
                    <td className="px-2.5 py-2" colSpan={3}>TOTAL</td>
                    <td className="px-2.5 py-2 text-right">{fmt(rTotalTabela)}</td>
                    <td colSpan={2}></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </TabsContent>

          {/* ============ A PAGAR ============ */}
          <TabsContent value="pagar" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className={cardCls}>
                <p className="text-xs text-muted-foreground">Total a Pagar</p>
                <p className="text-2xl font-bold text-foreground">{fmt(pResumo.totalAPagar)}</p>
              </div>
              <div className={cardCls}>
                <p className="text-xs text-muted-foreground">Total Pago</p>
                <p className="text-2xl font-bold text-success">{fmt(pResumo.totalPago)}</p>
              </div>
              <div className={cardCls}>
                <p className="text-xs text-muted-foreground">Total Vencido</p>
                <p className="text-2xl font-bold text-destructive">{fmt(pResumo.totalVencido)}</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <select className={selectCls} value={pStatus} onChange={(e) => setPStatus(e.target.value)}>
                {STATUS_OPTS.map((s) => <option key={s} value={s}>{s.toUpperCase()}</option>)}
              </select>
              <select className={selectCls} value={pMes} onChange={(e) => setPMes(e.target.value)}>
                <option value="todos">Todos os meses</option>
                {MESES.map((m, i) => <option key={i} value={String(i + 1)}>{m}</option>)}
              </select>
              <select className={selectCls} value={pAno} onChange={(e) => setPAno(e.target.value)}>
                <option value="todos">Todos os anos</option>
                {ANOS.map((a) => <option key={a} value={String(a)}>{a}</option>)}
              </select>
            </div>

            <div className="border border-border rounded overflow-hidden">
              <table className="w-full text-xs">
                <thead><tr className="bg-secondary/60">
                  <th className="text-left px-2.5 py-2 font-semibold border-b border-border">Descrição</th>
                  <th className="text-left px-2.5 py-2 font-semibold border-b border-border">Fornecedor</th>
                  <th className="text-left px-2.5 py-2 font-semibold border-b border-border">Projeto</th>
                  <th className="text-left px-2.5 py-2 font-semibold border-b border-border">Categoria</th>
                  <th className="text-right px-2.5 py-2 font-semibold border-b border-border">Valor</th>
                  <th className="text-left px-2.5 py-2 font-semibold border-b border-border">Vencimento</th>
                  <th className="text-left px-2.5 py-2 font-semibold border-b border-border">Status</th>
                </tr></thead>
                <tbody>
                  {pagarFiltered.map((c: any) => (
                    <tr key={c.id} className="border-b border-border last:border-b-0 hover:bg-secondary/30">
                      <td className="px-2.5 py-1.5">{c.descricao ?? "—"}</td>
                      <td className="px-2.5 py-1.5">{c.fornecedores?.nome ?? "—"}</td>
                      <td className="px-2.5 py-1.5">{c.projetos?.nome ?? "—"}</td>
                      <td className="px-2.5 py-1.5">{(c as any).categorias?.nome ?? "—"}</td>
                      <td className="px-2.5 py-1.5 text-right font-medium">{fmt(c.valor ?? 0)}</td>
                      <td className="px-2.5 py-1.5">{c.data_vencimento ? new Date(c.data_vencimento).toLocaleDateString("pt-BR") : "—"}</td>
                      <td className="px-2.5 py-1.5"><span className={isVencido(c) ? "text-destructive" : c.status === "pago" ? "text-success" : "text-muted-foreground"}>{(isVencido(c) ? "VENCIDO" : c.status ?? "").toUpperCase()}</span></td>
                    </tr>
                  ))}
                  {pagarFiltered.length === 0 && <tr><td colSpan={7} className="text-center py-4 text-muted-foreground">Nenhum registro.</td></tr>}
                </tbody>
                <tfoot>
                  <tr className="bg-secondary/40 font-semibold">
                    <td className="px-2.5 py-2" colSpan={4}>TOTAL</td>
                    <td className="px-2.5 py-2 text-right">{fmt(pTotalTabela)}</td>
                    <td colSpan={2}></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </TabsContent>

          {/* ============ FLUXO DE CAIXA ============ */}
          <TabsContent value="fluxo" className="space-y-4">
            <div className="border border-border rounded overflow-hidden">
              <table className="w-full text-xs">
                <thead><tr className="bg-secondary/60">
                  <th className="text-left px-2.5 py-2 font-semibold border-b border-border">Mês</th>
                  <th className="text-right px-2.5 py-2 font-semibold border-b border-border">Receitas</th>
                  <th className="text-right px-2.5 py-2 font-semibold border-b border-border">Despesas</th>
                  <th className="text-right px-2.5 py-2 font-semibold border-b border-border">Saldo do Mês</th>
                  <th className="text-right px-2.5 py-2 font-semibold border-b border-border">Saldo Acumulado</th>
                </tr></thead>
                <tbody>
                  {fluxo.map((e) => (
                    <tr key={`${e.ano}-${e.mes}`} className="border-b border-border last:border-b-0 hover:bg-secondary/30">
                      <td className="px-2.5 py-1.5 font-medium">{MESES[e.mes]}/{e.ano}</td>
                      <td className="px-2.5 py-1.5 text-right text-success">{fmt(e.receitas)}</td>
                      <td className="px-2.5 py-1.5 text-right text-destructive">{fmt(e.despesas)}</td>
                      <td className={`px-2.5 py-1.5 text-right font-medium ${e.saldo >= 0 ? "text-success" : "text-destructive"}`}>{fmt(e.saldo)}</td>
                      <td className={`px-2.5 py-1.5 text-right font-semibold ${e.acumulado >= 0 ? "text-success" : "text-destructive"}`}>{fmt(e.acumulado)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-secondary/40 font-semibold">
                    <td className="px-2.5 py-2">TOTAL</td>
                    <td className="px-2.5 py-2 text-right text-success">{fmt(fluxoTotais.receitas)}</td>
                    <td className="px-2.5 py-2 text-right text-destructive">{fmt(fluxoTotais.despesas)}</td>
                    <td className={`px-2.5 py-2 text-right ${(fluxoTotais.receitas - fluxoTotais.despesas) >= 0 ? "text-success" : "text-destructive"}`}>{fmt(fluxoTotais.receitas - fluxoTotais.despesas)}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
};

export default Relatorios;
