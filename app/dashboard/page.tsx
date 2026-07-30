"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase";
import { useUiLocale, LOCALE_LABELS, type UiLocale } from "@/lib/use-locale";
import {
  typingDelayMs,
  pauseBetweenBubblesMs,
  sleep,
} from "@/lib/human-typing";
import {
  profileSchema,
  type ProfileInput,
  SIGNOS,
  CATEGORIAS_GUIA,
  type CategoriaGuia,
  type Signo,
} from "@/lib/validators";

interface UserProfile {
  id: string;
  email: string;
  nome: string | null;
  signo: string | null;
  data_nascimento: string | null;
  whatsapp: string | null;
}

interface Reading {
  id: string;
  resposta_ia: string;
  enviado_whatsapp: boolean;
  created_at: string;
}

interface Credits {
  leituras_restantes: number;
  mes_referencia: string | null;
}

type TabType = "leitura" | "chat" | "guia" | "perfil" | "historico";

interface ChatMessage {
  id?: string;
  role: "user" | "assistant";
  content: string;
}

type DashboardDict = {
  loading: string;
  logout: string;
  hello: string;
  welcome: string;
  readingsOne: string;
  readingsMany: string;
  inMonth: string;
  profileIncompleteTitle: string;
  profileIncompleteText: string;
  goToProfile: string;
  tabLeitura: string;
  tabChat: string;
  tabGuia: string;
  tabHistorico: string;
  tabPerfil: string;
  leituraTitle: string;
  leituraSubtitle: string;
  perguntaLabel: string;
  perguntaHint: string;
  perguntaPlaceholder: string;
  noCreditsLong: string;
  completeProfileFirst: string;
  consultingCards: string;
  noReadingsBtn: string;
  requestReadingBtn: string;
  yourReading: string;
  sentWhatsapp: string;
  errReading: string;
  errConnection: string;
  chatTitle: string;
  chatSubtitle: string;
  chatCredits: string;
  chatMsgs: string;
  chatEmpty: string;
  chatWelcome: string;
  chatReceiving: string;
  errChat: string;
  chatBuyText: string;
  buy1: string;
  buy3: string;
  buy7: string;
  chatPlaceholder: string;
  send: string;
  guiaTitle: string;
  guiaSubtitle: string;
  guiaNoCredits: string;
  historicoTitle: string;
  historicoEmpty: string;
  verLeitura: string;
  recolher: string;
  whatsappOk: string;
  perfilTitle: string;
  perfilSubtitle: string;
  nomeLabel: string;
  nomePlaceholder: string;
  signoLabel: string;
  signoSelect: string;
  dataLabel: string;
  whatsLabel: string;
  whatsHint: string;
  whatsPlaceholder: string;
  errSaveProfile: string;
  errConnectionShort: string;
  profileSaved: string;
  saving: string;
  saveProfile: string;
  signoLabels: Record<Signo, string>;
  guiaLabels: Record<CategoriaGuia, string>;
};

