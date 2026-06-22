import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { FolderKanban, LogOut, Clock, FileText, Image as ImageIcon, CalendarDays, Activity, ChevronRight, DollarSign, CalendarClock, StickyNote, ListChecks, History, Upload, Trash2, Check } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { statusProjetoLabels, statusProjetoColors, type StatusProjeto } from "@/lib/statusConfig";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";

type AnotTipo = "geral" | "pendencia" | "diario" | "comunicacao";
const tipoLabels: Record<AnotTipo, string> = {
  geral: "Geral",
  pendencia: "Pendência",
  diario: "Diário de Obra",
  comunicacao: "Comunicação",
};
const tipoColors: Record<AnotTipo, string> = {
  geral: "bg-secondary text-secondary-foreground",
  pendencia: "bg-warning/15 text-warning",
  diario: "bg-primary/15 text-primary",
  comunicacao: "bg-accent/30 text-accent-foreground",
};

function AnotacoesTab({ clienteId, projetoId, userId, userName }: { clienteId: string; projetoId: string; userId: string; userName: string }) {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<"todos" | AnotTipo>("todos");
  const [novoTipo, setNovoTipo] = useState<AnotTipo>("geral");
  const [novoTexto, setNovoTexto] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);

  const { data: itens = [] } = useQuery({
    queryKey: ["portal_anotacoes", clienteId, projetoId],
    queryFn: async () => {
      const { data } = await supabase.from("crm_interacoes" as any)
        .select("id, tipo, descricao, created_at, autor_tipo, usuario_id, status, visivel_cliente, projeto_id, cliente_id")
        .eq("cliente_id", clienteId)
        .eq("projeto_id", projetoId)
        .eq("visivel_cliente", true)
        .order("created_at", { ascending: true });
      return (data ?? []) as any[];
    },
    refetchInterval: filter === "comunicacao" ? 15000 : false,
  });

  useEffect(() => {
    if (filter === "comunicacao") chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [itens, filter]);

  const filtered = filter === "todos" ? itens : itens.filter(i => i.tipo === filter);

  const handleAdd = async () => {
    const txt = novoTexto.trim();
    if (!txt) return;
    const { error } = await supabase.from("crm_interacoes" as any).insert({
      cliente_id: clienteId,
      projeto_id: projetoId,
      tipo: novoTipo,
      descricao: txt,
      autor_tipo: "cliente",
      usuario_id: userId,
      visivel_cliente: true,
      status: novoTipo === "pendencia" ? "aberta" : null,
    } as any);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    setNovoTexto("");
    qc.invalidateQueries({ queryKey: ["portal_anotacoes", clienteId, projetoId] });
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("crm_interacoes" as any).delete().eq("id", id);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    qc.invalidateQueries({ queryKey: ["portal_anotacoes", clienteId, projetoId] });
  };

  const togglePendStatus = async (id: string, atual: string | null) => {
    const novo = atual === "concluida" ? "aberta" : "concluida";
    const { error } = await supabase.from("crm_interacoes" as any).update({ status: novo }).eq("id", id);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    qc.invalidateQueries({ queryKey: ["portal_anotacoes", clienteId, projetoId] });
  };

  const tipos: ("todos" | AnotTipo)[] = ["todos", "geral", "pendencia", "diario", "comunicacao"];

  return (
    <div className="space-y-3">
      {/* Filter row */}
      <div className="flex gap-1.5 flex-wrap">
        {tipos.map(t => (
          <button key={t} onClick={() => setFilter(t)}
            className={`px-3 py-1 rounded text-[11px] font-medium border transition-colors ${
              filter === t ? "bg-primary text-primary-foreground border-primary" : "bg-card text-muted-foreground border-border hover:border-primary/40"
            }`}>
            {t === "todos" ? "Todos" : tipoLabels[t]}
          </button>
        ))}
      </div>

      {/* Add form */}
      <div className="bg-card border border-border rounded-lg p-3 space-y-2">
        <div className="flex gap-2">
          <select value={novoTipo} onChange={e => setNovoTipo(e.target.value as AnotTipo)}
            className="text-xs bg-background border border-border rounded px-2 py-1">
            <option value="geral">Geral</option>
            <option value="pendencia">Pendência</option>
            <option value="diario">Diário de Obra</option>
            <option value="comunicacao">Comunicação</option>
          </select>
        </div>
        <Textarea value={novoTexto} onChange={e => setNovoTexto(e.target.value)}
          placeholder="Escreva uma anotação..." rows={2} className="text-xs" />
        <div className="flex justify-end">
          <Button size="sm" onClick={handleAdd} disabled={!novoTexto.trim()}>Adicionar</Button>
        </div>
      </div>

      {/* List / chat */}
      {filter === "comunicacao" ? (
        <div className="bg-card border border-border rounded-lg p-3 space-y-2 max-h-[420px] overflow-y-auto">
          {!filtered.length ? (
            <p className="text-xs text-muted-foreground py-4 text-center">Nenhuma mensagem.</p>
          ) : filtered.map(i => {
            const mine = i.usuario_id === userId;
            return (
              <div key={i.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[75%] rounded-lg px-3 py-1.5 ${mine ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"}`}>
                  {!mine && <p className="text-[10px] font-semibold opacity-70 mb-0.5">{i.autor_tipo}</p>}
                  <p className="text-xs whitespace-pre-wrap break-words">{i.descricao}</p>
                  <p className="text-[9px] opacity-60 mt-0.5 text-right">{new Date(i.created_at).toLocaleString("pt-BR")}</p>
                </div>
              </div>
            );
          })}
          <div ref={chatEndRef} />
        </div>
      ) : (
        <div className="space-y-2">
          {!filtered.length ? (
            <p className="text-xs text-muted-foreground py-6 text-center">Nenhuma anotação.</p>
          ) : filtered.map(i => {
            const mine = i.usuario_id === userId;
            const tipo = (i.tipo ?? "geral") as AnotTipo;
            return (
              <div key={i.id} className="bg-card border border-border rounded-lg p-3 space-y-1.5">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-1.5">
                    <span className={`text-[10px] px-2 py-0.5 rounded font-medium ${tipoColors[tipo] ?? "bg-secondary text-secondary-foreground"}`}>
                      {tipoLabels[tipo] ?? tipo}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-medium">
                      {i.autor_tipo ?? "—"}
                    </span>
                    {tipo === "pendencia" && (
                      <span className={`text-[10px] px-2 py-0.5 rounded font-medium ${
                        i.status === "concluida" ? "bg-success/15 text-success" : "bg-warning/15 text-warning"
                      }`}>
                        {i.status === "concluida" ? "Concluída" : "Aberta"}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-muted-foreground">
                    {new Date(i.created_at).toLocaleString("pt-BR")}
                  </span>
                </div>
                <p className="text-xs text-foreground whitespace-pre-wrap break-words">{i.descricao}</p>
                {mine && (
                  <div className="flex items-center gap-1.5 pt-1">
                    {tipo === "pendencia" && (
                      <Button size="sm" variant="outline" className="h-6 text-[10px]"
                        onClick={() => togglePendStatus(i.id, i.status)}>
                        <Check size={11} className="mr-1" />
                        {i.status === "concluida" ? "Reabrir" : "Concluir"}
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" className="h-6 text-[10px] text-destructive"
                      onClick={() => handleDelete(i.id)}>
                      <Trash2 size={11} className="mr-1" /> Excluir
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function DocumentosUpload({ clienteId, projetoId, onUploaded }: { clienteId: string; projetoId: string; onUploaded: () => void }) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const path = `cliente/${clienteId}/${Date.now()}_${file.name}`;
      const { error: upErr } = await supabase.storage.from("crm-files").upload(path, file);
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("crm-files").getPublicUrl(path);
      const { data: { user } } = await supabase.auth.getUser();
      // resolve empresa_id via clientes
      const { data: cli } = await supabase.from("clientes").select("empresa_id").eq("id", clienteId).maybeSingle();
      const { error: insErr } = await supabase.from("crm_arquivos" as any).insert({
        cliente_id: clienteId,
        projeto_id: projetoId,
        empresa_id: cli?.empresa_id,
        usuario_id: user?.id,
        autor_tipo: "cliente",
        nome_arquivo: file.name,
        url: pub.publicUrl,
        tipo: file.type?.startsWith("image/") ? "imagem" : "documento",
      } as any);
      if (insErr) throw insErr;
      toast({ title: "Arquivo enviado" });
      onUploaded();
    } catch (err: any) {
      toast({ title: "Erro no upload", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div>
      <input ref={inputRef} type="file" hidden onChange={handleFile} />
      <Button size="sm" onClick={() => inputRef.current?.click()} disabled={uploading}>
        <Upload size={13} className="mr-1.5" />
        {uploading ? "Enviando..." : "Enviar arquivo"}
      </Button>
    </div>
  );
}

const statusLabel = statusProjetoLabels as Record<string, string>;
const statusColor = statusProjetoColors as Record<string, string>;

const progressMap: Record<StatusProjeto, number> = {
  lead: 0, proposta: 5, orcamento: 10, aprovado: 15, vendido: 25,
  em_andamento: 35, infraestrutura: 45, cabeamento: 55, instalacao: 65,
  programacao: 75, personalizacao: 85, concluido: 100, pos_venda: 100,
  cancelado: 0, em_pausa: 0,
};

const PortalCliente = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedProjeto, setSelectedProjeto] = useState<string | null>(null);

  // Find client (prefer user_id link, fall back to email match)
  const { data: clienteData, isLoading } = useQuery({
    queryKey: ["portal_cliente_full", user?.id, user?.email],
    queryFn: async () => {
      let cliente: { id: string; nome: string } | null = null;
      if (user?.id) {
        const { data } = await supabase.from("clientes").select("id, nome").eq("user_id", user.id).maybeSingle();
        cliente = data ?? null;
      }
      if (!cliente && user?.email) {
        const { data } = await supabase.from("clientes").select("id, nome").eq("email", user.email).maybeSingle();
        cliente = data ?? null;
      }
      if (!cliente) return null;
      const { data: projetos } = await supabase.from("projetos")
        .select("id, nome, status, endereco_obra, data_inicio, data_previsao, descricao")
        .eq("cliente_id", cliente.id)
        .eq("deletado", false)
        .order("created_at", { ascending: false });
      return { cliente, projetos: projetos ?? [] };
    },
    enabled: !!user?.id || !!user?.email,
  });

  const projetos = clienteData?.projetos ?? [];
  const active = selectedProjeto ?? projetos[0]?.id ?? null;

  // Timeline (historico_projeto)
  const { data: historico } = useQuery({
    queryKey: ["portal_historico", active],
    queryFn: async () => {
      const { data } = await supabase.from("historico_projeto")
        .select("id, status, data, observacao")
        .eq("projeto_id", active!)
        .order("data", { ascending: false });
      return data ?? [];
    },
    enabled: !!active,
  });

  // Visitas técnicas (diário de obra)
  const { data: visitas } = useQuery({
    queryKey: ["portal_visitas", active],
    queryFn: async () => {
      const { data } = await supabase.from("visitas_tecnicas")
        .select("id, data, hora, descricao, servicos_executados, status_visita")
        .eq("projeto_id", active!)
        .eq("deletado", false)
        .order("data", { ascending: false });
      return data ?? [];
    },
    enabled: !!active,
  });

  // Documents (crm_arquivos via cliente_id)
  const { data: documentos } = useQuery({
    queryKey: ["portal_documentos", clienteData?.cliente?.id],
    queryFn: async () => {
      const { data } = await supabase.from("crm_arquivos")
        .select("id, nome_arquivo, url, tipo, created_at")
        .eq("cliente_id", clienteData!.cliente.id)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!clienteData?.cliente?.id,
  });

  // Pending items (necessidades_compra pendentes)
  const { data: pendencias } = useQuery({
    queryKey: ["portal_pendencias", active],
    queryFn: async () => {
      const { data } = await supabase.from("necessidades_compra")
        .select("id, descricao, quantidade, status")
        .eq("projeto_id", active!)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!active,
  });

  // Visitas agendadas
  const { data: agenda } = useQuery({
    queryKey: ["portal_agenda", clienteData?.cliente?.id],
    queryFn: async () => {
      const { data } = await supabase.from("agenda_visitas" as any)
        .select("id, titulo, descricao, data_inicio, data_fim, status")
        .eq("cliente_id", clienteData!.cliente.id)
        .order("data_inicio", { ascending: false });
      return (data ?? []) as any[];
    },
    enabled: !!clienteData?.cliente?.id,
  });

  // Financeiro a receber
  const { data: financeiro } = useQuery({
    queryKey: ["portal_financeiro", clienteData?.cliente?.id],
    queryFn: async () => {
      const { data } = await supabase.from("financeiro_receber")
        .select("id, descricao, valor, data_vencimento, data_recebimento, status, parcela")
        .eq("cliente_id", clienteData!.cliente.id)
        .eq("deletado", false)
        .order("data_vencimento", { ascending: true });
      return data ?? [];
    },
    enabled: !!clienteData?.cliente?.id,
  });

  const activeProjeto = projetos.find(p => p.id === active);
  const progress = activeProjeto ? (progressMap[activeProjeto.status as StatusProjeto] ?? 0) : 0;

  const handleLogout = async () => { await signOut(); navigate("/login"); };

  const imagens = documentos?.filter(d => d.tipo === "imagem" || d.nome_arquivo?.match(/\.(jpg|jpeg|png|gif|webp)$/i)) ?? [];
  const docs = documentos?.filter(d => !d.nome_arquivo?.match(/\.(jpg|jpeg|png|gif|webp)$/i) && d.tipo !== "imagem") ?? [];

  const nomeCliente = clienteData?.cliente?.nome ?? "";
  const iniciais = nomeCliente.split(" ").slice(0, 2).map(n => n[0]?.toUpperCase()).join("");
  const primeiroNome = nomeCliente.split(" ")[0] ?? "";

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header
        className="border-b border-border sticky top-0 z-10 relative overflow-hidden"
        style={{
          backgroundColor: "#0a0f1e",
          backgroundImage: [
            "radial-gradient(ellipse 80% 60% at 15% 20%, rgba(99,102,241,0.25), transparent 60%)",
            "radial-gradient(ellipse 60% 50% at 85% 30%, rgba(139,92,246,0.22), transparent 60%)",
            "radial-gradient(ellipse 70% 60% at 50% 110%, rgba(56,189,248,0.18), transparent 60%)",
            "radial-gradient(1px 1px at 20% 30%, rgba(255,255,255,0.6) 50%, transparent 100%)",
            "radial-gradient(1px 1px at 70% 60%, rgba(255,255,255,0.5) 50%, transparent 100%)",
            "radial-gradient(1px 1px at 40% 80%, rgba(255,255,255,0.45) 50%, transparent 100%)",
            "radial-gradient(1.5px 1.5px at 85% 15%, rgba(255,255,255,0.55) 50%, transparent 100%)",
            "radial-gradient(1px 1px at 10% 70%, rgba(255,255,255,0.4) 50%, transparent 100%)",
            "linear-gradient(135deg, #0a0f1e 0%, #111634 60%, #0a0f1e 100%)",
          ].join(", "),
        }}
      >
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center text-white font-bold text-sm shadow-lg">
              {iniciais || <FolderKanban size={18} />}
            </div>
            <div>
              <span className="text-[11px] text-slate-400 uppercase tracking-widest font-medium">
                INFINIT NETWORK
              </span>
              <h1 className="text-sm font-bold text-white">
                Olá, {primeiroNome || "Cliente"} 👋
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden sm:inline text-[10px] px-2.5 py-1 rounded-full bg-primary/20 text-primary font-semibold uppercase tracking-wide">
              Cliente
            </span>
            <button onClick={handleLogout} className="text-slate-400 hover:text-white text-xs flex items-center gap-1">
              <LogOut size={14} /> Sair
            </button>
          </div>
        </div>
        <div className="max-w-5xl mx-auto px-4 pb-3">
          <p className="text-[11px] text-slate-500 italic">
            "Acompanhe seu projeto em tempo real."
          </p>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-4 md:p-6 space-y-6">
        {isLoading ? (
          <p className="text-center py-12 text-sm text-muted-foreground">Carregando...</p>
        ) : !projetos.length ? (
          <div className="text-center py-16 space-y-2">
            <FolderKanban size={40} className="mx-auto text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">Nenhum projeto vinculado ao seu e-mail.</p>
          </div>
        ) : (
          <>
            {/* Project selector */}
            {projetos.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {projetos.map(p => (
                  <button
                    key={p.id}
                    onClick={() => setSelectedProjeto(p.id)}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors border ${
                      active === p.id
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-card text-muted-foreground border-border hover:border-primary/40"
                    }`}
                  >
                    {p.nome}
                  </button>
                ))}
              </div>
            )}

            {/* Tabs */}
            <Tabs defaultValue="projeto" className="space-y-4">
              <TabsList className="w-full h-auto flex flex-wrap justify-start gap-1 p-1 bg-card border border-border">
                <TabsTrigger value="projeto" className="gap-1 text-[11px] px-2 py-1 h-auto"><FolderKanban size={12} /> Projeto</TabsTrigger>
                <TabsTrigger value="anotacoes" className="gap-1 text-[11px] px-2 py-1 h-auto"><StickyNote size={12} /> Anotações</TabsTrigger>
                <TabsTrigger value="visitas" className="gap-1 text-[11px] px-2 py-1 h-auto"><CalendarClock size={12} /> Visitas Técnicas</TabsTrigger>
                <TabsTrigger value="cronograma" className="gap-1 text-[11px] px-2 py-1 h-auto"><CalendarDays size={12} /> Cronograma</TabsTrigger>
                <TabsTrigger value="imagens" className="gap-1 text-[11px] px-2 py-1 h-auto"><ImageIcon size={12} /> Imagens</TabsTrigger>
                <TabsTrigger value="documentos" className="gap-1 text-[11px] px-2 py-1 h-auto"><FileText size={12} /> Documentos</TabsTrigger>
                <TabsTrigger value="projetos" className="gap-1 text-[11px] px-2 py-1 h-auto"><ListChecks size={12} /> Projetos</TabsTrigger>
                <TabsTrigger value="timeline" className="gap-1 text-[11px] px-2 py-1 h-auto"><History size={12} /> Linha do Tempo</TabsTrigger>
                <TabsTrigger value="atividades" className="gap-1 text-[11px] px-2 py-1 h-auto"><Activity size={12} /> Atividades</TabsTrigger>
                <TabsTrigger value="financeiro" className="gap-1 text-[11px] px-2 py-1 h-auto"><DollarSign size={12} /> Financeiro</TabsTrigger>
              </TabsList>

              {/* Projeto - summary card */}
              <TabsContent value="projeto" className="space-y-3">
                {activeProjeto && (
                  <div className="bg-card border border-border rounded-lg p-5 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <div>
                        <h2 className="text-base font-bold text-foreground">{activeProjeto.nome}</h2>
                        {activeProjeto.endereco_obra && (
                          <p className="text-xs text-muted-foreground mt-0.5">📍 {activeProjeto.endereco_obra}</p>
                        )}
                      </div>
                      <span className={`self-start px-3 py-1 rounded text-xs font-semibold ${statusColor[activeProjeto.status ?? ""] ?? "bg-secondary text-secondary-foreground"}`}>
                        {statusLabel[activeProjeto.status ?? ""] ?? activeProjeto.status}
                      </span>
                    </div>
                    {activeProjeto.descricao && (
                      <p className="text-xs text-muted-foreground">{activeProjeto.descricao}</p>
                    )}
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Progresso da obra</span>
                        <span className="font-semibold text-foreground">{progress}%</span>
                      </div>
                      <Progress value={progress} className="h-2.5" />
                    </div>
                    <div className="flex gap-4 text-[11px] text-muted-foreground">
                      {activeProjeto.data_inicio && <span><Clock size={10} className="inline mr-0.5" /> Início: {activeProjeto.data_inicio}</span>}
                      {activeProjeto.data_previsao && <span>Previsão: {activeProjeto.data_previsao}</span>}
                    </div>
                  </div>
                )}
              </TabsContent>

              {/* Anotações - unified crm_interacoes */}
              <TabsContent value="anotacoes">
                {active && clienteData?.cliente?.id && user?.id ? (
                  <AnotacoesTab clienteId={clienteData.cliente.id} projetoId={active} userId={user.id} userName={nomeCliente} />
                ) : (
                  <p className="text-xs text-muted-foreground py-6 text-center">Selecione um projeto.</p>
                )}
              </TabsContent>

              {/* Visitas Técnicas (read-only agenda + visitas_tecnicas) */}
              <TabsContent value="visitas" className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground">Visitas Agendadas</h3>
                {!agenda?.length ? (
                  <p className="text-xs text-muted-foreground py-3 text-center">Nenhuma visita agendada.</p>
                ) : (
                  <div className="space-y-2">
                    {agenda.map((a: any) => (
                      <div key={a.id} className="bg-card border border-border rounded-lg p-3 space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-semibold text-foreground">{a.titulo ?? "Visita"}</p>
                          <span className={`text-[10px] px-2 py-0.5 rounded font-medium ${
                            a.status === "concluida" ? "bg-success/15 text-success" :
                            a.status === "cancelada" ? "bg-destructive/15 text-destructive" :
                            "bg-primary/15 text-primary"
                          }`}>{a.status ?? "agendada"}</span>
                        </div>
                        {a.descricao && <p className="text-[11px] text-muted-foreground">{a.descricao}</p>}
                        <p className="text-[11px] text-muted-foreground">
                          {a.data_inicio ? new Date(a.data_inicio).toLocaleString("pt-BR") : "—"}
                          {a.data_fim && <> — {new Date(a.data_fim).toLocaleString("pt-BR")}</>}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
                <h3 className="text-sm font-semibold text-foreground pt-3 border-t border-border">Visitas Realizadas</h3>
                {!visitas?.length ? (
                  <p className="text-xs text-muted-foreground py-3 text-center">Nenhuma visita realizada.</p>
                ) : (
                  <div className="space-y-2">
                    {visitas.map(v => (
                      <div key={v.id} className="bg-card border border-border rounded-lg p-3 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-foreground">
                            {v.data ? new Date(v.data + "T00:00:00").toLocaleDateString("pt-BR") : "Sem data"}
                            {v.hora && ` às ${v.hora}`}
                          </span>
                          <span className={`text-[10px] px-2 py-0.5 rounded font-medium ${
                            v.status_visita === "concluida" ? "bg-success/15 text-success" :
                            v.status_visita === "agendada" ? "bg-primary/15 text-primary" :
                            "bg-secondary text-secondary-foreground"
                          }`}>
                            {v.status_visita === "concluida" ? "Concluída" : v.status_visita === "agendada" ? "Agendada" : v.status_visita}
                          </span>
                        </div>
                        {v.descricao && <p className="text-xs text-muted-foreground">{v.descricao}</p>}
                        {v.servicos_executados && (
                          <div className="text-xs text-muted-foreground">
                            <span className="font-medium text-foreground">Serviços: </span>{v.servicos_executados}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* Cronograma - placeholder (no separate schedule source) */}
              <TabsContent value="cronograma" className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground">Cronograma</h3>
                {activeProjeto?.data_inicio || activeProjeto?.data_previsao ? (
                  <div className="bg-card border border-border rounded-lg p-4 space-y-2 text-xs">
                    {activeProjeto.data_inicio && <p><span className="font-semibold">Início:</span> {activeProjeto.data_inicio}</p>}
                    {activeProjeto.data_previsao && <p><span className="font-semibold">Previsão:</span> {activeProjeto.data_previsao}</p>}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground py-6 text-center">Em breve</p>
                )}
              </TabsContent>

              {/* Imagens */}
              <TabsContent value="imagens" className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground">Galeria de Imagens</h3>
                {!imagens.length ? (
                  <p className="text-xs text-muted-foreground py-6 text-center">Nenhuma imagem disponível.</p>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {imagens.map(img => (
                      <a key={img.id} href={img.url} target="_blank" rel="noopener noreferrer" className="group">
                        <div className="aspect-square rounded-lg overflow-hidden border border-border bg-muted">
                          <img src={img.url} alt={img.nome_arquivo} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-1 truncate">{img.nome_arquivo}</p>
                      </a>
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* Documentos */}
              <TabsContent value="documentos" className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-foreground">Documentos</h3>
                  {active && clienteData?.cliente?.id && (
                    <DocumentosUpload
                      clienteId={clienteData.cliente.id}
                      projetoId={active}
                      onUploaded={() => queryClient.invalidateQueries({ queryKey: ["portal_documentos", clienteData.cliente.id] })}
                    />
                  )}
                </div>
                {!docs.length ? (
                  <p className="text-xs text-muted-foreground py-6 text-center">Nenhum documento disponível.</p>
                ) : (
                  <div className="space-y-2">
                    {docs.map(d => (
                      <a key={d.id} href={d.url} target="_blank" rel="noopener noreferrer"
                        className="bg-card border border-border rounded-lg p-3 flex items-center gap-3 hover:border-primary/40 transition-colors">
                        <FileText size={16} className="text-primary shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-foreground truncate">{d.nome_arquivo}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {new Date(d.created_at).toLocaleDateString("pt-BR")}
                          </p>
                        </div>
                        <ChevronRight size={14} className="text-muted-foreground shrink-0" />
                      </a>
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* Projetos - list of client's projects */}
              <TabsContent value="projetos" className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground">Meus Projetos</h3>
                {!projetos.length ? (
                  <p className="text-xs text-muted-foreground py-6 text-center">Nenhum projeto.</p>
                ) : (
                  <div className="space-y-2">
                    {projetos.map(p => (
                      <button key={p.id} onClick={() => setSelectedProjeto(p.id)}
                        className={`w-full bg-card border rounded-lg p-3 flex items-center justify-between text-left transition-colors ${
                          active === p.id ? "border-primary" : "border-border hover:border-primary/40"
                        }`}>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-foreground truncate">{p.nome}</p>
                          {p.endereco_obra && <p className="text-[10px] text-muted-foreground truncate">{p.endereco_obra}</p>}
                        </div>
                        <span className={`text-[10px] px-2 py-0.5 rounded font-medium ${statusColor[p.status ?? ""] ?? "bg-secondary text-secondary-foreground"}`}>
                          {statusLabel[p.status ?? ""] ?? p.status}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* Linha do Tempo - historico_projeto */}
              <TabsContent value="timeline" className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground">Linha do Tempo</h3>
                {!historico?.length ? (
                  <p className="text-xs text-muted-foreground py-6 text-center">Nenhum histórico.</p>
                ) : (
                  <div className="relative pl-4 border-l-2 border-primary/20 space-y-3">
                    {historico.map((h, i) => (
                      <div key={h.id} className="relative">
                        <div className={`absolute -left-[21px] top-1 w-3 h-3 rounded-full border-2 border-background ${i === 0 ? "bg-primary" : "bg-muted-foreground/40"}`} />
                        <div className="flex items-start gap-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className={`text-[11px] px-2 py-0.5 rounded font-medium ${statusColor[h.status] ?? "bg-secondary text-secondary-foreground"}`}>
                                {statusLabel[h.status] ?? h.status}
                              </span>
                              <span className="text-[11px] text-muted-foreground">
                                {new Date(h.data).toLocaleDateString("pt-BR")}
                              </span>
                            </div>
                            {h.observacao && <p className="text-xs text-muted-foreground mt-1">{h.observacao}</p>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* Atividades - placeholder */}
              <TabsContent value="atividades" className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground">Atividades</h3>
                <p className="text-xs text-muted-foreground py-6 text-center">Em breve</p>
              </TabsContent>

              {/* Financeiro */}
              <TabsContent value="financeiro" className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground">Financeiro</h3>
                {!financeiro?.length ? (
                  <p className="text-xs text-muted-foreground py-6 text-center">Nenhum lançamento financeiro.</p>
                ) : (
                  <div className="border border-border rounded-lg overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-secondary/50">
                        <tr>
                          <th className="text-left px-3 py-2 font-semibold">Descrição</th>
                          <th className="text-left px-3 py-2 font-semibold">Vencimento</th>
                          <th className="text-right px-3 py-2 font-semibold">Valor</th>
                          <th className="text-center px-3 py-2 font-semibold">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {financeiro.map((f: any) => (
                          <tr key={f.id} className="border-t border-border">
                            <td className="px-3 py-2">
                              {f.descricao ?? "Lançamento"}
                              {f.parcela && <span className="text-[10px] text-muted-foreground ml-1">({f.parcela})</span>}
                            </td>
                            <td className="px-3 py-2 text-muted-foreground">{f.data_vencimento ? new Date(f.data_vencimento + "T00:00:00").toLocaleDateString("pt-BR") : "—"}</td>
                            <td className="px-3 py-2 text-right font-medium">
                              {Number(f.valor ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                            </td>
                            <td className="px-3 py-2 text-center">
                              <span className={`text-[10px] px-2 py-0.5 rounded font-medium ${
                                f.status === "pago" || f.status === "recebido" ? "bg-success/15 text-success" :
                                f.status === "atrasado" ? "bg-destructive/15 text-destructive" :
                                "bg-warning/15 text-warning"
                              }`}>{f.status ?? "pendente"}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </>
        )}
      </main>

      <footer className="px-5 py-3 border-t border-border text-center">
        <p className="text-[11px] text-muted-foreground italic">
          "O Senhor é o meu pastor, nada me faltará." — Salmos 23
        </p>
      </footer>
    </div>
  );
};

export default PortalCliente;
