import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import type { PermissionModule } from "@/hooks/usePermissions";
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
import Orcamentos from "./pages/modules/Orcamentos";
import PortalCliente from "./pages/portal/PortalCliente";
import PortalArquiteto from "./pages/portal/PortalArquiteto";
import NotFound from "./pages/NotFound";
import FormularioCliente from "./pages/FormularioCliente";

const queryClient = new QueryClient();

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen bg-background flex items-center justify-center"><div className="text-muted-foreground text-sm">Carregando...</div></div>;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
};

const RoleRoute = ({ children, allowedRoles }: { children: React.ReactNode; allowedRoles: string[] }) => {
  const { user, roles, loading } = useAuth();
  if (loading) return <div className="min-h-screen bg-background flex items-center justify-center"><div className="text-muted-foreground text-sm">Carregando...</div></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (!roles.some(r => allowedRoles.includes(r))) return <Navigate to="/" replace />;
  return <>{children}</>;
};

const ModuleRoute = ({ children, module }: { children: React.ReactNode; module: PermissionModule }) => {
  const { canView } = usePermissions();
  if (!canView(module)) return <Navigate to="/" replace />;
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
            <Route path="/formulario" element={<FormularioCliente />} />
            {/* Portal routes - no AppLayout */}
            <Route path="/portal/cliente" element={<RoleRoute allowedRoles={["cliente"]}><PortalCliente /></RoleRoute>} />
            <Route path="/portal/arquiteto" element={<RoleRoute allowedRoles={["arquiteto"]}><PortalArquiteto /></RoleRoute>} />
            <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/crm" element={<ModuleRoute module="crm"><CRM /></ModuleRoute>} />
              <Route path="/orcamentos" element={<ModuleRoute module="crm"><Orcamentos /></ModuleRoute>} />
              <Route path="/projetos" element={<ModuleRoute module="projetos"><Projetos /></ModuleRoute>} />
              <Route path="/projetos/:id" element={<ModuleRoute module="projetos"><Projetos /></ModuleRoute>} />
              <Route path="/kits" element={<ModuleRoute module="kits"><Kits /></ModuleRoute>} />
              <Route path="/cronograma" element={<ModuleRoute module="cronograma"><Cronograma /></ModuleRoute>} />
              <Route path="/estoque" element={<ModuleRoute module="estoque"><Estoque /></ModuleRoute>} />
              <Route path="/compras" element={<ModuleRoute module="compras"><Compras /></ModuleRoute>} />
              <Route path="/fornecedores" element={<ModuleRoute module="fornecedores"><Fornecedores /></ModuleRoute>} />
              <Route path="/itens-comprar" element={<ModuleRoute module="compras"><ItensComprar /></ModuleRoute>} />
              <Route path="/financeiro/receber" element={<ModuleRoute module="financeiro"><FinanceiroReceber /></ModuleRoute>} />
              <Route path="/financeiro/pagar" element={<ModuleRoute module="financeiro"><FinanceiroPagar /></ModuleRoute>} />
              <Route path="/financeiro/fluxo" element={<ModuleRoute module="financeiro"><FluxoCaixa /></ModuleRoute>} />
              <Route path="/financas-pessoais" element={<ModuleRoute module="financas_pessoais"><FinancasPessoais /></ModuleRoute>} />
              <Route path="/comissoes" element={<ModuleRoute module="comissoes"><Comissoes /></ModuleRoute>} />
              <Route path="/dre" element={<ModuleRoute module="dre"><DRE /></ModuleRoute>} />
              <Route path="/relatorios" element={<ModuleRoute module="relatorios"><Relatorios /></ModuleRoute>} />
              <Route path="/automacoes" element={<ModuleRoute module="automacoes"><Automacoes /></ModuleRoute>} />
              <Route path="/contratos" element={<ModuleRoute module="contratos"><Contratos /></ModuleRoute>} />
              <Route path="/notas-fiscais" element={<ModuleRoute module="notas_fiscais"><NotasFiscais /></ModuleRoute>} />
              <Route path="/integracoes" element={<ModuleRoute module="integracoes"><Integracoes /></ModuleRoute>} />
              <Route path="/auditoria" element={<ModuleRoute module="auditoria"><Auditoria /></ModuleRoute>} />
              <Route path="/configuracoes" element={<ModuleRoute module="configuracoes"><Configuracoes /></ModuleRoute>} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
