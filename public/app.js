const state = {
  ws: null,
  room: null,
  selectedCardId: null,
  textDraft: "",
  lastCueId: null,
  timerInterval: null,
  motionResetTimer: null,
  audioEnabled: false,
  musicEnabled: false,
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
  matchModeSelect: document.getElementById("match-mode-select"),
  playLevelSelect: document.getElementById("play-level-select"),
  joinBox: document.getElementById("join-box"),
  createRoomBtn: document.getElementById("create-room-btn"),
  joinRoomBtn: document.getElementById("join-room-btn"),
  startMatchBtn: document.getElementById("start-match-btn"),
  musicToggleBtn: document.getElementById("music-toggle-btn"),
  audioToggleBtn: document.getElementById("audio-toggle-btn"),
  playCardBtn: document.getElementById("play-card-btn"),
  submitTextBtn: document.getElementById("submit-text-btn"),
  textMoveInput: document.getElementById("text-move-input"),
  textMoveLabel: document.getElementById("text-move-label"),
  textCharCount: document.getElementById("text-char-count"),
  textModePanel: document.getElementById("text-mode-panel"),
  cardsModePanel: document.getElementById("cards-mode-panel"),
  ideasGrid: document.getElementById("ideas-grid"),
  modeChip: document.getElementById("mode-chip"),
  opponentChip: document.getElementById("opponent-chip"),
  roomMeta: document.getElementById("room-meta"),
  actionPanelTitle: document.getElementById("action-panel-title"),
  notice: document.getElementById("notice"),
  roomCodeDisplay: document.getElementById("room-code-display"),
  statusLine: document.getElementById("status-line"),
  promptLine: document.getElementById("prompt-line"),
  turnTimer: document.getElementById("turn-timer"),
  turnTimerLabel: document.getElementById("turn-timer-label"),
  turnTimerFill: document.getElementById("turn-timer-fill"),
  arenaStartOverlay: document.getElementById("arena-start-overlay"),
  arenaStartEyebrow: document.getElementById("arena-start-eyebrow"),
  arenaStartTitle: document.getElementById("arena-start-title"),
  arenaStartCopy: document.getElementById("arena-start-copy"),
  arenaStartBtn: document.getElementById("arena-start-btn"),
  defenseHelper: document.getElementById("defense-helper"),
  selectedCardPanel: document.getElementById("selected-card-panel"),
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
  bgMusic: document.getElementById("bg-music"),
  arenaImpact: document.getElementById("arena-impact"),
  arenaAnnouncer: document.getElementById("arena-announcer"),
  hitTrackPro: document.getElementById("hit-track-pro"),
  hitTrackContra: document.getElementById("hit-track-contra")
};

function currentConfiguredTurnMs() {
  if (state.room?.turnTimeMs) {
    return state.room.turnTimeMs;
  }

  return els.playLevelSelect.value === "free_text" ? 90_000 : 30_000;
}

function setupNoticeText() {
  if (els.matchModeSelect.value === "solo") {
    return els.playLevelSelect.value === "free_text"
      ? "Im Solo-Modus spielt ein Computer direkt gegen dich. Im Freitext-Level formuliert ihr Argumente mit je 90 Sekunden Zugzeit."
      : "Im Solo-Modus erstellt nur ein Gerät den Raum. Der Computer übernimmt automatisch die Gegenseite.";
  }

  return els.playLevelSelect.value === "free_text"
    ? "Beide Spieler*innen spielen im Browser auf demselben Server. Im zweiten Level argumentiert ihr per Texteingabe mit je 90 Sekunden Zugzeit."
    : "Beide Spieler*innen spielen im Browser auf demselben Server, aber auf zwei verschiedenen Computern.";
}

function updateSetupOptions() {
  const solo = els.matchModeSelect.value === "solo";
  els.joinBox.classList.toggle("hidden", solo);
  showNotice(setupNoticeText(), "success");
  clearTimerDisplay();
}

