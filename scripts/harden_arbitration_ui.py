from pathlib import Path

path = Path('src/routes/_authenticated/duelo.$id.tsx')
text = path.read_text()

text = text.replace(
"  const usaArbitro = duelo.tipo_validacao === 'foto_arbitro';\n  const podeConvidarArbitro = isOwner && dueloAtivo && usaArbitro && !duelo.arbitro_id;\n  const dueloAtivo = ['ativo', 'em_andamento'].includes(duelo.status);",
"  const usaArbitro = duelo.tipo_validacao === 'foto_arbitro';\n  const dueloAtivo = ['ativo', 'em_andamento'].includes(duelo.status);\n  const aguardandoSorteioArbitro = isOwner && dueloAtivo && usaArbitro && !duelo.arbitro_id;"
)

text = text.replace('{podeConvidarArbitro && (', '{aguardandoSorteioArbitro && (')
text = text.replace('Este duelo usa validação por foto + árbitro. Convide alguém de confiança para declarar o resultado.', 'Este duelo usa foto + árbitro. O sistema sorteia uma pessoa elegível que aceitou atuar como árbitro e não participa deste duelo.')
text = text.replace('Convidar árbitro ⚖️', 'Aguardando sorteio do árbitro ⚖️')
text = text.replace('onClick={() => setShowConvidarArbitro(true)}\n              className=', 'disabled\n              className=')

path.write_text(text)

# Garante que o build detecte referências antigas que não deveriam permanecer.
if 'podeConvidarArbitro' in text:
    raise RuntimeError('referência antiga podeConvidarArbitro ainda presente')
if "const dueloAtivo" not in text:
    raise RuntimeError('dueloAtivo não foi definido')
