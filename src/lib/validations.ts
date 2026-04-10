import { toast } from "sonner";

export const isValidEmail = (email: string): boolean => {
  if (!email) return true; // empty is ok (optional field)
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

export const isNotEmpty = (value: string, fieldName: string): boolean => {
  if (!value.trim()) {
    toast.error(`${fieldName} é obrigatório`);
    return false;
  }
  return true;
};

export const isPositiveNumber = (value: number, fieldName: string): boolean => {
  if (value < 0) {
    toast.error(`${fieldName} não pode ser negativo`);
    return false;
  }
  return true;
};

export const isGreaterThanZero = (value: number, fieldName: string): boolean => {
  if (value <= 0) {
    toast.error(`${fieldName} deve ser maior que zero`);
    return false;
  }
  return true;
};

export const validateEmail = (email: string): boolean => {
  if (email && !isValidEmail(email)) {
    toast.error("E-mail inválido. Verifique o formato (ex: nome@email.com)");
    return false;
  }
  return true;
};
