import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { Lock } from "lucide-react";

export default function InfinitLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      toast.success("Login realizado com sucesso!");
      navigate("/admin");
    } catch (error: any) {
      toast.error("Erro ao realizar login: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="mb-8 flex flex-col items-center">
         <div className="h-16 w-48 bg-gray-200 rounded flex items-center justify-center text-xl text-gray-400 font-bold uppercase tracking-widest border border-dashed mb-2">
            INFINIT
         </div>
         <p className="text-gray-500 font-medium tracking-wide uppercase text-xs">Gestão Interina</p>
      </div>
      
      <Card className="max-w-md w-full shadow-lg border-0">
        <CardHeader className="text-center pb-2">
          <CardTitle className="text-2xl font-bold">Painel Administrativo</CardTitle>
          <CardDescription>Entre com suas credenciais para gerenciar autorizações</CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input 
                id="email" 
                type="email" 
                placeholder="seu@email.com.br" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input 
                id="password" 
                type="password" 
                placeholder="••••••••" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <Button 
              type="submit" 
              className="w-full bg-[#1D9E75] hover:bg-[#157a5a] h-11 text-lg font-semibold" 
              disabled={loading}
            >
              <Lock className="mr-2 h-4 w-4" /> {loading ? "Entrando..." : "Acessar Sistema"}
            </Button>
          </form>
        </CardContent>
      </Card>
      
      <p className="mt-8 text-sm text-gray-400">© {new Date().getFullYear()} INFINIT Network. Todos os direitos reservados.</p>
    </div>
  );
}
