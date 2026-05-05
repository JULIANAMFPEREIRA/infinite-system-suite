import { useState } from "react";
 import { Bell, User, LogOut, Menu, Link2, Copy, Check, ExternalLink } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { useFinanceiroPagar, useFinanceiroReceber } from "@/hooks/useFinanceiro";
import { useNecessidadesCompra } from "@/hooks/useNecessidadesCompra";
import GlobalSearch from "./GlobalSearch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface TopBarProps {
  onToggleMobileMenu?: () => void;
}

const TopBar = ({ onToggleMobileMenu }: TopBarProps) => {
  const { profile, roles, signOut } = useAuth();
  const navigate = useNavigate();
  const [showNotif, setShowNotif] = useState(false);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

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

  const publicUrl = window.location.origin + "/cadastro";
  const handleCopyLink = () => {
    navigator.clipboard.writeText(publicUrl);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  return (
    <header className="h-14 md:h-14 border-b border-border bg-card flex items-center justify-between px-3 md:px-6">
      <div className="flex items-center gap-2 md:gap-3">
        {/* Hamburger for mobile */}
        <button
          onClick={onToggleMobileMenu}
          className="md:hidden p-1.5 rounded-md hover:bg-secondary transition-colors text-muted-foreground"
        >
          <Menu size={20} />
        </button>
        <div className="flex items-center gap-1.5">
          <span className="text-lg font-black text-foreground tracking-tight">
            INFINIT
          </span>
          <div className="w-px h-5 bg-border" />
          <span className="text-lg font-light text-muted-foreground tracking-widest uppercase text-sm">
            system
          </span>
        </div>
      </div>
      <GlobalSearch />
      <div className="flex items-center gap-2 md:gap-4">
        <button
          onClick={() => setShowLinkModal(true)}
          className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary/10 hover:bg-primary/20 text-primary text-xs font-medium transition-colors"
          title="Gerar link de cadastro"
        >
          <Link2 size={14} />
          <span className="hidden md:inline">Link Cadastro</span>
        </button>
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
        <div className="flex items-center gap-2 md:gap-3 pl-2 md:pl-4 border-l border-border">
           <div className="flex flex-col items-end hidden sm:flex">
             <div className="text-right">
               <p className="text-xs font-medium text-foreground leading-tight">{profile?.full_name ?? "Usuário"}</p>
               <p className="text-[11px] text-muted-foreground leading-tight">{roles[0] ?? "—"}</p>
             </div>
              {roles.includes('admin') && (
                <a
                  href="/portal/parceiro"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => {
                    e.stopPropagation();
                    window.open("/portal/parceiro", "_blank");
                  }}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                >
                  <ExternalLink size={12} />
                  Portal
                </a>
              )}
           </div>
          <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center border border-primary/30">
            <User size={14} className="text-primary" />
          </div>
          <button onClick={handleLogout} className="p-2 rounded-md hover:bg-secondary transition-colors text-muted-foreground hover:text-destructive" title="Sair">
            <LogOut size={14} />
          </button>
        </div>
      </div>
      <Dialog open={showLinkModal} onOpenChange={setShowLinkModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Link de Cadastro Público</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Compartilhe este link para captar novos clientes. Não requer orçamento prévio.
          </p>
          <div className="flex items-center gap-2 mt-2">
            <Input value={publicUrl} readOnly className="text-xs" />
            <Button size="sm" variant="outline" onClick={handleCopyLink} className="shrink-0">
              {linkCopied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </header>
  );
};

export default TopBar;
