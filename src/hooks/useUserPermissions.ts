import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/hooks/useEmpresa";
import type { PermissionModule } from "@/hooks/usePermissions";

export interface UserPermission {
  id: string;
  user_id: string;
  module: PermissionModule;
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
}

const MODULES: PermissionModule[] = [
  "dashboard", "crm", "projetos", "kits", "cronograma", "estoque",
  "compras", "fornecedores", "financeiro", "comissoes", "dre",
  "relatorios", "automacoes", "contratos", "notas_fiscais",
  "integracoes", "auditoria", "configuracoes", "financas_pessoais",
];

const MODULE_LABELS: Record<PermissionModule, string> = {
  dashboard: "Dashboard",
  crm: "CRM",
  projetos: "Projetos",
  kits: "Kits",
  cronograma: "Cronograma",
  estoque: "Estoque",
  compras: "Compras",
  fornecedores: "Fornecedores",
  financeiro: "Financeiro",
  comissoes: "Comissões",
  dre: "DRE",
  relatorios: "Relatórios",
  automacoes: "Automações",
  contratos: "Contratos",
  notas_fiscais: "Notas Fiscais",
  integracoes: "Integrações",
  auditoria: "Auditoria",
  configuracoes: "Configurações",
  financas_pessoais: "Finanças Pessoais",
};

export { MODULES, MODULE_LABELS };

export const useUserPermissions = (userId?: string) => {
  const empresaId = useEmpresa();
  const qc = useQueryClient();

  const { data: permissions, isLoading } = useQuery({
    queryKey: ["user_permissions", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_permissions")
        .select("*")
        .eq("user_id", userId!);
      if (error) throw error;
      return data as UserPermission[];
    },
    enabled: !!userId,
  });

  const upsertPermission = useMutation({
    mutationFn: async (perm: {
      user_id: string;
      module: string;
      can_view: boolean;
      can_create: boolean;
      can_edit: boolean;
      can_delete: boolean;
    }) => {
      const { error } = await supabase
        .from("user_permissions")
        .upsert(
          {
            user_id: perm.user_id,
            empresa_id: empresaId!,
            module: perm.module,
            can_view: perm.can_view,
            can_create: perm.can_create,
            can_edit: perm.can_edit,
            can_delete: perm.can_delete,
          } as any,
          { onConflict: "user_id,module" }
        );
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["user_permissions", userId] });
    },
  });

  return { permissions, isLoading, upsertPermission, MODULES, MODULE_LABELS };
};

export const useMyPermissions = () => {
  const { data, isLoading } = useQuery({
    queryKey: ["my_permissions"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data: perms, error } = await supabase
        .from("user_permissions")
        .select("*")
        .eq("user_id", user.id);
      if (error) throw error;
      return perms as UserPermission[];
    },
  });
  return { myPermissions: data ?? [], isLoading };
};
