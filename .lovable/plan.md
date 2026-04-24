
# Aplicar tema claro profissional (SaaS)

Modificar **apenas** `src/index.css`, trocando os tokens HSL no `:root`. Nenhum `.tsx`, hook, contexto, rota, integração Supabase, `tailwind.config.ts` ou estrutura de layout será alterado. Como todo o sistema consome cores via `hsl(var(--token))`, a troca propaga automaticamente.

## Alterações em `:root`

- `--background`: `220 14% 98%` (#F8F9FA)
- `--foreground`: `222 47% 11%` (#111827)
- `--card`: `0 0% 100%` / `--card-foreground`: `222 47% 11%`
- `--popover`: `0 0% 100%` / `--popover-foreground`: `222 47% 11%`
- `--primary`: `221 83% 53%` (#2563EB) / `--primary-foreground`: `0 0% 100%`
- `--secondary`: `220 14% 96%` / `--secondary-foreground`: `222 47% 11%`
- `--muted`: `220 14% 96%` (#F3F4F6) / `--muted-foreground`: `220 9% 46%` (#6B7280)
- `--accent`: `221 83% 96%` / `--accent-foreground`: `221 83% 53%`
- `--destructive`: `0 72% 51%` (#DC2626) / `--destructive-foreground`: `0 0% 100%`
- `--border`: `220 13% 91%` (#E5E7EB)
- `--input`: `220 13% 91%`
- `--ring`: `221 83% 53%`
- `--success`: `142 71% 45%` (#16A34A)
- `--warning`: `32 95% 44%` (#D97706)
- `--info`: `221 83% 53%`

## Sidebar (fundo branco + borda cinza)

- `--sidebar-background`: `0 0% 100%`
- `--sidebar-foreground`: `222 47% 11%`
- `--sidebar-primary`: `221 83% 53%` / `--sidebar-primary-foreground`: `0 0% 100%`
- `--sidebar-accent`: `220 14% 96%` / `--sidebar-accent-foreground`: `221 83% 53%`
- `--sidebar-border`: `220 13% 91%`
- `--sidebar-ring`: `221 83% 53%`

## Ajustes finos no mesmo arquivo

- Scrollbar: track `#F3F4F6`, thumb `#D1D5DB`, hover `#9CA3AF`.
- `.card-interactive`: trocar `rgba(255,255,255,...)` por sombras suaves escuras (`rgba(0,0,0,0.04)` / `rgba(0,0,0,0.06)`) para funcionar em fundo claro.

## Fora de escopo (não tocar)

- Qualquer `.tsx`, hook, provider, rota.
- `tailwind.config.ts`, `App.css`, `main.tsx`.
- Páginas com classes hardcoded (ex.: `Login.tsx` com `bg-slate-900`) — ficam como estão.
- Banco/Supabase/edge functions.

## Resultado esperado

Visual claro tipo HubSpot/Linear: fundo `#F8F9FA`, cards brancos, sidebar branca com borda `#E5E7EB`, primário azul `#2563EB`, tipografia escura `#111827`, sem alterar comportamento.
