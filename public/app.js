const state = {
  ws: null,
  room: null,
  selectedCardId: null,
  lastCueId: null,
  audioEnabled: false,
  audioCtx: null,
  masterGain: null,
  bubbleTimers: {
    pro: null,
    contra: null
  }
};

const els = {
  nameInput: document.getElementById("name-input"),
  roomCodeInput: document.getElementById("room-code-input"),
  createRoomBtn: document.getElementById("create-room-btn"),
  joinRoomBtn: document.getElementById("join-room-btn"),
  startMatchBtn: document.getElementById("start-match-btn"),
  audioToggleBtn: document.getElementById("audio-toggle-btn"),
  playCardBtn: document.getElementById("play-card-btn"),
  notice: document.getElementById("notice"),
  roomCodeDisplay: document.getElementById("room-code-display"),
  statusLine: document.getElementById("status-line"),
  promptLine: document.getElementById("prompt-line"),
  cardsGrid: document.getElementById("cards-grid"),
  handCaption: document.getElementById("hand-caption"),
  historyList: document.getElementById("history-list"),
  logicSummary: document.getElementById("logic-summary"),
  logicCriteria: document.getElementById("logic-criteria"),
  logicReference: document.getElementById("logic-reference"),
  fighterPro: document.getElementById("fighter-pro"),
  fighterContra: document.getElementById("fighter-contra"),
  fighterProName: document.getElementById("fighter-pro-name"),
  fighterContraName: document.getElementById("fighter-contra-name"),
  bubblePro: document.getElementById("bubble-pro"),
  bubbleContra: document.getElementById("bubble-contra"),
  arenaImpact: document.getElementById("arena-impact"),
  arenaAnnouncer: document.getElementById("arena-announcer"),
  hitTrackPro: document.getElementById("hit-track-pro"),
  hitTrackContra: document.getElementById("hit-track-contra")
};

function connect() {
  const protocol = window.location.protocol === "https:" ? "wss" : "ws";
  state.ws = new WebSocket(`${protocol}://${window.location.host}`);

  state.ws.addEventListener("message", (event) => {
    const payload = JSON.parse(event.data);
    if (payload.type === "notice") {
      showNotice(payload.message, payload.level || "error");
      return;
    }

    state.room = payload;
    syncSelection();
    render();
    maybePlayMotionCue(payload.motionCue);
  });

  state.ws.addEventListener("open", () => {
    showNotice("Verbindung zur Arena steht.", "success");
  });

  state.ws.addEventListener("close", () => {
    showNotice("Verbindung getrennt. Die Seite verbindet sich neu.", "error");
    window.setTimeout(connect, 1200);
  });
}

function send(message) {
  if (!state.ws || state.ws.readyState !== WebSocket.OPEN) {
    showNotice("Die Verbindung ist noch nicht bereit.", "error");
    return;
  }

  state.ws.send(JSON.stringify(message));
}

function ensureAudio() {
  if (state.audioCtx) {
    if (state.audioCtx.state === "suspended") {
      state.audioCtx.resume();
    }
    return true;
  }

  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) {
    showNotice("Dieser Browser unterstützt keinen Web-Audio-Modus.", "error");
    return false;
  }

  state.audioCtx = new AudioContextClass();
  state.masterGain = state.audioCtx.createGain();
  state.masterGain.gain.value = 0.08;
  state.masterGain.connect(state.audioCtx.destination);
  return true;
}

function updateAudioButton() {
  els.audioToggleBtn.textContent = state.audioEnabled ? "Sound an" : "Sound aus";
}

function pulseTone({ frequency, duration, type = "sine", gain = 0.24, slideTo }) {
  if (!state.audioEnabled || !ensureAudio()) {
    return;
  }

  const now = state.audioCtx.currentTime;
  const oscillator = state.audioCtx.createOscillator();
  const envelope = state.audioCtx.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, now);
  if (slideTo) {
    oscillator.frequency.exponentialRampToValueAtTime(slideTo, now + duration);
  }

  envelope.gain.setValueAtTime(0.0001, now);
  envelope.gain.exponentialRampToValueAtTime(gain, now + 0.02);
  envelope.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  oscillator.connect(envelope);
  envelope.connect(state.masterGain);
  oscillator.start(now);
  oscillator.stop(now + duration + 0.02);
}

