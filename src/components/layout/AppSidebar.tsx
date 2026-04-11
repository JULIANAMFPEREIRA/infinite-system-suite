import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Users, FolderKanban, Package,
  DollarSign, BarChart3, Bell, PenTool,
  Receipt, Building2, Boxes, TrendingUp, Shield, Settings,
  ChevronLeft, ChevronRight, ChevronDown, Wrench, Truck, X, FileText
} from "lucide-react";

interface NavItem {
  label: string;
  icon: React.ElementType;
  path?: string;
  children?: { label: string; path: string }[];
}

const navItems: NavItem[] = [
  { label: "Dashboard", icon: LayoutDashboard, path: "/" },
  { label: "CRM", icon: Users, path: "/crm" },
  { label: "Orçamentos", icon: FileText, path: "/orcamentos" },
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

interface AppSidebarProps {
  mobileOpen?: boolean;
  onClose?: () => void;
}

const AppSidebar = ({ mobileOpen, onClose }: AppSidebarProps) => {
  const [collapsed, setCollapsed] = useState(false);
  const [openMenus, setOpenMenus] = useState<string[]>([]);
  const location = useLocation();

  const toggleMenu = (label: string) => {
    setOpenMenus(prev =>
      prev.includes(label) ? prev.filter(m => m !== label) : [...prev, label]
    );
  };

  const handleNavClick = () => {
    if (onClose) onClose();
  };

  // Shared nav item classes
  const navItemBase = "flex items-center gap-3 px-3 rounded-lg text-[13px] transition-all duration-200";
  const navItemMobile = "md:gap-2.5 md:px-2.5 md:text-xs md:py-2 py-3";
  const navItemActive = "bg-primary/15 text-primary font-semibold shadow-[inset_0_0_12px_hsl(200,80%,55%,0.08)] border-l-2 border-primary";
  const navItemInactive = "text-sidebar-foreground hover:bg-secondary/80 hover:text-foreground";

  return (
    <aside
      className={[
        "fixed left-0 top-0 h-screen z-50 flex flex-col transition-all duration-300",
        // Desktop: solid card bg
        "md:bg-card md:border-r md:border-border",
        // Mobile: glassmorphism
        "bg-card/85 backdrop-blur-xl md:backdrop-blur-none",
        "border-r border-white/[0.08] md:border-border",
        "shadow-[4px_0_24px_rgba(0,0,0,0.4)] md:shadow-none",
        collapsed ? "w-14" : "w-64 md:w-56",
        mobileOpen ? "translate-x-0" : "-translate-x-full",
        "md:translate-x-0",
      ].join(" ")}
    >
      {/* Mobile header with close */}
      <div className="flex items-center justify-between border-b border-white/[0.06] md:border-border px-4 py-3.5 md:hidden">
        <span className="text-xs font-semibold text-foreground/70 uppercase" style={{ letterSpacing: "0.12em" }}>
          Menu
        </span>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors"
        >
          <X size={18} />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 md:py-2 px-2.5 md:px-1.5 space-y-1 md:space-y-0.5">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isOpen = openMenus.includes(item.label);
          const isActive = item.path ? location.pathname === item.path : item.children?.some(c => location.pathname === c.path);

          if (item.children) {
            return (
              <div key={item.label}>
                <button
                  onClick={() => toggleMenu(item.label)}
                  className={[
                    "w-full",
                    navItemBase,
                    navItemMobile,
                    isActive ? navItemActive : navItemInactive,
                  ].join(" ")}
                >
                  <Icon size={16} className="shrink-0" />
                  {!collapsed && (
                    <>
                      <span className="flex-1 text-left">{item.label}</span>
                      <ChevronDown size={12} className={`transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
                    </>
                  )}
                </button>
                {isOpen && !collapsed && (
                  <div className="ml-7 mt-1 space-y-0.5 border-l border-white/[0.06] md:border-border pl-3 md:ml-6 md:pl-2.5">
                    {item.children.map(child => (
                      <NavLink
                        key={child.path}
                        to={child.path}
                        onClick={handleNavClick}
                        className={({ isActive }) =>
                          `block px-2.5 py-2.5 md:py-1.5 rounded-lg md:rounded text-[13px] md:text-xs transition-all duration-200 ${
                            isActive
                              ? "bg-primary/10 text-primary font-medium"
                              : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
                          }`
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
              onClick={handleNavClick}
              className={({ isActive }) =>
                [
                  navItemBase,
                  navItemMobile,
                  isActive ? navItemActive : navItemInactive,
                ].join(" ")
              }
            >
              <Icon size={16} className="shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </NavLink>
          );
        })}
      </nav>

      {/* Collapse - only on desktop */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="hidden md:flex items-center justify-center h-10 border-t border-border text-muted-foreground hover:text-primary transition-colors"
      >
        {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
      </button>
    </aside>
  );
};

export default AppSidebar;
