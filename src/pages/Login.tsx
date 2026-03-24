import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff, LogIn } from "lucide-react";
import logoGold from "@/assets/logo-gold.jpeg";

const Login = () => {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    navigate("/");
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

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">E-mail</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                className="w-full h-9 px-3 rounded border border-border bg-background text-foreground text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary transition-all"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Senha</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full h-9 px-3 pr-9 rounded border border-border bg-background text-foreground text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="w-full h-9 rounded bg-primary text-primary-foreground font-semibold text-xs flex items-center justify-center gap-2 hover:brightness-105 transition-all"
            >
              <LogIn size={14} />
              Entrar
            </button>
          </form>

          <p className="text-center text-[11px] text-muted-foreground italic">
            "O Senhor é o meu pastor, nada me faltará." — Salmos 23
          </p>
        </div>

        <p className="text-center text-[11px] text-muted-foreground mt-4">
          © 2026 INFINIT NETWORK — SMP Consultoria LTDA
        </p>
      </div>
    </div>
  );
};

export default Login;
