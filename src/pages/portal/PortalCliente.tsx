import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { FolderKanban, LogOut, Clock, FileText, Image as ImageIcon, AlertCircle, CalendarDays, Activity, ChevronRight, DollarSign, CalendarClock, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { statusProjetoLabels, statusProjetoColors, type StatusProjeto } from "@/lib/statusConfig";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import PortalColaborativo from "@/components/portal/PortalColaborativo";

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
      <header className="border-b border-border bg-gradient-to-r from-slate-900 to-slate-800 sticky top-0 z-10">
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

            {/* Project overview card */}
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

            {/* Tabs */}
            <Tabs defaultValue="diario" className="space-y-4">
              <TabsList className="w-full justify-start overflow-x-auto bg-card border border-border">
                <TabsTrigger value="diario" className="gap-1.5 text-xs"><Activity size={14} /> Diário de Obra</TabsTrigger>
                <TabsTrigger value="cronograma" className="gap-1.5 text-xs"><CalendarDays size={14} /> Cronograma</TabsTrigger>
                <TabsTrigger value="agenda" className="gap-1.5 text-xs"><CalendarClock size={14} /> Visitas Agendadas</TabsTrigger>
                <TabsTrigger value="imagens" className="gap-1.5 text-xs"><ImageIcon size={14} /> Imagens</TabsTrigger>
                <TabsTrigger value="pendencias" className="gap-1.5 text-xs"><AlertCircle size={14} /> Pendências</TabsTrigger>
                <TabsTrigger value="documentos" className="gap-1.5 text-xs"><FileText size={14} /> Documentos</TabsTrigger>
                <TabsTrigger value="financeiro" className="gap-1.5 text-xs"><DollarSign size={14} /> Financeiro</TabsTrigger>
                <TabsTrigger value="colaborativo" className="gap-1.5 text-xs"><Users size={14} /> Colaborativo</TabsTrigger>
              </TabsList>

              {/* Diário de Obra - Visitas Técnicas */}
              <TabsContent value="diario" className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground">Diário de Obra</h3>
                {!visitas?.length ? (
                  <p className="text-xs text-muted-foreground py-6 text-center">Nenhum registro de visita técnica.</p>
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

              {/* Cronograma - Timeline de Status */}
              <TabsContent value="cronograma" className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground">Cronograma / Evolução</h3>
                {!historico?.length ? (
                  <p className="text-xs text-muted-foreground py-6 text-center">Nenhum histórico de status.</p>
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

              {/* Pendências */}
              <TabsContent value="pendencias" className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground">Pendências</h3>
                {!pendencias?.length ? (
                  <p className="text-xs text-muted-foreground py-6 text-center">Nenhuma pendência registrada.</p>
                ) : (
                  <div className="space-y-2">
                    {pendencias.map(p => (
                      <div key={p.id} className="bg-card border border-border rounded-lg p-3 flex items-center justify-between">
                        <div className="flex-1">
                          <p className="text-xs font-medium text-foreground">{p.descricao ?? "Item sem descrição"}</p>
                          {p.quantidade && <span className="text-[11px] text-muted-foreground">Qtd: {p.quantidade}</span>}
                        </div>
                        <span className={`text-[10px] px-2 py-0.5 rounded font-medium ${
                          p.status === "pendente" ? "bg-warning/15 text-warning" :
                          p.status === "comprado" ? "bg-success/15 text-success" :
                          "bg-secondary text-secondary-foreground"
                        }`}>
                          {p.status === "pendente" ? "Pendente" : p.status === "comprado" ? "Comprado" : p.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* Documentos */}
              <TabsContent value="documentos" className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground">Documentos</h3>
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

              {/* Visitas Agendadas */}
              <TabsContent value="agenda" className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground">Visitas Agendadas</h3>
                {!agenda?.length ? (
                  <p className="text-xs text-muted-foreground py-6 text-center">Nenhuma visita agendada.</p>
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

              {/* Colaborativo (Pendências, Diário, Documentos, Comunicação) */}
              <TabsContent value="colaborativo" className="space-y-3">
                {active && clienteData?.cliente?.id && (
                  <PortalColaborativo
                    clienteId={clienteData.cliente.id}
                    projetoId={active}
                    autorTipo="cliente"
                    userName={nomeCliente}
                  />
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
