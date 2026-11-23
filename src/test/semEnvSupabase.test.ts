import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

/**
 * Regra (hospedagem própria): o projeto do banco é um só e vem de
 * src/integrations/supabase/client.ts (SUPABASE_URL e SUPABASE_PUBLISHABLE_KEY).
 * Nenhuma tela pode ler import.meta.env.VITE_SUPABASE_*, senão volta a apontar
 * para outro projeto (como já aconteceu com o projeto antigo).
 */
const raiz = resolve(__dirname, "..");
const arquivos = (dir: string): string[] =>
  readdirSync(dir).flatMap(n => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? arquivos(p) : /\.(ts|tsx)$/.test(p) ? [p] : [];
  });

describe("Projeto Supabase fixo no client.ts", () => {
  it("nenhum arquivo de src usa import.meta.env.VITE_SUPABASE_", () => {
    const proprio = resolve(__filename);
    const infratores = arquivos(raiz)
      .filter(f => resolve(f) !== proprio)
      .filter(f => readFileSync(f, "utf8").includes("import.meta.env.VITE_SUPABASE_"));
    expect(infratores).toEqual([]);
  });
});
