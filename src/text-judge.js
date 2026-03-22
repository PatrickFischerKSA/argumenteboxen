const { CARD_LIBRARY, SIDE_DECKS } = require("./cards");
const { evaluateDefense } = require("./logic-rubric");

const STOPWORDS = new Set([
  "aber",
  "als",
  "also",
  "am",
  "an",
  "auch",
  "auf",
  "aus",
  "bei",
  "bin",
  "bis",
  "da",
  "damit",
  "dann",
  "das",
  "dass",
  "dein",
  "deine",
  "dem",
  "den",
  "der",
  "des",
  "die",
  "dies",
  "diese",
  "doch",
  "dort",
  "du",
  "ein",
  "eine",
  "einem",
  "einen",
  "einer",
  "es",
  "für",
  "hat",
  "hier",
  "ich",
  "im",
  "in",
  "ist",
  "ja",
  "kein",
  "keine",
  "man",
  "mit",
  "muss",
  "nicht",
  "nur",
  "oder",
  "schon",
  "sein",
  "seine",
  "sich",
  "sie",
  "sind",
  "so",
  "und",
  "vom",
  "von",
  "vor",
  "wenn",
  "wie",
  "wir",
  "wird",
  "zu",
  "zum",
  "zur"
]);

const CARD_HINTS = {
  pro_kognition: ["konzentration", "gedaechtnis", "aufmerksamkeit", "lernen", "fokus"],
  pro_ganzheitlich: ["ganzheitlich", "bildung", "koerper", "geist", "persoenlichkeit"],
  pro_aufwertung: ["wertschaetzung", "motivation", "verbindlichkeit", "ernst", "zaehlt"],
  pro_gesundheit: ["gesundheit", "stress", "wohlbefinden", "bewegung", "schulauftrag"],
  pro_sozial: ["fairness", "disziplin", "teamgeist", "durchhaltevermoegen", "sozial"],
  pro_fortschritt: ["fortschritt", "entwicklung", "einsatz", "technik", "lernzuwachs"],
  pro_vergleich: ["vergleich", "begabung", "sprachen", "mathematik", "startbedingungen"],
  pro_symbol: ["signal", "wertschaetzung", "koerperbildung", "gesellschaft", "sitzzend"],
  contra_ungleiche_voraussetzungen: ["genetik", "kraft", "schnelligkeit", "koordination", "ungleiche"],
  contra_chancengleichheit: ["fairness", "biologisch", "chancengleichheit", "koerperbewertung", "vergleich"],
  contra_subjektiv: ["subjektiv", "lehrperson", "kriterien", "messbar", "bewertung"],
  contra_leistungsdruck: ["druck", "scham", "unsicherheit", "oeffentlich", "turnsaal"],
  contra_verletzung: ["verletzung", "krankheit", "wachstum", "blessur", "verfaelscht"],
  contra_nachteilsausgleich: ["nachteilsausgleich", "ausgleich", "bevorzugung", "gerecht", "modus"],
  contra_gymnasialer_fokus: ["gymnasium", "akademisch", "geistig", "bildung", "zweck"],
  contra_kein_nachweis: ["evidenz", "nachweis", "belegt", "bonus", "klar"],
  contra_freudeverlust: ["freude", "lust", "notendruck", "befreiend", "motivierend"],
  contra_wichtig_ist_nicht_promotionsrelevant: ["wichtig", "promotionsrelevant", "wertvoll", "versetzung", "abschluss"]
};

function normalise(text) {
  return String(text || "")
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replaceAll("ß", "ss")
    .replace(/[^\p{L}\p{N}\s-]+/gu, " ")
    .replace(/\s+/g, " ");
}