function connect() {
  const protocol = window.location.protocol === "https:" ? "wss" : "ws";
  state.ws = new WebSocket(`${protocol}://${window.location.host}`);

  state.ws.addEventListener("message", (event) => {
    const payload = JSON.parse(event.data);
    if (payload.type === "notice") {
      showNotice(payload.message, payload.level || "error");
      return;
    }

    const previousRoom = state.room;
    state.room = payload;
    syncSelection();

    if (
      previousRoom?.playLevel === "free_text" &&
      previousRoom?.user &&
      previousRoom.activePlayerId === previousRoom.user.id &&
      payload.motionCue &&
      payload.motionCue.id !== previousRoom.motionCue?.id
    ) {
      state.textDraft = "";
      els.textMoveInput.value = "";
    }

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
  els.audioToggleBtn.textContent = state.audioEnabled ? "Effekte aus" : "Effekte an";
}

function updateMusicButton() {
  els.musicToggleBtn.textContent = state.musicEnabled ? "Musik aus" : "Musik an";
}

async function setMusicEnabled(enabled) {
  state.musicEnabled = enabled;
  els.bgMusic.volume = 0.22;

  if (!enabled) {
    els.bgMusic.pause();
    updateMusicButton();
    return;
  }

  try {
    await els.bgMusic.play();
  } catch (error) {
    state.musicEnabled = false;
    showNotice("Die Hintergrundmusik konnte in diesem Browser nicht gestartet werden.", "error");
  }

  updateMusicButton();
}

function clearTimerDisplay() {
  window.clearInterval(state.timerInterval);
  state.timerInterval = null;
  els.turnTimer.classList.add("hidden");
  els.turnTimerLabel.textContent = `${Math.ceil(currentConfiguredTurnMs() / 1000)}s`;
  els.turnTimerFill.style.width = "100%";
  els.turnTimerFill.classList.remove("warning");
}

function renderTimer() {
  const timer = state.room?.turnTimer;
  if (!timer || state.room?.status !== "active") {
    clearTimerDisplay();
    return;
  }

  const remainingMs = Math.max(0, timer.deadlineAt - Date.now());
  const remainingSeconds = Math.ceil(remainingMs / 1000);
  const ratio = Math.max(0, Math.min(1, remainingMs / timer.durationMs));
  els.turnTimer.classList.remove("hidden");
  els.turnTimerLabel.textContent = `${remainingSeconds}s`;
  els.turnTimerFill.style.width = `${ratio * 100}%`;
  els.turnTimerFill.classList.toggle("warning", remainingSeconds <= 10);
}

function restartTimerLoop() {
  clearTimerDisplay();
  if (!state.room?.turnTimer || state.room?.status !== "active") {
    return;
  }

  renderTimer();
  state.timerInterval = window.setInterval(renderTimer, 250);
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

  if (cue.type === "hit" || cue.type === "timeout-hit") {
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

function canAct() {
  return Boolean(
    state.room &&
      state.room.status === "active" &&
      state.room.user &&
      state.room.activePlayerId === state.room.user.id
  );
}

function isFreeTextLevel() {
  return state.room?.playLevel === "free_text";
}

function currentActionLabel() {
  if (!state.room || !state.room.user) {
    return "Wähle einen Modus und tritt der Arena bei.";
  }

  if (state.room.status !== "active") {
    return isFreeTextLevel()
      ? "Das Textfeld wird aktiv, sobald das Match startet."
      : "Deine Hand ist bereit, sobald das Match startet.";
  }

  if (isFreeTextLevel()) {
    return state.room.phase === "attack"
      ? "Du bist im Angriff: Formuliere dein Argument im Textfeld."
      : "Du verteidigst: Tippe ein Gegenargument gegen den laufenden Angriff.";
  }

  return state.room.phase === "attack"
    ? "Du bist im Angriff: Spiele ein Argument aus."
    : "Du verteidigst: Spiele ein valides Gegenargument.";
}

function syncSelection() {
  if (!state.room || isFreeTextLevel()) {
    state.selectedCardId = null;
    return;
  }

  if (
    state.room.status === "active" &&
    state.room.phase === "defend" &&
    state.room.pendingAttack?.validCounterIds?.length &&
    state.room.user &&
    state.room.activePlayerId === state.room.user.id
  ) {
    const selectedCard = state.room.yourHand.find((card) => card.id === state.selectedCardId);
    const selectedIsRecommended =
      selectedCard &&
      !selectedCard.used &&
      state.room.pendingAttack.validCounterIds.includes(selectedCard.id);

    if (!selectedIsRecommended) {
      const firstRecommended = state.room.yourHand.find(
        (card) =>
          !card.used && state.room.pendingAttack.validCounterIds.includes(card.id)
      );
      if (firstRecommended) {
        state.selectedCardId = firstRecommended.id;
        return;
      }
    }
  }

  const selectedCard = state.room.yourHand.find((card) => card.id === state.selectedCardId);
  if (!selectedCard || selectedCard.used) {
    state.selectedCardId = null;
  }

  if (!state.selectedCardId) {
    const firstAvailable = state.room.yourHand.find((card) => !card.used);
    if (firstAvailable) {
      state.selectedCardId = firstAvailable.id;
    }
  }
}

function recommendedCounterIds() {
  return state.room?.phase === "defend" ? state.room?.pendingAttack?.validCounterIds || [] : [];
}

function renderDefenseHelper(cards) {
  const ids = recommendedCounterIds();
  if (!ids.length || state.room?.playLevel !== "cards") {
    els.defenseHelper.classList.add("hidden");
    els.defenseHelper.innerHTML = "";
    return;
  }

  const recommendedCards = cards.filter((card) => ids.includes(card.id) && !card.used);
  const labels = recommendedCards.length
    ? recommendedCards.map((card) => `<span class="helper-pill">${escapeHtml(card.title)}</span>`).join("")
    : "<span class='history-empty'>Die passenden Karten sind bereits verbraucht.</span>";

  els.defenseHelper.innerHTML = `
    <strong>Gute Abwehr gegen: ${escapeHtml(state.room.pendingAttack?.card?.title || state.room.pendingAttack?.displayText || "aktuellen Angriff")}</strong>
    <p>Die folgenden Gegenargumente passen direkt zum laufenden Angriff und sind deshalb hervorgehoben:</p>
    <div class="helper-pill-row">${labels}</div>
  `;
  els.defenseHelper.classList.remove("hidden");
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

function renderIdeas(cards) {
  if (!cards.length) {
    els.ideasGrid.innerHTML = "<p class='history-empty'>Sobald du im Raum bist, erscheinen hier Argument-Ideen deiner Seite.</p>";
    return;
  }

  els.ideasGrid.innerHTML = cards
    .map(
      (card) => `
        <article class="idea-card ${card.side}">
          <span class="card-tag">Impuls</span>
          <h3>${escapeHtml(card.title)}</h3>
          <p>${escapeHtml(card.hook)}</p>
          <p><strong>Logik:</strong> ${escapeHtml(card.logicLabel)} · ${escapeHtml(card.logicValidity)}</p>
        </article>
      `
    )
    .join("");
}

function sendSelectedCard(cardId) {
  ensureAudio();
  if (!cardId) {
    showNotice("Wähle zuerst eine Karte aus.", "error");
    return;
  }

  send({ type: "play_card", cardId });
}

function renderSelectedCardPanel(cards) {
  if (!els.selectedCardPanel) {
    return;
  }

  if (!cards.length) {
    els.selectedCardPanel.innerHTML = "";
    return;
  }

  const selected =
    cards.find((card) => card.id === state.selectedCardId) ||
    cards.find((card) => !card.used) ||
    cards[0];

  const recommended = recommendedCounterIds().includes(selected.id);
  const attackMode = state.room?.phase !== "defend";
  const canPlay = canAct() && !selected.used;
  const buttonLabel = attackMode
    ? "Ausgewähltes Argument pushen"
    : recommended
      ? "Passendes Gegenargument pushen"
      : "Ausgewähltes Gegenargument pushen";

  let note = "Wähle eine Karte aus dem Raster und pushe sie gezielt aus diesem Fokusfeld.";
  if (selected.used) {
    note = "Diese Karte wurde bereits verbraucht und kann nicht noch einmal gespielt werden.";
  } else if (!canAct()) {
    note = "Du bist gerade nicht am Zug. Deine nächste Karte kann hier aber schon vorbereitet werden.";
  } else if (!attackMode && recommended) {
    note = "Diese Karte trifft den laufenden Angriff direkt und ist als Abwehr besonders stark.";
  } else if (!attackMode) {
    note = "Diese Abwehr ist möglich, aber gegen den aktuellen Angriff eher riskant.";
  } else {
    note = "Diese Karte ist bereit für deinen nächsten Schlag in der Arena.";
  }

  els.selectedCardPanel.className = `selected-card-panel ${recommended ? "recommended" : ""}`.trim();
  els.selectedCardPanel.innerHTML = `
    <p class="eyebrow">${attackMode ? "Ausgewähltes Argument" : "Ausgewähltes Gegenargument"}</p>
    <h3>${escapeHtml(selected.title)}</h3>
    <p class="selected-card-summary">${escapeHtml(selected.hook)}</p>
    <p class="card-logic"><strong>Logik:</strong> ${escapeHtml(selected.logicLabel)} · ${escapeHtml(selected.logicValidity)}</p>
    <p class="selected-card-summary">${escapeHtml(selected.detail)}</p>
    <div class="selected-card-actions">
      <button class="primary-btn" id="selected-card-push-btn" ${canPlay ? "" : "disabled"}>
        ${buttonLabel}
      </button>
      <span class="selected-card-note">${escapeHtml(note)}</span>
    </div>
  `;

  const pushButton = document.getElementById("selected-card-push-btn");
  if (pushButton) {
    pushButton.addEventListener("click", () => {
      state.selectedCardId = selected.id;
      updatePlayButton();
      sendSelectedCard(selected.id);
    });
  }
}

function updatePlayButton() {
  const selected = state.room?.yourHand?.find((card) => card.id === state.selectedCardId);
  const enabled = canAct() && selected && !selected.used;
  const recommended = recommendedCounterIds().includes(selected?.id);
  els.playCardBtn.disabled = !enabled;
  if (!enabled) {
    els.playCardBtn.textContent = state.room?.phase === "defend" ? "Gegenargument spielen" : "Karte spielen";
    return;
  }

  els.playCardBtn.textContent =
    state.room.phase === "defend"
      ? `${recommended ? "Passend abwehren mit" : "Riskant abwehren mit"}: ${selected.title}`
      : `Angreifen mit: ${selected.title}`;
}

function updateTextControls() {
  const draft = state.textDraft.trim();
  const enoughText = draft.length >= 18;
  const attackMode = state.room?.phase !== "defend";
  els.textMoveLabel.textContent = attackMode ? "Dein Argument" : "Dein Gegenargument";
  els.textMoveInput.placeholder = attackMode
    ? "Formuliere hier dein Angriffsargument."
    : "Formuliere hier deine Abwehr gegen den laufenden Angriff.";
  els.textCharCount.textContent = String(state.textDraft.length);
  els.submitTextBtn.disabled = !(canAct() && enoughText);
  els.submitTextBtn.textContent = attackMode ? "Argument abschicken" : "Gegenargument abschicken";
}

function renderCards() {
  const originalCards = state.room?.yourHand || [];
  els.handCaption.textContent = currentActionLabel();
  const textLevel = isFreeTextLevel();

  els.cardsModePanel.classList.toggle("hidden", textLevel);
  els.textModePanel.classList.toggle("hidden", !textLevel);
  els.actionPanelTitle.textContent = textLevel ? "Dein Textzug" : "Deine Karten";

  if (textLevel) {
    els.selectedCardPanel.innerHTML = "";
    renderIdeas(originalCards);
    updateTextControls();
    return;
  }

  const recommendedIds = recommendedCounterIds();
  const cards = [...originalCards].sort((left, right) => {
    const leftRecommended = recommendedIds.includes(left.id) ? 1 : 0;
    const rightRecommended = recommendedIds.includes(right.id) ? 1 : 0;
    if (leftRecommended !== rightRecommended) {
      return rightRecommended - leftRecommended;
    }
    if (left.used !== right.used) {
      return Number(left.used) - Number(right.used);
    }
    return left.title.localeCompare(right.title, "de-CH");
  });

  const canPlay = canAct();
  renderDefenseHelper(originalCards);
  if (!cards.length) {
    renderSelectedCardPanel([]);
    els.cardsGrid.innerHTML = "<p class='history-empty'>Deine Hand erscheint, sobald du einem Raum beigetreten bist.</p>";
    els.playCardBtn.disabled = true;
    return;
  }

  renderSelectedCardPanel(cards);

  els.cardsGrid.innerHTML = cards
    .map((card) => {
      const classes = ["card", card.side];
      const recommended = recommendedIds.includes(card.id);
      if (card.used) {
        classes.push("used");
      }
      if (card.id === state.selectedCardId) {
        classes.push("selected");
      }
      if (recommended) {
        classes.push("recommended");
      } else if (state.room?.phase === "defend") {
        classes.push("risky");
      }

      const locked = card.used;
      return `
        <button class="${classes.join(" ")}" data-card-id="${card.id}" ${locked ? "disabled" : ""}>
          <span class="card-tag">${state.room.phase === "attack" ? "Angriff" : recommended ? "Passende Abwehr" : "Abwehr"}</span>
          <h3>${escapeHtml(card.title)}</h3>
          <p class="card-summary">${escapeHtml(card.hook)}</p>
          <p class="card-logic"><strong>Logik:</strong> ${escapeHtml(card.logicLabel)} · ${escapeHtml(card.logicValidity)}</p>
          ${
            state.room.phase === "defend"
              ? `<p class="card-hint ${recommended ? "recommended" : "risky"}">${
                  recommended ? "Direkt passend." : "Eher riskant."
                }</p>`
              : ""
          }
        </button>
      `;
    })
    .join("");

  Array.from(els.cardsGrid.querySelectorAll("[data-card-id]")).forEach((button) => {
    button.addEventListener("click", () => {
      const cardId = button.dataset.cardId;
      const card = originalCards.find((entry) => entry.id === cardId);
      const sameCard = state.selectedCardId === cardId;
      const playable = canPlay && card && !card.used;

      if (sameCard && playable) {
        sendSelectedCard(cardId);
        return;
      }

      state.selectedCardId = cardId;
      renderCards();
      updatePlayButton();
    });
  });

  updatePlayButton();
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

function renderRoomMeta() {
  const matchMode = state.room?.matchMode || els.matchModeSelect.value;
  const playLevel = state.room?.playLevel || els.playLevelSelect.value;
  const modeText = playLevel === "free_text" ? "Level 2: Freitextduell" : "Level 1: Kartenkampf";
  const opponentText = matchMode === "solo" ? "Solo gegen Computer" : "Duell auf zwei Computern";

  els.modeChip.textContent = modeText;
  els.opponentChip.textContent = opponentText;
  els.roomMeta.innerHTML = `
    <span class="room-meta-pill">${escapeHtml(opponentText)}</span>
    <span class="room-meta-pill alt">${escapeHtml(modeText)}</span>
  `;
}

function renderStatus() {
  els.roomCodeDisplay.textContent = state.room?.roomCode || "-----";
  els.statusLine.textContent = state.room?.statusText || "Warte auf die Arena.";
  els.promptLine.textContent = state.room?.prompt || "";
  els.startMatchBtn.classList.add("hidden");
  renderRoomMeta();
  restartTimerLoop();
}

function renderStartOverlay() {
  const room = state.room;
  let eyebrow = "Arena bereit";
  let title = "Raum anlegen";
  let copy = "Erstelle links einen Raum oder tritt mit Code bei. Sobald beide Seiten bereit sind, beginnt der Kampf mit einem klaren Startsignal.";
  let buttonText = "Kampf starten";
  let showButton = false;

  if (!room) {
    els.arenaStartOverlay.classList.remove("hidden");
    els.arenaStartEyebrow.textContent = eyebrow;
    els.arenaStartTitle.textContent = title;
    els.arenaStartCopy.textContent = copy;
    els.arenaStartBtn.classList.add("hidden");
    return;
  }

  if (room.status === "active") {
    els.arenaStartOverlay.classList.add("hidden");
    return;
  }

  if (room.status === "lobby") {
    eyebrow = room.matchMode === "solo" ? "Solo-Modus" : "Vor dem Kampf";

    if (room.canStart) {
      title = room.matchMode === "solo" ? "Computer ist bereit" : "Beide Kängurus sind bereit";
      copy =
        room.matchMode === "solo"
          ? "Du hast den Raum angelegt, die Gegenseite wird vom Computer übernommen. Starte den Kampf jetzt bewusst mit dem großen Startsignal."
          : "Der Raum ist vollständig. Starte den Kampf jetzt bewusst mit dem großen Startsignal, damit beide Seiten denselben klaren Beginn erleben.";
      buttonText = "Kampf starten";
      showButton = true;
    } else if (room.players?.length < 2) {
      title = "Warte auf die Gegenseite";
      copy = "Teile den Raumcode und lass die zweite Seite beitreten. Erst dann wird der Start freigegeben.";
    } else {
      title = "Warte auf das Startsignal";
      copy = "Beide Seiten sind im Raum. Jetzt kann nur noch die Host-Seite den Kampf auslösen.";
    }
  } else if (room.status === "finished") {
    eyebrow = "Match beendet";
    title = room.winnerSide === "pro" ? "Pro gewinnt" : room.winnerSide === "contra" ? "Contra gewinnt" : "Match beendet";
    if (room.canRematch) {
      copy = "Wenn ihr noch einmal antreten wollt, startet die Revanche wieder bewusst mit einem klaren Signal.";
      buttonText = "Revanche starten";
      showButton = true;
    } else {
      copy = "Warte darauf, dass die Host-Seite eine Revanche auslöst.";
    }
  }

  els.arenaStartEyebrow.textContent = eyebrow;
  els.arenaStartTitle.textContent = title;
  els.arenaStartCopy.textContent = copy;
  els.arenaStartBtn.textContent = buttonText;
  els.arenaStartBtn.classList.toggle("hidden", !showButton);
  els.arenaStartOverlay.classList.remove("hidden");
}

function render() {
  renderStatus();
  renderStartOverlay();
  renderPlayers();
  renderCards();
  renderHistory();
  renderLogicPanel();
}

function clearMotionClasses() {
  window.clearTimeout(state.motionResetTimer);
  state.motionResetTimer = null;
  [els.fighterPro, els.fighterContra].forEach((fighter) => {
    fighter.classList.remove("attacking", "blocking", "hit", "ko");
  });
}

function scheduleMotionReset(duration = 560) {
  window.clearTimeout(state.motionResetTimer);
  state.motionResetTimer = window.setTimeout(() => {
    state.motionResetTimer = null;
    clearMotionClasses();
  }, duration);
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
    scheduleMotionReset(520);
    return;
  }

  if (cue.type === "counter") {
    setAnnouncer(cue.headline || "Abwehr");
    defenderEl?.classList.add("attacking");
    attackerEl?.classList.add("blocking");
    showBubble(cue.defenderSide, cue.defenseTitle, 2500);
    scheduleMotionReset(560);
    return;
  }

  if (cue.type === "hit") {
    setAnnouncer(cue.headline || "Treffer");
    attackerEl?.classList.add("attacking");
    defenderEl?.classList.add("hit");
    flashImpact();
    showBubble(cue.attackerSide, cue.attackTitle, 2600);
    showBubble(cue.defenderSide, `${cue.defenseTitle} war nicht genug`, 2200);
    scheduleMotionReset(680);
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
    clearMotionClasses();
    return;
  }

  if (cue.type === "timeout-turnover") {
    setAnnouncer("Zeitstrafe");
    attackerEl?.classList.add("hit");
    showBubble(cue.attackerSide, "Zu spät!", 1800);
    showBubble(cue.defenderSide, "Initiative!", 1800);
    scheduleMotionReset(620);
    return;
  }

  if (cue.type === "timeout-hit") {
    setAnnouncer("Zeit abgelaufen");
    attackerEl?.classList.add("attacking");
    defenderEl?.classList.add("hit");
    flashImpact();
    showBubble(cue.attackerSide, cue.attackTitle || "Treffer", 2200);
    showBubble(cue.defenderSide, "Frist verpasst", 2000);
    scheduleMotionReset(680);
  }
}

els.createRoomBtn.addEventListener("click", () => {
  ensureAudio();
  const name = els.nameInput.value.trim();
  send({
    type: "create_room",
    name,
    matchMode: els.matchModeSelect.value,
    playLevel: els.playLevelSelect.value
  });
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

els.arenaStartBtn.addEventListener("click", () => {
  ensureAudio();
  send({ type: "start_match" });
});

els.playCardBtn.addEventListener("click", () => {
  sendSelectedCard(state.selectedCardId);
});

els.submitTextBtn.addEventListener("click", () => {
  ensureAudio();
  const text = state.textDraft.trim();
  if (text.length < 18) {
    showNotice("Bitte formuliere ein etwas ausführlicheres Argument.", "error");
    return;
  }

  send({ type: "submit_text_move", text });
});

els.textMoveInput.addEventListener("input", () => {
  state.textDraft = els.textMoveInput.value;
  updateTextControls();
});

els.musicToggleBtn.addEventListener("click", async () => {
  await setMusicEnabled(!state.musicEnabled);
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

els.matchModeSelect.addEventListener("change", updateSetupOptions);
els.playLevelSelect.addEventListener("change", updateSetupOptions);

updateAudioButton();
updateMusicButton();
els.bgMusic.volume = 0.22;
updateSetupOptions();
connect();
