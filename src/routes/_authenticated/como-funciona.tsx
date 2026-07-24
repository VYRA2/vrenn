import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/como-funciona")({
  component: ComoFunciona,
});

const SECOES = [
  {
    emoji: "🎯",
    titulo: "O que é o VRENN?",
    conteudo: `O VRENN é uma plataforma de desafios reais com compromisso financeiro. Você define uma meta, coloca um valor em custódia e comprova seu progresso com check-ins. Se cumprir, recebe de volta. Se não cumprir, o valor vai para o fundo de premiação de quem cumpriu.

O VRENN não é um app de apostas — é uma ferramenta de comprometimento. O dinheiro é seu, colocado em custódia para aumentar sua disciplina.`,
  },
  {
    emoji: "⭐",
    titulo: "Como ganhar pontos de reputação",
    conteudo: `Cada ação no VRENN gera pontos automaticamente:

• Fazer um check-in → +5 pts
• Concluir uma meta solo → +50 pts
• Vencer um duelo → +80 pts
• Completar desafio de equipe → +40 pts
• 7 dias seguidos de check-in → +20 pts bônus
• 30 dias seguidos → +100 pts bônus
• 100 dias seguidos → +500 pts bônus

Os pontos definem seu nível: Bronze (0–199), Prata (200–599), Ouro (600–1.499), Diamante (1.500–3.999) e Lenda (4.000+). A progressão é automática.`,
  },
  {
    emoji: "🔥",
    titulo: "O que é o streak e por que importa",
    conteudo: `Streak é a sua sequência de dias consecutivos com check-in. Se você fizer check-in hoje e amanhã, seu streak é 2. Se pular um dia, volta a zero.

Além de ser um indicador de disciplina visível no seu perfil, o streak gera bônus de pontos em marcos: 7, 30 e 100 dias. Quem tem streak alto aparece em destaque no ranking.

Dica: use a justificativa de falta para não quebrar o streak em imprevistos.`,
  },
  {
    emoji: "🏆",
    titulo: "Como funcionam as conquistas",
    conteudo: `Conquistas são desbloqueadas automaticamente quando você atinge marcos no app — sem precisar fazer nada além de usar o VRENN normalmente.

Exemplos:
• 🔥 Faísca — primeiro check-in
• 💪 Rotina de Ferro — 30 dias seguidos
• ⚔️ 1ª Vitória — primeiro duelo vencido
• 📣 Influenciador — 1.000 seguidores + 5.000 curtidas

No seu perfil, conquistas desbloqueadas aparecem coloridas. No perfil de outras pessoas, você vê só as que elas desbloquearam.`,
  },
  {
    emoji: "⚔️",
    titulo: "Como funciona o duelo",
    conteudo: `No duelo, dois usuários se desafiam com um valor em custódia. Cada um coloca o mesmo valor. Ao final do prazo, o resultado segue estas regras:

• Vitória normal: o vencedor recebe 100% da própria custódia + 88% da custódia do rival. Os 12% restantes da custódia do perdedor são divididos em 6% para o VRENN e 6% para o fundo da temporada ativa.
• Empate com sucesso (ambos ≥ 100% de progresso): cada um recebe 100% da própria custódia de volta. Sem taxas.
• Empate sem sucesso (ambos < 100%): cada um perde tudo. 75% de cada custódia vai para o fundo da temporada e 25% para o VRENN.

Durante o duelo, você pode fazer check-ins para registrar progresso. Se a frequência for diária, quem não fizer check-in no dia pode justificar a falta — o oponente aprova ou recusa. Se não justificar e o oponente recusar, você é eliminado da disputa (mas pode continuar fazendo check-ins, só não concorre mais ao prêmio).

Quando o tipo de validação for por foto + árbitro, o resultado é declarado pelo árbitro escolhido pelo criador do duelo — não automaticamente.`,
  },
  {
    emoji: "👥",
    titulo: "Como funcionam os desafios de equipe",
    conteudo: `Desafios de equipe são criados por um admin e abertos para os membros entrarem. Cada participante coloca um valor em custódia. O resultado individual segue estas regras:

• Concluiu o desafio: recebe 97% da custódia de volta. 3% vai para o VRENN.
• Falhou ou foi eliminado: perde o valor total. 75% vai para o pool de prêmios do desafio (distribuído entre os vencedores ao final), 12,5% vai para o fundo da temporada ativa e 12,5% para o VRENN.

Se ninguém concluir o desafio, o pool de prêmios inteiro escoa para o fundo da temporada global — não fica "órfão".

O criador define como o prêmio é distribuído entre os vencedores (proporcional, igualitário ou personalizado), quantas posições são premiadas e o critério de ranking (mais check-ins, maior progresso, maior streak ou primeiro a concluir).

Se a frequência for diária, quem não fizer check-in pode justificar a falta — o admin aprova ou recusa. O motivo fica visível para todos da equipe.`,
  },
  {
    emoji: "⚠️",
    titulo: "Como justificar uma falta",
    conteudo: `Se você não conseguiu fazer check-in num dia e tem frequência diária obrigatória, pode justificar antes das 00h do dia seguinte.

Em metas solo: toque em "Justificar falta de hoje" na página da meta e descreva o motivo. A justificativa é registrada automaticamente — não há aprovação de terceiros.

Em duelos: o oponente recebe a justificativa e tem até as 23h59 para aprovar ou recusar. Se não responder, é recusado automaticamente.

Em desafios de equipe: o admin da equipe aprova ou recusa. O motivo fica visível para todos os membros.`,
  },
  {
    emoji: "💰",
    titulo: "O que acontece com meu dinheiro",
    conteudo: `Seu valor em custódia fica bloqueado enquanto a meta ou desafio está ativo. Ele não sai da sua carteira VRENN — fica reservado.

Meta solo:
• Concluída → 97% de volta para você, 3% para o VRENN.
• Falhada → 0% de volta. 75% vai para o fundo da temporada ativa, 25% para o VRENN.

Duelo:
• Vitória → você recebe 100% próprio + 88% do rival. 6% do rival vai para o fundo da temporada e 6% para o VRENN.
• Empate com sucesso → 100% devolvido para cada um, sem taxas.
• Empate sem sucesso → 75% de cada um vai para o fundo da temporada, 25% para o VRENN.

Desafio de equipe:
• Concluiu → 97% de volta, 3% para o VRENN.
• Falhou/eliminado → 75% vai para o pool de prêmios do desafio, 12,5% para o fundo da temporada e 12,5% para o VRENN.

O fundo da temporada alimenta o prêmio do VRENN Master Season — a competição sazonal da plataforma.`,
  },
  {
    emoji: "📋",
    titulo: "O que é o Desafio Master",
    conteudo: `O Desafio Master é a competição sazonal do VRENN. Um fundo coletivo é alimentado por taxas de duelos e metas ao longo da temporada. Quem participar e cumprir sua meta durante o período concorre ao prêmio acumulado.

O Desafio Master não exige pagamento separado — sua participação nos duelos e metas já alimenta o fundo automaticamente. Você pode entrar na temporada ativa na tela "Desafio Master" do menu.`,
  },
  {
    emoji: "🔒",
    titulo: "Privacidade e segurança",
    conteudo: `Sua motivação privada (o "por quê" da sua meta) só é visível para você. Nunca aparece no feed nem para árbitros.

Sua carteira e histórico financeiro são visíveis só para você.

O perfil pode ser configurado como público ou privado no onboarding ou nas configurações de edição de perfil.

Seus dados nunca são vendidos ou compartilhados com anunciantes. O VRENN não exibe anúncios.`,
  },
];

