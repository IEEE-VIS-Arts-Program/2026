// Hero audio: each blob colour group owns a synth; the pointer's nearest group
// plays (volume by proximity). Past the hero, nearest text section drives it.
// Blob positions come from window.heroBlobs() (the WebGL renderer), not the DOM.
document.addEventListener("DOMContentLoaded", () => {
  const soundToggle = document.getElementById("soundToggle");
  if (!soundToggle) return;

  let audioCtx;
  let isPlaying = true;
  let audioStarted = false;
  const synths = {};

  let isInHero = true;
  let lastX = 0;
  let lastY = 0;

  updateButtonUI(soundToggle, false);

  // ── FOREST SYNTH → teal ──
  function initForest(ctx, bus) {
    const gainNode = ctx.createGain();
    gainNode.gain.value = 0;
    gainNode.connect(bus);

    function voicedNote(freq, startTime, dur, vol) {
      const osc = ctx.createOscillator();
      const modOsc = ctx.createOscillator();
      const modDep = ctx.createGain();
      const g = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(freq * 0.92, startTime);
      osc.frequency.linearRampToValueAtTime(freq * 1.06, startTime + dur * 0.45);
      osc.frequency.linearRampToValueAtTime(freq * 0.98, startTime + dur);

      modOsc.frequency.value = 12 + Math.random() * 6;
      modDep.gain.value = freq * 0.025;
      modOsc.connect(modDep);
      modDep.connect(osc.frequency);

      g.gain.setValueAtTime(0, startTime);
      g.gain.linearRampToValueAtTime(vol, startTime + Math.min(0.03, dur * 0.2));
      g.gain.setValueAtTime(vol, startTime + dur - 0.04);
      g.gain.linearRampToValueAtTime(0, startTime + dur);

      osc.connect(g);
      g.connect(gainNode);

      osc.start(startTime);
      osc.stop(startTime + dur + 0.01);
      modOsc.start(startTime);
      modOsc.stop(startTime + dur + 0.01);
    }

    function phrase() {
      const base = 420 + Math.random() * 360;
      const numNotes = 2 + Math.floor(Math.random() * 4);
      const noteDur = 0.07 + Math.random() * 0.13;
      const gap = 0.015 + Math.random() * 0.04;
      const vol = 0.13 + Math.random() * 0.07;
      for (let i = 0; i < numNotes; i++) {
        const t = ctx.currentTime + i * (noteDur + gap);
        const step = (Math.random() - 0.45) * 0.18;
        const freq = base * Math.pow(1 + step, i);
        voicedNote(Math.max(350, Math.min(900, freq)), t, noteDur, vol);
      }
    }

    function warble() {
      const base = 480 + Math.random() * 280;
      const dur = 0.35 + Math.random() * 0.55;
      voicedNote(base, ctx.currentTime, dur, 0.12 + Math.random() * 0.06);
    }

    function trill() {
      const base = 420 + Math.random() * 250;
      const step = 1.08 + Math.random() * 0.08;
      const steps = 3 + Math.floor(Math.random() * 5);
      for (let i = 0; i < steps; i++) {
        const t = ctx.currentTime + i * 0.065;
        const freq = i % 2 === 0 ? base : base * step;
        voicedNote(freq, t, 0.055, 0.1 + Math.random() * 0.05);
      }
    }

    let birdTimer = null;
    function scheduleBird() {
      if (!isPlaying) return;
      const wait = 80 + Math.random() * 420;
      birdTimer = setTimeout(() => {
        if (!isPlaying) return;
        const r = Math.random();
        if (r < 0.45) phrase();
        else if (r < 0.75) warble();
        else trill();
        scheduleBird();
      }, wait);
    }

    return {
      gain: gainNode,
      start() {
        if (!birdTimer) scheduleBird();
      },
      stop() {
        clearTimeout(birdTimer);
        birdTimer = null;
      },
    };
  }

  // ── RECORDED CHAT → lavender ──
  function initChatFile(ctx, bus) {
    const gainNode = ctx.createGain();
    gainNode.gain.value = 0;
    gainNode.connect(bus);

    fetch("./people_chatting.m4a")
      .then((r) => r.arrayBuffer())
      .then((ab) => ctx.decodeAudioData(ab))
      .then((buffer) => {
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.loop = true;
        source.connect(gainNode);
        source.start();
      })
      .catch((e) => console.warn("people_chatting.m4a failed to load:", e));

    return { gain: gainNode };
  }

  // ── CHATTER SYNTH → yellow ──
  function initChatter(ctx, bus) {
    const gainNode = ctx.createGain();
    gainNode.gain.value = 0;
    gainNode.connect(bus);

    const distLp = ctx.createBiquadFilter();
    distLp.type = "lowpass";
    distLp.frequency.value = 580;
    distLp.Q.value = 0.5;
    distLp.connect(gainNode);

    const delay1 = ctx.createDelay(0.4);
    delay1.delayTime.value = 0.09;
    const delay2 = ctx.createDelay(0.4);
    delay2.delayTime.value = 0.17;
    const fb = ctx.createGain();
    fb.gain.value = 0.28;
    delay1.connect(delay2);
    delay2.connect(fb);
    fb.connect(delay1);

    const wetGain = ctx.createGain();
    wetGain.gain.value = 0.35;
    delay1.connect(wetGain);
    wetGain.connect(distLp);

    const dryBus = ctx.createGain();
    dryBus.gain.value = 0.65;
    dryBus.connect(distLp);

    const voices = [
      { f0: 115, f1: 395, slowHz: 0.062, dc: 0.11, depth: 0.044, offset: 0.0 },
      { f0: 148, f1: 435, slowHz: 0.091, dc: 0.1, depth: 0.04, offset: 1.3 },
      { f0: 172, f1: 470, slowHz: 0.078, dc: 0.12, depth: 0.048, offset: 2.7 },
      { f0: 128, f1: 415, slowHz: 0.11, dc: 0.09, depth: 0.036, offset: 4.1 },
      { f0: 158, f1: 455, slowHz: 0.068, dc: 0.11, depth: 0.044, offset: 5.6 },
      { f0: 138, f1: 390, slowHz: 0.125, dc: 0.1, depth: 0.04, offset: 7.2 },
    ];

    voices.forEach(({ f0, f1, slowHz, dc, depth, offset }) => {
      const t0 = ctx.currentTime + offset;

      const srcOsc = ctx.createOscillator();
      srcOsc.type = "sawtooth";
      srcOsc.frequency.value = f0;

      const driftOsc = ctx.createOscillator();
      driftOsc.frequency.value = 0.18 + Math.random() * 0.14;
      const driftDepth = ctx.createGain();
      driftDepth.gain.value = f0 * 0.02;
      driftOsc.connect(driftDepth);
      driftDepth.connect(srcOsc.frequency);
      driftOsc.start(t0);

      const formant = ctx.createBiquadFilter();
      formant.type = "bandpass";
      formant.frequency.value = f1;
      formant.Q.value = 10;
      srcOsc.connect(formant);

      const vGain = ctx.createGain();
      vGain.gain.value = dc;

      const slowLfo = ctx.createOscillator();
      slowLfo.type = "sine";
      slowLfo.frequency.value = slowHz;
      const slowDepth = ctx.createGain();
      slowDepth.gain.value = depth;
      slowLfo.connect(slowDepth);
      slowDepth.connect(vGain.gain);
      slowLfo.start(t0);

      formant.connect(vGain);
      vGain.connect(dryBus);
      vGain.connect(delay1);

      srcOsc.start(t0);
    });

    return { gain: gainNode };
  }

  // ── TECH BEEPS SYNTH → orange ──
  function initTechBeeps(ctx, bus) {
    const gainNode = ctx.createGain();
    gainNode.gain.value = 0;
    gainNode.connect(bus);

    let beepTimer = null;

    function note(freq, dur, vol = 0.28) {
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = "sine";
      osc.connect(g);
      g.connect(gainNode);
      osc.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(vol, t + 0.008);
      g.gain.setValueAtTime(vol, t + dur - 0.018);
      g.gain.linearRampToValueAtTime(0, t + dur);
      osc.start(t);
      osc.stop(t + dur + 0.01);
    }

    function sweep(f0, f1, dur, vol = 0.24) {
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = "sine";
      osc.connect(g);
      g.connect(gainNode);
      osc.frequency.setValueAtTime(f0, t);
      osc.frequency.exponentialRampToValueAtTime(f1, t + dur);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(vol, t + 0.01);
      g.gain.linearRampToValueAtTime(0, t + dur);
      osc.start(t);
      osc.stop(t + dur + 0.01);
    }

    function warble() {
      const t = ctx.currentTime;
      const carr = 500 + Math.random() * 800;
      const modHz = 25 + Math.random() * 35;
      const dur = 0.25 + Math.random() * 0.3;
      const osc = ctx.createOscillator();
      const modOsc = ctx.createOscillator();
      const modDep = ctx.createGain();
      const g = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(carr, t);
      osc.frequency.linearRampToValueAtTime(
        carr * (1.3 + Math.random() * 0.5),
        t + dur,
      );

      modOsc.frequency.value = modHz;
      modDep.gain.value = 180 + Math.random() * 120;
      modOsc.connect(modDep);
      modDep.connect(osc.frequency);

      osc.connect(g);
      g.connect(gainNode);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.22, t + 0.02);
      g.gain.setValueAtTime(0.22, t + dur - 0.03);
      g.gain.linearRampToValueAtTime(0, t + dur);

      modOsc.start(t);
      modOsc.stop(t + dur + 0.01);
      osc.start(t);
      osc.stop(t + dur + 0.01);
    }

    function twoTone() {
      const f0 = 700 + Math.random() * 600;
      const f1 = f0 * (1.25 + Math.random() * 0.3);
      const reps = 2 + Math.floor(Math.random() * 3);
      for (let i = 0; i < reps; i++) {
        const t = ctx.currentTime + i * 0.11;
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = "sine";
        osc.connect(g);
        g.connect(gainNode);
        osc.frequency.value = i % 2 === 0 ? f0 : f1;
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.26, t + 0.008);
        g.gain.setValueAtTime(0.26, t + 0.085);
        g.gain.linearRampToValueAtTime(0, t + 0.1);
        osc.start(t);
        osc.stop(t + 0.11);
      }
    }

    function scheduleBeep() {
      if (!isPlaying) return;
      const wait = 280 + Math.random() * 1200;
      beepTimer = setTimeout(() => {
        if (!isPlaying) return;
        const r = Math.random();
        if (r < 0.25)
          note(600 + Math.random() * 1400, 0.06 + Math.random() * 0.08);
        else if (r < 0.5)
          sweep(
            1800 + Math.random() * 800,
            300 + Math.random() * 300,
            0.2 + Math.random() * 0.15,
          );
        else if (r < 0.75) warble();
        else twoTone();
        scheduleBeep();
      }, wait);
    }

    return {
      gain: gainNode,
      start() {
        if (!beepTimer) scheduleBeep();
      },
      stop() {
        clearTimeout(beepTimer);
        beepTimer = null;
      },
    };
  }

  function initAudio() {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();

    const compressor = audioCtx.createDynamicsCompressor();
    compressor.connect(audioCtx.destination);
    const masterGain = audioCtx.createGain();
    masterGain.gain.value = 0.5;
    masterGain.connect(compressor);

    const forest = initForest(audioCtx, masterGain);
    synths.teal = { gain: forest.gain, start: forest.start, stop: forest.stop };

    const chat = initChatFile(audioCtx, masterGain);
    synths.lavender = { gain: chat.gain };

    const chatter = initChatter(audioCtx, masterGain);
    synths.yellow = { gain: chatter.gain };

    const tech = initTechBeeps(audioCtx, masterGain);
    synths.orange = { gain: tech.gain, start: tech.start, stop: tech.stop };
    // pink has no synth → those blobs stay silent (as in the original)
  }

  function startScheduled() {
    for (const k in synths) synths[k].start?.();
  }
  function stopScheduled() {
    for (const k in synths) synths[k].stop?.();
  }

  function updateButtonUI(btn, on) {
    if (!btn) return;
    btn.classList.toggle("on", on);
    btn.setAttribute("aria-pressed", String(on));
  }

  // State + icon update first, audio second — so the control always responds
  // even if Web Audio init/resume hiccups (logged, never blocks the UI).
  function setSound(on) {
    audioStarted = true;
    isPlaying = on;
    updateButtonUI(soundToggle, on);
    try {
      if (!audioCtx) initAudio();
      if (audioCtx.state === "suspended") audioCtx.resume();
      if (on) {
        startScheduled();
      } else {
        for (const k in synths)
          synths[k].gain.gain.setTargetAtTime(0, audioCtx.currentTime, 0.15);
        stopScheduled();
      }
    } catch (e) {
      console.warn("audio set failed:", e);
    }
  }

  function toggleSound() {
    setSound(!audioStarted ? true : !isPlaying);
  }

  // idempotent "turn on" — used by the hero canvas; never mutes
  function enableSound() {
    if (!(audioStarted && isPlaying)) setSound(true);
  }

  soundToggle.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleSound();
  });

  // clicking the hero canvas toggles sound on desktop only
  document.getElementById("bg")?.addEventListener("click", () => {
    if (window.innerWidth >= 768) {
      toggleSound();
    }
  });

  // ── POINTER OVER HERO → nearest blob colour plays ──
  function updateProximity(x, y) {
    if (!isPlaying || !audioCtx || !isInHero) return;
    if (typeof window.heroBlobs !== "function") return;
    const groups = window.heroBlobs();
    const maxDist = window.innerWidth * 0.22;

    let closest = null;
    let closestDist = Infinity;
    const dist = {};
    for (const key in synths) {
      let min = Infinity;
      for (const p of groups[key] || []) {
        const d = Math.hypot(x - p.x, y - p.y);
        if (d < min) min = d;
      }
      dist[key] = min;
      if (min < closestDist) {
        closestDist = min;
        closest = key;
      }
    }

    for (const key in synths) {
      let vol = 0;
      if (key === closest && dist[key] < maxDist)
        vol = Math.pow(Math.max(0, 1 - dist[key] / maxDist), 2) * 0.6;
      synths[key].gain.gain.setTargetAtTime(vol, audioCtx.currentTime, 0.1);
    }
  }

  // ── PAST HERO → nearest text section drives its mapped colour ──
  const sectionSynth = {
    theme: "teal",
    about: "lavender",
    "open-call-2": "lavender",
    submissions: "orange",
    organizers: "yellow",
    contact: "teal",
  };
  const attractors = [];
  document.querySelectorAll("section[id]").forEach((section) => {
    const key = sectionSynth[section.id];
    if (!key) return;
    section
      .querySelectorAll("h1, h2, h3, h4, a, p, blockquote, li")
      .forEach((el) => attractors.push({ el, key }));
  });

  function updateAwayProximity(x, y) {
    if (!isPlaying || !audioCtx || isInHero) return;
    const maxDist = 100;
    let minDist = Infinity;
    let closest = null;
    for (const { el, key } of attractors) {
      const r = el.getBoundingClientRect();
      if (r.bottom < -100 || r.top > window.innerHeight + 100) continue;
      const nx = Math.max(r.left, Math.min(x, r.right));
      const ny = Math.max(r.top, Math.min(y, r.bottom));
      const d = Math.hypot(x - nx, y - ny);
      if (d < minDist) {
        minDist = d;
        closest = key;
      }
    }
    for (const key in synths) {
      let vol = 0;
      if (key === closest && minDist < maxDist)
        vol = Math.pow(Math.max(0, 1 - minDist / maxDist), 2) * 0.45;
      synths[key].gain.gain.setTargetAtTime(vol, audioCtx.currentTime, 0.1);
    }
  }

  function move(x, y) {
    lastX = x;
    lastY = y;
    if (isInHero) updateProximity(x, y);
    else updateAwayProximity(x, y);
  }

  document.addEventListener("mousemove", (e) => move(e.clientX, e.clientY));

  // touch = pointer: tap the button to arm; drag then drives the same proximity
  document.addEventListener(
    "touchstart",
    () => {
      if (audioCtx && audioCtx.state === "suspended") audioCtx.resume();
    },
    { passive: true },
  );
  document.addEventListener(
    "touchmove",
    (e) => {
      const t = e.touches[0];
      if (t) move(t.clientX, t.clientY);
    },
    { passive: true },
  );

  // ── HERO VISIBILITY → switch which proximity engine is live ──
  const hero = document.getElementById("hero");
  if (hero) {
    new IntersectionObserver(
      ([entry]) => {
        isInHero = entry.isIntersecting;
        if (!audioCtx || !isPlaying) return;
        if (isInHero) updateProximity(lastX, lastY);
        else updateAwayProximity(lastX, lastY);
      },
      { threshold: 0.1 },
    ).observe(hero);
  }
});
