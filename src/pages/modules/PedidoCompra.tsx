import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/hooks/useEmpresa";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, FileText, Eye, ArrowLeft, X, PackageCheck, ListPlus } from "lucide-react";
import { fmtBRL } from "@/lib/financeiroUtils";
import { qtdRestante, podeExcluirPedido, resumoRecebimento } from "@/lib/pedidoCompra";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

type PedidoItem = {
  // ligação com o Pré-Projeto (itens vindos do CRM)
  pci_id?: string;            // id em pedidos_compra_itens (item já salvo)
  crm_item_id?: string | null;
  cliente_id?: string | null;
  projeto_id?: string | null;
  produto_id?: string | null;
  cliente_nome?: string | null;
  qtd_recebida?: number;
  // dados do documento
  codigo?: string;
  descricao: string;
  ncm?: string;
  qtd: number;
  valor_unit: number;
  desconto: number;
};

const STATUS_OPTS = ["rascunho", "enviado", "confirmado", "recebido_parcial", "recebido", "cancelado"] as const;
const statusLabel = (s: string) => ({
  rascunho: "Rascunho", enviado: "Enviado", confirmado: "Confirmado",
  recebido_parcial: "Recebido parcial", recebido: "Recebido", cancelado: "Cancelado",
} as Record<string, string>)[s] || s;
const statusColor = (s: string) => ({
  rascunho: "bg-muted text-muted-foreground",
  enviado: "bg-blue-500/20 text-blue-400 border border-blue-500/30",
  confirmado: "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30",
  recebido_parcial: "bg-amber-500/20 text-amber-400 border border-amber-500/30",
  recebido: "bg-green-500/20 text-green-400 border border-green-500/30",
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
      const [pRes, fRes, iRes] = await Promise.all([
        supabase.from("pedidos_compra" as any).select("*").eq("deletado", false).order("numero", { ascending: false }),
        supabase.from("fornecedores").select("id, nome"),
        supabase.from("pedidos_compra_itens" as any).select("pedido_id, quantidade, quantidade_recebida, cliente_id"),
      ]);
      if (pRes.error) throw pRes.error;
      const fMap = Object.fromEntries((fRes.data ?? []).map((x: any) => [x.id, x.nome]));
      const porPedido: Record<string, any[]> = {};
      for (const it of (iRes.data as any[] ?? [])) (porPedido[it.pedido_id] ||= []).push(it);
      return (pRes.data as any[] ?? []).map(p => {
        const itens = porPedido[p.id] ?? [];
        return {
          ...p,
          fornecedor_nome: fMap[p.fornecedor_id] || "—",
          clientes_qtd: new Set(itens.map(i => i.cliente_id).filter(Boolean)).size,
          resumo: resumoRecebimento(itens.map(i => ({ quantidade: Number(i.quantidade), recebida: Number(i.quantidade_recebida) }))),
        };
      });
    },
    enabled: !!empresaId,
  });

  // Pedido com algo recebido não pode ser apagado (o recebimento já alterou o Pré-Projeto): cancele em vez de excluir.
  const delMut = useMutation({
    mutationFn: async (p: any) => {
      if (!podeExcluirPedido(p.resumo?.recebido ?? 0)) {
        throw new Error("Este pedido já tem itens recebidos. Mude o status para Cancelado em vez de excluir.");
      }
      const { error } = await supabase.from("pedidos_compra" as any).update({ deletado: true }).eq("id", p.id);
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
          <p className="text-xs text-muted-foreground mt-0.5">Emissão e gestão de pedidos para fornecedores, com itens de vários clientes</p>
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
              <th className="px-3 py-2 text-left">Clientes</th>
              <th className="px-3 py-2 text-left">Recebido</th>
              <th className="px-3 py-2 text-right">Total</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={8} className="text-center py-8 text-muted-foreground">Carregando...</td></tr>
            ) : (pedidos ?? []).length === 0 ? (
              <tr><td colSpan={8} className="text-center py-8 text-muted-foreground">Nenhum pedido cadastrado</td></tr>
            ) : (pedidos ?? []).map((p: any) => (
              <tr key={p.id} className="border-t border-border hover:bg-secondary/20">
                <td className="px-3 py-2 font-semibold">#{p.numero}</td>
                <td className="px-3 py-2">{p.fornecedor_nome}</td>
                <td className="px-3 py-2">{fmtDate(p.data_pedido)}</td>
                <td className="px-3 py-2">{p.clientes_qtd > 0 ? `${p.clientes_qtd} cliente(s)` : "—"}</td>
                <td className="px-3 py-2 text-muted-foreground">{p.resumo.total > 0 ? `${p.resumo.completos}/${p.resumo.total} itens` : "—"}</td>
                <td className="px-3 py-2 text-right font-medium">{fmtBRL(Number(p.total || 0))}</td>
                <td className="px-3 py-2"><span className={`px-2 py-0.5 rounded text-[11px] ${statusColor(p.status)}`}>{statusLabel(p.status)}</span></td>
                <td className="px-3 py-2 text-right space-x-1">
                  <button onClick={() => openEdit(p.id)} className="p-1.5 hover:bg-secondary rounded" title="Ver / receber"><Eye size={14} /></button>
                  <button onClick={() => openEdit(p.id)} className="p-1.5 hover:bg-secondary rounded" title="Editar"><Pencil size={14} /></button>
                  <button onClick={() => exportPedidoPDF(p.id, profile?.full_name || "Sistema")} className="p-1.5 hover:bg-secondary rounded text-primary" title="PDF"><FileText size={14} /></button>
                  <button onClick={() => { if (confirm(`Excluir pedido #${p.numero}?`)) delMut.mutate(p); }} className="p-1.5 hover:bg-secondary rounded text-red-400" title="Excluir"><Trash2 size={14} /></button>
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
  const [itens, setItens] = useState<PedidoItem[]>([]);
  const [frete, setFrete] = useState(0);
  const [descontoTotal, setDescontoTotal] = useState(0);
  const [ipi, setIpi] = useState(0);
  const [observacoes, setObservacoes] = useState("");
  const [localEntrega, setLocalEntrega] = useState("");
  const [responsavel, setResponsavel] = useState(profile?.full_name || "");
  const [pickerAberto, setPickerAberto] = useState(false);

  const { data: fornecedores } = useQuery({
    queryKey: ["fornecedores_pc", empresaId],
    queryFn: async () => (await supabase.from("fornecedores").select("id, nome, tipo").eq("deletado", false).eq("tipo", "fornecedor").order("nome")).data ?? [],
    enabled: !!empresaId,
  });
  const { data: transportadoras } = useQuery({
    queryKey: ["transportadoras_pc", empresaId],
    queryFn: async () => {
      const q = await supabase.from("transportadoras").select("id, nome, ativo").order("nome");
      return q.data ?? [];
    },
    enabled: !!empresaId,
  });
  const { data: produtos } = useQuery({
    queryKey: ["produtos_pc", empresaId],
    queryFn: async () => (await supabase.from("produtos").select("id, codigo, nome, preco_custo").eq("deletado", false).order("nome")).data ?? [],
    enabled: !!empresaId,
  });

  // Carrega pedido existente: itens ligados ao Pré-Projeto vêm de pedidos_compra_itens (fonte de verdade),
  // itens avulsos (sem ligação) vêm do retrato do documento.
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
      setFrete(Number(d.frete || 0));
      setDescontoTotal(Number(d.desconto_total || 0));
      setIpi(Number(d.ipi || 0));
      setObservacoes(d.observacoes || "");
      setLocalEntrega(d.local_entrega || "");
      setResponsavel(d.responsavel || profile?.full_name || "");

      const snapshot: any[] = Array.isArray(d.itens) ? d.itens : [];
      const { data: linhas } = await supabase
        .from("pedidos_compra_itens" as any)
        .select("*, clientes(nome)")
        .eq("pedido_id", id)
        .order("created_at");
      const porCrm: Record<string, any> = {};
      for (const s of snapshot) if (s.crm_item_id) porCrm[s.crm_item_id] = s;
      const ligados: PedidoItem[] = ((linhas as any[]) ?? []).map(l => ({
        pci_id: l.id,
        crm_item_id: l.crm_item_id,
        cliente_id: l.cliente_id,
        projeto_id: l.projeto_id,
        produto_id: l.produto_id,
        cliente_nome: l.clientes?.nome ?? null,
        qtd_recebida: Number(l.quantidade_recebida || 0),
        codigo: porCrm[l.crm_item_id]?.codigo || "",
        ncm: porCrm[l.crm_item_id]?.ncm || "",
        descricao: l.descricao,
        qtd: Number(l.quantidade),
        valor_unit: Number(l.valor_unit || 0),
        desconto: Number(l.desconto || 0),
      }));
      const avulsos: PedidoItem[] = snapshot.filter(s => !s.crm_item_id);
      const todos = [...ligados, ...avulsos];
      setItens(todos.length ? todos : [{ descricao: "", qtd: 1, valor_unit: 0, desconto: 0 }]);
    })();
  }, [id, profile?.full_name]);

  // Pedido novo começa com uma linha em branco (item avulso)
  useEffect(() => {
    if (!id && itens.length === 0) setItens([{ descricao: "", qtd: 1, valor_unit: 0, desconto: 0 }]);
  }, [id, itens.length]);

  const subtotal = useMemo(() => itens.reduce((sum, it) => sum + (Number(it.qtd) || 0) * (Number(it.valor_unit) || 0) - (Number(it.desconto) || 0), 0), [itens]);
  const totalGeral = subtotal + Number(frete || 0) + Number(ipi || 0) - Number(descontoTotal || 0);

  const updateItem = (idx: number, patch: Partial<PedidoItem>) => {
    setItens(prev => prev.map((it, i) => i === idx ? { ...it, ...patch } : it));
  };
  const addItem = () => setItens(prev => [...prev, { descricao: "", qtd: 1, valor_unit: 0, desconto: 0 }]);
  const removeItem = (idx: number) => {
    const it = itens[idx];
    if ((it.qtd_recebida ?? 0) > 0) { toast.error("Item já recebido: estorne o recebimento antes de remover."); return; }
    setItens(prev => prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev);
  };
  const pickProduto = (idx: number, prodId: string) => {
    const p: any = (produtos ?? []).find((x: any) => x.id === prodId);
    if (!p) return;
    updateItem(idx, { codigo: p.codigo || "", descricao: p.nome, valor_unit: Number(p.preco_custo || 0), produto_id: p.id });
  };

  const adicionarDoPreProjeto = (novos: PedidoItem[]) => {
    setItens(prev => {
      const base = prev.filter(it => it.descricao.trim() !== "" || it.crm_item_id);
      return [...base, ...novos];
    });
    setPickerAberto(false);
  };

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!empresaId) throw new Error("Empresa não encontrada");
      const validos = itens.filter(it => it.descricao.trim() !== "");
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
        // retrato do documento (usado no PDF)
        itens: validos.map(it => ({
          codigo: it.codigo, descricao: it.descricao, ncm: it.ncm, qtd: it.qtd, valor_unit: it.valor_unit,
          desconto: it.desconto, crm_item_id: it.crm_item_id ?? null, cliente_id: it.cliente_id ?? null,
          cliente_nome: it.cliente_nome ?? null,
        })),
      };
      let pedidoId = id;
      if (id) {
        const { error } = await supabase.from("pedidos_compra" as any).update(payload).eq("id", id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("pedidos_compra" as any).insert(payload).select().single();
        if (error) throw error;
        pedidoId = (data as any).id as string;
      }

      // Sincroniza os itens ligados ao Pré-Projeto (fonte de verdade para recebimento e "comprado")
      const ligados = validos.filter(it => it.crm_item_id);
      const { data: existentes } = await supabase.from("pedidos_compra_itens" as any).select("id").eq("pedido_id", pedidoId!);
      const manterIds = new Set(ligados.map(l => l.pci_id).filter(Boolean) as string[]);
      for (const ex of (existentes as any[]) ?? []) {
        if (!manterIds.has(ex.id)) {
          const { error } = await supabase.from("pedidos_compra_itens" as any).delete().eq("id", ex.id);
          if (error) throw error;
        }
      }
      for (const l of ligados) {
        const linha = {
          pedido_id: pedidoId, empresa_id: empresaId, crm_item_id: l.crm_item_id, cliente_id: l.cliente_id ?? null,
          projeto_id: l.projeto_id ?? null, produto_id: l.produto_id ?? null, descricao: l.descricao,
          quantidade: Number(l.qtd), valor_unit: Number(l.valor_unit || 0), desconto: Number(l.desconto || 0),
        };
        if (l.pci_id) {
          const { error } = await supabase.from("pedidos_compra_itens" as any).update(linha).eq("id", l.pci_id);
          if (error) throw error;
        } else {
          const { error } = await supabase.from("pedidos_compra_itens" as any).insert(linha);
          if (error) throw error;
        }
      }
      return pedidoId!;
    },
    onSuccess: () => { toast.success("Pedido salvo"); qc.invalidateQueries({ queryKey: ["pedidos_compra"] }); onClose(); },
    onError: (e: any) => toast.error(e.message),
  });

  // Recebimento item a item: o banco marca o item do Pré-Projeto como "comprado" e atualiza o status do pedido.
  const receber = async (idx: number, nova: number) => {
    const it = itens[idx];
    if (!it?.pci_id || !id) return;
    const q = Math.max(0, Math.min(Number(nova) || 0, Number(it.qtd)));
    const { error } = await supabase
      .from("pedidos_compra_itens" as any)
      .update({ quantidade_recebida: q, recebido_em: q > 0 ? new Date().toISOString().slice(0, 10) : null })
      .eq("id", it.pci_id);
    if (error) { toast.error(error.message); return; }
    updateItem(idx, { qtd_recebida: q });
    const { data } = await supabase.from("pedidos_compra" as any).select("status").eq("id", id).single();
    if (data) setStatus((data as any).status);
    qc.invalidateQueries();
    toast.success(q >= it.qtd ? "Item recebido: marcado como comprado no Pré-Projeto" : q > 0 ? "Recebimento parcial registrado" : "Recebimento estornado");
  };

  const temLigados = itens.some(it => it.pci_id);

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <button onClick={onClose} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft size={16} /> Voltar
        </button>
        <div className="flex items-center gap-2">
          {id && <button onClick={() => exportPedidoPDF(id, profile?.full_name || "Sistema")} className="border border-border hover:bg-secondary px-3 py-1.5 rounded-md text-[13px] flex items-center gap-1.5"><FileText size={14} /> PDF</button>}
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
            <div className="flex items-center gap-3">
              <button onClick={() => setPickerAberto(v => !v)} className="text-[12px] flex items-center gap-1 text-primary hover:underline">
                <ListPlus size={13} /> Adicionar do Pré-Projeto
              </button>
              <button onClick={addItem} className="text-[12px] flex items-center gap-1 text-muted-foreground hover:underline"><Plus size={12} /> Item avulso</button>
            </div>
          </div>

          {pickerAberto && (
            <PickerPreProjeto
              empresaId={empresaId}
              jaNoPedido={itens.filter(i => i.crm_item_id).map(i => String(i.crm_item_id))}
              pedidoAtualId={id}
              onAdd={adicionarDoPreProjeto}
              onClose={() => setPickerAberto(false)}
            />
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead className="bg-secondary/40 text-muted-foreground text-[11px] uppercase">
                <tr>
                  <th className="px-2 py-1.5 text-left w-[100px]">Código</th>
                  <th className="px-2 py-1.5 text-left">Produto/Descrição</th>
                  <th className="px-2 py-1.5 text-left w-[150px]">Cliente</th>
                  <th className="px-2 py-1.5 text-right w-[70px]">Qtd</th>
                  <th className="px-2 py-1.5 text-right w-[105px]">Valor Unit</th>
                  <th className="px-2 py-1.5 text-right w-[90px]">Desconto</th>
                  <th className="px-2 py-1.5 text-right w-[105px]">Total</th>
                  {temLigados && <th className="px-2 py-1.5 text-center w-[170px]">Recebido</th>}
                  <th className="px-2 py-1.5 w-[40px]"></th>
                </tr>
              </thead>
              <tbody>
                {itens.map((it, idx) => {
                  const total = (Number(it.qtd) || 0) * (Number(it.valor_unit) || 0) - (Number(it.desconto) || 0);
                  const ligado = !!it.crm_item_id;
                  return (
                    <tr key={it.pci_id ?? `n${idx}`} className="border-t border-border">
                      <td className="px-1 py-1"><input className={inputCls} value={it.codigo || ""} onChange={e => updateItem(idx, { codigo: e.target.value })} /></td>
                      <td className="px-1 py-1">
                        {ligado ? (
                          <span className="px-2 text-[13px]">{it.descricao}</span>
                        ) : (
                          <>
                            <input list={`prod-${idx}`} className={inputCls} value={it.descricao} onChange={e => {
                              const val = e.target.value;
                              const match = (produtos ?? []).find((p: any) => p.nome === val);
                              if (match) pickProduto(idx, (match as any).id);
                              else updateItem(idx, { descricao: val });
                            }} placeholder="Buscar ou digitar..." />
                            <datalist id={`prod-${idx}`}>
                              {(produtos ?? []).map((p: any) => <option key={p.id} value={p.nome} />)}
                            </datalist>
                          </>
                        )}
                      </td>
                      <td className="px-2 py-1 text-muted-foreground">{it.cliente_nome || "—"}</td>
                      <td className="px-1 py-1"><input type="number" step="0.01" min={it.qtd_recebida || 0} className={inputCls + " text-right"} value={it.qtd} onChange={e => updateItem(idx, { qtd: Number(e.target.value) })} /></td>
                      <td className="px-1 py-1"><input type="number" step="0.01" className={inputCls + " text-right"} value={it.valor_unit} onChange={e => updateItem(idx, { valor_unit: Number(e.target.value) })} /></td>
                      <td className="px-1 py-1"><input type="number" step="0.01" className={inputCls + " text-right"} value={it.desconto} onChange={e => updateItem(idx, { desconto: Number(e.target.value) })} /></td>
                      <td className="px-2 py-1 text-right font-medium">{fmtBRL(total)}</td>
                      {temLigados && (
                        <td className="px-1 py-1">
                          {it.pci_id ? (
                            <div className="flex items-center gap-1">
                              <input type="number" step="1" min={0} max={it.qtd} className={inputCls + " text-right w-[70px]"}
                                value={it.qtd_recebida ?? 0}
                                onChange={e => updateItem(idx, { qtd_recebida: Number(e.target.value) })}
                                onBlur={e => receber(idx, Number(e.target.value))} />
                              <span className="text-[11px] text-muted-foreground">de {it.qtd}</span>
                              <button onClick={() => receber(idx, it.qtd)} title="Receber tudo" className="p-1 text-emerald-500 hover:bg-secondary rounded"><PackageCheck size={15} /></button>
                            </div>
                          ) : <span className="text-[11px] text-muted-foreground px-2">salve para receber</span>}
                        </td>
                      )}
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

// ============ ITENS DO PRÉ-PROJETO (de vários clientes) ============
const PickerPreProjeto = ({
  empresaId, jaNoPedido, pedidoAtualId, onAdd, onClose,
}: {
  empresaId: string | null;
  jaNoPedido: string[];
  pedidoAtualId: string | null;
  onAdd: (itens: PedidoItem[]) => void;
  onClose: () => void;
}) => {
  const [clienteFiltro, setClienteFiltro] = useState("");
  const [busca, setBusca] = useState("");
  const [sel, setSel] = useState<Record<string, number>>({});

  const { data, isLoading } = useQuery({
    queryKey: ["pc_itens_disponiveis", empresaId, pedidoAtualId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data: orcs } = await supabase.from("crm_orcamentos").select("id, cliente_id").eq("aprovado", true);
      const orcIds = (orcs ?? []).map((o: any) => o.id);
      if (!orcIds.length) return { itens: [], clientes: [] as any[] };

      const [itRes, prRes] = await Promise.all([
        supabase.from("crm_itens").select("id, descricao, quantidade, preco_custo, tipo, status_compra, cliente_id, orcamento_id, produto_id")
          .in("orcamento_id", orcIds).eq("tipo", "produto").eq("status_compra", "pendente"),
        supabase.from("projetos").select("id, orcamento_id").in("orcamento_id", orcIds).eq("deletado", false),
      ]);
      const itens: any[] = itRes.data ?? [];
      const projPorOrc: Record<string, string> = Object.fromEntries((prRes.data ?? []).map((p: any) => [p.orcamento_id, p.id]));
      const cliIds = Array.from(new Set(itens.map(i => i.cliente_id).filter(Boolean)));
      const itIds = itens.map(i => i.id);

      const [cliRes, pedRes] = await Promise.all([
        cliIds.length ? supabase.from("clientes").select("id, nome").in("id", cliIds).eq("deletado", false) : Promise.resolve({ data: [] as any[] }),
        itIds.length
          ? supabase.from("pedidos_compra_itens" as any).select("crm_item_id, quantidade, pedido_id, pedidos_compra!inner(status, deletado)").in("crm_item_id", itIds)
          : Promise.resolve({ data: [] as any[] }),
      ]);
      const nomePorCli: Record<string, string> = Object.fromEntries(((cliRes.data as any[]) ?? []).map((c: any) => [c.id, c.nome]));
      const pedidoPorItem: Record<string, number> = {};
      for (const r of ((pedRes.data as any[]) ?? [])) {
        const ped = r.pedidos_compra;
        if (!ped || ped.deletado || ped.status === "cancelado") continue;
        if (pedidoAtualId && r.pedido_id === pedidoAtualId) continue; // linhas deste pedido já estão na tela
        pedidoPorItem[r.crm_item_id] = (pedidoPorItem[r.crm_item_id] || 0) + Number(r.quantidade);
      }
      const lista = itens
        .map(i => ({
          ...i,
          cliente_nome: nomePorCli[i.cliente_id] ?? null,
          projeto_id: projPorOrc[i.orcamento_id] ?? null,
          restante: qtdRestante(Number(i.quantidade), pedidoPorItem[i.id] || 0),
        }))
        .filter(i => i.cliente_nome && i.restante > 0)
        .sort((a, b) => String(a.cliente_nome).localeCompare(String(b.cliente_nome)) || String(a.descricao).localeCompare(String(b.descricao)));
      const clientes = Array.from(new Map(lista.map(i => [i.cliente_id, i.cliente_nome])).entries()).map(([id, nome]) => ({ id, nome }));
      return { itens: lista, clientes };
    },
  });

  const visiveis = (data?.itens ?? []).filter((i: any) =>
    (!clienteFiltro || i.cliente_id === clienteFiltro) &&
    (!busca || String(i.descricao).toLowerCase().includes(busca.toLowerCase())) &&
    !jaNoPedido.includes(i.id));

  const toggle = (i: any) => setSel(prev => {
    const n = { ...prev };
    if (n[i.id] != null) delete n[i.id]; else n[i.id] = i.restante;
    return n;
  });

  const adicionar = () => {
    const novos: PedidoItem[] = (data?.itens ?? [])
      .filter((i: any) => sel[i.id] != null && sel[i.id] > 0)
      .map((i: any) => ({
        crm_item_id: i.id, cliente_id: i.cliente_id, projeto_id: i.projeto_id, produto_id: i.produto_id ?? null,
        cliente_nome: i.cliente_nome, descricao: i.descricao,
        qtd: Math.min(Number(sel[i.id]), Number(i.restante)),
        valor_unit: Number(i.preco_custo || 0), desconto: 0, qtd_recebida: 0,
      }));
    if (!novos.length) { toast.error("Marque ao menos um item."); return; }
    onAdd(novos);
  };

  return (
    <div className="border border-primary/40 bg-primary/5 rounded-md p-3 mb-3 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[12px] font-semibold">Itens pendentes de compra (orçamentos aprovados)</span>
        <select className={inputCls + " w-[220px]"} value={clienteFiltro} onChange={e => setClienteFiltro(e.target.value)}>
          <option value="">Todos os clientes</option>
          {(data?.clientes ?? []).map((c: any) => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>
        <input className={inputCls + " w-[200px]"} placeholder="Buscar item..." value={busca} onChange={e => setBusca(e.target.value)} />
        <button onClick={onClose} className="ml-auto text-muted-foreground hover:text-foreground"><X size={14} /></button>
      </div>
      <div className="max-h-[260px] overflow-y-auto border border-border rounded bg-card">
        <table className="w-full text-[12px]">
          <thead className="bg-secondary/40 text-muted-foreground text-[11px] uppercase sticky top-0">
            <tr>
              <th className="px-2 py-1 w-[30px]"></th>
              <th className="px-2 py-1 text-left">Cliente</th>
              <th className="px-2 py-1 text-left">Item</th>
              <th className="px-2 py-1 text-right w-[80px]">Falta pedir</th>
              <th className="px-2 py-1 text-right w-[90px]">Pedir agora</th>
              <th className="px-2 py-1 text-right w-[90px]">Custo un.</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={6} className="text-center py-4 text-muted-foreground">Carregando...</td></tr>
            ) : visiveis.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-4 text-muted-foreground">Nenhum item pendente disponível.</td></tr>
            ) : visiveis.map((i: any) => (
              <tr key={i.id} className="border-t border-border hover:bg-secondary/20">
                <td className="px-2 py-1"><input type="checkbox" checked={sel[i.id] != null} onChange={() => toggle(i)} /></td>
                <td className="px-2 py-1">{i.cliente_nome}</td>
                <td className="px-2 py-1">{i.descricao}</td>
                <td className="px-2 py-1 text-right">{i.restante}</td>
                <td className="px-1 py-1">
                  <input type="number" step="1" min={1} max={i.restante} disabled={sel[i.id] == null}
                    className={inputCls + " text-right"} value={sel[i.id] ?? ""}
                    onChange={e => setSel(prev => ({ ...prev, [i.id]: Math.min(Number(e.target.value) || 0, i.restante) }))} />
                </td>
                <td className="px-2 py-1 text-right">{fmtBRL(Number(i.preco_custo || 0))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex justify-end gap-2">
        <button onClick={onClose} className="border border-border hover:bg-secondary px-3 py-1 rounded-md text-[12px]">Cancelar</button>
        <button onClick={adicionar} className="bg-primary text-primary-foreground px-3 py-1 rounded-md text-[12px] font-medium">Adicionar ao pedido</button>
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

    // Itens (com a coluna Cliente: destino de cada item)
    const rows = (p.itens || []).map((it: any) => {
      const total = (Number(it.qtd) || 0) * (Number(it.valor_unit) || 0) - (Number(it.desconto) || 0);
      return [it.codigo || "-", it.descricao || "", it.cliente_nome || "-", it.ncm || "-", String(it.qtd || 0), fmtBRL(Number(it.valor_unit || 0)), fmtBRL(Number(it.desconto || 0)), fmtBRL(total)];
    });
    autoTable(doc, {
      startY: y,
      head: [["Código", "Descrição", "Cliente", "NCM", "Qtd", "V. Unit", "Desconto", "Total"]],
      body: rows,
      styles: { fontSize: 8, cellPadding: 1.5 },
      headStyles: { fillColor: [30, 41, 59], textColor: 255 },
      columnStyles: {
        4: { halign: "right" }, 5: { halign: "right" }, 6: { halign: "right" }, 7: { halign: "right" },
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
