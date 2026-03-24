import {
  DollarSign, FolderKanban, Users, Package, TrendingUp,
  ArrowUpRight, ArrowDownRight, ShoppingCart, Clock
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell
} from "recharts";

const revenueData = [
  { month: "Jan", receita: 45000, custo: 28000 },
  { month: "Fev", receita: 52000, custo: 31000 },
  { month: "Mar", receita: 48000, custo: 29000 },
  { month: "Abr", receita: 61000, custo: 35000 },
  { month: "Mai", receita: 55000, custo: 32000 },
  { month: "Jun", receita: 67000, custo: 38000 },
];

const projectStatusData = [
  { name: "Em Andamento", value: 8, color: "hsl(187, 100%, 50%)" },
  { name: "Aguardando", value: 3, color: "hsl(38, 92%, 50%)" },
  { name: "Concluídos", value: 12, color: "hsl(152, 69%, 45%)" },
  { name: "Propostas", value: 5, color: "hsl(220, 14%, 40%)" },
];

const purchaseData = [
  { item: "Amplificadores", qtd: 12 },
  { item: "Caixas Som", qtd: 24 },
  { item: "Switches", qtd: 8 },
  { item: "Cabos HDMI", qtd: 45 },
  { item: "TVs", qtd: 6 },
];

interface StatCardProps {
  title: string;
  value: string;
  change: string;
  positive: boolean;
  icon: React.ElementType;
}

const StatCard = ({ title, value, change, positive, icon: Icon }: StatCardProps) => (
  <div className="glass rounded-lg p-5 animate-slide-up hover:glow-border transition-shadow duration-300">
    <div className="flex items-start justify-between">
      <div>
        <p className="text-sm text-muted-foreground">{title}</p>
        <p className="text-2xl font-bold text-foreground mt-1">{value}</p>
        <div className={`flex items-center gap-1 mt-2 text-xs ${positive ? "text-success" : "text-destructive"}`}>
          {positive ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
          <span>{change}</span>
        </div>
      </div>
      <div className="p-2.5 rounded-lg bg-primary/10 text-primary">
        <Icon size={20} />
      </div>
    </div>
  </div>
);

const Dashboard = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">Visão geral do INFINIT SYSTEM</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Receita Mensal" value="R$ 67.000" change="+12.5% vs mês anterior" positive icon={DollarSign} />
        <StatCard title="Projetos Ativos" value="8" change="+2 novos este mês" positive icon={FolderKanban} />
        <StatCard title="Leads no Funil" value="23" change="+5 esta semana" positive icon={Users} />
        <StatCard title="Compras Pendentes" value="R$ 18.500" change="6 pedidos aguardando" positive={false} icon={ShoppingCart} />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Revenue Chart */}
        <div className="lg:col-span-2 glass rounded-lg p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4">Receita vs Custo</h3>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={revenueData}>
              <defs>
                <linearGradient id="colorReceita" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(187, 100%, 50%)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(187, 100%, 50%)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorCusto" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(220, 14%, 40%)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(220, 14%, 40%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 14%, 18%)" />
              <XAxis dataKey="month" stroke="hsl(215, 15%, 55%)" fontSize={12} />
              <YAxis stroke="hsl(215, 15%, 55%)" fontSize={12} tickFormatter={(v) => `${v / 1000}k`} />
              <Tooltip
                contentStyle={{ backgroundColor: "hsl(220, 18%, 12%)", border: "1px solid hsl(220, 14%, 18%)", borderRadius: "8px", color: "hsl(210, 20%, 92%)" }}
                formatter={(value: number) => [`R$ ${value.toLocaleString()}`, undefined]}
              />
              <Area type="monotone" dataKey="receita" stroke="hsl(187, 100%, 50%)" fill="url(#colorReceita)" strokeWidth={2} />
              <Area type="monotone" dataKey="custo" stroke="hsl(220, 14%, 40%)" fill="url(#colorCusto)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Project Status */}
        <div className="glass rounded-lg p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4">Status dos Projetos</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={projectStatusData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" stroke="none">
                {projectStatusData.map((entry, index) => (
                  <Cell key={index} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ backgroundColor: "hsl(220, 18%, 12%)", border: "1px solid hsl(220, 14%, 18%)", borderRadius: "8px", color: "hsl(210, 20%, 92%)" }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-2 mt-2">
            {projectStatusData.map((item) => (
              <div key={item.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-muted-foreground">{item.name}</span>
                </div>
                <span className="font-semibold text-foreground">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Purchases chart */}
        <div className="glass rounded-lg p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4">Itens Mais Comprados</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={purchaseData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 14%, 18%)" />
              <XAxis type="number" stroke="hsl(215, 15%, 55%)" fontSize={12} />
              <YAxis type="category" dataKey="item" stroke="hsl(215, 15%, 55%)" fontSize={12} width={100} />
              <Tooltip contentStyle={{ backgroundColor: "hsl(220, 18%, 12%)", border: "1px solid hsl(220, 14%, 18%)", borderRadius: "8px", color: "hsl(210, 20%, 92%)" }} />
              <Bar dataKey="qtd" fill="hsl(187, 100%, 50%)" radius={[0, 4, 4, 0]} barSize={16} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Recent Activity */}
        <div className="glass rounded-lg p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4">Atividade Recente</h3>
          <div className="space-y-3">
            {[
              { text: "Novo lead capturado — Instagram", time: "Há 15 min", icon: Users },
              { text: "Projeto #042 — Etapa concluída", time: "Há 1h", icon: FolderKanban },
              { text: "Compra aprovada — R$ 4.200", time: "Há 2h", icon: ShoppingCart },
              { text: "Pagamento recebido — R$ 12.000", time: "Há 3h", icon: DollarSign },
              { text: "Estoque atualizado — 24 itens", time: "Há 5h", icon: Package },
              { text: "Contrato assinado — Projeto #039", time: "Há 6h", icon: TrendingUp },
            ].map((activity, i) => (
              <div key={i} className="flex items-center gap-3 p-2.5 rounded-md hover:bg-secondary/50 transition-colors">
                <div className="p-1.5 rounded-md bg-primary/10 text-primary">
                  <activity.icon size={14} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground truncate">{activity.text}</p>
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                  <Clock size={12} />
                  <span>{activity.time}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
