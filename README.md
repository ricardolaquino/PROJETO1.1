# Rapid Vision

Editor visual de projetos de CFTV — Portal das Câmeras.

Este projeto é a migração do editor original (construído no Lovable) para uma
arquitetura própria, sem dependência de plataformas externas de scaffolding.

## Status da migração

Estratégia: mudanças mínimas para desacoplar do Lovable e entregar valor
(app rodando, publicado, com dados) o quanto antes. Refatoração maior (ex.:
trazer `components/ui`/shadcn de volta, quebrar o `PlantaEditor.tsx` em
módulos menores) só quando houver um ganho claro e for pedida — não faz
parte do caminho crítico.

- [x] **Etapa 1** — Esqueleto do projeto (Vite + React + TanStack Router, SPA
      estática, sem `@lovable.dev/*`, sem SSR/Nitro)
- [x] **Etapa 2** — Estilos/tokens de tema migrados (`styles.css`, idêntico ao
      original). `components/ui` (shadcn) e `lib/utils.ts` (`cn()`) **não**
      migrados — confirmado que nenhum arquivo do app os usa; recriar sob
      demanda via shadcn CLI se algum dia for necessário
- [x] **Etapa 3** — Lib de domínio puro migrada (`planta.ts`, `intelbras.ts`) —
      cópia byte-idêntica ao original, validada com type-check isolado
- [x] **Etapa 4** — `PlantaEditor.tsx` migrado — cópia byte-idêntica (1591
      linhas), sem nenhuma alteração de lógica. A rota `/` agora renderiza o
      editor real (antes era só um placeholder de validação)
- [ ] **Etapa 5** — Deploy na infra própria (AWS Amplify — a confirmar)
- [ ] **Etapa 6** — Autenticação + banco de dados (Cognito + DB gerenciado)
- [ ] **Etapa 7** — Substituir telemetria específica do Lovable
      (`lovable-error-reporting.ts`) por algo próprio
- [ ] **Etapa 8** — Melhorias mapeadas na análise original (autosave, undo
      real, BOM estruturado, etc.) — só quando houver pedido/ganho claro

## Stack

- React 19 + TanStack Router (roteamento por código, sem geração de arquivo)
- Vite 6 + `@vitejs/plugin-react`
- Tailwind CSS v4
- TypeScript (strict)
- ESLint (flat config) + Prettier

## Como validar localmente

Neste ambiente de migração não há acesso à internet, então a validação foi
feita com checagem de tipos isolada (arquivos de domínio) e checagem de
sintaxe TS/JSX de todo o código migrado — sem rodar o app de fato. Antes de
seguir para o deploy (Etapa 5), rode localmente para confirmar que sobe
idêntico ao original:

```sh
npm install
npm run dev
```

## Desenvolvimento

```sh
npm install
npm run dev
```

## Build

```sh
npm run build
npm run preview
```
