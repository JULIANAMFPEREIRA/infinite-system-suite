import { useAuth } from "@/contexts/AuthContext";

type PermissionModule =
  | "dashboard"
  | "crm"
  | "projetos"
  | "kits"
  | "cronograma"
  | "estoque"
  | "compras"
  | "fornecedores"
  | "financeiro"
  | "comissoes"
  | "dre"
  | "relatorios"
  | "automacoes"
  | "contratos"
  | "notas_fiscais"
  | "integracoes"
  | "auditoria"
  | "configuracoes"
  | "financas_pessoais";

type PermissionAction = "view" | "create" | "edit" | "delete";

// Define which roles can access which modules and actions
const rolePermissions: Record<string, Record<PermissionModule, PermissionAction[]>> = {
  admin: {
    dashboard: ["view", "create", "edit", "delete"],
    crm: ["view", "create", "edit", "delete"],
    projetos: ["view", "create", "edit", "delete"],
    kits: ["view", "create", "edit", "delete"],
    cronograma: ["view", "create", "edit", "delete"],
    estoque: ["view", "create", "edit", "delete"],
    compras: ["view", "create", "edit", "delete"],
    fornecedores: ["view", "create", "edit", "delete"],
    financeiro: ["view", "create", "edit", "delete"],
    comissoes: ["view", "create", "edit", "delete"],
    dre: ["view", "create", "edit", "delete"],
    relatorios: ["view", "create", "edit", "delete"],
    automacoes: ["view", "create", "edit", "delete"],
    contratos: ["view", "create", "edit", "delete"],
    notas_fiscais: ["view", "create", "edit", "delete"],
    integracoes: ["view", "create", "edit", "delete"],
    auditoria: ["view", "create", "edit", "delete"],
    configuracoes: ["view", "create", "edit", "delete"],
    financas_pessoais: ["view", "create", "edit", "delete"],
  },
  financeiro: {
    dashboard: ["view"],
    crm: ["view"],
    projetos: ["view"],
    kits: [],
    cronograma: ["view"],
    estoque: ["view"],
    compras: ["view"],
    fornecedores: ["view"],
    financeiro: ["view", "create", "edit"],
    comissoes: ["view", "create", "edit"],
    dre: ["view"],
    relatorios: ["view"],
    automacoes: [],
    contratos: ["view"],
    notas_fiscais: ["view", "create", "edit"],
    integracoes: [],
    auditoria: [],
    configuracoes: [],
    financas_pessoais: ["view", "create", "edit", "delete"],
  },
  operacional: {
    dashboard: ["view"],
    crm: ["view"],
    projetos: ["view", "create", "edit"],
    kits: ["view", "create", "edit"],
    cronograma: ["view", "create", "edit"],
    estoque: ["view", "create", "edit"],
    compras: ["view", "create"],
    fornecedores: ["view"],
    financeiro: [],
    comissoes: [],
    dre: [],
    relatorios: ["view"],
    automacoes: [],
    contratos: ["view"],
    notas_fiscais: [],
    integracoes: [],
    auditoria: [],
    configuracoes: [],
    financas_pessoais: ["view", "create", "edit", "delete"],
  },
  // Legacy roles mapped for backward compatibility
  administrativo: {
    dashboard: ["view"],
    crm: ["view", "create", "edit"],
    projetos: ["view", "create", "edit"],
    kits: ["view", "create", "edit"],
    cronograma: ["view", "create", "edit"],
    estoque: ["view", "create", "edit"],
    compras: ["view", "create", "edit"],
    fornecedores: ["view", "create", "edit"],
    financeiro: ["view"],
    comissoes: ["view"],
    dre: ["view"],
    relatorios: ["view"],
    automacoes: [],
    contratos: ["view", "create", "edit"],
    notas_fiscais: ["view"],
    integracoes: [],
    auditoria: [],
    configuracoes: [],
    financas_pessoais: ["view", "create", "edit", "delete"],
  },
  tecnico: {
    dashboard: ["view"],
    crm: [],
    projetos: ["view"],
    kits: ["view"],
    cronograma: ["view"],
    estoque: ["view"],
    compras: [],
    fornecedores: [],
    financeiro: [],
    comissoes: [],
    dre: [],
    relatorios: [],
    automacoes: [],
    contratos: [],
    notas_fiscais: [],
    integracoes: [],
    auditoria: [],
    configuracoes: [],
    financas_pessoais: ["view", "create", "edit", "delete"],
  },
};

export const usePermissions = () => {
  const { roles } = useAuth();

  const hasPermission = (module: PermissionModule, action: PermissionAction): boolean => {
    return roles.some((role) => {
      const perms = rolePermissions[role];
      return perms?.[module]?.includes(action) ?? false;
    });
  };

  const canView = (module: PermissionModule) => hasPermission(module, "view");
  const canCreate = (module: PermissionModule) => hasPermission(module, "create");
  const canEdit = (module: PermissionModule) => hasPermission(module, "edit");
  const canDelete = (module: PermissionModule) => hasPermission(module, "delete");

  const isAdmin = roles.includes("admin");

  return { hasPermission, canView, canCreate, canEdit, canDelete, isAdmin };
};
