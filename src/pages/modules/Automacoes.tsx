import { Bell, CheckCircle2, Clock } from "lucide-react";
import { useFinanceiroPagar, useFinanceiroReceber } from "@/hooks/useFinanceiro";
import { useNecessidadesCompra } from "@/hooks/useNecessidadesCompra";

const Automacoes = () => {
  const { data: receber } = useFinanceiroReceber();
  const { data: pagar } = useFinanceiroPagar();
  const { data: necessidades } = useNecessidadesCompra();

  const vencidas = receber?.filter(r => r.status === "pendente" && r.data_vencimento && new Date(r.data_vencimento) < new Date()) ?? [];
  const pagarVencidas = pagar?.filter(p => p.status === "pendente" && p.data_vencimento && new Date(p.data_vencimento) < new Date()) ?? [];
  const comprasPendentes = necessidades?.filter(n => n.status === "pendente") ?? [];

  const automacoes = [
    { titulo: "Cobranças Vencidas (Receber)", qtd: vencidas.length, tipo: "alerta", desc: "Parcelas a receber com vencimento ultrapassado" },
    { titulo: "Contas a Pagar Vencidas", qtd: pagarVencidas.length, tipo: "alerta", desc: "Pagamentos com vencimento ultrapassado" },
    { titulo: "Compras Pendentes", qtd: comprasPendentes.length, tipo: "info", desc: "Necessidades de compra aguardando ação" },
  ];

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center gap-2">
        <Bell size={18} className="text-primary" />
        <h1 className="text-lg font-bold text-foreground">Automações e Alertas</h1>
      </div>

      <div className="space-y-3">
        {automacoes.map((a, i) => (
          <div key={i} className="bg-card border border-border rounded-lg p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              {a.qtd > 0 ? <Clock size={18} className="text-warning" /> : <CheckCircle2 size={18} className="text-success" />}
              <div>
                <h3 className="text-sm font-semibold text-foreground">{a.titulo}</h3>
                <p className="text-[11px] text-muted-foreground">{a.desc}</p>
              </div>
            </div>
            <span className={`text-lg font-bold ${a.qtd > 0 ? "text-warning" : "text-success"}`}>{a.qtd}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Automacoes;