function playCueSound(cue) {
  if (!cue || !state.audioEnabled) {
    return;
  }

  if (cue.type === "match-start") {
    pulseTone({ frequency: 660, duration: 0.16, type: "triangle", gain: 0.18 });
    window.setTimeout(() => {
      pulseTone({ frequency: 880, duration: 0.28, type: "triangle", gain: 0.16 });
    }, 120);
    return;
  }

  if (cue.type === "attack") {
    pulseTone({ frequency: 210, slideTo: 120, duration: 0.18, type: "sawtooth", gain: 0.14 });
    return;
  }

  if (cue.type === "counter") {
    pulseTone({ frequency: 480, duration: 0.1, type: "square", gain: 0.12 });
    window.setTimeout(() => {
      pulseTone({ frequency: 620, duration: 0.16, type: "square", gain: 0.1 });
    }, 60);
    return;
  }

  if (cue.type === "hit") {
    pulseTone({ frequency: 170, slideTo: 80, duration: 0.24, type: "square", gain: 0.18 });
    return;
  }

  if (cue.type === "ko") {
    pulseTone({ frequency: 140, slideTo: 58, duration: 0.44, type: "sawtooth", gain: 0.22 });
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function showNotice(message, level = "error") {
  els.notice.className = `notice ${level}`;
  els.notice.innerHTML = `<strong>${level === "success" ? "Bereit" : "Hinweis"}:</strong> ${escapeHtml(message)}`;
}

function playerBySide(side) {
  return state.room?.players?.find((player) => player.side === side) || null;
}

function activePlayer() {
  return state.room?.players?.find((player) => player.id === state.room.activePlayerId) || null;
}

function canAct() {
  return Boolean(
    state.room &&
      state.room.status === "active" &&
      state.room.user &&
      state.room.activePlayerId === state.room.user.id
  );
}

function currentActionLabel() {
  if (!state.room || !state.room.user) {
    return "Wähle ein Argument, sobald du am Zug bist.";
  }

  if (state.room.status !== "active") {
    return "Deine Hand ist bereit, sobald das Match startet.";
  }

  return state.room.phase === "attack"
    ? "Du bist im Angriff: Spiele ein Argument aus."
    : "Du verteidigst: Spiele ein valides Gegenargument.";
}

function syncSelection() {
  if (!state.room) {
    state.selectedCardId = null;
    return;
  }

  const selectedCard = state.room.yourHand.find((card) => card.id === state.selectedCardId);
  if (!selectedCard || selectedCard.used) {
    state.selectedCardId = null;
  }
}

function renderHitTrack(side) {
  const player = playerBySide(side);
  const container = side === "pro" ? els.hitTrackPro : els.hitTrackContra;
  const hitsTaken = player?.hitsTaken || 0;
  container.innerHTML = Array.from({ length: state.room?.hitsToKO || 3 }, (_, index) => {
    const filled = index < hitsTaken ? "filled" : "";
    return `<span class="hit-pip ${filled} ${side}"></span>`;
  }).join("");
}

function renderCards() {
  const cards = state.room?.yourHand || [];
  const canPlay = canAct();
  els.handCaption.textContent = currentActionLabel();

  if (!cards.length) {
    els.cardsGrid.innerHTML = "<p class='history-empty'>Deine Hand erscheint, sobald du einem Raum beigetreten bist.</p>";
    els.playCardBtn.disabled = true;
    return;
  }

  els.cardsGrid.innerHTML = cards
    .map((card) => {
      const classes = ["card", card.side];
      if (card.used) {
        classes.push("used");
      }
      if (card.id === state.selectedCardId) {
        classes.push("selected");
      }

      const locked = !canPlay || card.used;
      return `
        <button class="${classes.join(" ")}" data-card-id="${card.id}" ${locked ? "disabled" : ""}>
          <span class="card-tag">${state.room.phase === "attack" ? "Angriff" : "Abwehr"}</span>
          <h3>${escapeHtml(card.title)}</h3>
          <p>${escapeHtml(card.hook)}</p>
          <p><strong>Logik:</strong> ${escapeHtml(card.logicLabel)} · ${escapeHtml(card.logicValidity)}</p>
          <p>${escapeHtml(card.detail)}</p>
        </button>
      `;
    })
    .join("");

  Array.from(els.cardsGrid.querySelectorAll("[data-card-id]")).forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedCardId = button.dataset.cardId;
      renderCards();
      updatePlayButton();
    });
  });

  updatePlayButton();
}

