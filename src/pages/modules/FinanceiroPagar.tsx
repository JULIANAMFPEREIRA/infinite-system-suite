import { useState, useMemo, useRef } from "react";
import { DollarSign, Plus, Check, Pencil, Trash2, Search, Paperclip, X, Upload } from "lucide-react";
import { isNotEmpty, isPositiveNumber } from "@/lib/validations";
import { useFinanceiroPagar, useCreateContaPagar, useUpdateContaPagar } from "@/hooks/useFinanceiro";
import { useFormasPagamento, useCategorias } from "@/hooks/useCategorias";
import { useSeedCategorias } from "@/hooks/useSeedCategorias";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/hooks/useEmpresa";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { fmtBRL, fmtDate, statusBadgeClass, statusLabel, rowHighlightClass } from "@/lib/financeiroUtils";
import FinanceiroFilters, { applyDateFilter } from "@/components/financeiro/FinanceiroFilters";
import FinanceiroDetailPanel from "@/components/financeiro/FinanceiroDetailPanel";

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

const inferTipo = (desc: string | null): string => {
  if (!desc) return "";
  const d = desc.toLowerCase();
  if (d.includes("imposto") || d.includes("taxa") || d.includes("tributo")) return "imposto";
  if (d.includes("frete") || d.includes("transporte") || d.includes("entrega")) return "frete";
  if (d.includes("serviço") || d.includes("servico") || d.includes("mão de obra") || d.includes("mao de obra") || d.includes("instalação") || d.includes("instalacao")) return "servico";
  if (d.includes("adicional")) return "adicional";
  if (d.includes("comissão") || d.includes("comissao")) return "comissao";
  if (d.includes("compra") || d.includes("produto")) return "produto";
  return "";
};

const tipoBadge = (conta: any) => {
  const desc = conta?.descricao ?? null;
  const isCompra = typeof desc === "string" && desc.startsWith("Compra — ");
  const isComissao = !!conta?.comissao_id;
  // Origem manual/comissão => Serviço por padrão; mantém detecção fina por descrição
  let tipo: string;
  if (isCompra) {
    tipo = "produto";
  } else if (isComissao) {
    tipo = "servico";
  } else {
    const inferred = inferTipo(desc);
    tipo = inferred === "produto" ? "servico" : inferred;
  }
  const map: Record<string, { label: string; cls: string }> = {
    imposto: { label: "Imposto", cls: "bg-orange-500/10 text-orange-600 border-orange-500/20" },
    frete: { label: "Frete", cls: "bg-blue-500/10 text-blue-600 border-blue-500/20" },
    servico: { label: "Serviço", cls: "bg-purple-500/10 text-purple-600 border-purple-500/20" },
    adicional: { label: "Adicional", cls: "bg-teal-500/10 text-teal-600 border-teal-500/20" },
    produto: { label: "Produto", cls: "bg-secondary text-muted-foreground border-border" },
  };
  const { label, cls } = map[tipo] ?? map.servico;
  return <span className={`inline-flex px-1.5 py-0 rounded text-[9px] font-medium border ${cls}`}>{label}</span>;
};

const RETIRADA_NOME = "RETIRADA PESSOAL (PRÓ-LABORE)";

const toTitleCase = (str: string) =>
  (str ?? "").split(" ").map(w =>
  w.charAt(0).toUpperCase() +
  w.slice(1).toLowerCase()).join(" ");

