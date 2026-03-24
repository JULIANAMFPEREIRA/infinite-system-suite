import { useAuth } from "@/contexts/AuthContext";

export const useEmpresa = () => {
  const { empresaId } = useAuth();
  return empresaId;
};