const DICT: Record<UiLocale, DashboardDict> = {
  "pt-BR": {
    loading: "Consultando os astros...",
    logout: "Sair",
    hello: "Olá",
    welcome: "Bem-vinda(o) ao ATB TAROT",
    readingsOne: "leitura disponível",
    readingsMany: "leituras disponíveis",
    inMonth: "em",
    profileIncompleteTitle: "Complete seu perfil",
    profileIncompleteText:
      "para solicitar leituras. Precisamos do seu nome, signo, data de nascimento e WhatsApp.",
    goToProfile: "Ir para Perfil",
    tabLeitura: "✦ Solicitar Leitura",
    tabChat: "💬 Chat com ATB",
    tabGuia: "🌿 Guia de Vícios",
    tabHistorico: "Histórico",
    tabPerfil: "Meu Perfil",
    leituraTitle: "Consultar ATB",
    leituraSubtitle:
      "ATB irá revelar as cartas do destino especialmente para você e entregar sua leitura no WhatsApp.",
    perguntaLabel: "Pergunta opcional",
    perguntaHint: "(deixe em branco para uma leitura geral)",
    perguntaPlaceholder: "O que você gostaria de perguntar às cartas?",
    noCreditsLong:
      "Você utilizou todas as suas leituras deste mês. Seus créditos renovam automaticamente no início do próximo ciclo.",
    completeProfileFirst: "Complete seu perfil antes de solicitar uma leitura.",
    consultingCards: "ATB está consultando as cartas...",
    noReadingsBtn: "Sem leituras disponíveis este mês",
    requestReadingBtn: "✦ Solicitar Minha Leitura",
    yourReading: "Sua Leitura",
    sentWhatsapp: "Enviada ao WhatsApp",
    errReading: "Erro ao solicitar leitura. Tente novamente.",
    errConnection: "Erro de conexão. Verifique sua internet e tente novamente.",
    chatTitle: "💬 Chat com ATB",
    chatSubtitle: "Converse ao vivo com a ATB e receba os sinais dos guias.",
    chatCredits: "créditos",
    chatMsgs: "msgs no mês",
    chatEmpty: "Envie sua primeira mensagem para a ATB.",
    chatWelcome:
      "Minha querida alma, que alegria te receber aqui... 🌙|||Me conta: o que está pesando no seu coração hoje? Pode falar comigo com toda a confiança.",
    chatReceiving: "✦ ATB está recebendo os sinais...",
    errChat: "Erro ao falar com a ATB. Tente novamente.",
    chatBuyText:
      "Você não tem mensagens disponíveis. Compre perguntas avulsas para continuar conversando com a ATB:",
    buy1: "1 pergunta",
    buy3: "3 perguntas",
    buy7: "7 perguntas",
    chatPlaceholder: "Escreva sua mensagem para a ATB...",
    send: "Enviar",
    guiaTitle: "Guia de Vícios",
    guiaSubtitle:
      "Escolha uma categoria e ATB revelará as cartas para iluminar seu caminho de cura e transformação.",
    guiaNoCredits: "Você utilizou todas as suas leituras deste mês.",
    historicoTitle: "Últimas Leituras",
    historicoEmpty: "Você ainda não tem leituras. Solicite sua primeira!",
    verLeitura: "Ver leitura",
    recolher: "Recolher",
    whatsappOk: "✓ WhatsApp",
    perfilTitle: "Meu Perfil",
    perfilSubtitle:
      "Mantenha seus dados atualizados para que ATB possa personalizar suas leituras com precisão.",
    nomeLabel: "Nome completo",
    nomePlaceholder: "Seu nome",
    signoLabel: "Signo",
    signoSelect: "Selecione seu signo",
    dataLabel: "Data de nascimento",
    whatsLabel: "WhatsApp",
    whatsHint: "(formato internacional: +5511999999999)",
    whatsPlaceholder: "+5511999999999",
    errSaveProfile: "Erro ao salvar perfil.",
    errConnectionShort: "Erro de conexão. Tente novamente.",
    profileSaved: "✓ Perfil atualizado com sucesso!",
    saving: "Salvando...",
    saveProfile: "Salvar Perfil",
    signoLabels: {
      "Áries": "Áries",
      Touro: "Touro",
      "Gêmeos": "Gêmeos",
      "Câncer": "Câncer",
      "Leão": "Leão",
      Virgem: "Virgem",
      Libra: "Libra",
      "Escorpião": "Escorpião",
      "Sagitário": "Sagitário",
      "Capricórnio": "Capricórnio",
      "Aquário": "Aquário",
      Peixes: "Peixes",
    },
    guiaLabels: {
      "Alimentação Emocional": "Alimentação Emocional",
      "Relacionamentos Tóxicos": "Relacionamentos Tóxicos",
      "Procrastinação": "Procrastinação",
      "Vício em Redes Sociais": "Vício em Redes Sociais",
      "Ansiedade Crônica": "Ansiedade Crônica",
      Cigarro: "Cigarro",
      "Álcool": "Álcool",
    },
  },
  en: {
    loading: "Consulting the stars...",
    logout: "Sign out",
    hello: "Hello",
    welcome: "Welcome to ATB TAROT",
    readingsOne: "reading available",
    readingsMany: "readings available",
    inMonth: "in",
    profileIncompleteTitle: "Complete your profile",
    profileIncompleteText:
      "to request readings. We need your name, zodiac sign, date of birth and WhatsApp.",
    goToProfile: "Go to Profile",
    tabLeitura: "✦ Request a Reading",
    tabChat: "💬 Chat with ATB",
    tabGuia: "🌿 Habits Guide",
    tabHistorico: "History",
    tabPerfil: "My Profile",
    leituraTitle: "Consult ATB",
    leituraSubtitle:
      "ATB will reveal the cards of destiny especially for you, dear soul, and deliver your reading on WhatsApp.",
    perguntaLabel: "Optional question",
    perguntaHint: "(leave blank for a general reading)",
    perguntaPlaceholder: "What would you like to ask the cards?",
    noCreditsLong:
      "You have used all your readings for this month. Your credits renew automatically at the start of the next cycle.",
    completeProfileFirst: "Please complete your profile before requesting a reading.",
    consultingCards: "ATB is consulting the cards...",
    noReadingsBtn: "No readings available this month",
    requestReadingBtn: "✦ Request My Reading",
    yourReading: "Your Reading",
    sentWhatsapp: "Sent to WhatsApp",
    errReading: "Could not request the reading. Please try again.",
    errConnection: "Connection error. Please check your internet and try again.",
    chatTitle: "💬 Chat with ATB",
    chatSubtitle: "Talk live with ATB and receive the signs of the guides.",
    chatCredits: "credits",
    chatMsgs: "msgs this month",
    chatEmpty: "Send your first message to ATB.",
    chatWelcome:
      "My dear soul, what a joy to have you here... 🌙|||Tell me: what is weighing on your heart today? You can speak to me in full confidence.",
    chatReceiving: "✦ ATB is receiving the signs...",
    errChat: "Could not reach ATB. Please try again.",
    chatBuyText:
      "You have no messages left. Buy single questions to keep talking with ATB:",
    buy1: "1 question",
    buy3: "3 questions",
    buy7: "7 questions",
    chatPlaceholder: "Write your message to ATB...",
    send: "Send",
    guiaTitle: "Habits Guide",
    guiaSubtitle:
      "Choose a category and ATB will reveal the cards to light your path of healing and transformation.",
    guiaNoCredits: "You have used all your readings for this month.",
    historicoTitle: "Recent Readings",
    historicoEmpty: "You have no readings yet. Request your first one!",
    verLeitura: "View reading",
    recolher: "Hide",
    whatsappOk: "✓ WhatsApp",
    perfilTitle: "My Profile",
    perfilSubtitle:
      "Keep your details up to date so ATB can personalize your readings with precision.",
    nomeLabel: "Full name",
    nomePlaceholder: "Your name",
    signoLabel: "Zodiac sign",
    signoSelect: "Select your sign",
    dataLabel: "Date of birth",
    whatsLabel: "WhatsApp",
    whatsHint: "(international format: +15551234567)",
    whatsPlaceholder: "+15551234567",
    errSaveProfile: "Could not save your profile.",
    errConnectionShort: "Connection error. Please try again.",
    profileSaved: "✓ Profile updated successfully!",
    saving: "Saving...",
    saveProfile: "Save Profile",
    signoLabels: {
      "Áries": "Aries",
      Touro: "Taurus",
      "Gêmeos": "Gemini",
      "Câncer": "Cancer",
      "Leão": "Leo",
      Virgem: "Virgo",
      Libra: "Libra",
      "Escorpião": "Scorpio",
      "Sagitário": "Sagittarius",
      "Capricórnio": "Capricorn",
      "Aquário": "Aquarius",
      Peixes: "Pisces",
    },
    guiaLabels: {
      "Alimentação Emocional": "Emotional Eating",
      "Relacionamentos Tóxicos": "Toxic Relationships",
      "Procrastinação": "Procrastination",
      "Vício em Redes Sociais": "Social Media Addiction",
      "Ansiedade Crônica": "Chronic Anxiety",
      Cigarro: "Smoking",
      "Álcool": "Alcohol",
    },
  },
  es: {
    loading: "Consultando los astros...",
    logout: "Salir",
    hello: "Hola",
    welcome: "Bienvenida(o) a ATB TAROT",
    readingsOne: "lectura disponible",
    readingsMany: "lecturas disponibles",
    inMonth: "en",
    profileIncompleteTitle: "Completa tu perfil",
    profileIncompleteText:
      "para pedir lecturas. Necesitamos tu nombre, signo, fecha de nacimiento y WhatsApp.",
    goToProfile: "Ir al Perfil",
    tabLeitura: "✦ Pedir Lectura",
    tabChat: "💬 Chat con ATB",
    tabGuia: "🌿 Guía de Vicios",
    tabHistorico: "Historial",
    tabPerfil: "Mi Perfil",
    leituraTitle: "Consultar a ATB",
    leituraSubtitle:
      "ATB revelará las cartas del destino especialmente para ti, querida alma, y entregará tu lectura por WhatsApp.",
    perguntaLabel: "Pregunta opcional",
    perguntaHint: "(déjala en blanco para una lectura general)",
    perguntaPlaceholder: "¿Qué te gustaría preguntarle a las cartas?",
    noCreditsLong:
      "Ya usaste todas tus lecturas de este mes. Tus créditos se renuevan automáticamente al inicio del próximo ciclo.",
    completeProfileFirst: "Completa tu perfil antes de pedir una lectura.",
    consultingCards: "ATB está consultando las cartas...",
    noReadingsBtn: "Sin lecturas disponibles este mes",
    requestReadingBtn: "✦ Pedir Mi Lectura",
    yourReading: "Tu Lectura",
    sentWhatsapp: "Enviada al WhatsApp",
    errReading: "Error al pedir la lectura. Inténtalo de nuevo.",
    errConnection: "Error de conexión. Revisa tu internet e inténtalo de nuevo.",
    chatTitle: "💬 Chat con ATB",
    chatSubtitle: "Conversa en vivo con ATB y recibe las señales de los guías.",
    chatCredits: "créditos",
    chatMsgs: "msjs al mes",
    chatEmpty: "Envía tu primer mensaje a ATB.",
    chatWelcome:
      "Querida alma, qué alegría recibirte aquí... 🌙|||Cuéntame: ¿qué pesa en tu corazón hoy? Puedes hablar conmigo con toda confianza.",
    chatReceiving: "✦ ATB está recibiendo las señales...",
    errChat: "Error al hablar con ATB. Inténtalo de nuevo.",
    chatBuyText:
      "No tienes mensajes disponibles. Compra preguntas sueltas para seguir conversando con ATB:",
    buy1: "1 pregunta",
    buy3: "3 preguntas",
    buy7: "7 preguntas",
    chatPlaceholder: "Escribe tu mensaje para ATB...",
    send: "Enviar",
    guiaTitle: "Guía de Vicios",
    guiaSubtitle:
      "Elige una categoría y ATB revelará las cartas para iluminar tu camino de sanación y transformación.",
    guiaNoCredits: "Ya usaste todas tus lecturas de este mes.",
    historicoTitle: "Últimas Lecturas",
    historicoEmpty: "Aún no tienes lecturas. ¡Pide la primera!",
    verLeitura: "Ver lectura",
    recolher: "Ocultar",
    whatsappOk: "✓ WhatsApp",
    perfilTitle: "Mi Perfil",
    perfilSubtitle:
      "Mantén tus datos actualizados para que ATB pueda personalizar tus lecturas con precisión.",
    nomeLabel: "Nombre completo",
    nomePlaceholder: "Tu nombre",
    signoLabel: "Signo",
    signoSelect: "Selecciona tu signo",
    dataLabel: "Fecha de nacimiento",
    whatsLabel: "WhatsApp",
    whatsHint: "(formato internacional: +34612345678)",
    whatsPlaceholder: "+34612345678",
    errSaveProfile: "Error al guardar el perfil.",
    errConnectionShort: "Error de conexión. Inténtalo de nuevo.",
    profileSaved: "✓ ¡Perfil actualizado con éxito!",
    saving: "Guardando...",
    saveProfile: "Guardar Perfil",
    signoLabels: {
      "Áries": "Aries",
      Touro: "Tauro",
      "Gêmeos": "Géminis",
      "Câncer": "Cáncer",
      "Leão": "Leo",
      Virgem: "Virgo",
      Libra: "Libra",
      "Escorpião": "Escorpio",
      "Sagitário": "Sagitario",
      "Capricórnio": "Capricornio",
      "Aquário": "Acuario",
      Peixes: "Piscis",
    },
    guiaLabels: {
      "Alimentação Emocional": "Alimentación Emocional",
      "Relacionamentos Tóxicos": "Relaciones Tóxicas",
      "Procrastinação": "Procrastinación",
      "Vício em Redes Sociais": "Adicción a las Redes Sociales",
      "Ansiedade Crônica": "Ansiedad Crónica",
      Cigarro: "Cigarrillo",
      "Álcool": "Alcohol",
    },
  },
  de: {
    loading: "Die Sterne werden befragt...",
    logout: "Abmelden",
    hello: "Hallo",
    welcome: "Willkommen bei ATB TAROT",
    readingsOne: "Legung verfügbar",
    readingsMany: "Legungen verfügbar",
    inMonth: "im",
    profileIncompleteTitle: "Vervollständige dein Profil",
    profileIncompleteText:
      "um Legungen anzufordern. Wir brauchen deinen Namen, dein Sternzeichen, dein Geburtsdatum und deine WhatsApp-Nummer.",
    goToProfile: "Zum Profil",
    tabLeitura: "✦ Legung anfordern",
    tabChat: "💬 Chat mit ATB",
    tabGuia: "🌿 Hilfe bei Gewohnheiten",
    tabHistorico: "Verlauf",
    tabPerfil: "Mein Profil",
    leituraTitle: "ATB befragen",
    leituraSubtitle:
      "ATB wird die Karten des Schicksals nur für dich enthüllen, meine liebe Seele, und dir deine Legung per WhatsApp senden.",
    perguntaLabel: "Optionale Frage",
    perguntaHint: "(leer lassen für eine allgemeine Legung)",
    perguntaPlaceholder: "Was möchtest du die Karten fragen?",
    noCreditsLong:
      "Du hast alle deine Legungen für diesen Monat genutzt. Dein Guthaben erneuert sich automatisch zu Beginn des nächsten Zyklus.",
    completeProfileFirst:
      "Bitte vervollständige dein Profil, bevor du eine Legung anforderst.",
    consultingCards: "ATB befragt die Karten...",
    noReadingsBtn: "Diesen Monat keine Legungen verfügbar",
    requestReadingBtn: "✦ Meine Legung anfordern",
    yourReading: "Deine Legung",
    sentWhatsapp: "Per WhatsApp gesendet",
    errReading:
      "Die Legung konnte nicht angefordert werden. Bitte versuche es noch einmal.",
    errConnection:
      "Verbindungsfehler. Bitte prüfe deine Internetverbindung und versuche es noch einmal.",
    chatTitle: "💬 Chat mit ATB",
    chatSubtitle:
      "Sprich live mit ATB und empfange die Zeichen der geistigen Führer.",
    chatCredits: "Guthaben",
    chatMsgs: "Nachrichten im Monat",
    chatEmpty: "Sende deine erste Nachricht an ATB.",
    chatWelcome:
      "Meine liebe Seele, wie schön, dass du hier bist... 🌙|||Erzähl mir: Was liegt dir heute auf dem Herzen? Du kannst ganz offen mit mir sprechen.",
    chatReceiving: "✦ ATB empfängt die Zeichen...",
    errChat: "ATB konnte nicht erreicht werden. Bitte versuche es noch einmal.",
    chatBuyText:
      "Du hast keine Nachrichten mehr. Kaufe einzelne Fragen, um weiter mit ATB zu sprechen:",
    buy1: "1 Frage",
    buy3: "3 Fragen",
    buy7: "7 Fragen",
    chatPlaceholder: "Schreibe deine Nachricht an ATB...",
    send: "Senden",
    guiaTitle: "Hilfe bei Gewohnheiten",
    guiaSubtitle:
      "Wähle einen Bereich, und ATB enthüllt die Karten, um deinen Weg der Heilung und Verwandlung zu erleuchten.",
    guiaNoCredits: "Du hast alle deine Legungen für diesen Monat genutzt.",
    historicoTitle: "Letzte Legungen",
    historicoEmpty: "Du hast noch keine Legungen. Fordere deine erste an!",
    verLeitura: "Legung ansehen",
    recolher: "Einklappen",
    whatsappOk: "✓ WhatsApp",
    perfilTitle: "Mein Profil",
    perfilSubtitle:
      "Halte deine Daten aktuell, damit ATB deine Legungen ganz genau auf dich abstimmen kann.",
    nomeLabel: "Vollständiger Name",
    nomePlaceholder: "Dein Name",
    signoLabel: "Sternzeichen",
    signoSelect: "Wähle dein Sternzeichen",
    dataLabel: "Geburtsdatum",
    whatsLabel: "WhatsApp",
    whatsHint: "(internationales Format: +491701234567)",
    whatsPlaceholder: "+491701234567",
    errSaveProfile: "Dein Profil konnte nicht gespeichert werden.",
    errConnectionShort: "Verbindungsfehler. Bitte versuche es noch einmal.",
    profileSaved: "✓ Profil erfolgreich aktualisiert!",
    saving: "Wird gespeichert...",
    saveProfile: "Profil speichern",
    signoLabels: {
      "Áries": "Widder",
      Touro: "Stier",
      "Gêmeos": "Zwillinge",
      "Câncer": "Krebs",
      "Leão": "Löwe",
      Virgem: "Jungfrau",
      Libra: "Waage",
      "Escorpião": "Skorpion",
      "Sagitário": "Schütze",
      "Capricórnio": "Steinbock",
      "Aquário": "Wassermann",
      Peixes: "Fische",
    },
    guiaLabels: {
      "Alimentação Emocional": "Emotionales Essen",
      "Relacionamentos Tóxicos": "Toxische Beziehungen",
      "Procrastinação": "Ständiges Aufschieben",
      "Vício em Redes Sociais": "Social-Media-Sucht",
      "Ansiedade Crônica": "Chronische Angst",
      Cigarro: "Rauchen",
      "Álcool": "Alkohol",
    },
  },
  it: {
    loading: "Consultando le stelle...",
    logout: "Esci",
    hello: "Ciao",
    welcome: "Benvenuta(o) in ATB TAROT",
    readingsOne: "lettura disponibile",
    readingsMany: "letture disponibili",
    inMonth: "in",
    profileIncompleteTitle: "Completa il tuo profilo",
    profileIncompleteText:
      "per richiedere le letture. Ci servono il tuo nome, il tuo segno, la tua data di nascita e il tuo WhatsApp.",
    goToProfile: "Vai al Profilo",
    tabLeitura: "✦ Richiedi una Lettura",
    tabChat: "💬 Chat con ATB",
    tabGuia: "🌿 Guida ai Vizi",
    tabHistorico: "Storico",
    tabPerfil: "Il Mio Profilo",
    leituraTitle: "Consulta ATB",
    leituraSubtitle:
      "ATB rivelerà le carte del destino apposta per te, anima cara, e ti consegnerà la lettura su WhatsApp.",
    perguntaLabel: "Domanda facoltativa",
    perguntaHint: "(lascia in bianco per una lettura generale)",
    perguntaPlaceholder: "Cosa vorresti chiedere alle carte?",
    noCreditsLong:
      "Hai usato tutte le letture di questo mese. I tuoi crediti si rinnovano automaticamente all'inizio del prossimo ciclo.",
    completeProfileFirst:
      "Completa il tuo profilo prima di richiedere una lettura.",
    consultingCards: "ATB sta consultando le carte...",
    noReadingsBtn: "Nessuna lettura disponibile questo mese",
    requestReadingBtn: "✦ Richiedi la Mia Lettura",
    yourReading: "La Tua Lettura",
    sentWhatsapp: "Inviata su WhatsApp",
    errReading: "Errore nella richiesta della lettura. Riprova.",
    errConnection: "Errore di connessione. Controlla la tua internet e riprova.",
    chatTitle: "💬 Chat con ATB",
    chatSubtitle: "Parla dal vivo con ATB e ricevi i segni delle guide.",
    chatCredits: "crediti",
    chatMsgs: "msg al mese",
    chatEmpty: "Invia il tuo primo messaggio ad ATB.",
    chatWelcome:
      "Anima cara, che gioia averti qui... 🌙|||Raccontami: cosa ti pesa sul cuore oggi? Puoi parlarmi con tutta fiducia.",
    chatReceiving: "✦ ATB sta ricevendo i segni...",
    errChat: "Errore nel parlare con ATB. Riprova.",
    chatBuyText:
      "Non hai più messaggi disponibili. Acquista domande singole per continuare a parlare con ATB:",
    buy1: "1 domanda",
    buy3: "3 domande",
    buy7: "7 domande",
    chatPlaceholder: "Scrivi il tuo messaggio per ATB...",
    send: "Invia",
    guiaTitle: "Guida ai Vizi",
    guiaSubtitle:
      "Scegli una categoria e ATB rivelerà le carte per illuminare il tuo cammino di guarigione e trasformazione.",
    guiaNoCredits: "Hai usato tutte le letture di questo mese.",
    historicoTitle: "Ultime Letture",
    historicoEmpty: "Non hai ancora letture. Richiedi la prima!",
    verLeitura: "Vedi lettura",
    recolher: "Nascondi",
    whatsappOk: "✓ WhatsApp",
    perfilTitle: "Il Mio Profilo",
    perfilSubtitle:
      "Tieni i tuoi dati aggiornati così ATB potrà personalizzare le tue letture con precisione.",
    nomeLabel: "Nome completo",
    nomePlaceholder: "Il tuo nome",
    signoLabel: "Segno zodiacale",
    signoSelect: "Seleziona il tuo segno",
    dataLabel: "Data di nascita",
    whatsLabel: "WhatsApp",
    whatsHint: "(formato internazionale: +393331234567)",
    whatsPlaceholder: "+393331234567",
    errSaveProfile: "Errore nel salvare il profilo.",
    errConnectionShort: "Errore di connessione. Riprova.",
    profileSaved: "✓ Profilo aggiornato con successo!",
    saving: "Salvataggio in corso...",
    saveProfile: "Salva Profilo",
    signoLabels: {
      "Áries": "Ariete",
      Touro: "Toro",
      "Gêmeos": "Gemelli",
      "Câncer": "Cancro",
      "Leão": "Leone",
      Virgem: "Vergine",
      Libra: "Bilancia",
      "Escorpião": "Scorpione",
      "Sagitário": "Sagittario",
      "Capricórnio": "Capricorno",
      "Aquário": "Acquario",
      Peixes: "Pesci",
    },
    guiaLabels: {
      "Alimentação Emocional": "Fame Emotiva",
      "Relacionamentos Tóxicos": "Relazioni Tossiche",
      "Procrastinação": "Procrastinazione",
      "Vício em Redes Sociais": "Dipendenza dai Social",
      "Ansiedade Crônica": "Ansia Cronica",
      Cigarro: "Fumo",
      "Álcool": "Alcol",
    },
  },
};

