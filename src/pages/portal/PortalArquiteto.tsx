import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { FolderKanban, DollarSign, LogOut, Clock, Activity, CalendarDays, Image as ImageIcon, FileText, ChevronLeft, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { statusProjetoLabels, statusProjetoColors, type StatusProjeto } from "@/lib/statusConfig";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";

const statusLabel = statusProjetoLabels as Record<string, string>;
const statusColor = statusProjetoColors as Record<string, string>;
const fmt = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

const progressMap: Record<StatusProjeto, number> = {
  lead: 0, proposta: 5, orcamento: 10, aprovado: 15, vendido: 25,
  em_andamento: 35, infraestrutura: 45, cabeamento: 55, instalacao: 65,
  programacao: 75, personalizacao: 85, concluido: 100, pos_venda: 100,
  cancelado: 0, em_pausa: 0,
};

const PortalArquiteto = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [selectedProjeto, setSelectedProjeto] = useState<string | null>(null);

  // Find fornecedor (arquiteto) by email, then load projects + comissões
  const { data, isLoading } = useQuery({
    queryKey: ["portal_arquiteto_full", user?.email],
    queryFn: async () => {
      const { data: forn } = await supabase.from("fornecedores").select("id, nome").eq("email", user!.email!).single();
      if (!forn) return { fornecedor: null, projetos: [], comissoes: [] };
      const [projRes, comRes] = await Promise.all([
        supabase.from("projetos")
          .select("id, nome, status, endereco_obra, data_inicio, data_previsao, descricao, clientes(nome)")
          .eq("arquiteto_id", forn.id)
          .eq("deletado", false)
          .order("created_at", { ascending: false }),
        supabase.from("comissoes")
          .select("*, projetos(nome)")
          .eq("fornecedor_id", forn.id)
          .eq("deletado", false)
          .order("created_at", { ascending: false }),
      ]);
      return { fornecedor: forn, projetos: projRes.data ?? [], comissoes: comRes.data ?? [] };
    },
    enabled: !!user?.email,
  });

  const projetos = data?.projetos ?? [];
  const active = selectedProjeto ?? projetos[0]?.id ?? null;
  const activeProjeto = projetos.find((p: any) => p.id === active);
  const progress = activeProjeto ? (progressMap[activeProjeto.status as StatusProjeto] ?? 0) : 0;

  // Timeline (historico_projeto)
  const { data: historico } = useQuery({
    queryKey: ["portal_arq_historico", active],
    queryFn: async () => {
      const { data } = await supabase.from("historico_projeto")
        .select("id, status, data, observacao")
        .eq("projeto_id", active!)
        .order("data", { ascending: false });
      return data ?? [];
    },
    enabled: !!active,
  });

  // Visitas técnicas
  const { data: visitas } = useQuery({
    queryKey: ["portal_arq_visitas", active],
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

  // Documents / Images (crm_arquivos via cliente do projeto)
  const clienteId = activeProjeto ? (activeProjeto as any).cliente_id : null;
  const { data: documentos } = useQuery({
    queryKey: ["portal_arq_docs", active],
    queryFn: async () => {
      // get cliente_id from the project
      const { data: proj } = await supabase.from("projetos").select("cliente_id").eq("id", active!).single();
      if (!proj?.cliente_id) return [];
      const { data } = await supabase.from("crm_arquivos")
        .select("id, nome_arquivo, url, tipo, created_at")
        .eq("cliente_id", proj.cliente_id)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!active,
  });

  const imagens = documentos?.filter(d => d.tipo === "imagem" || d.nome_arquivo?.match(/\.(jpg|jpeg|png|gif|webp)$/i)) ?? [];

  const handleLogout = async () => { await signOut(); navigate("/login"); };

  // Detail view for a selected project
  const renderProjectDetail = () => {
    if (!activeProjeto) return null;
    return (
      <div className="space-y-5 animate-fade-in">
        {/* Back button if multiple projects */}
        {projetos.length > 1 && (
          <button onClick={() => setSelectedProjeto(null)} className="flex items-center gap-1 text-xs text-primary hover:underline">
            <ChevronLeft size={14} /> Voltar à lista
          </button>
        )}

        {/* Overview card */}
        <div className="bg-card border border-border rounded-lg p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <h2 className="text-base font-bold text-foreground">{activeProjeto.nome}</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Cliente: {(activeProjeto as any).clientes?.nome ?? "—"}
              </p>
              {activeProjeto.endereco_obra && (
                <p className="text-xs text-muted-foreground">📍 {activeProjeto.endereco_obra}</p>
              )}
            </div>
            <span className={`self-start px-3 py-1 rounded text-xs font-semibold ${statusColor[activeProjeto.status ?? ""] ?? "bg-secondary text-secondary-foreground"}`}>
              {statusLabel[activeProjeto.status ?? ""] ?? activeProjeto.status}
            </span>
          </div>
          {activeProjeto.descricao && <p className="text-xs text-muted-foreground">{activeProjeto.descricao}</p>}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Progresso</span>
              <span className="font-semibold text-foreground">{progress}%</span>
            </div>
            <Progress value={progress} className="h-2.5" />
          </div>
          <div className="flex gap-4 text-[11px] text-muted-foreground">
            {activeProjeto.data_inicio && <span><Clock size={10} className="inline mr-0.5" /> Início: {activeProjeto.data_inicio}</span>}
            {activeProjeto.data_previsao && <span>Previsão: {activeProjeto.data_previsao}</span>}
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="andamento" className="space-y-4">
          <TabsList className="w-full justify-start overflow-x-auto bg-card border border-border">
            <TabsTrigger value="andamento" className="gap-1.5 text-xs"><Activity size={14} /> Andamento</TabsTrigger>
            <TabsTrigger value="cronograma" className="gap-1.5 text-xs"><CalendarDays size={14} /> Cronograma</TabsTrigger>
            <TabsTrigger value="imagens" className="gap-1.5 text-xs"><ImageIcon size={14} /> Imagens</TabsTrigger>
            <TabsTrigger value="comissoes" className="gap-1.5 text-xs"><DollarSign size={14} /> Comissões</TabsTrigger>
          </TabsList>

          {/* Andamento - Visitas */}
          <TabsContent value="andamento" className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">Diário de Obra</h3>
            {!visitas?.length ? (
              <p className="text-xs text-muted-foreground py-6 text-center">Nenhum registro.</p>
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

          {/* Cronograma */}
          <TabsContent value="cronograma" className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">Evolução do Projeto</h3>
            {!historico?.length ? (
              <p className="text-xs text-muted-foreground py-6 text-center">Nenhum histórico.</p>
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

          {/* Comissões do projeto */}
          <TabsContent value="comissoes" className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">Comissões deste Projeto</h3>
            {(() => {
              const projetoComissoes = (data?.comissoes ?? []).filter((c: any) => c.projeto_id === active);
              if (!projetoComissoes.length) return <p className="text-xs text-muted-foreground py-6 text-center">Nenhuma comissão.</p>;
              return (
                <div className="border border-border rounded overflow-hidden">
                  <table className="w-full text-xs">
                    <thead><tr className="bg-secondary/60">
                      <th className="text-left px-2.5 py-2 font-semibold border-b border-border">Descrição</th>
                      <th className="text-right px-2.5 py-2 font-semibold border-b border-border">%</th>
                      <th className="text-right px-2.5 py-2 font-semibold border-b border-border">Valor</th>
                      <th className="text-center px-2.5 py-2 font-semibold border-b border-border">Status</th>
                    </tr></thead>
                    <tbody>
                      {projetoComissoes.map((c: any) => (
                        <tr key={c.id} className="border-b border-border last:border-b-0">
                          <td className="px-2.5 py-1.5">{c.observacao || "Comissão RT"}</td>
                          <td className="px-2.5 py-1.5 text-right">{c.percentual ?? 0}%</td>
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
              );
            })()}
          </TabsContent>
        </Tabs>
      </div>
    );
  };

  // Projects list view
  const renderProjectList = () => (
    <div className="space-y-4 animate-fade-in">
      <h2 className="text-sm font-bold text-foreground">Meus Projetos ({projetos.length})</h2>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="bg-card border border-border rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-foreground">{projetos.length}</p>
          <p className="text-[11px] text-muted-foreground">Projetos</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-success">{projetos.filter((p: any) => ["em_andamento", "infraestrutura", "cabeamento", "instalacao", "programacao", "personalizacao"].includes(p.status)).length}</p>
          <p className="text-[11px] text-muted-foreground">Em Andamento</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-primary">{fmt((data?.comissoes ?? []).reduce((s: number, c: any) => s + (c.valor ?? 0), 0))}</p>
          <p className="text-[11px] text-muted-foreground">Total Comissões</p>
        </div>
      </div>

      {/* Project cards */}
      <div className="space-y-2">
        {projetos.map((p: any) => {
          const prog = progressMap[p.status as StatusProjeto] ?? 0;
          return (
            <button
              key={p.id}
              onClick={() => setSelectedProjeto(p.id)}
              className="w-full text-left bg-card border border-border rounded-lg p-4 hover:border-primary/40 transition-colors space-y-2"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-foreground">{p.nome}</p>
                  <p className="text-[11px] text-muted-foreground">{(p as any).clientes?.nome ?? "Sem cliente"}</p>
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
            </button>
          );
        })}
      </div>

      {/* Comissões summary */}
      {(data?.comissoes?.length ?? 0) > 0 && (
        <section className="space-y-3 pt-2">
          <h2 className="text-sm font-bold text-foreground flex items-center gap-1.5"><DollarSign size={14} /> Todas as Comissões</h2>
          <div className="border border-border rounded overflow-hidden">
            <table className="w-full text-xs">
              <thead><tr className="bg-secondary/60">
                <th className="text-left px-2.5 py-2 font-semibold border-b border-border">Projeto</th>
                <th className="text-right px-2.5 py-2 font-semibold border-b border-border">%</th>
                <th className="text-right px-2.5 py-2 font-semibold border-b border-border">Valor</th>
                <th className="text-center px-2.5 py-2 font-semibold border-b border-border">Status</th>
              </tr></thead>
              <tbody>
                {data!.comissoes.map((c: any) => (
                  <tr key={c.id} className="border-b border-border last:border-b-0">
                    <td className="px-2.5 py-1.5">{(c.projetos as any)?.nome ?? "—"}</td>
                    <td className="px-2.5 py-1.5 text-right">{c.percentual ?? 0}%</td>
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
        </section>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <header className="h-14 border-b border-border bg-card flex items-center justify-between px-4 md:px-6 sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <FolderKanban size={20} className="text-primary" />
          <h1 className="text-sm font-bold text-foreground">Portal do Arquiteto</h1>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground hidden sm:inline">{data?.fornecedor?.nome}</span>
          <button onClick={handleLogout} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
            <LogOut size={14} /> Sair
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-4 md:p-6">
        {isLoading ? (
          <p className="text-center py-12 text-sm text-muted-foreground">Carregando...</p>
        ) : !projetos.length ? (
          <div className="text-center py-16 space-y-2">
            <FolderKanban size={40} className="mx-auto text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">Nenhum projeto vinculado.</p>
          </div>
        ) : selectedProjeto ? (
          renderProjectDetail()
        ) : projetos.length === 1 ? (
          // Auto-select if single project
          (() => { setSelectedProjeto(projetos[0].id); return null; })()
        ) : (
          renderProjectList()
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

export default PortalArquiteto;
