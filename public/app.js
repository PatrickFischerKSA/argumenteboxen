const state = {
  ws: null,
  room: null,
  selectedCardId: null,
  activeInfoTab: "history",
  pendingAutoStartDemo: false,
  textDraft: "",
  lastCueId: null,
  timerInterval: null,
  motionResetTimer: null,
  audioEnabled: false,
  audioManuallyDisabled: false,
  audioCtx: null,
  masterGain: null,
  compressor: null,
  noiseBuffer: null,
  effectSamples: {},
  effectSampleLoads: {},
  crowdSource: null,
  crowdFilter: null,
  crowdGain: null,
  crowdLfo: null,
  crowdLfoGain: null,
  crowdHissSource: null,
  crowdHissGain: null,
  bubbleTimers: {
    pro: null,
    contra: null
  }
};

const els = {
  nameInput: document.getElementById("name-input"),
  roomCodeInput: document.getElementById("room-code-input"),
  matchModeSelect: document.getElementById("match-mode-select"),
  modePickButtons: Array.from(document.querySelectorAll("[data-mode-pick]")),
  playLevelSelect: document.getElementById("play-level-select"),
  joinBox: document.getElementById("join-box"),
  createRoomBtn: document.getElementById("create-room-btn"),
  joinRoomBtn: document.getElementById("join-room-btn"),
  startMatchBtn: document.getElementById("start-match-btn"),
  audioToggleBtn: document.getElementById("audio-toggle-btn"),
  playCardBtn: document.getElementById("play-card-btn"),
  submitTextBtn: document.getElementById("submit-text-btn"),
  textMoveInput: document.getElementById("text-move-input"),
  textMoveLabel: document.getElementById("text-move-label"),
  textCharCount: document.getElementById("text-char-count"),
  textModePanel: document.getElementById("text-mode-panel"),
  demoModePanel: document.getElementById("demo-mode-panel"),
  demoBrief: document.getElementById("demo-brief"),
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
  arenaImpact: document.getElementById("arena-impact"),
  arenaAnnouncer: document.getElementById("arena-announcer"),
  hitTrackPro: document.getElementById("hit-track-pro"),
  hitTrackContra: document.getElementById("hit-track-contra"),
  infoTabs: Array.from(document.querySelectorAll("[data-info-tab]")),
  infoPanels: Array.from(document.querySelectorAll("[data-info-panel]"))
};

const SOUND_FILES = {
  gong: "/assets/audio/sfx/gong.wav",
  hit: "/assets/audio/sfx/hit.wav",
  ko: "/assets/audio/sfx/ko.wav",
  crowdCall: "/assets/audio/sfx/crowd-call.wav",
  crowdCall2: "/assets/audio/sfx/crowd-call-2.wav",
  crowdKo: "/assets/audio/sfx/crowd-ko.wav",
  clap: "/assets/audio/sfx/clap.wav",
  whistle: "/assets/audio/sfx/whistle.wav"
};

function currentConfiguredTurnMs() {
  if (state.room?.turnTimeMs) {
    return state.room.turnTimeMs;
  }

  return els.playLevelSelect.value === "free_text" ? 90_000 : 30_000;
}

function setupNoticeText() {
  if (els.matchModeSelect.value === "demo") {
    return els.playLevelSelect.value === "free_text"
      ? "Im Demo-Modus laufen beide Seiten automatisch. Im Freitext-Level erklärt die Demo, wie Angriffe und Gegenargumente logisch bewertet werden."
      : "Im Demo-Modus laufen beide Seiten automatisch. Die Demo kommentiert Angriff, Abwehr, Volltreffer und Initiative-Wechsel live mit.";
  }

  if (els.matchModeSelect.value === "solo") {
    return els.playLevelSelect.value === "free_text"
      ? "Im Solo-Modus spielt ein Computer direkt gegen dich. Im Freitext-Level formuliert ihr Argumente mit je 90 Sekunden Zugzeit."
      : "Im Solo-Modus erstellt nur ein Gerät den Raum. Der Computer übernimmt automatisch die Gegenseite.";
  }

  return els.playLevelSelect.value === "free_text"
    ? "Beide Spieler*innen spielen im Browser auf demselben Server. Im zweiten Level argumentiert ihr per Texteingabe mit je 90 Sekunden Zugzeit."
    : "Beide Spieler*innen spielen im Browser auf demselben Server, aber auf zwei verschiedenen Computern.";
}

