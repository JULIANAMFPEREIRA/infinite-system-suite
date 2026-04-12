import { useAuth } from "@/contexts/AuthContext";

/**
 * Controls field-level visibility based on user role.
 * ARQUITETO and FUNCIONARIO cannot see financial values.
 */
export const useFieldVisibility = () => {
  const { roles } = useAuth();

  const isRestricted = roles.some(r => 
    r === "arquiteto" || r === "funcionario"
  );
  const isAdmin = roles.includes("admin");

  return {
    /** Whether user can see monetary values (orçamento, lucro, contas, etc.) */
    canSeeFinancials: !isRestricted || isAdmin,
    /** Whether user can see product prices (custo/venda) */
    canSeePrices: !isRestricted || isAdmin,
    /** Whether user can see quantities (funcionario can, arquiteto cannot) */
    canSeeQuantities: !roles.includes("arquiteto") || isAdmin,
    /** Whether role is restricted from financials */
    isRestrictedRole: isRestricted && !isAdmin,
  };
};
