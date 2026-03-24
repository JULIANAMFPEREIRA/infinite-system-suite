import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff, LogIn, UserPlus } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import logoGold from "@/assets/logo-gold.png";

const Login = () => {
  const navigate = useNavigate();
  const { signIn, signUp } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isSignUp) {
        const { error } = await signUp(email, password, fullName);
        if (error) { toast.error(error.message); return; }
        toast.success("Conta criada! Verifique seu e-mail para confirmar.");
      } else {
        const { error } = await signIn(email, password);
        if (error) { toast.error(error.message); return; }
        navigate("/");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm animate-fade-in">
        <div className="bg-card rounded-lg border border-border shadow-sm p-8 space-y-6">
          <div className="text-center space-y-3">
            <img src={logoGold} alt="INFINIT NETWORK" className="h-16 mx-auto object-contain" />
            <div>
              <h1 className="text-base font-bold text-foreground">INFINIT SYSTEM</h1>
              <p className="text-[11px] text-muted-foreground mt-0.5">Home & Automação</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignUp && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Nome Completo</label>
                <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Seu nome" required
                  className="w-full h-9 px-3 rounded border border-border bg-background text-foreground text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary transition-all" />
              </div>
            )}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">E-mail</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" required
                className="w-full h-9 px-3 rounded border border-border bg-background text-foreground text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary transition-all" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Senha</label>
              <div className="relative">
                <input type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required
                  className="w-full h-9 px-3 pr-9 rounded border border-border bg-background text-foreground text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary transition-all" />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                  {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>
            <button type="submit" disabled={loading}
              className="w-full h-9 rounded bg-primary text-primary-foreground font-semibold text-xs flex items-center justify-center gap-2 hover:brightness-105 transition-all disabled:opacity-50">
              {isSignUp ? <UserPlus size={14} /> : <LogIn size={14} />}
              {loading ? "Aguarde..." : isSignUp ? "Criar Conta" : "Entrar"}
            </button>
          </form>

          <button onClick={() => setIsSignUp(!isSignUp)} className="w-full text-center text-xs text-primary hover:underline">
            {isSignUp ? "Já tenho conta — Entrar" : "Criar uma conta"}
          </button>

          <p className="text-center text-[11px] text-muted-foreground italic">
            "O Senhor é o meu pastor, nada me faltará." — Salmos 23
          </p>
        </div>
        <p className="text-center text-[11px] text-muted-foreground mt-4">© 2026 INFINIT NETWORK — SMP Consultoria LTDA</p>
      </div>
    </div>
  );
};

export default Login;
