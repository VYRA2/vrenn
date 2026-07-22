## Plano: bateria completa de testes fictícios do VRENN

Vou montar três camadas de teste que trabalham juntas: **dados fictícios** (para você navegar num app "cheio"), **testes de fluxo no app** (simulam usuários reais clicando) e **testes das regras do backend** (custódia, prêmios, wallet, RLS). Tudo marcado com uma flag `is_seed` para permitir limpeza total com um clique.

---

### 1. Marcador de "conteúdo fictício" (migração pequena)

Adiciono uma coluna `is_seed boolean default false` nas tabelas que vão receber dados falsos:

- `profiles`, `metas`, `duelos`, `desafios_equipe`, `equipes`, `posts`, `checkins`, `transactions`, `wallets`, `follows`, `notificacoes`

Isso é o que permite apagar depois sem tocar em nada real seu.

---

### 2. Dados fictícios (~200 usuários)

Uma **server function** `POST /api/admin/seed` (protegida — só executa se você estiver logado como `matheus_alcantara`, que já é o admin no app) que gera:

- **200 perfis fictícios** com nomes/usernames/avatares realistas (usando avatars gerados por serviço público), níveis distribuídos (Bronze até Lenda), streaks e reputação variados
- **~500 metas** espalhadas pelas categorias (fitness, saúde, estudos, finanças, hábitos), misturando em_andamento / concluída / falhada
- **~150 duelos** em diferentes status (pendente, ativo, concluído)
- **~30 equipes** com 5-15 membros cada e alguns desafios de equipe ativos
- **~800 posts** no feed (check-ins, conquistas de meta, conquistas de duelo) com curtidas e comentários entre os fictícios
- **Follows cruzados** entre fictícios e você (te seguindo pra sua timeline ficar movimentada)
- **Wallets com saldo simbólico** e transactions coerentes com metas/duelos
- **Notificações** variadas para você ver a sino cheia

Um contador na tela mostra progresso ("Criando perfis 47/200…").

---

### 3. Testes automatizados de fluxo (Playwright)

Scripts em `tests/e2e/` que abrem o app em um navegador de verdade e verificam os caminhos críticos:

- Login/signup + onboarding
- Criar meta (5 steps) → aparece em `/metas`
- Fazer check-in por QR code fake → progresso sobe
- Convidar oponente para duelo → duelo aparece pros dois
- Criar equipe → adicionar desafio → participar
- Curtir/comentar post no feed → notificação chega no outro user
- Wallet: depósito PIX (mock do Asaas) → saldo aumenta → sacar → withdrawal_request criada
- Perfil público de outro usuário → seguir → aparece em "seguindo"
- Configurações: trocar senha, excluir conta

Cada teste captura screenshot em cada passo. No final, um relatório mostra: **X passou / Y falhou** com print do erro.

---

### 4. Testes das regras do backend (Deno test)

Testes em `supabase/functions/*/tests.ts` que rodam sem UI, focados na parte financeira/segurança:

- `create-pix-payment` — chama com valor válido/inválido, verifica resposta
- `asaas-webhook` — simula callback de pagamento confirmado, checa se saldo subiu
- `request-withdrawal` — testa valor abaixo do mínimo, saldo insuficiente, pedido válido
- **Custódia de meta**: cria meta com R$100 → confirma que travou R$100 na wallet → marca como concluída → confirma devolução de R$97 + taxa de R$3 no fundo
- **Custódia de meta falhada**: cria meta R$100 → marca como falhada → confirma R$75 pro fundo + R$25 taxa
- **Duelo vencido**: cria duelo R$50 vs R$50 → conclui com vencedor → confirma que vencedor pegou R$44 de prêmio (88%) + taxa VRENN + fundo
- **RLS**: tenta ler CPF/motivação/valor_custodia de outro usuário → confirma que retorna vazio

---

### 5. Botão de limpeza

Uma segunda server function `POST /api/admin/seed/cleanup` (mesma proteção de admin) que executa:

```
DELETE FROM ... WHERE is_seed = true
```

Em ordem correta (respeitando FKs). No final mostra "X registros apagados" e você fica com o banco no estado original.

---

### Onde tudo isso aparece no app

Uma nova aba dentro de **Configurações → Admin** (só visível pro seu user id) com três botões:

1. **Popular banco com dados fictícios** → chama seed
2. **Rodar testes de fluxo** → dispara Playwright, mostra relatório
3. **Limpar dados fictícios** → cleanup, confirmação antes de apagar

---

### Detalhes técnicos (opcional)

- Seed roda como `supabaseAdmin` (service role) porque precisa criar `auth.users` fictícios via `admin.createUser` — não dá pra usar RLS para gerar 200 usuários
- Playwright já está pré-instalado no ambiente; testes rodam via `deno test` para backend e `playwright test` para e2e
- Cada usuário fictício tem email `seed-{n}@vrenn.test` e senha padrão (só pra permitir login nos testes de fluxo)
- A flag `is_seed` fica com índice parcial pra limpeza ser rápida
- Testes de backend usam um schema de teste isolado ou revertem transações — sem sujar dados reais

---

### O que **não** entra neste plano

- Testes de carga / performance (milhares de usuários simultâneos)
- Testes de segurança avançados (pen-test)
- CI/CD (rodar testes a cada push) — dá pra adicionar depois se quiser

Confirma que é isso e eu implemento tudo em sequência?