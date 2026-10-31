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
  let soundOn = false;
  let audio = null;
  let timers = [];

  function later(fn, ms) {
    const id = window.setTimeout(fn, ms);
    timers.push(id);
    return id;
  }
  function clearTimers() {
    timers.forEach(window.clearTimeout);
    timers = [];
  }
  function show(id) {
    current = id;
    screens.forEach(screen => {
      const visible = screen.id === id;
      screen.hidden = !visible;
      screen.classList.toggle("active", visible);
    });
    game.scrollTop = 0;
    const focusTarget = document.querySelector("#" + id + " h1, #" + id + " h2");
    if (focusTarget && id !== "scare") {
      focusTarget.setAttribute("tabindex", "-1");
      focusTarget.focus({ preventScroll: true });
    }
  }
  function audioContext() {
    if (!soundOn) return null;
    try {
      if (!audio) audio = new (window.AudioContext || window.webkitAudioContext)();
      if (audio.state === "suspended") audio.resume().catch(() => {});
      return audio;
    } catch { return null; }
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
    gain.gain.exponentialRampToValueAtTime(volume, start + Math.min(0.03, duration / 4));
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(gain).connect(ctx.destination);
    osc.start(start);
    osc.stop(start + duration + 0.02);
  }
  function sound(kind) {
    if (kind === "enter") { tone(220, .6, "sine", .025, 110); tone(440, .7, "sine", .014, 180, .1); }
    if (kind === "coffin") { tone(78, .27, "sine", .06, 58); tone(74, .28, "sine", .05, 55, .42); }
    if (kind === "pumpkin") { tone(330, .55, "triangle", .022, 510); tone(440, .5, "sine", .018, 250, .38); }
    if (kind === "door") { [0, .36, .72].forEach(t => tone(110, .13, "triangle", .06, 47, t)); }
    if (kind === "tap") { tone(420 + taps * 95, .22, "sine", .035, 760 + taps * 90); }
    if (kind === "scare") { tone(270, .58, "sawtooth", .055, 125); tone(540, .47, "sine", .04, 280, .04); }
    if (kind === "win") { [440, 554, 659].forEach((f, i) => tone(f, .5, "sine", .026, f * 1.2, i * .12)); }
  }
  function updateSound() {
    soundButton.setAttribute("aria-pressed", String(soundOn));
    soundButton.setAttribute("aria-label", soundOn ? "Turn sound off" : "Turn sound on");
    soundLabel.textContent = soundOn ? "SOUND ON" : "SOUND OFF";
  }
  soundButton.addEventListener("click", () => {
    soundOn = !soundOn;
    updateSound();
    if (soundOn) { audioContext(); tone(523, .16, "sine", .02); }
    else if (audio && audio.state === "running") audio.suspend().catch(() => {});
  });
  document.getElementById("enter-button").addEventListener("click", () => {
    if (current !== "intro") return;
    audioContext();
    sound("enter");
    show("choice");
  });
  document.querySelectorAll(".choice-card").forEach(button => {
    button.addEventListener("click", () => {
      if (current !== "choice") return;
      const choice = button.dataset.choice;
      const scene = scenes[choice];
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
      sound(choice);
      later(() => {
        if (current === "reveal") show("seal");
      }, reducedMotion.matches ? 1600 : 4300);
    });
  });
  function resetSeal() {
    taps = 0;
    locked = false;
    sealButton.disabled = false;
    sealButton.setAttribute("aria-label", "Tap the glowing seal. Three taps remaining");
    sealStatus.textContent = "3 taps to escape";
    sealProgress.setAttribute("aria-label", "Zero of three taps completed");
    [...sealProgress.children].forEach(dot => dot.classList.remove("done"));
  }
  sealButton.addEventListener("click", () => {
    if (current !== "seal" || locked) return;
    taps += 1;
    sound("tap");
    sealProgress.children[taps - 1].classList.add("done");
    sealProgress.setAttribute("aria-label", taps + " of three taps completed");
    sealButton.setAttribute("aria-label", "Tap the glowing seal. " + (3 - taps) + " taps remaining");
    sealStatus.textContent = taps < 3 ? (3 - taps) + " taps to escape" : "THE SEAL IS BROKEN";
    sealButton.classList.add("hit");
    later(() => sealButton.classList.remove("hit"), 180);
    if (taps === 3) {
      locked = true;
      sealButton.disabled = true;
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
        }, reducedMotion.matches ? 700 : 1900);
      }, reducedMotion.matches ? 250 : 600);
    }
  });
  document.getElementById("replay-button").addEventListener("click", () => {
    clearTimers();
    resetSeal();
    show("intro");
  });
  updateSound();
  resetSeal();
  show("intro");
})();

