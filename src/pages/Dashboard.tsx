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
  { name: "Em Andamento", value: 8, color: "hsl(43, 74%, 49%)" },
  { name: "Aguardando", value: 3, color: "hsl(38, 92%, 50%)" },
  { name: "Concluídos", value: 12, color: "hsl(152, 69%, 40%)" },
  { name: "Propostas", value: 5, color: "hsl(220, 10%, 70%)" },
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

const GOLD = "hsl(43, 74%, 49%)";
const GRAY = "hsl(220, 10%, 70%)";

const Dashboard = () => {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-bold text-foreground">Dashboard</h1>
        <p className="text-xs text-muted-foreground mt-0.5">Visão geral do INFINIT SYSTEM</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Receita Mensal" value="R$ 67.000" change="+12.5% vs mês anterior" positive icon={DollarSign} />
        <StatCard title="Projetos Ativos" value="8" change="+2 novos este mês" positive icon={FolderKanban} />
        <StatCard title="Leads no Funil" value="23" change="+5 esta semana" positive icon={Users} />
        <StatCard title="Compras Pendentes" value="R$ 18.500" change="6 pedidos aguardando" positive={false} icon={ShoppingCart} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-card rounded-lg border border-border p-4 shadow-sm">
          <h3 className="text-xs font-semibold text-foreground mb-3">Receita vs Custo</h3>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={revenueData}>
              <defs>
                <linearGradient id="colorReceita" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={GOLD} stopOpacity={0.25} />
                  <stop offset="95%" stopColor={GOLD} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorCusto" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={GRAY} stopOpacity={0.2} />
                  <stop offset="95%" stopColor={GRAY} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 10%, 90%)" />
              <XAxis dataKey="month" stroke="hsl(220, 10%, 55%)" fontSize={11} />
              <YAxis stroke="hsl(220, 10%, 55%)" fontSize={11} tickFormatter={(v) => `${v / 1000}k`} />
              <Tooltip
                contentStyle={{ backgroundColor: "#fff", border: "1px solid hsl(220, 10%, 88%)", borderRadius: "6px", fontSize: "12px" }}
                formatter={(value: number) => [`R$ ${value.toLocaleString()}`, undefined]}
              />
              <Area type="monotone" dataKey="receita" stroke={GOLD} fill="url(#colorReceita)" strokeWidth={2} />
              <Area type="monotone" dataKey="custo" stroke={GRAY} fill="url(#colorCusto)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-card rounded-lg border border-border p-4 shadow-sm">
          <h3 className="text-xs font-semibold text-foreground mb-3">Status dos Projetos</h3>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={projectStatusData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} dataKey="value" stroke="none">
                {projectStatusData.map((entry, index) => (
                  <Cell key={index} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ backgroundColor: "#fff", border: "1px solid hsl(220, 10%, 88%)", borderRadius: "6px", fontSize: "12px" }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-1.5 mt-2">
            {projectStatusData.map((item) => (
              <div key={item.name} className="flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-muted-foreground">{item.name}</span>
                </div>
                <span className="font-semibold text-foreground">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-card rounded-lg border border-border p-4 shadow-sm">
          <h3 className="text-xs font-semibold text-foreground mb-3">Itens Mais Comprados</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={purchaseData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 10%, 90%)" />
              <XAxis type="number" stroke="hsl(220, 10%, 55%)" fontSize={11} />
              <YAxis type="category" dataKey="item" stroke="hsl(220, 10%, 55%)" fontSize={11} width={90} />
              <Tooltip contentStyle={{ backgroundColor: "#fff", border: "1px solid hsl(220, 10%, 88%)", borderRadius: "6px", fontSize: "12px" }} />
              <Bar dataKey="qtd" fill={GOLD} radius={[0, 3, 3, 0]} barSize={14} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-card rounded-lg border border-border p-4 shadow-sm">
          <h3 className="text-xs font-semibold text-foreground mb-3">Atividade Recente</h3>
          <div className="space-y-2">
            {[
              { text: "Novo lead capturado — Instagram", time: "Há 15 min", icon: Users },
              { text: "Projeto #042 — Etapa concluída", time: "Há 1h", icon: FolderKanban },
              { text: "Compra aprovada — R$ 4.200", time: "Há 2h", icon: ShoppingCart },
              { text: "Pagamento recebido — R$ 12.000", time: "Há 3h", icon: DollarSign },
              { text: "Estoque atualizado — 24 itens", time: "Há 5h", icon: Package },
              { text: "Contrato assinado — Projeto #039", time: "Há 6h", icon: TrendingUp },
            ].map((activity, i) => (
              <div key={i} className="flex items-center gap-2.5 p-2 rounded hover:bg-secondary/50 transition-colors">
                <div className="p-1.5 rounded bg-primary/10 text-primary">
                  <activity.icon size={12} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-foreground truncate">{activity.text}</p>
                </div>
                <div className="flex items-center gap-1 text-[11px] text-muted-foreground shrink-0">
                  <Clock size={10} />
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
