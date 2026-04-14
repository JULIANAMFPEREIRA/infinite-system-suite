import { useState, useMemo } from "react";
import { DollarSign, Plus, Check, Pencil, Trash2 } from "lucide-react";
import { isNotEmpty, isPositiveNumber } from "@/lib/validations";
import { useFinanceiroPagar, useCreateContaPagar, useUpdateContaPagar } from "@/hooks/useFinanceiro";
import { useFormasPagamento } from "@/hooks/useCategorias";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/hooks/useEmpresa";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { fmtBRL, fmtDate, statusBadgeClass, statusLabel, rowHighlightClass } from "@/lib/financeiroUtils";
import FinanceiroFilters, { applyDateFilter } from "@/components/financeiro/FinanceiroFilters";

const STATUS_OPTIONS = [
  { value: "", label: "Todos status" },
  { value: "pendente", label: "Pendente" },
  { value: "pago", label: "Pago" },
  { value: "vencido", label: "Vencido" },
  { value: "cancelado", label: "Cancelado" },
];

const TIPO_OPTIONS = [
  { value: "", label: "Todos tipos" },
  { value: "imposto", label: "Imposto" },
  { value: "frete", label: "Frete" },
  { value: "produto", label: "Produto" },
  { value: "servico", label: "Serviço" },
  { value: "adicional", label: "Adicional" },
];

/** Infer the type from the description text */
const inferTipo = (desc: string | null): string => {
  if (!desc) return "";
  const d = desc.toLowerCase();
  if (d.includes("imposto") || d.includes("taxa") || d.includes("tributo")) return "imposto";
  if (d.includes("frete") || d.includes("transporte") || d.includes("entrega")) return "frete";
  if (d.includes("serviço") || d.includes("servico") || d.includes("mão de obra") || d.includes("mao de obra") || d.includes("instalação") || d.includes("instalacao")) return "servico";
  if (d.includes("adicional")) return "adicional";
  return "produto";
};

const tipoBadge = (desc: string | null) => {
  const tipo = inferTipo(desc);
  const map: Record<string, { label: string; cls: string }> = {
    imposto: { label: "Imposto", cls: "bg-orange-500/10 text-orange-600 border-orange-500/20" },
    frete: { label: "Frete", cls: "bg-blue-500/10 text-blue-600 border-blue-500/20" },
    servico: { label: "Serviço", cls: "bg-purple-500/10 text-purple-600 border-purple-500/20" },
    adicional: { label: "Adicional", cls: "bg-teal-500/10 text-teal-600 border-teal-500/20" },
    produto: { label: "Produto", cls: "bg-secondary text-muted-foreground border-border" },
  };
  const { label, cls } = map[tipo] ?? map.produto;
  return <span className={`inline-flex px-1.5 py-0 rounded text-[9px] font-medium border ${cls}`}>{label}</span>;
};

