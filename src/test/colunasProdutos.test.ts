import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

/**
 * Guarda de esquema: consultas à tabela `produtos` só podem pedir colunas que existem no banco de produção.
 * Em 13/10/2026 a tela de Pedido de Compra pedia `produtos.codigo` (inexistente) e a lista vinha vazia, em silêncio.
 * Quando uma coluna nova for criada por migration, acrescente-a aqui.
 */
const COLUNAS_PRODUTOS = [
  "id", "empresa_id", "nome", "descricao", "preco_custo", "preco_venda", "estoque_atual", "estoque_minimo",
  "unidade", "categoria_id", "cor", "deletado", "created_at", "updated_at",
  // campos do catálogo do fornecedor (migration 20261013150000)
  "fornecedor_id", "codigo_fornecedor", "marca", "ncm", "ipi_percentual", "preco_lista", "tipo_preco_lista",
  "fator_custo", "custo_ultimo_pedido", "custo_atualizado_em",
];

function arquivos(dir: string): string[] {
  const out: string[] = [];
  for (const nome of readdirSync(dir)) {
    const p = join(dir, nome);
    if (statSync(p).isDirectory()) out.push(...arquivos(p));
    else if (/\.(ts|tsx)$/.test(nome) && !/\.test\./.test(nome) && nome !== "types.ts") out.push(p);
  }
  return out;
}

describe("consultas à tabela produtos", () => {
  const raiz = resolve(__dirname, "..");
  const achados: { arquivo: string; colunas: string[] }[] = [];
  for (const arq of arquivos(raiz)) {
    const src = readFileSync(arq, "utf8");
    for (const m of src.matchAll(/\.from\(\s*["']produtos["']\s*\)\s*\.select\(\s*["'`]([^"'`]+)["'`]/g)) {
      const colunas = m[1].split(",").map(c => c.trim()).filter(c => c && c !== "*" && !c.includes("("));
      achados.push({ arquivo: arq.replace(raiz, "src"), colunas });
    }
  }

  it("encontra as consultas existentes", () => {
    expect(achados.length).toBeGreaterThan(0);
  });

  it("só pedem colunas que existem em produtos", () => {
    for (const a of achados) {
      for (const c of a.colunas) {
        expect(COLUNAS_PRODUTOS, `${a.arquivo} pede produtos.${c}, que não existe no banco`).toContain(c);
      }
    }
  });
});
