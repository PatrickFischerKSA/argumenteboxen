const LOGIC_REFERENCE = {
  rubric: [
    {
      id: "claim",
      label: "These und Prämissen klar",
      description: "Die Behauptung und ihre Begründung müssen erkennbar sein."
    },
    {
      id: "relevance",
      label: "Direkter Bezug",
      description: "Das Gegenargument muss die These, Prämisse oder Konklusion wirklich treffen."
    },
    {
      id: "form",
      label: "Passende Schlussart",
      description: "Die Abwehr arbeitet mit einer tragfähigen Schlussform aus der Argumentationslehre."
    },
    {
      id: "inference",
      label: "Konklusion folgt",
      description: "Die Schlussfolgerung muss notwendig, wahrscheinlich oder plausibel aus den Prämissen folgen."
    },
    {
      id: "fallacy",
      label: "Kein Fehlschluss",
      description: "Die Abwehr darf nicht in einen formalen oder informellen Trugschluss kippen."
    }
  ],
  fullHitRule: [
    {
      id: "relevance",
      label: "Kern nicht getroffen",
      description: "Das Gegenargument greift These, Prämisse oder Konklusion des Angriffs nicht direkt an."
    },
    {
      id: "form",
      label: "Widerlegungsform trägt nicht",
      description: "Die Abwehr arbeitet nicht mit einer passenden logischen Gegenbewegung."
    },
    {
      id: "inference",
      label: "Widerlegung folgt nicht",
      description: "Aus der Abwehr ergibt sich keine tragfähige Entkräftung des Angriffs."
    },
    {
      id: "fallacy",
      label: "Fehlschluss oder Fristbruch",
      description: "Ein Fehlschluss oder eine verpasste Frist macht die Abwehr zum Volltreffer für die Gegenseite."
    }
  ],
  validForms: [
    {
      id: "deduktion",
      label: "Deduktion",
      description: "Von allgemeinen Prämissen zu einer notwendigen Schlussfolgerung."
    },
    {
      id: "induktion",
      label: "Induktion",
      description: "Von Beobachtungen zu einer wahrscheinlichen Verallgemeinerung."
    },
    {
      id: "abduktion",
      label: "Abduktion",
      description: "Von einer Wirkung zur plausibelsten Ursache oder Erklärung."
    },
    {
      id: "analogie",
      label: "Analogie",
      description: "Übertragung einer Struktur auf einen ähnlichen Fall."
    }
  ],
  fallacies: [
    {
      id: "non_sequitur",
      label: "non sequitur",
      description: "Die Schlussfolgerung passt logisch nicht zu den Prämissen."
    },
    {
      id: "affirmation_des_konsequens",
      label: "Affirmation des Konsequens",
      description: "Aus B wird unzulässig auf A geschlossen."
    },
    {
      id: "negation_des_antezedens",
      label: "Negation des Antezedens",
      description: "Aus Nicht-A wird unzulässig auf Nicht-B geschlossen."
    },
    {
      id: "zirkelschluss",
      label: "Zirkelschluss",
      description: "Die These wird mit sich selbst begründet."
    },
    {
      id: "falsches_dilemma",
      label: "Falsches Dilemma",
      description: "Es werden nur zwei Möglichkeiten vorgetäuscht, obwohl mehr existieren."
    },
    {
      id: "scheinkausalitaet",
      label: "Scheinkausalität",
      description: "Korrelation wird fälschlich als Ursache gedeutet."
    },
    {
      id: "strohmann",
      label: "Strohmann",
      description: "Die Gegenseite wird verzerrt dargestellt."
    },
    {
      id: "ad_hominem",
      label: "ad hominem",
      description: "Die Person wird angegriffen statt das Argument."
    },
    {
      id: "ad_populum",
      label: "ad populum",
      description: "Mehrheitsmeinung ersetzt Begründung."
    },
    {
      id: "ad_misericordiam",
      label: "ad misericordiam",
      description: "Emotion ersetzt logische Begründung."
    },
    {
      id: "red_herring",
      label: "Red Herring",
      description: "Ablenkung vom eigentlichen Streitpunkt."
    },
    {
      id: "slippery_slope",
      label: "slippery slope",
      description: "Eine Folge wird ohne tragfähige Begründung dramatisch zugespitzt."
    }
  ]
};

