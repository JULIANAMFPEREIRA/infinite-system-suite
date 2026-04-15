import { useState } from "react";
import {
  Settings, Plus, Trash2, UserPlus, Users, Truck, Pencil,
  CreditCard, Tag, ListChecks, Building2, UserCog, Wallet, FolderKanban, PackageCheck,
  ChevronDown, ChevronRight, Shield,
} from "lucide-react";
import UserPermissionsEditor from "@/components/settings/UserPermissionsEditor";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useEmpresa } from "@/hooks/useEmpresa";
import { useCategorias, useCreateCategoria, useUpdateCategoria, useDeleteCategoria, useFormasPagamento, useCreateFormaPagamento, useUpdateFormaPagamento, useDeleteFormaPagamento } from "@/hooks/useCategorias";
import { useTransportadoras, useCreateTransportadora, useDeleteTransportadora } from "@/hooks/useTransportadoras";
import { statusProjetoLabels, statusProjetoColors } from "@/lib/statusConfig";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Section =
  | "empresa"
  | "usuarios"
  | "funcionarios"
  | "formas_pagamento"
  | "tipos_financeiros"
  | "categorias"
  | "status_projeto"
  | "transportadoras";

const menuGroups = [
  {
    label: "Geral",
    items: [
      { key: "empresa" as Section, label: "Empresa / Perfil", icon: Building2 },
    ],
  },
  {
    label: "Usuários",
    items: [
      { key: "usuarios" as Section, label: "Usuários", icon: UserCog },
      { key: "funcionarios" as Section, label: "Funcionários", icon: Users },
    ],
  },
  {
    label: "Financeiro",
    items: [
      { key: "formas_pagamento" as Section, label: "Formas de Pagamento", icon: CreditCard },
      { key: "tipos_financeiros" as Section, label: "Tipos Financeiros", icon: Wallet },
      { key: "categorias" as Section, label: "Categorias", icon: Tag },
    ],
  },
  {
    label: "Projetos",
    items: [
      { key: "status_projeto" as Section, label: "Status do Projeto", icon: ListChecks },
    ],
  },
  {
    label: "Logística",
    items: [
      { key: "transportadoras" as Section, label: "Transportadoras", icon: Truck },
    ],
  },
];

