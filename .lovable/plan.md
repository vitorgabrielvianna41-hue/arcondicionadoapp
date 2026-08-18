## Plano: Melhorias da seção de Orçamentos

Vou implementar 5 blocos de funcionalidades na criação/edição/visualização de orçamentos, mantendo o tema dark + amarelo #FFD700 do app.

---

### 1. Catálogo de Peças e Serviços (reutilizáveis)

**Novo arquivo: `src/lib/catalogo.ts`**
- Tipos `CatalogoPeca` e `CatalogoServico` com: id, nome, descrição (obrigatória), preço, unidade.
- CRUD em `localStorage` (`catalogo_pecas`, `catalogo_servicos`).
- Funções `listPecas/Servicos`, `savePeca/Servico`, `deletePeca/Servico`, `searchCatalogo`.

**Nova rota: `src/routes/catalogo.tsx`**
- Header dark com título "CATÁLOGO DE PEÇAS E SERVIÇOS" + ícone caixa amarelo.
- Abas "PEÇAS" / "SERVIÇOS" no estilo solicitado.
- Cards com borda esquerda amarela: nome, descrição, preço, botões Editar / Adicionar ao orçamento / Excluir.
- Botão flutuante "+ Nova Peça/Serviço" abre modal de cadastro (nome, descrição grande, preço, unidade).
- Quando aberto via `?pick=true` da tela de orçamento, o botão "Adicionar ao orçamento" volta para `/novo` com o item selecionado (via sessionStorage).

**Em `src/routes/novo.tsx`**
- Botão "📦 Catálogo" no header → abre `/catalogo?pick=true`.
- Ao voltar, consome o item escolhido do `sessionStorage` e adiciona à lista correspondente.

---

### 2. Separação Peças × Serviços (CDC Art. 40)

**Em `src/routes/novo.tsx`**
- Refatorar para dois arrays distintos: `pecas[]` (nome, descrição, qtd, unit, valorUnit) e `servicos[]` (nome, descrição, valor).
- Cada item tem campo de **descrição detalhada obrigatório** com aviso vermelho "⚠ Descrição obrigatória por exigência legal" se vazio (bloqueia salvar).
- Dois botões "+ Adicionar Peça" e "+ Adicionar Serviço" no estilo amarelo sobre #2A2200.
- Cada um abre um mini-seletor: buscar no catálogo OU criar manual.
- Totalizador mostra `Subtotal peças`, `Subtotal serviços`, `TOTAL GERAL`.

**Em `src/lib/storage.ts`**
- Estender `Orcamento` com `servicosDetalhados?: Servico[]` (compat retroativo — manter `parts` para peças e ler `servicosDetalhados` quando existir; fallback ao parser de "Serviço:" das observações).

**Em `src/routes/orcamento.$id.tsx`**
- Exibir as duas tabelas separadas com os subtotais e o total geral.

---

### 3. Modal "Personalizar PDF" antes de gerar

**Em `src/lib/oficina-config.ts`** (estender)
- Adicionar campos: `email`, `website`, `corDestaque` (default `#FFD700`), `rodapeTexto`.
- Adicionar opções de PDF: `mostrarValidade`, `mostrarVeiculo`, `mostrarSeparacao`, `mostrarNumeroOS`, `mostrarObservacoes`.

**Novo componente em `src/routes/orcamento.$id.tsx`**: `PdfOrcamentoCustomizeModal`
- Upload de logo (preview, remover, base64 em `oficina_logo_orcamento`).
- Campos: nome, endereço, telefone, CNPJ (com máscara), email, website.
- Grid de 8 cores em círculos clicáveis (amarelo, laranja, azul, verde, rosa, roxo, vermelho, ciano). Selecionado: borda branca 2px + ✓.
- Textarea de rodapé personalizado.
- 5 toggles de opções.
- Botão "Gerar PDF" com a cor escolhida como fundo.

---

### 4. Novo gerador de PDF de Orçamento

**Novo arquivo: `src/lib/orcamento-pdf.ts`**
- Substituir/coexistir com `src/lib/pdf.ts` (manter `gerarTexto` para WhatsApp).
- Layout dark (#0D0D0D) com cor de destaque dinâmica:
  - Header com logo à esquerda e dados da oficina à direita; linha separadora 2px.
  - Card de cliente/veículo com borda esquerda 3px na cor escolhida.
  - **Tabela Peças**: ITEM | DESCRIÇÃO | QTD | UNIT. | SUBTOTAL — header na cor escolhida, linhas alternadas #1A1A1A/#222.
  - **Tabela Serviços**: SERVIÇO | DESCRIÇÃO | VALOR.
  - Card totalizador alinhado à direita com TOTAL GERAL grande na cor escolhida.
  - Observações com borda esquerda na cor escolhida (se toggle ligado).
  - Rodapé com texto customizado + validade (se ligado) + "gerado por OrçaMecânico Pro".
- Nome do arquivo: `orcamento-[PLACA]-[DDMMAAAA]-[OS].pdf`.

**Wire-up em `src/routes/orcamento.$id.tsx`**: botão "Gerar PDF" abre o modal, ao confirmar chama `gerarOrcamentoPDF()`.

---

### 5. Salvamento automático

**Em `src/routes/novo.tsx`**
- `useEffect` com debounce 2s observando todo o form → salva rascunho em `localStorage("orc_draft")`.
- Toast discreto via `sonner` em verde (#4CAF50): "💾 Salvo automaticamente" (durível 2s, posição bottom).
- Ao montar a rota (modo criação, sem `?edit=`): se existir rascunho, mostra modal "Você tem um orçamento não finalizado. Deseja continuar?" com botões "Continuar editando" (#FFD700) e "Descartar" (#FF4444).
- Limpar rascunho ao finalizar/salvar com sucesso.

---

### Navegação
- Adicionar entrada do Catálogo apenas como botão no header de `/novo` (não consumir slot do BottomNav que já tem 6 itens).

### Arquivos tocados (resumo)
- **Novos**: `src/lib/catalogo.ts`, `src/lib/orcamento-pdf.ts`, `src/routes/catalogo.tsx`.
- **Atualizados**: `src/lib/oficina-config.ts`, `src/lib/storage.ts`, `src/routes/novo.tsx`, `src/routes/orcamento.$id.tsx`.

Confirma para eu seguir com a implementação?
