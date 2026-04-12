import { useState } from "react";
import { useUserPermissions, MODULES, MODULE_LABELS } from "@/hooks/useUserPermissions";
import type { PermissionModule } from "@/hooks/usePermissions";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Shield } from "lucide-react";

interface Props {
  userId: string;
  userName: string;
  isAdmin: boolean;
}

const ACTIONS = [
  { key: "can_view" as const, label: "Visualizar" },
  { key: "can_create" as const, label: "Criar" },
  { key: "can_edit" as const, label: "Editar" },
  { key: "can_delete" as const, label: "Excluir" },
];

const UserPermissionsEditor = ({ userId, userName, isAdmin }: Props) => {
  const { permissions, isLoading, upsertPermission } = useUserPermissions(userId);
  const [saving, setSaving] = useState<string | null>(null);

  if (isAdmin) {
    return (
      <div className="p-3 bg-primary/5 border border-primary/20 rounded text-xs text-primary flex items-center gap-2">
        <Shield size={14} />
        Administradores possuem acesso total ao sistema.
      </div>
    );
  }

  if (isLoading) return <div className="text-xs text-muted-foreground">Carregando permissões...</div>;

  const getPermValue = (module: PermissionModule, field: "can_view" | "can_create" | "can_edit" | "can_delete") => {
    const perm = permissions?.find(p => p.module === module);
    if (!perm) return false;
    return perm[field];
  };

  const hasCustomPerm = (module: PermissionModule) => {
    return permissions?.some(p => p.module === module);
  };

  const handleToggle = async (module: PermissionModule, field: "can_view" | "can_create" | "can_edit" | "can_delete", value: boolean) => {
    const existing = permissions?.find(p => p.module === module);
    const key = `${module}-${field}`;
    setSaving(key);
    try {
      await upsertPermission.mutateAsync({
        user_id: userId,
        module,
        can_view: field === "can_view" ? value : (existing?.can_view ?? false),
        can_create: field === "can_create" ? value : (existing?.can_create ?? false),
        can_edit: field === "can_edit" ? value : (existing?.can_edit ?? false),
        can_delete: field === "can_delete" ? value : (existing?.can_delete ?? false),
      });
    } catch (err: any) {
      toast.error(err.message);
    }
    setSaving(null);
  };

  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
        <Shield size={13} className="text-primary" />
        Permissões de {userName}
      </h3>
      <p className="text-[10px] text-muted-foreground">
        Marque os checkboxes para personalizar. Módulos sem marcação seguem as permissões da role.
      </p>
      <div className="border border-border rounded overflow-auto max-h-[400px]">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-secondary/80 z-10">
            <tr>
              <th className="text-left px-2.5 py-2 font-semibold border-b border-border min-w-[140px]">Módulo</th>
              {ACTIONS.map(a => (
                <th key={a.key} className="text-center px-2 py-2 font-semibold border-b border-border w-20">{a.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {MODULES.map(mod => (
              <tr key={mod} className={`border-b border-border last:border-b-0 hover:bg-secondary/30 ${hasCustomPerm(mod) ? "bg-primary/5" : ""}`}>
                <td className="px-2.5 py-1.5 font-medium">{MODULE_LABELS[mod]}</td>
                {ACTIONS.map(a => (
                  <td key={a.key} className="px-2 py-1.5 text-center">
                    <Checkbox
                      checked={getPermValue(mod, a.key)}
                      onCheckedChange={(checked) => handleToggle(mod, a.key, !!checked)}
                      disabled={saving === `${mod}-${a.key}`}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default UserPermissionsEditor;
