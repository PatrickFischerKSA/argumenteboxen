const CARD_LIBRARY = {
  pro_kognition: {
    id: "pro_kognition",
    side: "pro",
    title: "Klarerer Kopf durch Bewegung",
    hook: "Sport steigert Konzentration, Gedächtnis und Aufmerksamkeit.",
    detail:
      "Wenn Bewegung Lernprozesse messbar unterstützt, darf sie auch im schulischen Leistungssystem sichtbar werden.",
    validCounters: [
      "contra_kein_nachweis",
      "contra_gymnasialer_fokus",
      "contra_chancengleichheit"
    ]
  },
  pro_ganzheitlich: {
    id: "pro_ganzheitlich",
    side: "pro",
    title: "Bildung ist mehr als Kopfarbeit",
    hook: "Schule soll Körper, Geist und Persönlichkeit gemeinsam bilden.",
    detail:
      "Ein Promotionsfach würde das Bildungsverständnis verbreitern statt nur kognitive Spitzenleistungen zu belohnen.",
    validCounters: [
      "contra_gymnasialer_fokus",
      "contra_wichtig_ist_nicht_promotionsrelevant",
      "contra_chancengleichheit"
    ]
  },
  pro_aufwertung: {
    id: "pro_aufwertung",
    side: "pro",
    title: "Was zählt, wird ernst genommen",
    hook: "Promotionsrelevanz erhöht Motivation und Verbindlichkeit.",
    detail:
      "Viele Lernende investieren stärker in Fächer, die für den Abschluss wirklich zählen.",
    validCounters: [
      "contra_freudeverlust",
      "contra_leistungsdruck",
      "contra_wichtig_ist_nicht_promotionsrelevant"
    ]
  },
  pro_gesundheit: {
    id: "pro_gesundheit",
    side: "pro",
    title: "Gesundheit als Schulauftrag",
    hook: "Regelmässige Bewegung reduziert Stress und fördert Wohlbefinden.",
    detail:
      "Wenn Schule Gesundheit ernst nimmt, darf Sport nicht als Nebenfach zweiter Klasse behandelt werden.",
    validCounters: [
      "contra_wichtig_ist_nicht_promotionsrelevant",
      "contra_verletzung",
      "contra_chancengleichheit"
    ]
  },
  pro_sozial: {
    id: "pro_sozial",
    side: "pro",
    title: "Soziale Kompetenzen im Ring",
    hook: "Sport trainiert Fairness, Disziplin, Teamgeist und Durchhaltevermögen.",
    detail:
      "Diese Kompetenzen sind schulisch relevant und sollten deshalb stärker gewichtet werden.",
    validCounters: [
      "contra_subjektiv",
      "contra_wichtig_ist_nicht_promotionsrelevant",
      "contra_gymnasialer_fokus"
    ]
  },
  pro_fortschritt: {
    id: "pro_fortschritt",
    side: "pro",
    title: "Fortschritt statt Naturtalent",
    hook: "Bewertet werden kann auch individuelle Entwicklung statt nur Bestleistung.",
    detail:
      "Ein intelligentes Bewertungsmodell kann Einsatz, Technik und Lernzuwachs sichtbar machen.",
    validCounters: [
      "contra_subjektiv",
      "contra_nachteilsausgleich",
      "contra_ungleiche_voraussetzungen"
    ]
  },
  pro_vergleich: {
    id: "pro_vergleich",
    side: "pro",
    title: "Andere Fächer sind auch nicht gleich fair",
    hook: "Auch in Sprachen oder Mathematik starten Lernende mit unterschiedlichen Begabungen.",
    detail:
      "Ungleiche Voraussetzungen allein reichen nicht als Argument, um Sport aus der Promotion auszuschliessen.",
    validCounters: [
      "contra_chancengleichheit",
      "contra_ungleiche_voraussetzungen",
      "contra_nachteilsausgleich"
    ]
  },
  pro_symbol: {
    id: "pro_symbol",
    side: "pro",
    title: "Starkes Signal der Wertschätzung",
    hook: "Ein Promotionsfach zeigt, dass Gesundheit und Körperbildung gesellschaftlich zählen.",
    detail:
      "Die Schule sendet damit ein klares Zeichen gegen ein rein sitzendes Leistungsverständnis.",
    validCounters: [
      "contra_wichtig_ist_nicht_promotionsrelevant",
      "contra_gymnasialer_fokus",
      "contra_kein_nachweis"
    ]
  },
  contra_ungleiche_voraussetzungen: {
    id: "contra_ungleiche_voraussetzungen",
    side: "contra",
    title: "Körperliche Startbedingungen sind ungleich",
    hook: "Kraft, Schnelligkeit und Koordination sind stark genetisch und biografisch geprägt.",
    detail:
      "Ein Promotionsfach würde vorhandene körperliche Unterschiede systematisch in Noten übersetzen.",
    validCounters: [
      "pro_fortschritt",
      "pro_vergleich",
      "pro_ganzheitlich"
    ]
  },
  contra_chancengleichheit: {
    id: "contra_chancengleichheit",
    side: "contra",
    title: "Körperbewertung verletzt Fairness",
    hook: "Schule soll Lernen bewerten, nicht biologische Voraussetzungen.",
    detail:
      "Je stärker der Körper in die Promotion eingeht, desto schwieriger wird ein fairer Vergleich.",
    validCounters: [
      "pro_vergleich",
      "pro_fortschritt",
      "pro_ganzheitlich"
    ]
  },
  contra_subjektiv: {
    id: "contra_subjektiv",
    side: "contra",
    title: "Zu subjektiv für harte Konsequenzen",
    hook: "Sportnoten hängen stark von Lehrperson, Kriterien und Situation ab.",
    detail:
      "Was als Einsatz, Technik oder Fortschritt gilt, ist oft weniger messbar als in Prüfungsfächern.",
    validCounters: [
      "pro_fortschritt",
      "pro_sozial",
      "pro_aufwertung"
    ]
  },
  contra_leistungsdruck: {
    id: "contra_leistungsdruck",
    side: "contra",
    title: "Öffentlicher Druck im Turnsaal",
    hook: "Sport macht Leistung sichtbar und verstärkt Scham oder Unsicherheit.",
    detail:
      "Wer vor anderen scheitert, erlebt die Bewertung unmittelbarer als bei einer stillen Prüfung.",
    validCounters: [
      "pro_gesundheit",
      "pro_sozial",
      "pro_aufwertung"
    ]
  },
  contra_verletzung: {
    id: "contra_verletzung",
    side: "contra",
    title: "Verletzungen verzerren alles",
    hook: "Krankheit, Wachstumsschübe oder Blessuren können Leistungen massiv verfälschen.",
    detail:
      "Eine promotionsrelevante Note würde stark von Faktoren abhängen, die Lernende oft nicht steuern können.",
    validCounters: [
      "pro_fortschritt",
      "pro_gesundheit",
      "pro_symbol"
    ]
  },
  contra_nachteilsausgleich: {
    id: "contra_nachteilsausgleich",
    side: "contra",
    title: "Nachteilsausgleich bleibt heikel",
    hook: "Ausgleichsregeln wirken schnell entweder unfair oder künstlich bevorteilend.",
    detail:
      "Gerade bei sehr unterschiedlichen körperlichen Voraussetzungen ist ein gerechter Modus schwer zu finden.",
    validCounters: [
      "pro_fortschritt",
      "pro_vergleich",
      "pro_ganzheitlich"
    ]
  },
  contra_gymnasialer_fokus: {
    id: "contra_gymnasialer_fokus",
    side: "contra",
    title: "Gymnasium fokussiert geistige Leistung",
    hook: "Die Promotion soll vor allem akademische Anforderungen abbilden.",
    detail:
      "Sport ist wichtig, aber nicht zwingend massgeblich für den Zweck gymnasialer Bildung.",
    validCounters: [
      "pro_ganzheitlich",
      "pro_kognition",
      "pro_symbol"
    ]
  },
  contra_kein_nachweis: {
    id: "contra_kein_nachweis",
    side: "contra",
    title: "Kein eindeutiger Schulnoten-Bonus",
    hook: "Mehr Sport führt nicht automatisch zu besseren akademischen Leistungen.",
    detail:
      "Der pädagogische Nutzen ist plausibel, aber als Promotionsgrundlage nicht klar genug belegt.",
    validCounters: [
      "pro_kognition",
      "pro_gesundheit",
      "pro_symbol"
    ]
  },
  contra_freudeverlust: {
    id: "contra_freudeverlust",
    side: "contra",
    title: "Zu viel Druck nimmt die Freude",
    hook: "Sobald Sport über Aufstieg oder Sitzenbleiben entscheidet, sinkt die Lust.",
    detail:
      "Ein eigentlich befreiendes Fach kann durch Notendruck seinen motivierenden Charakter verlieren.",
    validCounters: [
      "pro_aufwertung",
      "pro_gesundheit",
      "pro_sozial"
    ]
  },
  contra_wichtig_ist_nicht_promotionsrelevant: {
    id: "contra_wichtig_ist_nicht_promotionsrelevant",
    side: "contra",
    title: "Wichtig heisst nicht promotionsrelevant",
    hook: "Nicht alles Wertvolle muss über Versetzung oder Abschluss mitentscheiden.",
    detail:
      "Schule kann Sport aufwerten, ohne ihn in die Promotionsrechnung zu verschieben.",
    validCounters: [
      "pro_symbol",
      "pro_aufwertung",
      "pro_gesundheit"
    ]
  }
};

