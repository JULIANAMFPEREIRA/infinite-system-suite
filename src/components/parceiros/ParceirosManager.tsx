import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useParceiros, useUpdateParceiro, useParceiroProjetos, SUBTIPOS_PARCEIRO } from "@/hooks/useParceiros";
import { useEmpresa } from "@/hooks/useEmpresa";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { UserPlus, Save, Pencil, KeyRound, Copy } from "lucide-react";
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

  const VincularModal = ({ parceiroId }: { parceiroId: string }) => {
    const { data: vinculos = [], isLoading: loadingVinc } = useParceiroProjetos(parceiroId);
    const vinculadosIds = useMemo(
      () => new Set(vinculos.map((v: any) => v.projeto_id as string)),
      [vinculos]
    );
    const [selecionados, setSelecionados] = useState<Set<string> | null>(null);
    const [saving, setSaving] = useState(false);

    // Inicializa selecionados com vínculos existentes
    const current = selecionados ?? vinculadosIds;

    const toggle = (id: string) => {
      const next = new Set(current);
      next.has(id) ? next.delete(id) : next.add(id);
      setSelecionados(next);
    };

    const handleSalvar = async () => {
      const finalSel = current;
      const toAdd = [...finalSel].filter((id) => !vinculadosIds.has(id));
      const toRemove = vinculos.filter((v: any) => !finalSel.has(v.projeto_id));

      console.log("Projetos vinculados:", [...finalSel]);
      console.log("Adicionar:", toAdd, "Remover:", toRemove.map((v: any) => v.projeto_id));

      setSaving(true);
      try {
        if (toRemove.length > 0) {
          const ids = toRemove.map((v: any) => v.id);
          const { error } = await supabase.from("projeto_parceiros").delete().in("id", ids);
          if (error) throw error;
        }
        if (toAdd.length > 0) {
          const rows = toAdd.map((projeto_id) => ({
            empresa_id: empresaId!,
            projeto_id,
            parceiro_id: parceiroId,
          }));
          const { error } = await supabase.from("projeto_parceiros").insert(rows);
          if (error) throw error;
        }
        toast.success("Projetos vinculados com sucesso");
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
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Gerenciar projetos do parceiro</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Marque os projetos que este parceiro pode acessar. Desmarque para remover o vínculo.
            </p>
            <div className="border border-border rounded max-h-[400px] overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="bg-secondary/60 sticky top-0">
                  <tr>
                    <th className="w-10 text-center px-2 py-1.5">✓</th>
                    <th className="text-left px-2 py-1.5">Projeto</th>
                    <th className="text-left px-2 py-1.5">Cliente</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingVinc && (
                    <tr><td colSpan={3} className="text-center text-muted-foreground py-3">Carregando…</td></tr>
                  )}
                  {!loadingVinc && projetos.length === 0 && (
                    <tr><td colSpan={3} className="text-center text-muted-foreground py-3">Nenhum projeto disponível.</td></tr>
                  )}
                  {projetos.map((p: any) => {
                    const checked = current.has(p.id);
                    return (
                      <tr
                        key={p.id}
                        className="border-t border-border hover:bg-secondary/20 cursor-pointer"
                        onClick={() => toggle(p.id)}
                      >
                        <td className="px-2 py-1.5 text-center">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggle(p.id)}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </td>
                        <td className="px-2 py-1.5">{p.nome}</td>
                        <td className="px-2 py-1.5 text-muted-foreground">{p.clientes?.nome ?? "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="text-[11px] text-muted-foreground">
              {current.size} projeto(s) selecionado(s)
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
                  <button
                    onClick={() => setOpenVincular(p.id)}
                    className="text-primary hover:underline text-[11px]"
                  >
                    Gerenciar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {openVincular && <VincularModal parceiroId={openVincular} />}

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