function updatePlayButton() {
  const selected = state.room?.yourHand?.find((card) => card.id === state.selectedCardId);
  const enabled = canAct() && selected && !selected.used;
  els.playCardBtn.disabled = !enabled;
  if (!enabled) {
    els.playCardBtn.textContent = state.room?.phase === "defend" ? "Gegenargument spielen" : "Karte spielen";
    return;
  }

  els.playCardBtn.textContent =
    state.room.phase === "defend" ? `Abwehren mit: ${selected.title}` : `Angreifen mit: ${selected.title}`;
}

function renderHistory() {
  const history = state.room?.history || [];
  if (!history.length) {
    els.historyList.innerHTML = "<p class='history-empty'>Noch keine Schlagwechsel.</p>";
    return;
  }

  els.historyList.innerHTML = history
    .slice()
    .reverse()
    .map(
      (item) => `
        <article class="history-item">
          <strong>${escapeHtml(item.headline || "Arena-Update")}</strong>
          <p>${escapeHtml(item.body || "")}</p>
        </article>
      `
    )
    .join("");
}

function renderPlayers() {
  const pro = playerBySide("pro");
  const contra = playerBySide("contra");

  els.fighterProName.textContent = pro?.name || "Känguru Rot";
  els.fighterContraName.textContent = contra?.name || "Känguru Blau";

  renderHitTrack("pro");
  renderHitTrack("contra");

  els.fighterPro.classList.toggle("active-turn", state.room?.activePlayerId === pro?.id);
  els.fighterContra.classList.toggle("active-turn", state.room?.activePlayerId === contra?.id);
}

function renderLogicPanel() {
  const judgement = state.room?.logicJudgement;
  const reference = state.room?.logicReference;

  if (!judgement) {
    els.logicSummary.innerHTML = "<p class='history-empty'>Sobald eine Abwehr gespielt wurde, erscheint hier das logische Urteil.</p>";
    els.logicCriteria.innerHTML = "";
  } else {
    els.logicSummary.innerHTML = `
      <article class="logic-card ${judgement.verdict}">
        <strong>${escapeHtml(judgement.summary)}</strong>
        <p>${escapeHtml(judgement.explanation)}</p>
        <p><strong>Schlussart:</strong> ${escapeHtml(judgement.defenseProfile)} · <strong>Geltung:</strong> ${escapeHtml(judgement.validityLevel)}</p>
        ${judgement.fallacy ? `<p><strong>Fehlschluss-Risiko:</strong> ${escapeHtml(judgement.fallacy.label)}</p>` : ""}
      </article>
    `;

    els.logicCriteria.innerHTML = judgement.criteria
      .map(
        (criterion) => `
          <article class="criterion ${criterion.passed ? "passed" : "failed"}">
            <strong>${escapeHtml(criterion.label)}</strong>
            <p>${escapeHtml(criterion.note)}</p>
          </article>
        `
      )
      .join("");
  }

  if (!reference) {
    els.logicReference.innerHTML = "";
    return;
  }

  els.logicReference.innerHTML = `
    <div class="logic-reference-block">
      <strong>Kriterien</strong>
      <ul class="logic-mini-list">
        ${reference.rubric
          .map((item) => `<li><span>${escapeHtml(item.label)}</span> ${escapeHtml(item.description)}</li>`)
          .join("")}
      </ul>
    </div>
    <div class="logic-reference-block">
      <strong>Gültige Schlussarten</strong>
      <ul class="logic-mini-list">
        ${reference.validForms
          .map((item) => `<li><span>${escapeHtml(item.label)}</span> ${escapeHtml(item.description)}</li>`)
          .join("")}
      </ul>
    </div>
    <div class="logic-reference-block">
      <strong>Typische Fehlschlüsse</strong>
      <ul class="logic-mini-list">
        ${reference.fallacies
          .slice(0, 8)
          .map((item) => `<li><span>${escapeHtml(item.label)}</span> ${escapeHtml(item.description)}</li>`)
          .join("")}
      </ul>
    </div>
  `;
}

function renderStatus() {
  els.roomCodeDisplay.textContent = state.room?.roomCode || "-----";
  els.statusLine.textContent = state.room?.statusText || "Warte auf die Arena.";
  els.promptLine.textContent = state.room?.prompt || "";
  const showStart = Boolean(state.room?.canStart || state.room?.canRematch);
  els.startMatchBtn.classList.toggle("hidden", !showStart);
  els.startMatchBtn.textContent = state.room?.canRematch ? "Revanche starten" : "Match starten";
}

