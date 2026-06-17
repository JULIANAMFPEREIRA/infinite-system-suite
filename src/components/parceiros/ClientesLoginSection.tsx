import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/hooks/useEmpresa";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { KeyRound, ExternalLink } from "lucide-react";
import { toast } from "sonner";

type ClienteRow = {
  id: string;
  nome: string;
  email: string | null;
  user_id: string | null;
};

const ClientesLoginSection = () => {
  const empresaId = useEmpresa();
  const qc = useQueryClient();
  const [openCreate, setOpenCreate] = useState<ClienteRow | null>(null);
  const [password, setPassword] = useState("");
  const [creating, setCreating] = useState(false);

  const { data: clientes = [], isLoading } = useQuery({
    queryKey: ["clientes_login_section", empresaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clientes")
        .select("id, nome, email, user_id")
        .eq("empresa_id", empresaId!)
        .eq("deletado", false)
        .order("nome");
      if (error) throw error;
      return (data ?? []) as ClienteRow[];
    },
    enabled: !!empresaId,
  });

  const handleCreate = async () => {
    if (!openCreate) return;
    if (!openCreate.email) { toast.error("Cliente sem email cadastrado."); return; }
    if (!password || password.length < 6) { toast.error("Senha deve ter no mínimo 6 caracteres."); return; }
    setCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-user", {
        body: {
          full_name: openCreate.nome.toUpperCase(),
          email: openCreate.email.toLowerCase(),
          password,
          role: "cliente",
        },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error ?? "Erro ao criar login");

      const newUserId = data.user_id as string;
      const { error: updErr } = await supabase
        .from("clientes")
        .update({ user_id: newUserId })
        .eq("id", openCreate.id);
      if (updErr) throw updErr;

      toast.success("Login criado com sucesso");
      setOpenCreate(null);
      setPassword("");
      qc.invalidateQueries({ queryKey: ["clientes_login_section"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao criar login");
    } finally {
      setCreating(false);
    }
  };

  return (
    <section>
      <h3 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wider">Clientes</h3>
      <div className="border border-border rounded overflow-x-auto">
        <table className="w-full text-xs min-w-[700px]">
          <thead className="bg-secondary/60">
            <tr>
              <th className="text-left px-2.5 py-2 font-semibold">Nome</th>
              <th className="text-left px-2.5 py-2 font-semibold">Email</th>
              <th className="text-center px-2.5 py-2 font-semibold">Login</th>
              <th className="w-48"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={4} className="text-center text-muted-foreground py-4">Carregando…</td></tr>}
            {!isLoading && clientes.length === 0 && <tr><td colSpan={4} className="text-center text-muted-foreground py-4">Nenhum cliente cadastrado.</td></tr>}
            {clientes.map(c => (
              <tr key={c.id} className="border-t border-border hover:bg-secondary/20">
                <td className="px-2.5 py-1.5 font-medium">{c.nome}</td>
                <td className="px-2.5 py-1.5 text-muted-foreground">{c.email ?? "—"}</td>
                <td className="px-2.5 py-1.5 text-center">
                  <span className={`px-2 py-0.5 rounded text-[11px] font-medium ${c.user_id ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}`}>
                    {c.user_id ? "Sim" : "Não"}
                  </span>
                </td>
                <td className="px-2.5 py-1.5 text-center">
                  <div className="flex items-center justify-center gap-3">
                    {!c.user_id ? (
                      <button
                        onClick={() => { setOpenCreate(c); setPassword(""); }}
                        disabled={!c.email}
                        className="text-primary hover:underline text-[11px] flex items-center gap-1 disabled:opacity-40 disabled:no-underline"
                        title={c.email ? "Criar login" : "Cliente sem email"}
                      >
                        <KeyRound size={12} /> Criar Login
                      </button>
                    ) : (
                      <span className="text-[11px] text-muted-foreground">Login ativo</span>
                    )}
                    <a
                      href="/portal/cliente"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-muted-foreground hover:text-foreground text-[11px] flex items-center gap-1"
                      title="Ver portal do cliente"
                    >
                      <ExternalLink size={12} /> Ver Portal
                    </a>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={!!openCreate} onOpenChange={(v) => { if (!v) { setOpenCreate(null); setPassword(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Criar login para {openCreate?.nome}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium">Email</label>
              <input value={openCreate?.email ?? ""} disabled className="w-full h-9 px-2 mt-1 rounded border border-border bg-muted text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium">Senha de acesso *</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full h-9 px-2 mt-1 rounded border border-border bg-background text-sm"
                placeholder="Mínimo 6 caracteres"
                autoCapitalize="none"
                autoCorrect="off"
              />
            </div>
            <p className="text-[10px] text-muted-foreground">O cliente acessará o portal em /portal/cliente com esse email e senha.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setOpenCreate(null); setPassword(""); }}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={creating}>
              {creating ? "Criando…" : "Criar Login"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
};

export default ClientesLoginSection;