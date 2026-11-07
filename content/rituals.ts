import type { AppLocale } from "@/lib/locale";
import type { ServiceSlug } from "./servicos";

type RitualCopy = {
  services: Record<ServiceSlug, { title: string; description: string }>;
  title: string;
  name: string;
  intention: string;
  intro: string;
  submit: string;
  preparing: string;
  steps: string;
  keep: string;
  image: string;
  refunded: string;
  retry: string;
  open: string;
  confirmed: string;
  reminder: string;
  ready: string;
  delivered: string;
  instructions: string;
  refund: string;
  legal: string;
  fallback: string;
  buy: string;
};

export const rituals: Record<AppLocale, RitualCopy> = {
  "pt-BR": {
    "services": {
      "corte-de-lacos": {
        "title": "Divórcio Energético",
        "description": "Um momento para encerrar um ciclo e voltar a atenção para si."
      },
      "ritual-de-prosperidade": {
        "title": "Ritual de Prosperidade",
        "description": "Uma reflexão sobre a sua relação com a prosperidade."
      },
      "devocao-a-xango": {
        "title": "Devoção a Xangô",
        "description": "Uma prática devocional ligada ao equilíbrio e à justiça."
      },
      "harmonizacao-amorosa": {
        "title": "Harmonização Amorosa",
        "description": "Um convite à serenidade na sua vida afetiva."
      }
    },
    "title": "Seu trabalho espiritual",
    "name": "Seu nome completo",
    "intention": "Sua intenção",
    "intro": "Conte o que está vivendo e o que deseja trabalhar. Sua leitura parte das suas palavras.",
    "submit": "Preparar minha leitura",
    "preparing": "Preparando sua leitura…",
    "steps": "Seus próximos passos",
    "keep": "Guarde este link para voltar à sua leitura.",
    "image": "Imagem simbólica da sua leitura",
    "refunded": "Pedido reembolsado. Se precisar de ajuda, responda ao e-mail da compra.",
    "retry": "Confira o nome e a intenção e tente novamente.",
    "open": "Abrir meu pedido",
    "confirmed": "Seu pedido foi confirmado",
    "reminder": "Falta sua intenção para preparar a leitura",
    "ready": "Sua leitura está pronta",
    "delivered": "A leitura e as orientações estão disponíveis na sua página pessoal.",
    "instructions": "Após a compra, abra o link enviado ao seu e-mail. Informe seu nome e sua intenção para receber sua leitura na mesma página.",
    "refund": "Você tem até 7 dias corridos após a compra para solicitar o reembolso integral, conforme o art. 49 do Código de Defesa do Consumidor.",
    "legal": "Serviço espiritual e devocional. Questões jurídicas devem ser tratadas com um advogado.",
    "fallback": "Reserve um instante de silêncio e reflita sobre a intenção que você escreveu.",
    "buy": "Receber minha leitura"
  },
  "en": {
    "services": {
      "corte-de-lacos": {
        "title": "Releasing old ties",
        "description": "A reading about letting go of an old bond and finding space for a new chapter."
      },
      "ritual-de-prosperidade": {
        "title": "Prosperity ritual",
        "description": "Reflect on what prosperity means to you and how you relate to abundance."
      },
      "devocao-a-xango": {
        "title": "Devotion to Xangô",
        "description": "A devotional reading about balance, courage and a sense of justice."
      },
      "harmonizacao-amorosa": {
        "title": "Harmony in love",
        "description": "Explore the feelings you bring to your relationships and what harmony means to you."
      }
    },
    "title": "Your spiritual ritual",
    "name": "Your full name",
    "intention": "Your intention",
    "intro": "Tell us what is happening in your life and what you want to explore. Your own words guide your reading.",
    "submit": "Prepare my reading",
    "preparing": "Preparing your reading…",
    "steps": "Your next steps",
    "keep": "Keep this link to return to your reading.",
    "image": "Symbolic image for your reading",
    "refunded": "This order has been refunded. Reply to your purchase email if you need help.",
    "retry": "Check your name and intention, then try again.",
    "open": "Open my order",
    "confirmed": "Your order is confirmed",
    "reminder": "Your reading is waiting for your intention",
    "ready": "Your reading is ready",
    "delivered": "Your reading and guidance are available on your personal page.",
    "instructions": "After purchase, open the link in your email. Enter your name and intention to receive your reading on that same page.",
    "refund": "You may request a full refund within seven calendar days of purchase under Article 49 of Brazil’s Consumer Protection Code.",
    "legal": "This is a devotional service. Consult a lawyer for legal advice.",
    "fallback": "Set aside a quiet moment to reflect on the intention you shared.",
    "buy": "Order my reading"
  },
  "es": {
    "services": {
      "corte-de-lacos": {
        "title": "Cierre de lazos",
        "description": "Una lectura para soltar un vínculo del pasado y abrirte a una nueva etapa."
      },
      "ritual-de-prosperidade": {
        "title": "Ritual de prosperidad",
        "description": "Reflexiona sobre tu relación con la prosperidad y lo que significa la abundancia para ti."
      },
      "devocao-a-xango": {
        "title": "Devoción a Xangô",
        "description": "Una lectura devocional sobre el equilibrio, el valor y el sentido de la justicia."
      },
      "harmonizacao-amorosa": {
        "title": "Armonía en el amor",
        "description": "Explora tus sentimientos y lo que significa la armonía en tus relaciones."
      }
    },
    "title": "Tu trabajo espiritual",
    "name": "Tu nombre completo",
    "intention": "Tu intención",
    "intro": "Cuéntanos qué estás viviendo y qué te gustaría explorar. Tus palabras guían la lectura.",
    "submit": "Preparar mi lectura",
    "preparing": "Preparando tu lectura…",
    "steps": "Tus próximos pasos",
    "keep": "Guarda este enlace para volver a tu lectura.",
    "image": "Imagen simbólica de tu lectura",
    "refunded": "Este pedido fue reembolsado. Responde al correo de compra si necesitas ayuda.",
    "retry": "Revisa tu nombre y tu intención e inténtalo de nuevo.",
    "open": "Abrir mi pedido",
    "confirmed": "Tu pedido está confirmado",
    "reminder": "Falta tu intención para preparar la lectura",
    "ready": "Tu lectura está lista",
    "delivered": "Tu lectura y las orientaciones están disponibles en tu página personal.",
    "instructions": "Después de comprar, abre el enlace de tu correo. Indica tu nombre y tu intención para recibir la lectura en esa misma página.",
    "refund": "Puedes solicitar un reembolso completo en los siete días naturales posteriores a la compra según el artículo 49 del Código de Defensa del Consumidor de Brasil.",
    "legal": "Este es un servicio devocional. Consulta a un abogado para recibir asesoramiento jurídico.",
    "fallback": "Busca un momento de calma para reflexionar sobre la intención que compartiste.",
    "buy": "Pedir mi lectura"
  },
  "de": {
    "services": {
      "corte-de-lacos": {
        "title": "Alte Bindungen lösen",
        "description": "Eine Deutung über das Loslassen alter Bindungen und den Raum für einen Neubeginn."
      },
      "ritual-de-prosperidade": {
        "title": "Ritual für Wohlstand",
        "description": "Erkunde dein Verhältnis zu Wohlstand und was Fülle für dich bedeutet."
      },
      "devocao-a-xango": {
        "title": "Andacht für Xangô",
        "description": "Eine Andacht über Ausgleich, Mut und Gerechtigkeit."
      },
      "harmonizacao-amorosa": {
        "title": "Harmonie in der Liebe",
        "description": "Entdecke, welche Gefühle dich begleiten und was Harmonie in deinen Beziehungen bedeutet."
      }
    },
    "title": "Dein spirituelles Ritual",
    "name": "Dein vollständiger Name",
    "intention": "Dein Anliegen",
    "intro": "Erzähle, was dich bewegt und worüber du nachdenken möchtest. Deine Worte geben deiner Deutung die Richtung.",
    "submit": "Meine Deutung vorbereiten",
    "preparing": "Deine Deutung wird vorbereitet…",
    "steps": "Deine nächsten Schritte",
    "keep": "Bewahre diesen Link auf, um deine Deutung wieder zu öffnen.",
    "image": "Symbolbild zu deiner Deutung",
    "refunded": "Diese Bestellung wurde erstattet. Bei Fragen antworte auf die E-Mail zu deinem Kauf.",
    "retry": "Prüfe deinen Namen und dein Anliegen und versuche es erneut.",
    "open": "Meine Bestellung öffnen",
    "confirmed": "Deine Bestellung ist bestätigt",
    "reminder": "Für deine Deutung fehlt noch dein Anliegen",
    "ready": "Deine Deutung ist fertig",
    "delivered": "Deine Deutung und die Anregungen stehen auf deiner persönlichen Seite bereit.",
    "instructions": "Öffne nach dem Kauf den Link in deiner E-Mail. Gib deinen Namen und dein Anliegen an. Deine Deutung erscheint auf derselben Seite.",
    "refund": "Nach Artikel 49 des brasilianischen Verbraucherschutzgesetzes kannst du innerhalb von sieben Kalendertagen nach dem Kauf eine vollständige Erstattung beantragen.",
    "legal": "Dieses Angebot ist spiritueller Natur. Bei rechtlichen Fragen wende dich an eine Rechtsanwältin oder einen Rechtsanwalt.",
    "fallback": "Nimm dir einen ruhigen Moment, um über dein Anliegen nachzudenken.",
    "buy": "Meine Deutung bestellen"
  },
  "it": {
    "services": {
      "corte-de-lacos": {
        "title": "Sciogliere i legami",
        "description": "Una lettura per lasciar andare un legame passato e fare spazio a un nuovo inizio."
      },
      "ritual-de-prosperidade": {
        "title": "Rituale di prosperità",
        "description": "Rifletti sul tuo rapporto con la prosperità e sul significato che dai all’abbondanza."
      },
      "devocao-a-xango": {
        "title": "Devozione a Xangô",
        "description": "Una lettura devozionale sull’equilibrio, il coraggio e il senso della giustizia."
      },
      "harmonizacao-amorosa": {
        "title": "Armonia in amore",
        "description": "Esplora i sentimenti che porti nelle relazioni e ciò che per te significa armonia."
      }
    },
    "title": "Il tuo rituale spirituale",
    "name": "Il tuo nome completo",
    "intention": "La tua intenzione",
    "intro": "Racconta cosa stai vivendo e cosa vorresti esplorare. Le tue parole guidano la lettura.",
    "submit": "Prepara la mia lettura",
    "preparing": "Preparazione della lettura…",
    "steps": "I tuoi prossimi passi",
    "keep": "Conserva questo link per tornare alla lettura.",
    "image": "Immagine simbolica della tua lettura",
    "refunded": "L’ordine è stato rimborsato. Se ti serve aiuto, rispondi all’email dell’acquisto.",
    "retry": "Controlla il nome e l’intenzione e riprova.",
    "open": "Apri il mio ordine",
    "confirmed": "Il tuo ordine è confermato",
    "reminder": "Manca la tua intenzione per preparare la lettura",
    "ready": "La tua lettura è pronta",
    "delivered": "La lettura e le indicazioni sono disponibili sulla tua pagina personale.",
    "instructions": "Dopo l’acquisto apri il link nell’email. Indica il tuo nome e la tua intenzione per ricevere la lettura sulla stessa pagina.",
    "refund": "Puoi richiedere un rimborso completo entro sette giorni di calendario dall’acquisto, ai sensi dell’articolo 49 del Codice di difesa del consumatore brasiliano.",
    "legal": "Questo è un servizio devozionale. Per consulenza legale rivolgiti a un avvocato.",
    "fallback": "Prenditi un momento di calma per riflettere sull’intenzione che hai condiviso.",
    "buy": "Ordina la mia lettura"
  }
};
