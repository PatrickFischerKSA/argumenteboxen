const express = require("express");
const http = require("http");
const path = require("path");
const crypto = require("crypto");
const { WebSocketServer } = require("ws");
const { CARD_LIBRARY, SIDE_DECKS, getPublicCard } = require("./src/cards");
const {
  LOGIC_REFERENCE,
  getCardLogicProfile,
  evaluateDefense
} = require("./src/logic-rubric");
const {
  sanitizeTextMove,
  inferCardFromText,
  evaluateTextDefense,
  buildBotText
} = require("./src/text-judge");

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || "0.0.0.0";
const HITS_TO_KO = 3;
const CARD_TURN_TIME_MS = 30_000;
const TEXT_TURN_TIME_MS = 90_000;
const BOT_DELAY_MIN_MS = 900;
const BOT_DELAY_MAX_MS = 1700;
const DEMO_DELAY_MIN_MS = 380;
const DEMO_DELAY_MAX_MS = 760;

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(express.static(path.join(__dirname, "public")));

const rooms = new Map();
const socketIndex = new Map();

function sanitizeName(input, fallback) {
  if (typeof input !== "string") {
    return fallback;
  }

  const trimmed = input.trim().replace(/\s+/g, " ");
  return trimmed.slice(0, 24) || fallback;
}

function sanitizeMatchMode(input) {
  return input === "solo" || input === "demo" ? input : "duel";
}

function sanitizePlayLevel(input) {
  return input === "free_text" ? "free_text" : "cards";
}

function makeRoomCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

  while (true) {
    const code = Array.from({ length: 5 }, () => {
      const randomIndex = crypto.randomInt(0, alphabet.length);
      return alphabet[randomIndex];
    }).join("");

    if (!rooms.has(code)) {
      return code;
    }
  }
}

function randomDelay(room) {
  if (room?.matchMode === "demo") {
    return crypto.randomInt(DEMO_DELAY_MIN_MS, DEMO_DELAY_MAX_MS + 1);
  }

  return crypto.randomInt(BOT_DELAY_MIN_MS, BOT_DELAY_MAX_MS + 1);
}

function pickRandom(items) {
  if (!items.length) {
    return null;
  }

  return items[crypto.randomInt(0, items.length)];
}

function makePlayer(socket, name, side, isHost, options = {}) {
  return {
    id: options.id || (socket ? socket.id : crypto.randomUUID()),
    socket,
    name,
    side,
    isHost,
    isBot: Boolean(options.isBot),
    connected: true,
    hand: [...SIDE_DECKS[side]]
  };
}

function createRoom(hostSocket, name, options = {}) {
  const code = makeRoomCode();
  const matchMode = sanitizeMatchMode(options.matchMode);
  const playLevel = sanitizePlayLevel(options.playLevel);
  const room = {
    code,
    matchMode,
    playLevel,
    status: "lobby",
    phase: "lobby",
    createdAt: Date.now(),
    players: new Map(),
    order: [],
    activePlayerId: null,
    pendingAttack: null,
    turnTimer: null,
    aiTurnHandle: null,
    damage: { pro: 0, contra: 0 },
    usedCards: new Set(),
    history: [],
    logicJudgement: null,
    demoNarration: null,
    motionCue: null,
    cueId: 0,
    winnerSide: null,
    statusText:
      matchMode === "demo"
        ? "Demo bereit. Starte den automatischen Showkampf mit Erklärungen."
        : matchMode === "solo"
        ? "Computer steht bereit. Du kannst den Kampf sofort starten."
        : "Warte auf die zweite Spielerin oder den zweiten Spieler."
  };

  const host = makePlayer(
    hostSocket,
    sanitizeName(name, matchMode === "demo" ? "Demo Rot" : "Känguru Rot"),
    "pro",
    true,
    { isBot: matchMode === "demo" }
  );
  room.players.set(host.id, host);
  room.order.push(host.id);
  rooms.set(code, room);
  socketIndex.set(hostSocket.id, { roomCode: code, playerId: host.id });
  hostSocket.roomCode = code;
  hostSocket.playerId = host.id;

  if (matchMode === "solo" || matchMode === "demo") {
    const bot = makePlayer(null, matchMode === "demo" ? "Demo Blau" : "Computer Blau", "contra", false, {
      isBot: true
    });
    room.players.set(bot.id, bot);
    room.order.push(bot.id);
  }

  if (matchMode === "demo") {
    room.demoNarration = {
      title: "Demo bereit",
      body: "Dieses Match läuft vollautomatisch ab. Beobachte Angriffe, Gegenargumente, Zeitregeln und den Wechsel der Initiative."
    };
  }

  return room;
}

function joinRoom(socket, roomCode, name) {
  const room = rooms.get(roomCode);
  if (!room) {
    return { error: "Dieser Raumcode existiert nicht." };
  }

  if (room.matchMode !== "duel") {
    return { error: "Dieser Raum läuft im Solo-Modus und kann nicht beigetreten werden." };
  }

  if (room.status !== "lobby") {
    return { error: "Das Match in diesem Raum läuft bereits." };
  }

  if (room.order.length >= 2) {
    return { error: "Der Raum ist bereits voll." };
  }

  const player = makePlayer(socket, sanitizeName(name, "Känguru Blau"), "contra", false);
  room.players.set(player.id, player);
  room.order.push(player.id);
  room.statusText = "Beide Kängurus sind bereit. Die Host-Seite kann den Kampf starten.";
  socketIndex.set(socket.id, { roomCode, playerId: player.id });
  socket.roomCode = roomCode;
  socket.playerId = player.id;

  return { room };
}