export default function DashboardPage() {
  const router = useRouter();
  const [locale, setLocale] = useUiLocale();
  const t = DICT[locale];
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [credits, setCredits] = useState<Credits>({ leituras_restantes: 0, mes_referencia: null });
  const [readings, setReadings] = useState<Reading[]>([]);
  const [activeTab, setActiveTab] = useState<TabType>("leitura");
  const [loading, setLoading] = useState(true);
  const [requestingReading, setRequestingReading] = useState(false);
  const [readingResult, setReadingResult] = useState<string | null>(null);
  const [readingError, setReadingError] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState(false);
  const [profileApiError, setProfileApiError] = useState<string | null>(null);
  const [expandedReading, setExpandedReading] = useState<string | null>(null);
  const [pergunta, setPergunta] = useState("");
  const [guiaLoading, setGuiaLoading] = useState(false);
  const [guiaResult, setGuiaResult] = useState<string | null>(null);
  const [guiaError, setGuiaError] = useState<string | null>(null);
  const [guiaCategoria, setGuiaCategoria] = useState<CategoriaGuia | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatSending, setChatSending] = useState(false);
  const [chatRemaining, setChatRemaining] = useState<number | null>(null);
  const [chatUsingCredits, setChatUsingCredits] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [chatLoaded, setChatLoaded] = useState(false);
  // "digitando..." da ATB entre as bolhas (coreografia humana)
  const [atbTyping, setAtbTyping] = useState(false);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  // Rola a conversa para o fim a cada bolha nova / indicador de digitação
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [chatMessages, atbTyping]);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ProfileInput>({
    resolver: zodResolver(profileSchema),
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [profileRes, creditsRes, readingsRes] = await Promise.all([
        fetch("/api/profile"),
        fetch("/api/credits"),
        fetch("/api/readings/history").catch(() => null),
      ]);

      if (profileRes.ok) {
        const profileData = (await profileRes.json()) as { profile: UserProfile | null };
        if (profileData.profile) {
          setProfile(profileData.profile);
          reset({
            nome: profileData.profile.nome ?? "",
            signo: (profileData.profile.signo as ProfileInput["signo"]) ?? undefined,
            data_nascimento: profileData.profile.data_nascimento ?? "",
            whatsapp: profileData.profile.whatsapp ?? "",
          });
        }
      }

      if (creditsRes.ok) {
        const creditsData = (await creditsRes.json()) as Credits;
        setCredits(creditsData);
      }

      if (readingsRes?.ok) {
        const readingsData = (await readingsRes.json()) as { readings: Reading[] };
        setReadings(readingsData.readings ?? []);
      }
    } catch (err) {
      console.error("Erro ao carregar dashboard:", err);
    } finally {
      setLoading(false);
    }
  }, [reset]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function handleRequestReading() {
    setRequestingReading(true);
    setReadingResult(null);
    setReadingError(null);

    try {
      const res = await fetch("/api/readings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pergunta: pergunta.trim() || undefined }),
      });

      const data = (await res.json()) as {
        success?: boolean;
        reading?: string;
        leituras_restantes?: number;
        error?: string;
      };

      if (!res.ok || !data.success) {
        setReadingError(data.error ?? t.errReading);
        return;
      }

      setReadingResult(data.reading ?? null);
      setCredits((prev) => ({
        ...prev,
        leituras_restantes: data.leituras_restantes ?? prev.leituras_restantes - 1,
      }));
      setPergunta("");

      // Recarregar histórico
      setTimeout(() => fetchData(), 1500);
    } catch {
      setReadingError(t.errConnection);
    } finally {
      setRequestingReading(false);
    }
  }

  async function onProfileSubmit(data: ProfileInput) {
    setSavingProfile(true);
    setProfileSuccess(false);
    setProfileApiError(null);

    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const result = (await res.json()) as {
        success?: boolean;
        error?: string;
        details?: Array<{ field: string; message: string }>;
      };

      if (!res.ok) {
        setProfileApiError(result.error ?? t.errSaveProfile);
        return;
      }

      setProfileSuccess(true);
      setTimeout(() => setProfileSuccess(false), 3000);
      fetchData();
    } catch {
      setProfileApiError(t.errConnectionShort);
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleGuiaVicios(categoria: CategoriaGuia) {
    setGuiaLoading(true);
    setGuiaResult(null);
    setGuiaError(null);
    setGuiaCategoria(categoria);

    try {
      const res = await fetch("/api/guia-vicios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categoria }),
      });

      const data = (await res.json()) as {
        success?: boolean;
        reading?: string;
        leituras_restantes?: number;
        error?: string;
      };

      if (!res.ok || !data.success) {
        setGuiaError(data.error ?? t.errReading);
        return;
      }

      setGuiaResult(data.reading ?? null);
      setCredits((prev) => ({
        ...prev,
        leituras_restantes: data.leituras_restantes ?? prev.leituras_restantes - 1,
      }));

      setTimeout(() => fetchData(), 1500);
    } catch {
      setGuiaError(t.errConnection);
    } finally {
      setGuiaLoading(false);
    }
  }

  const loadChat = useCallback(async () => {
    try {
      const res = await fetch("/api/chat");
      if (!res.ok) return;
      const data = (await res.json()) as {
        messages?: ChatMessage[];
        remaining?: number;
        usingCredits?: boolean;
      };
      setChatMessages(data.messages ?? []);
      setChatRemaining(data.remaining ?? 0);
      setChatUsingCredits(!!data.usingCredits);
      setChatLoaded(true);
    } catch {
      // silencioso — a aba mostra estado vazio
    }
  }, []);

  useEffect(() => {
    if (activeTab === "chat" && !chatLoaded) {
      loadChat();
    }
  }, [activeTab, chatLoaded, loadChat]);

  async function handleSendChat() {
    const message = chatInput.trim();
    if (!message || chatSending) return;

    setChatSending(true);
    setChatError(null);
    setChatInput("");
    setChatMessages((prev) => [...prev, { role: "user", content: message }]);
    setAtbTyping(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        setChatError(data?.error ?? t.errChat);
        // remove a mensagem otimista
        setChatMessages((prev) => prev.slice(0, -1));
        return;
      }

      // Lê o stream inteiro em silêncio (a ATB "está digitando") e depois
      // revela bolha por bolha, como uma pessoa de verdade no WhatsApp:
      // digitando... → mensagem curta → digitando... → próxima mensagem.
      let full = "";
      const reader = res.body?.getReader();
      if (reader) {
        const decoder = new TextDecoder();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          full += decoder.decode(value, { stream: true });
        }
      }

      const bubbles = full
        .split("|||")
        .map((b) => b.trim())
        .filter(Boolean);

      setChatMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      for (let k = 0; k < bubbles.length; k++) {
        // "digitando..." pelo tempo que a ATB levaria para escrever esta bolha
        setAtbTyping(true);
        await sleep(typingDelayMs(bubbles[k]));
        const revealed = bubbles.slice(0, k + 1).join("|||");
        setAtbTyping(false);
        setChatMessages((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          if (last?.role === "assistant") {
            next[next.length - 1] = { ...last, content: revealed };
          }
          return next;
        });
        // ela respira, relê e começa a escrever a próxima
        if (k < bubbles.length - 1) await sleep(pauseBetweenBubblesMs());
      }

      setChatRemaining((prev) =>
        typeof prev === "number" ? Math.max(0, prev - 1) : prev
      );
    } catch {
      setChatError(t.errConnection);
    } finally {
      setAtbTyping(false);
      setChatSending(false);
    }
  }

  async function handleLogout() {
    const supabase = createBrowserSupabaseClient();
    await supabase.auth.signOut();
    router.replace("/login");
  }

  const profileComplete =
    profile?.nome && profile?.signo && profile?.data_nascimento && profile?.whatsapp;

  if (loading) {
    return (
      <main className="min-h-screen bg-mystic-gradient stars-bg flex items-center justify-center">
        <div className="text-center">
          <div className="text-5xl animate-float mb-4">🔮</div>
          <p className="text-[#c9a84c] font-serif text-lg">{t.loading}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#0a0a0a] stars-bg">
      {/* ── HEADER ─────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-[#0a0a0a]/90 backdrop-blur-md border-b border-[#2a2a2a] px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="font-serif text-lg">
            <span className="gold-gradient-text font-bold">ATB</span>
            <span className="text-[#e8e0d0] ml-1">TAROT</span>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            {(Object.keys(LOCALE_LABELS) as UiLocale[]).map((l) => (
              <button
                key={l}
                onClick={() => setLocale(l)}
                aria-label={LOCALE_LABELS[l]}
                className={`px-3 py-2 rounded-lg border text-sm font-semibold transition-colors ${
                  locale === l
                    ? "border-[#c9a84c] text-[#c9a84c] bg-[#c9a84c]/10"
                    : "border-[#3a3a3a] text-[#b5ab97] hover:text-[#c9a84c]"
                }`}
              >
                {l === "pt-BR" ? "PT" : l.toUpperCase()}
              </button>
            ))}
            <span className="text-[#aca189] text-base hidden sm:block">
              {profile?.email}
            </span>
            <button
              onClick={handleLogout}
              className="text-[#aca189] hover:text-[#c2b9a4] text-base transition-colors"
            >
              {t.logout}
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* ── BOAS-VINDAS + CRÉDITOS ──────────────────────────────────────── */}
        <div className="mystic-card p-6 mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="font-serif text-2xl text-[#c9a84c] mb-1">
              {profile?.nome ? `${t.hello}, ${profile.nome}` : t.welcome}
            </h1>
            <p className="text-[#b5ab97] text-base">
              {profile?.signo &&
                `✦ ${t.signoLabels[profile.signo as Signo] ?? profile.signo}`}
              {profile?.signo && profile?.data_nascimento && " · "}
              {profile?.data_nascimento &&
                new Date(profile.data_nascimento).toLocaleDateString(locale, {
                  day: "2-digit",
                  month: "long",
                  year: "numeric",
                })}
            </p>
          </div>
          <div className="text-center sm:text-right">
            <div className="text-3xl font-serif gold-gradient-text font-bold">
              {credits.leituras_restantes}
            </div>
            <div className="text-[#b5ab97] text-base">
              {credits.leituras_restantes === 1 ? t.readingsOne : t.readingsMany}
              {credits.mes_referencia && (
                <span className="block text-[#a39878]">
                  {t.inMonth} {credits.mes_referencia}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Aviso de perfil incompleto */}
        {!profileComplete && (
          <div className="bg-[#c9a84c]/10 border border-[#c9a84c]/30 rounded-lg p-4 mb-6">
            <p className="text-[#c9a84c] text-base">
              <strong>{t.profileIncompleteTitle}</strong> {t.profileIncompleteText}{" "}
              <button
                className="underline"
                onClick={() => setActiveTab("perfil")}
              >
                {t.goToProfile}
              </button>
            </p>
          </div>
        )}

        {/* ── TABS ───────────────────────────────────────────────────────── */}
        <div className="flex gap-1 mb-8 bg-[#111111] p-1 rounded-lg border border-[#2a2a2a]">
          {(
            [
              { id: "leitura", label: t.tabLeitura },
              { id: "chat", label: t.tabChat },
              { id: "guia", label: t.tabGuia },
              { id: "historico", label: t.tabHistorico },
              { id: "perfil", label: t.tabPerfil },
            ] as { id: TabType; label: string }[]
          ).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 py-2 px-3 rounded-md text-base font-medium transition-all ${
                activeTab === tab.id
                  ? "bg-[#1a1a1a] text-[#c9a84c] border border-[#c9a84c]/30 shadow-gold"
                  : "text-[#aca189] hover:text-[#c2b9a4]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── TAB: SOLICITAR LEITURA ──────────────────────────────────────── */}
        {activeTab === "leitura" && (
          <div className="animate-fade-in">
            <div className="mystic-card p-8">
              <div className="text-center mb-8">
                <div className="text-5xl mb-4 animate-float">🔮</div>
                <h2 className="font-serif text-2xl text-[#c9a84c] mb-2">
                  {t.leituraTitle}
                </h2>
                <p className="text-[#b5ab97] text-base max-w-md mx-auto">
                  {t.leituraSubtitle}
                </p>
              </div>

              {/* Pergunta opcional */}
              <div className="mb-6">
                <label className="block text-base text-[#c2b9a4] mb-2">
                  {t.perguntaLabel}{" "}
                  <span className="text-[#a39878] text-sm">{t.perguntaHint}</span>
                </label>
                <textarea
                  value={pergunta}
                  onChange={(e) => setPergunta(e.target.value.slice(0, 500))}
                  placeholder={t.perguntaPlaceholder}
                  className="input-mystic resize-none h-24"
                  disabled={requestingReading}
                />
                <p className="text-[#9a9077] text-sm mt-1 text-right">
                  {pergunta.length}/500
                </p>
              </div>

              {/* Aviso de créditos zerados */}
              {credits.leituras_restantes === 0 && (
                <div className="bg-[#8b0000]/20 border border-[#8b0000]/40 rounded-lg p-4 mb-6 text-center">
                  <p className="text-red-400 text-base">
                    {t.noCreditsLong}
                  </p>
                </div>
              )}

              {/* Aviso de perfil incompleto */}
              {!profileComplete && (
                <div className="bg-[#8b0000]/20 border border-[#8b0000]/40 rounded-lg p-4 mb-6 text-center">
                  <p className="text-red-400 text-base">
                    {t.completeProfileFirst}
                  </p>
                </div>
              )}

              <button
                onClick={handleRequestReading}
                disabled={
                  requestingReading ||
                  credits.leituras_restantes === 0 ||
                  !profileComplete
                }
                className="btn-gold w-full py-4 text-lg"
              >
                {requestingReading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg
                      className="animate-spin h-5 w-5"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8v8z"
                      />
                    </svg>
                    {t.consultingCards}
                  </span>
                ) : credits.leituras_restantes === 0 ? (
                  t.noReadingsBtn
                ) : (
                  t.requestReadingBtn
                )}
              </button>

              {/* Resultado da leitura */}
              {readingResult && (
                <div className="mt-8 animate-fade-in">
                  <div className="bg-[#1a0a2e]/50 border border-[#c9a84c]/30 rounded-lg p-6">
                    <div className="flex items-center gap-2 mb-4">
                      <span className="text-[#c9a84c]">✦</span>
                      <h3 className="text-[#c9a84c] font-serif text-lg">
                        {t.yourReading}
                      </h3>
                      <span className="text-[#aca189] text-sm ml-auto">
                        {t.sentWhatsapp}
                      </span>
                    </div>
                    <p className="text-[#e8e0d0]/90 text-base leading-relaxed whitespace-pre-wrap font-serif italic">
                      {readingResult}
                    </p>
                  </div>
                </div>
              )}

              {readingError && (
                <div className="mt-6 bg-red-900/20 border border-red-800/40 rounded-lg p-4">
                  <p className="text-red-400 text-base">{readingError}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── TAB: CHAT COM ATB ──────────────────────────────────────────── */}
        {activeTab === "chat" && (
          <div className="animate-fade-in">
            <div className="mystic-card p-6 sm:p-8">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="font-serif text-2xl text-[#c9a84c]">
                    {t.chatTitle}
                  </h2>
                  <p className="text-[#b5ab97] text-base mt-1">
                    {t.chatSubtitle}
                  </p>
                </div>
                {chatRemaining !== null && (
                  <div className="text-center">
                    <div className="text-2xl font-serif gold-gradient-text font-bold">
                      {chatRemaining}
                    </div>
                    <div className="text-[#aca189] text-sm">
                      {chatUsingCredits ? t.chatCredits : t.chatMsgs}
                    </div>
                  </div>
                )}
              </div>

              {/* Mensagens — cada resposta da ATB vira bolhas curtas (|||),
                  como uma conversa de WhatsApp de verdade */}
              <div className="bg-[#0d0d0d] border border-[#2a2a2a] rounded-lg p-4 h-96 overflow-y-auto mb-4 space-y-3">
                {chatMessages.length === 0 &&
                  t.chatWelcome
                    .split("|||")
                    .map((b) => b.trim())
                    .filter(Boolean)
                    .map((b, i) => (
                      <div key={`w${i}`} className="flex justify-start">
                        <div className="max-w-[85%] rounded-2xl rounded-bl-md px-4 py-3 text-base leading-relaxed whitespace-pre-wrap bg-[#1a0a2e]/60 border border-[#2a2a2a] text-[#e8e0d0]/90 font-serif italic animate-fade-in">
                          {b}
                        </div>
                      </div>
                    ))}
                {chatMessages.flatMap((m, i) => {
                  if (m.role === "user") {
                    return (
                      <div key={`${m.id ?? i}`} className="flex justify-end">
                        <div className="max-w-[85%] rounded-2xl rounded-br-md px-4 py-3 text-base leading-relaxed whitespace-pre-wrap bg-[#c9a84c]/15 border border-[#c9a84c]/30 text-[#e8e0d0]">
                          {m.content}
                        </div>
                      </div>
                    );
                  }
                  return m.content
                    .split("|||")
                    .map((b) => b.trim())
                    .filter(Boolean)
                    .map((b, j) => (
                      <div key={`${m.id ?? i}-${j}`} className="flex justify-start">
                        <div className="max-w-[85%] rounded-2xl rounded-bl-md px-4 py-3 text-base leading-relaxed whitespace-pre-wrap bg-[#1a0a2e]/60 border border-[#2a2a2a] text-[#e8e0d0]/90 font-serif italic animate-fade-in">
                          {b}
                        </div>
                      </div>
                    ));
                })}
                {atbTyping && (
                  <div className="flex justify-start">
                    <div className="rounded-2xl rounded-bl-md px-5 py-4 bg-[#1a0a2e]/60 border border-[#2a2a2a] flex items-center gap-1.5">
                      <span className="typing-dot" />
                      <span className="typing-dot" />
                      <span className="typing-dot" />
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {chatError && (
                <div className="bg-red-900/20 border border-red-800/40 rounded-lg p-3 mb-4">
                  <p className="text-red-400 text-base">{chatError}</p>
                </div>
              )}

              {chatRemaining === 0 && (
                <div className="bg-[#c9a84c]/10 border border-[#c9a84c]/30 rounded-lg p-4 mb-4 text-center">
                  <p className="text-[#c9a84c] text-base mb-3">
                    {t.chatBuyText}
                  </p>
                  <div className="flex flex-col sm:flex-row gap-2 justify-center">
                    <a
                      href="/api/checkout/pergunta1"
                      className="text-base border border-[#c9a84c]/40 text-[#c9a84c] px-4 py-2 rounded-lg hover:border-[#c9a84c] transition-colors"
                    >
                      {t.buy1}
                    </a>
                    <a
                      href="/api/checkout/pergunta3"
                      className="text-base border border-[#c9a84c]/40 text-[#c9a84c] px-4 py-2 rounded-lg hover:border-[#c9a84c] transition-colors"
                    >
                      {t.buy3}
                    </a>
                    <a
                      href="/api/checkout/pergunta7"
                      className="text-base btn-gold px-4 py-2 rounded-lg"
                    >
                      {t.buy7}
                    </a>
                  </div>
                </div>
              )}

              {/* Input */}
              <div className="flex gap-3">
                <textarea
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value.slice(0, 1500))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSendChat();
                    }
                  }}
                  placeholder={t.chatPlaceholder}
                  className="input-mystic resize-none h-14 flex-1"
                  disabled={chatSending || chatRemaining === 0}
                />
                <button
                  onClick={handleSendChat}
                  disabled={chatSending || !chatInput.trim() || chatRemaining === 0}
                  className="btn-gold px-6 rounded-lg text-base"
                >
                  {chatSending ? "..." : t.send}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── TAB: GUIA DE VÍCIOS ────────────────────────────────────────── */}
        {activeTab === "guia" && (
          <div className="animate-fade-in">
            <div className="mb-6">
              <h2 className="font-serif text-xl text-[#c9a84c] mb-2">
                {t.guiaTitle}
              </h2>
              <p className="text-[#b5ab97] text-base">
                {t.guiaSubtitle}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
              {CATEGORIAS_GUIA.map((categoria) => {
                const icones: Record<CategoriaGuia, string> = {
                  "Alimentação Emocional": "🍫",
                  "Relacionamentos Tóxicos": "💔",
                  Procrastinação: "⏳",
                  "Vício em Redes Sociais": "📱",
                  "Ansiedade Crônica": "🌪️",
                  Cigarro: "🚬",
                  Álcool: "🍷",
                };
                return (
                  <button
                    key={categoria}
                    onClick={() => handleGuiaVicios(categoria)}
                    disabled={
                      guiaLoading ||
                      credits.leituras_restantes === 0 ||
                      !profileComplete
                    }
                    className={`mystic-card p-6 text-left transition-all hover:border-[#c9a84c]/50 disabled:opacity-50 disabled:cursor-not-allowed ${
                      guiaCategoria === categoria && guiaLoading
                        ? "border-[#c9a84c]/50"
                        : ""
                    }`}
                  >
                    <div className="text-3xl mb-3">{icones[categoria]}</div>
                    <div className="font-serif text-[#c9a84c] text-base mb-1">
                      {t.guiaLabels[categoria]}
                    </div>
                    {guiaCategoria === categoria && guiaLoading && (
                      <p className="text-[#aca189] text-base">
                        {t.consultingCards}
                      </p>
                    )}
                  </button>
                );
              })}
            </div>

            {guiaError && (
              <div className="bg-red-900/20 border border-red-800/40 rounded-lg p-4 mb-6">
                <p className="text-red-400 text-base">{guiaError}</p>
              </div>
            )}

            {guiaResult && guiaCategoria && (
              <div className="animate-fade-in">
                <div className="bg-[#1a0a2e]/50 border border-[#c9a84c]/30 rounded-lg p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <span className="text-[#c9a84c]">✦</span>
                    <h3 className="text-[#c9a84c] font-serif text-lg">
                      {t.guiaLabels[guiaCategoria]}
                    </h3>
                    <span className="text-[#aca189] text-sm ml-auto">
                      {t.sentWhatsapp}
                    </span>
                  </div>
                  <p className="text-[#e8e0d0]/90 text-base leading-relaxed whitespace-pre-wrap font-serif italic">
                    {guiaResult}
                  </p>
                </div>
              </div>
            )}

            {credits.leituras_restantes === 0 && (
              <div className="bg-[#8b0000]/20 border border-[#8b0000]/40 rounded-lg p-4 text-center">
                <p className="text-red-400 text-base">
                  {t.guiaNoCredits}
                </p>
              </div>
            )}

            {!profileComplete && (
              <div className="bg-[#8b0000]/20 border border-[#8b0000]/40 rounded-lg p-4 text-center">
                <p className="text-red-400 text-base">
                  {t.completeProfileFirst}
                </p>
              </div>
            )}
          </div>
        )}

        {/* ── TAB: HISTÓRICO ─────────────────────────────────────────────── */}
        {activeTab === "historico" && (
          <div className="animate-fade-in">
            <h2 className="font-serif text-xl text-[#c9a84c] mb-6">
              {t.historicoTitle}
            </h2>

            {readings.length === 0 ? (
              <div className="mystic-card p-12 text-center">
                <div className="text-4xl mb-4 opacity-30">📜</div>
                <p className="text-[#aca189] text-base">
                  {t.historicoEmpty}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {readings.map((reading) => (
                  <div key={reading.id} className="mystic-card p-6">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-[#c9a84c]">✦</span>
                        <span className="text-[#e8e0d0] text-base font-medium">
                          {new Date(reading.created_at).toLocaleDateString(
                            locale,
                            {
                              day: "2-digit",
                              month: "long",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            }
                          )}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        {reading.enviado_whatsapp && (
                          <span className="text-green-500/70 text-sm">
                            {t.whatsappOk}
                          </span>
                        )}
                        <button
                          onClick={() =>
                            setExpandedReading(
                              expandedReading === reading.id ? null : reading.id
                            )
                          }
                          className="text-[#aca189] hover:text-[#c9a84c] text-base transition-colors"
                        >
                          {expandedReading === reading.id ? t.recolher : t.verLeitura}
                        </button>
                      </div>
                    </div>

                    {expandedReading === reading.id && (
                      <div className="mt-4 pt-4 border-t border-[#2a2a2a] animate-fade-in">
                        <p className="text-[#e8e0d0]/80 text-base leading-relaxed whitespace-pre-wrap font-serif italic">
                          {reading.resposta_ia}
                        </p>
                      </div>
                    )}

                    {expandedReading !== reading.id && (
                      <p className="text-[#aca189] text-sm mt-1 line-clamp-2 italic">
                        {reading.resposta_ia?.substring(0, 120)}...
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── TAB: PERFIL ────────────────────────────────────────────────── */}
        {activeTab === "perfil" && (
          <div className="animate-fade-in max-w-xl">
            <h2 className="font-serif text-xl text-[#c9a84c] mb-6">
              {t.perfilTitle}
            </h2>

            <div className="mystic-card p-8">
              <p className="text-[#b5ab97] text-base mb-6">
                {t.perfilSubtitle}
              </p>

              <form onSubmit={handleSubmit(onProfileSubmit)} noValidate>
                {/* Nome */}
                <div className="mb-5">
                  <label htmlFor="nome" className="block text-base text-[#c2b9a4] mb-2">
                    {t.nomeLabel}
                  </label>
                  <input
                    id="nome"
                    type="text"
                    autoComplete="name"
                    placeholder={t.nomePlaceholder}
                    className="input-mystic"
                    {...register("nome")}
                    disabled={savingProfile}
                  />
                  {errors.nome && (
                    <p className="text-red-400 text-base mt-1">{errors.nome.message}</p>
                  )}
                </div>

                {/* Signo */}
                <div className="mb-5">
                  <label htmlFor="signo" className="block text-base text-[#c2b9a4] mb-2">
                    {t.signoLabel}
                  </label>
                  <select
                    id="signo"
                    className="input-mystic"
                    {...register("signo")}
                    disabled={savingProfile}
                  >
                    <option value="">{t.signoSelect}</option>
                    {SIGNOS.map((s) => (
                      <option key={s} value={s}>
                        {t.signoLabels[s]}
                      </option>
                    ))}
                  </select>
                  {errors.signo && (
                    <p className="text-red-400 text-base mt-1">{errors.signo.message}</p>
                  )}
                </div>

                {/* Data de nascimento */}
                <div className="mb-5">
                  <label
                    htmlFor="data_nascimento"
                    className="block text-base text-[#c2b9a4] mb-2"
                  >
                    {t.dataLabel}
                  </label>
                  <input
                    id="data_nascimento"
                    type="date"
                    className="input-mystic"
                    {...register("data_nascimento")}
                    disabled={savingProfile}
                  />
                  {errors.data_nascimento && (
                    <p className="text-red-400 text-base mt-1">
                      {errors.data_nascimento.message}
                    </p>
                  )}
                </div>

                {/* WhatsApp */}
                <div className="mb-6">
                  <label
                    htmlFor="whatsapp"
                    className="block text-base text-[#c2b9a4] mb-2"
                  >
                    {t.whatsLabel}{" "}
                    <span className="text-[#a39878] text-sm">
                      {t.whatsHint}
                    </span>
                  </label>
                  <input
                    id="whatsapp"
                    type="tel"
                    autoComplete="tel"
                    placeholder={t.whatsPlaceholder}
                    className="input-mystic"
                    {...register("whatsapp")}
                    disabled={savingProfile}
                  />
                  {errors.whatsapp && (
                    <p className="text-red-400 text-base mt-1">
                      {errors.whatsapp.message}
                    </p>
                  )}
                </div>

                {profileApiError && (
                  <div className="bg-red-900/20 border border-red-800/40 rounded-lg p-3 mb-4">
                    <p className="text-red-400 text-base">{profileApiError}</p>
                  </div>
                )}

                {profileSuccess && (
                  <div className="bg-green-900/20 border border-green-800/40 rounded-lg p-3 mb-4">
                    <p className="text-green-400 text-base">
                      {t.profileSaved}
                    </p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={savingProfile}
                  className="btn-gold w-full py-3 text-base"
                >
                  {savingProfile ? t.saving : t.saveProfile}
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