const FinanceiroPagar = () => {
  const empresaId = useEmpresa();
  const qc = useQueryClient();
  const { data: contas, isLoading } = useFinanceiroPagar();
  const createConta = useCreateContaPagar();
  const updateConta = useUpdateContaPagar();
  const { data: formasPgto } = useFormasPagamento();
  const { data: categorias } = useCategorias();
  useSeedCategorias();

  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [desc, setDesc] = useState("");
  const [tipo, setTipo] = useState("");
  const [valor, setValor] = useState(0);
  const [vencimento, setVencimento] = useState("");
  const [fornecedorId, setFornecedorId] = useState("");
  const [projetoId, setProjetoId] = useState("");
  const [categoriaId, setCategoriaId] = useState("");
  const [descRetirada, setDescRetirada] = useState("");
  const [showBaixa, setShowBaixa] = useState(false);
  const [baixaId, setBaixaId] = useState<string | null>(null);
  const [baixaData, setBaixaData] = useState(new Date().toISOString().split("T")[0]);
  const [baixaForma, setBaixaForma] = useState("");
  const [baixaObs, setBaixaObs] = useState("");

  const [detailConta, setDetailConta] = useState<any>(null);

  const [uploadingFile, setUploadingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const currentEditConta = useMemo(
    () => (editId ? (contas ?? []).find((c: any) => c.id === editId) : null),
    [editId, contas]
  );
  const arquivoUrlAtual = (currentEditConta as any)?.arquivo_url ?? null;
  const arquivoNomeAtual = (currentEditConta as any)?.arquivo_nome ?? null;

  const handleFileUpload = async (file: File) => {
    if (!editId || !empresaId) return;
    try {
      setUploadingFile(true);
      const ext = file.name.split(".").pop() ?? "bin";
      const path = `${empresaId}/financeiro-pagar/${editId}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("crm-files").upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("crm-files").getPublicUrl(path);
      await updateConta.mutateAsync({ id: editId, arquivo_url: pub.publicUrl, arquivo_nome: file.name } as any);
      toast.success("Documento anexado");
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err: any) {
      toast.error(err.message ?? "Erro no upload");
    } finally {
      setUploadingFile(false);
    }
  };

  const handleRemoveFile = async () => {
    if (!editId) return;
    try {
      await updateConta.mutateAsync({ id: editId, arquivo_url: null, arquivo_nome: null } as any);
      toast.success("Documento removido");
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const [statusFilter, setStatusFilter] = useState("");
  const [periodoFilter, setPeriodoFilter] = useState("");
  const [mesFilter, setMesFilter] = useState("");
  const [anoFilter, setAnoFilter] = useState("");
   const [tipoFilter, setTipoFilter] = useState("");
   const [categoriaFilter, setCategoriaFilter] = useState("");
    const [buscaFilter, setBuscaFilter] = useState("");
    const [dataInicio, setDataInicio] = useState("");
    const [dataFim, setDataFim] = useState("");

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
  const { data: clientes } = useQuery({
    queryKey: ["clientes_select", empresaId],
    queryFn: async () => { const { data } = await supabase.from("clientes").select("id, nome").eq("deletado", false).order("nome"); return data ?? []; },
    enabled: !!empresaId,
  });

  const resetForm = () => { setDesc(""); setTipo(""); setValor(0); setVencimento(""); setFornecedorId(""); setProjetoId(""); setCategoriaId(""); setDescRetirada(""); setEditId(null); setShowForm(false); };

  const openEdit = (c: any) => {
    setEditId(c.id); setValor(c.valor ?? 0); setVencimento(c.data_vencimento ?? ""); setFornecedorId(c.fornecedor_id ?? ""); setProjetoId(c.projeto_id ?? ""); setCategoriaId(c.categoria_id ?? "");
    setTipo(inferTipo(c.descricao) || "");
    // Parse descRetirada from description if it's a retirada
    const catName = getCatName(c.categoria_id);
    const rawDesc = c.descricao ?? "";
    if (catName?.toUpperCase() === RETIRADA_NOME && rawDesc.includes(" — ")) {
      const parts = rawDesc.split(" — ");
      setDesc(parts[0]);
      setDescRetirada(parts.slice(1).join(" — "));
    } else {
      setDesc(rawDesc);
      setDescRetirada("");
    }
    setShowForm(true);
  };

  const isRetiradaSelected = useMemo(() => {
    if (!categoriaId || !categorias) return false;
    const cat = categorias.find(c => c.id === categoriaId);
    return cat?.nome.toUpperCase() === RETIRADA_NOME;
  }, [categoriaId, categorias]);

  // Auto-suggest when selecting "Retirada Pessoal"
  const handleCategoriaChange = (catId: string) => {
    setCategoriaId(catId);
    const cat = categorias?.find(c => c.id === catId);
    if (cat && cat.nome.toUpperCase() === RETIRADA_NOME) {
      // Suggest description if empty
      if (!desc) setDesc("Retirada Pessoal (Pró-labore)");
      // Suggest "Pessoal / Administrativo" project if exists
      const pessoalProject = projetos?.find(p => p.nome.toLowerCase().includes("pessoal") || p.nome.toLowerCase().includes("administrativo"));
      if (pessoalProject && !projetoId) setProjetoId(pessoalProject.id);
      // Suggest "Juliana Pereira" as fornecedor if exists
      const juliana = fornecedores?.find(f => f.nome.toUpperCase().includes("JULIANA PEREIRA"));
      if (juliana && !fornecedorId) setFornecedorId(juliana.id);
    }
  };

  const getPlaceholder = (t: string) => {
    if (t === "frete") return "Ex: Frete — Nome do Cliente";
    if (t === "imposto") return "Ex: Imposto — ISS";
    if (t === "produto") return "Ex: Compra — Nome do Produto";
    if (t === "servico") return "Ex: Instalação — Descrição";
    return "";
  };

  const handleTipoChange = (newTipo: string) => {
    setTipo(newTipo);
    if (!desc && newTipo) {
      const placeholder = getPlaceholder(newTipo);
      if (placeholder) setDesc(placeholder);
    }
  };

  const handleSave = async () => {
    if (!isNotEmpty(desc, "Descrição")) return;
    if (!isPositiveNumber(valor, "Valor")) return;
    const finalDesc = isRetiradaSelected && descRetirada.trim() ? `${desc} — ${descRetirada.trim()}` : desc;
    try {
      if (editId) {
        await updateConta.mutateAsync({ id: editId, descricao: finalDesc, valor, data_vencimento: vencimento || null, fornecedor_id: fornecedorId || null, projeto_id: projetoId || null, categoria_id: categoriaId || null } as any);
        toast.success("Conta atualizada");
      } else {
        await createConta.mutateAsync({ descricao: finalDesc, valor, data_vencimento: vencimento || null, status: "pendente", fornecedor_id: fornecedorId || null, projeto_id: projetoId || null, categoria_id: categoriaId || null } as any);
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
      await updateConta.mutateAsync({ 
        id: baixaId, 
        status: "pago", 
        data_pagamento: baixaData,
        observacao: baixaForma ? `Forma: ${baixaForma}${baixaObs ? ` | ${baixaObs}` : ""}` : (baixaObs || null)
      } as any);
      toast.success("Pago!");
      setShowBaixa(false);
    } catch (err: any) { toast.error(err.message); }
  };

  const remove = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("financeiro_pagar").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["financeiro_pagar"] }); toast.success("Conta excluída"); },
    onError: (err: any) => toast.error(err.message),
  });

   const filtered = useMemo(() => {
     let list = contas ?? [];
     if (statusFilter) list = list.filter(c => c.status === statusFilter);
     if (tipoFilter) list = list.filter(c => inferTipo(c.descricao) === tipoFilter);
     if (categoriaFilter) list = list.filter(c => (c as any).categorias?.id === categoriaFilter);
     if (buscaFilter.trim()) {
       const q = buscaFilter.trim().toLowerCase();
       list = list.filter(c => {
         const descMatch = (c.descricao ?? "").toLowerCase().includes(q);
         const fornecedorMatch = ((c as any).fornecedores?.nome ?? "").toLowerCase().includes(q);
         return descMatch || fornecedorMatch;
       });
     }
     list = applyDateFilter(list, "data_vencimento", periodoFilter, mesFilter, anoFilter);
     if (dataInicio) {
       list = list.filter(c => c.data_vencimento && c.data_vencimento >= dataInicio);
     }
     if (dataFim) {
       list = list.filter(c => c.data_vencimento && c.data_vencimento <= dataFim);
     }
     return list;
   }, [contas, statusFilter, tipoFilter, categoriaFilter, periodoFilter, mesFilter, anoFilter, buscaFilter, dataInicio, dataFim]);

  const totalPendente = filtered.filter(c => c.status === "pendente").reduce((s, c) => s + (c.valor ?? 0), 0);
  const totalPago = filtered.filter(c => c.status === "pago").reduce((s, c) => s + (c.valor ?? 0), 0);
  const totalVencido = filtered.filter(c => c.status === "vencido").reduce((s, c) => s + (c.valor ?? 0), 0);

  const selectCls = "h-7 px-2 text-[11px] bg-background border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary";

  // Group categorias by tipo for the selector
  const categoriaGroups = useMemo(() => {
    if (!categorias) return {};
    const groups: Record<string, typeof categorias> = {};
    categorias.forEach(c => {
      const tipo = c.tipo || "outros";
      if (!groups[tipo]) groups[tipo] = [];
      groups[tipo].push(c);
    });
    return groups;
  }, [categorias]);

  const tipoLabels: Record<string, string> = {
    entrada: "📥 Entradas",
    saida_operacional: "📤 Saídas Operacionais",
    saida_financeira: "💰 Saídas Financeiras",
    saida_especial: "⭐ Saída Especial",
    produto: "📦 Produto",
    outros: "📋 Outros",
  };

  const getCatName = (catId: string | null) => {
    if (!catId || !categorias) return null;
    return categorias.find(c => c.id === catId)?.nome ?? null;
  };

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
       <div className="space-y-2">
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
                   Limpar datas
                 </button>
               )}
             </div>
           }
         />
         <div className="flex items-center gap-2">
           <select value={tipoFilter} onChange={e => setTipoFilter(e.target.value)} className={selectCls}>
             {TIPO_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
           </select>
           <select value={categoriaFilter} onChange={e => setCategoriaFilter(e.target.value)} className={selectCls}>
             <option value="">Todas categorias</option>
             {Object.entries(categoriaGroups).map(([tipo, cats]) => (
               <optgroup key={tipo} label={tipoLabels[tipo] || tipo}>
                 {cats.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
               </optgroup>
             ))}
           </select>
           <div className="relative flex-1 max-w-sm">
             <Search size={13} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
             <input
               type="text"
               value={buscaFilter}
               onChange={e => setBuscaFilter(e.target.value)}
               placeholder="Buscar por descrição ou fornecedor..."
               className={`${selectCls} w-full pl-7`}
             />
           </div>
         </div>
       </div>

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
            <div className="space-y-1 col-span-2">
              <label className="text-[11px] text-muted-foreground">Categoria</label>
              <select value={categoriaId} onChange={e => handleCategoriaChange(e.target.value)} className="w-full h-8 px-2 text-xs bg-background border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary">
                <option value="">Selecionar categoria...</option>
                {Object.entries(categoriaGroups).map(([tipoGrp, cats]) => (
                  <optgroup key={tipoGrp} label={tipoLabels[tipoGrp] || tipoGrp}>
                    {cats.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                  </optgroup>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[11px] text-muted-foreground">Tipo</label>
              <select 
                value={tipo} 
                onChange={e => handleTipoChange(e.target.value)} 
                className="w-full h-8 px-2 text-xs bg-background border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="">Selecionar tipo...</option>
                <option value="produto">Produto</option>
                <option value="servico">Serviço</option>
                <option value="frete">Frete</option>
                <option value="imposto">Imposto</option>
                <option value="adicional">Adicional</option>
                <option value="comissao">Comissão</option>
                <option value="outro">Outro</option>
              </select>
            </div>
            <div className="space-y-1 col-span-1">
              <label className="text-[11px] text-muted-foreground">Descrição</label>
              <input 
                value={desc} 
                onChange={e => setDesc(e.target.value)} 
                placeholder={getPlaceholder(tipo)}
                className="w-full h-8 px-2 text-xs bg-background border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary" 
              />
            </div>
            {isRetiradaSelected && (
              <div className="space-y-1 col-span-2">
                <label className="text-[11px] text-muted-foreground">Descrição da retirada <span className="text-muted-foreground/60">(opcional — ex: mercado, gasolina, conta pessoal)</span></label>
                <input value={descRetirada} onChange={e => setDescRetirada(e.target.value)} placeholder="No que o dinheiro foi utilizado..." className="w-full h-8 px-2 text-xs bg-background border border-primary/30 rounded focus:outline-none focus:ring-1 focus:ring-primary" />
              </div>
            )}
            <div className="space-y-1"><label className="text-[11px] text-muted-foreground">Valor</label><input type="number" value={valor} onChange={e => setValor(Number(e.target.value))} className="w-full h-8 px-2 text-xs bg-background border border-border rounded focus:outline-none" /></div>
            <div className="space-y-1"><label className="text-[11px] text-muted-foreground">Vencimento</label><input type="date" value={vencimento} onChange={e => setVencimento(e.target.value)} className="w-full h-8 px-2 text-xs bg-background border border-border rounded focus:outline-none" /></div>
            <div className="space-y-1"><label className="text-[11px] text-muted-foreground">Fornecedor / Pessoa</label>
              <select value={fornecedorId} onChange={e => setFornecedorId(e.target.value)} className="w-full h-8 px-2 text-xs bg-background border border-border rounded focus:outline-none">
                <option value="">Selecionar...</option>
                {fornecedores?.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
              </select>
            </div>
            <div className="space-y-1"><label className="text-[11px] text-muted-foreground">Projeto (opcional)</label>
              <select value={projetoId} onChange={e => setProjetoId(e.target.value)} className="w-full h-8 px-2 text-xs bg-background border border-border rounded focus:outline-none">
                <option value="">Selecionar...</option>
                {projetos?.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
              </select>
            </div>
          </div>
          {editId && (
            <div className="space-y-1 pt-1 border-t border-border">
              <label className="text-[11px] text-muted-foreground">Anexar Documento (boleto, NF, comprovante)</label>
              {arquivoUrlAtual ? (
                <div className="flex items-center gap-2 p-2 rounded border border-border bg-secondary/30">
                  <Paperclip size={13} className="text-primary shrink-0" />
                  <a href={arquivoUrlAtual} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline truncate flex-1">
                    {arquivoNomeAtual ?? "Documento anexado"}
                  </a>
                  <button type="button" onClick={handleRemoveFile} disabled={updateConta.isPending} className="p-1 rounded hover:bg-destructive/15 text-muted-foreground hover:text-destructive transition-colors" title="Remover">
                    <X size={13} />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    disabled={uploadingFile}
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleFileUpload(f); }}
                    className="text-[11px] text-muted-foreground file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-[11px] file:bg-primary file:text-primary-foreground hover:file:brightness-110 file:cursor-pointer disabled:opacity-50"
                  />
                  {uploadingFile && <span className="text-[11px] text-muted-foreground inline-flex items-center gap-1"><Upload size={11} className="animate-pulse" /> Enviando...</span>}
                </div>
              )}
            </div>
          )}
          <div className="flex gap-2">
            <button onClick={handleSave} disabled={createConta.isPending || updateConta.isPending} className="px-4 py-1.5 rounded bg-primary text-primary-foreground text-xs font-medium hover:brightness-105 disabled:opacity-50 btn-press">Salvar</button>
            <button onClick={resetForm} className="px-4 py-1.5 rounded bg-secondary text-secondary-foreground text-xs font-medium hover:bg-secondary/80 btn-press">Cancelar</button>
          </div>
        </div>
      )}

      {isLoading ? <p className="text-xs text-muted-foreground text-center py-8">Carregando...</p> : (
        <div className="border border-border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-muted/30">
                  <th className="text-center px-3 py-2.5 text-[11px] font-semibold text-muted-foreground border-b border-border whitespace-nowrap">Origem</th>
                  <th className="text-left px-3 py-2.5 text-[11px] font-semibold text-muted-foreground border-b border-border whitespace-nowrap">Categoria</th>
                  <th className="text-left px-3 py-2.5 text-[11px] font-semibold text-muted-foreground border-b border-border whitespace-nowrap">Descrição</th>
                  <th className="text-left px-3 py-2.5 text-[11px] font-semibold text-muted-foreground border-b border-border whitespace-nowrap">Tipo</th>
                  <th className="text-left px-3 py-2.5 text-[11px] font-semibold text-muted-foreground border-b border-border whitespace-nowrap">Fornecedor</th>
                  <th className="text-left px-3 py-2.5 text-[11px] font-semibold text-muted-foreground border-b border-border whitespace-nowrap">Projeto</th>
                  <th className="text-right px-3 py-2.5 text-[11px] font-semibold text-muted-foreground border-b border-border whitespace-nowrap">Valor</th>
                  <th className="text-center px-3 py-2.5 text-[11px] font-semibold text-muted-foreground border-b border-border whitespace-nowrap">Vencimento</th>
                  <th className="text-center px-3 py-2.5 text-[11px] font-semibold text-muted-foreground border-b border-border whitespace-nowrap">Pago</th>
                  <th className="text-center px-3 py-2.5 text-[11px] font-semibold text-muted-foreground border-b border-border whitespace-nowrap">Status</th>
                  <th className="text-center px-3 py-2.5 text-[11px] font-semibold text-muted-foreground border-b border-border whitespace-nowrap w-24">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => {
                  const catName = getCatName((c as any).categoria_id);
                  return (
                    <tr
                      key={c.id}
                      className={`border-b border-border last:border-b-0 hover:bg-muted/40 cursor-pointer transition-colors ${rowHighlightClass(c.data_vencimento, c.status)}`}
                      onClick={() => openEdit(c)}
                    >
                      <td className="px-3 py-2 text-xs text-center">
                        {c.descricao?.startsWith("Compra — ") ? (
                          <span className="inline-flex px-1.5 py-0 rounded text-[9px] font-medium border bg-primary/10 text-primary border-primary/20">Compra</span>
                        ) : c.comissao_id ? (
                          <span className="inline-flex px-1.5 py-0 rounded text-[9px] font-medium border bg-purple-500/10 text-purple-500 border-purple-500/20">Comissão</span>
                        ) : (
                          <span className="inline-flex px-1.5 py-0 rounded text-[9px] font-medium border bg-secondary text-muted-foreground border-border">Manual</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-xs max-w-[160px]">
                        {catName ? (
                          <span className="text-[10px] text-muted-foreground truncate block">{catName}</span>
                        ) : (
                          <span className="text-[10px] text-muted-foreground/50">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-xs max-w-[220px]">
                        <span className="font-medium text-foreground truncate block">{toTitleCase(c.descricao)}</span>
                      </td>
                      <td className="px-3 py-2 text-xs text-center">
                        {tipoBadge(c)}
                      </td>
                      <td className="px-3 py-2 text-xs text-foreground/80 max-w-[150px] truncate">{(c.fornecedores as any)?.nome ?? "—"}</td>
                      <td className="px-3 py-2 text-xs text-foreground/80 max-w-[150px] truncate">{(c.projetos as any)?.nome ?? "—"}</td>
                      <td className="px-3 py-2 text-xs text-right font-bold text-foreground tabular-nums">{fmtBRL(c.valor ?? 0)}</td>
                      <td className="px-3 py-2 text-xs text-center text-foreground/80 tabular-nums">{fmtDate(c.data_vencimento)}</td>
                      <td className="px-3 py-2 text-xs text-center text-foreground/80 tabular-nums">{c.data_pagamento ? fmtDate(c.data_pagamento) : "—"}</td>
                      <td className="px-3 py-2 text-xs text-center">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold ${statusBadgeClass(c.status ?? "pendente")}`}>
                          {statusLabel(c.status ?? "pendente")}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-center" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-0.5">
                          {(c as any).arquivo_url ? (
                            <a
                              href={(c as any).arquivo_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              title={(c as any).arquivo_nome ?? "Ver documento"}
                              className="p-1.5 rounded-md hover:bg-primary/10 text-primary transition-colors"
                            >
                              <Paperclip size={14} />
                            </a>
                          ) : (
                            <span title="Sem documento" className="p-1.5 text-muted-foreground/40 cursor-not-allowed">
                              <Paperclip size={14} />
                            </span>
                          )}
                          {c.status === "pendente" && (
                            <button onClick={() => openBaixa(c.id)} title="Registrar pagamento" className="p-1.5 rounded-md hover:bg-success/15 text-muted-foreground hover:text-success transition-colors">
                              <Check size={14} />
                            </button>
                          )}
                          <button onClick={() => setDetailConta(c)} title="Ver detalhes" className="p-1.5 rounded-md hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors">
                            <Search size={14} />
                          </button>
                          <button onClick={() => openEdit(c)} title="Editar" className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground hover:text-primary transition-colors">
                            <Pencil size={14} />
                          </button>
                          <button onClick={() => { if (window.confirm("Excluir conta?")) remove.mutate(c.id); }} title="Excluir" className="p-1.5 rounded-md hover:bg-destructive/15 text-muted-foreground hover:text-destructive transition-colors">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && <tr><td colSpan={11} className="text-center py-8 text-muted-foreground">Nenhuma conta encontrada.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Detail Panel */}
      <FinanceiroDetailPanel
        open={!!detailConta}
        onOpenChange={(o) => { if (!o) setDetailConta(null); }}
        tipo="pagar"
        conta={detailConta}
        fornecedorNome={(detailConta?.fornecedores as any)?.nome ?? "—"}
        projetoNome={(detailConta?.projetos as any)?.nome ?? "—"}
        onBaixa={() => detailConta && openBaixa(detailConta.id)}
        onEdit={() => detailConta && openEdit(detailConta)}
        onDelete={() => detailConta && remove.mutate(detailConta.id)}
      />

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