const CARD_LOGIC_PROFILES = {
  pro_kognition: {
    label: "Induktion",
    family: "induktion",
    validity: "wahrscheinlich",
    focus: "empirischer Nutzen",
    kernel: "Aus beobachteten positiven Effekten wird auf schulische Relevanz geschlossen.",
    counterUse: "prüft, ob die Verallgemeinerung empirisch wirklich trägt"
  },
  pro_ganzheitlich: {
    label: "Deduktion",
    family: "deduktion",
    validity: "notwendig",
    focus: "Bildungsauftrag",
    kernel: "Aus einem ganzheitlichen Bildungsverständnis wird auf die Stellung des Sports geschlossen.",
    counterUse: "greift das Grundprinzip oder seine Reichweite an"
  },
  pro_aufwertung: {
    label: "Abduktion",
    family: "abduktion",
    validity: "plausibel",
    focus: "Motivation",
    kernel: "Aus beobachteter Wertung in der Schule wird auf Motivationseffekte geschlossen.",
    counterUse: "prüft, ob die plausibelste Folge wirklich Motivation und nicht Druck ist"
  },
  pro_gesundheit: {
    label: "Deduktion",
    family: "deduktion",
    validity: "notwendig",
    focus: "Gesundheit",
    kernel: "Aus dem Gesundheitsauftrag der Schule wird auf stärkere Gewichtung des Sports geschlossen.",
    counterUse: "trennt zwischen Wichtigkeit und Promotionsrelevanz"
  },
  pro_sozial: {
    label: "Analogie",
    family: "analogie",
    validity: "plausibel",
    focus: "Kompetenzen",
    kernel: "Im Sport erworbene soziale Kompetenzen werden als schulisch relevante Leistung übertragen.",
    counterUse: "prüft, ob die Übertragung auf Noten wirklich trägt"
  },
  pro_fortschritt: {
    label: "Deduktion",
    family: "deduktion",
    validity: "notwendig",
    focus: "Bewertung",
    kernel: "Wenn Fortschritt statt Naturtalent zählt, kann Sport fairer bewertet werden.",
    counterUse: "prüft, ob diese Bewertungslogik tatsächlich fair und messbar ist"
  },
  pro_vergleich: {
    label: "Analogie",
    family: "analogie",
    validity: "plausibel",
    focus: "Fairnessvergleich",
    kernel: "Ungleiche Startbedingungen in anderen Fächern werden auf Sport übertragen.",
    counterUse: "prüft, ob der Vergleich wirklich tragfähig ist"
  },
  pro_symbol: {
    label: "Abduktion",
    family: "abduktion",
    validity: "plausibel",
    focus: "Signalwirkung",
    kernel: "Aus der institutionellen Gewichtung wird auf gesellschaftliche Wertschätzung geschlossen.",
    counterUse: "trennt Symbolwirkung von echter Begründung"
  },
  contra_ungleiche_voraussetzungen: {
    label: "Deduktion",
    family: "deduktion",
    validity: "notwendig",
    focus: "Fairnessvergleich",
    kernel: "Wenn körperliche Voraussetzungen ungleich sind, gefährdet eine harte Bewertung die Fairness.",
    counterUse: "macht ungleiche Startbedingungen zum Kern der Widerlegung",
    misfireAs: "non_sequitur"
  },
  contra_chancengleichheit: {
    label: "Deduktion",
    family: "deduktion",
    validity: "notwendig",
    focus: "Fairnessvergleich",
    kernel: "Aus dem Prinzip der Chancengleichheit wird gegen Körperbewertung geschlossen.",
    counterUse: "greift die normativen Grundlagen der These an",
    misfireAs: "falsches_dilemma"
  },
  contra_subjektiv: {
    label: "Deduktion",
    family: "deduktion",
    validity: "notwendig",
    focus: "Bewertung",
    kernel: "Wenn Bewertung unklar und subjektiv bleibt, ist Promotionsrelevanz logisch schwach.",
    counterUse: "prüft Messbarkeit und Nachvollziehbarkeit",
    misfireAs: "non_sequitur"
  },
  contra_leistungsdruck: {
    label: "Abduktion",
    family: "abduktion",
    validity: "plausibel",
    focus: "Motivation",
    kernel: "Aus sichtbarer Bewertung wird auf erhöhten sozialen Druck geschlossen.",
    counterUse: "erklärt Motivationseinbrüche als wahrscheinlichste Folge",
    misfireAs: "ad_misericordiam"
  },
  contra_verletzung: {
    label: "Deduktion",
    family: "deduktion",
    validity: "notwendig",
    focus: "Gesundheit",
    kernel: "Wenn Leistung stark von Verletzungen abhängt, verliert die Note ihre Vergleichbarkeit.",
    counterUse: "zeigt störende Drittvariablen im Bewertungssystem",
    misfireAs: "scheinkausalitaet"
  },
  contra_nachteilsausgleich: {
    label: "Deduktion",
    family: "deduktion",
    validity: "notwendig",
    focus: "Bewertung",
    kernel: "Wenn der Ausgleich selbst unfair wirkt, bleibt das System logisch instabil.",
    counterUse: "prüft, ob das Bewertungsmodell die Fairness wirklich rettet",
    misfireAs: "non_sequitur"
  },
  contra_gymnasialer_fokus: {
    label: "Deduktion",
    family: "deduktion",
    validity: "notwendig",
    focus: "Bildungsauftrag",
    kernel: "Aus dem Zweck gymnasialer Bildung wird gegen Promotionsrelevanz des Sports geschlossen.",
    counterUse: "greift das Oberprinzip der These an",
    misfireAs: "red_herring"
  },
  contra_kein_nachweis: {
    label: "Induktion",
    family: "induktion",
    validity: "wahrscheinlich",
    focus: "empirischer Nutzen",
    kernel: "Aus fehlender Evidenz folgt Zurückhaltung gegenüber einer allgemeinen Regel.",
    counterUse: "prüft die empirische Basis einer Verallgemeinerung",
    misfireAs: "affirmation_des_konsequens"
  },
  contra_freudeverlust: {
    label: "Abduktion",
    family: "abduktion",
    validity: "plausibel",
    focus: "Motivation",
    kernel: "Aus höherem Notendruck wird auf sinkende Freude geschlossen.",
    counterUse: "macht negative Folgen der These plausibel",
    misfireAs: "ad_consequentiam"
  },
  contra_wichtig_ist_nicht_promotionsrelevant: {
    label: "Deduktion",
    family: "deduktion",
    validity: "notwendig",
    focus: "Promotionslogik",
    kernel: "Wichtigkeit allein reicht logisch nicht für Promotionsrelevanz.",
    counterUse: "trennt Wertschätzung und Versetzungslogik sauber voneinander",
    misfireAs: "non_sequitur"
  }
};