function syncModePickButtons() {
  const activeMode = els.matchModeSelect.value;
  els.modePickButtons.forEach((button) => {
    const active = button.dataset.modePick === activeMode;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", active ? "true" : "false");
  });
}

function updateSetupOptions() {
  const oneDeviceMode = els.matchModeSelect.value === "solo" || els.matchModeSelect.value === "demo";
  els.joinBox.classList.toggle("hidden", oneDeviceMode);
  els.createRoomBtn.textContent =
    els.matchModeSelect.value === "demo"
      ? "Demo-Raum starten"
      : els.matchModeSelect.value === "solo"
        ? "Solo-Raum starten"
        : "Neuen Raum erstellen";
  syncModePickButtons();
  showNotice(setupNoticeText(), "success");
  clearTimerDisplay();
}

function createRoomWithCurrentSettings() {
  primeArenaAudio();
  const name = els.nameInput.value.trim();
  const matchMode = els.matchModeSelect.value;
  state.pendingAutoStartDemo = matchMode === "demo";
  send({
    type: "create_room",
    name,
    matchMode,
    playLevel: els.playLevelSelect.value
  });
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
      state.pendingAutoStartDemo &&
      payload.matchMode === "demo" &&
      payload.status === "lobby" &&
      payload.canStart
    ) {
      state.pendingAutoStartDemo = false;
      send({ type: "start_match" });
    }

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
    stopCrowdAmbience();
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
  state.compressor = state.audioCtx.createDynamicsCompressor();
  state.compressor.threshold.setValueAtTime(-18, state.audioCtx.currentTime);
  state.compressor.knee.setValueAtTime(20, state.audioCtx.currentTime);
  state.compressor.ratio.setValueAtTime(10, state.audioCtx.currentTime);
  state.compressor.attack.setValueAtTime(0.003, state.audioCtx.currentTime);
  state.compressor.release.setValueAtTime(0.18, state.audioCtx.currentTime);
  state.masterGain = state.audioCtx.createGain();
  state.masterGain.gain.value = 0.82;
  state.masterGain.connect(state.compressor);
  state.compressor.connect(state.audioCtx.destination);
  state.noiseBuffer = createNoiseBuffer(state.audioCtx);
  return true;
}

function primeArenaAudio() {
  if (!ensureAudio()) {
    return false;
  }

  primeEffectSamples();

  if (!state.audioEnabled && !state.audioManuallyDisabled) {
    state.audioEnabled = true;
    updateAudioButton();
  }

  return true;
}

function primeEffectSamples() {
  Object.entries(SOUND_FILES).forEach(([name, src]) => {
    if (state.effectSamples[name] || state.effectSampleLoads[name] || !state.audioCtx) {
      return;
    }

    state.effectSampleLoads[name] = fetch(src)
      .then((response) => response.arrayBuffer())
      .then((buffer) => state.audioCtx.decodeAudioData(buffer))
      .then((decoded) => {
        state.effectSamples[name] = decoded;
        delete state.effectSampleLoads[name];
      })
      .catch(() => {
        delete state.effectSampleLoads[name];
      });
  });
}

function playSample(
  name,
  { volume = 1, delay = 0, layers = 1, staggerMs = 40, rate = 1, rateStep = 0.04 } = {}
) {
  if (!state.audioEnabled || !ensureAudio()) {
    return;
  }

  if (!state.effectSamples[name] && !state.effectSampleLoads[name]) {
    primeEffectSamples();
  }

  const sample = state.effectSamples[name];
  if (!sample) {
    return;
  }

  for (let index = 0; index < layers; index += 1) {
    const source = state.audioCtx.createBufferSource();
    const gainNode = state.audioCtx.createGain();
    const playbackRate = Math.max(0.65, rate + index * rateStep);
    source.buffer = sample;
    source.playbackRate.setValueAtTime(playbackRate, state.audioCtx.currentTime);
    gainNode.gain.setValueAtTime(volume, state.audioCtx.currentTime);
    source.connect(gainNode);
    gainNode.connect(state.masterGain);
    source.start(state.audioCtx.currentTime + (delay + index * staggerMs) / 1000);
  }
}

