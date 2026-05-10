import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, LogOut, ExternalLink } from "lucide-react";
import { toast } from "sonner";

type Authorization = {
  id: string;
  slug: string;
  title: string;
  client_name: string;
  recipient_name: string;
  status: string;
  created_at: string;
};

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [items, setItems] = useState<Authorization[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("authorizations" as any)
      .select("id, slug, title, client_name, recipient_name, status, created_at")
      .order("created_at", { ascending: false });
    if (error) {
      toast.error("Erro ao carregar autorizações");
    } else {
      setItems((data as any) ?? []);
    }
    setLoading(false);
  };

  const logout = async () => {
    await supabase.auth.signOut();
    navigate("/infinit/login");
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Gestão INFINIT Network</h1>
            <p className="text-muted-foreground text-sm">Autorizações administrativas</p>
          </div>
          <div className="flex gap-2">
            <Button asChild>
              <Link to="/infinit/admin/new">
                <Plus className="w-4 h-4 mr-2" /> Nova Autorização
              </Link>
            </Button>
            <Button variant="outline" onClick={logout}>
              <LogOut className="w-4 h-4 mr-2" /> Sair
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Autorizações</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-muted-foreground text-sm">Carregando...</p>
            ) : items.length === 0 ? (
              <p className="text-muted-foreground text-sm">Nenhuma autorização criada ainda.</p>
            ) : (
              <div className="space-y-2">
                {items.map((a) => (
                  <Link
                    key={a.id}
                    to={`/infinit/admin/authorization/${a.id}`}
                    className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent transition"
                  >
                    <div>
                      <div className="font-medium">{a.title}</div>
                      <div className="text-xs text-muted-foreground">
                        {a.client_name} • Para: {a.recipient_name}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs px-2 py-1 rounded bg-muted">{a.status}</span>
                      <ExternalLink className="w-4 h-4 text-muted-foreground" />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}