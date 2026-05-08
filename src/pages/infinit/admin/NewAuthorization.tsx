import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Trash2, ArrowLeft, Save } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { Textarea } from "@/components/ui/textarea";

type Item = {
  label: string;
  description: string;
};

export default function NewAuthorization() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    title: "",
    client_name: "",
    recipient_name: "",
    recipient_role: "",
  });
  const [items, setItems] = useState<Item[]>([{ label: "", description: "" }]);

  const addItem = () => setItems([...items, { label: "", description: "" }]);
  const removeItem = (index: number) => {
    if (items.length === 1) return;
    setItems(items.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: keyof Item, value: string) => {
    const newItems = [...items];
    newItems[index][field] = value;
    setItems(newItems);
  };

  const generateSlug = (title: string, client: string) => {
    const base = `${client}-${title}`
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
    const random = Math.random().toString(36).substring(2, 6);
    return `${base}-${random}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.client_name || !form.recipient_name || !form.recipient_role) {
      toast.error("Preencha todos os campos obrigatórios.");
      return;
    }
    if (items.some(item => !item.label)) {
      toast.error("Todos os itens precisam de um título.");
      return;
    }

    setLoading(true);
    try {
      const slug = generateSlug(form.title, form.client_name);
      
      const { data: auth, error: authError } = await supabase
        .from("authorizations")
        .insert([{ ...form, slug, status: "pending" }])
        .select()
        .single();

      if (authError) throw authError;

      const itemsToInsert = items.map((item, index) => ({
        authorization_id: auth.id,
        label: item.label,
        description: item.description,
        order_index: index,
      }));

      const { error: itemsError } = await supabase
        .from("authorization_items")
        .insert(itemsToInsert);

      if (itemsError) throw itemsError;

      toast.success("Autorização criada com sucesso!");
      navigate("/admin");
    } catch (error: any) {
      console.error(error);
      toast.error("Erro ao criar autorização: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto py-10 max-w-4xl">
      <div className="mb-8">
        <Button variant="ghost" asChild className="mb-4">
          <Link to="/admin">
            <ArrowLeft className="mr-2 h-4 w-4" /> Voltar ao Painel
          </Link>
        </Button>
        <h1 className="text-3xl font-bold text-gray-900">Nova Autorização</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        <Card>
          <CardHeader>
            <CardTitle>Informações Gerais</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="title">Título da Autorização</Label>
              <Input 
                id="title" 
                placeholder="Ex: Ajustes Administrativos - Maio 2025" 
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="client_name">Nome do Cliente</Label>
              <Input 
                id="client_name" 
                placeholder="Ex: Fundação BA" 
                value={form.client_name}
                onChange={(e) => setForm({ ...form, client_name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="recipient_name">Nome do Destinatário</Label>
              <Input 
                id="recipient_name" 
                placeholder="Ex: Jarbas Bergamaschi" 
                value={form.recipient_name}
                onChange={(e) => setForm({ ...form, recipient_name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="recipient_role">Cargo do Destinatário</Label>
              <Input 
                id="recipient_role" 
                placeholder="Ex: Presidente" 
                value={form.recipient_role}
                onChange={(e) => setForm({ ...form, recipient_role: e.target.value })}
              />
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Itens da Autorização</h2>
            <Button type="button" variant="outline" size="sm" onClick={addItem}>
              <Plus className="mr-2 h-4 w-4" /> Adicionar Item
            </Button>
          </div>

          {items.map((item, index) => (
            <Card key={index} className="relative">
              <CardContent className="pt-6 space-y-4">
                <div className="flex justify-between gap-4">
                  <div className="flex-1 space-y-2">
                    <Label>Título do Item</Label>
                    <Input 
                      placeholder="Ex: Pagamento de Fornecedor X" 
                      value={item.label}
                      onChange={(e) => updateItem(index, "label", e.target.value)}
                    />
                  </div>
                  {items.length > 1 && (
                    <Button 
                      type="button" 
                      variant="ghost" 
                      size="icon" 
                      className="text-red-500 hover:text-red-700 hover:bg-red-50"
                      onClick={() => removeItem(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Descrição Detalhada</Label>
                  <Textarea 
                    placeholder="Descreva o que está sendo autorizado..." 
                    value={item.description}
                    onChange={(e) => updateItem(index, "description", e.target.value)}
                  />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="flex justify-end gap-4">
          <Button variant="outline" type="button" asChild disabled={loading}>
            <Link to="/admin">Cancelar</Link>
          </Button>
          <Button type="submit" className="bg-[#1D9E75] hover:bg-[#157a5a]" disabled={loading}>
            <Save className="mr-2 h-4 w-4" /> {loading ? "Salvando..." : "Salvar Autorização"}
          </Button>
        </div>
      </form>
    </div>
  );
}
