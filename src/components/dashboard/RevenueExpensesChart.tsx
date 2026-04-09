import { useMemo } from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { TrendingUp, TrendingDown } from "lucide-react";

interface FinanceiroItem {
  valor: number | null;
  status: string | null;
  data_vencimento: string | null;
  data_pagamento?: string | null;
}

interface Props {
  receber: FinanceiroItem[];
  pagar: FinanceiroItem[];
}

const MONTHS_PT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

const fmt = (v: number) =>
  `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const receita = payload.find((p: any) => p.dataKey === "receita")?.value ?? 0;
  const despesa = payload.find((p: any) => p.dataKey === "despesa")?.value ?? 0;
  const lucro = receita - despesa;
  return (
    <div className="bg-[hsl(222,18%,12%)] border border-border/60 rounded-lg px-4 py-3 shadow-xl backdrop-blur-sm">
      <p className="text-[11px] font-semibold text-foreground mb-2">{label}</p>
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[hsl(152,69%,50%)]" />
          <span className="text-[11px] text-muted-foreground">Receitas:</span>
          <span className="text-[11px] font-semibold text-foreground ml-auto">{fmt(receita)}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[hsl(0,72%,55%)]" />
          <span className="text-[11px] text-muted-foreground">Despesas:</span>
          <span className="text-[11px] font-semibold text-foreground ml-auto">{fmt(despesa)}</span>
        </div>
        <div className="border-t border-border/40 pt-1 mt-1">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${lucro >= 0 ? "bg-[hsl(152,69%,50%)]" : "bg-[hsl(0,72%,55%)]"}`} />
            <span className="text-[11px] text-muted-foreground">Lucro:</span>
            <span className={`text-[11px] font-bold ml-auto ${lucro >= 0 ? "text-[hsl(152,69%,50%)]" : "text-[hsl(0,72%,55%)]"}`}>
              {fmt(lucro)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default function RevenueExpensesChart({ receber, pagar }: Props) {
  const { chartData, lucroMesAtual, isLoss } = useMemo(() => {
    const now = new Date();
    const data: { name: string; receita: number; despesa: number; month: number; year: number }[] = [];

    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const m = d.getMonth();
      const y = d.getFullYear();

      const receitaMes = receber
        .filter(r => {
          const dt = r.data_vencimento ? new Date(r.data_vencimento) : null;
          return dt && dt.getMonth() === m && dt.getFullYear() === y;
        })
        .reduce((a, r) => a + (Number(r.valor) || 0), 0);

      const despesaMes = pagar
        .filter(p => {
          const dt = p.data_vencimento ? new Date(p.data_vencimento) : null;
          return dt && dt.getMonth() === m && dt.getFullYear() === y;
        })
        .reduce((a, p) => a + (Number(p.valor) || 0), 0);

      data.push({
        name: `${MONTHS_PT[m]}/${String(y).slice(2)}`,
        receita: receitaMes,
        despesa: despesaMes,
        month: m,
        year: y,
      });
    }

    const current = data[data.length - 1];
    const lucro = (current?.receita ?? 0) - (current?.despesa ?? 0);

    return { chartData: data, lucroMesAtual: lucro, isLoss: lucro < 0 };
  }, [receber, pagar]);

  return (
    <div className="h-full">
      {/* Chart container */}
      <div className="bg-card rounded-xl border border-border p-4 shadow-sm relative overflow-hidden h-full flex flex-col">
        {/* Subtle glow background */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.03] to-transparent pointer-events-none" />

        {/* Header */}
        <div className="flex items-center justify-between gap-2 mb-2 relative z-10">
          <div>
            <h3 className="text-xs font-semibold text-foreground">Receitas vs Despesas</h3>
            <p className="text-[10px] text-muted-foreground">Últimos 6 meses</p>
          </div>
          <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border text-[10px] ${
            isLoss
              ? "bg-[hsl(0,72%,55%)]/10 border-[hsl(0,72%,55%)]/20 text-[hsl(0,72%,55%)]"
              : "bg-[hsl(152,69%,50%)]/10 border-[hsl(152,69%,50%)]/20 text-[hsl(152,69%,50%)]"
          }`}>
            {isLoss ? <TrendingDown size={12} /> : <TrendingUp size={12} />}
            <span className="font-bold">{fmt(lucroMesAtual)}</span>
          </div>
        </div>

        {/* Chart */}
        <div className="flex-1 min-h-0 relative z-10">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="gradReceita" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(152, 69%, 50%)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(152, 69%, 50%)" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="gradDespesa" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(0, 72%, 55%)" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="hsl(0, 72%, 55%)" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(222, 12%, 18%)" vertical={false} />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 9, fill: "hsl(220, 10%, 55%)" }}
                axisLine={{ stroke: "hsl(222, 12%, 18%)" }}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 9, fill: "hsl(220, 10%, 55%)" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="receita"
                stroke="hsl(152, 69%, 50%)"
                strokeWidth={2}
                fill="url(#gradReceita)"
                dot={false}
                activeDot={{ r: 3, stroke: "hsl(152, 69%, 50%)", strokeWidth: 2, fill: "hsl(222, 18%, 12%)" }}
              />
              <Area
                type="monotone"
                dataKey="despesa"
                stroke="hsl(0, 72%, 55%)"
                strokeWidth={2}
                fill="url(#gradDespesa)"
                dot={false}
                activeDot={{ r: 3, stroke: "hsl(0, 72%, 55%)", strokeWidth: 2, fill: "hsl(222, 18%, 12%)" }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Legend */}
        <div className="flex items-center justify-center gap-4 mt-1 relative z-10">
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-[2px] rounded bg-[hsl(152,69%,50%)]" />
            <span className="text-[9px] text-muted-foreground">Receitas</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-[2px] rounded bg-[hsl(0,72%,55%)]" />
            <span className="text-[9px] text-muted-foreground">Despesas</span>
          </div>
        </div>
      </div>
    </div>
  );
}