const Configuracoes = () => {
  const [activeSection, setActiveSection] = useState<Section>("empresa");
  const qc = useQueryClient();
  const { user, profile, roles } = useAuth();
  const empresaId = useEmpresa();

  // --- Data hooks ---
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
  const updateCat = useUpdateCategoria();
  const deleteCat = useDeleteCategoria();
  const [novaCat, setNovaCat] = useState("");
  const [tipoCat, setTipoCat] = useState("entrada");
  const [editCat, setEditCat] = useState<{ id: string; nome: string; tipo: string } | null>(null);

  // Tipos Financeiros - derived from categorias + defaults
  const [novoTipo, setNovoTipo] = useState("");
  const [editTipo, setEditTipo] = useState<{ original: string; novo: string } | null>(null);

  const defaultTipos = [
    { value: "entrada", label: "Entrada" },
    { value: "saida_operacional", label: "Saída Operacional" },
    { value: "saida_financeira", label: "Saída Financeira" },
    { value: "saida_especial", label: "Saída Especial" },
    { value: "produto", label: "Produto" },
    { value: "servico", label: "Serviço" },
  ];

  const tiposFromCategorias = new Set((categorias ?? []).map(c => c.tipo).filter(Boolean));
  const allTiposSet = new Set([...defaultTipos.map(t => t.value), ...tiposFromCategorias]);
  const allTipos = Array.from(allTiposSet).sort().map(t => {
    const def = defaultTipos.find(d => d.value === t);
    return { value: t, label: def?.label ?? t };
  });

  const tipoLabel = (t: string) => {
    const def = defaultTipos.find(d => d.value === t);
    return def?.label ?? t;
  };

  const categoriasCount = (tipo: string) => (categorias ?? []).filter(c => c.tipo === tipo).length;

  // Formas de pagamento
  const { data: formas } = useFormasPagamento();
  const createForma = useCreateFormaPagamento();
  const updateForma = useUpdateFormaPagamento();
  const deleteForma = useDeleteFormaPagamento();
  const [novaForma, setNovaForma] = useState("");
  const [editForma, setEditForma] = useState<{ id: string; nome: string } | null>(null);

  // Transportadoras
  const { data: transportadoras } = useTransportadoras();
  const createTransp = useCreateTransportadora();
  const deleteTransp = useDeleteTransportadora();
  const [novaTranspNome, setNovaTranspNome] = useState("");
  const [novaTranspTipo, setNovaTranspTipo] = useState("transportadora");
  const [editTransp, setEditTransp] = useState<{ id: string; nome: string; tipo: string } | null>(null);

  const updateTransportadora = useMutation({
    mutationFn: async (t: { id: string; nome: string; tipo: string }) => {
      const { error } = await supabase.from("transportadoras").update({ nome: t.nome, tipo: t.tipo } as any).eq("id", t.id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["transportadoras"] }); setEditTransp(null); toast.success("Transportadora atualizada"); },
    onError: (err: any) => toast.error(err.message),
  });

  // Equipe / Funcionários
  const { data: equipe, refetch: refetchEquipe } = useQuery({
    queryKey: ["equipe", empresaId],
    queryFn: async () => {
      const { data, error } = await supabase.from("equipe").select("*").eq("empresa_id", empresaId!).eq("deletado", false).order("nome");
      if (error) throw error;
      return data;
    },
    enabled: !!empresaId,
  });
  const [eqNome, setEqNome] = useState("");
  const [eqFuncao, setEqFuncao] = useState("");
  const [eqContato, setEqContato] = useState("");
  const [editEquipe, setEditEquipe] = useState<{ id: string; nome: string; funcao: string; contato: string } | null>(null);

  const addEquipeMember = useMutation({
    mutationFn: async () => {
      if (!eqNome.trim() || !empresaId) return;
      const { error } = await supabase.from("equipe").insert({ empresa_id: empresaId, nome: eqNome, funcao: eqFuncao || null, contato: eqContato || null } as any);
      if (error) throw error;
    },
    onSuccess: () => { refetchEquipe(); setEqNome(""); setEqFuncao(""); setEqContato(""); toast.success("Membro adicionado"); },
    onError: (err: any) => toast.error(err.message),
  });

  const updateEquipeMember = useMutation({
    mutationFn: async (m: { id: string; nome: string; funcao: string; contato: string }) => {
      const { error } = await supabase.from("equipe").update({ nome: m.nome, funcao: m.funcao || null, contato: m.contato || null } as any).eq("id", m.id);
      if (error) throw error;
    },
    onSuccess: () => { refetchEquipe(); setEditEquipe(null); toast.success("Membro atualizado"); },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteEquipeMember = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("equipe").update({ deletado: true } as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { refetchEquipe(); toast.success("Membro removido"); },
    onError: (err: any) => toast.error(err.message),
  });

  // Usuários
  const [showNewUser, setShowNewUser] = useState(false);
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [nuNome, setNuNome] = useState("");
  const [nuEmail, setNuEmail] = useState("");
  const [nuSenha, setNuSenha] = useState("");
  const [nuRole, setNuRole] = useState("administrativo");
  const [nuLoading, setNuLoading] = useState(false);

  const handleCreateUser = async () => {
    if (!nuNome.trim() || !nuEmail.trim() || !nuSenha.trim()) { toast.error("Preencha todos os campos"); return; }
    setNuLoading(true);
    try {
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

  const tiposTransportadora = [
    { value: "transportadora", label: "Transportadora" },
    { value: "sedex", label: "Sedex" },
    { value: "sedex10", label: "Sedex 10" },
    { value: "pac", label: "PAC" },
    { value: "outro", label: "Outro" },
  ];

  // --- Section renderers ---

  const renderEmpresa = () => (
    <div className="space-y-4">
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
  );

  const renderUsuarios = () => (
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="space-y-1"><label className="text-[11px] text-muted-foreground">Nome</label><input value={nuNome} onChange={e => setNuNome(e.target.value)} className="w-full h-8 px-2 text-xs bg-background border border-border rounded" /></div>
            <div className="space-y-1"><label className="text-[11px] text-muted-foreground">E-mail</label><input value={nuEmail} onChange={e => setNuEmail(e.target.value)} className="w-full h-8 px-2 text-xs bg-background border border-border rounded" /></div>
            <div className="space-y-1"><label className="text-[11px] text-muted-foreground">Senha</label><input type="password" value={nuSenha} onChange={e => setNuSenha(e.target.value)} className="w-full h-8 px-2 text-xs bg-background border border-border rounded" /></div>
            <div className="space-y-1"><label className="text-[11px] text-muted-foreground">Role</label>
              <select value={nuRole} onChange={e => setNuRole(e.target.value)} className="w-full h-8 px-2 text-xs bg-background border border-border rounded">
                <option value="admin">Admin</option><option value="administrativo">Administrativo</option><option value="financeiro">Financeiro</option>
                <option value="tecnico">Técnico</option><option value="arquiteto">Arquiteto</option><option value="cliente">Cliente</option>
                <option value="operacional">Operacional</option><option value="comercial">Comercial</option>
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
              <th className="text-left px-2.5 py-2 font-semibold border-b border-border w-8"></th>
              <th className="text-left px-2.5 py-2 font-semibold border-b border-border">Nome</th>
              <th className="text-left px-2.5 py-2 font-semibold border-b border-border">Roles</th>
              <th className="text-center px-2.5 py-2 font-semibold border-b border-border">Ações</th>
            </tr></thead>
            <tbody>
              {users.map(u => {
                const isUserAdmin = u.roles.includes("admin");
                const isExpanded = expandedUserId === u.id;
                return (
                  <>
                    <tr key={u.id} className="border-b border-border last:border-b-0 hover:bg-secondary/30 cursor-pointer" onClick={() => setExpandedUserId(isExpanded ? null : u.id)}>
                      <td className="px-2 py-1.5 text-muted-foreground">
                        {isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                      </td>
                      <td className="px-2.5 py-1.5 font-medium">{u.full_name ?? "—"}</td>
                      <td className="px-2.5 py-1.5">
                        <div className="flex flex-wrap gap-1">
                          {u.roles.map(r => (
                            <span key={r} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-primary/15 text-primary text-[10px] font-medium">
                              {r}
                              <button onClick={(e) => { e.stopPropagation(); handleRemoveRole(u.id, r); }} className="hover:text-destructive"><Trash2 size={9} /></button>
                            </span>
                          ))}
                          {u.roles.length === 0 && <span className="text-muted-foreground">—</span>}
                        </div>
                      </td>
                      <td className="px-2.5 py-1.5 text-center">
                        <button onClick={(e) => { e.stopPropagation(); setExpandedUserId(isExpanded ? null : u.id); }} className="p-1 rounded hover:bg-primary/10 text-muted-foreground hover:text-primary" title="Gerenciar permissões">
                          <Shield size={13} />
                        </button>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr key={`${u.id}-perms`} className="border-b border-border">
                        <td colSpan={4} className="px-3 py-3 bg-muted/30">
                          <UserPermissionsEditor userId={u.id} userName={u.full_name ?? "Usuário"} isAdmin={isUserAdmin} />
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : <p className="text-xs text-muted-foreground">Nenhum usuário encontrado.</p>}
    </div>
  );

  const renderFuncionarios = () => (
    <div className="bg-card border border-border rounded-lg p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Users size={14} className="text-primary" />
        <h2 className="text-sm font-semibold text-foreground">Equipe / Funcionários</h2>
      </div>
      <div className="flex gap-2 items-end flex-wrap">
        <div className="space-y-1 flex-1 min-w-[150px]"><label className="text-[11px] text-muted-foreground">Nome *</label><input value={eqNome} onChange={e => setEqNome(e.target.value)} className="w-full h-8 px-2 text-xs bg-background border border-border rounded focus:outline-none" /></div>
        <div className="space-y-1 w-36"><label className="text-[11px] text-muted-foreground">Função</label><input value={eqFuncao} onChange={e => setEqFuncao(e.target.value)} className="w-full h-8 px-2 text-xs bg-background border border-border rounded focus:outline-none" /></div>
        <div className="space-y-1 w-36"><label className="text-[11px] text-muted-foreground">Contato</label><input value={eqContato} onChange={e => setEqContato(e.target.value)} className="w-full h-8 px-2 text-xs bg-background border border-border rounded focus:outline-none" /></div>
        <button onClick={() => addEquipeMember.mutate()} disabled={!eqNome.trim()} className="h-8 px-3 rounded bg-primary text-primary-foreground text-xs disabled:opacity-50"><Plus size={14} /></button>
      </div>
      {equipe && equipe.length > 0 ? (
        <div className="border border-border rounded overflow-hidden">
          <table className="w-full text-xs">
            <thead><tr className="bg-secondary/60">
              <th className="text-left px-2.5 py-2 font-semibold border-b border-border">Nome</th>
              <th className="text-left px-2.5 py-2 font-semibold border-b border-border">Função</th>
              <th className="text-left px-2.5 py-2 font-semibold border-b border-border">Contato</th>
              <th className="text-center px-2.5 py-2 font-semibold border-b border-border">Ações</th>
            </tr></thead>
            <tbody>
              {equipe.map((m: any) => (
                <tr key={m.id} className="border-b border-border last:border-b-0 hover:bg-secondary/30">
                  <td className="px-2.5 py-1.5 font-medium">{m.nome}</td>
                  <td className="px-2.5 py-1.5">{m.funcao ?? "—"}</td>
                  <td className="px-2.5 py-1.5">{m.contato ?? "—"}</td>
                  <td className="px-2.5 py-1.5 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => setEditEquipe({ id: m.id, nome: m.nome, funcao: m.funcao ?? "", contato: m.contato ?? "" })} className="p-1 rounded hover:bg-primary/15 text-muted-foreground hover:text-primary" title="Editar"><Pencil size={12} /></button>
                      <button onClick={() => { if (window.confirm("Remover membro?")) deleteEquipeMember.mutate(m.id); }} className="p-1 rounded hover:bg-destructive/15 text-muted-foreground hover:text-destructive" title="Excluir"><Trash2 size={12} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <p className="text-xs text-muted-foreground">Nenhum membro cadastrado.</p>}
    </div>
  );

  const renderFormasPagamento = () => (
    <div className="bg-card border border-border rounded-lg p-4 space-y-3">
      <div className="flex items-center gap-2">
        <CreditCard size={14} className="text-primary" />
        <h2 className="text-sm font-semibold text-foreground">Formas de Pagamento</h2>
      </div>
      <div className="flex gap-2 items-end">
        <div className="space-y-1 flex-1"><label className="text-[11px] text-muted-foreground">Nome</label><input value={novaForma} onChange={e => setNovaForma(e.target.value)} className="w-full h-8 px-2 text-xs bg-background border border-border rounded focus:outline-none" /></div>
        <button onClick={async () => { if (!novaForma.trim()) return; await createForma.mutateAsync({ nome: novaForma }); setNovaForma(""); toast.success("Forma criada"); }} className="h-8 px-3 rounded bg-primary text-primary-foreground text-xs"><Plus size={14} /></button>
      </div>
      {formas && formas.length > 0 ? (
        <div className="border border-border rounded overflow-hidden mt-2">
          <table className="w-full text-xs">
            <thead><tr className="bg-secondary/60">
              <th className="text-left px-2.5 py-2 font-semibold border-b border-border">Nome</th>
              <th className="text-center px-2.5 py-2 font-semibold border-b border-border w-20">Ações</th>
            </tr></thead>
            <tbody>
              {formas.map(f => (
                <tr key={f.id} className="border-b border-border last:border-b-0 hover:bg-secondary/30">
                  <td className="px-2.5 py-1.5 font-medium">{f.nome}</td>
                  <td className="px-2.5 py-1.5 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => setEditForma({ id: f.id, nome: f.nome })} className="p-1 rounded hover:bg-primary/15 text-muted-foreground hover:text-primary" title="Editar"><Pencil size={12} /></button>
                      <button onClick={() => { if (window.confirm("Excluir forma de pagamento?")) { deleteForma.mutate(f.id); toast.success("Removida"); } }} className="p-1 rounded hover:bg-destructive/15 text-muted-foreground hover:text-destructive" title="Excluir"><Trash2 size={12} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <p className="text-xs text-muted-foreground mt-2">Nenhuma forma de pagamento cadastrada.</p>}
    </div>
  );

  const renderCategorias = () => (
    <div className="bg-card border border-border rounded-lg p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Tag size={14} className="text-primary" />
        <h2 className="text-sm font-semibold text-foreground">Categorias</h2>
      </div>
      <div className="flex gap-2 items-end">
        <div className="space-y-1 flex-1"><label className="text-[11px] text-muted-foreground">Nome</label><input value={novaCat} onChange={e => setNovaCat(e.target.value)} className="w-full h-8 px-2 text-xs bg-background border border-border rounded focus:outline-none" /></div>
        <div className="space-y-1 w-40"><label className="text-[11px] text-muted-foreground">Tipo *</label>
          <select value={tipoCat} onChange={e => setTipoCat(e.target.value)} className="w-full h-8 px-2 text-xs bg-background border border-border rounded">
            {allTipos.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <button onClick={async () => { if (!novaCat.trim() || !tipoCat) { toast.error("Nome e Tipo são obrigatórios"); return; } await createCat.mutateAsync({ nome: novaCat, tipo: tipoCat }); setNovaCat(""); toast.success("Categoria criada"); }} className="h-8 px-3 rounded bg-primary text-primary-foreground text-xs"><Plus size={14} /></button>
      </div>
      {categorias && categorias.length > 0 ? (
        <div className="border border-border rounded overflow-hidden mt-2">
          <table className="w-full text-xs">
            <thead><tr className="bg-secondary/60">
              <th className="text-left px-2.5 py-2 font-semibold border-b border-border">Nome</th>
              <th className="text-left px-2.5 py-2 font-semibold border-b border-border w-36">Tipo</th>
              <th className="text-center px-2.5 py-2 font-semibold border-b border-border w-20">Ações</th>
            </tr></thead>
            <tbody>
              {categorias.map(c => (
                <tr key={c.id} className="border-b border-border last:border-b-0 hover:bg-secondary/30">
                  <td className="px-2.5 py-1.5 font-medium">{c.nome}</td>
                  <td className="px-2.5 py-1.5 text-muted-foreground">{tipoLabel(c.tipo ?? "—")}</td>
                  <td className="px-2.5 py-1.5 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => setEditCat({ id: c.id, nome: c.nome, tipo: c.tipo ?? "entrada" })} className="p-1 rounded hover:bg-primary/15 text-muted-foreground hover:text-primary" title="Editar"><Pencil size={12} /></button>
                      <button onClick={() => { if (window.confirm("Excluir categoria?")) { deleteCat.mutate(c.id); toast.success("Removida"); } }} className="p-1 rounded hover:bg-destructive/15 text-muted-foreground hover:text-destructive" title="Excluir"><Trash2 size={12} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <p className="text-xs text-muted-foreground mt-2">Nenhuma categoria cadastrada.</p>}
    </div>
  );

  const renderTiposFinanceiros = () => (
    <div className="bg-card border border-border rounded-lg p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Wallet size={14} className="text-primary" />
        <h2 className="text-sm font-semibold text-foreground">Tipos Financeiros</h2>
      </div>
      <p className="text-[11px] text-muted-foreground">Tipos usados para classificar as categorias financeiras. Cada categoria deve estar vinculada a um tipo.</p>
      <div className="flex gap-2 items-end">
        <div className="space-y-1 flex-1"><label className="text-[11px] text-muted-foreground">Novo Tipo</label><input value={novoTipo} onChange={e => setNovoTipo(e.target.value)} className="w-full h-8 px-2 text-xs bg-background border border-border rounded focus:outline-none" placeholder="Ex: Saída Administrativa" /></div>
        <button onClick={() => {
          const val = novoTipo.trim().toLowerCase().replace(/\s+/g, "_").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
          if (!val) { toast.error("Digite o nome do tipo"); return; }
          if (allTiposSet.has(val)) { toast.error("Tipo já existe"); return; }
          // Create a placeholder category so the type persists
          createCat.mutateAsync({ nome: `CATEGORIA ${novoTipo.trim().toUpperCase()}`, tipo: val });
          setNovoTipo(""); toast.success("Tipo criado com categoria inicial");
        }} className="h-8 px-3 rounded bg-primary text-primary-foreground text-xs"><Plus size={14} /></button>
      </div>
      <div className="border border-border rounded overflow-hidden mt-2">
        <table className="w-full text-xs">
          <thead><tr className="bg-secondary/60">
            <th className="text-left px-2.5 py-2 font-semibold border-b border-border">Tipo</th>
            <th className="text-center px-2.5 py-2 font-semibold border-b border-border w-28">Categorias</th>
            <th className="text-center px-2.5 py-2 font-semibold border-b border-border w-20">Ações</th>
          </tr></thead>
          <tbody>
            {allTipos.map(t => (
              <tr key={t.value} className="border-b border-border last:border-b-0 hover:bg-secondary/30">
                <td className="px-2.5 py-1.5 font-medium">{t.label}</td>
                <td className="px-2.5 py-1.5 text-center text-muted-foreground">{categoriasCount(t.value)}</td>
                <td className="px-2.5 py-1.5 text-center">
                  <button onClick={() => setEditTipo({ original: t.value, novo: t.label })} className="p-1 rounded hover:bg-primary/15 text-muted-foreground hover:text-primary" title="Editar"><Pencil size={12} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderStatusProjeto = () => (
    <div className="bg-card border border-border rounded-lg p-4 space-y-3">
      <div className="flex items-center gap-2">
        <ListChecks size={14} className="text-primary" />
        <h2 className="text-sm font-semibold text-foreground">Status de Projeto</h2>
      </div>
      <p className="text-[11px] text-muted-foreground">Status disponíveis no fluxo operacional do projeto:</p>
      <div className="flex flex-wrap gap-2 mt-1">
        {(Object.entries(statusProjetoLabels) as [string, string][]).map(([key, label]) => (
          <span key={key} className={`inline-flex items-center px-2.5 py-1 rounded text-[11px] font-medium ${statusProjetoColors[key as keyof typeof statusProjetoColors]}`}>
            {label}
          </span>
        ))}
      </div>
    </div>
  );

  const renderTransportadoras = () => (
    <div className="bg-card border border-border rounded-lg p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Truck size={14} className="text-primary" />
        <h2 className="text-sm font-semibold text-foreground">Transportadoras / Tipos de Envio</h2>
      </div>
      <div className="flex gap-2 items-end flex-wrap">
        <div className="space-y-1 flex-1 min-w-[150px]"><label className="text-[11px] text-muted-foreground">Nome *</label><input value={novaTranspNome} onChange={e => setNovaTranspNome(e.target.value)} className="w-full h-8 px-2 text-xs bg-background border border-border rounded focus:outline-none" placeholder="Ex: Jadlog, Correios" /></div>
        <div className="space-y-1 w-36"><label className="text-[11px] text-muted-foreground">Tipo</label>
          <select value={novaTranspTipo} onChange={e => setNovaTranspTipo(e.target.value)} className="w-full h-8 px-2 text-xs bg-background border border-border rounded">
            {tiposTransportadora.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <button onClick={async () => { if (!novaTranspNome.trim()) return; await createTransp.mutateAsync({ nome: novaTranspNome, tipo: novaTranspTipo }); setNovaTranspNome(""); toast.success("Transportadora cadastrada"); }} className="h-8 px-3 rounded bg-primary text-primary-foreground text-xs disabled:opacity-50" disabled={!novaTranspNome.trim()}><Plus size={14} /></button>
      </div>
      {transportadoras && transportadoras.length > 0 ? (
        <div className="border border-border rounded overflow-hidden mt-2">
          <table className="w-full text-xs">
            <thead><tr className="bg-secondary/60">
              <th className="text-left px-2.5 py-2 font-semibold border-b border-border">Nome</th>
              <th className="text-left px-2.5 py-2 font-semibold border-b border-border w-32">Tipo</th>
              <th className="text-center px-2.5 py-2 font-semibold border-b border-border w-20">Ações</th>
            </tr></thead>
            <tbody>
              {transportadoras.map((t: any) => (
                <tr key={t.id} className="border-b border-border last:border-b-0 hover:bg-secondary/30">
                  <td className="px-2.5 py-1.5 font-medium">{t.nome}</td>
                  <td className="px-2.5 py-1.5 text-muted-foreground capitalize">{t.tipo}</td>
                  <td className="px-2.5 py-1.5 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => setEditTransp({ id: t.id, nome: t.nome, tipo: t.tipo })} className="p-1 rounded hover:bg-primary/15 text-muted-foreground hover:text-primary" title="Editar"><Pencil size={12} /></button>
                      <button onClick={() => { if (window.confirm("Excluir transportadora?")) { deleteTransp.mutate(t.id); toast.success("Removida"); } }} className="p-1 rounded hover:bg-destructive/15 text-muted-foreground hover:text-destructive" title="Excluir"><Trash2 size={12} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <p className="text-xs text-muted-foreground mt-2">Nenhuma transportadora cadastrada.</p>}
    </div>
  );

  const sectionMap: Record<Section, () => JSX.Element> = {
    empresa: renderEmpresa,
    usuarios: renderUsuarios,
    funcionarios: renderFuncionarios,
    formas_pagamento: renderFormasPagamento,
    categorias: renderCategorias,
    status_projeto: renderStatusProjeto,
    transportadoras: renderTransportadoras,
  };

  return (
    <div className="animate-fade-in">
      <div className="flex items-center gap-2 mb-4">
        <Settings size={18} className="text-primary" />
        <h1 className="text-lg font-bold text-foreground">Configurações</h1>
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        {/* Internal sidebar */}
        <nav className="w-full md:w-52 shrink-0 bg-card border border-border rounded-lg p-2 space-y-3 md:sticky md:top-4 md:self-start">
          {menuGroups.map(group => (
            <div key={group.label}>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-2 mb-1">{group.label}</p>
              <div className="space-y-0.5">
                {group.items.map(item => {
                  const Icon = item.icon;
                  const isActive = activeSection === item.key;
                  return (
                    <button
                      key={item.key}
                      onClick={() => setActiveSection(item.key)}
                      className={cn(
                        "w-full flex items-center gap-2 px-2.5 py-2 rounded-md text-xs transition-all duration-150",
                        isActive
                          ? "bg-primary/15 text-primary font-semibold"
                          : "text-muted-foreground hover:bg-secondary/80 hover:text-foreground"
                      )}
                    >
                      <Icon size={14} className="shrink-0" />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {sectionMap[activeSection]()}
        </div>
      </div>

      {/* Edit Dialogs */}
      <Dialog open={!!editCat} onOpenChange={open => { if (!open) setEditCat(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="text-sm">Editar Categoria</DialogTitle></DialogHeader>
          {editCat && (
            <div className="space-y-3">
              <div className="space-y-1"><label className="text-[11px] text-muted-foreground">Nome</label><input value={editCat.nome} onChange={e => setEditCat({ ...editCat, nome: e.target.value })} className="w-full h-8 px-2 text-xs bg-background border border-border rounded" /></div>
              <div className="space-y-1"><label className="text-[11px] text-muted-foreground">Tipo</label>
                <select value={editCat.tipo} onChange={e => setEditCat({ ...editCat, tipo: e.target.value })} className="w-full h-8 px-2 text-xs bg-background border border-border rounded">
                  <option value="produto">Produto</option><option value="servico">Serviço</option>
                </select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setEditCat(null)}>Cancelar</Button>
            <Button size="sm" onClick={() => { if (editCat) { updateCat.mutate(editCat); setEditCat(null); toast.success("Categoria atualizada"); } }} disabled={!editCat?.nome.trim()}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editForma} onOpenChange={open => { if (!open) setEditForma(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="text-sm">Editar Forma de Pagamento</DialogTitle></DialogHeader>
          {editForma && (
            <div className="space-y-1"><label className="text-[11px] text-muted-foreground">Nome</label><input value={editForma.nome} onChange={e => setEditForma({ ...editForma, nome: e.target.value })} className="w-full h-8 px-2 text-xs bg-background border border-border rounded" /></div>
          )}
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setEditForma(null)}>Cancelar</Button>
            <Button size="sm" onClick={() => { if (editForma) { updateForma.mutate(editForma); setEditForma(null); toast.success("Forma atualizada"); } }} disabled={!editForma?.nome.trim()}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editTransp} onOpenChange={open => { if (!open) setEditTransp(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="text-sm">Editar Transportadora</DialogTitle></DialogHeader>
          {editTransp && (
            <div className="space-y-3">
              <div className="space-y-1"><label className="text-[11px] text-muted-foreground">Nome</label><input value={editTransp.nome} onChange={e => setEditTransp({ ...editTransp, nome: e.target.value })} className="w-full h-8 px-2 text-xs bg-background border border-border rounded" /></div>
              <div className="space-y-1"><label className="text-[11px] text-muted-foreground">Tipo</label>
                <select value={editTransp.tipo} onChange={e => setEditTransp({ ...editTransp, tipo: e.target.value })} className="w-full h-8 px-2 text-xs bg-background border border-border rounded">
                  {tiposTransportadora.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setEditTransp(null)}>Cancelar</Button>
            <Button size="sm" onClick={() => editTransp && updateTransportadora.mutate(editTransp)} disabled={!editTransp?.nome.trim()}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editEquipe} onOpenChange={open => { if (!open) setEditEquipe(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="text-sm">Editar Funcionário</DialogTitle></DialogHeader>
          {editEquipe && (
            <div className="space-y-3">
              <div className="space-y-1"><label className="text-[11px] text-muted-foreground">Nome</label><input value={editEquipe.nome} onChange={e => setEditEquipe({ ...editEquipe, nome: e.target.value })} className="w-full h-8 px-2 text-xs bg-background border border-border rounded" /></div>
              <div className="space-y-1"><label className="text-[11px] text-muted-foreground">Função</label><input value={editEquipe.funcao} onChange={e => setEditEquipe({ ...editEquipe, funcao: e.target.value })} className="w-full h-8 px-2 text-xs bg-background border border-border rounded" /></div>
              <div className="space-y-1"><label className="text-[11px] text-muted-foreground">Contato</label><input value={editEquipe.contato} onChange={e => setEditEquipe({ ...editEquipe, contato: e.target.value })} className="w-full h-8 px-2 text-xs bg-background border border-border rounded" /></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setEditEquipe(null)}>Cancelar</Button>
            <Button size="sm" onClick={() => editEquipe && updateEquipeMember.mutate(editEquipe)} disabled={!editEquipe?.nome.trim()}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Configuracoes;
