import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/hooks/useEmpresa";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, FileText, Eye, ArrowLeft, X } from "lucide-react";
import { fmtBRL } from "@/lib/financeiroUtils";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

type PedidoItem = {
  codigo?: string;
  descricao: string;
  ncm?: string;
  qtd: number;
  valor_unit: number;
  desconto: number;
};

const STATUS_OPTS = ["rascunho", "enviado", "confirmado", "cancelado"] as const;
const statusLabel = (s: string) => ({ rascunho: "Rascunho", enviado: "Enviado", confirmado: "Confirmado", cancelado: "Cancelado" } as Record<string, string>)[s] || s;
const statusColor = (s: string) => ({
  rascunho: "bg-muted text-muted-foreground",
  enviado: "bg-blue-500/20 text-blue-400 border border-blue-500/30",
  confirmado: "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30",
  cancelado: "bg-red-500/20 text-red-400 border border-red-500/30",
} as Record<string, string>)[s] || "bg-muted";

const inputCls = "w-full bg-background border border-border rounded-md px-3 py-1.5 text-[13px] focus:outline-none focus:ring-1 focus:ring-primary";
const labelCls = "block text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-1";

const fmtDate = (d?: string | null) => {
  if (!d) return "—";
  const dt = new Date(d + (d.length === 10 ? "T00:00:00" : ""));
  return dt.toLocaleDateString("pt-BR");
};

