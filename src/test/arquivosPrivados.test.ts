import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

/**
 * Regra (C2, 13/10/2026): as pastas de arquivos são privadas. O endereço guardado no banco
 * não abre sozinho; a tela precisa pedir um link temporário (StorageImage, StorageLink,
 * StorageFrame ou resolveStorageUrl). Estes testes impedem que uma tela volte a usar o
 * endereço guardado direto em <img>, <a> ou <iframe>.
 */
const raiz = resolve(__dirname, "..");
const arquivos = (dir: string): string[] =>
  readdirSync(dir).flatMap(n => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? arquivos(p) : p.endsWith(".tsx") ? [p] : [];
  });

describe("Arquivos privados: telas usam link temporário", () => {
  const telas = arquivos(raiz);

  it("nenhuma tela usa o endereço guardado direto em src/href", () => {
    const proibido = /<(img|iframe|a)\b[^>]*\b(src|href)=\{[^}]*\.(url|arquivo_url|publicUrl)\b[^}]*\}/;
    const achados = telas
      .filter(p => !p.endsWith("storage-media.tsx"))
      .filter(p => proibido.test(readFileSync(p, "utf8")))
      .map(p => p.slice(raiz.length + 1));
    expect(achados).toEqual([]);
  });

  it("os envios usam pastas que existem (crm-files ou financeiro-arquivos)", () => {
    const usadas = new Set<string>();
    for (const p of telas) {
      for (const m of readFileSync(p, "utf8").matchAll(/storage\s*\.from\(\s*"([^"]+)"\s*\)/g)) usadas.add(m[1]);
    }
    for (const b of usadas) expect(["crm-files", "financeiro-arquivos"]).toContain(b);
  });
});
