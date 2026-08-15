// ─── Numerologia (R$45) — cálculo pitagórico + geração do mapa por IA ────────
// Produto avulso vendido em /numerologia: a cliente paga, informa nome
// completo + data de nascimento, e recebe um mapa numerológico em PDF.
//
// O cálculo dos números é LOCAL e determinístico (numerologia pitagórica
// clássica) — a IA (DeepSeek) escreve os SIGNIFICADOS, não inventa números.
// Mesmo nome+nascimento → sempre os mesmos números (o PDF baixado hoje e
// daqui a 20 dias mostra os MESMOS valores).
//
// Filosofia: NÃO promete vitória em jogos, dinheiro garantido, cura ou
// diagnóstico. Números são guias espirituais — disclaimer obrigatório.

import { deepseekComplete, STRUCTURED_TEMPERATURE } from "@/lib/deepseek";

// ─── Cálculo determinístico ───────────────────────────────────────────────────

// Hash simples e estável (não criptográfico) pra seed determinística
function hashString(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h + s.charCodeAt(i)) & 0x7fffffff;
  }
  return h || 1;
}

// PRNG linear congruencial usando seed
function lcg(seed: number): () => number {
  let cursor = seed;
  return () => {
    cursor = (cursor * 1103515245 + 12345) & 0x7fffffff;
    return cursor;
  };
}

// Pega N números únicos no intervalo [1, max] usando o PRNG
function pickUnique(rng: () => number, count: number, max: number): number[] {
  const set = new Set<number>();
  while (set.size < count) {
    set.add((rng() % max) + 1);
  }
  return Array.from(set).sort((a, b) => a - b);
}

// 6 números da sorte pessoais (1-60), seed = nome+nascimento — estáveis
// pra sempre para a mesma pessoa.
function personalLuckyNumbers(name: string, birthDate: string): number[] {
  const seed = hashString(
    `${name.trim().toLowerCase()}::${birthDate}::${birthDate}`
  );
  return pickUnique(lcg(seed), 6, 60);
}

// Reduz número até 1 dígito (1-9). 0 vira 9 por convenção.
function reduceToDigit(n: number): number {
  while (n > 9) {
    n = String(n)
      .split("")
      .reduce((acc, d) => acc + Number(d), 0);
  }
  return n || 9;
}

// Conversão pitagórica letra → número (A=1, B=2, ... I=9, J=1, ...)
const LETTER_VALUES: Record<string, number> = (() => {
  const m: Record<string, number> = {};
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  for (let i = 0; i < alphabet.length; i++) {
    m[alphabet[i]] = (i % 9) + 1;
  }
  return m;
})();

const VOWELS = new Set(["A", "E", "I", "O", "U"]);

function normalizeName(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // remove acentos
    .toUpperCase()
    .replace(/[^A-Z]/g, ""); // só letras
}

function sumByPredicate(name: string, predicate: (ch: string) => boolean): number {
  const clean = normalizeName(name);
  let sum = 0;
  for (const ch of clean) {
    if (predicate(ch)) {
      sum += LETTER_VALUES[ch] ?? 0;
    }
  }
  return sum;
}

/**
 * Mapa numerológico pessoal — 4 números chave do nome+data de nascimento,
 * pela numerologia pitagórica clássica. Retorna null se os dados não servem.
 */
export function personalNumerology(
  fullName: string,
  birthDate: string
): { destino: number; alma: number; expressao: number; anoPessoal: number } | null {
  if (!fullName || fullName.trim().length < 2) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) return null;

  const [yearStr, monthStr, dayStr] = birthDate.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);
  if (!year || !month || !day) return null;

  // Número do Destino = soma dos dígitos da data de nascimento, reduzida
  const destinoSum =
    String(year).split("").reduce((a, d) => a + Number(d), 0) +
    String(month).split("").reduce((a, d) => a + Number(d), 0) +
    String(day).split("").reduce((a, d) => a + Number(d), 0);

  // Número da Alma = soma das vogais do nome
  const almaSum = sumByPredicate(fullName, (ch) => VOWELS.has(ch));

  // Número de Expressão = soma de todas as letras do nome
  const expressaoSum = sumByPredicate(fullName, () => true);

  // Ano Pessoal = (dia + mês + ano atual) reduzido
  const currentYear = new Date().getUTCFullYear();
  const anoSum =
    day + month + String(currentYear).split("").reduce((a, d) => a + Number(d), 0);

  return {
    destino: reduceToDigit(destinoSum),
    alma: reduceToDigit(almaSum),
    expressao: reduceToDigit(expressaoSum),
    anoPessoal: reduceToDigit(anoSum),
  };
}

