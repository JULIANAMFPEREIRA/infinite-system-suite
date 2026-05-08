import { useState, useMemo } from "react";
import { UserCheck, Search, Filter, Wallet, Clock, CheckCircle2 } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/hooks/useEmpresa";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

const fmt = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const Comissoes = () => {
  const empresaId = useEmpresa();
  const qc = useQueryClient();

  // Filtros
  const [filtroParceiro, setFiltroParceiro] = useState("");
  const [filtroProjeto, setFiltroProjeto] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [busca, setBusca] = useState("");

  // Query principal
  const { data: comissoes, isLoading } = useQuery({
    queryKey: ["comissoes_rt", empresaId, filtroParceiro, filtroStatus, filtroProjeto],
    queryFn: async () => {
      let query = supabase
        .from("comissoes")
        .select(`
          *,
          fornecedores(id, nome),
          projetos(id, nome)
        `)
        .eq("empresa_id", empresaId!)
        .eq("deletado", false)
        .order("created_at", { ascending: false });

      if (filtroParceiro) {
        query = query.eq("fornecedor_id", filtroParceiro);
      }
      if (filtroStatus && filtroStatus !== "todos") {
        query = query.eq("status", filtroStatus as any);
      }
      if (filtroProjeto) {
        query = query.eq("projeto_id", filtroProjeto);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!empresaId,
  });

  // Queries para os selects de filtro
  const { data: parceirosList } = useQuery({
    queryKey: ["parceiros_comissoes", empresaId],
    queryFn: async () => {
      const { data } = await supabase
        .from("fornecedores")
        .select("id, nome")
        .eq("empresa_id", empresaId!)
        .eq("deletado", false)
        .order("nome");
      return data ?? [];
    },
    enabled: !!empresaId,
  });

  const { data: projetosList } = useQuery({
    queryKey: ["projetos_comissoes", empresaId],
    queryFn: async () => {
      const { data } = await supabase
        .from("projetos")
        .select("id, nome")
        .eq("empresa_id", empresaId!)
        .eq("deletado", false)
        .order("nome");
      return data ?? [];
    },
    enabled: !!empresaId,
  });

  const filteredComissoes = useMemo(() => {
    if (!comissoes) return [];
    return comissoes.filter(c => {
      const searchStr = busca.toLowerCase();
      const parceiroNome = (c.fornecedores as any)?.nome?.toLowerCase() || "";
      const projetoNome = (c.projetos as any)?.nome?.toLowerCase() || "";
      return parceiroNome.includes(searchStr) || projetoNome.includes(searchStr);
    });
  }, [comissoes, busca]);

  // Resumos
  const totais = useMemo(() => {
    if (!comissoes) return { total: 0, pago: 0, pendente: 0 };
    return comissoes.reduce((acc, c: any) => {
      const parcelas = (c as any).financeiro_pagar || [];
      if (parcelas.length > 1) {
        parcelas.forEach((p: any) => {
          const valor = p.valor || 0;
          acc.total += valor;
          if (p.status === "pago") acc.pago += valor;
          else acc.pendente += valor;
        });
      } else {
        const valor = c.valor || 0;
        acc.total += valor;
        if (c.status === "pago") acc.pago += valor;
        else acc.pendente += valor;
      }
      return acc;
    }, { total: 0, pago: 0, pendente: 0 });
  }, [comissoes]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <UserCheck size={20} className="text-primary" />
          <h1 className="text-xl font-bold text-foreground">Comissões RT</h1>
        </div>
      </div>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-card border border-border p-4 rounded-lg flex items-center gap-4">
          <div className="p-3 rounded-full bg-primary/10 text-primary">
            <Wallet size={20} />
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase font-semibold">Total de Comissões</p>
            <p className="text-lg font-bold">{fmt(totais.total)}</p>
          </div>
        </div>
        <div className="bg-card border border-border p-4 rounded-lg flex items-center gap-4">
          <div className="p-3 rounded-full bg-green-500/10 text-green-500">
            <CheckCircle2 size={20} />
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase font-semibold">Total Pago</p>
            <p className="text-lg font-bold text-green-600">{fmt(totais.pago)}</p>
          </div>
        </div>
        <div className="bg-card border border-border p-4 rounded-lg flex items-center gap-4">
          <div className="p-3 rounded-full bg-orange-500/10 text-orange-500">
            <Clock size={20} />
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase font-semibold">Total Pendente</p>
            <p className="text-lg font-bold text-orange-600">{fmt(totais.pendente)}</p>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-card border border-border rounded-lg p-4 space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground mb-1">
          <Filter size={16} /> Filtros
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
          <div className="space-y-1">
            <label className="text-[10px] uppercase font-bold text-muted-foreground">Parceiro</label>
            <select 
              value={filtroParceiro} 
              onChange={e => setFiltroParceiro(e.target.value)}
              className="w-full h-9 px-3 text-xs bg-background border border-border rounded-md focus:ring-1 focus:ring-primary outline-none"
            >
              <option value="">Todos os parceiros</option>
              {parceirosList?.map(p => (
                <option key={p.id} value={p.id}>{p.nome}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] uppercase font-bold text-muted-foreground">Projeto</label>
            <select 
              value={filtroProjeto} 
              onChange={e => setFiltroProjeto(e.target.value)}
              className="w-full h-9 px-3 text-xs bg-background border border-border rounded-md focus:ring-1 focus:ring-primary outline-none"
            >
              <option value="">Todos os projetos</option>
              {projetosList?.map(p => (
                <option key={p.id} value={p.id}>{p.nome}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] uppercase font-bold text-muted-foreground">Status</label>
            <select 
              value={filtroStatus} 
              onChange={e => setFiltroStatus(e.target.value)}
              className="w-full h-9 px-3 text-xs bg-background border border-border rounded-md focus:ring-1 focus:ring-primary outline-none"
            >
              <option value="todos">Todos</option>
              <option value="pendente">Pendente</option>
              <option value="pago">Pago</option>
            </select>
          </div>
          <div className="space-y-1 md:col-span-2 lg:col-span-2">
            <label className="text-[10px] uppercase font-bold text-muted-foreground">Busca</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
              <input 
                type="text"
                placeholder="Nome do parceiro ou projeto..."
                value={busca}
                onChange={e => setBusca(e.target.value)}
                className="w-full h-9 pl-9 pr-3 text-xs bg-background border border-border rounded-md focus:ring-1 focus:ring-primary outline-none"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Tabela */}
      <div className="border border-border rounded-lg overflow-hidden bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-secondary/30 border-b border-border text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-3 text-left">Parceiro</th>
                <th className="px-4 py-3 text-left">Projeto</th>
                <th className="px-4 py-3 text-right">Valor</th>
                <th className="px-4 py-3 text-center">%</th>
                <th className="px-4 py-3 text-right">Pago</th>
                <th className="px-4 py-3 text-right">Pendente</th>
                <th className="px-4 py-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">Carregando comissões...</td>
                </tr>
              ) : filteredComissoes.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">Nenhuma comissão encontrada.</td>
                </tr>
              ) : (
                filteredComissoes.flatMap((c: any) => {
                  const parcelas = c.financeiro_pagar || [];
                  if (parcelas.length > 1) {
                    return parcelas.map((p: any) => (
                      <tr key={p.id} className="hover:bg-secondary/20 transition-colors">
                        <td className="px-4 py-3 font-medium">{(c.fornecedores as any)?.nome ?? "—"}</td>
                        <td className="px-4 py-3 text-muted-foreground">{(c.projetos as any)?.nome ?? "—"}</td>
                        <td className="px-4 py-3 text-right font-semibold">
                          <div className="flex flex-col items-end">
                            <span>{fmt(p.valor || 0)}</span>
                            <span className="text-[10px] text-muted-foreground italic">
                              {p.descricao}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center text-muted-foreground">{c.percentual || 0}%</td>
                        <td className="px-4 py-3 text-right text-green-600">
                          {p.status === "pago" ? fmt(p.valor || 0) : "R$ 0,00"}
                        </td>
                        <td className="px-4 py-3 text-right text-orange-600">
                          {p.status !== "pago" ? fmt(p.valor || 0) : "R$ 0,00"}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            p.status === "pago" ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"
                          }`}>
                            {p.status}
                          </span>
                        </td>
                      </tr>
                    ));
                  }
                  return (
                    <tr key={c.id} className="hover:bg-secondary/20 transition-colors">
                      <td className="px-4 py-3 font-medium">{(c.fornecedores as any)?.nome ?? "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{(c.projetos as any)?.nome ?? "—"}</td>
                      <td className="px-4 py-3 text-right font-semibold">
                        <div className="flex flex-col items-end">
                          <span>{fmt(c.valor || 0)}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center text-muted-foreground">{c.percentual || 0}%</td>
                      <td className="px-4 py-3 text-right text-green-600">
                        {c.status === "pago" ? fmt(c.valor || 0) : "R$ 0,00"}
                      </td>
                      <td className="px-4 py-3 text-right text-orange-600">
                        {c.status === "pendente" ? fmt(c.valor || 0) : "R$ 0,00"}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          c.status === "pago" ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"
                        }`}>
                          {c.status}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};

export default Comissoes;
