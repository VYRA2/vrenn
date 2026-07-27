## Objetivo

1. Adicionar **subcategorias** ao fluxo de criação de Meta, Duelo e Desafio em Equipe.
2. Habilitar **validação Strava** como método de check-in — só aparece quando a subcategoria for compatível (Corrida, Caminhada, Ciclismo, Natação).
3. Garantir que o **fluxo de check-in Strava** (janela de tempo + GPS, edge function `strava-validate-checkin`) funcione em **todas as telas** que fazem check-in: Meta solo, Duelo, Desafio em Equipe.

Nada de stories nem vínculo post/meta nesta rodada — isso fica pra sessão seguinte, conforme combinado.

---

## 1. Taxonomia de categorias + subcategorias

Arquivo novo `src/lib/categorias.ts` centraliza:

```text
fitness    → musculacao, corrida, caminhada, ciclismo, natacao, calistenia, crossfit, yoga
saude      → meditacao, sono, hidratacao, alimentacao
estudos    → leitura, curso, idioma, redacao
financas   → economia, investimento, orcamento
habitos    → rotina, digital-detox, organizacao
outro      → livre
```

Também exporta helper `subcategoriaSuportaStrava(sub)` que retorna `true` para `corrida | caminhada | ciclismo | natacao`.

Banco: adicionar coluna `subcategoria text` em `metas`, `duelos`, `desafios_equipe` (nullable, sem constraint — usamos strings simples). Migration única.

---

## 2. UI de seleção subcategoria

Componente novo `src/components/SubcategoriaPicker.tsx` (chips scrolláveis) usado em:

- `src/routes/_authenticated/nova-meta.tsx` — depois do passo Categoria, antes do de validação.
- `src/routes/_authenticated/duelos.tsx` (modal de novo duelo).
- `src/routes/_authenticated/equipes.$id.desafio.novo.tsx`.

Salva `subcategoria` no insert de cada tabela.

---

## 3. Strava como método de validação

`src/components/ValidacaoStep.tsx`:

- Estende `TipoValidacao` com `"strava"`.
- Recebe nova prop `subcategoria`.
- Renderiza card "Strava (automático)" **apenas se** `subcategoriaSuportaStrava(subcategoria)`. Caso contrário, esconde o card e, se `tipoValidacao === "strava"`, volta para `qrcode`.
- Card mostra estado da conexão Strava (consulta `strava_connections` do usuário) — se não conectado, botão "Conectar Strava" leva a `/strava-connect`.

Persiste `tipo_validacao = 'strava'` na `metas` (e futuramente duelos/desafios — colunas equivalentes já existem em `metas`; para `duelos` e `desafios_equipe` adiciono `tipo_validacao` na mesma migration se não existir).

---

## 4. Check-in Strava em todas as telas

Extrair `StravaCheckinModal` de `meta.$id.tsx` para arquivo próprio `src/components/StravaCheckinModal.tsx` (props: `refId`, `tipo: 'meta'|'duelo'|'desafio_equipe'`, `userId`, `onClose`, `onCreated`).

Integrar em:

- `src/routes/_authenticated/meta.$id.tsx` — trocar chamada local pelo componente compartilhado; quando `tipo_validacao === 'strava'`, botão de check-in abre `StravaCheckinModal` em vez do `CheckinModal` padrão.
- `src/routes/_authenticated/duelo.$id.tsx` — mesma lógica no botão "Registrar check-in".
- `src/routes/_authenticated/equipes.$id.index.tsx` — no `CheckinDesafioModal`, se o desafio for Strava, redireciona para `StravaCheckinModal`.

Edge function `strava-validate-checkin` já valida janela de 30 min + GPS 500 m e insere na `checkins` com `validado=true`. Ajustes mínimos: aceitar `duelo_id` e `desafio_id` opcionais no body e gravar na coluna correspondente (`checkins.duelo_id`, `checkins.desafio_id`) em vez de sempre `meta_id`. Colunas já existem na tabela.

---

## 5. Testes manuais no final

1. Criar meta Fitness → Corrida → valida com Strava → aparece opção Strava; salva com `tipo_validacao='strava'`.
2. Criar meta Fitness → Musculação → opção Strava **não aparece**.
3. Meta com Strava: botão check-in abre StravaCheckinModal, chama edge function, retorna resultado.
4. Repetir para duelo e desafio em equipe.

---

## Detalhes técnicos

- Migration única: `ALTER TABLE metas/duelos/desafios_equipe ADD COLUMN subcategoria text` + (se faltar) `tipo_validacao text` em `duelos` e `desafios_equipe`.
- `strava-validate-checkin`: adicionar `duelo_id`/`desafio_id` no schema aceito; ao inserir em `checkins`, escolher a coluna certa.
- Nenhuma alteração em RLS/policies existentes.
- Nenhuma alteração em stories ou vínculo post/meta/desafio.