const PedidoCompra = () => {
  const empresaId = useEmpresa();
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [view, setView] = useState<"list" | "form">("list");
  const [editId, setEditId] = useState<string | null>(null);

  const { data: pedidos, isLoading } = useQuery({
    queryKey: ["pedidos_compra", empresaId],
    queryFn: async () => {
      const [pRes, fRes] = await Promise.all([
        supabase.from("pedidos_compra" as any).select("*").order("numero", { ascending: false }),
        supabase.from("fornecedores").select("id, nome"),
      ]);
      if (pRes.error) throw pRes.error;
      const fMap = Object.fromEntries((fRes.data ?? []).map((x: any) => [x.id, x.nome]));
      return (pRes.data as any[] ?? []).map(p => ({ ...p, fornecedor_nome: fMap[p.fornecedor_id] || "—" }));
    },
    enabled: !!empresaId,
  });

  const delMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("pedidos_compra" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Pedido excluído"); qc.invalidateQueries({ queryKey: ["pedidos_compra"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const openNew = () => { setEditId(null); setView("form"); };
  const openEdit = (id: string) => { setEditId(id); setView("form"); };

  if (view === "form") {
    return <PedidoForm id={editId} onClose={() => { setView("list"); setEditId(null); qc.invalidateQueries({ queryKey: ["pedidos_compra"] }); }} />;
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2"><FileText size={20} className="text-primary" /> Pedidos de Compra</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Emissão e gestão de pedidos para fornecedores</p>
        </div>
        <button onClick={openNew} className="bg-primary hover:bg-primary/90 text-primary-foreground px-3 py-1.5 rounded-md text-[13px] font-medium flex items-center gap-1.5">
          <Plus size={14} /> Novo Pedido
        </button>
      </div>

      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <table className="w-full text-[13px]">
          <thead className="bg-secondary/40 text-muted-foreground text-[11px] uppercase tracking-wide">
            <tr>
              <th className="px-3 py-2 text-left">Nº Pedido</th>
              <th className="px-3 py-2 text-left">Fornecedor</th>
              <th className="px-3 py-2 text-left">Data</th>
              <th className="px-3 py-2 text-right">Total</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={6} className="text-center py-8 text-muted-foreground">Carregando...</td></tr>
            ) : (pedidos ?? []).length === 0 ? (
              <tr><td colSpan={6} className="text-center py-8 text-muted-foreground">Nenhum pedido cadastrado</td></tr>
            ) : (pedidos ?? []).map((p: any) => (
              <tr key={p.id} className="border-t border-border hover:bg-secondary/20">
                <td className="px-3 py-2 font-semibold">#{p.numero}</td>
                <td className="px-3 py-2">{p.fornecedor_nome}</td>
                <td className="px-3 py-2">{fmtDate(p.data_pedido)}</td>
                <td className="px-3 py-2 text-right font-medium">{fmtBRL(Number(p.total || 0))}</td>
                <td className="px-3 py-2"><span className={`px-2 py-0.5 rounded text-[11px] ${statusColor(p.status)}`}>{statusLabel(p.status)}</span></td>
                <td className="px-3 py-2 text-right space-x-1">
                  <button onClick={() => openEdit(p.id)} className="p-1.5 hover:bg-secondary rounded" title="Ver/Editar"><Eye size={14} /></button>
                  <button onClick={() => openEdit(p.id)} className="p-1.5 hover:bg-secondary rounded" title="Editar"><Pencil size={14} /></button>
                  <button onClick={() => exportPedidoPDF(p.id, profile?.full_name || "Sistema")} className="p-1.5 hover:bg-secondary rounded text-primary" title="PDF"><FileText size={14} /></button>
                  <button onClick={() => { if (confirm(`Excluir pedido #${p.numero}?`)) delMut.mutate(p.id); }} className="p-1.5 hover:bg-secondary rounded text-red-400" title="Excluir"><Trash2 size={14} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ============ FORM ============
const PedidoForm = ({ id, onClose }: { id: string | null; onClose: () => void }) => {
  const empresaId = useEmpresa();
  const { profile } = useAuth();
  const qc = useQueryClient();

  const [numero, setNumero] = useState<number | null>(null);
  const [status, setStatus] = useState<string>("rascunho");
  const [dataPedido, setDataPedido] = useState(new Date().toISOString().slice(0, 10));
  const [fornecedorId, setFornecedorId] = useState("");
  const [condicaoPagamento, setCondicaoPagamento] = useState("");
  const [prazoEntrega, setPrazoEntrega] = useState("");
  const [transportadoraId, setTransportadoraId] = useState("");
  const [itens, setItens] = useState<PedidoItem[]>([{ descricao: "", qtd: 1, valor_unit: 0, desconto: 0 }]);
  const [frete, setFrete] = useState(0);
  const [descontoTotal, setDescontoTotal] = useState(0);
  const [ipi, setIpi] = useState(0);
  const [observacoes, setObservacoes] = useState("");
  const [localEntrega, setLocalEntrega] = useState("");
  const [responsavel, setResponsavel] = useState(profile?.full_name || "");

  const { data: fornecedores } = useQuery({
    queryKey: ["fornecedores_pc", empresaId],
    queryFn: async () => (await supabase.from("fornecedores").select("id, nome, tipo").eq("deletado", false).eq("tipo", "fornecedor").order("nome")).data ?? [],
    enabled: !!empresaId,
  });
  const { data: transportadoras } = useQuery({
    queryKey: ["transportadoras_pc", empresaId],
    queryFn: async () => {
      const q = await supabase.from("transportadoras").select("id, nome, ativo").order("nome");
      if (q.error) console.error("[PedidoCompra] transportadoras error:", q.error);
      return (q.data ?? []).filter((t: any) => t.ativo !== false);
    },
    enabled: !!empresaId,
  });
  const { data: produtos } = useQuery({
    queryKey: ["produtos_pc", empresaId],
    queryFn: async () => (await supabase.from("produtos").select("id, codigo, nome, preco_custo").eq("deletado", false).order("nome")).data ?? [],
    enabled: !!empresaId,
  });

  useEffect(() => {
    if (!id) return;
    (async () => {
      const { data, error } = await supabase.from("pedidos_compra" as any).select("*").eq("id", id).single();
      if (error || !data) return;
      const d: any = data;
      setNumero(d.numero);
      setStatus(d.status || "rascunho");
      setDataPedido(d.data_pedido || new Date().toISOString().slice(0, 10));
      setFornecedorId(d.fornecedor_id || "");
      setCondicaoPagamento(d.condicao_pagamento || "");
      setPrazoEntrega(d.prazo_entrega || "");
      setTransportadoraId(d.transportadora_id || "");
      setItens(Array.isArray(d.itens) && d.itens.length ? d.itens : [{ descricao: "", qtd: 1, valor_unit: 0, desconto: 0 }]);
      setFrete(Number(d.frete || 0));
      setDescontoTotal(Number(d.desconto_total || 0));
      setIpi(Number(d.ipi || 0));
      setObservacoes(d.observacoes || "");
      setLocalEntrega(d.local_entrega || "");
      setResponsavel(d.responsavel || profile?.full_name || "");
    })();
  }, [id, profile?.full_name]);

  const subtotal = useMemo(() => itens.reduce((sum, it) => sum + (Number(it.qtd) || 0) * (Number(it.valor_unit) || 0) - (Number(it.desconto) || 0), 0), [itens]);
  const totalGeral = subtotal + Number(frete || 0) + Number(ipi || 0) - Number(descontoTotal || 0);

  const updateItem = (idx: number, patch: Partial<PedidoItem>) => {
    setItens(prev => prev.map((it, i) => i === idx ? { ...it, ...patch } : it));
  };
  const addItem = () => setItens(prev => [...prev, { descricao: "", qtd: 1, valor_unit: 0, desconto: 0 }]);
  const removeItem = (idx: number) => setItens(prev => prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev);
  const pickProduto = (idx: number, prodId: string) => {
    const p: any = (produtos ?? []).find((x: any) => x.id === prodId);
    if (!p) return;
    updateItem(idx, { codigo: p.codigo || "", descricao: p.nome, valor_unit: Number(p.preco_custo || 0) });
  };

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!empresaId) throw new Error("Empresa não encontrada");
      const payload: any = {
        empresa_id: empresaId,
        fornecedor_id: fornecedorId || null,
        status,
        data_pedido: dataPedido,
        condicao_pagamento: condicaoPagamento || null,
        prazo_entrega: prazoEntrega || null,
        transportadora_id: transportadoraId || null,
        observacoes: observacoes || null,
        local_entrega: localEntrega || null,
        responsavel: responsavel || null,
        frete: Number(frete || 0),
        desconto_total: Number(descontoTotal || 0),
        ipi: Number(ipi || 0),
        total: Number(totalGeral || 0),
        itens,
      };
      if (id) {
        const { error } = await supabase.from("pedidos_compra" as any).update(payload).eq("id", id);
        if (error) throw error;
        return id;
      }
      const { data, error } = await supabase.from("pedidos_compra" as any).insert(payload).select().single();
      if (error) throw error;
      return (data as any).id as string;
    },
    onSuccess: () => { toast.success("Pedido salvo"); qc.invalidateQueries({ queryKey: ["pedidos_compra"] }); onClose(); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <button onClick={onClose} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft size={16} /> Voltar
        </button>
        <div className="flex items-center gap-2">
          {id && <button onClick={() => exportPedidoPDF(id, profile?.full_name || "Sistema")} className="border border-border hover:bg-secondary px-3 py-1.5 rounded-md text-[13px] flex items-center gap-1.5"><FileText size={14} /> Exportar PDF</button>}
          <button onClick={() => saveMut.mutate()} disabled={saveMut.isPending} className="bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-1.5 rounded-md text-[13px] font-medium">
            {saveMut.isPending ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>

      <div className="bg-card border border-border rounded-lg p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
          <h2 className="text-lg font-bold">Pedido de Compra {numero ? `#${numero}` : "(novo)"}</h2>
          <div className="grid grid-cols-2 gap-3 min-w-[280px]">
            <div>
              <label className={labelCls}>Data</label>
              <input type="date" className={inputCls} value={dataPedido} onChange={e => setDataPedido(e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Status</label>
              <select className={inputCls} value={status} onChange={e => setStatus(e.target.value)}>
                {STATUS_OPTS.map(s => <option key={s} value={s}>{statusLabel(s)}</option>)}
              </select>
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-[13px] font-semibold mb-2 text-muted-foreground uppercase tracking-wide">Dados do Fornecedor</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="md:col-span-2">
              <label className={labelCls}>Fornecedor</label>
              <select className={inputCls} value={fornecedorId} onChange={e => setFornecedorId(e.target.value)}>
                <option value="">Selecione...</option>
                {(fornecedores ?? []).map((f: any) => <option key={f.id} value={f.id}>{f.nome}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Condição de Pagamento</label>
              <input className={inputCls} value={condicaoPagamento} onChange={e => setCondicaoPagamento(e.target.value)} placeholder="Ex: 30/60/90" />
            </div>
            <div>
              <label className={labelCls}>Prazo de Entrega</label>
              <input className={inputCls} value={prazoEntrega} onChange={e => setPrazoEntrega(e.target.value)} placeholder="Ex: 15 dias" />
            </div>
            <div>
              <label className={labelCls}>Transportadora</label>
              <select className={inputCls} value={transportadoraId} onChange={e => setTransportadoraId(e.target.value)}>
                <option value="">—</option>
                {(transportadoras ?? []).map((t: any) => <option key={t.id} value={t.id}>{t.nome}</option>)}
              </select>
            </div>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-[13px] font-semibold text-muted-foreground uppercase tracking-wide">Itens</h3>
            <button onClick={addItem} className="text-[12px] flex items-center gap-1 text-primary hover:underline"><Plus size={12} /> Adicionar item</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead className="bg-secondary/40 text-muted-foreground text-[11px] uppercase">
                <tr>
                  <th className="px-2 py-1.5 text-left w-[110px]">Código</th>
                  <th className="px-2 py-1.5 text-left">Produto/Descrição</th>
                  <th className="px-2 py-1.5 text-left w-[90px]">NCM</th>
                  <th className="px-2 py-1.5 text-right w-[70px]">Qtd</th>
                  <th className="px-2 py-1.5 text-right w-[110px]">Valor Unit</th>
                  <th className="px-2 py-1.5 text-right w-[100px]">Desconto</th>
                  <th className="px-2 py-1.5 text-right w-[110px]">Total</th>
                  <th className="px-2 py-1.5 w-[40px]"></th>
                </tr>
              </thead>
              <tbody>
                {itens.map((it, idx) => {
                  const total = (Number(it.qtd) || 0) * (Number(it.valor_unit) || 0) - (Number(it.desconto) || 0);
                  return (
                    <tr key={idx} className="border-t border-border">
                      <td className="px-1 py-1"><input className={inputCls} value={it.codigo || ""} onChange={e => updateItem(idx, { codigo: e.target.value })} /></td>
                      <td className="px-1 py-1">
                        <input list={`prod-${idx}`} className={inputCls} value={it.descricao} onChange={e => {
                          const val = e.target.value;
                          const match = (produtos ?? []).find((p: any) => p.nome === val);
                          if (match) pickProduto(idx, (match as any).id);
                          else updateItem(idx, { descricao: val });
                        }} placeholder="Buscar ou digitar..." />
                        <datalist id={`prod-${idx}`}>
                          {(produtos ?? []).map((p: any) => <option key={p.id} value={p.nome} />)}
                        </datalist>
                      </td>
                      <td className="px-1 py-1"><input className={inputCls} value={it.ncm || ""} onChange={e => updateItem(idx, { ncm: e.target.value })} /></td>
                      <td className="px-1 py-1"><input type="number" step="0.01" className={inputCls + " text-right"} value={it.qtd} onChange={e => updateItem(idx, { qtd: Number(e.target.value) })} /></td>
                      <td className="px-1 py-1"><input type="number" step="0.01" className={inputCls + " text-right"} value={it.valor_unit} onChange={e => updateItem(idx, { valor_unit: Number(e.target.value) })} /></td>
                      <td className="px-1 py-1"><input type="number" step="0.01" className={inputCls + " text-right"} value={it.desconto} onChange={e => updateItem(idx, { desconto: Number(e.target.value) })} /></td>
                      <td className="px-2 py-1 text-right font-medium">{fmtBRL(total)}</td>
                      <td className="px-1 py-1 text-center">
                        <button onClick={() => removeItem(idx)} className="text-red-400 hover:text-red-500 p-1"><X size={14} /></button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-3">
            <div>
              <label className={labelCls}>Observações</label>
              <textarea rows={4} className={inputCls} value={observacoes} onChange={e => setObservacoes(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Local de Entrega</label>
                <input className={inputCls} value={localEntrega} onChange={e => setLocalEntrega(e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Responsável</label>
                <input className={inputCls} value={responsavel} onChange={e => setResponsavel(e.target.value)} />
              </div>
            </div>
          </div>
          <div className="bg-secondary/30 border border-border rounded-md p-4 space-y-2 text-[13px]">
            <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span className="font-medium">{fmtBRL(subtotal)}</span></div>
            <div className="flex justify-between items-center"><span className="text-muted-foreground">Frete</span><input type="number" step="0.01" className={inputCls + " w-32 text-right"} value={frete} onChange={e => setFrete(Number(e.target.value))} /></div>
            <div className="flex justify-between items-center"><span className="text-muted-foreground">Desconto Total</span><input type="number" step="0.01" className={inputCls + " w-32 text-right"} value={descontoTotal} onChange={e => setDescontoTotal(Number(e.target.value))} /></div>
            <div className="flex justify-between items-center"><span className="text-muted-foreground">IPI</span><input type="number" step="0.01" className={inputCls + " w-32 text-right"} value={ipi} onChange={e => setIpi(Number(e.target.value))} /></div>
            <div className="flex justify-between border-t border-border pt-2 text-base font-bold"><span>Total Geral</span><span className="text-primary">{fmtBRL(totalGeral)}</span></div>
          </div>
        </div>

        <div className="border-t border-border pt-4 text-center text-[12px] text-muted-foreground">
          _______________________________ / Data: ___/___/______
        </div>
      </div>
    </div>
  );
};

// ============ PDF EXPORT ============
export async function exportPedidoPDF(pedidoId: string, userName: string) {
  try {
    const { data: pedido, error } = await supabase.from("pedidos_compra" as any).select("*").eq("id", pedidoId).single();
    if (error || !pedido) throw error || new Error("Pedido não encontrado");
    const p: any = pedido;

    const [empRes, fornRes, transpRes] = await Promise.all([
      supabase.from("empresas").select("*").eq("id", p.empresa_id).single(),
      p.fornecedor_id ? supabase.from("fornecedores").select("*").eq("id", p.fornecedor_id).single() : Promise.resolve({ data: null } as any),
      p.transportadora_id ? supabase.from("transportadoras").select("nome").eq("id", p.transportadora_id).single() : Promise.resolve({ data: null } as any),
    ]);
    const emp: any = empRes.data || {};
    const forn: any = fornRes.data || {};
    const transp: any = transpRes.data || {};

    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const pw = doc.internal.pageSize.getWidth();
    let y = 12;

    // Logo
    if (emp.logo_url) {
      try {
        const res = await fetch(emp.logo_url);
        const blob = await res.blob();
        const b64: string = await new Promise((resolve) => {
          const r = new FileReader();
          r.onloadend = () => resolve(String(r.result));
          r.readAsDataURL(blob);
        });
        const ext = (blob.type.includes("png") ? "PNG" : "JPEG");
        doc.addImage(b64, ext, 12, y, 28, 18);
      } catch {}
    }

    doc.setFont("helvetica", "bold").setFontSize(14);
    doc.text(String(emp.nome || "EMPRESA"), 44, y + 6);
    doc.setFont("helvetica", "normal").setFontSize(9);
    const linhas = [
      `CNPJ: ${emp.cnpj || "—"}`,
      `${emp.endereco || ""}${emp.bairro ? " - " + emp.bairro : ""}`,
      `${emp.cidade || ""}${emp.estado ? "/" + emp.estado : ""}${emp.cep ? " - CEP " + emp.cep : ""}`,
      `Tel: ${emp.telefone1 || emp.telefone || "—"}${emp.telefone2 ? " / " + emp.telefone2 : ""}`,
      `${emp.email || ""}${emp.site ? " • " + emp.site : ""}${emp.instagram ? " • " + emp.instagram : ""}`,
    ];
    linhas.forEach((l, i) => doc.text(l, 44, y + 11 + i * 4));
    y += 34;

    doc.setDrawColor(200); doc.line(12, y, pw - 12, y); y += 6;

    // Título
    doc.setFont("helvetica", "bold").setFontSize(13);
    doc.text(`PEDIDO DE COMPRA Nº ${p.numero}`, pw / 2, y, { align: "center" });
    y += 7;
    doc.setFont("helvetica", "normal").setFontSize(9);
    doc.text(`Data: ${fmtDate(p.data_pedido)}   Status: ${statusLabel(p.status)}`, pw / 2, y, { align: "center" });
    y += 6;

    // Fornecedor
    doc.setFont("helvetica", "bold").setFontSize(10);
    doc.text("FORNECEDOR", 12, y); y += 4;
    doc.setFont("helvetica", "normal").setFontSize(9);
    doc.text(`${forn.nome || "—"}${forn.cnpj ? "  CNPJ: " + forn.cnpj : ""}`, 12, y); y += 4;
    if (forn.telefone || forn.email) { doc.text(`${forn.telefone || ""}${forn.email ? "  " + forn.email : ""}`, 12, y); y += 4; }
    doc.text(`Cond. Pagamento: ${p.condicao_pagamento || "—"}   Prazo: ${p.prazo_entrega || "—"}   Transportadora: ${transp.nome || "—"}`, 12, y);
    y += 6;

    // Itens
    const rows = (p.itens || []).map((it: any) => {
      const total = (Number(it.qtd) || 0) * (Number(it.valor_unit) || 0) - (Number(it.desconto) || 0);
      return [it.codigo || "-", it.descricao || "", it.ncm || "-", String(it.qtd || 0), fmtBRL(Number(it.valor_unit || 0)), fmtBRL(Number(it.desconto || 0)), fmtBRL(total)];
    });
    autoTable(doc, {
      startY: y,
      head: [["Código", "Descrição", "NCM", "Qtd", "V. Unit", "Desconto", "Total"]],
      body: rows,
      styles: { fontSize: 8, cellPadding: 1.5 },
      headStyles: { fillColor: [30, 41, 59], textColor: 255 },
      columnStyles: {
        3: { halign: "right" }, 4: { halign: "right" }, 5: { halign: "right" }, 6: { halign: "right" },
      },
      margin: { left: 12, right: 12 },
    });
    y = (doc as any).lastAutoTable.finalY + 4;

    const subtotal = (p.itens || []).reduce((s: number, it: any) => s + (Number(it.qtd) || 0) * (Number(it.valor_unit) || 0) - (Number(it.desconto) || 0), 0);
    const totalsX = pw - 12;
    doc.setFontSize(9).setFont("helvetica", "normal");
    const line = (label: string, val: string, bold = false) => {
      doc.setFont("helvetica", bold ? "bold" : "normal");
      doc.text(label, totalsX - 55, y);
      doc.text(val, totalsX, y, { align: "right" });
      y += 5;
    };
    line("Subtotal:", fmtBRL(subtotal));
    line("Frete:", fmtBRL(Number(p.frete || 0)));
    line("Desconto:", fmtBRL(Number(p.desconto_total || 0)));
    line("IPI:", fmtBRL(Number(p.ipi || 0)));
    line("TOTAL GERAL:", fmtBRL(Number(p.total || 0)), true);
    y += 3;

    if (p.observacoes) {
      doc.setFont("helvetica", "bold").setFontSize(9); doc.text("Observações:", 12, y); y += 4;
      doc.setFont("helvetica", "normal");
      const wrapped = doc.splitTextToSize(String(p.observacoes), pw - 24);
      doc.text(wrapped, 12, y); y += wrapped.length * 4 + 2;
    }
    doc.text(`Local de Entrega: ${p.local_entrega || "—"}`, 12, y); y += 5;
    doc.text(`Responsável: ${p.responsavel || "—"}`, 12, y); y += 10;

    doc.line(pw / 2 - 40, y, pw / 2 + 40, y);
    doc.setFontSize(8).text("Assinatura / Data: ___/___/______", pw / 2, y + 4, { align: "center" });

    // Footer com paginação
    const pages = doc.getNumberOfPages();
    const nowStr = new Date().toLocaleString("pt-BR");
    for (let i = 1; i <= pages; i++) {
      doc.setPage(i);
      doc.setFontSize(8).setTextColor(120);
      doc.text(`Gerado em ${nowStr} por ${userName} — Página ${i} de ${pages}`, pw / 2, doc.internal.pageSize.getHeight() - 6, { align: "center" });
    }

    doc.save(`pedido-compra-${p.numero}.pdf`);
    toast.success("PDF gerado");
  } catch (e: any) {
    toast.error(e.message || "Erro ao gerar PDF");
  }
}

export default PedidoCompra;