import { useState, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { 
  LogOut, Activity, CalendarDays,
  Image as ImageIcon, ChevronLeft, ChevronRight,
  Plus, DollarSign, MessageSquare, Clock,
  CheckCircle2, Hourglass, Target, FileText, Upload
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { statusProjetoLabels, statusProjetoColors, type StatusProjeto } from "@/lib/statusConfig";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import NotificacoesBell from "@/components/parceiros/NotificacoesBell";

const statusLabel = statusProjetoLabels as Record<string, string>;
const statusColor = statusProjetoColors as Record<string, string>;
const fmt = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

const formatDate = (date: string) => {
  if (!date) return "—";
  const [y, m, d] = date.split("-");
  return d + "/" + m + "/" + y;
};

const progressMap: Record<StatusProjeto, number> = {
  lead: 0, proposta: 5, orcamento: 10, aprovado: 15, vendido: 25,
  em_andamento: 35, infraestrutura: 45, cabeamento: 55, instalacao: 65,
  programacao: 75, personalizacao: 85, concluido: 100, pos_venda: 100,
  cancelado: 0, em_pausa: 0,
};

const PortalParceiros = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [selectedProjeto, setSelectedProjeto] = useState<string | null>(null);
  const [showNovaEntrada, setShowNovaEntrada] = useState(false);
  const [novaNota, setNovaNota] = useState("");
  const [novaVisita, setNovaVisita] = useState({
    data: new Date().toISOString().split("T")[0],
    hora: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
    descricao: "",
    servicos_executados: ""
  });

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["portal_parceiros", user?.email],
    refetchInterval: 30000,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const { data: forn } = await supabase
        .from("fornecedores")
        .select("id, nome, subtipo_parceiro, tipo")
        .eq("email", user!.email!)
        .maybeSingle();

      if (!forn) return { fornecedor: null, projetos: [], parcelas: [], comissoes: [], parcelasRT: [], ptecnico: [], lancamentos: [], leads: [] };

      let leads = [];
      if (forn.tipo === "arquiteto") {
        const { data: leadsData } = await supabase
          .from("clientes")
          .select("id, nome, status_crm, origem")
          .eq("arquiteto_id", forn.id)
          .eq("deletado", false)
          .in("status_crm", ["lead", "contato", "proposta"]);
        leads = leadsData ?? [];
      }

      let projetos = [];
      if (forn.tipo === "arquiteto") {
        const { data: p } = await supabase
          .from("projetos")
          .select("id, nome, status, endereco_obra, data_inicio, data_previsao, cliente_id, empresa_id, clientes(nome)")
          .eq("arquiteto_id", forn.id)
          .eq("deletado", false)
          .neq("status", "cancelado")
          .order("created_at", { ascending: false });
        projetos = p ?? [];
      } else {
        const { data: vis } = await supabase
          .from("visitas_tecnicas")
          .select("projeto_id")
          .eq("tecnico_id", forn.id)
          .eq("deletado", false);

        const ids = [...new Set((vis ?? []).map(v => v.projeto_id))];
        if (ids.length > 0) {
          const { data: p } = await supabase
            .from("projetos")
            .select("id, nome, status, endereco_obra, data_inicio, data_previsao, cliente_id, empresa_id, clientes(nome)")
            .in("id", ids)
            .eq("deletado", false);
          projetos = p ?? [];
        }
      }

      let parcelas = [];
      if (forn.tipo !== "tecnico") {
        const { data: parc } = await supabase
          .from("parcelas_parceiros")
          .select("*")
          .eq("parceiro_id", forn.id)
          .order("data_vencimento");
        parcelas = parc ?? [];
      }

      let comissoes = [];
      if (forn.tipo === "arquiteto") {
        const { data: com, error: comError } = await supabase
          .from("comissoes")
          .select("id, valor, status, percentual, projeto_id")
          .eq("fornecedor_id", forn.id)
          .eq("deletado", false);
        
        console.log("comissoes error:", comError);
        console.log("comissoes data:", com);
        comissoes = com ?? [];
      }

      let parcelasRT = [];
      if (forn.tipo === "arquiteto") {
        const comissaoIds = (comissoes ?? [])
          .map((c: any) => c.id)
          .filter(Boolean);

        if (comissaoIds.length > 0) {
          const { data: parc } = await supabase
            .from("financeiro_pagar")
            .select(`
              id, descricao, valor, status,
              data_vencimento, data_pagamento,
              comissao_id, projeto_id,
              projetos(id, nome)
            `)
            .eq("origem", "comissao")
            .in("comissao_id", comissaoIds)
            .order("data_vencimento");
          parcelasRT = parc ?? [];
        }
      }

      let ptecnico = [];
      let lancamentos = [];
      let previstos = [];
      if (forn.tipo === "tecnico") {
        const { data: pt } = await supabase
          .from("pagamentos_tecnico")
          .select("*, projetos(nome), clientes(nome)")
          .eq("tecnico_id", forn.id);
        ptecnico = pt ?? [];

        const { data: lanc } = await supabase
          .from("pagamentos_tecnico_lancamentos")
          .select("*, projetos(nome, clientes(nome))")
          .eq("tecnico_id", forn.id)
          .eq("tipo", "realizado")
          .order("data_pagamento", { ascending: false });
        lancamentos = lanc ?? [];

        const { data: prev } = await supabase
          .from("pagamentos_tecnico_lancamentos")
          .select("*, projetos(nome, clientes(nome))")
          .eq("tecnico_id", forn.id)
          .eq("tipo", "previsto")
          .order("data_prevista");
        previstos = prev ?? [];
      }

      return { 
        fornecedor: forn, 
        projetos, 
        parcelas, 
        comissoes,
        parcelasRT,
        ptecnico,
        lancamentos,
        previstos,
        leads
      };
    },
    enabled: !!user?.email
  });

  if (data) {
    console.log("parcelasRT:", data.parcelasRT);
    console.log("comissoes:", data.comissoes);
    console.log("fornecedor:", data.fornecedor);
    console.log("fornecedor id:", data.fornecedor?.id);
    console.log("fornecedor email:", user?.email);
    console.log("fornecedor tipo:", data.fornecedor?.tipo);
    console.log("comissaoIds:", (data.comissoes ?? []).map((c: any) => c.id));
  }

  const activeProjeto = (data?.projetos as any[])?.find(
    (p: any) => p.id === selectedProjeto
  ) ?? (data?.projetos as any[])?.find(
    (p: any) => p.projeto_id === selectedProjeto
  )?.projetos;

  console.log("PortalParceiros - Debug:", {
    selectedProjeto,
    hasProjetos: !!data?.projetos,
    projetosCount: data?.projetos?.length,
    activeProjetoFound: !!activeProjeto,
    activeProjetoId: activeProjeto?.id
  });

  const progress = activeProjeto
    ? (progressMap[activeProjeto.status as StatusProjeto] ?? 0)
    : 0;

  const { data: historico } = useQuery({
    queryKey: ["portal_parc_historico", selectedProjeto],
    queryFn: async () => {
      const { data } = await supabase.from("historico_projeto")
        .select("id, status, data, observacao")
        .eq("projeto_id", selectedProjeto!)
        .order("data", { ascending: false });
      return data ?? [];
    },
    enabled: !!selectedProjeto,
  });

  const { data: visitas, refetch: refetchVisitas } = useQuery({
    queryKey: ["portal_parc_visitas", selectedProjeto],
    queryFn: async () => {
      const { data } = await supabase.from("visitas_tecnicas")
        .select("id, data, hora, descricao, servicos_executados, status_visita")
        .eq("projeto_id", selectedProjeto!)
        .eq("deletado", false)
        .order("data", { ascending: false });
      return data ?? [];
    },
    enabled: !!selectedProjeto,
  });

  const { data: imagens } = useQuery({
    queryKey: ["portal_parc_imagens", activeProjeto?.cliente_id],
    queryFn: async () => {
      const { data } = await supabase.from("crm_arquivos")
        .select("id, nome_arquivo, url, tipo, created_at")
        .eq("cliente_id", activeProjeto!.cliente_id)
        .order("created_at", { ascending: false });
      return data?.filter(d => d.tipo === "imagem" || d.nome_arquivo?.match(/\.(jpg|jpeg|png|gif|webp)$/i)) ?? [];
    },
    enabled: !!activeProjeto?.cliente_id,
  });

  const { data: notas, refetch: refetchNotas } = useQuery({
    queryKey: ["portal_parc_notas", activeProjeto?.cliente_id],
    queryFn: async () => {
      const { data } = await supabase.from("crm_interacoes")
        .select("id, descricao, tipo, created_at")
        .eq("cliente_id", activeProjeto!.cliente_id)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!activeProjeto?.cliente_id,
  });

  const { data: documentos, refetch: refetchDocumentos } = useQuery({
    queryKey: ["portal_parc_documentos", selectedProjeto],
    queryFn: async () => {
      const { data } = await supabase.from("crm_arquivos")
        .select("id, nome_arquivo, url, tipo, created_at, autor_tipo")
        .eq("projeto_id", selectedProjeto!)
        .order("created_at", { ascending: false });
      return data?.filter(d => d.tipo !== "imagem" && !d.nome_arquivo?.match(/\.(jpg|jpeg|png|gif|webp)$/i)) ?? [];
    },
    enabled: !!selectedProjeto,
  });

  const uploadInputRef = useRef<HTMLInputElement>(null);
  const [uploadingDoc, setUploadingDoc] = useState(false);

  const handleUploadDoc = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeProjeto || !data?.fornecedor) return;
    setUploadingDoc(true);
    try {
      const path = `${data.fornecedor.tipo}/${activeProjeto.cliente_id}/${Date.now()}_${file.name}`;
      const { error: upErr } = await supabase.storage.from("crm-files").upload(path, file);
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("crm-files").getPublicUrl(path);
      const { data: { user: u } } = await supabase.auth.getUser();
      const { error: insErr } = await supabase.from("crm_arquivos" as any).insert({
        cliente_id: activeProjeto.cliente_id,
        projeto_id: selectedProjeto,
        empresa_id: activeProjeto.empresa_id,
        usuario_id: u?.id,
        autor_tipo: data.fornecedor.tipo,
        nome_arquivo: file.name,
        url: pub.publicUrl,
        tipo: file.type?.startsWith("image/") ? "imagem" : "documento",
      } as any);
      if (insErr) throw insErr;
      toast.success("Arquivo enviado");
      refetchDocumentos();
    } catch (err: any) {
      toast.error("Erro no upload: " + err.message);
    } finally {
      setUploadingDoc(false);
      if (uploadInputRef.current) uploadInputRef.current.value = "";
    }
  };

  const handleLogout = async () => { await signOut(); navigate("/login"); };

  const handleAddNota = async () => {
    if (!novaNota.trim() || !activeProjeto?.cliente_id) return;
    const { error } = await supabase.from("crm_interacoes").insert({
      cliente_id: activeProjeto.cliente_id,
      descricao: novaNota.toUpperCase(),
      tipo: "anotacao",
    });
    if (error) { toast.error("Erro ao salvar anotação"); return; }
    setNovaNota("");
    refetchNotas();
    toast.success("Anotação salva");
  };

  const handleSalvarVisita = async () => {
    if (!novaVisita.descricao || !selectedProjeto || !data?.fornecedor) return;
    const { error } = await supabase.from("visitas_tecnicas").insert({
      projeto_id: selectedProjeto,
      tecnico_id: data.fornecedor.id,
      empresa_id: activeProjeto.empresa_id,
      data: novaVisita.data,
      hora: novaVisita.hora,
      descricao: novaVisita.descricao.toUpperCase(),
      servicos_executados: novaVisita.servicos_executados.toUpperCase(),
      status_visita: "realizada"
    });
    if (error) { toast.error("Erro ao salvar entrada"); return; }
    toast.success("Entrada salva com sucesso");
    setShowNovaEntrada(false);
    setNovaVisita({
      data: new Date().toISOString().split("T")[0],
      hora: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
      descricao: "",
      servicos_executados: ""
    });
    refetchVisitas();
  };

  if (isLoading) return <div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground text-sm">Carregando...</div>;

  if (!data?.fornecedor) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-3 p-6">
        <p className="text-muted-foreground text-sm">Nenhum cadastro de parceiro encontrado para {user?.email}.</p>
        <button onClick={handleLogout} className="text-primary text-sm hover:underline">Sair</button>
      </div>
    );
  }

  const subtitle = data.fornecedor.tipo === "arquiteto" ? "Acompanhe seus projetos e RT" :
                   data.fornecedor.tipo === "tecnico" ? "Acompanhe suas visitas e projetos" :
                   "Acompanhe seus projetos";

  const renderProjectDetail = () => {
    if (!activeProjeto) return null;
    return (
      <div className="space-y-5 animate-fade-in">
        <button
          onClick={() => setSelectedProjeto(null)}
          className="flex items-center gap-2
            text-slate-500 hover:text-slate-700
            transition-colors mb-2 text-sm font-medium
            bg-slate-100 hover:bg-slate-200
            px-3 py-2 rounded-lg w-fit">
          <ChevronLeft size={16} />
          Voltar aos projetos
        </button>
        <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-2xl p-5 mb-5 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-black text-white">
                {activeProjeto?.nome}
              </h2>
              {activeProjeto?.clientes?.nome && (
                <p className="text-sm text-slate-400">
                  👤 {activeProjeto.clientes.nome}
                </p>
              )}
            </div>
            <span className={`px-3 py-1 rounded-lg text-xs font-bold shrink-0 ${statusColor[activeProjeto?.status ?? ""] ?? "bg-secondary text-secondary-foreground"}`}>
              {statusLabel[activeProjeto?.status ?? ""] ?? activeProjeto?.status}
            </span>
          </div>
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-slate-400">
              <span>Progresso da obra</span>
              <span className="font-bold text-white">
                {progress}%
              </span>
            </div>
            <Progress value={progress} className="h-2.5" />
          </div>
        </div>

      <Tabs defaultValue="rt" className="space-y-4">
        <TabsList className="w-full justify-start overflow-x-auto bg-card border border-border h-12 p-1">
          <TabsTrigger value="cronograma" className="gap-2 text-sm h-10 px-4"><CalendarDays size={18} /> Cronograma</TabsTrigger>
          {data.fornecedor.tipo === "arquiteto" && (
            <TabsTrigger 
              value="rt" 
              className="gap-2 text-sm h-10 px-4 bg-primary/5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground border-x border-primary/10"
            >
              <DollarSign size={18} /> RT e Parcelas
            </TabsTrigger>
          )}
          {data.fornecedor.tipo === "tecnico" && <TabsTrigger value="diario" className="gap-2 text-sm h-10 px-4"><Activity size={18} /> Diário de Obra</TabsTrigger>}
          <TabsTrigger value="visitas" className="gap-2 text-sm h-10 px-4"><Activity size={18} /> Visitas</TabsTrigger>
          <TabsTrigger value="imagens" className="gap-2 text-sm h-10 px-4"><ImageIcon size={18} /> Imagens</TabsTrigger>
          {data.fornecedor.tipo !== "tecnico" && <TabsTrigger value="anotacoes" className="gap-2 text-sm h-10 px-4"><MessageSquare size={18} /> Anotações</TabsTrigger>}
        </TabsList>

        <TabsContent value="cronograma" className="space-y-4">
          <div className="relative pl-4 border-l-2 border-primary/20 space-y-4">
            {(historico ?? []).map((h, i) => (
              <div key={h.id} className="relative">
                <div className={`absolute -left-[21px] top-1 w-3 h-3 rounded-full border-2 border-background ${i === 0 ? "bg-primary" : "bg-muted-foreground/40"}`} />
                <div className="flex items-center gap-2">
                  <span className={`text-[11px] px-2 py-0.5 rounded font-medium ${statusColor[h.status] ?? "bg-secondary text-secondary-foreground"}`}>
                    {statusLabel[h.status] ?? h.status}
                  </span>
                  <span className="text-[11px] text-muted-foreground">{new Date(h.data).toLocaleDateString("pt-BR")}</span>
                </div>
                {h.observacao && <p className="text-xs text-muted-foreground mt-1">{h.observacao}</p>}
              </div>
            ))}
          </div>
        </TabsContent>

        {data.fornecedor.tipo === "arquiteto" && (
          <TabsContent value="rt" className="space-y-4">
            {(() => {
              const pRT = (data?.parcelasRT ?? []).filter((p: any) => p.projeto_id === selectedProjeto);
              const useParcelasRT = pRT.length > 0;

              const projComissoes = useParcelasRT ? pRT : (data?.comissoes ?? []).filter((c: any) => c.projeto_id === selectedProjeto);
              const projRtTotal = projComissoes.reduce((s: number, c: any) => s + (Number(c.valor) || 0), 0);
              const projRtPago = projComissoes.reduce((s: number, c: any) => c.status === "pago" ? s + (Number(c.valor) || 0) : s, 0);
              const projRtPendente = projRtTotal - projRtPago;

              return (
                <>
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    <div className="bg-card border border-border rounded-xl p-3 text-center">
                      <p className="text-[10px] uppercase text-muted-foreground">RT Total</p>
                      <p className="text-lg font-black text-foreground">{fmt(projRtTotal)}</p>
                    </div>
                    <div className="bg-card border border-border rounded-xl p-3 text-center">
                      <p className="text-[10px] uppercase text-muted-foreground">Pago</p>
                      <p className="text-lg font-black text-success">{fmt(projRtPago)}</p>
                    </div>
                    <div className="bg-card border border-border rounded-xl p-3 text-center">
                      <p className="text-[10px] uppercase text-muted-foreground">Pendente</p>
                      <p className="text-lg font-black text-warning">{fmt(projRtPendente)}</p>
                    </div>
                  </div>

                  <h4 className="text-xs font-bold text-muted-foreground uppercase mb-2">
                    Comissões
                  </h4>
                  {projComissoes.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-4">
                      Nenhuma comissão registrada.
                    </p>
                  ) : (
                    <div className="border border-border rounded-lg overflow-hidden mb-4">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-secondary/60">
                            <th className="text-left px-3 py-2 border-b border-border">Projeto</th>
                            {useParcelasRT && <th className="text-left px-3 py-2 border-b border-border">Descrição</th>}
                            <th className="text-left px-3 py-2 border-b border-border">Data</th>
                            <th className="text-right px-3 py-2 border-b border-border">Valor</th>
                            <th className="text-center px-3 py-2 border-b border-border">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {projComissoes.map((c: any) => (
                            <tr key={c.id} className="border-b border-border last:border-b-0">
                              <td className="px-3 py-2">{useParcelasRT ? (c.projetos?.nome) : (c.observacao || "Comissão RT")}</td>
                              {useParcelasRT && <td className="px-3 py-2">{c.descricao}</td>}
                              <td className="px-3 py-2">
                                <div className="flex flex-col gap-0.5">
                                  {c.data_vencimento && (
                                    <span className="text-slate-500">
                                      Vence em: {formatDate(c.data_vencimento)}
                                    </span>
                                  )}
                                  {c.status === "pago" && c.data_pagamento && (
                                    <span className="text-success font-medium">
                                      Pago em: {formatDate(c.data_pagamento)}
                                    </span>
                                  )}
                                  {!c.data_vencimento && !c.data_pagamento && "—"}
                                </div>
                              </td>
                              <td className="px-3 py-2 text-right font-medium">{fmt(Number(c.valor) || 0)}</td>
                              <td className="px-3 py-2 text-center">
                                {(() => {
                                  const isPago = c.status === "pago";
                                  const hoje = new Date().toISOString().split("T")[0];
                                  const isVencido = !isPago && c.data_vencimento && c.data_vencimento < hoje;
                                  return (
                                    <span className={`px-2 py-0.5 rounded text-[11px] font-bold uppercase ${isPago ? "bg-success/15 text-success" : isVencido ? "bg-destructive/15 text-destructive" : "bg-warning/15 text-warning"}`}>
                                      {isPago ? "PAGO" : isVencido ? "VENCIDO" : "PENDENTE"}
                                    </span>
                                  );
                                })()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                </>
              );
            })()}
          </TabsContent>
        )}

        {data.fornecedor.tipo === "tecnico" && (
          <TabsContent value="diario" className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Entradas do Diário</h3>
              <button onClick={() => setShowNovaEntrada(!showNovaEntrada)} className="flex items-center gap-1.5 bg-primary text-primary-foreground px-3 py-1.5 rounded-md text-xs font-medium">
                <Plus size={14} /> Nova Entrada
              </button>
            </div>
            {showNovaEntrada && (
              <div className="bg-card border border-border rounded-lg p-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <input type="date" value={novaVisita.data} onChange={e => setNovaVisita(p => ({...p, data: e.target.value}))} className="bg-background border border-border rounded px-2 py-1.5 text-xs" />
                  <input type="time" value={novaVisita.hora} onChange={e => setNovaVisita(p => ({...p, hora: e.target.value}))} className="bg-background border border-border rounded px-2 py-1.5 text-xs" />
                </div>
                <input placeholder="Descrição / Objetivo" value={novaVisita.descricao} onChange={e => setNovaVisita(p => ({...p, descricao: e.target.value}))} className="w-full bg-background border border-border rounded px-2 py-1.5 text-xs" />
                <textarea placeholder="Serviços Executados" value={novaVisita.servicos_executados} onChange={e => setNovaVisita(p => ({...p, servicos_executados: e.target.value}))} className="w-full bg-background border border-border rounded px-2 py-1.5 text-xs min-h-[80px]" />
                <div className="flex justify-end gap-2 pt-2">
                  <button onClick={() => setShowNovaEntrada(false)} className="text-xs px-3 py-1.5 rounded border border-border">Cancelar</button>
                  <button onClick={handleSalvarVisita} className="text-xs px-3 py-1.5 rounded bg-primary text-primary-foreground font-medium">Salvar</button>
                </div>
              </div>
            )}
            <div className="space-y-3">
              {(visitas ?? []).map(v => (
                <div key={v.id} className="bg-card border border-border rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold">{new Date(v.data + "T00:00:00").toLocaleDateString("pt-BR")} às {v.hora}</span>
                  </div>
                  <p className="text-xs font-semibold">{v.descricao}</p>
                  {v.servicos_executados && <p className="text-xs text-muted-foreground bg-secondary/30 p-2 rounded">{v.servicos_executados}</p>}
                </div>
              ))}
            </div>
          </TabsContent>
        )}

        <TabsContent value="visitas" className="space-y-4">
          <div className="relative pl-4 border-l-2 border-primary/20 space-y-4">
            {(visitas ?? []).map(v => (
              <div key={v.id} className="relative">
                <div className="absolute -left-[21px] top-1 w-3 h-3 rounded-full bg-primary border-2 border-background" />
                <div className="bg-card border border-border rounded-lg p-3 space-y-1.5">
                  <span className="text-xs font-semibold">{new Date(v.data + "T00:00:00").toLocaleDateString("pt-BR")} às {v.hora}</span>
                  <p className="text-xs text-muted-foreground">{v.descricao}</p>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="imagens" className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {(imagens ?? []).map(img => (
              <a key={img.id} href={img.url} target="_blank" rel="noopener noreferrer" className="aspect-square rounded-lg overflow-hidden border border-border bg-muted">
                <img src={img.url} className="w-full h-full object-cover" />
              </a>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="anotacoes" className="space-y-4">
          <div className="flex gap-2">
            <textarea value={novaNota} onChange={(e) => setNovaNota(e.target.value)} placeholder="Adicionar nova anotação…" className="flex-1 min-h-[60px] p-2 rounded border border-border bg-background text-xs resize-none" />
            <button onClick={handleAddNota} disabled={!novaNota.trim()} className="px-3 self-start rounded bg-primary text-primary-foreground text-xs h-8 disabled:opacity-50">Salvar</button>
          </div>
          <div className="space-y-2">
            {(notas ?? []).filter(n => n.tipo === "anotacao").map(n => (
              <div key={n.id} className="bg-card border border-border rounded p-3">
                <p className="text-xs text-foreground">{n.descricao}</p>
                <p className="text-[10px] text-muted-foreground mt-1">{new Date(n.created_at).toLocaleString("pt-BR")}</p>
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
  };

  const renderProjectList = () => {
    if (data.fornecedor.tipo === "tecnico") {
      const totalContratado = (data.ptecnico ?? []).reduce((acc: number, p: any) => acc + Number(p.valor_combinado), 0);
      const totalRecebido = (data.lancamentos ?? []).reduce((acc: number, l: any) => acc + Number(l.valor), 0);
      const saldoDevedor = totalContratado - totalRecebido;

      return (
        <div className="space-y-6 animate-fade-in">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700 rounded-2xl p-5 shadow-lg flex flex-col justify-center min-h-[110px]">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Total Contratado</p>
              <p className="text-2xl font-black text-white tracking-tight">{fmt(totalContratado)}</p>
            </div>
            <div className="bg-card border border-border rounded-2xl p-5 shadow-sm flex flex-col justify-center min-h-[110px]">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Total Recebido</p>
              <p className="text-2xl font-black text-success">{fmt(totalRecebido)}</p>
            </div>
            <div className="bg-card border border-border rounded-2xl p-5 shadow-sm flex flex-col justify-center min-h-[110px]">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Saldo Devedor</p>
              <p className="text-2xl font-black text-destructive">{fmt(saldoDevedor)}</p>
            </div>
          </div>

          <div className="space-y-4">
            <h2 className="text-sm font-bold">Projetos</h2>
            <div className="border border-border rounded-2xl overflow-hidden bg-card shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-secondary/50">
                    <tr>
                      <th className="text-left p-3 font-bold uppercase tracking-wider text-muted-foreground">Projeto/Cliente</th>
                       <th className="text-right p-3 font-bold uppercase tracking-wider text-muted-foreground">Contratado</th>
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                     {(data.ptecnico ?? []).length === 0 && (
                       <tr><td colSpan={2} className="p-4 text-center text-muted-foreground">Nenhum projeto vinculado.</td></tr>
                     )}
                    {(data.ptecnico ?? []).map((p: any) => {
                      const pagoNoProjeto = (data.lancamentos ?? []).filter((l: any) => l.projeto_id === p.projeto_id).reduce((acc: number, cur: any) => acc + Number(cur.valor), 0);
                      const saldo = p.valor_combinado - pagoNoProjeto;
                      const quitado = saldo <= 0;
                      return (
                        <tr key={p.id} className="hover:bg-secondary/20 transition-colors">
                          <td className="p-3">
                            <p className="font-bold text-foreground">{p.projetos?.nome || p.clientes?.nome || "Sem nome"}</p>
                            {p.projetos?.nome && p.clientes?.nome && <p className="text-[10px] text-muted-foreground">👤 {p.clientes.nome}</p>}
                          </td>
                           <td className="p-3 text-right font-medium">{fmt(p.valor_combinado)}</td>
                         </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h2 className="text-sm font-bold">Pagamentos Recebidos</h2>
            <div className="border border-border rounded-2xl overflow-hidden bg-card shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-secondary/50">
                    <tr>
                      <th className="text-left p-3 font-bold uppercase tracking-wider text-muted-foreground w-[120px]">Data</th>
                      <th className="text-right p-3 font-bold uppercase tracking-wider text-muted-foreground w-[150px]">Valor</th>
                      <th className="text-left p-3 font-bold uppercase tracking-wider text-muted-foreground">Observação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {(data.lancamentos ?? []).length === 0 && (
                      <tr><td colSpan={3} className="p-4 text-center text-muted-foreground">Nenhum pagamento registrado.</td></tr>
                    )}
                    {(data.lancamentos ?? []).map((l: any) => (
                      <tr key={l.id} className="hover:bg-secondary/20 transition-colors">
                        <td className="p-3 text-muted-foreground w-[120px]">
                          {l.data_pagamento ? formatDate(l.data_pagamento) : "—"}
                        </td>
                        <td className="p-3 text-right font-bold text-success w-[150px]">{fmt(Number(l.valor))}</td>
                        <td className="p-3 text-muted-foreground italic truncate max-w-[200px]" title={l.observacao}>{l.observacao || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h2 className="text-sm font-bold">PRÓXIMOS PAGAMENTOS</h2>
            <div className="border border-border rounded-2xl overflow-hidden bg-card shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-secondary/50">
                    <tr>
                      <th className="text-left p-3 font-bold uppercase tracking-wider text-muted-foreground w-[120px]">Data Prevista</th>
                      <th className="text-right p-3 font-bold uppercase tracking-wider text-muted-foreground w-[150px]">Valor</th>
                      <th className="text-left p-3 font-bold uppercase tracking-wider text-muted-foreground">Observação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {(data.previstos ?? []).length === 0 && (
                      <tr><td colSpan={3} className="p-4 text-center text-muted-foreground">Nenhum pagamento previsto.</td></tr>
                    )}
                    {(data.previstos ?? []).map((l: any) => (
                      <tr key={l.id} className="hover:bg-secondary/20 transition-colors">
                        <td className="p-3 text-muted-foreground w-[120px]">
                          {l.data_prevista ? formatDate(l.data_prevista) : "—"}
                        </td>
                        <td className="p-3 text-right font-bold text-warning w-[150px]">{fmt(Number(l.valor))}</td>
                        <td className="p-3 text-muted-foreground italic truncate max-w-[200px]" title={l.observacao}>{l.observacao || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="space-y-4 pt-4 border-t border-border">
            <h2 className="text-sm font-bold">Visitas e Projetos</h2>
            <div className="grid grid-cols-1 gap-4">
              {(data?.projetos ?? []).map((p: any) => (
                <div key={p.id} onClick={() => setSelectedProjeto(p.id)}
                  className="cursor-pointer bg-card border border-border rounded-2xl p-5 shadow-sm hover:shadow-md hover:border-primary/40 hover:-translate-y-0.5 transition-all space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-foreground truncate">{p.nome}</p>
                      {p.clientes?.nome && (
                        <p className="text-[11px] text-muted-foreground mt-0.5">👤 {p.clientes.nome}</p>
                      )}
                      {p.endereco_obra && (
                        <p className="text-[11px] text-muted-foreground truncate">📍 {p.endereco_obra}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold ${statusColor[p.status] ?? "bg-secondary text-secondary-foreground"}`}>
                        {statusLabel[p.status] ?? p.status}
                      </span>
                      <ChevronRight size={16} className="text-muted-foreground" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] text-muted-foreground">
                      <span>Progresso</span>
                      <span className="font-semibold text-foreground">{progressMap[p.status as StatusProjeto] ?? 0}%</span>
                    </div>
                    <Progress value={progressMap[p.status as StatusProjeto] ?? 0} className="h-2" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-6 animate-fade-in">
        {data.fornecedor.tipo === "arquiteto" ? (() => {
        const rtTotal = (data.parcelasRT ?? [])
          .reduce((s: number, p: any) => s + Number(p.valor), 0);
        const rtPago = (data.parcelasRT ?? [])
          .filter((p: any) => p.status === "pago")
          .reduce((s: number, p: any) => s + Number(p.valor), 0);
        const rtPendente = rtTotal - rtPago;

        return (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700 rounded-2xl p-5 shadow-lg">
              <div className="absolute top-0 right-0 w-20 h-20 bg-primary/10 rounded-full -translate-y-6 translate-x-6" />
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Total RT</p>
              <p className="text-3xl font-black text-white tracking-tight">{fmt(rtTotal)}</p>
              <div className="mt-3 flex items-center gap-2">
                <div className="flex-1 h-1.5 rounded-full bg-slate-700">
                  <div className="h-full bg-primary rounded-full transition-all"
                    style={{ width: rtTotal > 0 ? `${Math.min((rtPago / rtTotal) * 100, 100)}%` : "0%" }} />
                </div>
                <span className="text-[10px] text-slate-400">{rtTotal > 0 ? Math.round((rtPago / rtTotal) * 100) : 0}%</span>
              </div>
              <p className="text-[10px] text-slate-500 mt-1">{data.comissoes?.length ?? 0} projeto(s) com RT</p>
            </div>
            <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Recebido</p>
                <div className="w-8 h-8 rounded-lg bg-success/15 flex items-center justify-center">
                  <CheckCircle2 size={16} className="text-success" />
                </div>
              </div>
              <p className="text-2xl font-black text-success">{fmt(rtPago)}</p>
              <p className="text-[11px] text-muted-foreground mt-2">Já depositado</p>
            </div>
            <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Pendente</p>
                <div className="w-8 h-8 rounded-lg bg-warning/15 flex items-center justify-center">
                  <Hourglass size={16} className="text-warning" />
                </div>
              </div>
              <p className="text-2xl font-black text-warning">{fmt(rtPendente)}</p>
              <p className="text-[11px] text-muted-foreground mt-2">A receber</p>
            </div>
          </div>
        );
      })() : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
            <p className="text-[11px] font-semibold uppercase text-muted-foreground">Total Projetos</p>
            <p className="text-xl font-bold">{data.projetos.length}</p>
          </div>
          {(data.fornecedor.tipo as string) === "tecnico" && (
            <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
              <p className="text-[11px] font-semibold uppercase text-muted-foreground">Visitas</p>
              <p className="text-xl font-bold text-primary">{visitas?.length ?? 0}</p>
            </div>
          )}
        </div>
      )}

      {data.fornecedor.tipo === "arquiteto" && (data.leads?.length ?? 0) > 0 && (
        <div className="space-y-4">
          <div className="flex flex-col gap-0.5">
            <h2 className="text-sm font-bold flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" /> Meus Leads
            </h2>
            <p className="text-[11px] text-muted-foreground">Clientes em negociação</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Coluna 1 — Lead */}
            <div className="space-y-3">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-blue-600 bg-blue-50 px-2 py-1 rounded-md w-fit flex items-center gap-1.5">
                Lead ({(data.leads as any[]).filter(l => l.status_crm?.toLowerCase() === "lead").length})
              </h3>
              <div className="flex flex-col gap-2">
                {(() => {
                  const items = (data.leads as any[]).filter(l => l.status_crm?.toLowerCase() === "lead");
                  if (items.length === 0) return <p className="text-[10px] text-muted-foreground italic px-1">Nenhum</p>;
                  return items.map(lead => (
                    <div key={lead.id} className="bg-card border border-border rounded-lg p-2.5 shadow-sm">
                      <p className="text-xs font-bold text-foreground truncate" title={lead.nome}>{lead.nome}</p>
                    </div>
                  ));
                })()}
              </div>
            </div>

            {/* Coluna 2 — Em Contato */}
            <div className="space-y-3">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-yellow-600 bg-yellow-50 px-2 py-1 rounded-md w-fit flex items-center gap-1.5">
                Em Contato ({(data.leads as any[]).filter(l => l.status_crm?.toLowerCase() === "contato").length})
              </h3>
              <div className="flex flex-col gap-2">
                {(() => {
                  const items = (data.leads as any[]).filter(l => l.status_crm?.toLowerCase() === "contato");
                  if (items.length === 0) return <p className="text-[10px] text-muted-foreground italic px-1">Nenhum</p>;
                  return items.map(lead => (
                    <div key={lead.id} className="bg-card border border-border rounded-lg p-2.5 shadow-sm">
                      <p className="text-xs font-bold text-foreground truncate" title={lead.nome}>{lead.nome}</p>
                    </div>
                  ));
                })()}
              </div>
            </div>

            {/* Coluna 3 — Proposta Enviada */}
            <div className="space-y-3">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-orange-600 bg-orange-50 px-2 py-1 rounded-md w-fit flex items-center gap-1.5">
                Proposta Enviada ({(data.leads as any[]).filter(l => l.status_crm?.toLowerCase() === "proposta").length})
              </h3>
              <div className="flex flex-col gap-2">
                {(() => {
                  const items = (data.leads as any[]).filter(l => l.status_crm?.toLowerCase() === "proposta");
                  if (items.length === 0) return <p className="text-[10px] text-muted-foreground italic px-1">Nenhum</p>;
                  return items.map(lead => (
                    <div key={lead.id} className="bg-card border border-border rounded-lg p-2.5 shadow-sm">
                      <p className="text-xs font-bold text-foreground truncate" title={lead.nome}>{lead.nome}</p>
                    </div>
                  ));
                })()}
              </div>
            </div>
          </div>
        </div>
      )}
      <div className="space-y-4">
        <h2 className="text-sm font-bold">Meus Projetos</h2>
        <div className="grid grid-cols-1 gap-4">
          {(data?.projetos ?? []).map((p: any) => (
            <div key={p.id} onClick={() => setSelectedProjeto(p.id)}
              className="cursor-pointer bg-card border border-border rounded-2xl p-5 shadow-sm hover:shadow-md hover:border-primary/40 hover:-translate-y-0.5 transition-all space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-foreground truncate">{p.nome}</p>
                  {p.clientes?.nome && (
                    <p className="text-[11px] text-muted-foreground mt-0.5">👤 {p.clientes.nome}</p>
                  )}
                  {p.endereco_obra && (
                    <p className="text-[11px] text-muted-foreground truncate">📍 {p.endereco_obra}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold ${statusColor[p.status] ?? "bg-secondary text-secondary-foreground"}`}>
                    {statusLabel[p.status] ?? p.status}
                  </span>
                  <ChevronRight size={16} className="text-muted-foreground" />
                </div>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between items-end text-[11px] text-muted-foreground">
                  <div>
                    <span>Progresso</span>
                    <p className="text-xs text-red-500 mt-1">Clique para ver detalhes →</p>
                  </div>
                  <span className="font-semibold text-foreground">{progressMap[p.status as StatusProjeto] ?? 0}%</span>
                </div>
                <Progress value={progressMap[p.status as StatusProjeto] ?? 0} className="h-2" />
              </div>
              {data.fornecedor.tipo === "arquiteto" && (() => {
                const projParcelasRT = (data?.parcelasRT ?? []).filter((prt: any) => prt.projeto_id === p.id);
                const projRtTotal = projParcelasRT.reduce((s: number, prt: any) => s + (Number(prt.valor) || 0), 0);
                const projRtPago = projParcelasRT.reduce((s: number, prt: any) => prt.status === "pago" ? s + (Number(prt.valor) || 0) : s, 0);
                
                if (projRtTotal === 0) return null;
                
                return (
                  <div className="pt-2 border-t border-border/60 grid grid-cols-3 gap-2 text-[11px]">
                    <div>
                      <p className="text-muted-foreground text-[9px] uppercase">RT Total</p>
                      <p className="font-bold text-foreground">{fmt(projRtTotal)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-[9px] uppercase">Pago</p>
                      <p className="font-bold text-success">{fmt(projRtPago)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-[9px] uppercase">Pendente</p>
                      <p className="font-bold text-warning">{fmt(projRtTotal - projRtPago)}</p>
                    </div>
                  </div>
                );
              })()}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
  };

  const iniciais = data.fornecedor.nome.split(" ").slice(0, 2).map((n: string) => n[0]?.toUpperCase()).join("");
  const primeiroNome = data.fornecedor.nome.split(" ")[0];

  const header = (
    <header className="border-b border-border bg-gradient-to-r from-slate-900 to-slate-800 sticky top-0 z-10">
      <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center text-white font-bold text-sm shadow-lg">
            {iniciais}
          </div>
          <div>
            <button
              onClick={() => {
                setSelectedProjeto(null)
              }}
              className="text-[11px] text-slate-400 uppercase tracking-widest font-medium hover:text-white transition-colors">
              INFINIT NETWORK
            </button>
            <h1 className="text-sm font-bold text-white">
              Olá, {primeiroNome} 👋
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden sm:inline text-[10px] px-2.5 py-1 rounded-full bg-primary/20 text-primary font-semibold uppercase tracking-wide">
            {data.fornecedor.tipo === "arquiteto" ? "Arquiteto Parceiro" : data.fornecedor.tipo === "tecnico" ? "Técnico" : "Parceiro"}
          </span>
          {data.fornecedor.tipo !== "tecnico" && <NotificacoesBell parceiroId={data.fornecedor.id} />}
          <button onClick={handleLogout} className="text-slate-400 hover:text-white text-xs flex items-center gap-1">
            <LogOut size={14} /> Sair
          </button>
        </div>
      </div>
      <div className="max-w-4xl mx-auto px-4 pb-3">
        <p className="text-[11px] text-slate-500 italic">
          "Construindo juntos, crescendo juntos."
        </p>
      </div>
    </header>
  );

  const footer = (
    <footer className="mt-8 px-4 pb-6 text-center space-y-1">
      <p className="text-xs font-bold text-muted-foreground">
        INFINIT NETWORK
      </p>
      <p className="text-[10px] text-muted-foreground">
        Sistema Inteligente de Gestão Comercial e Projetos
      </p>
      <p className="text-[10px] text-muted-foreground italic mt-2">
        "O Senhor é o meu pastor, nada me faltará." — Salmos 23
      </p>
    </footer>
  );

  return (
    <div className="min-h-screen bg-background">
      {header}
      <main className="max-w-4xl mx-auto p-4">
        {selectedProjeto && activeProjeto
          ? renderProjectDetail()
          : selectedProjeto && !activeProjeto
          ? (
            <div className="text-center py-12">
              <p className="text-sm text-muted-foreground">
                Carregando projeto...
              </p>
              <button
                onClick={() => setSelectedProjeto(null)}
                className="text-primary text-xs mt-2 hover:underline"
              >
                Voltar
              </button>
            </div>
          )
          : renderProjectList()
        }
      </main>
      {footer}
    </div>
  );
};

export default PortalParceiros;