function ComoFunciona() {
  const navigate = useNavigate();
  const [aberta, setAberta] = useState<number | null>(0);

  return (
    <main className="min-h-screen bg-background text-foreground pb-16">
      <header className="relative mx-auto flex max-w-md items-center justify-center px-5 pt-5 pb-4">
        <button
          onClick={() => navigate({ to: "/configuracoes" })}
          className="absolute left-5 flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card"
        >
          <ArrowLeft size={18} />
        </button>
        <h1 className="text-base font-bold">Central de ajuda</h1>
      </header>

      <div className="mx-auto max-w-md px-4">
        {/* Hero */}
        <div className="mb-6 rounded-2xl border border-primary/30 bg-primary/5 p-5 text-center">
          <div className="text-3xl mb-2">🧠</div>
          <h2 className="text-sm font-bold mb-1">Como o VRENN funciona</h2>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Tudo que você precisa saber para aproveitar ao máximo a plataforma.
          </p>
        </div>

        {/* Acordeão */}
        <div className="space-y-2">
          {SECOES.map((s, i) => {
            const open = aberta === i;
            return (
              <div
                key={i}
                className={`rounded-2xl border transition-colors ${open ? "border-primary/40 bg-primary/5" : "border-border bg-card"}`}
              >
                <button
                  className="flex w-full items-center gap-3 px-4 py-4 text-left"
                  onClick={() => setAberta(open ? null : i)}
                >
                  <span className="text-xl shrink-0">{s.emoji}</span>
                  <span className="flex-1 text-sm font-semibold">{s.titulo}</span>
                  {open
                    ? <ChevronDown size={16} className="shrink-0 text-primary-light" />
                    : <ChevronRight size={16} className="shrink-0 text-muted-foreground" />
                  }
                </button>
                {open && (
                  <div className="px-4 pb-4">
                    <div className="h-px bg-border mb-3" />
                    <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-line">
                      {s.conteudo}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Rodapé */}
        <div className="mt-6 rounded-2xl border border-border bg-card p-4 text-center">
          <p className="text-xs text-muted-foreground">
            Ainda tem dúvidas? Fale com a gente pelo e-mail{" "}
            <a href="mailto:suporte@vrenn.app" className="text-primary-light font-semibold">
              suporte@vrenn.app
            </a>
          </p>
        </div>
      </div>
    </main>
  );
}

