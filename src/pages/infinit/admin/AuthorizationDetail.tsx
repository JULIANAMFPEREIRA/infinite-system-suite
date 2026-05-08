import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Printer, Copy, CheckCircle2, XCircle, Clock } from "lucide-react";
import { toast } from "sonner";

export default function AuthorizationDetail() {
  const { id } = useParams();

  const { data: authorization, isLoading: isLoadingAuth } = useQuery({
    queryKey: ["authorization", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("authorizations")
        .select(`
          *,
          items:authorization_items(*)
        `)
        .eq("id", id)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const copyLink = () => {
    if (!authorization) return;
    const url = `${window.location.origin}/auth/${authorization.slug}`;
    navigator.clipboard.writeText(url);
    toast.success("Link copiado com sucesso!");
  };

  const handlePrint = () => {
    window.print();
  };

  if (isLoadingAuth) return <div className="container mx-auto py-10 text-center">Carregando...</div>;
  if (!authorization) return <div className="container mx-auto py-10 text-center text-red-500">Autorização não encontrada.</div>;

  return (
    <div className="container mx-auto py-10 max-w-4xl space-y-8 print:p-0">
      <div className="flex justify-between items-center print:hidden">
        <Button variant="ghost" asChild>
          <Link to="/admin">
            <ArrowLeft className="mr-2 h-4 w-4" /> Voltar ao Painel
          </Link>
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" onClick={copyLink}>
            <Copy className="mr-2 h-4 w-4" /> Copiar Link
          </Button>
          <Button variant="outline" onClick={handlePrint}>
            <Printer className="mr-2 h-4 w-4" /> Imprimir / PDF
          </Button>
        </div>
      </div>

      <Card className="print:shadow-none print:border-none">
        <CardHeader className="border-b pb-6">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <CardTitle className="text-2xl">{authorization.title}</CardTitle>
              <CardDescription className="text-lg font-medium text-[#1D9E75]">
                {authorization.client_name}
              </CardDescription>
            </div>
            <Badge variant={authorization.status === "pending" ? "outline" : "default"} className={authorization.status === "responded" ? "bg-[#1D9E75]" : ""}>
              {authorization.status === "pending" ? "Pendente" : "Respondida"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Destinatário</h3>
              <p className="text-lg font-medium">{authorization.recipient_name}</p>
              <p className="text-muted-foreground">{authorization.recipient_role}</p>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Criado em</h3>
              <p>{new Date(authorization.created_at).toLocaleString("pt-BR")}</p>
            </div>
          </div>
          <div className="space-y-4">
            {authorization.responded_at && (
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Respondida em</h3>
                <p>{new Date(authorization.responded_at).toLocaleString("pt-BR")}</p>
              </div>
            )}
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Link Público</h3>
              <p className="text-sm text-blue-600 break-all">{`${window.location.origin}/auth/${authorization.slug}`}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <h2 className="text-xl font-bold">Respostas dos Itens</h2>
        {authorization.items?.sort((a: any, b: any) => a.order_index - b.order_index).map((item: any) => (
          <Card key={item.id} className={item.response === 'rejected' ? 'border-red-200' : ''}>
            <CardContent className="pt-6">
              <div className="flex gap-4 items-start">
                <div className="mt-1">
                  {item.response === "approved" ? (
                    <CheckCircle2 className="h-6 w-6 text-green-500" />
                  ) : item.response === "rejected" ? (
                    <XCircle className="h-6 w-6 text-red-500" />
                  ) : (
                    <Clock className="h-6 w-6 text-gray-400" />
                  )}
                </div>
                <div className="flex-1 space-y-2">
                  <div className="flex justify-between">
                    <h3 className="font-bold text-lg">{item.label}</h3>
                    <Badge variant="secondary">
                      {item.response === "approved" ? "Aprovado" : item.response === "rejected" ? "Reprovado" : "Pendente"}
                    </Badge>
                  </div>
                  {item.description && <p className="text-gray-600">{item.description}</p>}
                  {item.observation && (
                    <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-100">
                      <p className="text-sm font-semibold text-gray-500 mb-1 italic">Observação do Presidente:</p>
                      <p className="text-gray-700">{item.observation}</p>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      
      <div className="hidden print:block mt-20 pt-10 border-t border-gray-200">
         <div className="flex justify-between items-end">
            <div className="text-center w-64">
               <div className="border-t border-gray-400 mt-10 pt-2">
                  <p className="font-bold">{authorization.recipient_name}</p>
                  <p className="text-sm">{authorization.recipient_role}</p>
               </div>
            </div>
            <div className="text-right">
               <p className="text-sm text-gray-500">Documento gerado em {new Date().toLocaleString("pt-BR")}</p>
               <p className="text-sm text-gray-500">INFINIT Network - Gestão Interina</p>
            </div>
         </div>
      </div>
    </div>
  );
}
