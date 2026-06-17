import { useState, useMemo, useRef } from "react";
import { DollarSign, Plus, Check, Pencil, Trash2, Search, Paperclip, X, Upload, Layers, Scissors, RotateCcw, Settings, Settings2 } from "lucide-react";
import { isNotEmpty, isPositiveNumber } from "@/lib/validations";
import { useFinanceiroPagar, useCreateContaPagar, useUpdateContaPagar } from "@/hooks/useFinanceiro";
import { useFormasPagamento, useCategorias, useCreateCategoria, useDeleteCategoria } from "@/hooks/useCategorias";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/hooks/useEmpresa";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

import { fmtBRL, fmtDate, statusBadgeClass, statusLabel, rowHighlightClass } from "@/lib/financeiroUtils";
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
  { value: "comissao", label: "Comissão" },
];

const PERIODO_OPTIONS = [
  { value: "", label: "Todos" },
  { value: "mes_atual", label: "Este mês" },
  { value: "mes_passado", label: "Mês passado" },
  { value: "ano_atual", label: "Este ano" },
];

const CATEGORIA_TIPO_OPTIONS = [
  { value: "saida_operacional", label: "📤 Saída Operacional" },
  { value: "saida_financeira", label: "💰 Saída Financeira" },
  { value: "saida_especial", label: "⭐ Saída Especial" },
  { value: "produto", label: "📦 Produto" },
  { value: "entrada", label: "📥 Entrada" },
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

const tipoBadge = (c: any) => {
  const getTipo = (conta: any) => {
    if (conta.tipo_manual && String(conta.tipo_manual).trim() !== "") {
      return String(conta.tipo_manual).toLowerCase();
    }
    const inferred = inferTipo(conta.descricao);
    if (inferred) return inferred;
    if (conta.origem === "comissao") return "comissao";
    const desc = conta?.descricao ?? "";
    if (desc.startsWith("Compra — ")) return "produto";
    return "manual";
  };

  const tipo = getTipo(c);
  const map: Record<string, { label: string; cls: string }> = {
    imposto: { label: "Imposto", cls: "bg-orange-500/10 text-orange-600 border-orange-500/20" },
    frete: { label: "Frete", cls: "bg-blue-500/10 text-blue-600 border-blue-500/20" },
    servico: { label: "Serviço", cls: "bg-purple-500/10 text-purple-600 border-purple-500/20" },
    adicional: { label: "Adicional", cls: "bg-teal-500/10 text-teal-600 border-teal-500/20" },
    produto: { label: "Produto", cls: "bg-secondary text-muted-foreground border-border" },
    comissao: { label: "Comissão", cls: "bg-purple-500/10 text-purple-600 border-purple-500/20" },
    manual: { label: "Manual", cls: "bg-secondary text-muted-foreground border-border" },
  };
  const { label, cls } = map[tipo] ?? { label: toTitleCase(tipo) || "Manual", cls: "bg-secondary text-muted-foreground border-border" };
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
   const { data: contas, isLoading, refetch } = useQuery({
     queryKey: ["financeiro_pagar", empresaId],
     queryFn: async () => {
       let query = supabase
         .from("financeiro_pagar")
         .select("*, comissao_id, fornecedores(nome), projetos(nome), categorias(id, nome)")
         .eq("empresa_id", empresaId!)
         .eq("deletado", false)
          .order("data_vencimento", { ascending: true, nullsFirst: false });
 
       const { data, error } = await query;
       if (error) {
         console.error("Erro financeiro_pagar:", error);
         throw error;
       }
       return data ?? [];
     },
     enabled: !!empresaId,
   });
  const createConta = useCreateContaPagar();
  const updateConta = useUpdateContaPagar();
  const { data: formasPgto } = useFormasPagamento();
  const { data: categorias } = useCategorias();
  const createCategoria = useCreateCategoria();
  const deleteCategoria = useDeleteCategoria();
  const [showCatManager, setShowCatManager] = useState(false);
  const [newCatName, setNewCatName] = useState("");

  

  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [desc, setDesc] = useState("");
  const [tipo, setTipo] = useState("");
  const [origem, setOrigem] = useState("manual");
  const [valor, setValor] = useState(0);
  const [vencimento, setVencimento] = useState("");
  const [fornecedorId, setFornecedorId] = useState("");
  const [projetoId, setProjetoId] = useState("");
  const [categoriaId, setCategoriaId] = useState("");
   const [descRetirada, setDescRetirada] = useState("");
   const [observacao, setObservacao] = useState("");
  const [showBaixa, setShowBaixa] = useState(false);
  const [baixaId, setBaixaId] = useState<string | null>(null);
  const [baixaData, setBaixaData] = useState(new Date().toISOString().split("T")[0]);
  const [baixaForma, setBaixaForma] = useState("");
  const [baixaObs, setBaixaObs] = useState("");

  // Parcelamento
  const [showParcelar, setShowParcelar] = useState(false);
  const [contaParaParcelar, setContaParaParcelar] = useState<any>(null);
  const [numParcelas, setNumParcelas] = useState(2);
  const [parcelasForm, setParcelasForm] = useState<any[]>([]);

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
       const { error: upErr } = await supabase.storage.from("financeiro-arquivos").upload(path, file, { upsert: true });
      if (upErr) throw upErr;
       const { data: pub } = supabase.storage.from("financeiro-arquivos").getPublicUrl(path);
       await updateConta.mutateAsync({ 
         id: editId, 
         arquivo_url: pub.publicUrl, 
         arquivo_nome: file.name,
         observacao: observacao || null
       } as any);
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

  const [statusFilter, setStatusFilter] = useState("pendente");
  const [periodoFilter, setPeriodoFilter] = useState("");
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

  const resetForm = () => { 
    setDesc(""); 
    setTipo(""); 
    setOrigem("manual");
    setValor(0); 
    setVencimento(""); 
    setFornecedorId(""); 
    setProjetoId(""); 
    setCategoriaId(""); 
    setDescRetirada(""); 
    setEditId(null); 
    setShowForm(false); 
  };

  const openEdit = (c: any) => {
    setEditId(c.id); 
    setValor(c.valor ?? 0); 
    setVencimento(c.data_vencimento ?? ""); 
    setFornecedorId(c.fornecedor_id ?? ""); 
     setProjetoId(c.projeto_id ?? "");
     setCategoriaId(c.categoria_id ?? "");
     setObservacao(c.observacao ?? "");
    setOrigem(c.origem ?? "manual");
    setTipo(c.tipo_manual ?? "");
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
      const payload = {
        descricao: finalDesc,
        valor,
        data_vencimento: vencimento || null,
        fornecedor_id: fornecedorId || null,
         projeto_id: projetoId || null,
         categoria_id: categoriaId || null,
         observacao: observacao || null,
         origem: origem,
         tipo_manual: tipo
       };

      if (editId) {
        await updateConta.mutateAsync({ id: editId, ...payload } as any);
        // Invalidar e refazer a query
        await qc.invalidateQueries({
          queryKey: ["financeiro_pagar"]
        });
        refetch();
        toast.success("Conta atualizada");
      } else {
        await createConta.mutateAsync({ ...payload, status: "pendente" } as any);
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
    const contaOriginal = (contas ?? [])
      .find((c: any) => c.id === baixaId);

    try {
      // Usar supabase direto em vez de mutation
      const { error } = await (supabase
        .from("financeiro_pagar")
        .update({
          status: "pago",
          data_pagamento: baixaData,
          observacao: baixaForma
            ? `Forma: ${baixaForma}${baixaObs
              ? ` | ${baixaObs}` : ""}`
            : (baixaObs || null)
        } as any) as any)
        .eq("id", baixaId);
      if (error) throw error

      const conta = (contas ?? []).find(
        (c: any) => c.id === baixaId
      )
      if (conta?.comissao_id) {
        await (supabase
          .from("comissoes")
          .update({
            status: "pago",
            data_pagamento: baixaData
          } as any) as any)
          .eq("id", conta.comissao_id)
      }

      // Se for comissão sincronizar
      if (contaOriginal?.comissao_id || contaOriginal?.origem === "comissao") {
        // 1. Atualizar comissoes
        if (contaOriginal?.comissao_id) {
          await (supabase
            .from("comissoes")
            .update({
              status: "pago",
              data_pagamento: baixaData,
              updated_at: new Date().toISOString()
            } as any) as any)
            .eq("id", contaOriginal.comissao_id);
        }

        // 2. Atualizar parcelas_parceiros
        // Buscar por projeto + parceiro + pendente
        if (contaOriginal?.fornecedor_id && contaOriginal?.projeto_id) {
          await supabase
            .from("parcelas_parceiros")
            .update({
              status: "pago",
              data_pagamento: baixaData
            })
            .eq("parceiro_id", contaOriginal.fornecedor_id)
            .eq("projeto_id", contaOriginal.projeto_id)
            .eq("status", "pendente");
        }
      }

      // Fechar modal
      setShowBaixa(false)
      setBaixaId(null)
      setBaixaData(new Date()
        .toISOString().split("T")[0])
      setBaixaForma("")
      setBaixaObs("")
      setDetailConta(null)
      toast.success("Pagamento registrado!")

      // 3. Invalidar TODAS as queries relevantes
      await qc.invalidateQueries({
        queryKey: ["financeiro_pagar"]
      });
      await qc.invalidateQueries({
        queryKey: ["comissoes_rt"]
      });
      await qc.invalidateQueries({
        queryKey: ["parcelas_parceiros"]
      });
      await qc.invalidateQueries({
        queryKey: ["portal_parceiros"]
      });
      await qc.invalidateQueries({
        queryKey: ["comissoes"]
      });
    } catch (err: any) {
      console.error("Erro baixa:", err)
      toast.error(
        err.message ?? "Erro ao registrar pagamento"
      )
    }
  };

  const remove = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("financeiro_pagar").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["financeiro_pagar"] }); toast.success("Conta excluída"); },
    onError: (err: any) => toast.error(err.message),
  });

   const filtered = useMemo(() => {
     let list = contas ?? [];
     if (statusFilter) list = list.filter(c => c.status === statusFilter);
     if (tipoFilter) {
       list = list.filter(c => {
         const t = (c as any).tipo_manual && String((c as any).tipo_manual).trim() !== ""
           ? String((c as any).tipo_manual).toLowerCase()
           : inferTipo(c.descricao);
         return t === tipoFilter;
       });
     }
     if (categoriaFilter) list = list.filter(c => (c as any).categoria_id === categoriaFilter);
     if (buscaFilter.trim()) {
       const q = buscaFilter.trim().toLowerCase();
       list = list.filter(c => {
         const descMatch = (c.descricao ?? "").toLowerCase().includes(q);
         const fornecedorMatch = ((c as any).fornecedores?.nome ?? "").toLowerCase().includes(q);
         return descMatch || fornecedorMatch;
       });
     }
     if (periodoFilter) {
       const today = new Date();
       const y = today.getFullYear();
       const m = today.getMonth();
       list = list.filter(c => {
         if (!c.data_vencimento) return false;
         const d = new Date(c.data_vencimento + "T00:00:00");
         if (periodoFilter === "mes_atual") return d.getFullYear() === y && d.getMonth() === m;
         if (periodoFilter === "mes_passado") {
           const pm = m === 0 ? 11 : m - 1;
           const py = m === 0 ? y - 1 : y;
           return d.getFullYear() === py && d.getMonth() === pm;
         }
         if (periodoFilter === "ano_atual") return d.getFullYear() === y;
         return true;
       });
     }
     if (dataInicio) {
       list = list.filter(c => c.data_vencimento && c.data_vencimento >= dataInicio);
     }
     if (dataFim) {
       list = list.filter(c => c.data_vencimento && c.data_vencimento <= dataFim);
     }
     return list;
   }, [contas, statusFilter, tipoFilter, categoriaFilter, periodoFilter, buscaFilter, dataInicio, dataFim]);

  const hoje = new Date().toISOString().split("T")[0];
  const totalPendente = (contas ?? []).filter(c => c.status === "pendente" && (!c.data_vencimento || c.data_vencimento >= hoje)).reduce((s, c) => s + (Number(c.valor) || 0), 0);
  const totalPago = (contas ?? []).filter(c => c.status === "pago").reduce((s, c) => s + (Number(c.valor) || 0), 0);
  const totalVencido = (contas ?? []).reduce((s, c) => {
    if (
      c.status === "pendente" &&
      c.data_vencimento &&
      c.data_vencimento < hoje
    ) {
      return s + (Number(c.valor) || 0);
    }
    return s;
  }, 0);

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

  const getStatusDisplay = (c: any) => {
    if (c.status === "pago") return "pago";
    if (c.status === "cancelado") return "cancelado";

    const hoje = new Date().toISOString().split("T")[0];
    if (c.data_vencimento && c.data_vencimento < hoje && c.status === "pendente") {
      return "vencido";
    }
    return c.status;
  };

  const openParcelar = (conta: any) => {
    setContaParaParcelar(conta);
    setNumParcelas(2);
    const valorParcela = (conta.valor ?? 0) / 2;
    const dataBase = new Date(conta.data_vencimento || new Date());
    
    const initialParcelas = Array.from({ length: 2 }).map((_, i) => {
      const data = new Date(dataBase);
      data.setMonth(data.getMonth() + i);
      return {
        valor: Number(valorParcela.toFixed(2)),
        data_vencimento: data.toISOString().split("T")[0]
      };
    });
    
    setParcelasForm(initialParcelas);
    setShowParcelar(true);
  };

  const handleNumParcelasChange = (n: number) => {
    setNumParcelas(n);
    if (!contaParaParcelar) return;
    
    const valorParcela = (contaParaParcelar.valor ?? 0) / n;
    const dataBase = new Date(contaParaParcelar.data_vencimento || new Date());
    
    const newParcelas = Array.from({ length: n }).map((_, i) => {
      const data = new Date(dataBase);
      data.setMonth(data.getMonth() + i);
      return {
        valor: Number(valorParcela.toFixed(2)),
        data_vencimento: data.toISOString().split("T")[0]
      };
    });
    
    setParcelasForm(newParcelas);
  };

  const handleEditar = (c: any) => openEdit(c);
  const handlePagar = (c: any) => openBaixa(c.id);
  const handleExcluir = (id: string) => { if (window.confirm("Excluir conta?")) remove.mutate(id); };
  const handleAbrirParcelar = (c: any) => openParcelar(c);
  const handleVisualizar = (c: any) => setDetailConta(c);

  const handleReverterPagamento = async (c: any) => {
    const confirmar = window.confirm(
      `Reverter pagamento de ${fmtBRL(c.valor)} para PENDENTE?`
    )
    if (!confirmar) return

    try {
      await supabase
        .from("financeiro_pagar")
        .update({
          status: "pendente",
          data_pagamento: null,
        })
        .eq("id", c.id)

      // Se for comissão, reverter também em comissoes e parcelas_parceiros
      if (c.comissao_id) {
        await supabase
          .from("comissoes")
          .update({ status: "pendente" })
          .eq("id", c.comissao_id)

        await supabase
          .from("parcelas_parceiros")
          .update({
            status: "pendente",
            data_pagamento: null
          })
          .eq("parceiro_id", c.fornecedor_id)
          .eq("projeto_id", c.projeto_id)
          .eq("valor", c.valor)
      }

      toast.success("Pagamento revertido para pendente!")
      qc.invalidateQueries({
        queryKey: ["financeiro_pagar"]
      })
      refetch()
    } catch (err: any) {
      toast.error(err.message || "Erro ao reverter pagamento")
    }
  }

  const handleConfirmarParcelamento = async () => {
    if (!contaParaParcelar || !empresaId) return;
    
    try {
      const totalParcelas = parcelasForm.length;
      const fornecedorNome = (contaParaParcelar.fornecedores as any)?.nome ?? "Parceiro";

      // 1. Deletar original
      const { error: delErr } = await supabase
        .from("financeiro_pagar")
        .delete()
        .eq("id", contaParaParcelar.id);
      
      if (delErr) throw delErr;

      // 2. Inserir novas em financeiro_pagar
      const parcelasPagar = parcelasForm.map((p, i) => ({
        empresa_id: empresaId,
        projeto_id: contaParaParcelar.projeto_id,
        fornecedor_id: contaParaParcelar.fornecedor_id,
        categoria_id: contaParaParcelar.categoria_id,
        comissao_id: contaParaParcelar.comissao_id,
        descricao: `Parcela ${i + 1}/${totalParcelas} — ${contaParaParcelar.descricao}`,
        valor: p.valor,
        data_vencimento: p.data_vencimento,
        status: "pendente" as "pendente",
        origem: "comissao",
        tipo_manual: "comissao"
      }));

      const { error: insErr } = await supabase
        .from("financeiro_pagar")
        .insert(parcelasPagar);
      
      if (insErr) throw insErr;

      // 3. Inserir em parcelas_parceiros
      const parcelasParceiros = parcelasForm.map((p, i) => ({
        empresa_id: empresaId,
        projeto_id: contaParaParcelar.projeto_id,
        parceiro_id: contaParaParcelar.fornecedor_id,
        parceiro_nome: fornecedorNome,
        tipo_parceiro: "arquiteto",
        descricao: `Parcela ${i + 1}/${totalParcelas} — RT`,
        valor: p.valor,
        data_vencimento: p.data_vencimento,
        status: "pendente" as "pendente"
      }));

      const { error: insParErr } = await supabase
        .from("parcelas_parceiros")
        .insert(parcelasParceiros);
      
      if (insParErr) throw insParErr;

      // 4. Invalidações
      await qc.invalidateQueries({ queryKey: ["financeiro_pagar"] });
      await qc.invalidateQueries({ queryKey: ["parcelas_parceiros"] });
      refetch();
      
      toast.success("Comissão parcelada com sucesso!");
      setShowParcelar(false);
      setContaParaParcelar(null);
    } catch (err: any) {
      toast.error(err.message || "Erro ao parcelar");
    }
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <DollarSign className="text-primary w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Contas a Pagar</h1>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Gestão Financeira</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowCatManager(true)}>
            <Settings2 className="h-4 w-4 mr-2" />
            Categorias
          </Button>
          <Button size="sm" onClick={() => { resetForm(); setShowForm(true); }}>
            <Plus className="w-4 h-4 mr-2" />
            Nova Conta
          </Button>
        </div>
      </div>

       {/* Filters */}
       <div className="bg-card border border-border rounded-lg p-3 space-y-3">
         <div className="flex flex-col md:flex-row gap-3 items-end">
           <div className="flex-1">
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
                 <div className="flex items-center gap-2 flex-wrap">
                   <select value={tipoFilter} onChange={e => setTipoFilter(e.target.value)} className={selectCls}>
                     {TIPO_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                   </select>
                   
                   <div className="flex items-center gap-1">
                     <select 
                       value={categoriaFilter} 
                       onChange={e => setCategoriaFilter(e.target.value)} 
                       className={`${selectCls} max-w-[150px]`}
                     >
                       <option value="">Todas categorias</option>
                       {Object.entries(categoriaGroups).map(([tipo, cats]) => (
                         <optgroup key={tipo} label={tipoLabels[tipo] || tipo}>
                           {cats.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                         </optgroup>
                       ))}
                     </select>
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
                   </div>
                 </div>
               }
             />
           </div>

           <div className="relative w-full md:w-64">
             <Search size={13} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
             <input
               type="text"
               value={buscaFilter}
               onChange={e => setBuscaFilter(e.target.value)}
               placeholder="Descrição ou fornecedor..."
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
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="space-y-1 col-span-1">
              <label className="text-[11px] text-muted-foreground">Origem</label>
              <select 
                value={origem} 
                onChange={e => setOrigem(e.target.value)} 
                className="w-full h-8 px-2 text-xs bg-background border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="manual">Manual</option>
                <option value="orcamento">Orçamento</option>
                <option value="comissao">Comissão</option>
              </select>
            </div>
            <div className="space-y-1 col-span-1">
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
            <div className="space-y-1 col-span-2">
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
             <div className="space-y-1 col-span-1">
               <label className="text-[11px] text-muted-foreground">Observação (opcional)</label>
               <input 
                 value={observacao} 
                 onChange={e => setObservacao(e.target.value)} 
                 placeholder="Notas internas..."
                 className="w-full h-8 px-2 text-xs bg-background border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary" 
               />
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
                        {c.origem === "orcamento" ? (
                          <span className="inline-flex px-1.5 py-0 rounded text-[9px] font-medium border bg-primary/10 text-primary border-primary/20">Orçamento</span>
                        ) : c.origem === "comissao" ? (
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
                        {(() => {
                          const statusDisplay = getStatusDisplay(c);
                          return (
                            <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                              statusDisplay === "pago"
                                ? "bg-success/15 text-success"
                              : statusDisplay === "vencido"
                                ? "bg-destructive/15 text-destructive"
                              : statusDisplay === "cancelado"
                                ? "bg-secondary text-muted-foreground"
                              : "bg-warning/15 text-warning"
                            }`}>
                              {statusDisplay === "pago" ? "PAGO"
                              : statusDisplay === "vencido" ? "VENCIDO"
                              : statusDisplay === "cancelado" ? "CANCELADO"
                              : "PENDENTE"}
                            </span>
                          );
                        })()}
                      </td>
                      <td className="px-3 py-2" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          {/* 1. Tesoura — só comissão */}
                          {(c.origem === "comissao" || c.comissao_id) && c.status !== "pago" && (
                            <button
                              onClick={() => handleAbrirParcelar(c)}
                              title="Parcelar comissão"
                              className="p-1.5 rounded hover:bg-primary/10 text-primary transition-colors"
                            >
                              <Scissors size={14} />
                            </button>
                          )}

                          {/* 2. Clipe */}
                          <button
                            onClick={() => (c as any).arquivo_url ? window.open((c as any).arquivo_url, '_blank') : openEdit(c)}
                            title="Anexar documento"
                            className={`p-1.5 rounded hover:bg-secondary transition-colors ${(c as any).arquivo_url ? "text-primary" : "text-muted-foreground"}`}
                          >
                            <Paperclip size={14} />
                          </button>

                          {/* 3. Check */}
                          {c.status !== "pago" && (
                            <button
                              onClick={() => handlePagar(c)}
                              title="Confirmar pagamento"
                              className="p-1.5 rounded hover:bg-success/10 text-success transition-colors"
                            >
                              <Check size={14} />
                            </button>
                          )}

                          {/* 4. Lupa — visualizar */}
                          <button
                            onClick={() => handleVisualizar(c)}
                            title="Visualizar detalhes"
                            className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                          >
                            <Search size={14} />
                          </button>

                          {/* 5. Lápis */}
                          <button
                            onClick={() => handleEditar(c)}
                            title="Editar"
                            className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                          >
                            <Pencil size={14} />
                          </button>

                           {/* Reverter pagamento */}
                           {c.status === "pago" && (
                             <button
                               onClick={() => handleReverterPagamento(c)}
                               title="Reverter para pendente"
                               className="p-1.5 rounded hover:bg-warning/10 text-warning transition-colors"
                             >
                               <RotateCcw size={14} />
                             </button>
                           )}

                           {/* 6. Lixeira */}
                          <button
                            onClick={() => handleExcluir(c.id)}
                            title="Excluir"
                            className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                          >
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

      <Dialog open={showParcelar} onOpenChange={setShowParcelar}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Parcelar Comissão</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Valor Total</label>
                <input 
                  type="text" 
                  readOnly 
                  value={fmtBRL(contaParaParcelar?.valor ?? 0)} 
                  className="w-full h-9 px-3 text-sm bg-muted border border-border rounded cursor-not-allowed" 
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Número de Parcelas</label>
                <select 
                  value={numParcelas} 
                  onChange={(e) => handleNumParcelasChange(Number(e.target.value))}
                  className="w-full h-9 px-3 text-sm bg-background border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  {[...Array(12)].map((_, i) => (
                    <option key={i + 1} value={i + 1}>{i + 1}x</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
              {parcelasForm.map((p, i) => (
                <div key={i} className="flex items-end gap-2 p-2 rounded border border-border bg-muted/30">
                  <div className="flex-1 space-y-1">
                    <label className="text-[10px] text-muted-foreground uppercase font-semibold">Parcela {i + 1}/{numParcelas}</label>
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <span className="text-[10px] text-muted-foreground block mb-0.5 ml-1">Valor</span>
                        <input 
                          type="number" 
                          value={p.valor} 
                          onChange={(e) => {
                            const newForm = [...parcelasForm];
                            newForm[i].valor = Number(e.target.value);
                            setParcelasForm(newForm);
                          }}
                          className="w-full h-8 px-2 text-xs bg-background border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                      </div>
                      <div className="flex-1">
                        <span className="text-[10px] text-muted-foreground block mb-0.5 ml-1">Vencimento</span>
                        <input 
                          type="date" 
                          value={p.data_vencimento} 
                          onChange={(e) => {
                            const newForm = [...parcelasForm];
                            newForm[i].data_vencimento = e.target.value;
                            setParcelasForm(newForm);
                          }}
                          className="w-full h-8 px-2 text-xs bg-background border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <button 
              onClick={() => setShowParcelar(false)} 
              className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancelar
            </button>
            <button 
              onClick={handleConfirmarParcelamento} 
              className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded hover:brightness-110 transition-all btn-press"
            >
              Confirmar Parcelamento
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Category Manager Modal */}
      <Dialog open={showCatManager} onOpenChange={setShowCatManager}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Gerenciar Categorias</DialogTitle>
            <DialogDescription>
              Adicione ou remova categorias para organizar seus lançamentos.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            {/* List Existing */}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-foreground">Categorias Existentes</h3>
              <div className="max-h-[200px] overflow-y-auto border border-border rounded-md divide-y divide-border">
                {categorias && categorias.length > 0 ? (
                  categorias.map((cat) => (
                    <div key={cat.id} className="flex items-center justify-between px-3 py-2 hover:bg-muted/50 transition-colors">
                      <span className="text-xs font-medium">{cat.nome}</span>
                      <button
                        onClick={() => {
                          if (window.confirm(`Excluir categoria "${cat.nome}"?`)) {
                            deleteCategoria.mutate(cat.id);
                          }
                        }}
                        className="p-1 text-muted-foreground hover:text-destructive transition-colors"
                        title="Excluir"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="p-4 text-center text-xs text-muted-foreground">
                    Nenhuma categoria encontrada.
                  </div>
                )}
              </div>
            </div>

            {/* Add New */}
            <div className="space-y-2 pt-4 border-t border-border">
              <h3 className="text-sm font-semibold text-foreground">Adicionar Nova Categoria</h3>
              <div className="flex gap-2">
                <Input
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  placeholder="NOME DA CATEGORIA"
                  className="h-9 text-xs uppercase"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && newCatName.trim()) {
                      createCategoria.mutate({ nome: newCatName.toUpperCase() });
                      setNewCatName("");
                    }
                  }}
                />
                <Button
                  size="sm"
                  disabled={!newCatName.trim() || createCategoria.isPending}
                  onClick={() => {
                    createCategoria.mutate({ nome: newCatName.toUpperCase() });
                    setNewCatName("");
                  }}
                >
                  <Plus size={14} className="mr-1" />
                  Adicionar
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setShowCatManager(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FinanceiroPagar;