const FALLACY_LABELS = {
  non_sequitur: "non sequitur",
  affirmation_des_konsequens: "Affirmation des Konsequens",
  negation_des_antezedens: "Negation des Antezedens",
  zirkelschluss: "Zirkelschluss",
  falsches_dilemma: "Falsches Dilemma",
  scheinkausalitaet: "Scheinkausalität",
  strohmann: "Strohmann",
  ad_hominem: "ad hominem",
  ad_populum: "ad populum",
  ad_misericordiam: "ad misericordiam",
  red_herring: "Red Herring",
  slippery_slope: "slippery slope",
  ad_consequentiam: "ad consequentiam"
};

function getCardLogicProfile(cardId) {
  return (
    CARD_LOGIC_PROFILES[cardId] || {
      label: "Schlussprüfung",
      family: "deduktion",
      validity: "plausibel",
      focus: "allgemein",
      kernel: "Die Karte bringt einen eigenständigen Begründungsschritt ein.",
      counterUse: "prüft die Gegenseite auf logische Tragfähigkeit",
      misfireAs: "non_sequitur"
    }
  );
}

function buildImpact(verdict, criteria) {
  if (verdict === "valid") {
    return {
      outcome: "parade",
      label: "Kein Volltreffer",
      summary: "Die Abwehr zählt als Parade, weil alle Kernkriterien der Widerlegung tragen.",
      triggers: [
        "Direkter Bezug auf den Angriff",
        "Passende Widerlegungsform",
        "Tragfähige Schlussfolgerung",
        "Kein Fehlschluss"
      ]
    };
  }

  const failedCore = criteria.filter(
    (criterion) =>
      ["relevance", "form", "inference", "fallacy"].includes(criterion.id) && !criterion.passed
  );

  return {
    outcome: "full-hit",
    label: "Volltreffer",
    summary:
      "Ein Volltreffer zählt, sobald die Abwehr den Kern des Angriffs verfehlt, logisch nicht trägt, in einen Fehlschluss kippt oder fristlich scheitert.",
    triggers: failedCore.map((criterion) => criterion.label)
  };
}

