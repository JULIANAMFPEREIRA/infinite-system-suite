import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useParceiros, useUpdateParceiro, useParceiroProjetos, SUBTIPOS_PARCEIRO } from "@/hooks/useParceiros";
import { useEmpresa } from "@/hooks/useEmpresa";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
 import { UserPlus, Save, Pencil, KeyRound, Copy, Trash2, Search, ExternalLink } from "lucide-react";
import { toast } from "sonner";

const ParceirosManager = () => {
  const empresaId = useEmpresa();
  const qc = useQueryClient();
  const { data: parceiros = [], isLoading } = useParceiros();
  const updateParceiro = useUpdateParceiro();

  const [openNew, setOpenNew] = useState(false);
  const [openVincular, setOpenVincular] = useState<string | null>(null);
  const [openEdit, setOpenEdit] = useState<string | null>(null);
  const [form, setForm] = useState({ nome: "", email: "", password: "", subtipo: "arquiteto" });
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
    if (!form.nome || !form.email || !form.password) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }
    setCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-user", {
        body: {
          full_name: form.nome.toUpperCase(),
          email: form.email.toLowerCase(),
          password: form.password,
          role: "parceiro",
          subtipo_parceiro: form.subtipo,
        },
      });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error ?? "Erro ao criar parceiro");
      toast.success("Parceiro cadastrado com sucesso");
      setOpenNew(false);
      setForm({ nome: "", email: "", password: "", subtipo: "arquiteto" });
      qc.invalidateQueries({ queryKey: ["parceiros"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao criar parceiro");
    } finally {
      setCreating(false);
    }
  };

  const EditModal = ({ parceiroId }: { parceiroId: string }) => {
    const parceiro = parceiros.find((x) => x.id === parceiroId);
    const [nome, setNome] = useState(parceiro?.nome ?? "");
    const [subtipo, setSubtipo] = useState(parceiro?.subtipo_parceiro ?? "arquiteto");
    const [ativo, setAtivo] = useState(!!parceiro?.ativo);
    const [novaSenha, setNovaSenha] = useState("");
    const [confirmaSenha, setConfirmaSenha] = useState("");
    const [tempSenha, setTempSenha] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    if (!parceiro) return null;

    const findUserId = async (): Promise<string | null> => {
      if (!parceiro.email) return null;
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name")
        .eq("empresa_id", empresaId!);
      // Match via auth user by email — usamos full_name fallback ou email no metadata.
      // Como profiles não tem email, usamos a edge function de busca por email indireta:
      // tentamos casar pelo full_name do parceiro.
      const match = (data ?? []).find(
        (p: any) => (p.full_name ?? "").toUpperCase() === (parceiro.nome ?? "").toUpperCase()
      );
      return match?.id ?? null;
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
      if (trocarSenha) {
        if (novaSenha.length < 6) { toast.error("Senha deve ter no mínimo 6 caracteres"); return; }
        if (novaSenha !== confirmaSenha) { toast.error("Confirmação de senha não confere"); return; }
      }

      setSaving(true);
      try {
        // Atualiza dados do parceiro (fornecedores)
        await new Promise<void>((resolve, reject) => {
          updateParceiro.mutate(
            { id: parceiroId, nome: nome.toUpperCase(), subtipo_parceiro: subtipo, ativo },
            { onSuccess: () => resolve(), onError: (e) => reject(e) }
          );
        });

        // Se mudou senha, chama edge function manage-user
        if (trocarSenha) {
          const userId = await findUserId();
          if (!userId) {
            toast.error("Não foi possível localizar o login deste parceiro para atualizar a senha");
          } else {
            const { data, error } = await supabase.functions.invoke("manage-user", {
              body: { action: "update", user_id: userId, password: novaSenha, full_name: nome.toUpperCase() },
            });
            if (error) throw error;
            if (!data?.ok) throw new Error(data?.error ?? "Erro ao atualizar senha");
            toast.success("Senha atualizada com sucesso");
          }
        }

        toast.success("Parceiro atualizado com sucesso");
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
                value={parceiro.email ?? ""}
                disabled
                className="w-full h-9 px-2 mt-1 rounded border border-border bg-muted text-sm text-muted-foreground"
              />
              <p className="text-[10px] text-muted-foreground mt-1">O email de login não pode ser alterado.</p>
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
                />
              </div>
              <div className="mt-2">
                <label className="text-xs font-medium">Confirmar nova senha</label>
                <input
                  type="text"
                  value={confirmaSenha}
                  onChange={(e) => setConfirmaSenha(e.target.value)}
                  className="w-full h-9 px-2 mt-1 rounded border border-border bg-background text-sm"
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

      <div className="border border-border rounded overflow-hidden">
        <table className="w-full text-xs">
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
              <tr>
                <td colSpan={6} className="text-center text-muted-foreground py-4">Carregando…</td>
              </tr>
            )}
            {!isLoading && parceiros.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center text-muted-foreground py-4">
                  Nenhum parceiro cadastrado.
                </td>
              </tr>
            )}
            {parceiros.map((p) => (
              <tr key={p.id} className="border-t border-border hover:bg-secondary/20">
                <td className="px-2.5 py-1.5 font-medium">{p.nome}</td>
                <td className="px-2.5 py-1.5 text-muted-foreground">{p.email ?? "—"}</td>
                <td className="px-2.5 py-1.5">
                  <select
                    value={p.subtipo_parceiro ?? "arquiteto"}
                    onChange={(e) => updateParceiro.mutate({ id: p.id, subtipo_parceiro: e.target.value })}
                    className="h-7 px-1.5 rounded border border-border bg-background text-xs"
                  >
                    {SUBTIPOS_PARCEIRO.map((s) => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </td>
                <td className="px-2.5 py-1.5 text-center">
                  <button
                    onClick={() => updateParceiro.mutate({ id: p.id, ativo: !p.ativo })}
                    className={`px-2 py-0.5 rounded text-[11px] font-medium ${
                      p.ativo ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {p.ativo ? "Ativo" : "Inativo"}
                  </button>
                </td>
                <td className="px-2.5 py-1.5">
                  {(() => {
                    const nomes = vinculosResumo[p.id] ?? [];
                    const count = nomes.length;
                    if (count === 0) {
                      return <span className="text-[11px] text-muted-foreground">Nenhum projeto</span>;
                    }
                    const preview = nomes.slice(0, 2).join(", ");
                    const extra = count > 2 ? `, +${count - 2}…` : "";
                    return (
                      <div className="flex flex-col">
                        <span className="text-[11px] font-medium text-foreground">
                          {count} projeto{count > 1 ? "s" : ""} vinculado{count > 1 ? "s" : ""}
                        </span>
                        <span className="text-[10px] text-muted-foreground truncate max-w-[260px]" title={nomes.join(", ")}>
                          {preview}{extra}
                        </span>
                      </div>
                    );
                  })()}
                </td>
                <td className="px-2.5 py-1.5 text-center">
                  <div className="flex items-center justify-center gap-2">
                    <button
                      onClick={() => setOpenEdit(p.id)}
                      className="text-muted-foreground hover:text-foreground text-[11px] flex items-center gap-1"
                      title="Editar parceiro"
                    >
                      <Pencil size={12} /> Editar
                    </button>
                    <button
                      onClick={() => setOpenVincular(p.id)}
                      className="text-primary hover:underline text-[11px]"
                    >
                      Gerenciar
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {openVincular && <VincularModal parceiroId={openVincular} />}
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
              <label className="text-xs font-medium">Email *</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full h-9 px-2 mt-1 rounded border border-border bg-background text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium">Senha *</label>
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="w-full h-9 px-2 mt-1 rounded border border-border bg-background text-sm"
              />
            </div>
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