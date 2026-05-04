import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { 
  LogOut, Activity, CalendarDays,
  Image as ImageIcon, ChevronLeft, ChevronRight,
  Plus, DollarSign, MessageSquare, Clock,
  CheckCircle2, Hourglass
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

      if (!forn) return { fornecedor: null, projetos: [], parcelas: [], comissoes: [] };

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
        const { data: com } = await supabase
          .from("comissoes")
          .select("*, projetos(nome)")
          .eq("fornecedor_id", forn.id)
          .eq("deletado", false);
        comissoes = com ?? [];
      }

      return { 
        fornecedor: forn, 
        projetos, 
        parcelas, 
        comissoes 
      };
    },
    enabled: !!user?.email
  });

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
        <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-2xl p-5 mb-5 space-y-4">
          <button
            onClick={() => setSelectedProjeto(null)}
            className="flex items-center gap-2
              text-slate-300 hover:text-white
              transition-colors mb-4 text-sm font-medium
              bg-slate-700/50 hover:bg-slate-700
              px-3 py-2 rounded-lg w-fit">
            <ChevronLeft size={16} />
            Voltar aos projetos
          </button>
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

      <Tabs defaultValue="cronograma" className="space-y-4">
        <TabsList className="w-full justify-start overflow-x-auto bg-card border border-border">
          <TabsTrigger value="cronograma" className="gap-1.5 text-xs"><CalendarDays size={14} /> Cronograma</TabsTrigger>
          {data.fornecedor.tipo === "arquiteto" && <TabsTrigger value="rt" className="gap-1.5 text-xs"><DollarSign size={14} /> RT e Parcelas</TabsTrigger>}
          {data.fornecedor.tipo === "tecnico" && <TabsTrigger value="diario" className="gap-1.5 text-xs"><Activity size={14} /> Diário de Obra</TabsTrigger>}
          <TabsTrigger value="visitas" className="gap-1.5 text-xs"><Activity size={14} /> Visitas</TabsTrigger>
          <TabsTrigger value="imagens" className="gap-1.5 text-xs"><ImageIcon size={14} /> Imagens</TabsTrigger>
          {data.fornecedor.tipo !== "tecnico" && <TabsTrigger value="anotacoes" className="gap-1.5 text-xs"><MessageSquare size={14} /> Anotações</TabsTrigger>}
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
              const projComissoes = (data?.comissoes ?? [])
                .filter((c: any) => c.projeto_id === selectedProjeto);
              const projRtTotal = projComissoes.reduce(
                (s, c: any) => s + (Number(c.valor) || 0), 0);
              const projRtPago = projComissoes.reduce(
                (s, c: any) => c.status === "pago"
                  ? s + (Number(c.valor) || 0) : s, 0);
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
                            <th className="text-right px-3 py-2 border-b border-border">Valor</th>
                            <th className="text-center px-3 py-2 border-b border-border">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {projComissoes.map((c: any) => (
                            <tr key={c.id} className="border-b border-border last:border-b-0">
                              <td className="px-3 py-2">{c.observacao || "Comissão RT"}</td>
                              <td className="px-3 py-2 text-right font-medium">{fmt(Number(c.valor) || 0)}</td>
                              <td className="px-3 py-2 text-center">
                                <span className={`px-2 py-0.5 rounded text-[11px] font-medium ${c.status === "pago" ? "bg-success/15 text-success" : "bg-warning/15 text-warning"}`}>
                                  {c.status === "pago" ? "Pago" : "Pendente"}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  <h4 className="text-xs font-bold text-muted-foreground uppercase mb-2">
                    Parcelas Definidas
                  </h4>
                  {data.parcelas.filter(p => p.projeto_id === selectedProjeto).length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-4 bg-secondary/20 rounded">
                      Nenhuma parcela definida ainda. As parcelas são definidas pelo administrador.
                    </p>
                  ) : (
                    <div className="border border-border rounded overflow-hidden">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-secondary/60">
                            <th className="text-left px-2.5 py-2 font-semibold border-b border-border">Descrição</th>
                            <th className="text-right px-2.5 py-2 font-semibold border-b border-border">Valor</th>
                            <th className="text-right px-2.5 py-2 font-semibold border-b border-border">Vencimento</th>
                            <th className="text-center px-2.5 py-2 font-semibold border-b border-border">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(data?.parcelas ?? []).filter(p => p.projeto_id === selectedProjeto).map(p => (
                            <tr key={p.id} className="border-b border-border last:border-b-0">
                              <td className="px-2.5 py-1.5">{p.descricao}</td>
                              <td className="px-2.5 py-1.5 text-right font-medium">{fmt(p.valor)}</td>
                              <td className="px-2.5 py-1.5 text-right">{new Date(p.data_vencimento).toLocaleDateString("pt-BR")}</td>
                              <td className="px-2.5 py-1.5 text-center">
                                <span className={`px-1.5 py-0.5 rounded text-[11px] font-medium ${p.status === "pago" ? "bg-success/15 text-success" : "bg-warning/15 text-warning"}`}>
                                  {p.status === "pago" ? "Pago" : "Pendente"}
                                </span>
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
  );};

  const renderProjectList = () => (
    <div className="space-y-6 animate-fade-in">
      {data.fornecedor.tipo === "arquiteto" ? (() => {
        const rtTotal = data.comissoes?.reduce((s: number, c: any) => s + (Number(c.valor) || 0), 0) ?? 0;
        const rtPago = data.comissoes?.reduce((s: number, c: any) => c.status === "pago" ? s + (Number(c.valor) || 0) : s, 0) ?? 0;
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
          {data.fornecedor.tipo === "tecnico" && (
            <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
              <p className="text-[11px] font-semibold uppercase text-muted-foreground">Visitas</p>
              <p className="text-xl font-bold text-primary">{visitas?.length ?? 0}</p>
            </div>
          )}
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
                <div className="flex justify-between text-[11px] text-muted-foreground">
                  <span>Progresso</span>
                  <span className="font-semibold text-foreground">{progressMap[p.status as StatusProjeto] ?? 0}%</span>
                </div>
                <Progress value={progressMap[p.status as StatusProjeto] ?? 0} className="h-2" />
              </div>
              {data.fornecedor.tipo === "arquiteto" && (() => {
                const projComissoes = (data?.comissoes ?? []).filter((c: any) => c.projeto_id === p.id);
                const projRtTotal = projComissoes.reduce((s: number, c: any) => s + (Number(c.valor) || 0), 0);
                const projRtPago = projComissoes.reduce((s: number, c: any) => c.status === "pago" ? s + (Number(c.valor) || 0) : s, 0);
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