function speakArena(text, { delay = 0, rate = 1.18, pitch = 1.05, volume = 1 } = {}) {
  if (!state.audioEnabled || !("speechSynthesis" in window) || !text) {
    return;
  }

  window.setTimeout(() => {
    const utterance = new SpeechSynthesisUtterance(text);
    const voices = window.speechSynthesis.getVoices();
    utterance.lang = "de-DE";
    utterance.rate = rate;
    utterance.pitch = pitch;
    utterance.volume = Math.min(1, volume);
    utterance.voice =
      voices.find((voice) => voice.lang?.startsWith("de")) ||
      voices.find((voice) => voice.lang?.startsWith("en")) ||
      null;
    window.speechSynthesis.speak(utterance);
  }, delay);
}

function stopCrowdAmbience() {
  if (state.crowdSource) {
    try {
      state.crowdSource.stop();
    } catch (error) {}
    state.crowdSource.disconnect();
    state.crowdSource = null;
  }

  if (state.crowdHissSource) {
    try {
      state.crowdHissSource.stop();
    } catch (error) {}
    state.crowdHissSource.disconnect();
    state.crowdHissSource = null;
  }

  if (state.crowdLfo) {
    try {
      state.crowdLfo.stop();
    } catch (error) {}
    state.crowdLfo.disconnect();
    state.crowdLfo = null;
  }

  if (state.crowdLfoGain) {
    state.crowdLfoGain.disconnect();
    state.crowdLfoGain = null;
  }

  if (state.crowdFilter) {
    state.crowdFilter.disconnect();
    state.crowdFilter = null;
  }

  if (state.crowdGain) {
    state.crowdGain.disconnect();
    state.crowdGain = null;
  }

  if (state.crowdHissGain) {
    state.crowdHissGain.disconnect();
    state.crowdHissGain = null;
  }
}

function startCrowdAmbience() {
  if (!state.audioEnabled || !ensureAudio() || state.crowdSource || !state.noiseBuffer) {
    return;
  }

  const now = state.audioCtx.currentTime;

  state.crowdSource = state.audioCtx.createBufferSource();
  state.crowdSource.buffer = state.noiseBuffer;
  state.crowdSource.loop = true;

  state.crowdFilter = state.audioCtx.createBiquadFilter();
  state.crowdFilter.type = "bandpass";
  state.crowdFilter.frequency.setValueAtTime(540, now);
  state.crowdFilter.Q.setValueAtTime(0.35, now);

  state.crowdGain = state.audioCtx.createGain();
  state.crowdGain.gain.setValueAtTime(0.008, now);

  state.crowdLfo = state.audioCtx.createOscillator();
  state.crowdLfo.type = "sine";
  state.crowdLfo.frequency.setValueAtTime(0.22, now);

  state.crowdLfoGain = state.audioCtx.createGain();
  state.crowdLfoGain.gain.setValueAtTime(0.003, now);

  state.crowdHissSource = state.audioCtx.createBufferSource();
  state.crowdHissSource.buffer = state.noiseBuffer;
  state.crowdHissSource.loop = true;

  const hissHighpass = state.audioCtx.createBiquadFilter();
  hissHighpass.type = "highpass";
  hissHighpass.frequency.setValueAtTime(1800, now);

  const hissLowpass = state.audioCtx.createBiquadFilter();
  hissLowpass.type = "lowpass";
  hissLowpass.frequency.setValueAtTime(5200, now);

  state.crowdHissGain = state.audioCtx.createGain();
  state.crowdHissGain.gain.setValueAtTime(0.0015, now);

  state.crowdLfo.connect(state.crowdLfoGain);
  state.crowdLfoGain.connect(state.crowdGain.gain);

  state.crowdSource.connect(state.crowdFilter);
  state.crowdFilter.connect(state.crowdGain);
  state.crowdGain.connect(state.masterGain);

  state.crowdHissSource.connect(hissHighpass);
  hissHighpass.connect(hissLowpass);
  hissLowpass.connect(state.crowdHissGain);
  state.crowdHissGain.connect(state.masterGain);

  state.crowdSource.start(now);
  state.crowdHissSource.start(now);
  state.crowdLfo.start(now);
}

function syncArenaAmbience() {
  stopCrowdAmbience();
}

