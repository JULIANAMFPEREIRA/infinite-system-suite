

# Atualizar Logos com Arquivos Corretos

## Resumo
Substituir os placeholders de logo atuais pelos arquivos corretos enviados pelo usuario.

## Alteracoes

1. **Favicon** (`public/favicon.png`): Copiar `user-uploads://4.png` (logo preta/transparente) para `public/favicon.png` e atualizar referencia no `index.html` de `.jpeg` para `.png`.

2. **Logo dourada do topo** (`src/assets/logo-gold.png`): Copiar `user-uploads://2_-_Copia_-_Copia.png` para `src/assets/logo-gold.png`. Atualizar import no `TopBar.tsx` de `.jpeg` para `.png`.

3. **Sidebar**: Se a sidebar tambem referencia a logo, atualizar para usar o arquivo correto.