function nextCue(room, payload) {
  room.cueId += 1;
  room.motionCue = {
    id: room.cueId,
    ...payload
  };
}

function getTurnTimeMs(room) {
  return room.playLevel === "free_text" ? TEXT_TURN_TIME_MS : CARD_TURN_TIME_MS;
}

function turnSeconds(room) {
  return Math.floor(getTurnTimeMs(room) / 1000);
}

function clearTurnTimer(room) {
  if (!room.turnTimer) {
    return;
  }

  clearTimeout(room.turnTimer.handle);
  room.turnTimer = null;
}

function clearAiTurn(room) {
  if (!room.aiTurnHandle) {
    return;
  }

  clearTimeout(room.aiTurnHandle);
  room.aiTurnHandle = null;
}

function getOpponentId(room, playerId) {
  return room.order.find((id) => id !== playerId) || null;
}

function getPendingAttackLabel(pendingAttack) {
  if (!pendingAttack) {
    return "Argument";
  }

  return pendingAttack.displayText || "Argument";
}

function excerptText(text, maxLength = 80) {
  const clean = sanitizeTextMove(text);
  if (clean.length <= maxLength) {
    return clean;
  }

  return `${clean.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

function startTurnTimer(room) {
  clearTurnTimer(room);

  if (room.status !== "active" || !room.activePlayerId) {
    return;
  }

  const durationMs = getTurnTimeMs(room);
  const timerId = crypto.randomUUID();
  room.turnTimer = {
    id: timerId,
    deadlineAt: Date.now() + durationMs,
    durationMs,
    handle: setTimeout(() => resolveTurnTimeout(room, timerId), durationMs)
  };
}

function resetRoomForMatch(room) {
  clearTurnTimer(room);
  clearAiTurn(room);
  room.status = "active";
  room.phase = "attack";
  room.activePlayerId = room.order[0] || null;
  room.pendingAttack = null;
  room.damage = { pro: 0, contra: 0 };
  room.usedCards = new Set();
  room.history = [];
  room.winnerSide = null;
  room.logicJudgement = null;

  room.order.forEach((playerId) => {
    const player = room.players.get(playerId);
    if (!player) {
      return;
    }

    player.hand = [...SIDE_DECKS[player.side]];
  });
}

function serializePlayer(room, playerId, viewerId) {
  const player = room.players.get(playerId);
  if (!player) {
    return null;
  }

  return {
    id: player.id,
    name: player.name,
    side: player.side,
    isHost: player.isHost,
    isBot: player.isBot,
    connected: player.connected,
    isYou: player.id === viewerId,
    hitsTaken: room.damage[player.side],
    cardsRemaining:
      room.playLevel === "cards"
        ? player.hand.filter((cardId) => !room.usedCards.has(cardId)).length
        : null
  };
}

function buildPrompt(room, viewerId) {
  const levelLabel = room.playLevel === "free_text" ? "Freitext" : "Karten";

  if (room.status === "lobby") {
    if (room.matchMode === "demo") {
      return room.order[0] === viewerId
        ? "Starte den Demo-Modus. Danach läuft das ganze Match automatisch mit Erklärungen ab."
        : "Die Demo wartet auf den Start.";
    }

    if (room.matchMode === "solo") {
      return room.order[0] === viewerId
        ? room.playLevel === "free_text"
          ? "Starte den Solo-Freikampf. Im zweiten Level gilt je Zug eine 90-Sekunden-Frist."
          : "Starte das Solo-Match gegen den Computer."
        : "Computer wartet.";
    }

    if (room.order.length < 2) {
      return "Teile den Raumcode und warte auf das gegnerische Känguru.";
    }

    return room.order[0] === viewerId
      ? "Starte das Match, sobald beide bereit sind."
      : "Die Host-Seite kann den Kampf jetzt eröffnen.";
  }

  if (room.status === "finished") {
    if (room.matchMode === "demo") {
      return "Die Demo ist beendet. Du kannst den Showkampf erneut starten.";
    }

    if (!room.winnerSide) {
      return "Match beendet.";
    }

    return room.order[0] === viewerId
      ? `${room.winnerSide === "pro" ? "Pro" : "Contra"} gewinnt. Du kannst eine Revanche starten.`
      : `${room.winnerSide === "pro" ? "Pro" : "Contra"} gewinnt. Warte auf die Revanche.`;
  }

  const active = room.players.get(room.activePlayerId);
  if (!active) {
    return "Warte auf die nächste Aktion.";
  }

  const deadline = turnSeconds(room);

  if (room.matchMode === "demo") {
    return room.playLevel === "free_text"
      ? `Die Demo führt gerade automatisch einen Freitext-Zug mit ${deadline} Sekunden Zugzeit aus.`
      : `Die Demo führt gerade automatisch einen Kartenzug mit ${deadline} Sekunden Zugzeit aus.`;
  }

  if (room.phase === "attack") {
    if (active.id === viewerId) {
      return room.playLevel === "free_text"
        ? `Tippe innerhalb von ${deadline} Sekunden dein Angriffsargument ein.`
        : "Wähle ein Angriffsargument aus deiner Hand.";
    }

    return active.isBot
      ? `Der Computer bereitet gerade einen ${levelLabel.toLowerCase()}-Angriff vor.`
      : `${active.name} bereitet gerade einen Angriff vor.`;
  }

  if (room.phase === "defend" && room.pendingAttack) {
    const attacker = room.players.get(room.pendingAttack.attackerId);
    if (active.id === viewerId) {
      return room.playLevel === "free_text"
        ? `Wehre "${getPendingAttackLabel(room.pendingAttack)}" innerhalb von ${deadline} Sekunden mit einem Gegenargument ab.`
        : `Wehre ${attacker.name}s Angriff "${getPendingAttackLabel(room.pendingAttack)}" mit einem passenden Gegenargument ab.`;
    }

    return active.isBot
      ? `Der Computer verteidigt sich gerade gegen "${getPendingAttackLabel(room.pendingAttack)}".`
      : `${active.name} verteidigt sich gegen "${getPendingAttackLabel(room.pendingAttack)}".`;
  }

  return "Warte auf die nächste Aktion.";
}

function serializePendingAttack(room) {
  if (!room.pendingAttack) {
    return null;
  }

  return {
    attackerId: room.pendingAttack.attackerId,
    defenderId: room.pendingAttack.defenderId,
    attackerSide: room.pendingAttack.attackerSide,
    kind: room.pendingAttack.kind,
    card: room.pendingAttack.cardId ? getPublicCard(room.pendingAttack.cardId) : null,
    validCounterIds:
      room.pendingAttack.kind === "card" && room.pendingAttack.cardId
        ? [...CARD_LIBRARY[room.pendingAttack.cardId].validCounters]
        : [],
    text: room.pendingAttack.kind === "text" ? room.pendingAttack.text : null,
    displayText: room.pendingAttack.displayText
  };
}

function serializeRoom(room, viewerId) {
  const viewer = room.players.get(viewerId);

  return {
    type: "state",
    roomCode: room.code,
    matchMode: room.matchMode,
    playLevel: room.playLevel,
    status: room.status,
    phase: room.phase,
    hitsToKO: HITS_TO_KO,
    turnTimeMs: getTurnTimeMs(room),
    activePlayerId: room.activePlayerId,
    winnerSide: room.winnerSide,
    statusText: room.statusText,
    prompt: buildPrompt(room, viewerId),
    canStart:
      room.status === "lobby" &&
      room.order.length === 2 &&
      room.order[0] === viewerId,
    canRematch:
      room.status === "finished" &&
      room.order.length === 2 &&
      room.order[0] === viewerId,
    user: viewer
      ? {
          id: viewer.id,
          side: viewer.side,
          name: viewer.name,
          isBot: viewer.isBot
        }
      : null,
    players: room.order
      .map((playerId) => serializePlayer(room, playerId, viewerId))
      .filter(Boolean),
    pendingAttack: serializePendingAttack(room),
    history: room.history.slice(-8),
    turnTimer: room.turnTimer
      ? {
          deadlineAt: room.turnTimer.deadlineAt,
          durationMs: room.turnTimer.durationMs
        }
      : null,
    logicJudgement: room.logicJudgement,
    demoNarration: room.demoNarration,
    logicReference: LOGIC_REFERENCE,
    motionCue: room.motionCue,
    yourHand: viewer
      ? viewer.hand.map((cardId) => {
          const card = CARD_LIBRARY[cardId];
          const logic = getCardLogicProfile(cardId);
          return {
            id: card.id,
            side: card.side,
            title: card.title,
            hook: card.hook,
            detail: card.detail,
            logicLabel: logic.label,
            logicValidity: logic.validity,
            used: room.playLevel === "cards" ? room.usedCards.has(cardId) : false
          };
        })
      : []
  };
}

function broadcastRoom(room) {
  room.order.forEach((playerId) => {
    const player = room.players.get(playerId);
    if (!player || !player.socket || player.socket.readyState !== player.socket.OPEN) {
      return;
    }

    player.socket.send(JSON.stringify(serializeRoom(room, playerId)));
  });
}

function publishRoom(room) {
  broadcastRoom(room);
  maybeScheduleBotTurn(room);
}

function sendNotice(socket, message, level = "error") {
  if (!socket || socket.readyState !== socket.OPEN) {
    return;
  }

  socket.send(
    JSON.stringify({
      type: "notice",
      level,
      message
    })
  );
}

function addHistory(room, entry) {
  room.history.push({
    id: room.history.length + 1,
    timestamp: Date.now(),
    ...entry
  });
}

function setDemoNarration(room, title, body) {
  if (room.matchMode !== "demo") {
    return;
  }

  room.demoNarration = {
    title,
    body
  };
}

function startMatch(socket) {
  const room = rooms.get(socket.roomCode);
  if (!room) {
    return sendNotice(socket, "Kein Raum gefunden.");
  }

  if (room.order[0] !== socket.playerId) {
    return sendNotice(socket, "Nur die Host-Seite darf den Kampf starten.");
  }

  if (room.order.length !== 2) {
    return sendNotice(socket, "Es müssen genau zwei Gegner im Raum bereitstehen.");
  }

  if (room.status === "active") {
    return sendNotice(socket, "Das Match läuft bereits.");
  }

  const isRematch = room.status === "finished";
  resetRoomForMatch(room);
  setDemoNarration(
    room,
    "Demo gestartet",
    room.playLevel === "free_text"
      ? "Die Demo zeigt jetzt einen vollständigen Freitextkampf. Achte darauf, wie eigene Formulierungen logisch bewertet werden."
      : "Die Demo zeigt jetzt einen vollständigen Kartenkampf. Achte auf Angriff, passende Abwehr, Volltreffer und Initiative-Wechsel."
  );
  room.statusText =
    room.playLevel === "free_text"
      ? isRematch
        ? "Revanche im Freitext-Level: Pro eröffnet die neue Runde."
        : "Freitext-Level: Pro eröffnet die Runde mit 90 Sekunden Zeit."
      : isRematch
        ? "Revanche: Pro eröffnet den neuen Schlagabtausch."
        : "Runde 1: Pro eröffnet den Schlagabtausch.";
  nextCue(room, {
    type: "match-start",
    attackerSide: "pro",
    defenderSide: "contra",
    headline: "Die Arena bebt",
    rematch: isRematch
  });
  addHistory(room, {
    result: isRematch ? "rematch-start" : "start",
    headline: isRematch ? "Revanche" : "Matchstart",
    body:
      room.playLevel === "free_text"
        ? "Das zweite Level startet: Jetzt wird mit eigenem Text argumentiert."
        : isRematch
          ? "Ein neues Match beginnt im selben Raum."
          : "Pro eröffnet den ersten Schlagabtausch."
  });
  startTurnTimer(room);
  publishRoom(room);
}

function finishMatch(room, winnerSide, loserSide, details = {}) {
  clearTurnTimer(room);
  clearAiTurn(room);
  room.status = "finished";
  room.phase = "finished";
  room.winnerSide = winnerSide;
  room.activePlayerId = null;
  room.pendingAttack = null;
  room.statusText = `${winnerSide === "pro" ? "Pro" : "Contra"} gewinnt durch KO. Host kann die Revanche starten.`;
  setDemoNarration(
    room,
    "Demo beendet",
    `${winnerSide === "pro" ? "Pro" : "Contra"} gewinnt durch KO. In der Demo sieht man hier besonders gut, wie sich Trefferketten und misslungene Abwehr aufbauen.`
  );
  nextCue(room, {
    type: "ko",
    attackerSide: winnerSide,
    defenderSide: loserSide,
    attackTitle: details.attackLabel || "KO-Treffer",
    defenseTitle: details.defenseLabel || null,
    headline: "KO"
  });
}

function resolveTurnTimeout(room, timerId) {
  if (!room.turnTimer || room.turnTimer.id !== timerId || room.status !== "active") {
    return;
  }

  const timedOutPlayer = room.players.get(room.activePlayerId);
  if (!timedOutPlayer) {
    clearTurnTimer(room);
    return;
  }

  const seconds = turnSeconds(room);

  if (room.phase === "attack") {
    const opponentId = getOpponentId(room, timedOutPlayer.id);
    const opponent = room.players.get(opponentId);
    room.activePlayerId = opponentId;
    room.pendingAttack = null;
    room.logicJudgement = null;
    room.statusText = `${timedOutPlayer.name} hat die ${seconds} Sekunden für den Angriff verpasst. ${opponent.name} übernimmt die Initiative.`;
    setDemoNarration(
      room,
      "Zeitregel im Angriff",
      `${timedOutPlayer.name} war zu spät. In der Demo sieht man hier: Wer die Frist für den Angriff verpasst, verliert ohne Treffer die Initiative.`
    );
    nextCue(room, {
      type: "timeout-turnover",
      attackerSide: timedOutPlayer.side,
      defenderSide: opponent.side,
      headline: "Zeitstrafe"
    });
    addHistory(room, {
      result: "timeout-turnover",
      headline: `${timedOutPlayer.name} war zu spät`,
      body: `Die Angriffsfrist von ${seconds} Sekunden ist abgelaufen. ${opponent.name} übernimmt ohne Treffer.`
    });
    startTurnTimer(room);
    publishRoom(room);
    return;
  }

  if (room.phase === "defend" && room.pendingAttack) {
    const attackCard = room.pendingAttack.cardId
      ? CARD_LIBRARY[room.pendingAttack.cardId]
      : inferCardFromText(room.pendingAttack.text, room.pendingAttack.attackerSide).card;
    const attacker = room.players.get(room.pendingAttack.attackerId);
    const defender = timedOutPlayer;
    room.logicJudgement = {
      verdict: "invalid",
      summary: `${defender.name} hat die Abwehrfrist verpasst.`,
      reasoningLabel: "Zeitregel",
      validityLevel: "ungültig",
      fallacy: {
        id: "non_sequitur",
        label: "keine rechtzeitige Widerlegung"
      },
      criteria: [
        {
          id: "claim",
          label: "These und Prämissen klar",
          passed: true,
          note: `"${getPendingAttackLabel(room.pendingAttack)}" bleibt unwidersprochen stehen.`
        },
        {
          id: "relevance",
          label: "Direkter Bezug",
          passed: false,
          note: `Es wurde innerhalb von ${seconds} Sekunden kein Gegenargument eingebracht.`
        },
        {
          id: "form",
          label: "Passende Schlussart",
          passed: false,
          note: "Ohne fristgerechte Abwehr gibt es keine prüfbare Schlussform."
        },
        {
          id: "inference",
          label: "Konklusion folgt",
          passed: false,
          note: "Die Angriffslogik bleibt in dieser Runde bestehen."
        },
        {
          id: "fallacy",
          label: "Kein Fehlschluss",
          passed: false,
          note: "Die Verteidigung scheitert bereits an der verpassten Frist."
        }
      ],
      explanation: `Die ${seconds} Sekunden für die Abwehr sind abgelaufen. "${getPendingAttackLabel(room.pendingAttack)}" trifft deshalb ohne rechtzeitige Widerlegung.`,
      attackProfile: getCardLogicProfile(attackCard.id).label,
      defenseProfile: "keine Abwehr"
    };

    room.damage[defender.side] += 1;
    const hitsTaken = room.damage[defender.side];
    const attackLabel = getPendingAttackLabel(room.pendingAttack);
    addHistory(room, {
      result: hitsTaken >= HITS_TO_KO ? "ko-hit" : "hit",
      headline: `${attacker.name} profitiert vom Ablauf der Zeit`,
      body: `${defender.name} hat die Abwehrfrist verpasst und kassiert Treffer ${hitsTaken}/${HITS_TO_KO}.`,
      attackerSide: attacker.side,
      defenderSide: defender.side,
      attackTitle: attackLabel
    });

    if (hitsTaken >= HITS_TO_KO) {
      finishMatch(room, attacker.side, defender.side, {
        attackLabel
      });
      publishRoom(room);
      return;
    }

    room.phase = "attack";
    room.activePlayerId = attacker.id;
    room.pendingAttack = null;
    room.statusText = `${defender.name} hat die ${seconds} Sekunden zur Abwehr verpasst. ${attacker.name} bleibt in der Offensive.`;
    setDemoNarration(
      room,
      "Zeitregel in der Abwehr",
      `${defender.name} hat kein Gegenargument rechtzeitig eingebracht. In der Demo zählt das als Volltreffer für ${attacker.name}.`
    );
    nextCue(room, {
      type: "timeout-hit",
      attackerSide: attacker.side,
      defenderSide: defender.side,
      attackTitle: attackLabel,
      damage: hitsTaken,
      headline: "Zeitdruck-Treffer"
    });
    startTurnTimer(room);
    publishRoom(room);
    return;
  }

  clearTurnTimer(room);
}

function validatePlayableTurn(room, playerId) {
  if (room.status !== "active") {
    return "Das Match ist noch nicht aktiv.";
  }

  if (room.activePlayerId !== playerId) {
    return "Im Moment ist das andere Känguru am Zug.";
  }

  return null;
}

function performCardPlay(room, playerId, cardId) {
  if (room.playLevel !== "cards") {
    return { error: "In diesem Level werden Argumente als Freitext gespielt." };
  }

  const turnError = validatePlayableTurn(room, playerId);
  if (turnError) {
    return { error: turnError };
  }

  const player = room.players.get(playerId);
  const card = CARD_LIBRARY[cardId];

  if (!player || !card) {
    return { error: "Diese Karte gibt es nicht." };
  }

  if (card.side !== player.side) {
    return { error: "Du kannst nur Karten deiner Seite spielen." };
  }

  if (!player.hand.includes(cardId)) {
    return { error: "Diese Karte gehört nicht zu deiner Hand." };
  }

  if (room.usedCards.has(cardId)) {
    return { error: "Diese Karte wurde bereits verbraucht." };
  }

  if (room.phase === "attack") {
    clearTurnTimer(room);
    const defenderId = getOpponentId(room, player.id);
    const defender = room.players.get(defenderId);
    if (!defender) {
      return { error: "Es fehlt eine Gegenseite im Raum." };
    }

    room.usedCards.add(cardId);
    room.pendingAttack = {
      kind: "card",
      attackerId: player.id,
      defenderId,
      attackerSide: player.side,
      cardId,
      displayText: card.title,
      text: card.hook
    };
    room.phase = "defend";
    room.activePlayerId = defenderId;
    room.statusText = `${player.name} greift mit "${card.title}" an.`;
    room.logicJudgement = null;
    setDemoNarration(
      room,
      "Neuer Angriff",
      `${player.name} eröffnet mit "${card.title}". Jetzt prüft die Gegenseite, welches Gegenargument den Kern dieses Angriffs direkt trifft.`
    );
    nextCue(room, {
      type: "attack",
      attackerSide: player.side,
      defenderSide: defender.side,
      attackTitle: card.title,
      headline: "Argumentenschlag"
    });
    addHistory(room, {
      result: "attack",
      headline: `${player.name} greift an`,
      body: `"${card.title}" setzt die Gegenseite unter Druck.`,
      attackerSide: player.side,
      attackTitle: card.title
    });
    startTurnTimer(room);
    return { ok: true };
  }

  if (room.phase !== "defend" || !room.pendingAttack) {
    return { error: "Gerade kann kein Gegenargument gespielt werden." };
  }

  if (room.pendingAttack.defenderId !== player.id) {
    return { error: "Nur die verteidigende Seite darf jetzt reagieren." };
  }

  room.usedCards.add(cardId);
  clearTurnTimer(room);

  const attackCard = CARD_LIBRARY[room.pendingAttack.cardId];
  const attacker = room.players.get(room.pendingAttack.attackerId);
  const defender = player;
  const valid = attackCard.validCounters.includes(card.id);
  room.logicJudgement = evaluateDefense(attackCard, card, valid);

  if (valid) {
    room.phase = "attack";
    room.activePlayerId = defender.id;
    room.pendingAttack = null;
    room.statusText = `${defender.name} blockt erfolgreich und übernimmt die Initiative.`;
    setDemoNarration(
      room,
      "Valide Abwehr",
      `${defender.name} pariert mit "${card.title}". Diese Abwehr gilt, weil sie "${attackCard.title}" direkt trifft und damit die Initiative wechselt.`
    );
    nextCue(room, {
      type: "counter",
      attackerSide: attacker.side,
      defenderSide: defender.side,
      attackTitle: attackCard.title,
      defenseTitle: card.title,
      headline: "Saubere Parade"
    });
    addHistory(room, {
      result: "counter",
      headline: `${defender.name} pariert`,
      body: `"${card.title}" neutralisiert "${attackCard.title}".`,
      attackerSide: attacker.side,
      defenderSide: defender.side,
      attackTitle: attackCard.title,
      defenseTitle: card.title
    });
    startTurnTimer(room);
    return { ok: true };
  }

  room.damage[defender.side] += 1;
  const hitsTaken = room.damage[defender.side];
  addHistory(room, {
    result: hitsTaken >= HITS_TO_KO ? "ko-hit" : "hit",
    headline: `${attacker.name} landet einen Volltreffer`,
    body: `"${card.title}" reicht nicht gegen "${attackCard.title}". ${defender.name} kassiert Treffer ${hitsTaken}/${HITS_TO_KO}.`,
    attackerSide: attacker.side,
    defenderSide: defender.side,
    attackTitle: attackCard.title,
    defenseTitle: card.title
  });

  if (hitsTaken >= HITS_TO_KO) {
    finishMatch(room, attacker.side, defender.side, {
      attackLabel: attackCard.title,
      defenseLabel: card.title
    });
    return { ok: true };
  }

  room.phase = "attack";
  room.activePlayerId = attacker.id;
  room.pendingAttack = null;
  room.statusText = `${attacker.name} bleibt nach dem Treffer in der Offensive.`;
  setDemoNarration(
    room,
    "Volltreffer",
    `${defender.name} reagiert mit "${card.title}", aber das reicht nicht gegen "${attackCard.title}". Deshalb bleibt ${attacker.name} im Angriff.`
  );
  nextCue(room, {
    type: "hit",
    attackerSide: attacker.side,
    defenderSide: defender.side,
    attackTitle: attackCard.title,
    defenseTitle: card.title,
    damage: hitsTaken,
    headline: "Volltreffer"
  });
  startTurnTimer(room);
  return { ok: true };
}

function performTextMove(room, playerId, rawText) {
  if (room.playLevel !== "free_text") {
    return { error: "In diesem Level werden Karten gespielt." };
  }

  const turnError = validatePlayableTurn(room, playerId);
  if (turnError) {
    return { error: turnError };
  }

  const player = room.players.get(playerId);
  const text = sanitizeTextMove(rawText);
  if (!player || text.length < 18) {
    return { error: "Bitte gib ein etwas ausgearbeitetes Argument mit mindestens 18 Zeichen ein." };
  }

  if (room.phase === "attack") {
    clearTurnTimer(room);
    const defenderId = getOpponentId(room, player.id);
    const defender = room.players.get(defenderId);
    if (!defender) {
      return { error: "Es fehlt eine Gegenseite im Raum." };
    }

    const inference = inferCardFromText(text, player.side);
    room.pendingAttack = {
      kind: "text",
      attackerId: player.id,
      defenderId,
      attackerSide: player.side,
      cardId: inference.card.id,
      text,
      displayText: excerptText(text, 78),
      inferenceConfidence: inference.confidence
    };
    room.phase = "defend";
    room.activePlayerId = defenderId;
    room.statusText = `${player.name} bringt ein Freitext-Argument an.`;
    room.logicJudgement = null;
    setDemoNarration(
      room,
      "Freitext-Angriff",
      `${player.name} formuliert ein eigenes Argument. Die Demo zeigt jetzt, wie dieses Argument einem Muster zugeordnet und von der Gegenseite logisch beantwortet wird.`
    );
    nextCue(room, {
      type: "attack",
      attackerSide: player.side,
      defenderSide: defender.side,
      attackTitle: excerptText(text, 66),
      headline: "Freitext-Angriff"
    });
    addHistory(room, {
      result: "attack",
      headline: `${player.name} greift im Freitext-Level an`,
      body: `"${excerptText(text, 140)}"`,
      attackerSide: player.side,
      attackTitle: excerptText(text, 66)
    });
    startTurnTimer(room);
    return { ok: true };
  }

  if (room.phase !== "defend" || !room.pendingAttack) {
    return { error: "Gerade kann kein Gegenargument eingegeben werden." };
  }

  if (room.pendingAttack.defenderId !== player.id) {
    return { error: "Nur die verteidigende Seite darf jetzt reagieren." };
  }

  clearTurnTimer(room);

  const attacker = room.players.get(room.pendingAttack.attackerId);
  const defender = player;
  const evaluation = evaluateTextDefense({
    attackText: room.pendingAttack.text,
    defenseText: text,
    attackSide: attacker.side,
    defenseSide: defender.side
  });
  room.logicJudgement = evaluation.judgement;
  const attackLabel = getPendingAttackLabel(room.pendingAttack);
  const defenseLabel = excerptText(text, 78);

  if (evaluation.isValid) {
    room.phase = "attack";
    room.activePlayerId = defender.id;
    room.pendingAttack = null;
    room.statusText = `${defender.name} kontert im Freitext-Level erfolgreich und übernimmt die Initiative.`;
    setDemoNarration(
      room,
      "Treffendes Gegenargument",
      `${defender.name} kontert mit einem eigenen Text erfolgreich. In der Demo sieht man hier, dass nicht die Formulierung allein, sondern die logische Passung zum Angriff zählt.`
    );
    nextCue(room, {
      type: "counter",
      attackerSide: attacker.side,
      defenderSide: defender.side,
      attackTitle: attackLabel,
      defenseTitle: defenseLabel,
      headline: "Treffendes Gegenargument"
    });
    addHistory(room, {
      result: "counter",
      headline: `${defender.name} pariert mit eigenem Text`,
      body: `"${defenseLabel}" entkräftet "${attackLabel}".`,
      attackerSide: attacker.side,
      defenderSide: defender.side,
      attackTitle: attackLabel,
      defenseTitle: defenseLabel
    });
    startTurnTimer(room);
    return { ok: true };
  }

  room.damage[defender.side] += 1;
  const hitsTaken = room.damage[defender.side];
  addHistory(room, {
    result: hitsTaken >= HITS_TO_KO ? "ko-hit" : "hit",
    headline: `${attacker.name} landet im Freitext-Level einen Treffer`,
    body: `"${defenseLabel}" reicht nicht gegen "${attackLabel}". ${defender.name} kassiert Treffer ${hitsTaken}/${HITS_TO_KO}.`,
    attackerSide: attacker.side,
    defenderSide: defender.side,
    attackTitle: attackLabel,
    defenseTitle: defenseLabel
  });

  if (hitsTaken >= HITS_TO_KO) {
    finishMatch(room, attacker.side, defender.side, {
      attackLabel,
      defenseLabel
    });
    return { ok: true };
  }

  room.phase = "attack";
  room.activePlayerId = attacker.id;
  room.pendingAttack = null;
  room.statusText = `${attacker.name} bleibt nach dem Freitext-Treffer in der Offensive.`;
  setDemoNarration(
    room,
    "Freitext-Treffer",
    `${defender.name}s Freitext-Abwehr reicht logisch nicht aus. Deshalb zählt der Angriff weiter als Treffer und ${attacker.name} bleibt vorne.`
  );
  nextCue(room, {
    type: "hit",
    attackerSide: attacker.side,
    defenderSide: defender.side,
    attackTitle: attackLabel,
    defenseTitle: defenseLabel,
    damage: hitsTaken,
    headline: "Volltreffer"
  });
  startTurnTimer(room);
  return { ok: true };
}

function maybeScheduleBotTurn(room) {
  clearAiTurn(room);

  if (room.status !== "active" || !room.activePlayerId) {
    return;
  }

  const activePlayer = room.players.get(room.activePlayerId);
  if (!activePlayer || !activePlayer.isBot) {
    return;
  }

  room.aiTurnHandle = setTimeout(() => {
    room.aiTurnHandle = null;
    handleBotTurn(room);
  }, randomDelay(room));
}

function chooseBotCard(room, bot) {
  const available = bot.hand.filter((cardId) =>
    room.playLevel === "cards" ? !room.usedCards.has(cardId) : true
  );

  if (!available.length) {
    return null;
  }

  if (room.phase === "defend" && room.pendingAttack?.cardId) {
    const attackCard = CARD_LIBRARY[room.pendingAttack.cardId];
    const validCounters = attackCard.validCounters.filter((cardId) => available.includes(cardId));
    const invalidCounters = available.filter((cardId) => !validCounters.includes(cardId));
    const preferValid = validCounters.length > 0 && Math.random() < 0.78;
    const choicePool = preferValid
      ? validCounters
      : invalidCounters.length
        ? invalidCounters
        : validCounters;
    return CARD_LIBRARY[pickRandom(choicePool)];
  }

  return CARD_LIBRARY[pickRandom(available)];
}

function handleBotTurn(room) {
  if (room.status !== "active") {
    return;
  }

  const bot = room.players.get(room.activePlayerId);
  if (!bot || !bot.isBot) {
    return;
  }

  let card = chooseBotCard(room, bot);
  if (!card) {
    if (room.matchMode === "demo" && room.playLevel === "cards") {
      room.usedCards = new Set();
      addHistory(room, {
        result: "demo-refresh",
        headline: "Demo-Karten werden neu gemischt",
        body: "Damit der Showkampf sicher bis zum KO durchläuft, stehen alle Karten noch einmal bereit."
      });
      setDemoNarration(
        room,
        "Neue Demo-Runde",
        "Alle Karten sind wieder freigegeben. So kann der Demo-Kampf im Kartenmodus sicher bis zum KO weiterlaufen."
      );
      card = chooseBotCard(room, bot);
    }
  }

  if (!card) {
    return;
  }

  if (room.playLevel === "cards") {
    const result = performCardPlay(room, bot.id, card.id);
    if (result.error) {
      return;
    }

    publishRoom(room);
    return;
  }

  const role = room.phase === "defend" ? "defense" : "attack";
  const text = buildBotText(card, role);
  const result = performTextMove(room, bot.id, text);
  if (result.error) {
    return;
  }

  publishRoom(room);
}

function playCard(socket, cardId) {
  const room = rooms.get(socket.roomCode);
  if (!room) {
    return sendNotice(socket, "Raum nicht gefunden.");
  }

  if (room.matchMode === "demo") {
    return sendNotice(socket, "Im Demo-Modus läuft das Match vollständig automatisch ab.", "success");
  }

  const result = performCardPlay(room, socket.playerId, cardId);
  if (result.error) {
    return sendNotice(socket, result.error);
  }

  publishRoom(room);
}

function submitTextMove(socket, text) {
  const room = rooms.get(socket.roomCode);
  if (!room) {
    return sendNotice(socket, "Raum nicht gefunden.");
  }

  if (room.matchMode === "demo") {
    return sendNotice(socket, "Im Demo-Modus läuft das Match vollständig automatisch ab.", "success");
  }

  const result = performTextMove(room, socket.playerId, text);
  if (result.error) {
    return sendNotice(socket, result.error);
  }

  publishRoom(room);
}

function handleDisconnect(socket) {
  const index = socketIndex.get(socket.id);
  if (!index) {
    return;
  }

  socketIndex.delete(socket.id);

  const room = rooms.get(index.roomCode);
  if (!room) {
    return;
  }

  const player = room.players.get(index.playerId);
  if (!player) {
    return;
  }

  if (room.matchMode !== "duel") {
    clearTurnTimer(room);
    clearAiTurn(room);
    rooms.delete(room.code);
    return;
  }

  room.players.delete(player.id);
  room.order = room.order.filter((playerId) => playerId !== player.id);

  if (room.order.length === 0) {
    clearTurnTimer(room);
    clearAiTurn(room);
    rooms.delete(room.code);
    return;
  }

  if (room.status === "active") {
    clearTurnTimer(room);
    clearAiTurn(room);
    room.status = "lobby";
    room.phase = "lobby";
    room.activePlayerId = null;
    room.pendingAttack = null;
    room.statusText = `${player.name} hat die Verbindung verloren. Raum bleibt für eine neue Gegenseite offen.`;
    nextCue(room, {
      type: "disconnect",
      attackerSide: player.side,
      headline: "Unterbruch"
    });
  } else {
    room.statusText = `${player.name} hat den Raum verlassen.`;
  }

  if (room.order[0]) {
    const host = room.players.get(room.order[0]);
    if (host) {
      host.isHost = true;
      if (host.side !== "pro") {
        host.side = "pro";
        host.hand = [...SIDE_DECKS.pro];
      }
    }
  }

  if (room.order[1]) {
    const second = room.players.get(room.order[1]);
    if (second && second.side !== "contra") {
      second.side = "contra";
      second.hand = [...SIDE_DECKS.contra];
    }
  }

  room.damage = { pro: 0, contra: 0 };
  room.usedCards = new Set();
  room.history = room.history.slice(-5);
  room.winnerSide = null;
  room.logicJudgement = null;
  clearTurnTimer(room);
  publishRoom(room);
}

wss.on("connection", (socket) => {
  socket.id = crypto.randomUUID();

  socket.on("message", (raw) => {
    let message;
    try {
      message = JSON.parse(String(raw));
    } catch (error) {
      return sendNotice(socket, "Nachricht konnte nicht gelesen werden.");
    }

    if (message.type === "create_room") {
      const room = createRoom(socket, message.name, {
        matchMode: message.matchMode,
        playLevel: message.playLevel
      });
      return publishRoom(room);
    }

    if (message.type === "join_room") {
      const roomCode = String(message.roomCode || "").trim().toUpperCase();
      const result = joinRoom(socket, roomCode, message.name);
      if (result.error) {
        return sendNotice(socket, result.error);
      }

      return publishRoom(result.room);
    }

    if (message.type === "start_match") {
      return startMatch(socket);
    }

    if (message.type === "play_card") {
      return playCard(socket, String(message.cardId || ""));
    }

    if (message.type === "submit_text_move") {
      return submitTextMove(socket, String(message.text || ""));
    }

    return sendNotice(socket, "Unbekannter Befehl.");
  });

  socket.on("close", () => {
    handleDisconnect(socket);
  });
});

server.listen(PORT, HOST, () => {
  console.log(`argumenteboxen läuft auf http://${HOST === "0.0.0.0" ? "localhost" : HOST}:${PORT}`);
});
