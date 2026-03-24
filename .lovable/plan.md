

# Reset Visual Completo — INFINIT SYSTEM (Estilo Nomus ERP)

## Resumo

Substituir o tema dark/neon atual por um visual clean, claro e profissional inspirado no padrão Nomus ERP. Dourado da marca como cor de destaque. Tabelas de alta densidade como elemento central. Copiar logos enviadas pelo usuario para posicoes corretas.

---

## Arquivos Afetados

### 1. Paleta de Cores (`src/index.css`)
- **Fundo**: off-white / cinza muito claro (`--background: 0 0% 97%`)
- **Cards**: branco puro (`--card: 0 0% 100%`)
- **Primary**: dourado da marca (`--primary: 43 74% 49%` — tom dourado)
- **Foreground**: cinza escuro para texto (`--foreground: 220 15% 20%`)
- **Bordas**: cinza claro fino (`--border: 220 10% 88%`)
- **Sidebar**: branco ou cinza claríssimo, com borda lateral sutil
- Remover todas as referências a neon, glow, glass, cyan
- Remover utilitários `.neon-text`, `.glow-border`, `.glass`, `.text-gradient`
- Scrollbar com cores claras
- Font-size base menor (13px no body)

### 2. Favicon e Logo no Header (`index.html`, `AppLayout.tsx`, `AppSidebar.tsx`)
- Copiar `user-uploads://4.png` para `public/favicon.png` e referenciar no `index.html`
- Copiar `user-uploads://2 - Copia - Copia.png` para `src/assets/logo-gold.png`
- No `TopBar.tsx`: centralizar a logo dourada no topo
- No `AppSidebar.tsx`: usar a logo dourada menor

### 3. Sidebar (`AppSidebar.tsx`)
- Fundo branco/cinza claro, texto cinza escuro
- Item ativo: destaque dourado (borda lateral ou fundo sutil dourado)
- Remover `glow-border` dos itens ativos
- Tipografia 13px

### 4. TopBar (`TopBar.tsx`)
- Fundo branco, borda inferior cinza fina
- Logo dourada centralizada
- Texto e ícones cinza escuro

### 5. Dashboard (`Dashboard.tsx`)
- Cards com fundo branco, borda cinza fina, sombra sutil
- Remover classes `glass`, `glow-border`, `animate-slide-up`
- Cores dos gráficos: dourado como primário, cinzas como secundários
- Tooltip com fundo branco

### 6. Login (`Login.tsx`)
- Fundo claro (off-white)
- Card branco com borda/sombra sutil
- Botao de login dourado
- Remover efeitos de blur/neon de fundo

### 7. ModulePage (`ModulePage.tsx`)
- Fundo limpo, ícone dourado, sem `bg-primary/10` neon

### 8. Componente de Tabela de Alta Densidade (novo: `src/components/ui/data-table.tsx`)
- Criar componente reutilizavel de tabela densa
- Linhas compactas (h-8), font 12-13px, bordas finas cinzas
- Suporte a **inline editing** (campos editaveis ao clicar)
- Headers com fundo cinza claríssimo

### 9. Modulos com Tabelas Funcionais

**Compras** (`Compras.tsx`):
- Tabela de compras com colunas: Data, Fornecedor, Tipo, Projeto, Item, Qtd, Valor Unit., Total, Status
- Dados mock, inline editing
- Botao "Nova Compra" dourado

**Estoque** (`Estoque.tsx`):
- Aba "Catálogo de Produtos" — alimentado automaticamente por compras
- Aba "Estoque Físico" — controle por serie
- Tabela densa com dados mock

**Fornecedores** (novo: `src/pages/modules/Fornecedores.tsx` + rota):
- Tabela com campo "Tipo" (Fornecedor | Arquiteto)
- Campo "RT (%)" habilitado quando Tipo = Arquiteto
- Inline editing

**Finanças Pessoais** (`FinancasPessoais.tsx`):
- Tabela isolada de gastos pessoais (nao mistura com Compras)
- Colunas: Data, Descricao, Categoria, Valor, Tipo (Receita/Despesa)

### 10. Tailwind Config (`tailwind.config.ts`)
- Remover `darkMode: ["class"]` (sistema agora e light-only)
- Manter estrutura de cores via CSS vars

---

## Detalhes Tecnicos

- Todas as cores mudam via CSS variables no `:root` — nenhuma cor hardcoded nos componentes precisa mudar se usar `text-foreground`, `bg-background`, etc.
- Cores hardcoded nos graficos Recharts (Dashboard) precisam ser atualizadas manualmente para tons dourados/cinza
- O componente `data-table` usara `useState` para gerenciar celulas em edicao (inline editing)
- Arquivos de logo serao copiados dos uploads do usuario

---

## Ordem de Execucao

1. Copiar logos e favicon
2. Reset de cores no `index.css` + `index.html`
3. Atualizar `AppSidebar`, `TopBar`, `AppLayout`
4. Atualizar `Dashboard` e `Login`
5. Criar componente `DataTable` com inline editing
6. Implementar modulos: Compras, Estoque, Fornecedores, Financas Pessoais
7. Atualizar `ModulePage` e demais modulos placeholder

