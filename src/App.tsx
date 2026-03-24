import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import AppLayout from "./components/layout/AppLayout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import CRM from "./pages/modules/CRM";
import Projetos from "./pages/modules/Projetos";
import Kits from "./pages/modules/Kits";
import Cronograma from "./pages/modules/Cronograma";
import Estoque from "./pages/modules/Estoque";
import Compras from "./pages/modules/Compras";
import Fornecedores from "./pages/modules/Fornecedores";
import FinanceiroReceber from "./pages/modules/FinanceiroReceber";
import FinanceiroPagar from "./pages/modules/FinanceiroPagar";
import FluxoCaixa from "./pages/modules/FluxoCaixa";
import FinancasPessoais from "./pages/modules/FinancasPessoais";
import Comissoes from "./pages/modules/Comissoes";
import DRE from "./pages/modules/DRE";
import Relatorios from "./pages/modules/Relatorios";
import Automacoes from "./pages/modules/Automacoes";
import Contratos from "./pages/modules/Contratos";
import NotasFiscais from "./pages/modules/NotasFiscais";
import Integracoes from "./pages/modules/Integracoes";
import Auditoria from "./pages/modules/Auditoria";
import Configuracoes from "./pages/modules/Configuracoes";
import ItensComprar from "./pages/modules/ItensComprar";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen bg-background flex items-center justify-center"><div className="text-muted-foreground text-sm">Carregando...</div></div>;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/crm" element={<CRM />} />
              <Route path="/projetos" element={<Projetos />} />
              <Route path="/kits" element={<Kits />} />
              <Route path="/cronograma" element={<Cronograma />} />
              <Route path="/estoque" element={<Estoque />} />
              <Route path="/compras" element={<Compras />} />
              <Route path="/fornecedores" element={<Fornecedores />} />
              <Route path="/itens-comprar" element={<ItensComprar />} />
              <Route path="/financeiro/receber" element={<FinanceiroReceber />} />
              <Route path="/financeiro/pagar" element={<FinanceiroPagar />} />
              <Route path="/financeiro/fluxo" element={<FluxoCaixa />} />
              <Route path="/financas-pessoais" element={<FinancasPessoais />} />
              <Route path="/comissoes" element={<Comissoes />} />
              <Route path="/dre" element={<DRE />} />
              <Route path="/relatorios" element={<Relatorios />} />
              <Route path="/automacoes" element={<Automacoes />} />
              <Route path="/contratos" element={<Contratos />} />
              <Route path="/notas-fiscais" element={<NotasFiscais />} />
              <Route path="/integracoes" element={<Integracoes />} />
              <Route path="/auditoria" element={<Auditoria />} />
              <Route path="/configuracoes" element={<Configuracoes />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
