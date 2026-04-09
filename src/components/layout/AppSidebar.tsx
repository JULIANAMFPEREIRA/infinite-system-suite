import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Users, FolderKanban, Package, ShoppingCart,
  DollarSign, Wallet, BarChart3, FileText, Bell, PenTool,
  Receipt, Building2, Boxes, TrendingUp, Shield, Settings,
  ChevronLeft, ChevronRight, ChevronDown, Wrench, UserCheck, Truck, ClipboardList
} from "lucide-react";
import logoGold from "@/assets/logo.png";

interface NavItem {
  label: string;
  icon: React.ElementType;
  path?: string;
  children?: { label: string; path: string }[];
}

const navItems: NavItem[] = [
  { label: "Dashboard", icon: LayoutDashboard, path: "/" },
  { label: "CRM", icon: Users, path: "/crm" },
  { label: "Projetos", icon: FolderKanban, path: "/projetos" },
  { label: "Cronograma", icon: Wrench, path: "/cronograma" },
  {
    label: "Financeiro", icon: DollarSign, children: [
      { label: "Contas a Receber", path: "/financeiro/receber" },
      { label: "Contas a Pagar", path: "/financeiro/pagar" },
      { label: "Fluxo de Caixa", path: "/financeiro/fluxo" },
      { label: "Finanças Pessoais", path: "/financas-pessoais" },
      { label: "Comissões (RT)", path: "/comissoes" },
      { label: "Compras", path: "/compras" },
      { label: "Itens a Comprar", path: "/itens-comprar" },
    ]
  },
  { label: "Fornecedores/Parceiros", icon: Truck, path: "/fornecedores" },
  { label: "Estoque", icon: Package, path: "/estoque" },
  { label: "Kits", icon: Boxes, path: "/kits" },
  { label: "DRE", icon: TrendingUp, path: "/dre" },
  { label: "Relatórios", icon: BarChart3, path: "/relatorios" },
  { label: "Automações", icon: Bell, path: "/automacoes" },
  { label: "Contratos", icon: PenTool, path: "/contratos" },
  { label: "Nota Fiscal", icon: Receipt, path: "/notas-fiscais" },
  { label: "Integrações", icon: Building2, path: "/integracoes" },
  { label: "Auditoria", icon: Shield, path: "/auditoria" },
  { label: "Configurações", icon: Settings, path: "/configuracoes" },
];

const AppSidebar = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [openMenus, setOpenMenus] = useState<string[]>([]);
  const location = useLocation();

  const toggleMenu = (label: string) => {
    setOpenMenus(prev =>
      prev.includes(label) ? prev.filter(m => m !== label) : [...prev, label]
    );
  };

  return (
    <aside className={`fixed left-0 top-0 h-screen z-50 flex flex-col border-r border-border bg-card transition-all duration-300 ${collapsed ? "w-14" : "w-56"}`}>
      {/* Logo */}
      <div className="flex items-center justify-center h-14 border-b border-border px-2">
        {!collapsed ? (
          <img src={logoGold} alt="INFINIT NETWORK" className="h-7 object-contain" />
        ) : (
          <span className="text-primary font-bold text-sm">∞</span>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-2 px-1.5 space-y-0.5">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isOpen = openMenus.includes(item.label);
          const isActive = item.path ? location.pathname === item.path : item.children?.some(c => location.pathname === c.path);

          if (item.children) {
            return (
              <div key={item.label}>
                <button
                  onClick={() => toggleMenu(item.label)}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded text-xs transition-colors ${isActive ? "bg-accent text-accent-foreground font-medium border-l-2 border-primary" : "text-sidebar-foreground hover:bg-secondary"}`}
                >
                  <Icon size={15} />
                  {!collapsed && (
                    <>
                      <span className="flex-1 text-left">{item.label}</span>
                      <ChevronDown size={12} className={`transition-transform ${isOpen ? "rotate-180" : ""}`} />
                    </>
                  )}
                </button>
                {isOpen && !collapsed && (
                  <div className="ml-6 mt-0.5 space-y-0.5">
                    {item.children.map(child => (
                      <NavLink
                        key={child.path}
                        to={child.path}
                        className={({ isActive }) =>
                          `block px-2.5 py-1.5 rounded text-xs transition-colors ${isActive ? "bg-accent text-accent-foreground font-medium" : "text-muted-foreground hover:bg-secondary"}`
                        }
                      >
                        {child.label}
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            );
          }

          return (
            <NavLink
              key={item.path}
              to={item.path!}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-2.5 py-2 rounded text-xs transition-colors ${isActive ? "bg-accent text-accent-foreground font-medium border-l-2 border-primary" : "text-sidebar-foreground hover:bg-secondary"}`
              }
            >
              <Icon size={15} />
              {!collapsed && <span>{item.label}</span>}
            </NavLink>
          );
        })}
      </nav>

      {/* Collapse */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center justify-center h-10 border-t border-border text-muted-foreground hover:text-primary transition-colors"
      >
        {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
      </button>
    </aside>
  );
};

export default AppSidebar;
