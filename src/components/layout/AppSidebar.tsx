import { useState, useMemo } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { usePermissions } from "@/hooks/usePermissions";
import type { PermissionModule } from "@/hooks/usePermissions";
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
  module?: PermissionModule;
  children?: { label: string; path: string; module?: PermissionModule }[];
}

const navItems: NavItem[] = [
  { label: "Dashboard", icon: LayoutDashboard, path: "/", module: "dashboard" },
  { label: "CRM", icon: Users, path: "/crm", module: "crm" },
  { label: "Orçamentos", icon: FileText, path: "/orcamentos", module: "crm" },
  { label: "Projetos", icon: FolderKanban, path: "/projetos", module: "projetos" },
  { label: "Cronograma", icon: Wrench, path: "/cronograma", module: "cronograma" },
  {
    label: "Financeiro", icon: DollarSign, module: "financeiro", children: [
      { label: "Contas a Receber", path: "/financeiro/receber", module: "financeiro" },
      { label: "Contas a Pagar", path: "/financeiro/pagar", module: "financeiro" },
      { label: "Fluxo de Caixa", path: "/financeiro/fluxo", module: "financeiro" },
      { label: "Finanças Pessoais", path: "/financas-pessoais", module: "financas_pessoais" },
      { label: "Comissões (RT)", path: "/comissoes", module: "comissoes" },
      { label: "Compras", path: "/compras", module: "compras" },
      { label: "Itens a Comprar", path: "/itens-comprar", module: "compras" },
    ]
  },
  { label: "Fornecedores/Parceiros", icon: Truck, path: "/fornecedores", module: "fornecedores" },
  { label: "Estoque", icon: Package, path: "/estoque", module: "estoque" },
  { label: "Kits", icon: Boxes, path: "/kits", module: "kits" },
  { label: "DRE", icon: TrendingUp, path: "/dre", module: "dre" },
  { label: "Relatórios", icon: BarChart3, path: "/relatorios", module: "relatorios" },
  { label: "Automações", icon: Bell, path: "/automacoes", module: "automacoes" },
  { label: "Contratos", icon: PenTool, path: "/contratos", module: "contratos" },
  { label: "Nota Fiscal", icon: Receipt, path: "/notas-fiscais", module: "notas_fiscais" },
  { label: "Integrações", icon: Building2, path: "/integracoes", module: "integracoes" },
  { label: "Auditoria", icon: Shield, path: "/auditoria", module: "auditoria" },
  { label: "Configurações", icon: Settings, path: "/configuracoes", module: "configuracoes" },
];

interface AppSidebarProps {
  mobileOpen?: boolean;
  onClose?: () => void;
}

const AppSidebar = ({ mobileOpen, onClose }: AppSidebarProps) => {
  const [collapsed, setCollapsed] = useState(false);
  const [openMenus, setOpenMenus] = useState<string[]>([]);
  const location = useLocation();
  const { canView } = usePermissions();

  const filteredNavItems = useMemo(() => {
    return navItems.filter(item => {
      if (item.module && !canView(item.module)) return false;
      return true;
    }).map(item => {
      if (item.children) {
        const filteredChildren = item.children.filter(child =>
          !child.module || canView(child.module)
        );
        if (filteredChildren.length === 0) return null;
        return { ...item, children: filteredChildren };
      }
      return item;
    }).filter(Boolean) as NavItem[];
  }, [canView]);

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
