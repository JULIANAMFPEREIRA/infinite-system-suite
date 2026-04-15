import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "./useEmpresa";
import { useQueryClient } from "@tanstack/react-query";

const DEFAULT_CATEGORIES = [
  // Entradas
  { nome: "RECEBIMENTO DE CLIENTE", tipo: "entrada" },
  { nome: "ENTRADA EXTRA", tipo: "entrada" },
  { nome: "AJUSTE DE CAIXA (ENTRADA)", tipo: "entrada" },
  // Saídas Operacionais
  { nome: "COMPRA DE PRODUTOS", tipo: "saida_operacional" },
  { nome: "SERVIÇOS DE TERCEIROS", tipo: "saida_operacional" },
  { nome: "FRETE", tipo: "saida_operacional" },
  { nome: "IMPOSTOS", tipo: "saida_operacional" },
  { nome: "TAXAS BANCÁRIAS", tipo: "saida_operacional" },
  { nome: "MARKETING / ANÚNCIOS", tipo: "saida_operacional" },
  { nome: "SOFTWARE / ASSINATURAS", tipo: "saida_operacional" },
  // Saídas Financeiras
  { nome: "DESCONTOS CONCEDIDOS", tipo: "saida_financeira" },
  { nome: "JUROS PAGOS", tipo: "saida_financeira" },
  { nome: "AJUSTE DE CAIXA (SAÍDA)", tipo: "saida_financeira" },
  // Saída Especial
  { nome: "RETIRADA PESSOAL (PRÓ-LABORE)", tipo: "saida_especial" },
];

export const useSeedCategorias = () => {
  const empresaId = useEmpresa();
  const qc = useQueryClient();
  const seeded = useRef(false);

  useEffect(() => {
    if (!empresaId || seeded.current) return;
    seeded.current = true;

    (async () => {
      const { data: existing } = await supabase
        .from("categorias")
        .select("nome")
        .eq("empresa_id", empresaId)
        .eq("deletado", false);

      const existingNames = new Set((existing ?? []).map(c => c.nome.toUpperCase()));
      const toInsert = DEFAULT_CATEGORIES.filter(c => !existingNames.has(c.nome));

      if (toInsert.length > 0) {
        await supabase.from("categorias").insert(
          toInsert.map(c => ({ ...c, empresa_id: empresaId }))
        );
        qc.invalidateQueries({ queryKey: ["categorias"] });
      }
    })();
  }, [empresaId, qc]);
};
