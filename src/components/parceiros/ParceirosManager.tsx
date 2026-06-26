import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useParceiros, useUpdateParceiro, useParceiroProjetos, SUBTIPOS_PARCEIRO } from "@/hooks/useParceiros";
import { useEmpresa } from "@/hooks/useEmpresa";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
 import { UserPlus, Save, Pencil, KeyRound, Copy, Trash2, Search, ExternalLink, DollarSign, Wallet } from "lucide-react";
 import PagamentosTecnicoModal from "./PagamentosTecnicoModal";
import { toast } from "sonner";

const ParceirosManager = () => {
  const empresaId = useEmpresa();
  const qc = useQueryClient();
  const { data: parceiros = [], isLoading } = useParceiros();
  const updateParceiro = useUpdateParceiro();

  const [openNew, setOpenNew] = useState(false);
  const [openVincular, setOpenVincular] = useState<string | null>(null);
   const [openGerenciar, setOpenGerenciar] = useState<string | null>(null);
   const [currentTecnicoPagamento, setCurrentTecnicoPagamento] = useState<string | null>(null);
   const [openEdit, setOpenEdit] = useState<string | null>(null);
  const [form, setForm] = useState({ nome: "", email: "", password: "", subtipo: "arquiteto", rt_percentual: "" });
  const [creating, setCreating] = useState(false);

  // Projetos da empresa para vincular
  const { data: projetos = [] } = useQuery({
    queryKey: ["projetos_simples", empresaId],
    queryFn: async () => {
      const { data } = await supabase
        .from("projetos")
        .select("id, nome, clientes(nome)")
        .eq("empresa_id", empresaId!)
        .eq("deletado", false)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!empresaId,
  });

  // Vínculos de TODOS os parceiros (para resumo na listagem)
  const { data: vinculosResumo = {} } = useQuery({
    queryKey: ["parceiros_vinculos_resumo", empresaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projeto_parceiros")
        .select("parceiro_id, projetos(nome)")
        .eq("empresa_id", empresaId!);
      if (error) throw error;
      const map: Record<string, string[]> = {};
      (data ?? []).forEach((row: any) => {
        const pid = row.parceiro_id as string;
        if (!map[pid]) map[pid] = [];
        if (row.projetos?.nome) map[pid].push(row.projetos.nome);
      });
      return map;
    },
    enabled: !!empresaId,
  });

  const handleCreate = async () => {
    if (!form.nome) {
      toast.error("Nome é obrigatório");
      return;
    }
    setCreating(true);
    try {
      // If email and password provided, create user account
      if (form.email && form.password) {
        console.log("Enviando para Edge Function:", {
          full_name: form.nome.toUpperCase(),
          email: form.email.toLowerCase(),
          password: form.password ? "***" : "VAZIO",
          role: "parceiro",
          subtipo_parceiro: form.subtipo,
        })
        const { data, error } = await supabase.functions.invoke(
          "create-user",
          {
            body: {
              full_name: form.nome.toUpperCase(),
              email: form.email.toLowerCase(),
              password: form.password,
              role: "parceiro",
              subtipo_parceiro: form.subtipo,
            }
          }
        )
        console.log("Retorno Edge Function:", { data, error });
        if (error) throw error;
        if (!data?.success) throw new Error(data?.error ?? "Erro ao criar parceiro");

        try {
          // The edge function already creates the record in 'fornecedores' if subtipo_parceiro is provided.
          // But we need to update the rt_percentual if provided.
          if (form.rt_percentual) {
            const { data: p, error: selectErr } = await supabase.from("fornecedores").select("id").eq("email", form.email.toLowerCase()).single();
            console.log("Busca fornecedor para atualização:", { p, error: selectErr });
            
            if (p) {
              const { error: updateErr } = await supabase.from("fornecedores").update({ rt_percentual: Number(form.rt_percentual) }).eq("id", p.id);
              console.log("Erro atualização fornecedor:", updateErr);
            }
          }
        } catch (e) {
          console.log("Exception atualização fornecedor:", e);
        }
      } else {
        try {
          // Just create the partner in fornecedores table
          const { error: insertErr } = await supabase.from("fornecedores").insert({
            empresa_id: empresaId,
            nome: form.nome.toUpperCase(),
            email: form.email?.toLowerCase() || null,
            tipo: form.subtipo as any,
            subtipo_parceiro: form.subtipo,
            rt_percentual: Number(form.rt_percentual) || 0,
            ativo: true,
            deletado: false
          } as any);
          console.log("Erro insert fornecedor (sem conta):", insertErr);
          if (insertErr) throw insertErr;
        } catch (e) {
          console.log("Exception insert fornecedor (sem conta):", e);
          throw e;
        }
      }

      toast.success("Parceiro cadastrado com sucesso");
      setOpenNew(false);
      setForm({ nome: "", email: "", password: "", subtipo: "arquiteto", rt_percentual: "" });
      qc.invalidateQueries({ queryKey: ["parceiros", empresaId] });
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao criar parceiro");
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (parceiro: any) => {
    if (!window.confirm(`Deseja realmente excluir o parceiro ${parceiro.nome}?`)) return;
    
    try {
      const { data: projVinc } = await supabase
        .from("projetos")
        .select("id")
        .eq("arquiteto_id", parceiro.id)
        .eq("deletado", false);

      if (projVinc && projVinc.length > 0) {
        toast.error(`Não é possível excluir — ${projVinc.length} projeto(s) vinculado(s)`);
        return;
      }

      const { error } = await supabase
        .from("fornecedores")
        .update({ deletado: true })
        .eq("id", parceiro.id);

      if (error) throw error;
      toast.success("Parceiro excluído com sucesso");
      qc.invalidateQueries({ queryKey: ["parceiros", empresaId] });
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const EditModal = ({ parceiroId }: { parceiroId: string }) => {
    const parceiro = parceiros.find((x) => x.id === parceiroId);
    const [nome, setNome] = useState(parceiro?.nome ?? "");
    const [email, setEmail] = useState(parceiro?.email ?? "");
    const [subtipo, setSubtipo] = useState(parceiro?.subtipo_parceiro ?? "arquiteto");
    const [ativo, setAtivo] = useState(!!parceiro?.ativo);
    const [novaSenha, setNovaSenha] = useState("");
    const [confirmaSenha, setConfirmaSenha] = useState("");
    const [tempSenha, setTempSenha] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    if (!parceiro) return null;

    const findUserId = async (targetEmail: string): Promise<string | null> => {
      if (!targetEmail) return null;
      // Profiles don't have email, but we can search for a profile that matches the name 
      // or use the auth metadata if we had access. 
      // However, we can use manage-user to check? No, manage-user doesn't have "find".
      // The instruction says "Se email foi alterado, verificar se existe usuário no auth com email antigo e atualizar a referência na tabela profiles"
      // This implies we can find the userId from the old email somehow.
      
      // Let's use the logic provided: check if there's a user in auth with old email.
      // Since we can't query auth.users directly from client, we'll try to match profiles by the old name 
      // or use the email we have in the 'fornecedores' record if it was previously linked.
      const { data: p } = await supabase.from("profiles").select("id").eq("full_name", parceiro.nome).eq("empresa_id", empresaId!).single();
      return p?.id ?? null;
    };

    const gerarSenhaTemp = () => {
      const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
      let s = "";
      for (let i = 0; i < 10; i++) s += chars[Math.floor(Math.random() * chars.length)];
      setNovaSenha(s);
      setConfirmaSenha(s);
      setTempSenha(s);
      toast.info("Senha temporária gerada — copie antes de salvar");
    };

    const copiarTemp = async () => {
      if (!tempSenha) return;
      try {
        await navigator.clipboard.writeText(tempSenha);
        toast.success("Senha copiada");
      } catch {
        toast.error("Não foi possível copiar");
      }
    };

    const handleSalvar = async () => {
      if (!nome.trim()) { toast.error("Nome é obrigatório"); return; }

      const trocarSenha = novaSenha.length > 0;
      const emailAlterado = email !== (parceiro.email ?? "");

      if (trocarSenha) {
        if (novaSenha.length < 6) { toast.error("Senha deve ter no mínimo 6 caracteres"); return; }
        if (novaSenha !== confirmaSenha) { toast.error("Confirmação de senha não confere"); return; }
      }

      setSaving(true);
      try {
        const userId = await findUserId(parceiro.email || "");

        // Atualiza dados do parceiro (fornecedores)
        const { error: updErr } = await supabase
          .from("fornecedores")
          .update({
            nome: nome.toUpperCase(),
            email: email.toLowerCase(),
            subtipo_parceiro: subtipo,
            tipo: subtipo as any,
            ativo: ativo
          } as any)
          .eq("id", parceiroId);

        if (updErr) throw updErr;

        // Se mudou senha ou email, chama edge function manage-user
        if (trocarSenha || emailAlterado) {
          if (!userId) {
            if (emailAlterado) toast.info("Partner updated, but no linked login found to update email.");
          } else {
            const { data, error } = await supabase.functions.invoke("manage-user", {
              body: { 
                action: "update", 
                user_id: userId, 
                password: trocarSenha ? novaSenha : undefined, 
                full_name: nome.toUpperCase(),
                email: emailAlterado ? email.toLowerCase() : undefined
              },
            });
            if (error) throw error;
            if (!data?.ok) throw new Error(data?.error ?? "Erro ao atualizar dados de login");
            if (trocarSenha) toast.success("Senha atualizada com sucesso");
            if (emailAlterado) toast.success("Email de login atualizado");
          }
        }

        toast.success("Parceiro atualizado com sucesso");
        qc.invalidateQueries({ queryKey: ["parceiros", empresaId] });
        setOpenEdit(null);
      } catch (e: any) {
        toast.error(e?.message ?? "Erro ao salvar");
      } finally {
        setSaving(false);
      }
    };

    return (
      <Dialog open onOpenChange={(o) => !o && setOpenEdit(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Parceiro</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium">Nome completo *</label>
              <input
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                className="w-full h-9 px-2 mt-1 rounded border border-border bg-background text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full h-9 px-2 mt-1 rounded border border-border bg-background text-sm"
              />
              <p className="text-[10px] text-muted-foreground mt-1">Ao alterar o email, o login do parceiro também será atualizado.</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-medium">Tipo</label>
                <select
                  value={subtipo}
                  onChange={(e) => setSubtipo(e.target.value)}
                  className="w-full h-9 px-2 mt-1 rounded border border-border bg-background text-sm"
                >
                  {SUBTIPOS_PARCEIRO.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium">Status</label>
                <select
                  value={ativo ? "1" : "0"}
                  onChange={(e) => setAtivo(e.target.value === "1")}
                  className="w-full h-9 px-2 mt-1 rounded border border-border bg-background text-sm"
                >
                  <option value="1">Ativo</option>
                  <option value="0">Inativo</option>
                </select>
              </div>
            </div>

            <div className="border-t border-border pt-3 mt-2">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Redefinir senha</label>
                <button
                  type="button"
                  onClick={gerarSenhaTemp}
                  className="text-[11px] text-primary hover:underline flex items-center gap-1"
                >
                  <KeyRound size={12} /> Gerar senha temporária
                </button>
              </div>
              <div>
                <label className="text-xs font-medium">Nova senha</label>
                <input
                  type="text"
                  value={novaSenha}
                  onChange={(e) => { setNovaSenha(e.target.value); setTempSenha(null); }}
                  placeholder="Deixe em branco para manter a atual"
                  className="w-full h-9 px-2 mt-1 rounded border border-border bg-background text-sm"
                  style={{ textTransform: "none" }}
                  autoCapitalize="none"
                  autoComplete="new-password"
                  autoCorrect="off"
                  spellCheck={false}
                />
              </div>
              <div className="mt-2">
                <label className="text-xs font-medium">Confirmar nova senha</label>
                <input
                  type="text"
                  value={confirmaSenha}
                  onChange={(e) => setConfirmaSenha(e.target.value)}
                  className="w-full h-9 px-2 mt-1 rounded border border-border bg-background text-sm"
                  style={{ textTransform: "none" }}
                  autoCapitalize="none"
                  autoComplete="new-password"
                  autoCorrect="off"
                  spellCheck={false}
                />
              </div>
              {tempSenha && (
                <div className="mt-2 flex items-center gap-2 p-2 rounded bg-secondary/40 border border-border">
                  <span className="text-xs flex-1">Senha gerada: <span className="font-mono font-semibold">{tempSenha}</span></span>
                  <button onClick={copiarTemp} className="text-primary hover:underline text-[11px] flex items-center gap-1">
                    <Copy size={12} /> Copiar
                  </button>
                </div>
              )}
              <p className="text-[10px] text-muted-foreground mt-1">
                Mínimo 6 caracteres. Vazio = senha atual mantida.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenEdit(null)} disabled={saving}>Cancelar</Button>
            <Button onClick={handleSalvar} disabled={saving}>
              <Save size={14} className="mr-1" />
              {saving ? "Salvando…" : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  };

  const GerenciarFinanceiroModal = ({ parceiroId }: { parceiroId: string }) => {
    const parceiro = parceiros.find(p => p.id === parceiroId);
    const { data: parcelas, isLoading } = useQuery({
      queryKey: ["parceiro_fp", parceiroId],
      queryFn: async () => {
        const { data, error } = await supabase
          .from("financeiro_pagar")
          .select(`
            id, valor, status, origem,
            comissao_id, projeto_id,
            projetos(id, nome, status)
          `)
          .eq("fornecedor_id", parceiroId)
          .eq("origem", "comissao")
          .eq("deletado", false);
        if (error) throw error;
        return data ?? [];
      },
      enabled: !!parceiroId
    });

    const resumo = useMemo(() => {
      const map: Record<string, {
        nome: string, status: string,
        total: number, pago: number, pendente: number
      }> = {};

      (parcelas ?? []).forEach((fp: any) => {
        const pid = fp.projeto_id;
        if (!map[pid]) {
          map[pid] = {
            nome: fp.projetos?.nome ?? "Projeto s/ nome",
            status: fp.projetos?.status ?? "indefinido",
            total: 0, pago: 0, pendente: 0
          };
        }
        const valor = Number(fp.valor) || 0;
        map[pid].total += valor;
        if (fp.status === "pago") map[pid].pago += valor;
        else map[pid].pendente += valor;
      });
      return Object.values(map);
    }, [parcelas]);

    return (
      <Dialog open onOpenChange={(o) => !o && setOpenGerenciar(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Gerenciar Financeiro: {parceiro?.nome}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="border border-border rounded overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-secondary/60">
                  <tr>
                    <th className="text-left px-3 py-2">Projeto</th>
                    <th className="text-left px-3 py-2">Status</th>
                    <th className="text-right px-3 py-2">RT Total</th>
                    <th className="text-right px-3 py-2 text-success">Pago</th>
                    <th className="text-right px-3 py-2 text-warning">Pendente</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading && (
                    <tr><td colSpan={5} className="text-center py-8 text-muted-foreground">Carregando comissões...</td></tr>
                  )}
                  {!isLoading && resumo.length === 0 && (
                    <tr><td colSpan={5} className="text-center py-8 text-muted-foreground">Nenhuma comissão encontrada para este parceiro.</td></tr>
                  )}
                  {resumo.map((r, i) => (
                    <tr key={i} className="border-t border-border hover:bg-secondary/20">
                      <td className="px-3 py-2 font-medium">{r.nome}</td>
                      <td className="px-3 py-2">
                         <span className="px-2 py-0.5 rounded-full text-[10px] bg-secondary text-secondary-foreground capitalize">
                           {r.status}
                         </span>
                      </td>
                      <td className="px-3 py-2 text-right font-semibold">R$ {r.total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
                      <td className="px-3 py-2 text-right text-success">R$ {r.pago.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
                      <td className="px-3 py-2 text-right text-warning">R$ {r.pendente.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setOpenGerenciar(null)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  };

  const VincularModal = ({ parceiroId }: { parceiroId: string }) => {
    const { data: vinculos = [], isLoading: loadingVinc } = useParceiroProjetos(parceiroId);
    type RTConfig = { rt_tipo: "percentual" | "fixo"; rt_base: "venda_total" | "itens" | "rt_itens"; rt_percentual: number; rt_valor: number };
    // Padrão: usar RT já definida nos itens do projeto (soma direta)
    const defaultCfg: RTConfig = { rt_tipo: "percentual", rt_base: "rt_itens", rt_percentual: 100, rt_valor: 0 };

    const vinculadosMap = useMemo(() => {
      const m: Record<string, any> = {};
      vinculos.forEach((v: any) => { m[v.projeto_id] = v; });
      return m;
    }, [vinculos]);

    const [selecionados, setSelecionados] = useState<Set<string> | null>(null);
    const [configs, setConfigs] = useState<Record<string, RTConfig>>({});
    const [saving, setSaving] = useState(false);

    const current = selecionados ?? new Set(Object.keys(vinculadosMap));

    const getCfg = (id: string): RTConfig => {
      if (configs[id]) return configs[id];
      const v = vinculadosMap[id];
      if (v) return {
        rt_tipo: (v.rt_tipo as any) ?? "percentual",
        rt_base: (v.rt_base as any) ?? "venda_total",
        rt_percentual: Number(v.rt_percentual ?? 0),
        rt_valor: Number(v.rt_valor ?? 0),
      };
      return defaultCfg;
    };

    const updateCfg = (id: string, patch: Partial<RTConfig>) => {
      setConfigs((prev) => ({ ...prev, [id]: { ...getCfg(id), ...patch } }));
    };

    const toggle = (id: string) => {
      const next = new Set(current);
      next.has(id) ? next.delete(id) : next.add(id);
      setSelecionados(next);
    };

    const handleSalvar = async () => {
      const finalSel = current;
      const toAdd = [...finalSel].filter((id) => !vinculadosMap[id]);
      const toUpdate = [...finalSel].filter((id) => vinculadosMap[id] && configs[id]);
      const toRemove = vinculos.filter((v: any) => !finalSel.has(v.projeto_id));

      console.log("Projetos vinculados:", [...finalSel]);
      console.log("Adicionar:", toAdd, "Atualizar:", toUpdate, "Remover:", toRemove.map((v: any) => v.projeto_id));

      setSaving(true);
      try {
        if (toRemove.length > 0) {
          const ids = toRemove.map((v: any) => v.id);
          const { error } = await supabase.from("projeto_parceiros").delete().in("id", ids);
          if (error) throw error;
        }
        if (toAdd.length > 0) {
          const rows = toAdd.map((projeto_id) => {
            const c = getCfg(projeto_id);
            return {
              empresa_id: empresaId!,
              projeto_id,
              parceiro_id: parceiroId,
              rt_tipo: c.rt_tipo,
              rt_base: c.rt_base,
              rt_percentual: c.rt_percentual,
              rt_valor: c.rt_valor,
            };
          });
          const { error } = await supabase.from("projeto_parceiros").insert(rows);
          if (error) throw error;
        }
        for (const projeto_id of toUpdate) {
          const v = vinculadosMap[projeto_id];
          const c = getCfg(projeto_id);
          const { error } = await supabase
            .from("projeto_parceiros")
            .update({
              rt_tipo: c.rt_tipo,
              rt_base: c.rt_base,
              rt_percentual: c.rt_percentual,
              rt_valor: c.rt_valor,
            })
            .eq("id", v.id);
          if (error) throw error;
        }
        // Debug: ler rt_total recalculado pelo trigger
        const { data: recalculados } = await supabase
          .from("projeto_parceiros")
          .select("projeto_id, rt_tipo, rt_base, rt_total, rt_recebido")
          .eq("parceiro_id", parceiroId);
        (recalculados ?? []).forEach((r: any) => {
          console.log("RT total calculada:", r.rt_total, "(projeto:", r.projeto_id, "base:", r.rt_base, ")");
        });
        toast.success("Vínculos e RT salvos com sucesso");
        qc.invalidateQueries({ queryKey: ["projeto_parceiros"] });
        qc.invalidateQueries({ queryKey: ["parceiro_projetos", parceiroId] });
        qc.invalidateQueries({ queryKey: ["parceiros_vinculos_resumo"] });
        setOpenVincular(null);
      } catch (e: any) {
        toast.error(e?.message ?? "Erro ao salvar vínculos");
      } finally {
        setSaving(false);
      }
    };

    return (
      <Dialog open onOpenChange={(o) => !o && setOpenVincular(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Gerenciar projetos do parceiro</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Marque os projetos e configure a Reserva Técnica (RT) de cada um. O cálculo é automático.
            </p>
            <div className="border border-border rounded max-h-[400px] overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="bg-secondary/60 sticky top-0">
                  <tr>
                    <th className="w-10 text-center px-2 py-1.5">✓</th>
                    <th className="text-left px-2 py-1.5">Projeto</th>
                    <th className="text-left px-2 py-1.5">Cliente</th>
                    <th className="text-left px-2 py-1.5 w-[360px]">Configuração de RT</th>
                    <th className="text-right px-2 py-1.5 w-[110px]">RT total</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingVinc && (
                    <tr><td colSpan={5} className="text-center text-muted-foreground py-3">Carregando…</td></tr>
                  )}
                  {!loadingVinc && projetos.length === 0 && (
                    <tr><td colSpan={5} className="text-center text-muted-foreground py-3">Nenhum projeto disponível.</td></tr>
                  )}
                  {projetos.map((p: any) => {
                    const checked = current.has(p.id);
                    const cfg = getCfg(p.id);
                    const v = vinculadosMap[p.id];
                    const rtTotalSalvo = Number(v?.rt_total ?? 0);
                    return (
                      <tr
                        key={p.id}
                        className="border-t border-border hover:bg-secondary/20"
                      >
                        <td className="px-2 py-1.5 text-center align-top pt-2 cursor-pointer" onClick={() => toggle(p.id)}>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggle(p.id)}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </td>
                        <td className="px-2 py-1.5 align-top pt-2 cursor-pointer" onClick={() => toggle(p.id)}>{p.nome}</td>
                        <td className="px-2 py-1.5 text-muted-foreground align-top pt-2 cursor-pointer" onClick={() => toggle(p.id)}>{p.clientes?.nome ?? "—"}</td>
                        <td className="px-2 py-1.5">
                          {checked ? (
                            <div className="flex flex-wrap items-center gap-1.5">
                              <select
                                value={cfg.rt_tipo}
                                onChange={(e) => updateCfg(p.id, { rt_tipo: e.target.value as any })}
                                className="h-7 px-1 rounded border border-border bg-background text-[11px]"
                              >
                                <option value="percentual">%</option>
                                <option value="fixo">R$</option>
                              </select>
                              {cfg.rt_tipo === "percentual" ? (
                                <>
                                  <input
                                    type="number" step="0.01" min="0"
                                    value={cfg.rt_percentual}
                                    onChange={(e) => updateCfg(p.id, { rt_percentual: Number(e.target.value) || 0 })}
                                    className="w-16 h-7 px-1 rounded border border-border bg-background text-[11px] text-right"
                                    placeholder="0,00"
                                  />
                                  <span className="text-[10px] text-muted-foreground">sobre</span>
                                  <select
                                    value={cfg.rt_base}
                                    onChange={(e) => updateCfg(p.id, { rt_base: e.target.value as any })}
                                    className="h-7 px-1 rounded border border-border bg-background text-[11px]"
                                  >
                                    <option value="rt_itens">RT dos Itens</option>
                                    <option value="venda_total">Venda total</option>
                                    <option value="itens">Soma dos Itens</option>
                                  </select>
                                </>
                              ) : (
                                <input
                                  type="number" step="0.01" min="0"
                                  value={cfg.rt_valor}
                                  onChange={(e) => updateCfg(p.id, { rt_valor: Number(e.target.value) || 0 })}
                                  className="w-24 h-7 px-1 rounded border border-border bg-background text-[11px] text-right"
                                  placeholder="0,00"
                                />
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-[11px]">—</span>
                          )}
                        </td>
                        <td className="px-2 py-1.5 text-right align-top pt-2 font-semibold">
                          {checked && v ? `R$ ${rtTotalSalvo.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="text-[11px] text-muted-foreground">
              {current.size} projeto(s) selecionado(s) — RT é recalculado automaticamente após salvar
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenVincular(null)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleSalvar} disabled={saving}>
              <Save size={14} className="mr-1" />
              {saving ? "Salvando…" : "Salvar vínculos"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  };

  const arquitetos = useMemo(() => parceiros.filter(p => p.tipo !== "tecnico"), [parceiros]);
  const tecnicos = useMemo(() => parceiros.filter(p => p.tipo === "tecnico"), [parceiros]);

  if (currentTecnicoPagamento) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setCurrentTecnicoPagamento(null)}>
            ← Voltar para Parceiros
          </Button>
        </div>
        <PagamentosTecnicoModal 
          parceiroId={currentTecnicoPagamento} 
          onClose={() => setCurrentTecnicoPagamento(null)} 
          inline={true}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-foreground">Parceiros</h2>
          <p className="text-xs text-muted-foreground">Cadastro e vínculo de parceiros externos a projetos</p>
        </div>
        <Button size="sm" onClick={() => setOpenNew(true)}>
          <UserPlus size={14} className="mr-1" /> Novo Parceiro
        </Button>
      </div>

      <div className="space-y-8">
        <section>
          <h3 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wider">Arquitetos e Parceiros</h3>
          <div className="border border-border rounded overflow-x-auto">
            <table className="w-full text-xs min-w-[800px]">
              <thead className="bg-secondary/60">
                <tr>
                  <th className="text-left px-2.5 py-2 font-semibold">Nome</th>
                  <th className="text-left px-2.5 py-2 font-semibold">Email</th>
                  <th className="text-left px-2.5 py-2 font-semibold">Tipo</th>
                  <th className="text-center px-2.5 py-2 font-semibold">Status</th>
                  <th className="text-left px-2.5 py-2 font-semibold">Projetos vinculados</th>
                  <th className="w-20"></th>
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr><td colSpan={6} className="text-center text-muted-foreground py-4">Carregando…</td></tr>
                )}
                {!isLoading && arquitetos.length === 0 && (
                  <tr><td colSpan={6} className="text-center text-muted-foreground py-4">Nenhum arquiteto ou parceiro cadastrado.</td></tr>
                )}
                {arquitetos.map((p) => (
                  <tr key={p.id} className="border-t border-border hover:bg-secondary/20">
                    <td className="px-2.5 py-1.5 font-medium">{p.nome}</td>
                    <td className="px-2.5 py-1.5 text-muted-foreground">{p.email ?? "—"}</td>
                    <td className="px-2.5 py-1.5 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-medium min-w-[65px] capitalize">{p.tipo || "—"}</span>
                        <select
                          value={p.tipo ?? "arquiteto"}
                          onChange={(e) => updateParceiro.mutate({ id: p.id, tipo: e.target.value })}
                          className="h-7 px-1 rounded border border-border bg-background text-[11px]"
                        >
                          {SUBTIPOS_PARCEIRO.map((s) => (
                            <option key={s.value} value={s.value}>{s.label}</option>
                          ))}
                        </select>
                      </div>
                    </td>
                    <td className="px-2.5 py-1.5 text-center">
                      <button
                        onClick={() => updateParceiro.mutate({ id: p.id, ativo: !p.ativo })}
                        className={`px-2 py-0.5 rounded text-[11px] font-medium ${p.ativo ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}`}
                      >
                        {p.ativo ? "Ativo" : "Inativo"}
                      </button>
                    </td>
                    <td className="px-2.5 py-1.5">
                      {(() => {
                        const nomes = vinculosResumo[p.id] ?? [];
                        const count = nomes.length;
                        if (count === 0) return <span className="text-[11px] text-muted-foreground">Nenhum projeto</span>;
                        const preview = nomes.slice(0, 2).join(", ");
                        const extra = count > 2 ? `, +${count - 2}…` : "";
                        return (
                          <div className="flex flex-col">
                            <span className="text-[11px] font-medium text-foreground">{count} projeto{count > 1 ? "s" : ""} vinculado{count > 1 ? "s" : ""}</span>
                            <span className="text-[10px] text-muted-foreground truncate max-w-[260px]" title={nomes.join(", ")}>{preview}{extra}</span>
                          </div>
                        );
                      })()}
                    </td>
                    <td className="px-2.5 py-1.5 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button onClick={() => setOpenEdit(p.id)} className="text-muted-foreground hover:text-foreground text-[11px] flex items-center gap-1" title="Editar parceiro"><Pencil size={12} /> Editar</button>
                        <button onClick={() => setOpenGerenciar(p.id)} className="text-primary hover:underline text-[11px] flex items-center gap-1" title="Ver financeiro"><Search size={12} /> Gerenciar</button>
                        <button onClick={() => setOpenVincular(p.id)} className="text-muted-foreground hover:text-foreground text-[11px] flex items-center gap-1" title="Vincular projetos"><ExternalLink size={12} /> Vincular</button>
                        <button onClick={() => handleDelete(p)} className="text-muted-foreground hover:text-destructive text-[11px] flex items-center gap-1" title="Excluir parceiro"><Trash2 size={12} /> Excluir</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h3 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wider">Técnicos</h3>
          <div className="border border-border rounded overflow-x-auto">
            <table className="w-full text-xs min-w-[800px]">
              <thead className="bg-secondary/60">
                <tr>
                  <th className="text-left px-2.5 py-2 font-semibold">Nome</th>
                  <th className="text-left px-2.5 py-2 font-semibold">Email</th>
                  <th className="text-center px-2.5 py-2 font-semibold">Status</th>
                  <th className="w-20"></th>
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr><td colSpan={4} className="text-center text-muted-foreground py-4">Carregando…</td></tr>
                )}
                {!isLoading && tecnicos.length === 0 && (
                  <tr><td colSpan={4} className="text-center text-muted-foreground py-4">Nenhum técnico cadastrado.</td></tr>
                )}
                {tecnicos.map((p) => (
                  <tr key={p.id} className="border-t border-border hover:bg-secondary/20">
                    <td className="px-2.5 py-1.5 font-medium">{p.nome}</td>
                    <td className="px-2.5 py-1.5 text-muted-foreground">{p.email ?? "—"}</td>
                    <td className="px-2.5 py-1.5 text-center">
                      <button
                        onClick={() => updateParceiro.mutate({ id: p.id, ativo: !p.ativo })}
                        className={`px-2 py-0.5 rounded text-[11px] font-medium ${p.ativo ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}`}
                      >
                        {p.ativo ? "Ativo" : "Inativo"}
                      </button>
                    </td>
                    <td className="px-2.5 py-1.5 text-center">
                      <div className="flex items-center justify-center gap-3">
                        <button onClick={() => setOpenEdit(p.id)} className="text-muted-foreground hover:text-foreground text-[11px] flex items-center gap-1" title="Editar técnico"><Pencil size={12} /> Editar</button>
                        <button onClick={() => setCurrentTecnicoPagamento(p.id)} className="text-success hover:underline text-[11px] flex items-center gap-1" title="Pagamentos"><Wallet size={12} /> Pagamentos</button>
                        <button onClick={() => handleDelete(p)} className="text-muted-foreground hover:text-destructive text-[11px] flex items-center gap-1" title="Excluir técnico"><Trash2 size={12} /> Excluir</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {openVincular && <VincularModal parceiroId={openVincular} />}
      {openGerenciar && <GerenciarFinanceiroModal parceiroId={openGerenciar} />}
      {openEdit && <EditModal parceiroId={openEdit} />}

      <Dialog open={openNew} onOpenChange={setOpenNew}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cadastrar Parceiro</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium">Nome completo *</label>
              <input
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                className="w-full h-9 px-2 mt-1 rounded border border-border bg-background text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full h-9 px-2 mt-1 rounded border border-border bg-background text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium">Tipo de Parceiro</label>
                <select
                  value={form.subtipo}
                  onChange={(e) => setForm({ ...form, subtipo: e.target.value })}
                  className="w-full h-9 px-2 mt-1 rounded border border-border bg-background text-sm"
                >
                  {SUBTIPOS_PARCEIRO.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium">RT Percentual (%)</label>
                <input
                  type="number"
                  step="0.01"
                  value={form.rt_percentual}
                  onChange={(e) => setForm({ ...form, rt_percentual: e.target.value })}
                  className="w-full h-9 px-2 mt-1 rounded border border-border bg-background text-sm"
                  placeholder="0.00"
                />
              </div>
            </div>

            <div className="pt-2 border-t border-border mt-2">
              <p className="text-[10px] text-muted-foreground mb-2">Para criar um acesso ao sistema para o parceiro, preencha também uma senha:</p>
              <div>
                <label className="text-xs font-medium">Senha de acesso (opcional)</label>
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="w-full h-9 px-2 mt-1 rounded border border-border bg-background text-sm"
                  placeholder="Mínimo 6 caracteres"
                  autoCapitalize="none"
                  autoCorrect="off"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenNew(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={creating}>
              {creating ? "Cadastrando…" : "Cadastrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ParceirosManager;