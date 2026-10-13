import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/hooks/useEmpresa";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import {
  Plus, Trash2, FileText, ArrowLeft, X, PackageCheck, ListPlus, Search, CheckCircle2, AlertTriangle, Info, CalendarClock,
} from "lucide-react";
import { fmtBRL } from "@/lib/financeiroUtils";
import {
  qtdRestante, podeExcluirPedido, resumoRecebimento, diasParaVencer, alertasPolitica,
  agruparPorCliente, segmentosRecebimento, totalPedido,
} from "@/lib/pedidoCompra";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

type PedidoItem = {
  // ligação com o Pré-Projeto (itens vindos do CRM)
  pci_id?: string;
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
  unidade?: string;
  qtd: number;
  valor_unit: number;
  desconto: number;
};

const STATUS_OPTS = ["rascunho", "enviado", "confirmado", "recebido_parcial", "recebido", "cancelado"] as const;
const statusLabel = (s: string) => ({
  rascunho: "Rascunho", enviado: "Enviado", confirmado: "Confirmado",
  recebido_parcial: "Chegando", recebido: "Recebido", cancelado: "Cancelado",
} as Record<string, string>)[s] || s;
const statusTone = (s: string) => ({
  rascunho: "bg-muted text-muted-foreground",
  enviado: "bg-sky-500/15 text-sky-400",
  confirmado: "bg-indigo-500/15 text-indigo-300",
  recebido_parcial: "bg-amber-500/15 text-amber-400",
  recebido: "bg-emerald-500/15 text-emerald-400",
  cancelado: "bg-red-500/15 text-red-400",
} as Record<string, string>)[s] || "bg-muted text-muted-foreground";

const inputCls = "w-full bg-background border border-border rounded-md px-2.5 py-1.5 text-[13px] focus:outline-none focus:ring-1 focus:ring-primary";
const labelCls = "block text-[12px] text-muted-foreground mb-1";
const hojeISO = () => new Date().toLocaleDateString("sv-SE");

const fmtDate = (d?: string | null) => {
  if (!d) return "—";
  const dt = new Date(d + (d.length === 10 ? "T00:00:00" : ""));
  return dt.toLocaleDateString("pt-BR");
};

