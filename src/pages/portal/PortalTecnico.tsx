import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import {
  FolderKanban, DollarSign, LogOut, Activity, CalendarDays,
  Image as ImageIcon, ChevronLeft, ChevronRight, History,
  Wallet, CheckCircle2, Hourglass, Plus, Clock
} from "lucide-react";
import { statusProjetoLabels, statusProjetoColors, type StatusProjeto } from "@/lib/statusConfig";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";

const statusLabel = statusProjetoLabels as Record<string, string>;
const statusColor = statusProjetoColors as Record<string, string>;
const fmt = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

const progressMap: Record<StatusProjeto, number> = {
  lead: 0, proposta: 5, orcamento: 10, aprovado: 15, vendido: 25,
  em_andamento: 35, infraestrutura: 45, cabeamento: 55, instalacao: 65,
  programacao: 75, personalizacao: 85, concluido: 100, pos_venda: 100,
  cancelado: 0, em_pausa: 0,
};

const PortalTecnico = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [selectedProjeto, setSelectedProjeto] = useState<string | null>(null);
  const [showNovaEntrada, setShowNovaEntrada] = useState(false);
  const [novaVisita, setNovaVisita] = useState({
    data: new Date().toISOString().split("T")[0],
    hora: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
    descricao: "",
    servicos_executados: ""
  });

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["portal_tecnico_full", user?.email],
    queryFn: async () => {
      const { data: forn } = await supabase
        .from("fornecedores")
        .select("id, nome")
        .eq("email", user!.email!)
        .single();
      
      if (!forn) return { tecnico: null, projetos: [], pagamentos: [] };

      const { data: visitas } = await supabase
        .from("visitas_tecnicas")
        .select("projeto_id, projetos(id, nome, status, endereco_obra, cliente_id, empresa_id)")
        .eq("tecnico_id", forn.id)
        .eq("deletado", false);

      const projetosMap = new Map();
      visitas?.forEach((v: any) => {
        if (v.projetos && !projetosMap.has(v.projeto_id)) {
          projetosMap.set(v.projeto_id, v.projetos);
        }
      });
      const projetos = Array.from(projetosMap.values());

      const { data: pagamentosVisitas } = await supabase
        .from("visitas_tecnicas")
        .select("id, data, descricao, valor_tecnico, valor_pago_tecnico, status_pagamento_tecnico")
        .eq("tecnico_id", forn.id)
        .gt("valor_tecnico", 0)
        .eq("deletado", false);

      return { tecnico: forn, projetos, pagamentos: pagamentosVisitas ?? [] };
    },
    enabled: !!user?.email,
  });

  const activeProjeto = data?.projetos?.find((p: any) => p.id === selectedProjeto);
  const progress = activeProjeto ? (progressMap[activeProjeto.status as StatusProjeto] ?? 0) : 0;

  const { data: visitas, refetch: refetchVisitas } = useQuery({
    queryKey: ["portal_tecnico_visitas", selectedProjeto],
    queryFn: async () => {
      const { data: res } = await supabase.from("visitas_tecnicas")
        .select("id, data, hora, descricao, servicos_executados, status_visita")
        .eq("projeto_id", selectedProjeto!)
        .eq("tecnico_id", data!.tecnico!.id)
        .eq("deletado", false)
        .order("data", { ascending: false });
      return res ?? [];
    },
    enabled: !!selectedProjeto && !!data?.tecnico,
  });

  const { data: historico } = useQuery({
    queryKey: ["portal_tecnico_historico", selectedProjeto],
    queryFn: async () => {
      const { data: res } = await supabase.from("historico_projeto")
        .select("id, status, data, observacao")
        .eq("projeto_id", selectedProjeto!)
        .order("data", { ascending: false });
      return res ?? [];
    },
    enabled: !!selectedProjeto,
  });

  const { data: imagens } = useQuery({
    queryKey: ["portal_tecnico_imagens", activeProjeto?.cliente_id],
    queryFn: async () => {
      const { data: res } = await supabase.from("crm_arquivos")
        .select("id, nome_arquivo, url, tipo, created_at")
        .eq("cliente_id", activeProjeto!.cliente_id)
        .order("created_at", { ascending: false });
      return res?.filter(d => d.tipo === "imagem" || d.nome_arquivo?.match(/\.(jpg|jpeg|png|gif|webp)$/i)) ?? [];
    },
    enabled: !!activeProjeto?.cliente_id,
  });

  const handleSalvarVisita = async () => {
    if (!novaVisita.descricao || !selectedProjeto || !data?.tecnico) return;
    
    const { error } = await supabase.from("visitas_tecnicas").insert({
      projeto_id: selectedProjeto,
      tecnico_id: data.tecnico.id,
      empresa_id: activeProjeto.empresa_id,
      data: novaVisita.data,
      hora: novaVisita.hora,
      descricao: novaVisita.descricao.toUpperCase(),
      servicos_executados: novaVisita.servicos_executados.toUpperCase(),
      status_visita: "realizada"
    });

    if (error) {
      toast.error("Erro ao salvar entrada");
      return;
    }

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

  const handleLogout = async () => { await signOut(); navigate("/login"); };

  if (isLoading) return <div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground text-sm">Carregando…</div>;

  if (!data?.tecnico) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-3 p-6">
        <p className="text-muted-foreground text-sm">Nenhum cadastro de técnico encontrado para {user?.email}.</p>
        <button onClick={handleLogout} className="text-primary text-sm hover:underline">Sair</button>
      </div>
    );
  }

  const totalReceber = data.pagamentos.reduce((acc, p) => acc + (Number(p.valor_tecnico) || 0), 0);
  const recebido = data.pagamentos.reduce((acc, p) => acc + (Number(p.valor_pago_tecnico) || 0), 0);
  const pendente = totalReceber - recebido;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/95 backdrop-blur sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center text-primary-foreground font-bold text-sm shadow-sm shrink-0">
              {data.tecnico.nome.split(" ").slice(0, 2).map((n: string) => n[0]?.toUpperCase()).join("")}
            </div>
            <div className="min-w-0">
              <h1 className="text-sm font-bold text-foreground truncate">Portal do Técnico</h1>
              <p className="text-[11px] text-muted-foreground truncate">Olá, {data.tecnico.nome}</p>
            </div>
          </div>
          <button onClick={handleLogout} className="text-xs text-muted-foreground hover:text-destructive flex items-center gap-1 transition-colors">
            <LogOut size={14} /> Sair
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4">
        {selectedProjeto ? (
          <div className="space-y-5 animate-fade-in">
            <button onClick={() => setSelectedProjeto(null)} className="flex items-center gap-1 text-xs text-primary hover:underline">
              <ChevronLeft size={14} /> Voltar aos projetos
            </button>

            <div className="bg-card border border-border rounded-lg p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <h2 className="text-base font-bold text-foreground">{activeProjeto?.nome}</h2>
                <span className={`self-start px-3 py-1 rounded text-xs font-semibold ${statusColor[activeProjeto?.status ?? ""] ?? "bg-secondary text-secondary-foreground"}`}>
                  {statusLabel[activeProjeto?.status ?? ""] ?? activeProjeto?.status}
                </span>
              </div>
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Progresso da Obra</span>
                  <span className="font-semibold text-foreground">{progress}%</span>
                </div>
                <Progress value={progress} className="h-2.5" />
              </div>
            </div>

            <Tabs defaultValue="diario" className="space-y-4">
              <TabsList className="w-full justify-start overflow-x-auto bg-card border border-border">
                <TabsTrigger value="diario" className="gap-1.5 text-xs"><Activity size={14} /> Diário de Obra</TabsTrigger>
                <TabsTrigger value="imagens" className="gap-1.5 text-xs"><ImageIcon size={14} /> Imagens</TabsTrigger>
                <TabsTrigger value="cronograma" className="gap-1.5 text-xs"><CalendarDays size={14} /> Cronograma</TabsTrigger>
              </TabsList>

              <TabsContent value="diario" className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">Entradas do Diário</h3>
                  <button 
                    onClick={() => setShowNovaEntrada(!showNovaEntrada)}
                    className="flex items-center gap-1.5 bg-primary text-primary-foreground px-3 py-1.5 rounded-md text-xs font-medium"
                  >
                    <Plus size={14} /> Nova Entrada
                  </button>
                </div>

                {showNovaEntrada && (
                  <div className="bg-card border border-border rounded-lg p-4 space-y-3 animate-in fade-in slide-in-from-top-2">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] uppercase font-bold text-muted-foreground">Data</label>
                        <input 
                          type="date" 
                          value={novaVisita.data}
                          onChange={e => setNovaVisita(prev => ({ ...prev, data: e.target.value }))}
                          className="w-full bg-background border border-border rounded px-2 py-1.5 text-xs"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] uppercase font-bold text-muted-foreground">Hora</label>
                        <input 
                          type="time" 
                          value={novaVisita.hora}
                          onChange={e => setNovaVisita(prev => ({ ...prev, hora: e.target.value }))}
                          className="w-full bg-background border border-border rounded px-2 py-1.5 text-xs"
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase font-bold text-muted-foreground">Descrição / Objetivo</label>
                      <input 
                        placeholder="Ex: Instalação de infraestrutura"
                        value={novaVisita.descricao}
                        onChange={e => setNovaVisita(prev => ({ ...prev, descricao: e.target.value }))}
                        className="w-full bg-background border border-border rounded px-2 py-1.5 text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase font-bold text-muted-foreground">Serviços Executados</label>
                      <textarea 
                        placeholder="Descreva o que foi feito hoje..."
                        value={novaVisita.servicos_executados}
                        onChange={e => setNovaVisita(prev => ({ ...prev, servicos_executados: e.target.value }))}
                        className="w-full bg-background border border-border rounded px-2 py-1.5 text-xs min-h-[80px]"
                      />
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                      <button onClick={() => setShowNovaEntrada(false)} className="text-xs px-3 py-1.5 rounded border border-border hover:bg-secondary">Cancelar</button>
                      <button onClick={handleSalvarVisita} className="text-xs px-3 py-1.5 rounded bg-primary text-primary-foreground font-medium">Salvar Entrada</button>
                    </div>
                  </div>
                )}

                {!visitas?.length ? (
                  <p className="text-xs text-muted-foreground py-6 text-center">Nenhuma visita registrada por você neste projeto.</p>
                ) : (
                  <div className="space-y-3">
                    {visitas.map(v => (
                      <div key={v.id} className="bg-card border border-border rounded-lg p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold flex items-center gap-1.5">
                            <CalendarDays size={14} className="text-primary" />
                            {new Date(v.data + "T00:00:00").toLocaleDateString("pt-BR")}
                            <span className="text-muted-foreground font-normal">às {v.hora}</span>
                          </span>
                        </div>
                        <p className="text-xs font-semibold text-foreground">{v.descricao}</p>
                        {v.servicos_executados && (
                          <p className="text-xs text-muted-foreground bg-secondary/30 p-2 rounded">{v.servicos_executados}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="imagens" className="space-y-4">
                <h3 className="text-sm font-semibold">Imagens do Projeto</h3>
                {!imagens?.length ? (
                  <p className="text-xs text-muted-foreground py-6 text-center">Nenhuma imagem enviada.</p>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {imagens.map(img => (
                      <a key={img.id} href={img.url} target="_blank" rel="noopener noreferrer" className="group">
                        <div className="aspect-square rounded-lg overflow-hidden border border-border bg-muted">
                          <img src={img.url} alt={img.nome_arquivo} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                        </div>
                      </a>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="cronograma" className="space-y-4">
                <h3 className="text-sm font-semibold">Histórico de Etapas</h3>
                <div className="relative pl-4 border-l-2 border-primary/20 space-y-4">
                  {historico?.map((h, i) => (
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
            </Tabs>
          </div>
        ) : (
          <div className="space-y-6 animate-fade-in">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-semibold uppercase text-muted-foreground">Total a Receber</span>
                  <Wallet size={16} className="text-primary" />
                </div>
                <p className="text-xl font-bold">{fmt(totalReceber)}</p>
              </div>
              <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-semibold uppercase text-muted-foreground">Recebido</span>
                  <CheckCircle2 size={16} className="text-success" />
                </div>
                <p className="text-xl font-bold text-success">{fmt(recebido)}</p>
              </div>
              <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-semibold uppercase text-muted-foreground">Pendente</span>
                  <Hourglass size={16} className="text-warning" />
                </div>
                <p className="text-xl font-bold text-warning">{fmt(pendente)}</p>
              </div>
            </div>

            <div className="space-y-4">
              <h2 className="text-sm font-bold">Meus Projetos</h2>
              <div className="space-y-2">
                {data.projetos.map((p: any) => (
                  <button 
                    key={p.id} 
                    onClick={() => setSelectedProjeto(p.id)}
                    className="w-full text-left bg-card border border-border rounded-xl p-4 shadow-sm hover:border-primary/50 transition-all flex items-center justify-between"
                  >
                    <div>
                      <p className="text-sm font-semibold">{p.nome}</p>
                      <p className="text-[11px] text-muted-foreground truncate max-w-[200px]">{p.endereco_obra || "Sem endereço"}</p>
                    </div>
                    <ChevronRight size={16} className="text-muted-foreground" />
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <h2 className="text-sm font-bold">Histórico de Pagamentos</h2>
              <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-secondary/50 border-b border-border">
                      <th className="text-left px-4 py-3 font-semibold">Data</th>
                      <th className="text-left px-4 py-3 font-semibold">Descrição</th>
                      <th className="text-right px-4 py-3 font-semibold">Valor</th>
                      <th className="text-center px-4 py-3 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {data.pagamentos.map((p: any) => (
                      <tr key={p.id}>
                        <td className="px-4 py-3">{new Date(p.data + "T00:00:00").toLocaleDateString("pt-BR")}</td>
                        <td className="px-4 py-3 font-medium">{p.descricao}</td>
                        <td className="px-4 py-3 text-right font-bold">{fmt(Number(p.valor_tecnico))}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            p.status_pagamento_tecnico === "pago" ? "bg-success/10 text-success" : "bg-warning/10 text-warning"
                          }`}>
                            {p.status_pagamento_tecnico === "pago" ? "PAGO" : "PENDENTE"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default PortalTecnico;