function evaluateDefense(attackCard, defenseCard, isValid) {
  const attackProfile = getCardLogicProfile(attackCard.id);
  const defenseProfile = getCardLogicProfile(defenseCard.id);

  if (isValid) {
    const criteria = [
      {
        id: "claim",
        label: "These und Prämissen klar",
        passed: true,
        note: `"${attackCard.title}" formuliert eine erkennbare These mit Begründung.`
      },
      {
        id: "relevance",
        label: "Direkter Bezug",
        passed: true,
        note: `"${defenseCard.title}" trifft den Kern von "${attackCard.title}".`
      },
      {
        id: "form",
        label: "Passende Schlussart",
        passed: true,
        note: `${defenseProfile.label}: ${defenseProfile.counterUse}.`
      },
      {
        id: "inference",
        label: "Konklusion folgt",
        passed: true,
        note: `Die Widerlegung ist ${defenseProfile.validity} gültig und nicht bloss lose assoziiert.`
      },
      {
        id: "fallacy",
        label: "Kein Fehlschluss",
        passed: true,
        note: "Kein offensichtlicher Trugschluss nach dem Dossier."
      }
    ];

    return {
      verdict: "valid",
      summary: `"${defenseCard.title}" ist als Gegenargument logisch tragfähig.`,
      reasoningLabel: defenseProfile.label,
      validityLevel: defenseProfile.validity,
      fallacy: null,
      criteria,
      impact: buildImpact("valid", criteria),
      explanation: `${defenseProfile.kernel} Darum kann die Abwehr die Angriffslogik entkräften.`,
      attackProfile: attackProfile.label,
      defenseProfile: defenseProfile.label
    };
  }

  const fallacyId = defenseProfile.misfireAs || "non_sequitur";
  const fallacyLabel = FALLACY_LABELS[fallacyId] || "non sequitur";

  const criteria = [
    {
      id: "claim",
      label: "These und Prämissen klar",
      passed: true,
      note: `"${attackCard.title}" hat eine erkennbare argumentative Struktur.`
    },
    {
      id: "relevance",
      label: "Direkter Bezug",
      passed: false,
      note: `"${defenseCard.title}" greift die tragende Prämisse oder Konklusion nicht direkt genug an.`
    },
    {
      id: "form",
      label: "Passende Schlussart",
      passed: false,
      note: `Die Karte aktiviert hier keine passende ${defenseProfile.label.toLowerCase()}e Widerlegung.`
    },
    {
      id: "inference",
      label: "Konklusion folgt",
      passed: false,
      note: "Aus der Abwehr folgt keine ausreichende Widerlegung des Angriffs."
    },
    {
      id: "fallacy",
      label: "Kein Fehlschluss",
      passed: false,
      note: `Die Abwehr kippt hier in Richtung ${fallacyLabel}.`
    }
  ];

  return {
    verdict: "invalid",
    summary: `"${defenseCard.title}" reicht logisch nicht, um "${attackCard.title}" abzuwehren.`,
    reasoningLabel: defenseProfile.label,
    validityLevel: defenseProfile.validity,
    fallacy: {
      id: fallacyId,
      label: fallacyLabel
    },
    criteria,
    impact: buildImpact("invalid", criteria),
    explanation: `${defenseProfile.kernel} In diesem Kontext trifft das Gegenargument den Schluss aber nicht präzise genug.`,
    attackProfile: attackProfile.label,
    defenseProfile: defenseProfile.label
  };
}

module.exports = {
  LOGIC_REFERENCE,
  getCardLogicProfile,
  evaluateDefense
};
