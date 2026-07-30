// ─── Ritmo humano de digitação ────────────────────────────────────────────────
// As clientes reclamavam que as respostas chegavam instantâneas — ninguém
// escreve uma leitura inteira em meio segundo. Aqui fica o cálculo do tempo de
// "digitando..." usado nos dois canais:
//   • chat do dashboard  → pausa real entre as bolhas (client-side)
//   • WhatsApp (Z-API)   → parâmetro delayTyping enviado junto da mensagem
//
// O tempo é proporcional ao tamanho do texto, com uma variação pequena e
// aleatória para que duas mensagens do mesmo tamanho não cheguem no mesmo
// compasso (repetição exata é o que faz parecer máquina).

// ~55 caracteres por segundo é o ritmo de alguém digitando rápido no celular,
// já contando as pausas naturais para pensar.
const CHARS_PER_SECOND = 55;

// Mensagem curta: 2s a 5s. Leitura longa: até 20s.
const MIN_DELAY_MS = 2_000;
const MAX_DELAY_MS = 20_000;

// Z-API aceita no máximo 15 segundos em delayTyping — acima disso o parâmetro
// é ignorado e a mensagem sairia instantânea, justamente o que queremos evitar.
const ZAPI_MAX_TYPING_SECONDS = 15;

// ±15% de variação para o ritmo não soar metronômico.
function jitter(ms: number): number {
  return Math.round(ms * (0.85 + Math.random() * 0.3));
}

/**
 * Tempo de "digitando..." para um texto, em milissegundos.
 * Textos curtos ficam entre 2 e 5 segundos; leituras longas chegam a 20.
 */
export function typingDelayMs(text: string): number {
  const chars = text.trim().length;
  const raw = 1_200 + (chars / CHARS_PER_SECOND) * 1_000;
  const clamped = Math.min(Math.max(raw, MIN_DELAY_MS), MAX_DELAY_MS);
  return jitter(clamped);
}

/**
 * Mesmo cálculo, em segundos inteiros e dentro do teto aceito pela Z-API.
 * Leituras longas ficam nos 15s do teto — é o máximo que o WhatsApp mostra
 * "digitando..." por uma única mensagem.
 */
export function typingDelaySeconds(text: string): number {
  const seconds = Math.round(typingDelayMs(text) / 1_000);
  return Math.min(Math.max(seconds, 2), ZAPI_MAX_TYPING_SECONDS);
}

/**
 * Pausa entre uma bolha e a próxima na mesma resposta — o tempo em que a
 * pessoa do outro lado respira, relê e começa a escrever de novo.
 */
export function pauseBetweenBubblesMs(): number {
  return jitter(650);
}

/** Promise de espera — usada na coreografia do chat. */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
