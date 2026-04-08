import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff, LogIn, UserPlus } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import logoGold from "@/assets/logo-gold.png";
import loginBg from "@/assets/login-bg.jpg";

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
    <div
      className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
      style={{
        backgroundImage: `url(${loginBg})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/30" />

      <div className="w-full max-w-md relative z-10 animate-fade-in flex flex-col items-center">
        {/* Logo above card */}
        <div className="overflow-hidden mb-4" style={{ height: "300px" }}>
          <img src={logoGold} alt="INFINIT NETWORK" className="object-contain" style={{ height: "980px", marginTop: "-340px" }} />
        </div>

        {/* Glass card */}
        <div
          className="rounded-2xl p-10 space-y-7 w-full"
          style={{
            background: "rgba(15, 20, 40, 0.65)",
            backdropFilter: "blur(24px)",
            WebkitBackdropFilter: "blur(24px)",
            border: "1px solid rgba(100, 140, 200, 0.15)",
            boxShadow: "0 8px 48px rgba(0, 0, 0, 0.5), 0 0 80px rgba(56, 140, 220, 0.08)",
          }}
        >
          {/* Title */}
          <div className="text-center">
              <h1 className="text-2xl font-bold tracking-wide text-white">INFINIT SYSTEM</h1>
              <p className="text-sm text-blue-300/70 mt-1">ERP - Home & Automação</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {isSignUp && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-200">Nome Completo</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Seu nome"
                  required
                  className="w-full h-12 px-4 rounded-lg text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                  style={{
                    background: "rgba(20, 28, 50, 0.7)",
                    border: "1px solid rgba(100, 140, 200, 0.2)",
                  }}
                />
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-200">E-mail</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                required
                className="w-full h-12 px-4 rounded-lg text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                style={{
                  background: "rgba(20, 28, 50, 0.7)",
                  border: "1px solid rgba(100, 140, 200, 0.2)",
                }}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-200">Senha</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full h-12 px-4 pr-12 rounded-lg text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                  style={{
                    background: "rgba(20, 28, 50, 0.7)",
                    border: "1px solid rgba(100, 140, 200, 0.2)",
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-12 rounded-lg font-semibold text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50 text-white"
              style={{
                background: "linear-gradient(135deg, hsl(200, 80%, 50%), hsl(210, 85%, 60%))",
                boxShadow: "0 4px 20px rgba(56, 160, 220, 0.3)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "linear-gradient(135deg, hsl(200, 80%, 58%), hsl(210, 85%, 68%))";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "linear-gradient(135deg, hsl(200, 80%, 50%), hsl(210, 85%, 60%))";
              }}
            >
              {isSignUp ? <UserPlus size={18} /> : <LogIn size={18} />}
              {loading ? "Aguarde..." : isSignUp ? "Criar Conta" : "Entrar"}
            </button>
          </form>

          {/* Toggle link */}
          <button
            onClick={() => setIsSignUp(!isSignUp)}
            className="w-full text-center text-sm text-blue-400 hover:text-blue-300 hover:underline transition-colors"
          >
            {isSignUp ? "Já tenho conta — Entrar" : "Criar uma conta"}
          </button>

          {/* Quote */}
          <p className="text-center text-xs text-gray-400 italic leading-relaxed">
            "O Senhor é o meu pastor, nada me faltará."
            <br />
            — Salmos 23
          </p>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-gray-500 mt-5">
          © 2026 INFINIT NETWORK — SMP Consultoria LTDA
        </p>
      </div>
    </div>
  );
};

export default Login;
