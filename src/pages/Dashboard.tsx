import {
  DollarSign, FolderKanban, Users, Package, TrendingUp,
  ArrowUpRight, ArrowDownRight, ShoppingCart, Clock, AlertTriangle
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell
} from "recharts";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/hooks/useEmpresa";

interface StatCardProps {
  title: string;
  value: string;
  change: string;
  positive: boolean;
  icon: React.ElementType;
}

const StatCard = ({ title, value, change, positive, icon: Icon }: StatCardProps) => (
  <div className="bg-card rounded-lg border border-border p-4 shadow-sm">
    <div className="flex items-start justify-between">
      <div>
        <p className="text-xs text-muted-foreground">{title}</p>
        <p className="text-xl font-bold text-foreground mt-1">{value}</p>
        <div className={`flex items-center gap-1 mt-1.5 text-[11px] ${positive ? "text-success" : "text-destructive"}`}>
          {positive ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
          <span>{change}</span>
        </div>
      </div>
      <div className="p-2 rounded-md bg-primary/10 text-primary">
        <Icon size={18} />
      </div>
    </div>
  </div>
);

const CYAN = "hsl(200, 80%, 55%)";
const GRAY = "hsl(220, 10%, 45%)";

const Dashboard = () => {
  const empresaId = useEmpresa();

  const { data: stats } = useQuery({
    queryKey: ["dashboard_stats", empresaId],
    queryFn: async () => {
      const [receber, pagar, projetos, leads, compras] = await Promise.all([
        supabase.from("financeiro_receber").select("valor, status").then(r => r.data ?? []),
        supabase.from("financeiro_pagar").select("valor, status").then(r => r.data ?? []),
        supabase.from("projetos").select("id, status, nome, venda_total, custo_real, lucro_real").then(r => r.data ?? []),
        supabase.from("clientes").select("id, status_crm").then(r => r.data ?? []),
        supabase.from("compras").select("id, valor_total, status").then(r => r.data ?? []),
      ]);

      const receitaTotal = receber.filter(r => r.status === "pago").reduce((a, r) => a + (r.valor ?? 0), 0);
      const projetosAtivos = projetos.filter(p => p.status === "em_andamento").length;
      const leadsCount = leads.filter(l => l.status_crm === "lead").length;
      const comprasPendentes = compras.filter(c => c.status === "pendente").reduce((a, c) => a + (c.valor_total ?? 0), 0);
      const comprasPendentesCount = compras.filter(c => c.status === "pendente").length;

      const statusCounts: Record<string, number> = {};
      projetos.forEach(p => { statusCounts[p.status ?? "orcamento"] = (statusCounts[p.status ?? "orcamento"] || 0) + 1; });

      const contasVencidas = pagar.filter(p => p.status === "vencido").length + receber.filter(r => r.status === "vencido").length;

      return { receitaTotal, projetosAtivos, leadsCount, comprasPendentes, comprasPendentesCount, statusCounts, projetos, contasVencidas };
    },
    enabled: !!empresaId,
  });

  const fmt = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}`;

  const projectStatusData = [
    { name: "Em Andamento", value: stats?.statusCounts?.em_andamento ?? 0, color: "hsl(200, 80%, 55%)" },
    { name: "Aprovado", value: stats?.statusCounts?.aprovado ?? 0, color: "hsl(152, 69%, 40%)" },
    { name: "Orçamento", value: stats?.statusCounts?.orcamento ?? 0, color: "hsl(220, 10%, 45%)" },
    { name: "Proposta", value: stats?.statusCounts?.proposta ?? 0, color: "hsl(38, 92%, 50%)" },
    { name: "Concluído", value: stats?.statusCounts?.concluido ?? 0, color: "hsl(140, 60%, 40%)" },
  ].filter(d => d.value > 0);

  const topProjetos = stats?.projetos
    ?.filter(p => (p.venda_total ?? 0) > 0)
    .sort((a, b) => (b.venda_total ?? 0) - (a.venda_total ?? 0))
    .slice(0, 5) ?? [];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-bold text-foreground">Dashboard</h1>
        <p className="text-xs text-muted-foreground mt-0.5">Visão geral do INFINIT SYSTEM</p>
      </div>

      {stats?.contasVencidas ? (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
          <AlertTriangle size={16} className="text-destructive" />
          <span className="text-xs text-destructive font-medium">{stats.contasVencidas} conta(s) vencida(s) — verifique o financeiro!</span>
        </div>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Receita Recebida" value={fmt(stats?.receitaTotal ?? 0)} change="Total recebido" positive icon={DollarSign} />
        <StatCard title="Projetos Ativos" value={String(stats?.projetosAtivos ?? 0)} change="Em andamento" positive icon={FolderKanban} />
        <StatCard title="Leads no Funil" value={String(stats?.leadsCount ?? 0)} change="Aguardando contato" positive icon={Users} />
        <StatCard title="Compras Pendentes" value={fmt(stats?.comprasPendentes ?? 0)} change={`${stats?.comprasPendentesCount ?? 0} pedido(s)`} positive={false} icon={ShoppingCart} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-card rounded-lg border border-border p-4 shadow-sm">
          <h3 className="text-xs font-semibold text-foreground mb-3">Top Projetos por Venda</h3>
          {topProjetos.length > 0 ? (
            <div className="space-y-2">
              {topProjetos.map(p => (
                <div key={p.id} className="flex items-center justify-between p-2 rounded bg-secondary/30">
                  <span className="text-xs text-foreground font-medium">{p.nome}</span>
                  <div className="flex gap-4 text-[11px]">
                    <span className="text-muted-foreground">Venda: <strong className="text-foreground">{fmt(p.venda_total ?? 0)}</strong></span>
                    <span className="text-muted-foreground">Lucro: <strong className={(p.lucro_real ?? 0) >= 0 ? "text-success" : "text-destructive"}>{fmt(p.lucro_real ?? 0)}</strong></span>
                  </div>
                </div>
              ))}
            </div>
          ) : <p className="text-xs text-muted-foreground text-center py-8">Nenhum projeto com vendas registradas.</p>}
        </div>

        <div className="bg-card rounded-lg border border-border p-4 shadow-sm">
          <h3 className="text-xs font-semibold text-foreground mb-3">Status dos Projetos</h3>
          {projectStatusData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={projectStatusData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} dataKey="value" stroke="none">
                    {projectStatusData.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: "hsl(222, 15%, 16%)", border: "1px solid hsl(222, 12%, 25%)", borderRadius: "6px", fontSize: "12px", color: "hsl(220, 10%, 88%)" }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1.5 mt-2">
                {projectStatusData.map(item => (
                  <div key={item.name} className="flex items-center justify-between text-[11px]">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="text-muted-foreground">{item.name}</span>
                    </div>
                    <span className="font-semibold text-foreground">{item.value}</span>
                  </div>
                ))}
              </div>
            </>
          ) : <p className="text-xs text-muted-foreground text-center py-8">Nenhum projeto.</p>}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