function sanitizeTextMove(input) {
  return String(input || "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 420);
}

function tokenize(text) {
  return normalise(text)
    .split(" ")
    .filter((token) => token.length > 2 && !STOPWORDS.has(token));
}

function unique(values) {
  return [...new Set(values)];
}

const CARD_INDEX = Object.values(CARD_LIBRARY).reduce((index, card) => {
  index[card.id] = {
    card,
    phrases: unique([
      ...tokenize(card.title),
      ...tokenize(card.hook),
      ...tokenize(card.detail),
      ...(CARD_HINTS[card.id] || [])
    ])
  };
  return index;
}, {});

function inferCardFromText(text, side) {
  const cleaned = sanitizeTextMove(text);
  const tokens = tokenize(cleaned);
  const haystack = normalise(cleaned);
  const candidates = SIDE_DECKS[side].map((cardId) => CARD_INDEX[cardId]);

  let best = null;

  for (const candidate of candidates) {
    let score = 0;
    const matches = [];

    for (const token of tokens) {
      if (candidate.phrases.includes(token)) {
        score += 3;
        matches.push(token);
      }
    }

    const titleWords = tokenize(candidate.card.title);
    if (titleWords.some((word) => haystack.includes(word))) {
      score += 2;
    }

    if (!best || score > best.score) {
      best = {
        card: candidate.card,
        score,
        matches: unique(matches).slice(0, 6)
      };
    }
  }

  if (!best) {
    const fallback = CARD_LIBRARY[SIDE_DECKS[side][0]];
    return {
      card: fallback,
      score: 0,
      confidence: "schwach",
      matches: [],
      tokens
    };
  }

  let confidence = "schwach";
  if (best.score >= 9) {
    confidence = "stark";
  } else if (best.score >= 4) {
    confidence = "mittel";
  }

  return {
    ...best,
    confidence,
    tokens
  };
}

function detectFallacyHint(text) {
  const normalised = normalise(text);

  if (/\b(du|dein|deine|ihr|euch|ahnungslos|laecherlich|dumm)\b/.test(normalised)) {
    return {
      id: "ad_hominem",
      label: "ad hominem",
      note: "Der Text greift eher die Person oder Haltung als die Sache an."
    };
  }

  if (/\b(alle|jeder|niemand|immer|nie)\b/.test(normalised)) {
    return {
      id: "falsches_dilemma",
      label: "Falsches Dilemma",
      note: "Der Text arbeitet mit absoluten Verallgemeinerungen."
    };
  }

  if (/\b(weil es alle sagen|alle finden|die meisten finden)\b/.test(normalised)) {
    return {
      id: "ad_populum",
      label: "ad populum",
      note: "Die Begründung stützt sich auf Mehrheitsmeinung statt auf Logik."
    };
  }

  return null;
}

function evaluateTextDefense({ attackText, defenseText, attackSide, defenseSide }) {
  const cleanAttack = sanitizeTextMove(attackText);
  const cleanDefense = sanitizeTextMove(defenseText);
  const attackMatch = inferCardFromText(cleanAttack, attackSide);
  const defenseMatch = inferCardFromText(cleanDefense, defenseSide);
  const attackCard = attackMatch.card;
  const defenseCard = defenseMatch.card;
  const fallacyHint = detectFallacyHint(cleanDefense);
  const attackWords = attackMatch.tokens;
  const defenseWords = defenseMatch.tokens;
  const sharedWords = attackWords.filter((word) => defenseWords.includes(word));
  const validCounter = attackCard.validCounters.includes(defenseCard.id);
  const enoughAttack = attackWords.length >= 4;
  const enoughDefense = defenseWords.length >= 5;
  const enoughSignal = defenseMatch.score >= 3 || defenseMatch.confidence !== "schwach";
  const directRelevance = validCounter || sharedWords.length > 0 || attackMatch.matches.some((word) => defenseMatch.matches.includes(word));
  const isValid = validCounter && enoughDefense && enoughSignal && directRelevance && !fallacyHint;
  const base = evaluateDefense(attackCard, defenseCard, isValid);

  base.summary = isValid
    ? `"${cleanDefense}" wird als tragfähige Abwehr gelesen.`
    : `"${cleanDefense}" wehrt "${cleanAttack}" logisch nicht stark genug ab.`;

  base.criteria = [
    {
      id: "claim",
      label: "These und Prämissen klar",
      passed: enoughAttack,
      note: enoughAttack
        ? `Der Angriff lässt sich dem Kartenkern "${attackCard.title}" zuordnen.`
        : "Der Angriff bleibt sprachlich etwas knapp und schwerer einzuordnen."
    },
    {
      id: "relevance",
      label: "Direkter Bezug",
      passed: directRelevance,
      note: directRelevance
        ? `Die Abwehr greift den Themenkern "${attackCard.title}" auf.`
        : "Die Abwehr bleibt zu weit weg vom Kern des Angriffs."
    },
    {
      id: "form",
      label: "Passende Schlussart",
      passed: enoughSignal,
      note: `Der Text wurde als "${defenseCard.title}" mit ${base.defenseProfile} gelesen.`
    },
    {
      id: "inference",
      label: "Konklusion folgt",
      passed: isValid,
      note: isValid
        ? `Die eingegebene Abwehr passt zum gültigen Gegenmuster gegen "${attackCard.title}".`
        : `Die eingegebene Abwehr trifft das Gegenmuster zu "${attackCard.title}" noch nicht präzise genug.`
    },
    {
      id: "fallacy",
      label: "Kein Fehlschluss",
      passed: !fallacyHint,
      note: fallacyHint ? fallacyHint.note : "Kein auffälliger Fehlschlussmarker im Text."
    }
  ];

  base.explanation = `Der Angriff wurde als "${attackCard.title}" erkannt, die Abwehr am ehesten als "${defenseCard.title}". ${isValid ? "Die Zuordnung passt zu einem gültigen Gegenargument." : "Die Zuordnung reicht für eine tragfähige Widerlegung noch nicht aus."}`;

  if (!isValid && fallacyHint) {
    base.fallacy = {
      id: fallacyHint.id,
      label: fallacyHint.label
    };
  }

  base.attackInference = {
    cardId: attackCard.id,
    title: attackCard.title,
    confidence: attackMatch.confidence
  };
  base.defenseInference = {
    cardId: defenseCard.id,
    title: defenseCard.title,
    confidence: defenseMatch.confidence
  };

  return {
    judgement: base,
    attackCard,
    defenseCard,
    isValid
  };
}

function buildBotText(card, role = "attack") {
  if (role === "defense") {
    return `${card.hook} ${card.detail}`;
  }

  return `Mein Argument: ${card.hook} ${card.detail}`;
}

module.exports = {
  sanitizeTextMove,
  inferCardFromText,
  evaluateTextDefense,
  buildBotText
};