// ─── Geração do mapa por IA ───────────────────────────────────────────────────

const SYSTEM = `Você é a voz espiritual acolhedora da ATB, guia de numerologia. Escreva em português brasileiro, linguagem simples, emocional e respeitosa para pessoas adultas. Adapte o tratamento (ela/ele, mesma/mesmo) ao gênero que o nome da pessoa sugere; na dúvida, use frases neutras. Não prometa vitória em jogos de azar, loteria, dinheiro garantido, cura, milagre ou diagnóstico. O conteúdo é espiritual, simbólico, reflexivo e de entretenimento. Use frases curtas e fáceis de entender.`;

export type NumerologiaJson = {
  title: string;
  opening: string;
  numeros: Array<{
    numero: number;
    nome: string; // "Número do Destino", "Número da Alma", ...
    significado: string; // o que esse número revela na vida DELA
    como_usar: string; // datas, decisões, proteção — orientação prática
  }>;
  numeros_da_sorte: number[]; // 6 números pessoais (1-60)
  orientacao_geral: string; // como e quando usar os números no dia a dia
  closing: string;
  disclaimer: string;
};

export type NumerologiaInput = {
  name: string;
  birthDate: string; // "YYYY-MM-DD"
};

/**
 * Gera o mapa numerológico completo: calcula os números localmente
 * (determinístico) e pede à IA os significados/orientações em JSON estrito
 * (com retry reforçando o formato — mesmo padrão de lib/limpeza.ts).
 */