function render() {
  renderStatus();
  renderPlayers();
  renderCards();
  renderHistory();
  renderLogicPanel();
}

function clearMotionClasses() {
  [els.fighterPro, els.fighterContra].forEach((fighter) => {
    fighter.classList.remove("attacking", "blocking", "hit", "ko");
  });
}

function flashImpact() {
  els.arenaImpact.classList.remove("live");
  void els.arenaImpact.offsetWidth;
  els.arenaImpact.classList.add("live");
}

function setAnnouncer(text) {
  els.arenaAnnouncer.textContent = text;
}

function showBubble(side, text, duration = 2200) {
  const bubble = side === "pro" ? els.bubblePro : els.bubbleContra;
  bubble.textContent = text;
  bubble.classList.add("live");
  window.clearTimeout(state.bubbleTimers[side]);
  state.bubbleTimers[side] = window.setTimeout(() => {
    bubble.classList.remove("live");
  }, duration);
}

function maybePlayMotionCue(cue) {
  if (!cue || cue.id === state.lastCueId) {
    return;
  }

  state.lastCueId = cue.id;
  clearMotionClasses();
  playCueSound(cue);

  const attackerEl = cue.attackerSide === "contra" ? els.fighterContra : els.fighterPro;
  const defenderEl = cue.defenderSide === "contra" ? els.fighterContra : els.fighterPro;

  if (cue.type === "match-start") {
    setAnnouncer(cue.rematch ? "Revanche" : "Die Glocke läutet");
    showBubble("pro", cue.rematch ? "Neue Runde, neues Glück." : "Pro eröffnet den Kampf.", 1800);
    showBubble("contra", cue.rematch ? "Contra ist sofort wieder da." : "Contra ist bereit.", 1800);
    return;
  }

  if (cue.type === "attack") {
    setAnnouncer(cue.headline || "Angriff");
    attackerEl?.classList.add("attacking");
    defenderEl?.classList.add("blocking");
    showBubble(cue.attackerSide, cue.attackTitle, 2400);
    return;
  }

  if (cue.type === "counter") {
    setAnnouncer(cue.headline || "Abwehr");
    defenderEl?.classList.add("attacking");
    attackerEl?.classList.add("blocking");
    showBubble(cue.defenderSide, cue.defenseTitle, 2500);
    return;
  }

  if (cue.type === "hit") {
    setAnnouncer(cue.headline || "Treffer");
    attackerEl?.classList.add("attacking");
    defenderEl?.classList.add("hit");
    flashImpact();
    showBubble(cue.attackerSide, cue.attackTitle, 2600);
    showBubble(cue.defenderSide, `${cue.defenseTitle} war nicht genug`, 2200);
    return;
  }

  if (cue.type === "ko") {
    setAnnouncer("KO");
    attackerEl?.classList.add("attacking");
    defenderEl?.classList.add("ko");
    flashImpact();
    showBubble(cue.attackerSide, cue.attackTitle, 2800);
    showBubble(cue.defenderSide, "KO", 2500);
    return;
  }

  if (cue.type === "disconnect") {
    setAnnouncer("Verbindung unterbrochen");
  }
}

els.createRoomBtn.addEventListener("click", () => {
  ensureAudio();
  const name = els.nameInput.value.trim();
  send({ type: "create_room", name });
});

els.joinRoomBtn.addEventListener("click", () => {
  ensureAudio();
  const name = els.nameInput.value.trim();
  const roomCode = els.roomCodeInput.value.trim().toUpperCase();
  send({ type: "join_room", name, roomCode });
});

els.startMatchBtn.addEventListener("click", () => {
  ensureAudio();
  send({ type: "start_match" });
});

els.playCardBtn.addEventListener("click", () => {
  ensureAudio();
  if (!state.selectedCardId) {
    showNotice("Wähle zuerst eine Karte aus.", "error");
    return;
  }

  send({ type: "play_card", cardId: state.selectedCardId });
});

els.audioToggleBtn.addEventListener("click", () => {
  if (!state.audioEnabled) {
    if (!ensureAudio()) {
      return;
    }
    state.audioEnabled = true;
  } else {
    state.audioEnabled = false;
  }

  updateAudioButton();
});

updateAudioButton();
connect();
