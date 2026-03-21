const express = require("express");
const http = require("http");
const path = require("path");
const crypto = require("crypto");
const { WebSocketServer } = require("ws");
const { CARD_LIBRARY, SIDE_DECKS, getPublicCard } = require("./src/cards");

const PORT = Number(process.env.PORT) || 3000;
const HITS_TO_KO = 3;

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

function makePlayer(socket, name, side, isHost) {
  return {
    id: socket.id,
    socket,
    name,
    side,
    isHost,
    connected: true,
    hand: [...SIDE_DECKS[side]]
  };
}

function createRoom(hostSocket, name) {
  const code = makeRoomCode();
  const room = {
    code,
    status: "lobby",
    phase: "lobby",
    createdAt: Date.now(),
    players: new Map(),
    order: [],
    activePlayerId: null,
    pendingAttack: null,
    damage: { pro: 0, contra: 0 },
    usedCards: new Set(),
    history: [],
    motionCue: null,
    cueId: 0,
    winnerSide: null,
    statusText: "Warte auf die zweite Spielerin oder den zweiten Spieler."
  };

  const host = makePlayer(hostSocket, sanitizeName(name, "Känguru Rot"), "pro", true);
  room.players.set(host.id, host);
  room.order.push(host.id);
  rooms.set(code, room);
  socketIndex.set(hostSocket.id, { roomCode: code, playerId: host.id });
  hostSocket.roomCode = code;
  hostSocket.playerId = host.id;

  return room;
}