function createNoiseBuffer(audioCtx) {
  const length = Math.floor(audioCtx.sampleRate * 0.8);
  const buffer = audioCtx.createBuffer(1, length, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let index = 0; index < length; index += 1) {
    data[index] = Math.random() * 2 - 1;
  }
  return buffer;
}

function updateAudioButton() {
  els.audioToggleBtn.textContent = state.audioEnabled ? "Effekte aus" : "Effekte an";
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

function playNoiseBurst({
  duration = 0.16,
  gain = 0.18,
  highpass = 120,
  lowpass = 2400,
  attack = 0.004,
  release = duration
} = {}) {
  if (!state.audioEnabled || !ensureAudio() || !state.noiseBuffer) {
    return;
  }

  const now = state.audioCtx.currentTime;
  const source = state.audioCtx.createBufferSource();
  source.buffer = state.noiseBuffer;

  const high = state.audioCtx.createBiquadFilter();
  high.type = "highpass";
  high.frequency.setValueAtTime(highpass, now);

  const low = state.audioCtx.createBiquadFilter();
  low.type = "lowpass";
  low.frequency.setValueAtTime(lowpass, now);

  const envelope = state.audioCtx.createGain();
  envelope.gain.setValueAtTime(0.0001, now);
  envelope.gain.exponentialRampToValueAtTime(gain, now + attack);
  envelope.gain.exponentialRampToValueAtTime(0.0001, now + release);

  source.connect(high);
  high.connect(low);
  low.connect(envelope);
  envelope.connect(state.masterGain);

  source.start(now);
  source.stop(now + duration);
}

function playSwingSound() {
  pulseTone({ frequency: 410, slideTo: 135, duration: 0.18, type: "sawtooth", gain: 0.22 });
  playNoiseBurst({ duration: 0.15, gain: 0.18, highpass: 300, lowpass: 5600, release: 0.11 });
}

function playHitCrack(strength = 1) {
  pulseTone({ frequency: 1480, slideTo: 820, duration: 0.08, type: "square", gain: 0.22 * strength });
  pulseTone({ frequency: 2440, slideTo: 1380, duration: 0.06, type: "sawtooth", gain: 0.12 * strength });
  playNoiseBurst({ duration: 0.09, gain: 0.2 * strength, highpass: 760, lowpass: 7600, release: 0.07 });
}

function playImpactSound(strength = 1) {
  playSample("hit", {
    volume: 1.2 + strength * 0.36,
    layers: strength >= 2 ? 5 : 3,
    staggerMs: strength >= 2 ? 14 : 20,
    rate: strength >= 2 ? 0.92 : 0.98,
    rateStep: 0.03
  });
  pulseTone({ frequency: 188, slideTo: 58, duration: 0.26, type: "square", gain: 0.54 * strength });
  pulseTone({ frequency: 118, slideTo: 42, duration: 0.38, type: "triangle", gain: 0.36 * strength });
  pulseTone({ frequency: 560, slideTo: 170, duration: 0.14, type: "sawtooth", gain: 0.2 * strength });
  playNoiseBurst({ duration: 0.26, gain: 0.42 * strength, highpass: 90, lowpass: 3200, release: 0.2 });
  playHitCrack(strength);
}

function playPainSound(strength = 1) {
  pulseTone({ frequency: 980, slideTo: 430, duration: 0.18, type: "sawtooth", gain: 0.22 * strength });
  window.setTimeout(() => {
    pulseTone({ frequency: 820, slideTo: 280, duration: 0.24, type: "triangle", gain: 0.16 * strength });
  }, 40);
}

function playBlockSound() {
  pulseTone({ frequency: 640, duration: 0.09, type: "square", gain: 0.24 });
  window.setTimeout(() => {
    pulseTone({ frequency: 1240, duration: 0.12, type: "triangle", gain: 0.22 });
  }, 35);
  playNoiseBurst({ duration: 0.12, gain: 0.18, highpass: 1500, lowpass: 6600, release: 0.1 });
}

function playBellStrike({ delay = 0, base = 1040, gain = 0.34 } = {}) {
  window.setTimeout(() => {
    pulseTone({ frequency: base, duration: 0.06, type: "square", gain });
    pulseTone({ frequency: base * 1.98, duration: 0.08, type: "square", gain: gain * 0.9 });
    pulseTone({ frequency: base * 2.94, duration: 0.06, type: "sawtooth", gain: gain * 0.62 });
    pulseTone({ frequency: 360, duration: 1.6, type: "triangle", gain: gain * 0.24 });
    pulseTone({ frequency: 512, duration: 1.2, type: "triangle", gain: gain * 0.18 });
    playNoiseBurst({ duration: 0.1, gain: gain, highpass: 920, lowpass: 9600, release: 0.06 });
  }, delay);
}

function playGongSound() {
  playSample("gong", { volume: 2.2, layers: 4, staggerMs: 42, rate: 0.94, rateStep: -0.03 });
  playBellStrike({ delay: 0, base: 1180, gain: 0.56 });
  playBellStrike({ delay: 58, base: 1100, gain: 0.46 });
  playBellStrike({ delay: 126, base: 1020, gain: 0.36 });
  window.setTimeout(() => {
    pulseTone({ frequency: 380, duration: 2.6, type: "triangle", gain: 0.32 });
    pulseTone({ frequency: 540, duration: 2.1, type: "triangle", gain: 0.26 });
    pulseTone({ frequency: 820, duration: 1.35, type: "sine", gain: 0.16 });
    playNoiseBurst({ duration: 0.72, gain: 0.28, highpass: 380, lowpass: 8200, release: 0.58 });
  }, 26);
}

function playKoSound() {
  playSample("ko", { volume: 2.4, layers: 4, staggerMs: 22, rate: 0.92, rateStep: -0.05 });
  playImpactSound(3.2);
  window.setTimeout(() => {
    pulseTone({ frequency: 120, slideTo: 30, duration: 1.06, type: "sawtooth", gain: 0.88 });
    pulseTone({ frequency: 68, slideTo: 32, duration: 1.18, type: "triangle", gain: 0.42 });
    playNoiseBurst({ duration: 0.62, gain: 0.62, highpass: 50, lowpass: 1400, release: 0.5 });
  }, 55);
  window.setTimeout(() => {
    playPainSound(1.7);
  }, 120);
}

function playCrowdRoar({ gain = 0.08, duration = 0.9, highpass = 180, lowpass = 3200 } = {}) {
  playNoiseBurst({
    duration,
    gain,
    highpass,
    lowpass,
    attack: 0.01,
    release: duration * 0.8
  });
}

function playCrowdYell({ frequency = 720, slideTo = 1080, duration = 0.32, gain = 0.16, delay = 0 } = {}) {
  window.setTimeout(() => {
    pulseTone({ frequency, slideTo, duration, type: "sawtooth", gain });
    pulseTone({ frequency: frequency * 1.6, slideTo: slideTo * 1.12, duration: duration * 0.72, type: "square", gain: gain * 0.7 });
    pulseTone({ frequency: frequency * 2.3, slideTo: slideTo * 1.28, duration: duration * 0.46, type: "triangle", gain: gain * 0.28 });
    playNoiseBurst({ duration: duration * 0.5, gain: gain * 0.18, highpass: 700, lowpass: 3800, release: duration * 0.42 });
  }, delay);
}

function playCrowdChant({ delay = 0, gain = 0.14 } = {}) {
  window.setTimeout(() => {
    pulseTone({ frequency: 520, slideTo: 680, duration: 0.18, type: "square", gain: gain * 1.2 });
    pulseTone({ frequency: 980, slideTo: 1240, duration: 0.12, type: "triangle", gain: gain * 0.5 });
    window.setTimeout(() => {
      pulseTone({ frequency: 600, slideTo: 840, duration: 0.2, type: "square", gain: gain * 1.06 });
      pulseTone({ frequency: 1120, slideTo: 1380, duration: 0.12, type: "triangle", gain: gain * 0.46 });
    }, 86);
    window.setTimeout(() => {
      pulseTone({ frequency: 680, slideTo: 960, duration: 0.22, type: "triangle", gain: gain });
      pulseTone({ frequency: 1280, slideTo: 1560, duration: 0.14, type: "triangle", gain: gain * 0.4 });
    }, 168);
  }, delay);
}

function playCrowdClaps(count = 6, spacing = 120, gain = 0.22) {
  for (let index = 0; index < count; index += 1) {
    window.setTimeout(() => {
      playSample("clap", { volume: 1.2 + gain * 3.4, layers: 2, staggerMs: 12, rate: 0.98 + index * 0.01 });
      playNoiseBurst({
        duration: 0.045,
        gain,
        highpass: 1100,
        lowpass: 5200,
        attack: 0.002,
        release: 0.04
      });
      pulseTone({ frequency: 2100, duration: 0.04, type: "square", gain: 0.06 });
    }, index * spacing);
  }
}

function playCrowdWhistle() {
  playSample("whistle", { volume: 2.1, layers: 3, staggerMs: 90, rate: 0.96, rateStep: 0.05 });
  pulseTone({ frequency: 1820, slideTo: 1440, duration: 0.26, type: "triangle", gain: 0.38 });
  pulseTone({ frequency: 2460, slideTo: 1980, duration: 0.18, type: "square", gain: 0.18 });
  window.setTimeout(() => {
    pulseTone({ frequency: 1960, slideTo: 1540, duration: 0.24, type: "triangle", gain: 0.34 });
  }, 85);
  window.setTimeout(() => {
    pulseTone({ frequency: 1720, slideTo: 2240, duration: 0.18, type: "triangle", gain: 0.24 });
  }, 180);
}

function playCrowdCheer() {
  playSample("crowdCall", { volume: 4.2, delay: 18, layers: 3, staggerMs: 72, rate: 1.02, rateStep: 0.03 });
  playSample("crowdCall2", { volume: 3.8, delay: 92, layers: 3, staggerMs: 90, rate: 1.06, rateStep: 0.04 });
  speakArena("Woo!", { delay: 30, rate: 1.34, pitch: 1.16, volume: 1 });
  speakArena("Ja!", { delay: 150, rate: 1.38, pitch: 1.2, volume: 1 });
  playCrowdRoar({ gain: 0.02, duration: 0.46, highpass: 260, lowpass: 3200 });
  playCrowdClaps(10, 78, 0.24);
  playCrowdYell({ frequency: 660, slideTo: 1040, duration: 0.3, gain: 0.32, delay: 12 });
  playCrowdYell({ frequency: 820, slideTo: 1320, duration: 0.24, gain: 0.24, delay: 96 });
  playCrowdChant({ delay: 150, gain: 0.22 });
  window.setTimeout(() => {
    playCrowdWhistle();
  }, 104);
}

function playCueSound(cue) {
  if (!cue || !state.audioEnabled) {
    return;
  }

  if (cue.type === "match-start") {
    playGongSound();
    window.setTimeout(() => {
      playCrowdRoar({ gain: 0.08, duration: 0.76, highpass: 220, lowpass: 3200 });
      playCrowdClaps(12, 72, 0.24);
      playCrowdYell({ frequency: 620, slideTo: 1040, duration: 0.36, gain: 0.34 });
      playCrowdYell({ frequency: 820, slideTo: 1320, duration: 0.28, gain: 0.26, delay: 96 });
      playCrowdChant({ delay: 170, gain: 0.24 });
    }, 90);
    window.setTimeout(() => {
      playCrowdWhistle();
    }, 220);
    return;
  }

  if (cue.type === "attack") {
    playSwingSound();
    return;
  }

  if (cue.type === "counter") {
    playBlockSound();
    return;
  }

  if (cue.type === "hit") {
    playImpactSound(1.4);
    window.setTimeout(() => {
      playPainSound(1.1);
    }, 50);
    window.setTimeout(() => {
      playCrowdCheer();
    }, 80);
    return;
  }

  if (cue.type === "timeout-hit") {
    playImpactSound(2.8);
    window.setTimeout(() => {
      playPainSound(1.8);
    }, 50);
    window.setTimeout(() => {
      playCrowdRoar({ gain: 0.09, duration: 0.66, highpass: 220, lowpass: 3400 });
      playCrowdClaps(14, 64, 0.28);
      playCrowdYell({ frequency: 660, slideTo: 1180, duration: 0.34, gain: 0.38 });
      playCrowdYell({ frequency: 860, slideTo: 1440, duration: 0.26, gain: 0.28, delay: 92 });
      playCrowdChant({ delay: 150, gain: 0.26 });
      playCrowdWhistle();
    }, 85);
    return;
  }

  if (cue.type === "timeout-turnover") {
    playNoiseBurst({ duration: 0.12, gain: 0.06, highpass: 1800, lowpass: 5200, release: 0.08 });
    pulseTone({ frequency: 520, slideTo: 430, duration: 0.14, type: "triangle", gain: 0.05 });
    return;
  }

  if (cue.type === "ko") {
    playKoSound();
    window.setTimeout(() => {
      playSample("crowdKo", { volume: 5, layers: 3, staggerMs: 120, rate: 0.96, rateStep: 0.05 });
      playSample("crowdCall", { volume: 4.6, delay: 56, layers: 3, staggerMs: 86, rate: 0.98, rateStep: 0.04 });
      playSample("crowdCall2", { volume: 4.2, delay: 132, layers: 3, staggerMs: 100, rate: 1.02, rateStep: 0.05 });
      speakArena("Ooooooh!", { delay: 12, rate: 1.1, pitch: 0.82, volume: 1 });
      speakArena("K O!", { delay: 180, rate: 1.22, pitch: 0.9, volume: 1 });
      speakArena("Aus!", { delay: 360, rate: 1.34, pitch: 1.02, volume: 1 });
      playCrowdRoar({ gain: 0.11, duration: 1.08, highpass: 160, lowpass: 3200 });
      playCrowdClaps(22, 56, 0.3);
      playCrowdYell({ frequency: 640, slideTo: 1240, duration: 0.44, gain: 0.44 });
      playCrowdYell({ frequency: 760, slideTo: 1420, duration: 0.34, gain: 0.34, delay: 104 });
      playCrowdYell({ frequency: 900, slideTo: 1600, duration: 0.28, gain: 0.26, delay: 220 });
      playCrowdChant({ delay: 150, gain: 0.3 });
      playCrowdChant({ delay: 340, gain: 0.24 });
      playCrowdWhistle();
      window.setTimeout(() => {
        playCrowdWhistle();
      }, 220);
    }, 110);
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
      state.room.matchMode !== "demo" &&
      state.room.status === "active" &&
      state.room.user &&
      state.room.activePlayerId === state.room.user.id
  );
}

function isDemoMode() {
  return state.room?.matchMode === "demo" || els.matchModeSelect.value === "demo";
}

function isFreeTextLevel() {
  return state.room?.playLevel === "free_text";
}

function currentActionLabel() {
  if (!state.room || !state.room.user) {
    if (els.matchModeSelect.value === "demo") {
      return "Der Demo-Modus führt das ganze Match automatisch vor und kommentiert jeden Schritt.";
    }

    return "Wähle einen Modus und tritt der Arena bei.";
  }

  if (state.room.matchMode === "demo") {
    return state.room.status === "active"
      ? "Der Demo-Modus spielt automatisch weiter. Der nächste Zug kommt nach etwa 6 Sekunden."
      : "Der Demo-Modus spielt das ganze Match automatisch und erklärt jeden Schritt.";
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

function renderDemoPanel() {
  const narration = state.room?.demoNarration;
  const latestHistory = (state.room?.history || [])
    .slice()
    .reverse()
    .slice(0, 3);

  const historyMarkup = latestHistory.length
    ? latestHistory
        .map(
          (item) => `
            <article class="demo-history-item">
              <strong>${escapeHtml(item.headline || "Arena-Update")}</strong>
              <p>${escapeHtml(item.body || "")}</p>
            </article>
          `
        )
        .join("")
    : "<p class='history-empty'>Sobald die Demo startet, erscheinen hier die erklärten Schlagwechsel.</p>";

  els.demoBrief.innerHTML = `
    <article class="demo-spotlight">
      <p class="eyebrow">Demo-Erklärung</p>
      <h3>${escapeHtml(narration?.title || "Showkampf bereit")}</h3>
      <p>${escapeHtml(narration?.body || "Starte den Demo-Modus. Danach laufen beide Seiten automatisch durch ein ganzes Match.")}</p>
      ${
        state.room?.status === "active"
          ? "<p class='demo-wait-note'>Automatische Fortsetzung: Der nächste Demo-Zug folgt nach ungefähr 6 Sekunden.</p>"
          : ""
      }
    </article>
    <div class="demo-history">
      <div class="panel-heading compact">
        <h2>Letzte Demo-Schritte</h2>
        <p>Die Demo kommentiert jeden Schlagwechsel kurz und klar.</p>
      </div>
      <div class="demo-history-list">${historyMarkup}</div>
    </div>
  `;
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
  const demoMode = isDemoMode();

  els.cardsModePanel.classList.toggle("hidden", textLevel || demoMode);
  els.textModePanel.classList.toggle("hidden", !textLevel || demoMode);
  els.demoModePanel.classList.toggle("hidden", !demoMode);
  els.actionPanelTitle.textContent = demoMode ? "Demo-Ablauf" : textLevel ? "Dein Textzug" : "Deine Karten";

  if (demoMode) {
    els.selectedCardPanel.innerHTML = "";
    renderDemoPanel();
    return;
  }

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

function renderInfoPanels() {
  const activeTab = state.activeInfoTab || "history";
  els.infoTabs.forEach((button) => {
    const active = button.dataset.infoTab === activeTab;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", active ? "true" : "false");
  });

  els.infoPanels.forEach((panel) => {
    panel.classList.toggle("hidden", panel.dataset.infoPanel !== activeTab);
  });
}

function renderRoomMeta() {
  const matchMode = state.room?.matchMode || els.matchModeSelect.value;
  const playLevel = state.room?.playLevel || els.playLevelSelect.value;
  const modeText = playLevel === "free_text" ? "Level 2: Freitextduell" : "Level 1: Kartenkampf";
  const opponentText =
    matchMode === "demo"
      ? "Demo-Modus"
      : matchMode === "solo"
        ? "Solo gegen Computer"
        : "Duell auf zwei Computern";

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
    eyebrow = room.matchMode === "demo" ? "Demo-Modus" : room.matchMode === "solo" ? "Solo-Modus" : "Vor dem Kampf";

    if (room.canStart) {
      title =
        room.matchMode === "demo"
          ? "Demo ist bereit"
          : room.matchMode === "solo"
            ? "Computer ist bereit"
            : "Beide Kängurus sind bereit";
      copy =
        room.matchMode === "demo"
          ? "Starte jetzt den Demo-Modus. Danach spielen beide Seiten das ganze Match automatisch durch, und die Arena erklärt jeden Schritt."
          : room.matchMode === "solo"
          ? "Du hast den Raum angelegt, die Gegenseite wird vom Computer übernommen. Starte den Kampf jetzt bewusst mit dem großen Startsignal."
          : "Der Raum ist vollständig. Starte den Kampf jetzt bewusst mit dem großen Startsignal, damit beide Seiten denselben klaren Beginn erleben.";
      buttonText = room.matchMode === "demo" ? "Demo starten" : "Kampf starten";
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
  renderInfoPanels();
  syncArenaAmbience();
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
  createRoomWithCurrentSettings();
});

els.joinRoomBtn.addEventListener("click", () => {
  primeArenaAudio();
  const name = els.nameInput.value.trim();
  const roomCode = els.roomCodeInput.value.trim().toUpperCase();
  send({ type: "join_room", name, roomCode });
});

els.startMatchBtn.addEventListener("click", () => {
  primeArenaAudio();
  send({ type: "start_match" });
});

els.arenaStartBtn.addEventListener("click", () => {
  primeArenaAudio();
  send({ type: "start_match" });
});

els.playCardBtn.addEventListener("click", () => {
  sendSelectedCard(state.selectedCardId);
});

els.infoTabs.forEach((button) => {
  button.addEventListener("click", () => {
    state.activeInfoTab = button.dataset.infoTab || "history";
    renderInfoPanels();
  });
});

els.submitTextBtn.addEventListener("click", () => {
  primeArenaAudio();
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

els.audioToggleBtn.addEventListener("click", () => {
  if (!state.audioEnabled) {
    if (!ensureAudio()) {
      return;
    }
    state.audioEnabled = true;
    state.audioManuallyDisabled = false;
  } else {
    state.audioEnabled = false;
    state.audioManuallyDisabled = true;
  }

  updateAudioButton();
  syncArenaAmbience();
});

els.matchModeSelect.addEventListener("change", updateSetupOptions);
els.playLevelSelect.addEventListener("change", updateSetupOptions);
els.modePickButtons.forEach((button) => {
  button.addEventListener("click", () => {
    els.matchModeSelect.value = button.dataset.modePick || "duel";
    updateSetupOptions();

    if (button.dataset.modePick === "demo") {
      createRoomWithCurrentSettings();
    }
  });
});

updateAudioButton();
updateSetupOptions();
connect();
