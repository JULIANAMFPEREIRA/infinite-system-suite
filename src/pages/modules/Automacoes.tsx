import { Bell, CheckCircle2, Clock, AlertTriangle, DollarSign, ShoppingCart } from "lucide-react";
import { useFinanceiroPagar, useFinanceiroReceber } from "@/hooks/useFinanceiro";
import { useNecessidadesCompra } from "@/hooks/useNecessidadesCompra";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/hooks/useEmpresa";

const Automacoes = () => {
  const empresaId = useEmpresa();
  const { data: receber } = useFinanceiroReceber();
  const { data: pagar } = useFinanceiroPagar();
  const { data: necessidades } = useNecessidadesCompra();

  const { data: projetos } = useQuery({
    queryKey: ["projetos_alertas", empresaId],
    queryFn: async () => { const { data } = await supabase.from("projetos").select("id, nome, custo_previsto, custo_real").gt("custo_real", 0); return data ?? []; },
    enabled: !!empresaId,
  });

  const hoje = new Date();
  const vencidas = receber?.filter(r => r.status === "pendente" && r.data_vencimento && new Date(r.data_vencimento) < hoje) ?? [];
  const pagarVencidas = pagar?.filter(p => p.status === "pendente" && p.data_vencimento && new Date(p.data_vencimento) < hoje) ?? [];
  const comprasPendentes = necessidades?.filter(n => n.status === "pendente") ?? [];
  const custoExcedido = projetos?.filter(p => (p.custo_real ?? 0) > (p.custo_previsto ?? 0) && (p.custo_previsto ?? 0) > 0) ?? [];

  const sevenDaysAgo = new Date(); sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const comprasAntigas = necessidades?.filter(n => n.status === "pendente" && n.created_at && new Date(n.created_at) < sevenDaysAgo) ?? [];

  const alertas = [
    { titulo: "Cobranças Vencidas (Receber)", qtd: vencidas.length, icon: DollarSign, desc: "Parcelas a receber com vencimento ultrapassado", tipo: "danger" as const },
    { titulo: "Contas a Pagar Vencidas", qtd: pagarVencidas.length, icon: DollarSign, desc: "Pagamentos com vencimento ultrapassado", tipo: "danger" as const },
    { titulo: "Projetos com Custo Excedido", qtd: custoExcedido.length, icon: AlertTriangle, desc: "Custo real maior que o previsto", tipo: "warning" as const },
    { titulo: "Compras Pendentes (+7 dias)", qtd: comprasAntigas.length, icon: ShoppingCart, desc: "Necessidades de compra há mais de 7 dias", tipo: "warning" as const },
    { titulo: "Todas as Compras Pendentes", qtd: comprasPendentes.length, icon: Clock, desc: "Necessidades de compra aguardando ação", tipo: "info" as const },
  ];

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center gap-2">
        <Bell size={18} className="text-primary" />
        <h1 className="text-lg font-bold text-foreground">Automações e Alertas</h1>
      </div>

      <div className="space-y-3">
        {alertas.map((a, i) => {
          const Icon = a.icon;
          const isDanger = a.tipo === "danger" && a.qtd > 0;
          const isWarning = a.tipo === "warning" && a.qtd > 0;
          return (
            <div key={i} className={`bg-card border rounded-lg p-4 flex items-center justify-between ${isDanger ? "border-destructive/40" : isWarning ? "border-warning/40" : "border-border"}`}>
              <div className="flex items-center gap-3">
                {a.qtd > 0 ? <Icon size={18} className={isDanger ? "text-destructive" : isWarning ? "text-warning" : "text-warning"} /> : <CheckCircle2 size={18} className="text-success" />}
                <div>
                  <h3 className="text-sm font-semibold text-foreground">{a.titulo}</h3>
                  <p className="text-[11px] text-muted-foreground">{a.desc}</p>
                </div>
              </div>
              <span className={`text-lg font-bold ${a.qtd > 0 ? (isDanger ? "text-destructive" : "text-warning") : "text-success"}`}>{a.qtd}</span>
            </div>
          );
        })}
      </div>

      {custoExcedido.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-foreground">Projetos com Custo Excedido</h3>
          <div className="border border-border rounded overflow-hidden">
            <table className="w-full text-xs">
              <thead><tr className="bg-secondary/60">
                <th className="text-left px-2.5 py-2 font-semibold border-b border-border">Projeto</th>
                <th className="text-right px-2.5 py-2 font-semibold border-b border-border">Custo Previsto</th>
                <th className="text-right px-2.5 py-2 font-semibold border-b border-border">Custo Real</th>
                <th className="text-right px-2.5 py-2 font-semibold border-b border-border">Excesso</th>
              </tr></thead>
              <tbody>
                {custoExcedido.map(p => (
                  <tr key={p.id} className="border-b border-border last:border-b-0">
                    <td className="px-2.5 py-1.5 font-medium">{p.nome}</td>
                    <td className="px-2.5 py-1.5 text-right">R$ {(p.custo_previsto ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
                    <td className="px-2.5 py-1.5 text-right text-destructive font-medium">R$ {(p.custo_real ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
                    <td className="px-2.5 py-1.5 text-right text-destructive">R$ {((p.custo_real ?? 0) - (p.custo_previsto ?? 0)).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default Automacoes;
