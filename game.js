(() => {
  "use strict";
  const screens = [...document.querySelectorAll(".screen")];
  const game = document.getElementById("game");
  const soundButton = document.getElementById("sound-toggle");
  const soundLabel = document.getElementById("sound-label");
  const sealButton = document.getElementById("seal-button");
  const sealStatus = document.getElementById("seal-status");
  const sealProgress = document.getElementById("seal-progress");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const scenes = {
    coffin: { art: "coffin.svg", title: "The coffin opened.", copy: "A heartbeat echoes from the darkness. It isn't yours." },
    pumpkin: { art: "pumpkin.svg", title: "The lantern grinned.", copy: "Its grin grows wider. A little voice whispers your name." },
    door: { art: "door.svg", title: "The old door knocked.", copy: "Three slow knocks answer from the other side." }
  };
  const titles = ["THE BRAVE NIGHT WANDERER", "THE GHOST'S FAVORITE GUEST", "THE MIDNIGHT HERO", "THE CURSE BREAKER", "THE FEARLESS PHANTOM", "THE GARAGE ESCAPIST"];
  let current = "intro";
  let taps = 0;
  let locked = false;
  let sealReady = false;
  let soundOn = true;
  let audio = null;
  let ambient = null;
  let heartbeatTimer = null;
  let timers = [];

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
  }
  function startAmbience() {
    if (!soundOn || ambient || !["choice", "reveal", "seal"].includes(current)) return;
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
  function setSealReady(value) {
    sealReady = value;
    sealButton.classList.toggle("ready", value);
    const remaining = 3 - taps;
    const count = remaining + " " + (remaining === 1 ? "hit" : "hits") + " remaining";
    sealButton.setAttribute("aria-label", value ? "Tap now! " + count : "Wait for the green glow. " + count);
  }
  function startSealCycle(delay = 750) {
    if (current !== "seal" || locked) return;
    if (reducedMotion.matches) {
      setSealReady(true);
      sealStatus.textContent = (3 - taps) + " taps to escape";
      return;
    }
    setSealReady(false);
    sealStatus.textContent = "WAIT FOR THE GREEN GLOW";
    later(() => {
      if (current !== "seal" || locked) return;
      setSealReady(true);
      sealStatus.textContent = "NOW! TAP THE SEAL";
      sound("glow");
      later(() => {
        if (current !== "seal" || locked || !sealReady) return;
        setSealReady(false);
        startSealCycle(650);
      }, 1150);
    }, delay);
  }
  function beginSeal() {
    show("seal");
    startSealCycle();
  }
  function resetSeal() {
    taps = 0;
    locked = false;
    sealButton.disabled = false;
    sealButton.classList.remove("ready", "hit", "miss");
    sealReady = false;
    sealButton.setAttribute("aria-label", "Wait for the green glow. Three hits remaining");
    sealStatus.textContent = "WAIT FOR THE GREEN GLOW";
    sealProgress.setAttribute("aria-label", "Zero of three taps completed");
    [...sealProgress.children].forEach(dot => dot.classList.remove("done"));
  }
  sealButton.addEventListener("click", () => {
    if (current !== "seal" || locked) return;
    if (!sealReady) {
      sound("miss");
      sealStatus.textContent = "TOO SOON — WAIT FOR GREEN";
      sealButton.classList.add("miss");
      later(() => sealButton.classList.remove("miss"), 220);
      return;
    }
    clearTimers();
    taps += 1;
    setSealReady(false);
    sound("tap");
    sealProgress.children[taps - 1].classList.add("done");
    sealProgress.setAttribute("aria-label", taps + " of three taps completed");
    sealButton.classList.add("hit");
    later(() => sealButton.classList.remove("hit"), 180);
    if (taps < 3) {
      sealStatus.textContent = (3 - taps) + (taps === 2 ? " HIT LEFT" : " HITS LEFT");
      if (reducedMotion.matches) setSealReady(true);
      else later(() => startSealCycle(750), 350);
      return;
    }
    locked = true;
    sealButton.disabled = true;
    sealButton.setAttribute("aria-label", "The seal is broken");
    sealStatus.textContent = "THE SEAL IS BROKEN";
    stopAmbience();
    later(() => {
      if (current !== "seal") return;
      show("scare");
      sound("scare");
      later(() => {
        if (current !== "scare") return;
        let n;
        try { const values = new Uint32Array(1); crypto.getRandomValues(values); n = values[0] % titles.length; }
        catch { n = Math.floor(Math.random() * titles.length); }
        document.getElementById("result-name").textContent = titles[n];
        show("result");
        sound("win");
      }, reducedMotion.matches ? 800 : 2000);
    }, reducedMotion.matches ? 350 : 950);
  });
  document.getElementById("replay-button").addEventListener("click", () => {
    clearTimers();
    stopAmbience();
    resetSeal();
    show("intro");
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stopAmbience();
    else if (soundOn) startAmbience();
  });
  updateSound();
  resetSeal();
  show("intro");
})();
