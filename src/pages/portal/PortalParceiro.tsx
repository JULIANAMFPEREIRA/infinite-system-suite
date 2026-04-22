import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import {
  FolderKanban, DollarSign, LogOut, Clock, Activity, CalendarDays,
  Image as ImageIcon, ChevronLeft, ChevronRight, MessageSquare, History,
  Wallet, CheckCircle2, Hourglass,
} from "lucide-react";
import { statusProjetoLabels, statusProjetoColors, type StatusProjeto } from "@/lib/statusConfig";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import NotificacoesBell from "@/components/parceiros/NotificacoesBell";

const statusLabel = statusProjetoLabels as Record<string, string>;
const statusColor = statusProjetoColors as Record<string, string>;
const fmt = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

const progressMap: Record<StatusProjeto, number> = {
  lead: 0, proposta: 5, orcamento: 10, aprovado: 15, vendido: 25,
  em_andamento: 35, infraestrutura: 45, cabeamento: 55, instalacao: 65,
  programacao: 75, personalizacao: 85, concluido: 100, pos_venda: 100,
  cancelado: 0, em_pausa: 0,
};

const PortalParceiro = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [selectedProjeto, setSelectedProjeto] = useState<string | null>(null);
  const [novaNota, setNovaNota] = useState("");

  // Carrega vínculos do parceiro e dados básicos
  const { data, isLoading } = useQuery({
    queryKey: ["portal_parceiro_full", user?.email],
    queryFn: async () => {
      const { data: forn } = await supabase
        .from("fornecedores")
        .select("id, nome, subtipo_parceiro")
        .eq("email", user!.email!)
        .maybeSingle();
      if (!forn) return { fornecedor: null, projetos: [], comissoes: [] };

      const { data: vinculos } = await supabase
        .from("projeto_parceiros")
        .select("projeto_id, rt_tipo, rt_base, rt_percentual, rt_valor, rt_total, rt_recebido, projetos(id, nome, status, endereco_obra, data_inicio, data_previsao, descricao, cliente_id, clientes(nome))")
        .eq("parceiro_id", forn.id);

      const projetos = (vinculos ?? [])
        .map((v: any) => v.projetos ? { ...v.projetos, _rt_total: Number(v.rt_total ?? 0), _rt_recebido: Number(v.rt_recebido ?? 0) } : null)
        .filter(Boolean);

      const { data: comissoes } = await supabase
        .from("comissoes")
        .select("*, projetos(nome)")
        .eq("fornecedor_id", forn.id)
        .eq("deletado", false);

      return { fornecedor: forn, projetos, comissoes: comissoes ?? [] };
    },
    enabled: !!user?.email,
  });

  const projetos = data?.projetos ?? [];
  const active = selectedProjeto ?? null;
  const activeProjeto = projetos.find((p: any) => p.id === active);
  const progress = activeProjeto ? (progressMap[activeProjeto.status as StatusProjeto] ?? 0) : 0;

  // Timeline
  const { data: historico } = useQuery({
    queryKey: ["portal_parc_historico", active],
    queryFn: async () => {
      const { data } = await supabase.from("historico_projeto")
        .select("id, status, data, observacao")
        .eq("projeto_id", active!)
        .order("data", { ascending: false });
      return data ?? [];
    },
    enabled: !!active,
  });

  // Visitas
  const { data: visitas } = useQuery({
    queryKey: ["portal_parc_visitas", active],
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

  // Pagamentos de RT do projeto ativo (filtrado por parceiro logado via RLS)
  const { data: pagamentosRT } = useQuery({
    queryKey: ["portal_parc_pag_rt", active],
    queryFn: async () => {
      const { data } = await supabase.from("pagamentos_rt")
        .select("id, valor, data, observacao")
        .eq("projeto_id", active!)
        .order("data", { ascending: false });
      return data ?? [];
    },
    enabled: !!active,
  });

  // Imagens (crm_arquivos)
  const clienteId = activeProjeto ? (activeProjeto as any).cliente_id : null;
  const { data: arquivos, refetch: refetchArquivos } = useQuery({
    queryKey: ["portal_parc_arq", clienteId],
    queryFn: async () => {
      const { data } = await supabase.from("crm_arquivos")
        .select("id, nome_arquivo, url, tipo, created_at")
        .eq("cliente_id", clienteId!)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!clienteId,
  });
  const imagens = arquivos?.filter(d => d.tipo === "imagem" || d.nome_arquivo?.match(/\.(jpg|jpeg|png|gif|webp)$/i)) ?? [];

  // Anotações (crm_interacoes)
  const { data: notas, refetch: refetchNotas } = useQuery({
    queryKey: ["portal_parc_notas", clienteId],
    queryFn: async () => {
      const { data } = await supabase.from("crm_interacoes")
        .select("id, descricao, tipo, created_at")
        .eq("cliente_id", clienteId!)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!clienteId,
  });

  const handleAddNota = async () => {
    if (!novaNota.trim() || !clienteId) return;
    const { error } = await supabase.from("crm_interacoes").insert({
      cliente_id: clienteId,
      descricao: novaNota.toUpperCase(),
      tipo: "anotacao",
    });
    if (error) {
      toast.error("Erro ao salvar anotação");
      return;
    }
    setNovaNota("");
    refetchNotas();
    toast.success("Anotação salva");
  };

  const handleLogout = async () => { await signOut(); navigate("/login"); };

  // Resumo de RT
  // Resumo de RT — agora vem direto dos vínculos (projeto_parceiros)
  const rtTotal = projetos.reduce((s: number, p: any) => s + (p._rt_total || 0), 0);
  const rtPago = projetos.reduce((s: number, p: any) => s + (p._rt_recebido || 0), 0);
  const rtPendente = rtTotal - rtPago;

  if (isLoading) {
    return <div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground text-sm">Carregando…</div>;
  }

  if (!data?.fornecedor) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-3 p-6">
        <p className="text-muted-foreground text-sm">Nenhum cadastro de parceiro encontrado para {user?.email}.</p>
        <button onClick={handleLogout} className="text-primary text-sm hover:underline">Sair</button>
      </div>
    );
  }

  const renderProjectDetail = () => {
    if (!activeProjeto) return null;
    const projetoComissoes = (data?.comissoes ?? []).filter((c: any) => c.projeto_id === active);
    const rtProjTotal = Number((activeProjeto as any)._rt_total ?? 0);
    const rtProjPago = Number((activeProjeto as any)._rt_recebido ?? 0);
    const rtProjPend = rtProjTotal - rtProjPago;

    return (
      <div className="space-y-5 animate-fade-in">
        <button onClick={() => setSelectedProjeto(null)} className="flex items-center gap-1 text-xs text-primary hover:underline">
          <ChevronLeft size={14} /> Voltar à lista
        </button>

        {/* Cabeçalho — apenas nome do projeto */}
        <div className="bg-card border border-border rounded-lg p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <h2 className="text-base font-bold text-foreground">{activeProjeto.nome}</h2>
            </div>
            <span className={`self-start px-3 py-1 rounded text-xs font-semibold ${statusColor[activeProjeto.status ?? ""] ?? "bg-secondary text-secondary-foreground"}`}>
              {statusLabel[activeProjeto.status ?? ""] ?? activeProjeto.status}
            </span>
          </div>
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Progresso</span>
              <span className="font-semibold text-foreground">{progress}%</span>
            </div>
            <Progress value={progress} className="h-2.5" />
          </div>
        </div>

        <Tabs defaultValue="visitas" className="space-y-4">
          <TabsList className="w-full justify-start overflow-x-auto bg-card border border-border">
            <TabsTrigger value="visitas" className="gap-1.5 text-xs"><Activity size={14} /> Visitas</TabsTrigger>
            <TabsTrigger value="cronograma" className="gap-1.5 text-xs"><CalendarDays size={14} /> Cronograma</TabsTrigger>
            <TabsTrigger value="rt" className="gap-1.5 text-xs"><DollarSign size={14} /> RT</TabsTrigger>
            <TabsTrigger value="anotacoes" className="gap-1.5 text-xs"><MessageSquare size={14} /> Anotações</TabsTrigger>
            <TabsTrigger value="imagens" className="gap-1.5 text-xs"><ImageIcon size={14} /> Imagens</TabsTrigger>
            <TabsTrigger value="timeline" className="gap-1.5 text-xs"><History size={14} /> Timeline</TabsTrigger>
          </TabsList>

          {/* Visitas */}
          <TabsContent value="visitas" className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">Visitas Técnicas</h3>
            {!visitas?.length ? (
              <p className="text-xs text-muted-foreground py-6 text-center">Nenhuma visita registrada.</p>
            ) : (
              <div className="relative pl-4 border-l-2 border-primary/20 space-y-4">
                {visitas.map(v => (
                  <div key={v.id} className="relative">
                    <div className="absolute -left-[21px] top-1 w-3 h-3 rounded-full bg-primary border-2 border-background" />
                    <div className="bg-card border border-border rounded-lg p-3 space-y-1.5">
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
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Cronograma — usa histórico como linha do tempo */}
          <TabsContent value="cronograma" className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">Cronograma</h3>
            {!historico?.length ? (
              <p className="text-xs text-muted-foreground py-6 text-center">Sem etapas registradas.</p>
            ) : (
              <div className="relative pl-4 border-l-2 border-primary/20 space-y-3">
                {historico.map((h, i) => (
                  <div key={h.id} className="relative">
                    <div className={`absolute -left-[21px] top-1 w-3 h-3 rounded-full border-2 border-background ${i === 0 ? "bg-primary" : "bg-muted-foreground/40"}`} />
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
                ))}
              </div>
            )}
          </TabsContent>

          {/* RT — total, pago, pendente */}
          <TabsContent value="rt" className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-card border border-border rounded-lg p-3 text-center">
                <p className="text-[10px] text-muted-foreground uppercase">Total RT</p>
                <p className="text-base font-bold text-foreground mt-1">{fmt(rtProjTotal)}</p>
              </div>
              <div className="bg-card border border-border rounded-lg p-3 text-center">
                <p className="text-[10px] text-muted-foreground uppercase">Pago</p>
                <p className="text-base font-bold text-success mt-1">{fmt(rtProjPago)}</p>
              </div>
              <div className="bg-card border border-border rounded-lg p-3 text-center">
                <p className="text-[10px] text-muted-foreground uppercase">Pendente</p>
                <p className="text-base font-bold text-warning mt-1">{fmt(rtProjPend)}</p>
              </div>
            </div>
            {projetoComissoes.length > 0 && (
              <div className="border border-border rounded overflow-hidden">
                <table className="w-full text-xs">
                  <thead><tr className="bg-secondary/60">
                    <th className="text-left px-2.5 py-2 font-semibold border-b border-border">Descrição</th>
                    <th className="text-right px-2.5 py-2 font-semibold border-b border-border">Valor</th>
                    <th className="text-center px-2.5 py-2 font-semibold border-b border-border">Status</th>
                  </tr></thead>
                  <tbody>
                    {projetoComissoes.map((c: any) => (
                      <tr key={c.id} className="border-b border-border last:border-b-0">
                        <td className="px-2.5 py-1.5">{c.observacao || "Comissão RT"}</td>
                        <td className="px-2.5 py-1.5 text-right font-medium">{fmt(c.valor ?? 0)}</td>
                        <td className="px-2.5 py-1.5 text-center">
                          <span className={`px-1.5 py-0.5 rounded text-[11px] font-medium ${c.status === "pago" ? "bg-success/15 text-success" : "bg-warning/15 text-warning"}`}>
                            {c.status === "pago" ? "Pago" : "Pendente"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Histórico de pagamentos de RT */}
            <div>
              <h4 className="text-xs font-semibold text-foreground mb-2 mt-2">Histórico de pagamentos</h4>
              {!pagamentosRT?.length ? (
                <p className="text-xs text-muted-foreground py-3 text-center bg-secondary/20 rounded">
                  Nenhum pagamento de RT registrado.
                </p>
              ) : (
                <div className="border border-border rounded overflow-hidden">
                  <table className="w-full text-xs">
                    <thead><tr className="bg-secondary/60">
                      <th className="text-left px-2.5 py-2 font-semibold border-b border-border">Data</th>
                      <th className="text-left px-2.5 py-2 font-semibold border-b border-border">Observação</th>
                      <th className="text-right px-2.5 py-2 font-semibold border-b border-border">Valor</th>
                    </tr></thead>
                    <tbody>
                      {pagamentosRT.map((p: any) => (
                        <tr key={p.id} className="border-b border-border last:border-b-0">
                          <td className="px-2.5 py-1.5">{new Date(p.data + "T00:00:00").toLocaleDateString("pt-BR")}</td>
                          <td className="px-2.5 py-1.5 text-muted-foreground">{p.observacao || "—"}</td>
                          <td className="px-2.5 py-1.5 text-right font-semibold text-success">{fmt(Number(p.valor) || 0)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </TabsContent>

          {/* Anotações */}
          <TabsContent value="anotacoes" className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">Anotações</h3>
            <div className="flex gap-2">
              <textarea
                value={novaNota}
                onChange={(e) => setNovaNota(e.target.value)}
                placeholder="Adicionar nova anotação…"
                className="flex-1 min-h-[60px] p-2 rounded border border-border bg-background text-xs resize-none"
              />
              <button
                onClick={handleAddNota}
                disabled={!novaNota.trim()}
                className="px-3 self-start rounded bg-primary text-primary-foreground text-xs h-8 disabled:opacity-50"
              >
                Salvar
              </button>
            </div>
            {!notas?.length ? (
              <p className="text-xs text-muted-foreground py-4 text-center">Nenhuma anotação.</p>
            ) : (
              <div className="space-y-2">
                {notas.map(n => (
                  <div key={n.id} className="bg-card border border-border rounded p-2.5">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(n.created_at).toLocaleString("pt-BR")}
                      </span>
                      {n.tipo && <span className="text-[10px] text-muted-foreground uppercase">{n.tipo}</span>}
                    </div>
                    <p className="text-xs text-foreground whitespace-pre-wrap">{n.descricao}</p>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Imagens */}
          <TabsContent value="imagens" className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">Imagens</h3>
            {!imagens.length ? (
              <p className="text-xs text-muted-foreground py-6 text-center">Nenhuma imagem.</p>
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

          {/* Timeline (histórico) */}
          <TabsContent value="timeline" className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">Linha do Tempo</h3>
            {!historico?.length ? (
              <p className="text-xs text-muted-foreground py-6 text-center">Nenhum evento registrado.</p>
            ) : (
              <div className="relative pl-4 border-l-2 border-primary/20 space-y-3">
                {historico.map((h, i) => (
                  <div key={h.id} className="relative">
                    <div className={`absolute -left-[21px] top-1 w-3 h-3 rounded-full border-2 border-background ${i === 0 ? "bg-primary" : "bg-muted-foreground/40"}`} />
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
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    );
  };

  const renderProjectList = () => (
    <div className="space-y-4 animate-fade-in">
      {/* Cards principais — destaque com cores e ícones */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="group bg-card border border-border rounded-xl p-4 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Total de RT</span>
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Wallet size={16} className="text-primary" />
            </div>
          </div>
          <p className="text-2xl font-extrabold text-foreground tracking-tight">{fmt(rtTotal)}</p>
          <p className="text-[11px] text-muted-foreground mt-1">{projetos.length} {projetos.length === 1 ? "projeto" : "projetos"} vinculado{projetos.length === 1 ? "" : "s"}</p>
        </div>
        <div className="group bg-card border border-border rounded-xl p-4 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Recebido</span>
            <div className="w-8 h-8 rounded-lg bg-success/15 flex items-center justify-center">
              <CheckCircle2 size={16} className="text-success" />
            </div>
          </div>
          <p className="text-2xl font-extrabold text-success tracking-tight">{fmt(rtPago)}</p>
          <p className="text-[11px] text-muted-foreground mt-1">
            {rtTotal > 0 ? Math.round((rtPago / rtTotal) * 100) : 0}% do total
          </p>
        </div>
        <div className="group bg-card border border-border rounded-xl p-4 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Pendente</span>
            <div className="w-8 h-8 rounded-lg bg-warning/15 flex items-center justify-center">
              <Hourglass size={16} className="text-warning" />
            </div>
          </div>
          <p className="text-2xl font-extrabold text-warning tracking-tight">{fmt(rtPendente)}</p>
          <p className="text-[11px] text-muted-foreground mt-1">A receber</p>
        </div>
      </div>

      <div className="flex items-center justify-between pt-1">
        <h2 className="text-sm font-bold text-foreground">Meus Projetos</h2>
        <span className="text-[11px] text-muted-foreground">{projetos.length} no total</span>
      </div>

      <div className="space-y-2">
        {projetos.length === 0 && (
          <div className="bg-card border border-border rounded-lg p-8 text-center space-y-2">
            <FolderKanban size={32} className="mx-auto text-muted-foreground/40" />
            <p className="text-sm font-medium text-foreground">
              Você ainda não possui projetos vinculados
            </p>
            <p className="text-xs text-muted-foreground">
              Assim que um projeto for vinculado a você, ele aparecerá aqui.
            </p>
          </div>
        )}
        {projetos.map((p: any) => {
          const prog = progressMap[p.status as StatusProjeto] ?? 0;
          const rtTot = Number(p._rt_total || 0);
          const rtRec = Number(p._rt_recebido || 0);
          const rtPen = rtTot - rtRec;
          const rtPct = rtTot > 0 ? Math.round((rtRec / rtTot) * 100) : 0;
          return (
            <button
              key={p.id}
              onClick={() => setSelectedProjeto(p.id)}
              className="w-full text-left bg-card border border-border rounded-xl p-4 shadow-sm hover:shadow-md hover:border-primary/50 hover:-translate-y-0.5 transition-all space-y-2"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-foreground">{p.nome}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded text-[11px] font-medium ${statusColor[p.status] ?? "bg-secondary text-secondary-foreground"}`}>
                    {statusLabel[p.status] ?? p.status}
                  </span>
                  <ChevronRight size={14} className="text-muted-foreground" />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Progress value={prog} className="h-1.5 flex-1" />
                <span className="text-[10px] text-muted-foreground w-8 text-right">{prog}%</span>
              </div>

              {/* RT do projeto */}
              <div className="pt-2 mt-1 border-t border-border/60 space-y-1.5">
                <div className="grid grid-cols-3 gap-2 text-[11px]">
                  <div>
                    <p className="text-muted-foreground uppercase text-[9px]">RT Total</p>
                    <p className="font-semibold text-foreground">{fmt(rtTot)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground uppercase text-[9px]">Recebido</p>
                    <p className="font-semibold text-success">{fmt(rtRec)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground uppercase text-[9px]">Pendente</p>
                    <p className="font-semibold text-warning">{fmt(rtPen)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 rounded-full bg-secondary overflow-hidden">
                    <div
                      className="h-full bg-success transition-all"
                      style={{ width: `${rtPct}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-muted-foreground w-10 text-right">{rtPct}%</span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/95 backdrop-blur sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center text-primary-foreground font-bold text-sm shadow-sm shrink-0">
              {data.fornecedor.nome
                .split(" ")
                .filter(Boolean)
                .slice(0, 2)
                .map((n: string) => n[0]?.toUpperCase())
                .join("")}
            </div>
            <div className="min-w-0">
              <h1 className="text-sm font-bold text-foreground truncate">
                Olá, {data.fornecedor.nome.split(" ")[0]}
              </h1>
              <p className="text-[11px] text-muted-foreground truncate">
                Acompanhe seus projetos e comissões
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <NotificacoesBell parceiroId={data.fornecedor.id} />
            <button
              onClick={handleLogout}
              className="text-xs text-muted-foreground hover:text-destructive flex items-center gap-1 transition-colors"
            >
              <LogOut size={14} /> Sair
            </button>
          </div>
        </div>
      </header>
      <main className="max-w-4xl mx-auto p-4">
        {active ? renderProjectDetail() : renderProjectList()}
      </main>
    </div>
  );
};

export default PortalParceiro;