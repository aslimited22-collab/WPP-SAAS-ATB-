import type { AppLocale } from "@/lib/locale";

type StoreCopy = {
  nav: string; how: string; portal: string; language: string;
  heading: [string, string]; intro: string; choose: string;
  catalog: string; chat: string; chatText: string; packs: [string, string];
  cleansing: string; cleansingText: string; view: string;
  rituals: string; ritualsText: string; seeRituals: string;
  map: string; mapText: string; once: string; steps: [string, string][];
  faqTitle: string; faq: [string, string][]; notice: string; checkoutError: string;
};

export const storefront: Record<AppLocale, StoreCopy> = {
  "pt-BR": {
    nav: "Leituras", how: "Como funciona", portal: "Meu portal", language: "Idioma",
    heading: ["Uma leitura para", "o seu momento."],
    intro: "Que pergunta ficou com você depois da leitura do canal? Aqui, o amor, os recomeços e as escolhas da sua vida ganham espaço em uma leitura só sua.",
    choose: "Escolher minha leitura", catalog: "Escolha sua leitura",
    chat: "Perguntas ao tarot", chatText: "Traga suas próprias perguntas ao chat do portal. Cada crédito dá direito a uma resposta sobre a situação que você contar.",
    packs: ["3 perguntas", "7 perguntas"], cleansing: "Limpeza espiritual",
    cleansingText: "Uma leitura sobre o que você está vivendo, com uma mensagem de proteção e orientações para o seu dia a dia.",
    view: "Ver detalhes", rituals: "Trabalhos espirituais", ritualsText: "Escolha uma intenção para o seu ritual, do encerramento de um ciclo à harmonia no amor. O pagamento dos rituais é em reais.",
    seeRituals: "Conhecer os rituais", map: "Mapa numerológico", mapText: "Seus números pessoais, calculados a partir do seu nome e da sua data de nascimento, em um mapa em PDF em português.",
    once: "Pagamento único", steps: [["Escolha sua leitura", "Compare as opções e veja o que está incluído antes de pagar."], ["Use seu e-mail", "Informe um endereço que você consulta. É por ele que você recebe as instruções após o pagamento."], ["Abra sua leitura", "Para os pacotes de perguntas, entre no portal. Para os demais serviços, siga as instruções do seu pedido."]],
    faqTitle: "Dúvidas frequentes", faq: [["É uma assinatura?", "As opções desta página têm pagamento único. No chat, você escolhe o pacote e usa uma pergunta por crédito."], ["Já comprei. Onde entro?", "Abra Meu portal e informe o e-mail usado na compra dos créditos. Para um trabalho espiritual, abra o link do pedido enviado ao seu e-mail."], ["Posso comprar de outro país?", "O chat e a limpeza espiritual aceitam pagamento internacional pela Stripe. No Brasil, o pagamento é pela Kiwify. Os trabalhos espirituais têm preço em reais."]],
    notice: "As leituras são experiências de reflexão e entretenimento. Orientações de saúde, jurídicas e financeiras devem ser buscadas com profissionais habilitados.",
    checkoutError: "Não foi possível abrir o pagamento. Tente novamente em alguns instantes."
  },
  en: {
    nav: "Readings", how: "How it works", portal: "My portal", language: "Language",
    heading: ["A reading for", "this moment."], intro: "Did a question stay with you after watching the channel? Explore love, new beginnings and the choices you face in a reading of your own.",
    choose: "Choose my reading", catalog: "Choose your reading", chat: "Ask the tarot", chatText: "Bring your own questions to the portal chat. Each credit gives you one reading about the situation you describe.",
    packs: ["3 questions", "7 questions"], cleansing: "Spiritual cleansing", cleansingText: "A reading about what you are experiencing, with a message of protection and guidance for everyday life.", view: "View details",
    rituals: "Spiritual rituals", ritualsText: "Choose an intention, from letting go to finding harmony in love. Rituals are priced in Brazilian reais.", seeRituals: "Explore the rituals",
    map: "Numerology chart", mapText: "Explore the numbers in your name and date of birth in a personal PDF chart in Portuguese.", once: "One-time payment",
    steps: [["Choose a reading", "Compare the options and see what each one includes before you pay."], ["Use your email", "Enter an address you check regularly. Your order instructions go there after payment."], ["Open your reading", "For question packs, open the portal. For other services, follow the instructions in your order."]],
    faqTitle: "Common questions", faq: [["Is this a subscription?", "Each option on this page is a one-time purchase. In the chat, each credit lets you ask one question."], ["I already paid. Where do I go?", "Open My portal and enter the email you used to buy credits. For a spiritual ritual, open the order link sent to your email."], ["Can I buy from abroad?", "International payments for chat and cleansing are processed by Stripe. In Brazil we use Kiwify. Spiritual rituals are priced in Brazilian reais."]],
    notice: "Readings are for reflection and entertainment. Seek qualified professional advice for health, legal or financial matters.", checkoutError: "We could not open checkout. Please try again in a moment."
  },
  es: {
    nav: "Lecturas", how: "Cómo funciona", portal: "Mi portal", language: "Idioma",
    heading: ["Una lectura para", "tu momento."], intro: "¿Te quedó alguna pregunta después de ver el canal? Explora el amor, los nuevos comienzos y tus decisiones en una lectura dedicada a ti.",
    choose: "Elegir mi lectura", catalog: "Elige tu lectura", chat: "Preguntas al tarot", chatText: "Haz tus propias preguntas en el chat del portal. Cada crédito te da una respuesta sobre la situación que cuentes.", packs: ["3 preguntas", "7 preguntas"],
    cleansing: "Limpieza espiritual", cleansingText: "Una lectura sobre lo que estás viviendo, con un mensaje de protección y orientación para tu día a día.", view: "Ver detalles",
    rituals: "Trabajos espirituales", ritualsText: "Elige una intención para tu ritual, desde cerrar ciclos hasta encontrar armonía en el amor. Los rituales se pagan en reales brasileños.", seeRituals: "Explorar los rituales",
    map: "Mapa numerológico", mapText: "Descubre los números de tu nombre y tu fecha de nacimiento en un mapa personal en PDF, en portugués.", once: "Pago único",
    steps: [["Elige tu lectura", "Compara las opciones y descubre qué incluye cada una antes de pagar."], ["Usa tu correo", "Indica una dirección que consultes. Allí recibirás las instrucciones después del pago."], ["Abre tu lectura", "Para los paquetes de preguntas, entra al portal. Para los demás servicios, sigue las instrucciones de tu pedido."]],
    faqTitle: "Preguntas frecuentes", faq: [["¿Es una suscripción?", "Cada opción de esta página se paga una sola vez. En el chat puedes hacer una pregunta por crédito."], ["Ya pagué. ¿Cómo accedo?", "Abre Mi portal e introduce el correo con el que compraste los créditos. Para un ritual, abre el enlace del pedido que recibiste por correo."], ["¿Puedo comprar desde otro país?", "Stripe procesa los pagos internacionales del chat y la limpieza. En Brasil usamos Kiwify. Los rituales se cobran en reales brasileños."]],
    notice: "Las lecturas son experiencias de reflexión y entretenimiento. Consulta a profesionales cualificados para asuntos médicos, legales o financieros.", checkoutError: "No se pudo abrir el pago. Vuelve a intentarlo en unos instantes."
  },
  de: {
    nav: "Legungen", how: "So geht’s", portal: "Mein Portal", language: "Sprache",
    heading: ["Eine Legung für", "deinen Moment."], intro: "Beschäftigt dich nach der Legung auf unserem Kanal noch eine Frage? In deiner persönlichen Deutung ist Raum für Liebe, Neuanfänge und Entscheidungen.",
    choose: "Legung auswählen", catalog: "Wähle deine Legung", chat: "Fragen an das Tarot", chatText: "Stelle deine Fragen im Portal-Chat. Pro Guthabenpunkt erhältst du eine persönliche Antwort zu deinem Anliegen.", packs: ["3 Fragen", "7 Fragen"],
    cleansing: "Spirituelle Reinigung", cleansingText: "Eine Deutung deiner aktuellen Situation mit einer persönlichen Schutzbotschaft und Anregungen für den Alltag.", view: "Details ansehen",
    rituals: "Spirituelle Rituale", ritualsText: "Wähle dein Anliegen, vom Loslassen bis zur Harmonie in der Liebe. Die Rituale werden in brasilianischen Real berechnet.", seeRituals: "Rituale entdecken",
    map: "Numerologie-Profil", mapText: "Deine persönlichen Zahlen aus Namen und Geburtsdatum, als PDF auf Portugiesisch.", once: "Einmalzahlung",
    steps: [["Legung wählen", "Vergleiche die Angebote. Vor der Zahlung siehst du, was sie enthalten."], ["E-Mail angeben", "Verwende eine Adresse, die du regelmäßig abrufst. Dorthin schicken wir nach der Zahlung die Anleitung."], ["Legung öffnen", "Für Fragenpakete öffnest du dein Portal. Für andere Angebote folgst du der Anleitung zu deiner Bestellung."]],
    faqTitle: "Häufige Fragen", faq: [["Ist das ein Abo?", "Die Angebote auf dieser Seite sind Einmalkäufe. Im Chat kannst du für jeden Guthabenpunkt eine Frage stellen."], ["Ich habe bezahlt. Wie geht es weiter?", "Öffne Mein Portal mit der E-Mail-Adresse, die du beim Kauf deiner Fragen angegeben hast. Für Rituale öffnest du den Bestelllink aus deiner E-Mail."], ["Kann ich aus dem Ausland bestellen?", "Internationale Zahlungen für Chat und Reinigung laufen über Stripe, in Brasilien über Kiwify. Rituale werden in brasilianischen Real abgerechnet."]],
    notice: "Die Legungen dienen der Reflexion und Unterhaltung. Bei gesundheitlichen, rechtlichen oder finanziellen Fragen wende dich an qualifizierte Fachleute.", checkoutError: "Die Zahlung konnte nicht geöffnet werden. Bitte versuche es gleich noch einmal."
  },
  it: {
    nav: "Letture", how: "Come funziona", portal: "Il mio portale", language: "Lingua",
    heading: ["Una lettura per", "il tuo momento."], intro: "Dopo la lettura sul canale ti è rimasta una domanda? Esplora l’amore, i nuovi inizi e le scelte della tua vita in una lettura dedicata a te.",
    choose: "Scegli la mia lettura", catalog: "Scegli la tua lettura", chat: "Domande ai tarocchi", chatText: "Fai le tue domande nella chat del portale. Con ogni credito ricevi una risposta sulla situazione che racconti.", packs: ["3 domande", "7 domande"],
    cleansing: "Pulizia spirituale", cleansingText: "Una lettura di ciò che stai vivendo, con un messaggio di protezione e spunti per la tua vita quotidiana.", view: "Vedi i dettagli",
    rituals: "Rituali spirituali", ritualsText: "Scegli un’intenzione, dal lasciar andare un ciclo all’armonia in amore. I rituali si pagano in real brasiliani.", seeRituals: "Scopri i rituali",
    map: "Mappa numerologica", mapText: "Scopri i numeri del tuo nome e della tua data di nascita in una mappa personale in PDF, in portoghese.", once: "Pagamento unico",
    steps: [["Scegli la lettura", "Confronta le opzioni e scopri cosa includono prima di pagare."], ["Usa la tua email", "Indica un indirizzo che controlli. Riceverai lì le istruzioni dopo il pagamento."], ["Apri la lettura", "Per i pacchetti di domande, entra nel portale. Per gli altri servizi segui le istruzioni del tuo ordine."]],
    faqTitle: "Domande frequenti", faq: [["È un abbonamento?", "Le opzioni di questa pagina prevedono un pagamento unico. Nella chat puoi fare una domanda per ogni credito."], ["Ho già pagato. Come accedo?", "Apri Il mio portale e inserisci l’email usata per acquistare i crediti. Per un rituale, apri il link dell’ordine ricevuto via email."], ["Posso acquistare dall’estero?", "Stripe gestisce i pagamenti internazionali per chat e pulizia. In Brasile usiamo Kiwify. I rituali si pagano in real brasiliani."]],
    notice: "Le letture sono esperienze di riflessione e intrattenimento. Per questioni mediche, legali o finanziarie rivolgiti a professionisti qualificati.", checkoutError: "Non è stato possibile aprire il pagamento. Riprova tra qualche istante."
  }
};
