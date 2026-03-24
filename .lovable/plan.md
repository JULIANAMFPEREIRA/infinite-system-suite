

# Reativar Tema Dark SaaS — Preservando Estrutura

## Resumo
Trocar a paleta de cores de off-white/clean para dark tecnológico (cinza escuro com azul/ciano), reduzir logo no topo, e manter todos os módulos, tabelas e funcionalidades intactos.

## Alterações

### 1. Paleta Dark (`src/index.css`)
Substituir todas as CSS variables no `:root` por tema escuro:
- `--background`: cinza muito escuro (~222 20% 10%)
- `--foreground`: cinza claro (~220 10% 90%)
- `--card`: cinza escuro com leve contraste (~222 15% 14%)
- `--primary`: azul/ciano tecnológico (~200 80% 55%)
- `--secondary`: cinza médio escuro
- `--border`: cinza escuro sutil
- `--sidebar-background`: cinza escuro (~222 18% 12%)
- Manter `--success`, `--warning`, `--info` com ajustes de contraste
- Scrollbar com cores escuras
- Manter font-size 13px

### 2. TopBar (`src/components/layout/TopBar.tsx`)
- Remover logo centralizada (remover o bloco `absolute left-1/2`)
- Logo já aparece na sidebar — topbar fica funcional (busca + notificações + usuário)

### 3. Sidebar (`src/components/layout/AppSidebar.tsx`)
- Logo no topo: reduzir de `h-9` para `h-7` (máx 28px)
- Cores automaticamente atualizadas pelas CSS vars (bg-card, text-sidebar-foreground)
- Item ativo: usar cor ciano/azul ao invés de dourado

### 4. Dashboard (`src/pages/Dashboard.tsx`)
- Trocar constantes `GOLD` e `GRAY` por azul ciano e cinza
- Atualizar cores dos gráficos (gradientes, pie chart, bar chart)
- Tooltip com fundo escuro
- Grid strokes mais sutis para tema dark

### 5. Login (`src/pages/Login.tsx`)
- Atualizar import de `logo-gold.jpeg` para `logo-gold.png`
- Cores automaticamente via CSS vars (bg-background, bg-card ficam dark)

### 6. Módulos e Tabelas
- Nenhuma alteração estrutural — as tabelas, inline editing e módulos (Compras, Estoque, Fornecedores, Finanças Pessoais) permanecem intactos
- Cores se adaptam automaticamente via CSS vars

## Arquivos Afetados
1. `src/index.css` — paleta dark completa
2. `src/components/layout/TopBar.tsx` — remover logo centralizada
3. `src/components/layout/AppSidebar.tsx` — reduzir logo
4. `src/pages/Dashboard.tsx` — cores dos gráficos para azul/ciano
5. `src/pages/Login.tsx` — fix import .jpeg → .png

## O que NÃO muda
- Estrutura de rotas e módulos
- Componente DataTable e inline editing
- Lógica de permissões
- Banco de dados
- Funcionalidades dos módulos

