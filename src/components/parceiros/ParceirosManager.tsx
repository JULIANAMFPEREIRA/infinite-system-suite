import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useParceiros, useUpdateParceiro, useParceiroProjetos, SUBTIPOS_PARCEIRO } from "@/hooks/useParceiros";
import { useEmpresa } from "@/hooks/useEmpresa";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { UserPlus, Save } from "lucide-react";
import { toast } from "sonner";

const ParceirosManager = () => {
  const empresaId = useEmpresa();
  const qc = useQueryClient();
  const { data: parceiros = [], isLoading } = useParceiros();
  const updateParceiro = useUpdateParceiro();

  const [openNew, setOpenNew] = useState(false);
  const [openVincular, setOpenVincular] = useState<string | null>(null);
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
    const { data: vinculos = [] } = useParceiroProjetos(parceiroId);
    const vinculadosIds = new Set(vinculos.map((v: any) => v.projeto_id));
    const [selProjeto, setSelProjeto] = useState("");

    return (
      <Dialog open onOpenChange={(o) => !o && setOpenVincular(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Projetos vinculados ao parceiro</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex gap-2">
              <select
                value={selProjeto}
                onChange={(e) => setSelProjeto(e.target.value)}
                className="flex-1 h-9 px-2 rounded border border-border bg-background text-xs"
              >
                <option value="">Selecione um projeto…</option>
                {projetos
                  .filter((p: any) => !vinculadosIds.has(p.id))
                  .map((p: any) => (
                    <option key={p.id} value={p.id}>
                      {p.nome} {p.clientes?.nome ? `— ${p.clientes.nome}` : ""}
                    </option>
                  ))}
              </select>
              <Button
                size="sm"
                disabled={!selProjeto || vincular.isPending}
                onClick={() => {
                  vincular.mutate({ projeto_id: selProjeto, parceiro_id: parceiroId });
                  setSelProjeto("");
                }}
              >
                <Link2 size={14} className="mr-1" /> Vincular
              </Button>
            </div>

            <div className="border border-border rounded">
              <table className="w-full text-xs">
                <thead className="bg-secondary/60">
                  <tr>
                    <th className="text-left px-2 py-1.5">Projeto</th>
                    <th className="text-left px-2 py-1.5">Cliente</th>
                    <th className="w-12"></th>
                  </tr>
                </thead>
                <tbody>
                  {vinculos.length === 0 && (
                    <tr>
                      <td colSpan={3} className="text-center text-muted-foreground py-3">
                        Nenhum projeto vinculado.
                      </td>
                    </tr>
                  )}
                  {vinculos.map((v: any) => (
                    <tr key={v.id} className="border-t border-border">
                      <td className="px-2 py-1.5">{v.projetos?.nome}</td>
                      <td className="px-2 py-1.5">{v.projetos?.clientes?.nome ?? "—"}</td>
                      <td className="px-2 py-1.5">
                        <button
                          onClick={() => desvincular.mutate(v.id)}
                          className="text-destructive hover:text-destructive/80"
                          title="Remover vínculo"
                        >
                          <X size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenVincular(null)}>Fechar</Button>
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
              <th className="text-center px-2.5 py-2 font-semibold">Projetos</th>
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
                <td className="px-2.5 py-1.5 text-center">
                  <button
                    onClick={() => setOpenVincular(p.id)}
                    className="text-primary hover:underline text-[11px]"
                  >
                    Gerenciar
                  </button>
                </td>
                <td className="px-2.5 py-1.5 text-center"></td>
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