const FinanceiroPagar = () => {
  const empresaId = useEmpresa();
  const qc = useQueryClient();
  const { data: contas, isLoading } = useFinanceiroPagar();
  const createConta = useCreateContaPagar();
  const updateConta = useUpdateContaPagar();
  const { data: formasPgto } = useFormasPagamento();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [desc, setDesc] = useState("");
  const [valor, setValor] = useState(0);
  const [vencimento, setVencimento] = useState("");
  const [fornecedorId, setFornecedorId] = useState("");
  const [projetoId, setProjetoId] = useState("");

  const [showBaixa, setShowBaixa] = useState(false);
  const [baixaId, setBaixaId] = useState<string | null>(null);
  const [baixaData, setBaixaData] = useState(new Date().toISOString().split("T")[0]);
  const [baixaForma, setBaixaForma] = useState("");
  const [baixaObs, setBaixaObs] = useState("");

  // Filters
  const [statusFilter, setStatusFilter] = useState("");
  const [periodoFilter, setPeriodoFilter] = useState("");
  const [mesFilter, setMesFilter] = useState("");
  const [anoFilter, setAnoFilter] = useState("");
  const [tipoFilter, setTipoFilter] = useState("");

  const { data: fornecedores } = useQuery({
    queryKey: ["fornecedores", empresaId],
    queryFn: async () => { const { data } = await supabase.from("fornecedores").select("id, nome").eq("deletado", false).order("nome"); return data ?? []; },
    enabled: !!empresaId,
  });
  const { data: projetos } = useQuery({
    queryKey: ["projetos_select", empresaId],
    queryFn: async () => { const { data } = await supabase.from("projetos").select("id, nome").eq("deletado", false).order("nome"); return data ?? []; },
    enabled: !!empresaId,
  });

  const resetForm = () => { setDesc(""); setValor(0); setVencimento(""); setFornecedorId(""); setProjetoId(""); setEditId(null); setShowForm(false); };

  const openEdit = (c: any) => {
    setEditId(c.id); setDesc(c.descricao ?? ""); setValor(c.valor ?? 0); setVencimento(c.data_vencimento ?? ""); setFornecedorId(c.fornecedor_id ?? ""); setProjetoId(c.projeto_id ?? ""); setShowForm(true);
  };

  const handleSave = async () => {
    if (!isNotEmpty(desc, "Descrição")) return;
    if (!isPositiveNumber(valor, "Valor")) return;
    try {
      if (editId) {
        await updateConta.mutateAsync({ id: editId, descricao: desc, valor, data_vencimento: vencimento || null, fornecedor_id: fornecedorId || null, projeto_id: projetoId || null });
        toast.success("Conta atualizada");
      } else {
        await createConta.mutateAsync({ descricao: desc, valor, data_vencimento: vencimento || null, status: "pendente", fornecedor_id: fornecedorId || null, projeto_id: projetoId || null });
        toast.success("Conta adicionada");
      }
      resetForm();
    } catch (err: any) { toast.error(err.message); }
  };

  const openBaixa = (id: string) => {
    setBaixaId(id); setBaixaData(new Date().toISOString().split("T")[0]); setBaixaForma(""); setBaixaObs(""); setShowBaixa(true);
  };

  const handleBaixa = async () => {
    if (!baixaId) return;
    try {
      await updateConta.mutateAsync({ id: baixaId, status: "pago", data_pagamento: baixaData });
      toast.success("Pago!");
      setShowBaixa(false);
    } catch (err: any) { toast.error(err.message); }
  };

  const remove = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("financeiro_pagar").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["financeiro_pagar"] }); toast.success("Conta excluída"); },
    onError: (err: any) => toast.error(err.message),
  });

  // Filtered data
  const filtered = useMemo(() => {
    let list = contas ?? [];
    if (statusFilter) list = list.filter(c => c.status === statusFilter);
    if (tipoFilter) list = list.filter(c => inferTipo(c.descricao) === tipoFilter);
    list = applyDateFilter(list, "data_vencimento", periodoFilter, mesFilter, anoFilter);
    return list;
  }, [contas, statusFilter, tipoFilter, periodoFilter, mesFilter, anoFilter]);

  // Summary
  const totalPendente = filtered.filter(c => c.status === "pendente").reduce((s, c) => s + (c.valor ?? 0), 0);
  const totalPago = filtered.filter(c => c.status === "pago").reduce((s, c) => s + (c.valor ?? 0), 0);
  const totalVencido = filtered.filter(c => c.status === "vencido").reduce((s, c) => s + (c.valor ?? 0), 0);

  const selectCls = "h-7 px-2 text-[11px] bg-background border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary";

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <DollarSign size={18} className="text-destructive" />
          <h1 className="text-lg font-bold text-foreground">Contas a Pagar</h1>
        </div>
        <button onClick={() => { resetForm(); setShowForm(true); }} className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-primary text-primary-foreground text-xs font-medium hover:brightness-105 transition btn-press">
          <Plus size={14} /> Nova Conta
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
          <select value={tipoFilter} onChange={e => setTipoFilter(e.target.value)} className={selectCls}>
            {TIPO_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        }
      />

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-card border border-border rounded-lg p-3 text-center">
          <div className="text-lg font-bold text-warning">{fmtBRL(totalPendente)}</div>
          <div className="text-[11px] text-muted-foreground">Pendente</div>
        </div>
        <div className="bg-card border border-border rounded-lg p-3 text-center">
          <div className="text-lg font-bold text-destructive">{fmtBRL(totalVencido)}</div>
          <div className="text-[11px] text-muted-foreground">Vencido</div>
        </div>
        <div className="bg-card border border-border rounded-lg p-3 text-center">
          <div className="text-lg font-bold text-success">{fmtBRL(totalPago)}</div>
          <div className="text-[11px] text-muted-foreground">Pago</div>
        </div>
      </div>

      {showForm && (
        <div className="bg-card border border-border rounded-lg p-4 space-y-3">
          <h2 className="text-xs font-semibold text-foreground">{editId ? "Editar" : "Nova"} Conta a Pagar</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="space-y-1 col-span-2"><label className="text-[11px] text-muted-foreground">Descrição</label><input value={desc} onChange={e => setDesc(e.target.value)} className="w-full h-8 px-2 text-xs bg-background border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary" /></div>
            <div className="space-y-1"><label className="text-[11px] text-muted-foreground">Valor</label><input type="number" value={valor} onChange={e => setValor(Number(e.target.value))} className="w-full h-8 px-2 text-xs bg-background border border-border rounded focus:outline-none" /></div>
            <div className="space-y-1"><label className="text-[11px] text-muted-foreground">Vencimento</label><input type="date" value={vencimento} onChange={e => setVencimento(e.target.value)} className="w-full h-8 px-2 text-xs bg-background border border-border rounded focus:outline-none" /></div>
            <div className="space-y-1"><label className="text-[11px] text-muted-foreground">Fornecedor</label>
              <select value={fornecedorId} onChange={e => setFornecedorId(e.target.value)} className="w-full h-8 px-2 text-xs bg-background border border-border rounded focus:outline-none">
                <option value="">Selecionar...</option>
                {fornecedores?.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
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
                  <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground border-b border-border whitespace-nowrap">Descrição</th>
                  <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground border-b border-border whitespace-nowrap">Fornecedor</th>
                  <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground border-b border-border whitespace-nowrap">Projeto</th>
                  <th className="text-right px-3 py-2.5 font-semibold text-muted-foreground border-b border-border whitespace-nowrap">Valor</th>
                  <th className="text-center px-3 py-2.5 font-semibold text-muted-foreground border-b border-border whitespace-nowrap">Vencimento</th>
                  <th className="text-center px-3 py-2.5 font-semibold text-muted-foreground border-b border-border whitespace-nowrap">Pago</th>
                  <th className="text-center px-3 py-2.5 font-semibold text-muted-foreground border-b border-border whitespace-nowrap">Status</th>
                  <th className="text-center px-3 py-2.5 font-semibold text-muted-foreground border-b border-border whitespace-nowrap w-24">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => (
                  <tr
                    key={c.id}
                    className={`border-b border-border last:border-b-0 hover:bg-secondary/30 cursor-pointer transition-colors ${rowHighlightClass(c.data_vencimento, c.status)}`}
                    onClick={() => openEdit(c)}
                  >
                    <td className="px-3 py-2 max-w-[220px]">
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium text-foreground truncate">{c.descricao}</span>
                        {tipoBadge(c.descricao)}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-foreground/80 max-w-[150px] truncate">{(c.fornecedores as any)?.nome ?? "—"}</td>
                    <td className="px-3 py-2 text-foreground/80 max-w-[150px] truncate">{(c.projetos as any)?.nome ?? "—"}</td>
                    <td className="px-3 py-2 text-right font-bold text-foreground tabular-nums">{fmtBRL(c.valor ?? 0)}</td>
                    <td className="px-3 py-2 text-center text-foreground/80 tabular-nums">{fmtDate(c.data_vencimento)}</td>
                    <td className="px-3 py-2 text-center text-foreground/80 tabular-nums">{c.data_pagamento ? fmtDate(c.data_pagamento) : "—"}</td>
                    <td className="px-3 py-2 text-center">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold ${statusBadgeClass(c.status ?? "pendente")}`}>
                        {statusLabel(c.status ?? "pendente")}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-center" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center justify-center gap-0.5">
                        {c.status === "pendente" && (
                          <button onClick={() => openBaixa(c.id)} title="Registrar pagamento" className="p-1.5 rounded-md hover:bg-success/15 text-muted-foreground hover:text-success transition-colors">
                            <Check size={14} />
                          </button>
                        )}
                        <button onClick={() => openEdit(c)} title="Editar" className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground hover:text-primary transition-colors">
                          <Pencil size={14} />
                        </button>
                        <button onClick={() => { if (window.confirm("Excluir conta?")) remove.mutate(c.id); }} title="Excluir" className="p-1.5 rounded-md hover:bg-destructive/15 text-muted-foreground hover:text-destructive transition-colors">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && <tr><td colSpan={8} className="text-center py-8 text-muted-foreground">Nenhuma conta encontrada.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Dialog open={showBaixa} onOpenChange={setShowBaixa}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="text-sm">Registrar Pagamento</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><label className="text-[11px] text-muted-foreground">Data Pagamento</label><input type="date" value={baixaData} onChange={e => setBaixaData(e.target.value)} className="w-full h-8 px-2 text-xs bg-background border border-border rounded" /></div>
            <div className="space-y-1"><label className="text-[11px] text-muted-foreground">Forma de Pagamento</label>
              <select value={baixaForma} onChange={e => setBaixaForma(e.target.value)} className="w-full h-8 px-2 text-xs bg-background border border-border rounded">
                <option value="">Selecionar...</option>
                {formasPgto?.map(f => <option key={f.id} value={f.nome}>{f.nome}</option>)}
                <option value="Pix">Pix</option><option value="Boleto">Boleto</option><option value="Transferência">Transferência</option>
              </select>
            </div>
            <div className="space-y-1"><label className="text-[11px] text-muted-foreground">Observação</label><input value={baixaObs} onChange={e => setBaixaObs(e.target.value)} className="w-full h-8 px-2 text-xs bg-background border border-border rounded" /></div>
          </div>
          <DialogFooter>
            <button onClick={() => setShowBaixa(false)} className="px-3 py-1.5 text-xs rounded bg-secondary text-secondary-foreground">Cancelar</button>
            <button onClick={handleBaixa} className="px-3 py-1.5 text-xs rounded bg-primary text-primary-foreground">Confirmar Pagamento</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FinanceiroPagar;