const StatusPill = ({ status }: { status: string }) => (
  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[12px] font-medium ${statusTone(status)}`}>{statusLabel(status)}</span>
);

/** Faixa de chegada: um segmento por item; enche conforme o recebimento. */
const FaixaChegada = ({ itens, className = "" }: { itens: { quantidade: number; recebida: number; descricao?: string }[]; className?: string }) => {
  const seg = segmentosRecebimento(itens);
  if (!seg.length) return <span className="text-[12px] text-muted-foreground">sem itens</span>;
  return (
    <div className={`flex items-center gap-[3px] ${className}`} aria-label="Faixa de chegada dos itens">
      {seg.map((s, i) => {
        const it = itens[i];
        const pct = s === "cheio" ? 100 : s === "parcial" ? Math.max(12, Math.min(88, (it.recebida / it.quantidade) * 100)) : 0;
        return (
          <span key={i} title={`${it.descricao ?? "Item"}: ${it.recebida} de ${it.quantidade}`}
            className="relative h-2.5 min-w-[10px] max-w-[34px] flex-1 overflow-hidden rounded-[3px] bg-muted">
            <span className={`absolute inset-y-0 left-0 ${s === "cheio" ? "bg-emerald-500" : "bg-amber-500"}`} style={{ width: `${pct}%` }} />
          </span>
        );
      })}
    </div>
  );
};

const ChipValidade = ({ validade, status }: { validade?: string | null; status: string }) => {
  if (!validade || !["rascunho", "enviado"].includes(status)) return null;
  const d = diasParaVencer(validade, hojeISO());
  if (d === null) return null;
  const vencida = d < 0, curta = d >= 0 && d <= 2;
  return (
    <span className={`inline-flex items-center gap-1 text-[12px] ${vencida ? "text-red-400" : curta ? "text-amber-400" : "text-muted-foreground"}`}>
      <CalendarClock size={12} />
      {vencida ? "Proposta vencida" : d === 0 ? "Vence hoje" : curta ? `Vence em ${d} dia${d > 1 ? "s" : ""}` : `Válida até ${fmtDate(validade)}`}
    </span>
  );
};

const FILTROS = [
  { id: "todos", label: "Todos" },
  { id: "aberto", label: "Em aberto" },
  { id: "chegando", label: "Chegando" },
  { id: "recebido", label: "Recebidos" },
  { id: "cancelado", label: "Cancelados" },
] as const;

const PedidoCompra = () => {
  const empresaId = useEmpresa();
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [view, setView] = useState<"list" | "form">("list");
  const [editId, setEditId] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<(typeof FILTROS)[number]["id"]>("aberto");
  const [busca, setBusca] = useState("");

  const { data: pedidos, isLoading } = useQuery({
    queryKey: ["pedidos_compra", empresaId],
    queryFn: async () => {
      const [pRes, fRes, iRes] = await Promise.all([
        supabase.from("pedidos_compra" as any).select("*").eq("deletado", false).order("numero", { ascending: false }),
        supabase.from("fornecedores").select("id, nome"),
        supabase.from("pedidos_compra_itens" as any).select("pedido_id, descricao, quantidade, quantidade_recebida, cliente_id, clientes(nome)"),
      ]);
      if (pRes.error) throw pRes.error;
      const fMap = Object.fromEntries((fRes.data ?? []).map((x: any) => [x.id, x.nome]));
      const porPedido: Record<string, any[]> = {};
      for (const it of (iRes.data as any[] ?? [])) (porPedido[it.pedido_id] ||= []).push(it);
      return (pRes.data as any[] ?? []).map(p => {
        const itens = porPedido[p.id] ?? [];
        const nomes = Array.from(new Set(itens.map(i => i.clientes?.nome).filter(Boolean))) as string[];
        const itensRec = itens.map(i => ({ descricao: i.descricao, quantidade: Number(i.quantidade), recebida: Number(i.quantidade_recebida) }));
        return {
          ...p,
          fornecedor_nome: fMap[p.fornecedor_id] || "Sem fornecedor",
          clientes_nomes: nomes,
          itensRec,
          resumo: resumoRecebimento(itensRec),
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

  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return (pedidos ?? []).filter((p: any) => {
      const okFiltro =
        filtro === "todos" ? true :
        filtro === "aberto" ? ["rascunho", "enviado", "confirmado"].includes(p.status) :
        filtro === "chegando" ? p.status === "recebido_parcial" :
        filtro === "recebido" ? p.status === "recebido" : p.status === "cancelado";
      if (!okFiltro) return false;
      if (!q) return true;
      return [String(p.numero), p.fornecedor_nome, p.numero_fornecedor, ...(p.clientes_nomes ?? [])]
        .filter(Boolean).some((t: string) => String(t).toLowerCase().includes(q));
    });
  }, [pedidos, filtro, busca]);

  const resumoGeral = useMemo(() => {
    const todos = (pedidos ?? []).filter((p: any) => p.status !== "cancelado");
    const abertos = todos.filter((p: any) => ["rascunho", "enviado", "confirmado", "recebido_parcial"].includes(p.status));
    const chegando = todos.filter((p: any) => ["enviado", "confirmado", "recebido_parcial"].includes(p.status));
    const vencendo = todos.filter((p: any) => {
      if (!["rascunho", "enviado"].includes(p.status)) return false;
      const d = diasParaVencer(p.validade_proposta, hojeISO());
      return d !== null && d <= 2;
    });
    const mes = hojeISO().slice(0, 7);
    const recebidosMes = todos.filter((p: any) => p.status === "recebido" && String(p.updated_at ?? "").slice(0, 7) === mes);
    const soma = (arr: any[]) => arr.reduce((s, p) => s + Number(p.total || 0), 0);
    return {
      abertos: { n: abertos.length, v: soma(abertos) },
      chegando: { n: chegando.length, v: soma(chegando) },
      vencendo: vencendo.length,
      recebidosMes: { n: recebidosMes.length, v: soma(recebidosMes) },
    };
  }, [pedidos]);

  const openNew = () => { setEditId(null); setView("form"); };
  const openEdit = (id: string) => { setEditId(id); setView("form"); };

  if (view === "form") {
    return <PedidoForm id={editId} onClose={() => { setView("list"); setEditId(null); qc.invalidateQueries({ queryKey: ["pedidos_compra"] }); }} />;
  }

  return (
    <div className="mx-auto max-w-[1400px] space-y-5 p-4 md:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Pedidos de compra</h1>
          <p className="mt-0.5 text-[13px] text-muted-foreground">O que foi pedido, para qual cliente e o que já chegou.</p>
        </div>
        <button onClick={openNew} className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3.5 py-2 text-[13px] font-medium text-primary-foreground hover:bg-primary/90">
          <Plus size={15} /> Novo pedido
        </button>
      </div>

      <div className="grid grid-cols-2 divide-border rounded-lg border border-border bg-card md:grid-cols-4 md:divide-x">
        {[
          { t: "Em aberto", v: String(resumoGeral.abertos.n), s: fmtBRL(resumoGeral.abertos.v) },
          { t: "A caminho", v: String(resumoGeral.chegando.n), s: fmtBRL(resumoGeral.chegando.v) },
          { t: "Propostas vencendo", v: String(resumoGeral.vencendo), s: resumoGeral.vencendo ? "em até 2 dias" : "nenhuma" },
          { t: "Recebidos no mês", v: String(resumoGeral.recebidosMes.n), s: fmtBRL(resumoGeral.recebidosMes.v) },
        ].map((k, i) => (
          <div key={i} className="px-4 py-3">
            <p className="text-[12px] text-muted-foreground">{k.t}</p>
            <p className="mt-0.5 flex items-baseline gap-2">
              <span className="text-lg font-semibold tabular-nums">{k.v}</span>
              <span className="text-[12px] tabular-nums text-muted-foreground">{k.s}</span>
            </p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1 rounded-lg bg-secondary/50 p-1">
          {FILTROS.map(f => (
            <button key={f.id} onClick={() => setFiltro(f.id)}
              className={`rounded-md px-3 py-1 text-[13px] ${filtro === f.id ? "bg-card font-medium text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
              {f.label}
            </button>
          ))}
        </div>
        <div className="relative ml-auto w-full sm:w-[280px]">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar por nº, fornecedor ou cliente"
            className={inputCls + " pl-8"} />
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="hidden grid-cols-[84px_minmax(0,1.4fr)_minmax(0,1.1fr)_190px_120px_110px_72px] gap-3 border-b border-border bg-secondary/30 px-4 py-2 text-[12px] text-muted-foreground md:grid">
          <span>Pedido</span><span>Fornecedor e clientes</span><span>Chegada dos itens</span>
          <span>Validade</span><span className="text-right">Total</span><span>Situação</span><span />
        </div>
        {isLoading ? (
          <p className="py-10 text-center text-[13px] text-muted-foreground">Carregando pedidos…</p>
        ) : lista.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-[14px] font-medium">{(pedidos ?? []).length === 0 ? "Nenhum pedido ainda" : "Nenhum pedido neste filtro"}</p>
            <p className="mt-1 text-[13px] text-muted-foreground">
              {(pedidos ?? []).length === 0 ? "Crie um pedido a partir dos itens pendentes dos seus clientes." : "Troque o filtro ou limpe a busca."}
            </p>
          </div>
        ) : lista.map((p: any) => (
          <div key={p.id} onClick={() => openEdit(p.id)}
            className="grid cursor-pointer grid-cols-2 items-center gap-x-3 gap-y-2 border-b border-border px-4 py-3 last:border-b-0 hover:bg-secondary/20 md:grid-cols-[84px_minmax(0,1.4fr)_minmax(0,1.1fr)_190px_120px_110px_72px]">
            <div>
              <p className="text-[15px] font-semibold tabular-nums">#{p.numero}</p>
              <p className="text-[12px] text-muted-foreground">{fmtDate(p.data_pedido)}</p>
            </div>
            <div className="min-w-0">
              <p className="truncate text-[14px] font-medium">{p.fornecedor_nome}</p>
              <p className="truncate text-[12px] text-muted-foreground">
                {p.numero_fornecedor ? `Pedido do fornecedor ${p.numero_fornecedor}` : "Sem nº do fornecedor"}
                {p.clientes_nomes.length > 0 && ` · ${p.clientes_nomes.slice(0, 2).join(", ")}${p.clientes_nomes.length > 2 ? ` +${p.clientes_nomes.length - 2}` : ""}`}
              </p>
            </div>
            <div className="col-span-2 md:col-span-1">
              <FaixaChegada itens={p.itensRec} />
              <p className="mt-1 text-[12px] tabular-nums text-muted-foreground">
                {p.resumo.total === 0 ? "Itens avulsos" : `${p.resumo.completos} de ${p.resumo.total} itens chegaram`}
              </p>
            </div>
            <div className="hidden md:block"><ChipValidade validade={p.validade_proposta} status={p.status} /></div>
            <p className="text-right text-[14px] font-medium tabular-nums">{fmtBRL(Number(p.total || 0))}</p>
            <div><StatusPill status={p.status} /></div>
            <div className="flex justify-end gap-1" onClick={e => e.stopPropagation()}>
              <button onClick={() => exportPedidoPDF(p.id, profile?.full_name || "Sistema")} className="rounded p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground" title="Gerar PDF"><FileText size={15} /></button>
              <button onClick={() => { if (confirm(`Excluir o pedido #${p.numero}?`)) delMut.mutate(p); }} className="rounded p-1.5 text-muted-foreground hover:bg-secondary hover:text-red-400" title="Excluir"><Trash2 size={15} /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ============ FORMULÁRIO ============
const PedidoForm = ({ id, onClose }: { id: string | null; onClose: () => void }) => {
  const empresaId = useEmpresa();
  const { profile } = useAuth();
  const qc = useQueryClient();

  const [numero, setNumero] = useState<number | null>(null);
  const [status, setStatus] = useState<string>("rascunho");
  const [dataPedido, setDataPedido] = useState(hojeISO());
  const [fornecedorId, setFornecedorId] = useState("");
  const [numeroFornecedor, setNumeroFornecedor] = useState("");
  const [vendedor, setVendedor] = useState("");
  const [validadeProposta, setValidadeProposta] = useState("");
  const [previsaoFaturamento, setPrevisaoFaturamento] = useState("");
  const [formaPagamento, setFormaPagamento] = useState("");
  const [condicaoPagamento, setCondicaoPagamento] = useState("");
  const [prazoEntrega, setPrazoEntrega] = useState("");
  const [freteTipo, setFreteTipo] = useState("");
  const [transportadoraId, setTransportadoraId] = useState("");
  const [itens, setItens] = useState<PedidoItem[]>([]);
  const [frete, setFrete] = useState(0);
  const [descontoTotal, setDescontoTotal] = useState(0);
  const [ipi, setIpi] = useState(0);
  const [icmsSt, setIcmsSt] = useState(0);
  const [observacoes, setObservacoes] = useState("");
  const [localEntrega, setLocalEntrega] = useState("");
  const [responsavel, setResponsavel] = useState(profile?.full_name || "");
  const [pickerAberto, setPickerAberto] = useState(false);

  const { data: fornecedores } = useQuery({
    queryKey: ["fornecedores_pc", empresaId],
    queryFn: async () =>
      (await supabase.from("fornecedores" as any)
        .select("id, nome, tipo, pedido_minimo, frete_cif_acima_de, condicao_pagamento_padrao")
        .eq("deletado", false).eq("tipo", "fornecedor").order("nome")).data as any[] ?? [],
    enabled: !!empresaId,
  });
  const { data: transportadoras } = useQuery({
    queryKey: ["transportadoras_pc", empresaId],
    queryFn: async () => (await supabase.from("transportadoras").select("id, nome, ativo").order("nome")).data ?? [],
    enabled: !!empresaId,
  });
  const { data: produtos } = useQuery({
    queryKey: ["produtos_pc", empresaId],
    queryFn: async () => (await supabase.from("produtos").select("id, nome, preco_custo").eq("deletado", false).order("nome")).data ?? [],
    enabled: !!empresaId,
  });

  const fornecedor = useMemo(() => (fornecedores ?? []).find((f: any) => f.id === fornecedorId), [fornecedores, fornecedorId]);

  // Carrega o pedido existente: itens ligados ao Pré-Projeto vêm de pedidos_compra_itens (fonte de verdade),
  // itens avulsos (sem ligação) vêm do retrato do documento.
  useEffect(() => {
    if (!id) return;
    (async () => {
      const { data, error } = await supabase.from("pedidos_compra" as any).select("*").eq("id", id).single();
      if (error || !data) return;
      const d: any = data;
      setNumero(d.numero);
      setStatus(d.status || "rascunho");
      setDataPedido(d.data_pedido || hojeISO());
      setFornecedorId(d.fornecedor_id || "");
      setNumeroFornecedor(d.numero_fornecedor || "");
      setVendedor(d.vendedor || "");
      setValidadeProposta(d.validade_proposta || "");
      setPrevisaoFaturamento(d.previsao_faturamento || "");
      setFormaPagamento(d.forma_pagamento || "");
      setCondicaoPagamento(d.condicao_pagamento || "");
      setPrazoEntrega(d.prazo_entrega || "");
      setFreteTipo(d.frete_tipo || "");
      setTransportadoraId(d.transportadora_id || "");
      setFrete(Number(d.frete || 0));
      setDescontoTotal(Number(d.desconto_total || 0));
      setIpi(Number(d.ipi || 0));
      setIcmsSt(Number(d.icms_st || 0));
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
        codigo: l.codigo_fornecedor || porCrm[l.crm_item_id]?.codigo || "",
        ncm: l.ncm || porCrm[l.crm_item_id]?.ncm || "",
        unidade: l.unidade || "",
        descricao: l.descricao,
        qtd: Number(l.quantidade),
        valor_unit: Number(l.valor_unit || 0),
        desconto: Number(l.desconto || 0),
      }));
      const avulsos: PedidoItem[] = snapshot.filter(s => !s.crm_item_id);
      setItens([...ligados, ...avulsos]);
    })();
  }, [id, profile?.full_name]);

  const totais = useMemo(
    () => totalPedido({ itens, frete, ipi, icmsSt, descontoTotal }),
    [itens, frete, ipi, icmsSt, descontoTotal],
  );
  const alertas = useMemo(
    () => alertasPolitica({
      subtotalProdutos: totais.subtotal,
      pedidoMinimo: fornecedor?.pedido_minimo,
      freteCifAcimaDe: fornecedor?.frete_cif_acima_de,
      freteTipo,
    }),
    [totais.subtotal, fornecedor, freteTipo],
  );
  const grupos = useMemo(() => agruparPorCliente(itens.map((it, idx) => ({ ...it, _idx: idx }))), [itens]);
  const recebimento = useMemo(
    () => itens.filter(i => i.pci_id).map(i => ({ descricao: i.descricao, quantidade: Number(i.qtd), recebida: Number(i.qtd_recebida || 0) })),
    [itens],
  );
  const resumoRec = useMemo(() => resumoRecebimento(recebimento), [recebimento]);

  const updateItem = (idx: number, patch: Partial<PedidoItem>) => {
    setItens(prev => prev.map((it, i) => i === idx ? { ...it, ...patch } : it));
  };
  const addAvulso = () => setItens(prev => [...prev, { descricao: "", qtd: 1, valor_unit: 0, desconto: 0 }]);
  const removeItem = (idx: number) => {
    const it = itens[idx];
    if ((it.qtd_recebida ?? 0) > 0) { toast.error("Item já recebido: estorne o recebimento antes de remover."); return; }
    setItens(prev => prev.filter((_, i) => i !== idx));
  };
  const pickProduto = (idx: number, prodId: string) => {
    const p: any = (produtos ?? []).find((x: any) => x.id === prodId);
    if (!p) return;
    updateItem(idx, { descricao: p.nome, valor_unit: Number(p.preco_custo || 0), produto_id: p.id });
  };
  const aoEscolherFornecedor = (novoId: string) => {
    setFornecedorId(novoId);
    const f: any = (fornecedores ?? []).find((x: any) => x.id === novoId);
    if (f?.condicao_pagamento_padrao && !formaPagamento) setFormaPagamento(f.condicao_pagamento_padrao);
  };
  const adicionarDoPreProjeto = (novos: PedidoItem[]) => {
    setItens(prev => [...prev.filter(it => it.descricao.trim() !== "" || it.crm_item_id), ...novos]);
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
        numero_fornecedor: numeroFornecedor || null,
        vendedor: vendedor || null,
        validade_proposta: validadeProposta || null,
        previsao_faturamento: previsaoFaturamento || null,
        forma_pagamento: formaPagamento || null,
        condicao_pagamento: condicaoPagamento || null,
        prazo_entrega: prazoEntrega || null,
        frete_tipo: freteTipo || null,
        transportadora_id: transportadoraId || null,
        observacoes: observacoes || null,
        local_entrega: localEntrega || null,
        responsavel: responsavel || null,
        frete: Number(frete || 0),
        desconto_total: Number(descontoTotal || 0),
        ipi: Number(ipi || 0),
        icms_st: Number(icmsSt || 0),
        total: Number(totais.total || 0),
        // retrato do documento (usado no PDF)
        itens: validos.map(it => ({
          codigo: it.codigo, descricao: it.descricao, ncm: it.ncm, unidade: it.unidade, qtd: it.qtd,
          valor_unit: it.valor_unit, desconto: it.desconto, crm_item_id: it.crm_item_id ?? null,
          cliente_id: it.cliente_id ?? null, cliente_nome: it.cliente_nome ?? null,
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
          unidade: l.unidade || null, codigo_fornecedor: l.codigo || null, ncm: l.ncm || null,
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
      .update({ quantidade_recebida: q, recebido_em: q > 0 ? hojeISO() : null })
      .eq("id", it.pci_id);
    if (error) { toast.error(error.message); return; }
    updateItem(idx, { qtd_recebida: q });
    const { data } = await supabase.from("pedidos_compra" as any).select("status").eq("id", id).single();
    if (data) setStatus((data as any).status);
    qc.invalidateQueries();
    toast.success(q >= it.qtd ? "Item recebido: marcado como comprado no Pré-Projeto" : q > 0 ? "Recebimento parcial registrado" : "Recebimento estornado");
  };
  const receberTudoDoGrupo = async (idxs: number[]) => {
    for (const idx of idxs) {
      const it = itens[idx];
      if (it?.pci_id && (it.qtd_recebida ?? 0) < it.qtd) await receber(idx, it.qtd);
    }
  };

  const temSalvos = itens.some(i => i.pci_id);

  return (
    <div className="mx-auto max-w-[1400px] space-y-5 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground">
            <ArrowLeft size={16} /> Pedidos
          </button>
          <h1 className="text-xl font-semibold tracking-tight">{numero ? `Pedido #${numero}` : "Novo pedido"}</h1>
          <StatusPill status={status} />
        </div>
        <div className="flex items-center gap-2">
          {id && (
            <button onClick={() => exportPedidoPDF(id, profile?.full_name || "Sistema")}
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-[13px] hover:bg-secondary">
              <FileText size={14} /> Gerar PDF
            </button>
          )}
          <button onClick={() => saveMut.mutate()} disabled={saveMut.isPending}
            className="rounded-md bg-primary px-4 py-1.5 text-[13px] font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60">
            {saveMut.isPending ? "Salvando…" : "Salvar pedido"}
          </button>
        </div>
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        {/* ===== coluna principal ===== */}
        <div className="space-y-5">
          <section className="rounded-lg border border-border bg-card p-4">
            <h2 className="mb-3 text-[14px] font-semibold">Fornecedor e documento</h2>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="sm:col-span-2">
                <label className={labelCls}>Fornecedor</label>
                <select className={inputCls} value={fornecedorId} onChange={e => aoEscolherFornecedor(e.target.value)}>
                  <option value="">Selecione o fornecedor</option>
                  {(fornecedores ?? []).map((f: any) => <option key={f.id} value={f.id}>{f.nome}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Nº do pedido no fornecedor</label>
                <input className={inputCls} value={numeroFornecedor} onChange={e => setNumeroFornecedor(e.target.value)} placeholder="Ex.: 65219" />
              </div>
              <div>
                <label className={labelCls}>Vendedor</label>
                <input className={inputCls} value={vendedor} onChange={e => setVendedor(e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Data do pedido</label>
                <input type="date" className={inputCls} value={dataPedido} onChange={e => setDataPedido(e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Proposta válida até</label>
                <input type="date" className={inputCls} value={validadeProposta} onChange={e => setValidadeProposta(e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Previsão de faturamento</label>
                <input type="date" className={inputCls} value={previsaoFaturamento} onChange={e => setPrevisaoFaturamento(e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Prazo de entrega</label>
                <input className={inputCls} value={prazoEntrega} onChange={e => setPrazoEntrega(e.target.value)} placeholder="Ex.: 4 dias úteis" />
              </div>
              <div>
                <label className={labelCls}>Forma de pagamento</label>
                <input className={inputCls} value={formaPagamento} onChange={e => setFormaPagamento(e.target.value)} placeholder="Ex.: à vista, PIX" />
              </div>
              <div>
                <label className={labelCls}>Condição</label>
                <input className={inputCls} value={condicaoPagamento} onChange={e => setCondicaoPagamento(e.target.value)} placeholder="Ex.: 30/60/90" />
              </div>
              <div>
                <label className={labelCls}>Frete por conta de</label>
                <select className={inputCls} value={freteTipo} onChange={e => setFreteTipo(e.target.value)}>
                  <option value="">Não informado</option>
                  <option value="CIF">Fornecedor (CIF)</option>
                  <option value="FOB">Comprador (FOB)</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Transportadora</label>
                <select className={inputCls} value={transportadoraId} onChange={e => setTransportadoraId(e.target.value)}>
                  <option value="">—</option>
                  {(transportadoras ?? []).map((t: any) => <option key={t.id} value={t.id}>{t.nome}</option>)}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className={labelCls}>Local de entrega</label>
                <input className={inputCls} value={localEntrega} onChange={e => setLocalEntrega(e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Responsável</label>
                <input className={inputCls} value={responsavel} onChange={e => setResponsavel(e.target.value)} />
              </div>
            </div>
          </section>

          <section className="rounded-lg border border-border bg-card">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
              <div>
                <h2 className="text-[14px] font-semibold">Itens do pedido</h2>
                <p className="text-[12px] text-muted-foreground">
                  {itens.length === 0 ? "Nenhum item ainda" : `${itens.length} ${itens.length === 1 ? "item" : "itens"} em ${grupos.length} ${grupos.length === 1 ? "grupo" : "grupos"}`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setPickerAberto(v => !v)}
                  className="inline-flex items-center gap-1.5 rounded-md bg-primary/10 px-3 py-1.5 text-[13px] font-medium text-primary hover:bg-primary/15">
                  <ListPlus size={14} /> Adicionar do Pré-Projeto
                </button>
                <button onClick={addAvulso} className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-[13px] hover:bg-secondary">
                  <Plus size={14} /> Item avulso
                </button>
              </div>
            </div>

            {pickerAberto && (
              <div className="border-b border-border p-4">
                <PickerPreProjeto
                  empresaId={empresaId}
                  jaNoPedido={itens.filter(i => i.crm_item_id).map(i => String(i.crm_item_id))}
                  pedidoAtualId={id}
                  onAdd={adicionarDoPreProjeto}
                  onClose={() => setPickerAberto(false)}
                />
              </div>
            )}

            {itens.length === 0 && !pickerAberto && (
              <div className="px-4 py-10 text-center">
                <p className="text-[14px] font-medium">Comece escolhendo os itens que precisam ser comprados</p>
                <p className="mx-auto mt-1 max-w-md text-[13px] text-muted-foreground">
                  Use “Adicionar do Pré-Projeto” para pedir itens de um ou de vários clientes no mesmo pedido.
                  Compras fora do sistema entram como item avulso.
                </p>
              </div>
            )}

            {grupos.map(g => {
              const idxs = g.itens.map((i: any) => i._idx as number);
              const subtotalGrupo = g.itens.reduce((s: number, it: any) => s + (Number(it.qtd) || 0) * (Number(it.valor_unit) || 0) - (Number(it.desconto) || 0), 0);
              const recGrupo = g.itens.filter((i: any) => i.pci_id).map((i: any) => ({ descricao: i.descricao, quantidade: Number(i.qtd), recebida: Number(i.qtd_recebida || 0) }));
              const pendentesGrupo = g.itens.some((i: any) => i.pci_id && (i.qtd_recebida ?? 0) < i.qtd);
              return (
                <div key={g.chave} className="border-b border-border last:border-b-0">
                  <div className="flex flex-wrap items-center justify-between gap-2 bg-secondary/30 px-4 py-2">
                    <div className="flex items-center gap-3">
                      <p className="text-[13px] font-semibold">{g.nome}</p>
                      {recGrupo.length > 0 && <FaixaChegada itens={recGrupo} className="w-[120px]" />}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[13px] tabular-nums text-muted-foreground">{fmtBRL(subtotalGrupo)}</span>
                      {pendentesGrupo && (
                        <button onClick={() => receberTudoDoGrupo(idxs)} className="inline-flex items-center gap-1 text-[12px] font-medium text-emerald-400 hover:underline">
                          <PackageCheck size={13} /> Receber tudo deste cliente
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-[13px]">
                      <thead className="text-[12px] text-muted-foreground">
                        <tr className="border-b border-border">
                          <th className="px-4 py-1.5 text-left font-normal">Produto</th>
                          <th className="w-[88px] px-2 py-1.5 text-right font-normal">Qtd</th>
                          <th className="w-[120px] px-2 py-1.5 text-right font-normal">Valor un.</th>
                          <th className="w-[100px] px-2 py-1.5 text-right font-normal">Desconto</th>
                          <th className="w-[110px] px-2 py-1.5 text-right font-normal">Total</th>
                          {temSalvos && <th className="w-[190px] px-2 py-1.5 text-left font-normal">Chegou</th>}
                          <th className="w-[36px]" />
                        </tr>
                      </thead>
                      <tbody>
                        {g.itens.map((it: any) => {
                          const idx = it._idx as number;
                          const total = (Number(it.qtd) || 0) * (Number(it.valor_unit) || 0) - (Number(it.desconto) || 0);
                          const ligado = !!it.crm_item_id;
                          return (
                            <tr key={it.pci_id ?? `n${idx}`} className="border-b border-border/60 last:border-b-0">
                              <td className="px-4 py-1.5 align-top">
                                {ligado ? (
                                  <div className="py-1">
                                    <p>{it.descricao}</p>
                                    <p className="text-[12px] text-muted-foreground">
                                      {[it.codigo && `Cód. ${it.codigo}`, it.ncm && `NCM ${it.ncm}`, it.unidade].filter(Boolean).join(" · ") || " "}
                                    </p>
                                  </div>
                                ) : (
                                  <>
                                    <input list={`prod-${idx}`} className={inputCls} value={it.descricao} placeholder="Buscar produto ou digitar o item"
                                      onChange={e => {
                                        const val = e.target.value;
                                        const match = (produtos ?? []).find((p: any) => p.nome === val);
                                        if (match) pickProduto(idx, (match as any).id); else updateItem(idx, { descricao: val });
                                      }} />
                                    <datalist id={`prod-${idx}`}>{(produtos ?? []).map((p: any) => <option key={p.id} value={p.nome} />)}</datalist>
                                    <div className="mt-1 flex gap-2">
                                      <input className={inputCls + " w-[130px]"} placeholder="Código" value={it.codigo || ""} onChange={e => updateItem(idx, { codigo: e.target.value })} />
                                      <input className={inputCls + " w-[130px]"} placeholder="NCM" value={it.ncm || ""} onChange={e => updateItem(idx, { ncm: e.target.value })} />
                                    </div>
                                  </>
                                )}
                              </td>
                              <td className="px-2 py-1.5 align-top"><input type="number" step="0.01" min={it.qtd_recebida || 0} className={inputCls + " text-right tabular-nums"} value={it.qtd} onChange={e => updateItem(idx, { qtd: Number(e.target.value) })} /></td>
                              <td className="px-2 py-1.5 align-top"><input type="number" step="0.01" className={inputCls + " text-right tabular-nums"} value={it.valor_unit} onChange={e => updateItem(idx, { valor_unit: Number(e.target.value) })} /></td>
                              <td className="px-2 py-1.5 align-top"><input type="number" step="0.01" className={inputCls + " text-right tabular-nums"} value={it.desconto} onChange={e => updateItem(idx, { desconto: Number(e.target.value) })} /></td>
                              <td className="px-2 py-1.5 text-right align-top font-medium tabular-nums"><span className="inline-block py-1.5">{fmtBRL(total)}</span></td>
                              {temSalvos && (
                                <td className="px-2 py-1.5 align-top">
                                  {it.pci_id ? (
                                    <div className="flex items-center gap-1.5">
                                      <input type="number" step="1" min={0} max={it.qtd} className={inputCls + " w-[72px] text-right tabular-nums"}
                                        value={it.qtd_recebida ?? 0}
                                        onChange={e => updateItem(idx, { qtd_recebida: Number(e.target.value) })}
                                        onBlur={e => receber(idx, Number(e.target.value))} />
                                      <span className="text-[12px] tabular-nums text-muted-foreground">de {it.qtd}</span>
                                      {(it.qtd_recebida ?? 0) >= it.qtd
                                        ? <CheckCircle2 size={16} className="text-emerald-500" />
                                        : <button onClick={() => receber(idx, it.qtd)} title="Receber tudo" className="rounded p-1 text-emerald-500 hover:bg-secondary"><PackageCheck size={16} /></button>}
                                    </div>
                                  ) : <span className="text-[12px] text-muted-foreground">Salve para receber</span>}
                                </td>
                              )}
                              <td className="px-1 py-1.5 text-center align-top">
                                <button onClick={() => removeItem(idx)} title="Remover item" className="rounded p-1.5 text-muted-foreground hover:bg-secondary hover:text-red-400"><X size={14} /></button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </section>

          <section className="rounded-lg border border-border bg-card p-4">
            <label className={labelCls}>Observações do pedido</label>
            <textarea rows={3} className={inputCls} value={observacoes} onChange={e => setObservacoes(e.target.value)}
              placeholder="Combinados com o fornecedor, restrições de entrega, referência da obra…" />
          </section>
        </div>

        {/* ===== resumo fixo ===== */}
        <aside className="space-y-4 lg:sticky lg:top-4">
          <section className="rounded-lg border border-border bg-card p-4">
            <h2 className="mb-3 text-[14px] font-semibold">Resumo</h2>
            <dl className="space-y-2 text-[13px]">
              <div className="flex justify-between"><dt className="text-muted-foreground">Itens</dt><dd className="tabular-nums">{fmtBRL(totais.subtotal)}</dd></div>
              <div className="flex items-center justify-between gap-3"><dt className="text-muted-foreground">Frete</dt>
                <dd><input type="number" step="0.01" className={inputCls + " w-[120px] text-right tabular-nums"} value={frete} onChange={e => setFrete(Number(e.target.value))} /></dd></div>
              <div className="flex items-center justify-between gap-3"><dt className="text-muted-foreground">IPI</dt>
                <dd><input type="number" step="0.01" className={inputCls + " w-[120px] text-right tabular-nums"} value={ipi} onChange={e => setIpi(Number(e.target.value))} /></dd></div>
              <div className="flex items-center justify-between gap-3"><dt className="text-muted-foreground">ICMS ST</dt>
                <dd><input type="number" step="0.01" className={inputCls + " w-[120px] text-right tabular-nums"} value={icmsSt} onChange={e => setIcmsSt(Number(e.target.value))} /></dd></div>
              <div className="flex items-center justify-between gap-3"><dt className="text-muted-foreground">Desconto geral</dt>
                <dd><input type="number" step="0.01" className={inputCls + " w-[120px] text-right tabular-nums"} value={descontoTotal} onChange={e => setDescontoTotal(Number(e.target.value))} /></dd></div>
              <div className="flex items-baseline justify-between border-t border-border pt-3">
                <dt className="font-semibold">Total do pedido</dt>
                <dd className="text-xl font-semibold tabular-nums">{fmtBRL(totais.total)}</dd>
              </div>
            </dl>
          </section>

          {(alertas.length > 0 || validadeProposta) && (
            <section className="rounded-lg border border-border bg-card p-4">
              <h2 className="mb-2 text-[14px] font-semibold">Regras do fornecedor</h2>
              <ul className="space-y-2 text-[13px]">
                {alertas.map((a, i) => (
                  <li key={i} className="flex gap-2">
                    {a.tipo === "ok" ? <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-emerald-500" />
                      : a.tipo === "atencao" ? <AlertTriangle size={15} className="mt-0.5 shrink-0 text-amber-500" />
                      : <Info size={15} className="mt-0.5 shrink-0 text-sky-400" />}
                    <span>{a.texto}</span>
                  </li>
                ))}
                {validadeProposta && (
                  <li><ChipValidade validade={validadeProposta} status={status === "recebido" || status === "cancelado" ? status : "enviado"} /></li>
                )}
              </ul>
            </section>
          )}

          <section className="rounded-lg border border-border bg-card p-4">
            <h2 className="mb-2 text-[14px] font-semibold">Situação do pedido</h2>
            <select className={inputCls} value={status} onChange={e => setStatus(e.target.value)}>
              {STATUS_OPTS.map(s => <option key={s} value={s}>{statusLabel(s)}</option>)}
            </select>
            {temSalvos && (
              <div className="mt-3 space-y-1.5">
                <FaixaChegada itens={recebimento} />
                <p className="text-[12px] tabular-nums text-muted-foreground">
                  {resumoRec.completos} de {resumoRec.total} itens chegaram
                  {resumoRec.parciais > 0 ? `, ${resumoRec.parciais} parcial${resumoRec.parciais > 1 ? "is" : ""}` : ""}
                </p>
              </div>
            )}
            <p className="mt-3 text-[12px] text-muted-foreground">
              Ao receber um item por inteiro, ele passa a “comprado” no Pré-Projeto do cliente.
            </p>
          </section>
        </aside>
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
  const marcados = Object.keys(sel).length;

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
    <div className="rounded-lg border border-primary/30 bg-primary/5">
      <div className="flex flex-wrap items-center gap-2 border-b border-primary/20 px-3 py-2.5">
        <p className="text-[13px] font-medium">Itens pendentes de compra</p>
        <span className="text-[12px] text-muted-foreground">de orçamentos aprovados</span>
        <select className={inputCls + " ml-auto w-[220px]"} value={clienteFiltro} onChange={e => setClienteFiltro(e.target.value)}>
          <option value="">Todos os clientes</option>
          {(data?.clientes ?? []).map((c: any) => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>
        <input className={inputCls + " w-[200px]"} placeholder="Buscar item" value={busca} onChange={e => setBusca(e.target.value)} />
        <button onClick={onClose} className="rounded p-1 text-muted-foreground hover:text-foreground" title="Fechar"><X size={15} /></button>
      </div>
      <div className="max-h-[300px] overflow-y-auto">
        <table className="w-full text-[13px]">
          <thead className="sticky top-0 bg-card text-[12px] text-muted-foreground">
            <tr>
              <th className="w-[34px] px-3 py-1.5" />
              <th className="px-2 py-1.5 text-left font-normal">Cliente</th>
              <th className="px-2 py-1.5 text-left font-normal">Item</th>
              <th className="w-[84px] px-2 py-1.5 text-right font-normal">Falta pedir</th>
              <th className="w-[96px] px-2 py-1.5 text-right font-normal">Pedir agora</th>
              <th className="w-[100px] px-2 py-1.5 text-right font-normal">Custo un.</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={6} className="py-6 text-center text-muted-foreground">Carregando itens…</td></tr>
            ) : visiveis.length === 0 ? (
              <tr><td colSpan={6} className="py-6 text-center text-muted-foreground">Nenhum item pendente disponível.</td></tr>
            ) : visiveis.map((i: any) => (
              <tr key={i.id} className="border-t border-border/60 hover:bg-secondary/20">
                <td className="px-3 py-1.5"><input type="checkbox" checked={sel[i.id] != null} onChange={() => toggle(i)} /></td>
                <td className="px-2 py-1.5">{i.cliente_nome}</td>
                <td className="px-2 py-1.5">{i.descricao}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{i.restante}</td>
                <td className="px-2 py-1">
                  <input type="number" step="1" min={1} max={i.restante} disabled={sel[i.id] == null}
                    className={inputCls + " text-right tabular-nums"} value={sel[i.id] ?? ""}
                    onChange={e => setSel(prev => ({ ...prev, [i.id]: Math.min(Number(e.target.value) || 0, i.restante) }))} />
                </td>
                <td className="px-2 py-1.5 text-right tabular-nums">{fmtBRL(Number(i.preco_custo || 0))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between border-t border-primary/20 px-3 py-2.5">
        <p className="text-[12px] text-muted-foreground">{marcados === 0 ? "Marque os itens que vão neste pedido" : `${marcados} ${marcados === 1 ? "item marcado" : "itens marcados"}`}</p>
        <div className="flex gap-2">
          <button onClick={onClose} className="rounded-md border border-border px-3 py-1.5 text-[13px] hover:bg-secondary">Cancelar</button>
          <button onClick={adicionar} disabled={marcados === 0}
            className="rounded-md bg-primary px-3 py-1.5 text-[13px] font-medium text-primary-foreground disabled:opacity-50">Adicionar ao pedido</button>
        </div>
      </div>
    </div>
  );
};

// ============ PDF ============
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

    doc.setFont("helvetica", "bold").setFontSize(13);
    doc.text(`PEDIDO DE COMPRA Nº ${p.numero}`, pw / 2, y, { align: "center" });
    y += 7;
    doc.setFont("helvetica", "normal").setFontSize(9);
    doc.text(`Data: ${fmtDate(p.data_pedido)}   Situação: ${statusLabel(p.status)}${p.numero_fornecedor ? `   Pedido do fornecedor: ${p.numero_fornecedor}` : ""}`, pw / 2, y, { align: "center" });
    y += 6;

    doc.setFont("helvetica", "bold").setFontSize(10);
    doc.text("FORNECEDOR", 12, y); y += 4;
    doc.setFont("helvetica", "normal").setFontSize(9);
    doc.text(`${forn.nome || "—"}${forn.cnpj || forn.cpf_cnpj ? "  CNPJ: " + (forn.cnpj || forn.cpf_cnpj) : ""}`, 12, y); y += 4;
    if (forn.telefone || forn.email) { doc.text(`${forn.telefone || ""}${forn.email ? "  " + forn.email : ""}`, 12, y); y += 4; }
    doc.text(`Pagamento: ${p.forma_pagamento || p.condicao_pagamento || "—"}   Prazo: ${p.prazo_entrega || "—"}   Frete: ${p.frete_tipo || "—"}   Transportadora: ${transp.nome || "—"}`, 12, y);
    y += 4;
    if (p.validade_proposta || p.vendedor || p.previsao_faturamento) {
      doc.text(`Proposta válida até: ${fmtDate(p.validade_proposta)}   Previsão de faturamento: ${fmtDate(p.previsao_faturamento)}   Vendedor: ${p.vendedor || "—"}`, 12, y);
      y += 4;
    }
    y += 2;

    // Itens, com a coluna Cliente (destino de cada item)
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
      columnStyles: { 4: { halign: "right" }, 5: { halign: "right" }, 6: { halign: "right" }, 7: { halign: "right" } },
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
    line("Itens:", fmtBRL(subtotal));
    line("Frete:", fmtBRL(Number(p.frete || 0)));
    line("IPI:", fmtBRL(Number(p.ipi || 0)));
    if (Number(p.icms_st || 0) > 0) line("ICMS ST:", fmtBRL(Number(p.icms_st || 0)));
    if (Number(p.desconto_total || 0) > 0) line("Desconto:", fmtBRL(Number(p.desconto_total || 0)));
    line("TOTAL DO PEDIDO:", fmtBRL(Number(p.total || 0)), true);
    y += 3;

    if (p.observacoes) {
      doc.setFont("helvetica", "bold").setFontSize(9); doc.text("Observações:", 12, y); y += 4;
      doc.setFont("helvetica", "normal");
      const wrapped = doc.splitTextToSize(String(p.observacoes), pw - 24);
      doc.text(wrapped, 12, y); y += wrapped.length * 4 + 2;
    }
    doc.text(`Local de entrega: ${p.local_entrega || "—"}`, 12, y); y += 5;
    doc.text(`Responsável: ${p.responsavel || "—"}`, 12, y); y += 10;

    doc.line(pw / 2 - 40, y, pw / 2 + 40, y);
    doc.setFontSize(8).text("Assinatura / Data: ___/___/______", pw / 2, y + 4, { align: "center" });

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