function joinRoom(socket, roomCode, name) {
  const room = rooms.get(roomCode);
  if (!room) {
    return { error: "Dieser Raumcode existiert nicht." };
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

function resetRoomForMatch(room) {
  room.status = "active";
  room.phase = "attack";
  room.activePlayerId = room.order[0] || null;
  room.pendingAttack = null;
  room.damage = { pro: 0, contra: 0 };
  room.usedCards = new Set();
  room.history = [];
  room.winnerSide = null;
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
    connected: player.connected,
    isYou: player.id === viewerId,
    hitsTaken: room.damage[player.side],
    cardsRemaining: player.hand.filter((cardId) => !room.usedCards.has(cardId)).length
  };
}

function buildPrompt(room, viewerId) {
  if (room.status === "lobby") {
    if (room.order.length < 2) {
      return "Teile den Raumcode und warte auf das gegnerische Känguru.";
    }

    return room.order[0] === viewerId
      ? "Starte das Match, sobald beide bereit sind."
      : "Die Host-Seite kann den Kampf jetzt eröffnen.";
  }

  if (room.status === "finished") {
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

  if (room.phase === "attack") {
    return active.id === viewerId
      ? "Wähle ein Angriffsargument aus deiner Hand."
      : `${active.name} bereitet gerade einen Angriff vor.`;
  }

  if (room.phase === "defend" && room.pendingAttack) {
    const attacker = room.players.get(room.pendingAttack.attackerId);
    const attackCard = getPublicCard(room.pendingAttack.cardId);
    if (active.id === viewerId) {
      return `Wehre ${attacker.name}s Angriff "${attackCard.title}" mit einem passenden Gegenargument ab.`;
    }

    return `${active.name} verteidigt sich gegen "${attackCard.title}".`;
  }

  return "Warte auf die nächste Aktion.";
}

function serializeRoom(room, viewerId) {
  const viewer = room.players.get(viewerId);

  return {
    type: "state",
    roomCode: room.code,
    status: room.status,
    phase: room.phase,
    hitsToKO: HITS_TO_KO,
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
          name: viewer.name
        }
      : null,
    players: room.order
      .map((playerId) => serializePlayer(room, playerId, viewerId))
      .filter(Boolean),
    pendingAttack: room.pendingAttack
      ? {
          attackerId: room.pendingAttack.attackerId,
          defenderId: room.pendingAttack.defenderId,
          attackerSide: room.pendingAttack.attackerSide,
          card: getPublicCard(room.pendingAttack.cardId)
        }
      : null,
    history: room.history.slice(-8),
    motionCue: room.motionCue,
    yourHand: viewer
      ? viewer.hand.map((cardId) => {
          const card = CARD_LIBRARY[cardId];
          return {
            id: card.id,
            side: card.side,
            title: card.title,
            hook: card.hook,
            detail: card.detail,
            used: room.usedCards.has(cardId)
          };
        })
      : []
  };
}

function broadcastRoom(room) {
  room.order.forEach((playerId) => {
    const player = room.players.get(playerId);
    if (!player || player.socket.readyState !== player.socket.OPEN) {
      return;
    }

    player.socket.send(JSON.stringify(serializeRoom(room, playerId)));
  });
}

function sendNotice(socket, message, level = "error") {
  if (socket.readyState !== socket.OPEN) {
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

function startMatch(socket) {
  const room = rooms.get(socket.roomCode);
  if (!room) {
    return sendNotice(socket, "Kein Raum gefunden.");
  }

  if (room.order[0] !== socket.playerId) {
    return sendNotice(socket, "Nur die Host-Seite darf den Kampf starten.");
  }

  if (room.order.length !== 2) {
    return sendNotice(socket, "Es müssen genau zwei Spieler*innen im Raum sein.");
  }

  if (room.status === "active") {
    return sendNotice(socket, "Das Match läuft bereits.");
  }

  const isRematch = room.status === "finished";
  resetRoomForMatch(room);
  room.statusText =
    isRematch
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
    body: isRematch
      ? "Ein neues Match beginnt im selben Raum."
      : "Pro eröffnet den ersten Schlagabtausch."
  });
  broadcastRoom(room);
}

function finishMatch(room, winnerSide, loserSide, attackCard, defenseCard) {
  room.status = "finished";
  room.phase = "finished";
  room.winnerSide = winnerSide;
  room.activePlayerId = null;
  room.pendingAttack = null;
  room.statusText = `${winnerSide === "pro" ? "Pro" : "Contra"} gewinnt durch KO. Host kann die Revanche starten.`;
  nextCue(room, {
    type: "ko",
    attackerSide: winnerSide,
    defenderSide: loserSide,
    attackTitle: attackCard.title,
    defenseTitle: defenseCard ? defenseCard.title : null,
    headline: "KO"
  });
}

function playCard(socket, cardId) {
  const room = rooms.get(socket.roomCode);
  if (!room) {
    return sendNotice(socket, "Raum nicht gefunden.");
  }

  if (room.status !== "active") {
    return sendNotice(socket, "Das Match ist noch nicht aktiv.");
  }

  if (room.activePlayerId !== socket.playerId) {
    return sendNotice(socket, "Im Moment ist das andere Känguru am Zug.");
  }

  const player = room.players.get(socket.playerId);
  const card = CARD_LIBRARY[cardId];

  if (!player || !card) {
    return sendNotice(socket, "Diese Karte gibt es nicht.");
  }

  if (card.side !== player.side) {
    return sendNotice(socket, "Du kannst nur Karten deiner Seite spielen.");
  }

  if (!player.hand.includes(cardId)) {
    return sendNotice(socket, "Diese Karte gehört nicht zu deiner Hand.");
  }

  if (room.usedCards.has(cardId)) {
    return sendNotice(socket, "Diese Karte wurde bereits verbraucht.");
  }

  if (room.phase === "attack") {
    const defenderId = room.order.find((id) => id !== player.id);
    const defender = room.players.get(defenderId);
    if (!defender) {
      return sendNotice(socket, "Es fehlt eine Gegenseite im Raum.");
    }

    room.usedCards.add(cardId);
    room.pendingAttack = {
      attackerId: player.id,
      defenderId,
      attackerSide: player.side,
      cardId
    };
    room.phase = "defend";
    room.activePlayerId = defenderId;
    room.statusText = `${player.name} greift mit "${card.title}" an.`;
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
    return broadcastRoom(room);
  }

  if (room.phase !== "defend" || !room.pendingAttack) {
    return sendNotice(socket, "Gerade kann kein Gegenargument gespielt werden.");
  }

  if (room.pendingAttack.defenderId !== player.id) {
    return sendNotice(socket, "Nur die verteidigende Seite darf jetzt reagieren.");
  }

  room.usedCards.add(cardId);

  const attackCard = CARD_LIBRARY[room.pendingAttack.cardId];
  const attacker = room.players.get(room.pendingAttack.attackerId);
  const defender = player;
  const valid = attackCard.validCounters.includes(card.id);

  if (valid) {
    room.phase = "attack";
    room.activePlayerId = defender.id;
    room.pendingAttack = null;
    room.statusText = `${defender.name} blockt erfolgreich und übernimmt die Initiative.`;
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
    return broadcastRoom(room);
  }

  room.damage[defender.side] += 1;
  const hitsTaken = room.damage[defender.side];
  const winnerSide = attacker.side;
  const loserSide = defender.side;

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
    finishMatch(room, winnerSide, loserSide, attackCard, card);
    return broadcastRoom(room);
  }

  room.phase = "attack";
  room.activePlayerId = attacker.id;
  room.pendingAttack = null;
  room.statusText = `${attacker.name} bleibt nach dem Treffer in der Offensive.`;
  nextCue(room, {
    type: "hit",
    attackerSide: attacker.side,
    defenderSide: defender.side,
    attackTitle: attackCard.title,
    defenseTitle: card.title,
    damage: hitsTaken,
    headline: "Volltreffer"
  });
  broadcastRoom(room);
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

  room.players.delete(player.id);
  room.order = room.order.filter((playerId) => playerId !== player.id);

  if (room.order.length === 0) {
    rooms.delete(room.code);
    return;
  }

  if (room.status === "active") {
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
  broadcastRoom(room);
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
      const room = createRoom(socket, message.name);
      return broadcastRoom(room);
    }

    if (message.type === "join_room") {
      const roomCode = String(message.roomCode || "").trim().toUpperCase();
      const result = joinRoom(socket, roomCode, message.name);
      if (result.error) {
        return sendNotice(socket, result.error);
      }

      return broadcastRoom(result.room);
    }

    if (message.type === "start_match") {
      return startMatch(socket);
    }

    if (message.type === "play_card") {
      return playCard(socket, String(message.cardId || ""));
    }

    return sendNotice(socket, "Unbekannter Befehl.");
  });

  socket.on("close", () => {
    handleDisconnect(socket);
  });
});

server.listen(PORT, () => {
  console.log(`argumenteboxen läuft auf http://localhost:${PORT}`);
});