export async function generateNumerologiaReading(input: NumerologiaInput): Promise<{
  json: NumerologiaJson;
  text: string;
  raw: string;
}> {
  const nums = personalNumerology(input.name, input.birthDate);
  if (!nums) {
    throw new Error("Nome ou data de nascimento inválidos pra numerologia");
  }
  const sorte = personalLuckyNumbers(input.name, input.birthDate);

  const userPrompt = `Cliente: ${input.name}
Data de nascimento: ${input.birthDate}

Números calculados pela numerologia pitagórica clássica (NÃO invente outros):
- Número do Destino: ${nums.destino}
- Número da Alma: ${nums.alma}
- Número de Expressão: ${nums.expressao}
- Ano Pessoal: ${nums.anoPessoal}
- Números da sorte pessoais: ${sorte.join(", ")}

Gere um JSON válido com esta estrutura:

{
  "title": "título curto e emocional do mapa numerológico de ${input.name.split(" ")[0]}",
  "opening": "abertura acolhedora usando o primeiro nome, explicando que este mapa nasceu do nome completo e da data de nascimento dela",
  "numeros": [
    { "numero": ${nums.destino}, "nome": "Número do Destino", "significado": "o que o número ${nums.destino} revela sobre o caminho de vida dela", "como_usar": "orientação prática: em que momentos e decisões se apoiar nesse número" },
    { "numero": ${nums.alma}, "nome": "Número da Alma", "significado": "o que o número ${nums.alma} revela sobre o coração e os desejos dela", "como_usar": "orientação prática" },
    { "numero": ${nums.expressao}, "nome": "Número de Expressão", "significado": "o que o número ${nums.expressao} revela sobre os dons e talentos dela", "como_usar": "orientação prática" },
    { "numero": ${nums.anoPessoal}, "nome": "Ano Pessoal", "significado": "a energia do ano atual pra ela segundo o número ${nums.anoPessoal}", "como_usar": "orientação prática pros próximos meses" }
  ],
  "numeros_da_sorte": [${sorte.join(", ")}],
  "orientacao_geral": "como e quando usar os números da sorte no dia a dia: datas importantes, decisões, momentos de proteção — SEM prometer ganhos em jogos ou loteria",
  "closing": "fechamento acolhedor da ATB, convidando a guardar o mapa com carinho",
  "disclaimer": "mensagem curta: orientação espiritual e reflexiva, não substitui aconselhamento profissional, sem garantia de resultados materiais"
}

Limites:
- Máximo 900 palavras no total
- Linguagem simples, frases curtas, tom acolhedor e místico
- Sem promessas absolutas, sem linguagem técnica, sem parecer robô
- Os campos "numero" e "numeros_da_sorte" devem manter EXATAMENTE os valores informados

Responda APENAS com o JSON puro, sem markdown, sem comentários, sem texto antes ou depois.`;

  // Uma tentativa de geração (DeepSeek com temperatura estruturada).
  async function gerarBruto(reforco: boolean): Promise<string> {
    const prompt = reforco
      ? `${userPrompt}\n\nATENÇÃO: a resposta anterior veio fora do formato. Responda SOMENTE com o objeto JSON puro, começando com { e terminando com }, com TODAS as chaves listadas acima preenchidas. Sem markdown, sem crases, sem texto fora do JSON.`
      : userPrompt;
    return deepseekComplete(
      [
        { role: "system", content: SYSTEM },
        { role: "user", content: prompt },
      ],
      { temperature: STRUCTURED_TEMPERATURE }
    );
  }

  // Extrai o objeto JSON mesmo se o modelo cercar com texto/markdown.
  function extrairJson(bruto: string): NumerologiaJson | null {
    const limpo = bruto.replace(/```json|```/g, "").trim();
    const inicio = limpo.indexOf("{");
    const fim = limpo.lastIndexOf("}");
    const candidato =
      inicio >= 0 && fim > inicio ? limpo.slice(inicio, fim + 1) : limpo;
    try {
      const parsed = JSON.parse(candidato) as NumerologiaJson;
      // Campos essenciais: sem eles o mapa não faz sentido.
      if (
        !parsed.title ||
        !parsed.opening ||
        !Array.isArray(parsed.numeros) ||
        parsed.numeros.length < 4
      ) {
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  }

  // Resposta malformada não pode deixar pedido pago sem entrega: tentamos
  // de novo reforçando o formato antes de desistir (padrão de lib/limpeza.ts).
  let raw = await gerarBruto(false);
  let json = extrairJson(raw);
  if (!json) {
    console.warn("[Numerologia] JSON inválido na 1ª tentativa — tentando de novo");
    raw = await gerarBruto(true);
    json = extrairJson(raw);
  }
  if (!json) {
    throw new Error("Resposta da IA com estrutura inválida");
  }

  // REANCORA os números calculados (a IA não manda neles)
  const nomes = [
    "Número do Destino",
    "Número da Alma",
    "Número de Expressão",
    "Ano Pessoal",
  ];
  const valores = [nums.destino, nums.alma, nums.expressao, nums.anoPessoal];
  json.numeros = json.numeros.slice(0, 4).map((n, i) => ({
    numero: valores[i],
    nome: nomes[i],
    significado: n.significado || "Um número de força e proteção no seu caminho.",
    como_usar: n.como_usar || "Guarde este número com carinho nos momentos de decisão.",
  }));
  json.numeros_da_sorte = sorte;
  if (!json.disclaimer) {
    json.disclaimer =
      "Este mapa é uma orientação espiritual e reflexiva. Não substitui aconselhamento profissional e não garante resultados materiais.";
  }

  // Texto único (pra numerologia_readings.full_text / busca / fallback)
  const text = [
    json.title,
    json.opening,
    ...json.numeros.map(
      (n) => `${n.nome}: ${n.numero}\n${n.significado}\nComo usar: ${n.como_usar}`
    ),
    `Seus números da sorte: ${json.numeros_da_sorte.join(", ")}`,
    json.orientacao_geral,
    json.closing,
    json.disclaimer,
  ].join("\n\n");

  return { json, text, raw };
}
