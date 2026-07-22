# Testes automatizados do VRENN

Duas camadas de testes complementam o botão "Popular banco" em Configurações → Admin.

## 1. Testes de fluxo (Playwright — `tests/e2e/`)

Simulam um usuário real navegando o app: login, criar meta, ver feed, wallet.
Cada teste roda contra o dev server (ou o preview URL) em navegador headless e tira print em cada passo.

### Rodar

```bash
# 1. Faça login uma vez no app com o usuário admin (matheus) — o teste usa a mesma sessão
# 2. Popule o banco: Configurações → Admin → Popular banco
# 3. Rode:
python tests/e2e/run_flows.py
```

Screenshots salvos em `tests/e2e/screenshots/`. Relatório final imprime o
número de passos que passaram / falharam.

Pré-requisitos: sessão do Supabase disponível no ambiente (variáveis
`LOVABLE_BROWSER_SUPABASE_*` — automáticas quando você está logado no
preview). Sem sessão, os passos que exigem autenticação são pulados.

## 2. Testes de backend (Deno — `supabase/functions/*/tests.ts`)

Validam a lógica financeira sem UI: custódia de meta, prêmios de duelo,
webhook do Asaas.

### Rodar

Use o botão da UI de Cloud ou (no futuro, via CI):

```bash
deno test --allow-net --allow-env supabase/functions/**/*_test.ts
```

## 3. Dados fictícios (via UI admin)

Criados por `src/lib/admin-seed.functions.ts`. Cada registro carrega
`is_seed=true` e pode ser apagado com um clique no mesmo painel.

- 200 usuários (`seed-N@seed.vrenn.test`, senha padrão)
- ~500 metas distribuídas em status variados
- ~800 posts no feed com curtidas cruzadas
- ~50 duelos em diferentes estados
- Follows: cada seed segue 5-15 outros + segue o admin

**Limpar**: Configurações → Admin → Apagar dados fictícios.
