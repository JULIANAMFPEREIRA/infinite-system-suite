import { useState, useMemo } from "react";
import { DollarSign, Plus, Check, Pencil, Trash2, Search } from "lucide-react";
import { isNotEmpty, isPositiveNumber } from "@/lib/validations";
import { useFinanceiroReceber, useCreateContaReceber, useUpdateContaReceber } from "@/hooks/useFinanceiro";
import { useFormasPagamento } from "@/hooks/useCategorias";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/hooks/useEmpresa";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { fmtBRL, fmtDate, statusBadgeClass, statusLabel, rowHighlightClass, saldoRestante, isContaVencida } from "@/lib/financeiroUtils";
import FinanceiroFilters, { applyDateFilter } from "@/components/financeiro/FinanceiroFilters";
import FinanceiroDetailPanel from "@/components/financeiro/FinanceiroDetailPanel";

const STATUS_OPTIONS = [
  { value: "", label: "Todos" },
  { value: "pendente", label: "A Receber" },
  { value: "vencido", label: "Inadimplente" },
  { value: "pago", label: "Recebido" },
  { value: "parcial", label: "Parcial" },
  { value: "cancelado", label: "Cancelado" },
];

const FinanceiroReceber = () => {
  const recStatusLabel = (s: string) => ({
    pendente: "A RECEBER",
    vencido: "INADIMPLENTE",
    pago: "RECEBIDO",
    parcial: "PARCIAL",
    cancelado: "CANCELADO",
  }[s] ?? s.toUpperCase());

  const recStatusBadgeClass = (s: string) => ({
    "A RECEBER": "bg-blue-100 text-blue-700",
    "INADIMPLENTE": "bg-red-100 text-red-700",
    "RECEBIDO": "bg-green-100 text-green-700",
    "PARCIAL": "bg-yellow-100 text-yellow-700",
    "CANCELADO": "bg-gray-100 text-gray-500",
  }[s] ?? "bg-gray-100 text-gray-500");

  const empresaId = useEmpresa();
  const qc = useQueryClient();
  const { data: contas, isLoading } = useFinanceiroReceber();
  const createConta = useCreateContaReceber();
  const updateConta = useUpdateContaReceber();
  const { data: formasPgto } = useFormasPagamento();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [desc, setDesc] = useState("");
  const [valor, setValor] = useState(0);
  const [vencimento, setVencimento] = useState("");
  const [parcela, setParcela] = useState(1);
  const [clienteId, setClienteId] = useState("");
  const [projetoId, setProjetoId] = useState("");

  const [showBaixa, setShowBaixa] = useState(false);
  const [baixaId, setBaixaId] = useState<string | null>(null);
  const [baixaData, setBaixaData] = useState(new Date().toISOString().split("T")[0]);
  const [baixaForma, setBaixaForma] = useState("");
  const [baixaObs, setBaixaObs] = useState("");
  const [baixaValor, setBaixaValor] = useState<number>(0);
  const [baixaContaAtual, setBaixaContaAtual] = useState<any>(null);
  const [historicoReceb, setHistoricoReceb] = useState<any[]>([]);

  // Detail panel
  const [detailConta, setDetailConta] = useState<any>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState("");
  const [periodoFilter, setPeriodoFilter] = useState("");
  const [mesFilter, setMesFilter] = useState("");
  const [anoFilter, setAnoFilter] = useState("");
   const [buscaFilter, setBuscaFilter] = useState("");
   const [dataInicio, setDataInicio] = useState("");
   const [dataFim, setDataFim] = useState("");
   const [tipoFilter, setTipoFilter] = useState("");
    const [categoriaFilter, setCategoriaFilter] = useState("");

    const [summaryTotals, setSummaryTotals] = useState({
      aReceber: 0,
      inadimplente: 0,
      recebido: 0,
    });

    const { data: clientesList } = useQuery({
    queryKey: ["clientes_select", empresaId],
    queryFn: async () => { const { data } = await supabase.from("clientes").select("id, nome").eq("deletado", false).order("nome"); return data ?? []; },
    enabled: !!empresaId,
  });
  const { data: projetos } = useQuery({
    queryKey: ["projetos_select", empresaId],
    queryFn: async () => { const { data } = await supabase.from("projetos").select("id, nome").eq("deletado", false).order("nome"); return data ?? []; },
    enabled: !!empresaId,
  });

  const resetForm = () => { setDesc(""); setValor(0); setVencimento(""); setParcela(1); setClienteId(""); setProjetoId(""); setEditId(null); setShowForm(false); };

  const openEdit = (c: any) => {
    setEditId(c.id); setDesc(c.descricao ?? ""); setValor(c.valor ?? 0); setVencimento(c.data_vencimento ?? ""); setParcela(c.parcela ?? 1); setClienteId(c.cliente_id ?? ""); setProjetoId(c.projeto_id ?? ""); setShowForm(true);
  };

  const handleSave = async () => {
    if (!isNotEmpty(desc, "Descrição")) return;
    if (!isPositiveNumber(valor, "Valor")) return;
    try {
      if (editId) {
        await updateConta.mutateAsync({ id: editId, descricao: desc, valor, data_vencimento: vencimento || null, parcela, cliente_id: clienteId || null, projeto_id: projetoId || null });
        toast.success("Parcela atualizada");
      } else {
        await createConta.mutateAsync({ descricao: desc, valor, data_vencimento: vencimento || null, parcela, status: "pendente", cliente_id: clienteId || null, projeto_id: projetoId || null });
        toast.success("Parcela adicionada");
      }
      resetForm();
    } catch (err: any) { toast.error(err.message); }
  };

  const openBaixa = async (id: string) => {
    const conta = (contas ?? []).find((c: any) => c.id === id);
    setBaixaId(id);
    setBaixaContaAtual(conta);
    setBaixaData(new Date().toISOString().split("T")[0]);
    setBaixaForma("");
    setBaixaObs("");
    const totalConta = Number(conta?.valor) || 0;
    const jaRecebido = Number((conta as any)?.valor_recebido) || 0;
    setBaixaValor(Math.max(totalConta - jaRecebido, 0));
    setShowBaixa(true);
    // Load history
    const { data } = await supabase
      .from("recebimentos_parciais" as any)
      .select("*")
      .eq("financeiro_receber_id", id)
      .order("data", { ascending: true });
    setHistoricoReceb((data as any[]) ?? []);
  };

  const handleBaixa = async () => {
    if (!baixaId || !baixaContaAtual || !empresaId) return;
    const valorRec = Number(baixaValor) || 0;
    if (valorRec <= 0) { toast.error("Informe um valor maior que zero"); return; }
    const totalConta = Number(baixaContaAtual.valor) || 0;
    const jaRecebido = Number(baixaContaAtual.valor_recebido) || 0;
    const novoAcumulado = jaRecebido + valorRec;
    if (novoAcumulado > totalConta + 0.001) {
      if (!window.confirm(`Valor excede o saldo restante (${fmtBRL(totalConta - jaRecebido)}). Deseja continuar?`)) return;
    }
    try {
      // Insert history record
      const { error: histErr } = await supabase
        .from("recebimentos_parciais" as any)
        .insert({
          empresa_id: empresaId,
          financeiro_receber_id: baixaId,
          valor: valorRec,
          data: baixaData,
          observacao: baixaForma ? `Forma: ${baixaForma}${baixaObs ? ` | ${baixaObs}` : ""}` : (baixaObs || null),
        } as any);
      if (histErr) throw histErr;

      // Determine new status
      let novoStatus: "pago" | "parcial" | "pendente" = "pendente";
      if (novoAcumulado >= totalConta) novoStatus = "pago";
      else if (novoAcumulado > 0) novoStatus = "parcial";

      await updateConta.mutateAsync({
        id: baixaId,
        status: novoStatus as any,
        valor_recebido: novoAcumulado as any,
        data_pagamento: novoStatus === "pago" ? baixaData : (baixaContaAtual.data_pagamento ?? null),
      } as any);

      toast.success(novoStatus === "pago" ? "Totalmente recebido!" : "Recebimento parcial registrado");
      setShowBaixa(false);
    } catch (err: any) { toast.error(err.message); }
  };

  const remove = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("financeiro_receber").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["financeiro_receber"] }); toast.success("Parcela excluída"); },
    onError: (err: any) => toast.error(err.message),
  });

  // Conta vencida: pendente/parcial, com vencimento passado e saldo restante > 0
    const filtered = useMemo(() => {
      let list = contas ?? [];
      
      // Common date and search filters first
      list = applyDateFilter(list, "data_vencimento", periodoFilter, mesFilter, anoFilter);
      if (dataInicio) {
        list = list.filter(c => c.data_vencimento && c.data_vencimento >= dataInicio);
      }
      if (dataFim) {
        list = list.filter(c => c.data_vencimento && c.data_vencimento <= dataFim);
      }
      if (buscaFilter.trim()) {
        const q = buscaFilter.trim().toLowerCase();
        list = list.filter(c => {
          const nome = ((c.clientes as any)?.nome ?? (c.projetos as any)?.nome ?? "").toLowerCase();
          const desc = (c.descricao ?? "").toLowerCase();
          return nome.includes(q) || desc.includes(q);
        });
      }

      const hoje = new Date(new Date().toDateString());

      // Totals calculation based on the list already filtered by date/search
      let totAReceber = 0;
      let totInadimplente = 0;
      let totRecebido = 0;

      if (statusFilter === "") {
        list.forEach(c => {
          if (c.status === "pago") {
            totRecebido += (Number((c as any).valor_recebido) || (Number(c.valor) || 0));
          } else if (c.status !== "cancelado") {
            const saldo = Math.max((Number(c.valor) || 0) - (Number((c as any).valor_recebido) || 0), 0);
            if (saldo > 0) {
              const venc = c.data_vencimento ? new Date(c.data_vencimento) : null;
              if (!venc || venc >= hoje) {
                totAReceber += saldo;
              } else {
                totInadimplente += saldo;
              }
            }
            // Add received part of partials to total received
            totRecebido += (Number((c as any).valor_recebido) || 0);
          }
        });
      }

      // Now apply the status filter to the list
      if (statusFilter === "pendente") {
        list = list.filter(c => {
          if (c.status === "pago" || c.status === "cancelado") return false;
          const saldo = Math.max((Number(c.valor) || 0) - (Number((c as any).valor_recebido) || 0), 0);
          if (saldo <= 0) return false;
          if (!c.data_vencimento) return true;
          return new Date(c.data_vencimento) >= hoje;
        });
        totAReceber = list.reduce((s, c) => s + Math.max((Number(c.valor) || 0) - (Number((c as any).valor_recebido) || 0), 0), 0);
      } else if (statusFilter === "vencido") {
        list = list.filter(c => {
          if (c.status === "pago" || c.status === "cancelado") return false;
          const saldo = Math.max((Number(c.valor) || 0) - (Number((c as any).valor_recebido) || 0), 0);
          if (saldo <= 0) return false;
          return c.data_vencimento && new Date(c.data_vencimento) < hoje;
        });
        totInadimplente = list.reduce((s, c) => s + Math.max((Number(c.valor) || 0) - (Number((c as any).valor_recebido) || 0), 0), 0);
      } else if (statusFilter === "pago") {
        list = list.filter(c => c.status === "pago");
        totRecebido = list.reduce((s, c) => s + (Number((c as any).valor_recebido) || (Number(c.valor) || 0)), 0);
      } else if (statusFilter === "parcial") {
        list = list.filter(c => c.status === "parcial");
        // For parcial/cancelado, the user asked to show just 1 card with total of filtered.
        // We'll put it in totAReceber for visual consistency if needed, or follow the rule:
        // "Mostrar apenas 1 card com o total do filtered - Os outros dois ficam R$ 0,00"
        totAReceber = list.reduce((s, c) => s + Math.max((Number(c.valor) || 0) - (Number((c as any).valor_recebido) || 0), 0), 0);
      } else if (statusFilter === "cancelado") {
        list = list.filter(c => c.status === "cancelado");
        totAReceber = list.reduce((s, c) => s + (Number(c.valor) || 0), 0);
      }

      // Use a side effect-free way to update state or just return them
      // Since useMemo should be pure, we'll return both.
      return { list, totals: { aReceber: totAReceber, inadimplente: totInadimplente, recebido: totRecebido } };
    }, [contas, statusFilter, periodoFilter, mesFilter, anoFilter, buscaFilter, dataInicio, dataFim]);

    const { list: filteredContas, totals } = filtered;

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <DollarSign size={18} className="text-success" />
          <h1 className="text-lg font-bold text-foreground">Contas a Receber</h1>
        </div>
        <button onClick={() => { resetForm(); setShowForm(true); }} className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-primary text-primary-foreground text-xs font-medium hover:brightness-105 transition btn-press">
          <Plus size={14} /> Nova Parcela
        </button>
      </div>

      {/* Filters */}
      <FinanceiroFilters
        statusOptions={STATUS_OPTIONS}
        statusFilter={statusFilter}
        onStatusChange={setStatusFilter}
        periodoFilter={periodoFilter}
        onPeriodoChange={setPeriodoFilter}
        mesFilter={mesFilter}
        onMesChange={setMesFilter}
        anoFilter={anoFilter}
        onAnoChange={setAnoFilter}
          extraFilters={
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 flex-1">
              <div className="relative flex-1 w-full max-w-sm">
                <Search size={13} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  value={buscaFilter}
                  onChange={e => setBuscaFilter(e.target.value)}
                  placeholder="Buscar por cliente ou descrição..."
                  className="h-7 w-full pl-7 px-2 text-[11px] bg-background border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-muted-foreground">De:</span>
                  <input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} className="h-7 px-1.5 text-[10px] bg-background border border-border rounded" />
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-muted-foreground">Até:</span>
                  <input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} className="h-7 px-1.5 text-[10px] bg-background border border-border rounded" />
                </div>
                {(dataInicio || dataFim) && (
                  <button 
                    onClick={() => { setDataInicio(""); setDataFim(""); }}
                    className="h-7 px-2 text-[10px] font-medium text-destructive hover:bg-destructive/10 rounded border border-destructive/20 transition-colors"
                  >
                    Limpar
                  </button>
                )}
              </div>
            </div>
          }
       />

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-2">
        {(statusFilter === "" || statusFilter === "pendente" || statusFilter === "vencido" || statusFilter === "pago") ? (
          <>
            <div className="bg-card border border-border rounded-lg p-3 text-center">
              <div className="text-lg font-bold text-warning">{fmtBRL(totals.aReceber)}</div>
              <div className="text-[11px] text-muted-foreground">A Receber</div>
            </div>
            <div className="bg-card border border-border rounded-lg p-3 text-center">
              <div className="text-lg font-bold text-destructive">{fmtBRL(totals.inadimplente)}</div>
              <div className="text-[11px] text-muted-foreground">Inadimplente</div>
            </div>
            <div className="bg-card border border-border rounded-lg p-3 text-center">
              <div className="text-lg font-bold text-success">{fmtBRL(totals.recebido)}</div>
              <div className="text-[11px] text-muted-foreground">Recebido</div>
            </div>
          </>
        ) : (
          <div className="col-span-3 bg-card border border-border rounded-lg p-3 text-center">
            <div className="text-lg font-bold text-primary">{fmtBRL(totals.aReceber)}</div>
            <div className="text-[11px] text-muted-foreground">Total {recStatusLabel(statusFilter)}</div>
          </div>
        )}
      </div>

      {showForm && (
        <div className="bg-card border border-border rounded-lg p-4 space-y-3">
          <h2 className="text-xs font-semibold text-foreground">{editId ? "Editar" : "Nova"} Parcela</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="space-y-1 col-span-2"><label className="text-[11px] text-muted-foreground">Descrição</label><input value={desc} onChange={e => setDesc(e.target.value)} className="w-full h-8 px-2 text-xs bg-background border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary" /></div>
            <div className="space-y-1"><label className="text-[11px] text-muted-foreground">Valor</label><input type="number" value={valor} onChange={e => setValor(Number(e.target.value))} className="w-full h-8 px-2 text-xs bg-background border border-border rounded focus:outline-none" /></div>
            <div className="space-y-1"><label className="text-[11px] text-muted-foreground">Parcela</label><input type="number" value={parcela} onChange={e => setParcela(Number(e.target.value))} className="w-full h-8 px-2 text-xs bg-background border border-border rounded focus:outline-none" /></div>
            <div className="space-y-1"><label className="text-[11px] text-muted-foreground">Vencimento</label><input type="date" value={vencimento} onChange={e => setVencimento(e.target.value)} className="w-full h-8 px-2 text-xs bg-background border border-border rounded focus:outline-none" /></div>
            <div className="space-y-1"><label className="text-[11px] text-muted-foreground">Cliente</label>
              <select value={clienteId} onChange={e => setClienteId(e.target.value)} className="w-full h-8 px-2 text-xs bg-background border border-border rounded focus:outline-none">
                <option value="">Selecionar...</option>
                {clientesList?.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </div>
            <div className="space-y-1"><label className="text-[11px] text-muted-foreground">Projeto</label>
              <select value={projetoId} onChange={e => setProjetoId(e.target.value)} className="w-full h-8 px-2 text-xs bg-background border border-border rounded focus:outline-none">
                <option value="">Selecionar...</option>
                {projetos?.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleSave} disabled={createConta.isPending || updateConta.isPending} className="px-4 py-1.5 rounded bg-primary text-primary-foreground text-xs font-medium hover:brightness-105 disabled:opacity-50 btn-press">Salvar</button>
            <button onClick={resetForm} className="px-4 py-1.5 rounded bg-secondary text-secondary-foreground text-xs font-medium hover:bg-secondary/80 btn-press">Cancelar</button>
          </div>
        </div>
      )}

      {isLoading ? <p className="text-xs text-muted-foreground text-center py-8">Carregando...</p> : (
        <div className="border border-border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
             <table className="w-full text-xs">
              <thead>
                <tr className="bg-muted/30">
                  <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground border-b border-border whitespace-nowrap">Cliente</th>
                  <th className="text-center px-3 py-2.5 font-semibold text-muted-foreground border-b border-border whitespace-nowrap">Parcela</th>
                  <th className="text-right px-3 py-2.5 font-semibold text-muted-foreground border-b border-border whitespace-nowrap">Valor</th>
                  <th className="text-center px-3 py-2.5 font-semibold text-muted-foreground border-b border-border whitespace-nowrap">Vencimento</th>
                  <th className="text-center px-3 py-2.5 font-semibold text-muted-foreground border-b border-border whitespace-nowrap">Recebido</th>
                  <th className="text-center px-3 py-2.5 font-semibold text-muted-foreground border-b border-border whitespace-nowrap">Status</th>
                  <th className="text-center px-3 py-2.5 font-semibold text-muted-foreground border-b border-border whitespace-nowrap w-24">Ações</th>
                </tr>
              </thead>
               <tbody>
                 {filteredContas.map(c => {
                  const clienteNome = (c.clientes as any)?.nome ?? (c.projetos as any)?.nome ?? "—";
                  // Calculate total parcelas for this project to display X/Y format
                  const totalParcelas = c.projeto_id
                    ? (contas ?? []).filter(r => r.projeto_id === c.projeto_id).length
                    : 1;
                  const parcelaLabel = `${c.parcela ?? 1}/${totalParcelas || 1}`;
                  return (
                    <tr
                      key={c.id}
                      className={`border-b border-border last:border-b-0 hover:bg-secondary/30 cursor-pointer transition-colors ${rowHighlightClass(c.data_vencimento, c.status)}`}
                      onClick={() => openEdit(c)}
                    >
                      <td className="px-3 py-2 font-medium text-foreground max-w-[200px] truncate">{clienteNome}</td>
                      <td className="px-3 py-2 text-center text-muted-foreground font-medium">{parcelaLabel}</td>
                      <td className="px-3 py-2 text-right font-bold text-foreground tabular-nums">{fmtBRL(c.valor ?? 0)}</td>
                      <td className="px-3 py-2 text-center text-foreground/80 tabular-nums">{fmtDate(c.data_vencimento)}</td>
                      <td className="px-3 py-2 text-center tabular-nums">
                        {(() => {
                          const total = Number(c.valor) || 0;
                          const recebido = Number((c as any).valor_recebido) || 0;
                          if (recebido > 0) {
                            if (recebido >= total) return <span className="text-success font-medium">{fmtBRL(recebido)}</span>;
                            return (
                              <span className="text-info font-medium">
                                {fmtBRL(recebido)}
                                <span className="text-[10px] text-muted-foreground ml-1">/ falta {fmtBRL(total - recebido)}</span>
                              </span>
                            );
                          }
                          if (c.status === "pago" && recebido === 0) {
                            return <span className="text-success font-medium">{fmtBRL(total)}</span>;
                          }
                          return <span className="text-muted-foreground">—</span>;
                        })()}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {(() => {
                          const label = recStatusLabel(c.status ?? "pendente");
                          return (
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold ${recStatusBadgeClass(label)}`}>
                              {label}
                            </span>
                          );
                        })()}
                      </td>
                      <td className="px-3 py-2 text-center" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-0.5">
                          {c.status !== "pago" && c.status !== "cancelado" && (
                            <button onClick={() => openBaixa(c.id)} title="Registrar recebimento" className="p-1.5 rounded-md hover:bg-success/15 text-muted-foreground hover:text-success transition-colors">
                              <Check size={14} />
                            </button>
                          )}
                          <button onClick={() => setDetailConta(c)} title="Ver detalhes" className="p-1.5 rounded-md hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors">
                            <Search size={14} />
                          </button>
                          <button onClick={() => openEdit(c)} title="Editar" className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground hover:text-primary transition-colors">
                            <Pencil size={14} />
                          </button>
                          <button onClick={() => { if (window.confirm("Excluir parcela?")) remove.mutate(c.id); }} title="Excluir" className="p-1.5 rounded-md hover:bg-destructive/15 text-muted-foreground hover:text-destructive transition-colors">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && <tr><td colSpan={7} className="text-center py-8 text-muted-foreground">Nenhuma conta encontrada.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Detail Panel */}
      <FinanceiroDetailPanel
        open={!!detailConta}
        onOpenChange={(o) => { if (!o) setDetailConta(null); }}
        tipo="receber"
        conta={detailConta}
        clienteNome={(detailConta?.clientes as any)?.nome ?? (detailConta?.projetos as any)?.nome ?? "—"}
        projetoNome={(detailConta?.projetos as any)?.nome ?? "—"}
        parcelaLabel={detailConta ? `${detailConta.parcela ?? 1}/${detailConta.projeto_id ? (contas ?? []).filter(r => r.projeto_id === detailConta.projeto_id).length || 1 : 1}` : undefined}
        onBaixa={() => detailConta && openBaixa(detailConta.id)}
        onEdit={() => detailConta && openEdit(detailConta)}
        onDelete={() => detailConta && remove.mutate(detailConta.id)}
      />

      <Dialog open={showBaixa} onOpenChange={setShowBaixa}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="text-sm">Registrar Recebimento</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {baixaContaAtual && (() => {
              const total = Number(baixaContaAtual.valor) || 0;
              const recebido = Number(baixaContaAtual.valor_recebido) || 0;
              const saldo = Math.max(total - recebido, 0);
              return (
                <div className="grid grid-cols-3 gap-2 p-2 bg-muted/30 rounded">
                  <div className="text-center">
                    <div className="text-[10px] text-muted-foreground uppercase">Total</div>
                    <div className="text-xs font-bold text-foreground tabular-nums">{fmtBRL(total)}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-[10px] text-muted-foreground uppercase">Recebido</div>
                    <div className="text-xs font-bold text-success tabular-nums">{fmtBRL(recebido)}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-[10px] text-muted-foreground uppercase">Falta</div>
                    <div className="text-xs font-bold text-warning tabular-nums">{fmtBRL(saldo)}</div>
                  </div>
                </div>
              );
            })()}
            <div className="space-y-1">
              <label className="text-[11px] text-muted-foreground">Valor do recebimento</label>
              <input type="number" step="0.01" value={baixaValor} onChange={e => setBaixaValor(Number(e.target.value))} className="w-full h-8 px-2 text-xs bg-background border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
            <div className="space-y-1"><label className="text-[11px] text-muted-foreground">Data Recebimento</label><input type="date" value={baixaData} onChange={e => setBaixaData(e.target.value)} className="w-full h-8 px-2 text-xs bg-background border border-border rounded" /></div>
            <div className="space-y-1"><label className="text-[11px] text-muted-foreground">Forma de Pagamento</label>
              <select value={baixaForma} onChange={e => setBaixaForma(e.target.value)} className="w-full h-8 px-2 text-xs bg-background border border-border rounded">
                <option value="">Selecionar...</option>
                {formasPgto?.map(f => <option key={f.id} value={f.nome}>{f.nome}</option>)}
                <option value="Pix">Pix</option><option value="Boleto">Boleto</option><option value="Transferência">Transferência</option>
              </select>
            </div>
            <div className="space-y-1"><label className="text-[11px] text-muted-foreground">Observação</label><input value={baixaObs} onChange={e => setBaixaObs(e.target.value)} className="w-full h-8 px-2 text-xs bg-background border border-border rounded" /></div>
            {historicoReceb.length > 0 && (
              <div className="space-y-1">
                <div className="text-[11px] text-muted-foreground uppercase tracking-wider">Histórico de recebimentos</div>
                <div className="max-h-32 overflow-y-auto border border-border rounded">
                  <table className="w-full text-[11px]">
                    <tbody>
                      {historicoReceb.map((h: any) => (
                        <tr key={h.id} className="border-b border-border last:border-b-0">
                          <td className="px-2 py-1 text-foreground/80 tabular-nums">{fmtDate(h.data)}</td>
                          <td className="px-2 py-1 text-right font-medium text-success tabular-nums">{fmtBRL(Number(h.valor) || 0)}</td>
                          <td className="px-2 py-1 text-muted-foreground truncate max-w-[140px]">{h.observacao ?? ""}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <button onClick={() => setShowBaixa(false)} className="px-3 py-1.5 text-xs rounded bg-secondary text-secondary-foreground">Cancelar</button>
            <button onClick={handleBaixa} className="px-3 py-1.5 text-xs rounded bg-primary text-primary-foreground">Confirmar Recebimento</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FinanceiroReceber;