const SIDE_DECKS = {
  pro: [
    "pro_kognition",
    "pro_ganzheitlich",
    "pro_aufwertung",
    "pro_gesundheit",
    "pro_sozial",
    "pro_fortschritt",
    "pro_vergleich",
    "pro_symbol"
  ],
  contra: [
    "contra_ungleiche_voraussetzungen",
    "contra_chancengleichheit",
    "contra_subjektiv",
    "contra_leistungsdruck",
    "contra_verletzung",
    "contra_nachteilsausgleich",
    "contra_gymnasialer_fokus",
    "contra_kein_nachweis",
    "contra_freudeverlust",
    "contra_wichtig_ist_nicht_promotionsrelevant"
  ]
};

function getCard(cardId) {
  return CARD_LIBRARY[cardId];
}

function getDeckForSide(side) {
  return SIDE_DECKS[side].map((cardId) => CARD_LIBRARY[cardId]);
}

function getPublicCard(cardId) {
  const card = getCard(cardId);
  if (!card) {
    return null;
  }

  return {
    id: card.id,
    side: card.side,
    title: card.title,
    hook: card.hook,
    detail: card.detail
  };
}

module.exports = {
  CARD_LIBRARY,
  SIDE_DECKS,
  getCard,
  getDeckForSide,
  getPublicCard
};
