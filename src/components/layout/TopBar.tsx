import { useState } from "react";
import { Bell, Search, User, LogOut } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { useFinanceiroPagar, useFinanceiroReceber } from "@/hooks/useFinanceiro";
import { useNecessidadesCompra } from "@/hooks/useNecessidadesCompra";

const TopBar = () => {
  const { profile, roles, signOut } = useAuth();
  const navigate = useNavigate();
  const [showNotif, setShowNotif] = useState(false);

  const { data: receber } = useFinanceiroReceber();
  const { data: pagar } = useFinanceiroPagar();
  const { data: necessidades } = useNecessidadesCompra();

  const hoje = new Date();
  const receberVencidas = receber?.filter(r => r.status === "pendente" && r.data_vencimento && new Date(r.data_vencimento) < hoje) ?? [];
  const pagarVencidas = pagar?.filter(p => p.status === "pendente" && p.data_vencimento && new Date(p.data_vencimento) < hoje) ?? [];
  const comprasPendentes = necessidades?.filter(n => n.status === "pendente") ?? [];

  const notifications = [
    ...receberVencidas.map(r => ({ msg: `Cobrança vencida: ${r.descricao ?? "—"}`, type: "danger" as const })),
    ...pagarVencidas.map(p => ({ msg: `Conta vencida: ${p.descricao ?? "—"}`, type: "danger" as const })),
    ...comprasPendentes.slice(0, 3).map(n => ({ msg: `Compra pendente: ${n.descricao ?? "Item"}`, type: "warning" as const })),
  ];
  const totalAlerts = receberVencidas.length + pagarVencidas.length + comprasPendentes.length;

  const handleLogout = async () => { await signOut(); navigate("/login"); };

  return (
    <header className="h-14 border-b border-border bg-card flex items-center justify-between px-6">
      <div className="flex flex-col justify-center">
        <h1 className="text-sm font-bold tracking-widest text-foreground uppercase">ERP INFINIT NETWORK</h1>
        <p className="text-[10px] text-muted-foreground font-light tracking-wide">Sistema Inteligente de Gestão Comercial e Projetos</p>
      </div>
      <div className="flex items-center gap-4">
        <div className="relative">
          <button onClick={() => setShowNotif(!showNotif)} className="relative p-2 rounded-md hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground">
            <Bell size={16} />
            {totalAlerts > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 flex items-center justify-center px-1 text-[9px] font-bold bg-destructive text-destructive-foreground rounded-full">{totalAlerts > 9 ? "9+" : totalAlerts}</span>
            )}
          </button>
          {showNotif && (
            <div className="absolute right-0 top-10 w-72 bg-card border border-border rounded-lg shadow-lg z-50 overflow-hidden">
              <div className="px-3 py-2 border-b border-border"><p className="text-xs font-semibold text-foreground">Notificações ({totalAlerts})</p></div>
              <div className="max-h-60 overflow-y-auto">
                {notifications.length > 0 ? notifications.slice(0, 8).map((n, i) => (
                  <div key={i} className={`px-3 py-2 border-b border-border last:border-b-0 text-[11px] ${n.type === "danger" ? "text-destructive" : "text-warning"}`}>
                    {n.msg}
                  </div>
                )) : (
                  <div className="px-3 py-4 text-center text-xs text-muted-foreground">Nenhuma notificação.</div>
                )}
              </div>
              {totalAlerts > 8 && (
                <div className="px-3 py-2 border-t border-border text-center">
                  <button onClick={() => { navigate("/automacoes"); setShowNotif(false); }} className="text-[11px] text-primary hover:underline">Ver todas</button>
                </div>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-3 pl-4 border-l border-border">
          <div className="text-right">
            <p className="text-xs font-medium text-foreground">{profile?.full_name ?? "Usuário"}</p>
            <p className="text-[11px] text-muted-foreground">{roles[0] ?? "—"}</p>
          </div>
          <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center border border-primary/30">
            <User size={14} className="text-primary" />
          </div>
          <button onClick={handleLogout} className="p-2 rounded-md hover:bg-secondary transition-colors text-muted-foreground hover:text-destructive" title="Sair">
            <LogOut size={14} />
          </button>
        </div>
      </div>
    </header>
  );
};

export default TopBar;
