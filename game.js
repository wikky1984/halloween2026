(() => {
  "use strict";
  const screens = [...document.querySelectorAll(".screen")];
  const game = document.getElementById("game");
  const soundButton = document.getElementById("sound-toggle");
  const soundLabel = document.getElementById("sound-label");
  const music = document.getElementById("bgm");
  const sealButton = document.getElementById("seal-button");
  const sealStatus = document.getElementById("seal-status");
  const rhythmTrack = document.getElementById("rhythm-track");
  const fallingNote = document.getElementById("falling-note");
  const noteArt = document.getElementById("note-art");
  const hitCount = document.getElementById("hit-count");
  const missCount = document.getElementById("miss-count");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const scenes = {
    coffin: { art: "coffin.svg", title: "The coffin opened.", copy: "A heartbeat echoes from the darkness. It isn't yours." },
    pumpkin: { art: "pumpkin.svg", title: "The lantern grinned.", copy: "Its grin grows wider. A little voice whispers your name." },
    door: { art: "door.svg", title: "The old door knocked.", copy: "Three slow knocks answer from the other side." }
  };
  const endings = {
    coffin: {
      win: { headline: "THE LID IS SHUT.", names: ["THE COFFIN KEEPER", "THE MIDNIGHT LOCKSMITH"], copy: "The heartbeat stops. Then the coffin knocks once from the inside." },
      lose: { headline: "THE COFFIN OPENED.", names: ["THE NEW RESIDENT", "THE UNINVITED GUEST"], copy: "The heartbeat was yours after all. The garage has a new guest." }
    },
    pumpkin: {
      win: { headline: "THE GRIN WENT DARK.", names: ["THE LANTERN TAMER", "THE PUMPKIN WHISPERER"], copy: "You blew out the lantern. Its smile still follows you home." },
      lose: { headline: "IT KNOWS YOUR NAME.", names: ["THE LANTERN'S FRIEND", "THE CURSED CARVER"], copy: "The lantern lights itself again. A whisper calls from behind you." }
    },
    door: {
      win: { headline: "THE DOOR IS LOCKED.", names: ["THE KEY KEEPER", "THE GARAGE GUARDIAN"], copy: "You turned the key just in time. Three slow knocks follow anyway." },
      lose: { headline: "SOMETHING GOT OUT.", names: ["THE DOOR OPENER", "THE SHADOW'S GUIDE"], copy: "The handle turns. The footsteps don't stop at the garage." }
    }
  };
  let current = "intro";
  let taps = 0;
  let misses = 0;
  let locked = false;
  let selectedChoice = null;
  let roundActive = false;
  let noteStart = 0;
  let cueAnnounced = false;
  let frameId = 0;
  let soundOn = true;
  let audio = null;
  let ambient = null;
  let heartbeatTimer = null;
  let timers = [];
  music.volume = 0.72;
  soundButton.dataset.musicState = "armed";
  music.addEventListener("playing", () => {
    soundButton.dataset.musicState = music.paused ? "paused" : "playing";
  });
  music.addEventListener("error", () => {
    soundButton.dataset.musicState = "error";
  });

  function later(fn, ms) {
    const id = window.setTimeout(() => {
      timers = timers.filter(item => item !== id);
      fn();
    }, ms);
    timers.push(id);
    return id;
  }
  function clearTimers() {
    timers.forEach(window.clearTimeout);
    timers = [];
  }
  function audioState() {
    soundButton.dataset.audioState = soundOn ? (audio ? audio.state : "armed") : "off";
  }
  function show(id) {
    current = id;
    screens.forEach(screen => {
      const visible = screen.id === id;
      screen.hidden = !visible;
      screen.classList.toggle("active", visible);
    });
    document.body.classList.toggle("curse-awake", ["reveal", "seal"].includes(id));
    document.body.classList.toggle("scare-mode", id === "scare");
    game.scrollTop = 0;
    window.scrollTo(0, 0);
    const focusTarget = document.querySelector("#" + id + " h1, #" + id + " h2");
    if (focusTarget && id !== "scare") {
      focusTarget.setAttribute("tabindex", "-1");
      focusTarget.focus({ preventScroll: true });
    }
  }
  function audioContext() {
    if (!soundOn) return null;
    try {
      if (!audio) {
        audio = new (window.AudioContext || window.webkitAudioContext)();
        audio.onstatechange = audioState;
      }
      if (audio.state === "suspended") audio.resume().then(audioState).catch(audioState);
      audioState();
      return audio;
    } catch {
      soundButton.dataset.audioState = "unavailable";
      return null;
    }
  }
  function tone(freq, duration, shape = "sine", volume = 0.035, endFreq = null, delay = 0) {
    const ctx = audioContext();
    if (!ctx) return;
    const start = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = shape;
    osc.frequency.setValueAtTime(freq, start);
    if (endFreq) osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), start + duration);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(Math.min(volume * 2.3, 0.14), start + Math.min(0.035, duration / 4));
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(gain).connect(ctx.destination);
    osc.start(start);
    osc.stop(start + duration + 0.02);
  }
  function noiseBurst(duration, volume) {
    const ctx = audioContext();
    if (!ctx) return;
    const length = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const samples = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) samples[i] = Math.random() * 2 - 1;
    const source = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    source.buffer = buffer;
    filter.type = "bandpass";
    filter.frequency.value = 900;
    filter.Q.value = 0.6;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(Math.min(volume * 1.8, 0.08), ctx.currentTime + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
    source.connect(filter).connect(gain).connect(ctx.destination);
    source.start();
    source.stop(ctx.currentTime + duration);
  }
  function sound(kind) {
    if (kind === "enter") { tone(480, .85, "sine", .045, 210); tone(620, .7, "triangle", .025, 300, .13); }
    if (kind === "heart") { tone(250, .18, "triangle", .035, 175); tone(230, .22, "triangle", .030, 150, .24); }
    if (kind === "coffin") { sound("heart"); tone(310, .9, "sine", .025, 180, .5); }
    if (kind === "pumpkin") { tone(380, .55, "triangle", .025, 540); tone(480, .6, "sine", .018, 220, .35); }
    if (kind === "door") { [0, .38, .79].forEach(t => tone(285, .18, "triangle", .055, 155, t)); }
    if (kind === "glow") { tone(510, .28, "sine", .012, 630); }
    if (kind === "miss") { tone(170, .22, "triangle", .025, 90); }
    if (kind === "tap") { tone(430 + taps * 95, .26, "sine", .043, 770 + taps * 90); }
    if (kind === "scare") { tone(680, .65, "sawtooth", .06, 220); tone(980, .40, "triangle", .025, 390, .05); noiseBurst(.45, .032); }
    if (kind === "win") { [440, 554, 659].forEach((f, i) => tone(f, .5, "sine", .024, f * 1.2, i * .12)); }
    if (kind === "lose") { [440, 330, 220].forEach((f, i) => tone(f, .65, "triangle", .03, f * .75, i * .18)); }
  }
  function startMusic() {
    if (!soundOn || !["choice", "reveal", "seal"].includes(current) || !music.paused) return;
    soundButton.dataset.musicState = "starting";
    const started = music.play();
    if (started && typeof started.catch === "function") {
      started.then(() => {
        soundButton.dataset.musicState = music.paused ? "paused" : "playing";
      }).catch(() => {
        if (soundOn && ["choice", "reveal", "seal"].includes(current)) soundButton.dataset.musicState = "blocked";
      });
    }
  }
  function stopMusic(reset = false) {
    music.pause();
    if (reset) {
      try { music.currentTime = 0; } catch {}
    }
    soundButton.dataset.musicState = soundOn ? "paused" : "off";
  }
  function startAmbience() {
    if (!soundOn || !["choice", "reveal", "seal"].includes(current)) return;
    startMusic();
    if (ambient) return;
    const ctx = audioContext();
    if (!ctx) return;
    const hum = ctx.createOscillator();
    const gain = ctx.createGain();
    hum.type = "triangle";
    hum.frequency.value = 245;
    gain.gain.value = 0.012;
    hum.connect(gain).connect(ctx.destination);
    hum.start();
    ambient = { hum, gain };
    heartbeatTimer = window.setInterval(() => {
      if (!document.hidden && soundOn && ["choice", "reveal", "seal"].includes(current)) sound("heart");
    }, 1700);
  }
  function stopAmbience() {
    stopMusic();
    if (heartbeatTimer) window.clearInterval(heartbeatTimer);
    heartbeatTimer = null;
    if (!ambient || !audio) return;
    const { hum, gain } = ambient;
    ambient = null;
    const now = audio.currentTime;
    gain.gain.setTargetAtTime(0.0001, now, .08);
    try { hum.stop(now + .4); } catch {}
  }
  function updateSound() {
    soundButton.setAttribute("aria-pressed", String(soundOn));
    soundButton.setAttribute("aria-label", soundOn ? "Turn sound off" : "Turn sound on");
    soundLabel.textContent = soundOn ? "SOUND ON" : "SOUND OFF";
    audioState();
  }
  soundButton.addEventListener("click", () => {
    soundOn = !soundOn;
    updateSound();
    if (soundOn) {
      audioContext();
      tone(523, .18, "sine", .025);
      startAmbience();
    } else {
      stopAmbience();
      if (audio && audio.state === "running") audio.suspend().then(audioState).catch(audioState);
    }
  });
  document.getElementById("enter-button").addEventListener("click", () => {
    if (current !== "intro") return;
    audioContext();
    sound("enter");
    show("choice");
    startAmbience();
  });
  document.querySelectorAll(".choice-card").forEach(button => {
    button.addEventListener("click", () => {
      if (current !== "choice") return;
      const scene = scenes[button.dataset.choice];
      if (!scene) return;
      selectedChoice = button.dataset.choice;
      noteArt.src = scene.art;
      document.getElementById("result-art").src = scene.art;
      clearTimers();
      const art = document.getElementById("reveal-art");
      const image = new Image();
      image.src = scene.art;
      image.alt = "";
      art.replaceChildren(image);
      document.getElementById("reveal-title").textContent = scene.title;
      document.getElementById("reveal-copy").textContent = scene.copy;
      show("reveal");
      sound(button.dataset.choice);
      later(() => { if (current === "reveal") beginSeal(); }, reducedMotion.matches ? 2200 : 4800);
    });
  });
  function randomName(names) {
    try {
      const values = new Uint32Array(1);
      crypto.getRandomValues(values);
      return names[values[0] % names.length];
    } catch {
      return names[Math.floor(Math.random() * names.length)];
    }
  }
  function scoreText() {
    hitCount.textContent = "HITS " + taps + " / 3";
    missCount.textContent = "MISSES " + misses + " / 3";
  }
  function noteTiming() {
    return reducedMotion.matches ? { fall: 1500, window: 700 } : { fall: 1900, window: 500 };
  }
  function stopRound() {
    roundActive = false;
    if (frameId) cancelAnimationFrame(frameId);
    frameId = 0;
    fallingNote.hidden = true;
    sealButton.classList.remove("ready");
    sealButton.setAttribute("aria-label", "Wait for the next falling symbol");
  }
  function drawNote(now) {
    if (!roundActive || current !== "seal" || locked) return;
    const elapsed = now - noteStart;
    const { fall, window: windowMs } = noteTiming();
    const travel = Math.max(0, rhythmTrack.clientHeight - 106);
    if (!reducedMotion.matches) {
      const progress = Math.min(1.2, Math.max(0, elapsed / fall));
      fallingNote.style.setProperty("--note-y", Math.round(travel * progress) + "px");
    } else if (elapsed >= fall - windowMs) {
      fallingNote.hidden = false;
      fallingNote.style.setProperty("--note-y", travel + "px");
    }
    if (!cueAnnounced && elapsed >= fall - windowMs) {
      cueAnnounced = true;
      sealButton.classList.add("ready");
      sealButton.setAttribute("aria-label", "Tap now! Catch the falling symbol");
      sealStatus.textContent = "NOW! TAP THE RING";
      sound("glow");
    }
    if (elapsed > fall + windowMs) {
      finishRound(false, "MISSED BEAT");
      return;
    }
    frameId = requestAnimationFrame(drawNote);
  }
  function startRound() {
    if (current !== "seal" || locked || document.hidden) return;
    stopRound();
    cueAnnounced = false;
    sealButton.classList.remove("hit", "miss");
    sealButton.setAttribute("aria-label", "Wait for the falling symbol to reach the ring");
    sealStatus.textContent = "WATCH THE FALLING SYMBOL";
    noteStart = performance.now();
    fallingNote.style.setProperty("--note-y", "0px");
    fallingNote.hidden = reducedMotion.matches;
    roundActive = true;
    frameId = requestAnimationFrame(drawNote);
  }
  function beginSeal() {
    show("seal");
    scoreText();
    sealStatus.textContent = "GET READY...";
    later(startRound, 650);
  }
  function finishRound(success, reason = "") {
    if (!roundActive || locked) return;
    stopRound();
    if (success) {
      taps += 1;
      sound("tap");
      sealButton.classList.add("hit");
      sealStatus.textContent = taps === 3 ? "THREE HITS!" : "NICE HIT! " + (3 - taps) + " TO GO";
    } else {
      misses += 1;
      sound("miss");
      sealButton.classList.add("miss");
      const remaining = 3 - misses;
      sealStatus.textContent = remaining ? reason + " — " + remaining + (remaining === 1 ? " CHANCE LEFT" : " CHANCES LEFT") : "THREE MISSES — CURSED!";
    }
    scoreText();
    if (taps >= 3 || misses >= 3) {
      locked = true;
      sealButton.disabled = true;
      sealButton.setAttribute("aria-label", taps >= 3 ? "Three hits. You survived." : "Three misses. The curse wins.");
      later(() => finishGame(taps >= 3), 600);
    } else {
      later(startRound, 550);
    }
  }
  function finishGame(won) {
    if (current !== "seal") return;
    clearTimers();
    stopRound();
    stopAmbience();
    const choice = selectedChoice || "pumpkin";
    const ending = endings[choice][won ? "win" : "lose"];
    document.body.classList.toggle("cursed-ending", !won);
    document.getElementById("result-eyebrow").textContent = won ? "YOU SURVIVED!" : "THREE MISSES. THE CURSE WINS.";
    document.getElementById("result-title").textContent = ending.headline;
    document.getElementById("result-intro").textContent = won ? "Your spooky title is..." : "Your cursed title is...";
    document.getElementById("result-name").textContent = randomName(ending.names);
    document.getElementById("result-copy").textContent = ending.copy;
    document.getElementById("scare-word").textContent = won ? "BOO!" : "GOTCHA!";
    later(() => {
      show("scare");
      sound("scare");
      later(() => {
        if (current !== "scare") return;
        show("result");
        sound(won ? "win" : "lose");
      }, reducedMotion.matches ? 800 : 1900);
    }, reducedMotion.matches ? 300 : 650);
  }
  function resetSeal() {
    stopRound();
    taps = 0;
    misses = 0;
    locked = false;
    selectedChoice = null;
    sealButton.disabled = false;
    sealButton.classList.remove("hit", "miss");
    sealButton.setAttribute("aria-label", "Tap when the falling symbol reaches the ring");
    sealStatus.textContent = "GET READY...";
    document.body.classList.remove("cursed-ending");
    scoreText();
  }
  sealButton.addEventListener("click", () => {
    if (current !== "seal" || locked || !roundActive) return;
    const elapsed = performance.now() - noteStart;
    const { fall, window: windowMs } = noteTiming();
    if (elapsed < fall - windowMs) finishRound(false, "TOO EARLY");
    else if (elapsed > fall + windowMs) finishRound(false, "TOO LATE");
    else finishRound(true);
  });
  document.getElementById("replay-button").addEventListener("click", () => {
    clearTimers();
    stopAmbience();
    stopMusic(true);
    resetSeal();
    show("intro");
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      if (current === "seal" && !locked) {
        clearTimers();
        stopRound();
        sealStatus.textContent = "PAUSED";
      }
      stopAmbience();
    } else {
      if (soundOn) startAmbience();
      if (current === "seal" && !locked) {
        sealStatus.textContent = "GET READY...";
        later(startRound, 450);
      }
    }
  });
  updateSound();
  resetSeal();
  show("intro");
})();

