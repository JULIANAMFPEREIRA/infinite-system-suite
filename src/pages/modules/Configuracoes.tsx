import { useState } from "react";
import { Settings, Plus, Trash2, UserPlus, Users } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useEmpresa } from "@/hooks/useEmpresa";
import { useCategorias, useCreateCategoria, useDeleteCategoria, useFormasPagamento, useCreateFormaPagamento, useDeleteFormaPagamento } from "@/hooks/useCategorias";
import { toast } from "sonner";

const Configuracoes = () => {
  const { user, profile, roles } = useAuth();
  const empresaId = useEmpresa();

  const { data: empresa } = useQuery({
    queryKey: ["empresa_config", empresaId],
    queryFn: async () => {
      const { data, error } = await supabase.from("empresas").select("*").eq("id", empresaId!).single();
      if (error) throw error;
      return data;
    },
    enabled: !!empresaId,
  });

  const { data: users, refetch: refetchUsers } = useQuery({
    queryKey: ["profiles_config", empresaId],
    queryFn: async () => {
      const { data: profiles } = await supabase.from("profiles").select("id, full_name, empresa_id").eq("empresa_id", empresaId!);
      const { data: allRoles } = await supabase.from("user_roles").select("user_id, role").eq("empresa_id", empresaId!);
      return (profiles ?? []).map(p => ({
        ...p,
        roles: (allRoles ?? []).filter(r => r.user_id === p.id).map(r => r.role),
      }));
    },
    enabled: !!empresaId,
  });

  // Categorias
  const { data: categorias } = useCategorias();
  const createCat = useCreateCategoria();
  const deleteCat = useDeleteCategoria();
  const [novaCat, setNovaCat] = useState("");
  const [tipoCat, setTipoCat] = useState("produto");

  // Formas de pagamento
  const { data: formas } = useFormasPagamento();
  const createForma = useCreateFormaPagamento();
  const deleteForma = useDeleteFormaPagamento();
  const [novaForma, setNovaForma] = useState("");

  // Create user
  const [showNewUser, setShowNewUser] = useState(false);
  const [nuNome, setNuNome] = useState("");
  const [nuEmail, setNuEmail] = useState("");
  const [nuSenha, setNuSenha] = useState("");
  const [nuRole, setNuRole] = useState("administrativo");
  const [nuLoading, setNuLoading] = useState(false);

  const handleCreateUser = async () => {
    if (!nuNome.trim() || !nuEmail.trim() || !nuSenha.trim()) { toast.error("Preencha todos os campos"); return; }
    setNuLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const res = await supabase.functions.invoke("create-user", {
        body: { email: nuEmail, password: nuSenha, full_name: nuNome, role: nuRole },
      });
      if (res.error) throw new Error(res.error.message || "Erro ao criar usuário");
      if (res.data?.error) throw new Error(res.data.error);
      toast.success("Usuário criado com sucesso!");
      setNuNome(""); setNuEmail(""); setNuSenha(""); setNuRole("administrativo"); setShowNewUser(false);
      refetchUsers();
    } catch (err: any) { toast.error(err.message); }
    setNuLoading(false);
  };

  const handleRemoveRole = async (userId: string, role: string) => {
    if (!window.confirm(`Remover role "${role}" deste usuário?`)) return;
    const { error } = await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", role as any);
    if (error) toast.error(error.message);
    else { toast.success("Role removida"); refetchUsers(); }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-2">
        <Settings size={18} className="text-primary" />
        <h1 className="text-lg font-bold text-foreground">Configurações</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-lg p-4 space-y-3">
          <h2 className="text-sm font-semibold text-foreground">Empresa</h2>
          <div className="space-y-2 text-xs">
            <div><span className="text-muted-foreground">Nome:</span> <span className="text-foreground font-medium">{empresa?.nome ?? "—"}</span></div>
            <div><span className="text-muted-foreground">Fantasia:</span> <span className="text-foreground">{empresa?.nome_fantasia ?? "—"}</span></div>
            <div><span className="text-muted-foreground">CNPJ:</span> <span className="text-foreground">{empresa?.cnpj ?? "—"}</span></div>
            <div><span className="text-muted-foreground">Segmento:</span> <span className="text-foreground">{empresa?.segmento ?? "—"}</span></div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg p-4 space-y-3">
          <h2 className="text-sm font-semibold text-foreground">Meu Perfil</h2>
          <div className="space-y-2 text-xs">
            <div><span className="text-muted-foreground">Nome:</span> <span className="text-foreground font-medium">{profile?.full_name ?? "—"}</span></div>
            <div><span className="text-muted-foreground">E-mail:</span> <span className="text-foreground">{user?.email ?? "—"}</span></div>
            <div><span className="text-muted-foreground">Roles:</span> <span className="text-foreground">{roles.join(", ") || "—"}</span></div>
          </div>
        </div>
      </div>

      {/* Categorias */}
      <div className="bg-card border border-border rounded-lg p-4 space-y-3">
        <h2 className="text-sm font-semibold text-foreground">Categorias</h2>
        <div className="flex gap-2 items-end">
          <div className="space-y-1 flex-1"><label className="text-[11px] text-muted-foreground">Nome</label><input value={novaCat} onChange={e => setNovaCat(e.target.value)} className="w-full h-8 px-2 text-xs bg-background border border-border rounded focus:outline-none" /></div>
          <div className="space-y-1 w-28"><label className="text-[11px] text-muted-foreground">Tipo</label>
            <select value={tipoCat} onChange={e => setTipoCat(e.target.value)} className="w-full h-8 px-2 text-xs bg-background border border-border rounded">
              <option value="produto">Produto</option><option value="servico">Serviço</option>
            </select>
          </div>
          <button onClick={async () => { if (!novaCat.trim()) return; await createCat.mutateAsync({ nome: novaCat, tipo: tipoCat }); setNovaCat(""); toast.success("Categoria criada"); }} className="h-8 px-3 rounded bg-primary text-primary-foreground text-xs"><Plus size={14} /></button>
        </div>
        {categorias && categorias.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {categorias.map(c => (
              <span key={c.id} className="inline-flex items-center gap-1 px-2 py-1 rounded bg-secondary text-secondary-foreground text-[11px]">
                {c.nome} <span className="text-muted-foreground">({c.tipo})</span>
                <button onClick={() => { deleteCat.mutate(c.id); toast.success("Removida"); }} className="hover:text-destructive"><Trash2 size={10} /></button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Formas de Pagamento */}
      <div className="bg-card border border-border rounded-lg p-4 space-y-3">
        <h2 className="text-sm font-semibold text-foreground">Formas de Pagamento</h2>
        <div className="flex gap-2 items-end">
          <div className="space-y-1 flex-1"><label className="text-[11px] text-muted-foreground">Nome</label><input value={novaForma} onChange={e => setNovaForma(e.target.value)} className="w-full h-8 px-2 text-xs bg-background border border-border rounded focus:outline-none" /></div>
          <button onClick={async () => { if (!novaForma.trim()) return; await createForma.mutateAsync({ nome: novaForma }); setNovaForma(""); toast.success("Forma criada"); }} className="h-8 px-3 rounded bg-primary text-primary-foreground text-xs"><Plus size={14} /></button>
        </div>
        {formas && formas.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {formas.map(f => (
              <span key={f.id} className="inline-flex items-center gap-1 px-2 py-1 rounded bg-secondary text-secondary-foreground text-[11px]">
                {f.nome}
                <button onClick={() => { deleteForma.mutate(f.id); toast.success("Removida"); }} className="hover:text-destructive"><Trash2 size={10} /></button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Gestão de Usuários */}
      <div className="bg-card border border-border rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Usuários da Empresa</h2>
          <button onClick={() => setShowNewUser(!showNewUser)} className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-primary text-primary-foreground text-xs font-medium hover:brightness-105">
            <UserPlus size={14} /> Criar Usuário
          </button>
        </div>

        {showNewUser && (
          <div className="border border-border rounded p-3 space-y-3 bg-background">
            <h3 className="text-xs font-semibold text-foreground">Novo Usuário</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="space-y-1"><label className="text-[11px] text-muted-foreground">Nome</label><input value={nuNome} onChange={e => setNuNome(e.target.value)} className="w-full h-8 px-2 text-xs bg-background border border-border rounded" /></div>
              <div className="space-y-1"><label className="text-[11px] text-muted-foreground">E-mail</label><input value={nuEmail} onChange={e => setNuEmail(e.target.value)} className="w-full h-8 px-2 text-xs bg-background border border-border rounded" /></div>
              <div className="space-y-1"><label className="text-[11px] text-muted-foreground">Senha</label><input type="password" value={nuSenha} onChange={e => setNuSenha(e.target.value)} className="w-full h-8 px-2 text-xs bg-background border border-border rounded" /></div>
              <div className="space-y-1"><label className="text-[11px] text-muted-foreground">Role</label>
                <select value={nuRole} onChange={e => setNuRole(e.target.value)} className="w-full h-8 px-2 text-xs bg-background border border-border rounded">
                  <option value="admin">Admin</option><option value="administrativo">Administrativo</option><option value="financeiro">Financeiro</option>
                  <option value="tecnico">Técnico</option><option value="arquiteto">Arquiteto</option><option value="cliente">Cliente</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={handleCreateUser} disabled={nuLoading} className="px-4 py-1.5 rounded bg-primary text-primary-foreground text-xs font-medium disabled:opacity-50">{nuLoading ? "Criando..." : "Criar"}</button>
              <button onClick={() => setShowNewUser(false)} className="px-4 py-1.5 rounded bg-secondary text-secondary-foreground text-xs">Cancelar</button>
            </div>
          </div>
        )}

        {users && users.length > 0 ? (
          <div className="border border-border rounded overflow-hidden">
            <table className="w-full text-xs">
              <thead><tr className="bg-secondary/60">
                <th className="text-left px-2.5 py-2 font-semibold border-b border-border">Nome</th>
                <th className="text-left px-2.5 py-2 font-semibold border-b border-border">Roles</th>
                <th className="text-center px-2.5 py-2 font-semibold border-b border-border">Ações</th>
              </tr></thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id} className="border-b border-border last:border-b-0 hover:bg-secondary/30">
                    <td className="px-2.5 py-1.5 font-medium">{u.full_name ?? "—"}</td>
                    <td className="px-2.5 py-1.5">
                      <div className="flex flex-wrap gap-1">
                        {u.roles.map(r => (
                          <span key={r} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-primary/15 text-primary text-[10px] font-medium">
                            {r}
                            <button onClick={() => handleRemoveRole(u.id, r)} className="hover:text-destructive"><Trash2 size={9} /></button>
                          </span>
                        ))}
                        {u.roles.length === 0 && <span className="text-muted-foreground">—</span>}
                      </div>
                    </td>
                    <td className="px-2.5 py-1.5 text-center text-muted-foreground font-mono text-[10px]">{u.id.slice(0, 8)}...</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Nenhum usuário encontrado.</p>
        )}
      </div>
    </div>
  );
};

export default Configuracoes;
