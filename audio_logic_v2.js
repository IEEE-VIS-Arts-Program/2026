document.addEventListener('DOMContentLoaded', () => {

  const soundToggle = document.getElementById('soundToggle');
  if (!soundToggle) { console.warn('soundToggle not found'); return; }

  let audioCtx;
  let isPlaying = true;
  let audioStarted = false;
  const synths = {};

  updateButtonUI(soundToggle, false);
  updateButtonUI(document.getElementById('soundToggleMobile'), false);

  // ── FOREST SYNTH → teal blobs ──
  function initForest(ctx, bus) {
    const gainNode = ctx.createGain();
    gainNode.gain.value = 0;
    gainNode.connect(bus);

    function voicedNote(freq, startTime, dur, vol) {
      const osc    = ctx.createOscillator();
      const modOsc = ctx.createOscillator();
      const modDep = ctx.createGain();
      const g      = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq * 0.92, startTime);
      osc.frequency.linearRampToValueAtTime(freq * 1.06, startTime + dur * 0.45);
      osc.frequency.linearRampToValueAtTime(freq * 0.98, startTime + dur);

      modOsc.frequency.value = 12 + Math.random() * 6;
      modDep.gain.value      = freq * 0.025;
      modOsc.connect(modDep);
      modDep.connect(osc.frequency);

      g.gain.setValueAtTime(0,   startTime);
      g.gain.linearRampToValueAtTime(vol,  startTime + Math.min(0.03, dur * 0.2));
      g.gain.setValueAtTime(vol,           startTime + dur - 0.04);
      g.gain.linearRampToValueAtTime(0,    startTime + dur);

      osc.connect(g);
      g.connect(gainNode);

      osc.start(startTime);    osc.stop(startTime + dur + 0.01);
      modOsc.start(startTime); modOsc.stop(startTime + dur + 0.01);
    }

    function phrase() {
      const base     = 420 + Math.random() * 360;
      const numNotes = 2 + Math.floor(Math.random() * 4);
      const noteDur  = 0.07 + Math.random() * 0.13;
      const gap      = 0.015 + Math.random() * 0.04;
      const vol      = 0.13 + Math.random() * 0.07;

      for (let i = 0; i < numNotes; i++) {
        const t    = ctx.currentTime + i * (noteDur + gap);
        const step = (Math.random() - 0.45) * 0.18;
        const freq = base * Math.pow(1 + step, i);
        voicedNote(Math.max(350, Math.min(900, freq)), t, noteDur, vol);
      }
    }

    function warble() {
      const base = 480 + Math.random() * 280;
      const dur  = 0.35 + Math.random() * 0.55;
      voicedNote(base, ctx.currentTime, dur, 0.12 + Math.random() * 0.06);
    }

    function trill() {
      const base  = 420 + Math.random() * 250;
      const step  = 1.08 + Math.random() * 0.08;
      const steps = 3 + Math.floor(Math.random() * 5);
      for (let i = 0; i < steps; i++) {
        const t    = ctx.currentTime + i * 0.065;
        const freq = i % 2 === 0 ? base : base * step;
        voicedNote(freq, t, 0.055, 0.10 + Math.random() * 0.05);
      }
    }

    let birdTimer = null;

    function scheduleBird() {
      if (!isPlaying) return;
      const wait = 80 + Math.random() * 420;
      birdTimer = setTimeout(() => {
        if (!isPlaying) return;
        const r = Math.random();
        if      (r < 0.45) phrase();
        else if (r < 0.75) warble();
        else               trill();
        scheduleBird();
      }, wait);
    }

    return {
      gain:       gainNode,
      startBirds() { if (!birdTimer) scheduleBird(); },
      stopBirds()  { clearTimeout(birdTimer); birdTimer = null; },
    };
  }

  // ── RECORDED CHAT AUDIO → lavender blobs ──
  function initChatFile(ctx, bus) {
    const gainNode = ctx.createGain();
    gainNode.gain.value = 0;
    gainNode.connect(bus);

    fetch('people_chatting.m4a')
      .then(r => r.arrayBuffer())
      .then(ab => ctx.decodeAudioData(ab))
      .then(buffer => {
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.loop   = true;
        source.connect(gainNode);
        source.start();
      })
      .catch(e => console.warn('people_chatting.m4a failed to load:', e));

    return { gain: gainNode };
  }

  // ── CHATTER SYNTH → yellow blobs ──
  function initChatter(ctx, bus) {
    const gainNode = ctx.createGain();
    gainNode.gain.value = 0;
    gainNode.connect(bus);

    const distLp = ctx.createBiquadFilter();
    distLp.type            = 'lowpass';
    distLp.frequency.value = 580;
    distLp.Q.value         = 0.5;
    distLp.connect(gainNode);

    const delay1 = ctx.createDelay(0.4);  delay1.delayTime.value = 0.09;
    const delay2 = ctx.createDelay(0.4);  delay2.delayTime.value = 0.17;
    const fb     = ctx.createGain();      fb.gain.value = 0.28;
    delay1.connect(delay2);
    delay2.connect(fb);
    fb.connect(delay1);

    const wetGain = ctx.createGain();  wetGain.gain.value = 0.35;
    delay1.connect(wetGain);
    wetGain.connect(distLp);

    const dryBus = ctx.createGain();  dryBus.gain.value = 0.65;
    dryBus.connect(distLp);

    const voices = [
      { f0: 115, f1: 395, slowHz: 0.062, dc: 0.11, depth: 0.044, offset: 0.0 },
      { f0: 148, f1: 435, slowHz: 0.091, dc: 0.10, depth: 0.040, offset: 1.3 },
      { f0: 172, f1: 470, slowHz: 0.078, dc: 0.12, depth: 0.048, offset: 2.7 },
      { f0: 128, f1: 415, slowHz: 0.110, dc: 0.09, depth: 0.036, offset: 4.1 },
      { f0: 158, f1: 455, slowHz: 0.068, dc: 0.11, depth: 0.044, offset: 5.6 },
      { f0: 138, f1: 390, slowHz: 0.125, dc: 0.10, depth: 0.040, offset: 7.2 },
    ];

    voices.forEach(({ f0, f1, slowHz, dc, depth, offset }) => {
      const t0 = ctx.currentTime + offset;

      const srcOsc = ctx.createOscillator();
      srcOsc.type            = 'sawtooth';
      srcOsc.frequency.value = f0;

      const driftOsc   = ctx.createOscillator();
      driftOsc.frequency.value = 0.18 + Math.random() * 0.14;
      const driftDepth = ctx.createGain();
      driftDepth.gain.value = f0 * 0.02;
      driftOsc.connect(driftDepth);
      driftDepth.connect(srcOsc.frequency);
      driftOsc.start(t0);

      const formant = ctx.createBiquadFilter();
      formant.type            = 'bandpass';
      formant.frequency.value = f1;
      formant.Q.value         = 10;
      srcOsc.connect(formant);

      const vGain = ctx.createGain();
      vGain.gain.value = dc;

      const slowLfo   = ctx.createOscillator();
      slowLfo.type = 'sine';
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

  // ── TECH BEEPS SYNTH → orange blobs ──
  function initTechBeeps(ctx, bus) {
    const gainNode = ctx.createGain();
    gainNode.gain.value = 0;
    gainNode.connect(bus);

    let beepTimer = null;

    function note(freq, dur, vol = 0.28) {
      const t   = ctx.currentTime;
      const osc = ctx.createOscillator();
      const g   = ctx.createGain();
      osc.type = 'sine';
      osc.connect(g);  g.connect(gainNode);
      osc.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(vol,  t + 0.008);
      g.gain.setValueAtTime(vol,           t + dur - 0.018);
      g.gain.linearRampToValueAtTime(0,    t + dur);
      osc.start(t);  osc.stop(t + dur + 0.01);
    }

    function sweep(f0, f1, dur, vol = 0.24) {
      const t   = ctx.currentTime;
      const osc = ctx.createOscillator();
      const g   = ctx.createGain();
      osc.type = 'sine';
      osc.connect(g);  g.connect(gainNode);
      osc.frequency.setValueAtTime(f0, t);
      osc.frequency.exponentialRampToValueAtTime(f1, t + dur);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(vol, t + 0.01);
      g.gain.linearRampToValueAtTime(0,   t + dur);
      osc.start(t);  osc.stop(t + dur + 0.01);
    }

    function warble() {
      const t      = ctx.currentTime;
      const carr   = 500 + Math.random() * 800;
      const modHz  = 25 + Math.random() * 35;
      const dur    = 0.25 + Math.random() * 0.30;
      const osc    = ctx.createOscillator();
      const modOsc = ctx.createOscillator();
      const modDep = ctx.createGain();
      const g      = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(carr, t);
      osc.frequency.linearRampToValueAtTime(carr * (1.3 + Math.random() * 0.5), t + dur);

      modOsc.frequency.value = modHz;
      modDep.gain.value      = 180 + Math.random() * 120;
      modOsc.connect(modDep);  modDep.connect(osc.frequency);

      osc.connect(g);  g.connect(gainNode);
      g.gain.setValueAtTime(0,    t);
      g.gain.linearRampToValueAtTime(0.22, t + 0.02);
      g.gain.setValueAtTime(0.22, t + dur - 0.03);
      g.gain.linearRampToValueAtTime(0,    t + dur);

      modOsc.start(t);  modOsc.stop(t + dur + 0.01);
      osc.start(t);     osc.stop(t + dur + 0.01);
    }

    function twoTone() {
      const f0   = 700 + Math.random() * 600;
      const f1   = f0  * (1.25 + Math.random() * 0.3);
      const reps = 2 + Math.floor(Math.random() * 3);
      for (let i = 0; i < reps; i++) {
        const t   = ctx.currentTime + i * 0.11;
        const osc = ctx.createOscillator();
        const g   = ctx.createGain();
        osc.type = 'sine';  osc.connect(g);  g.connect(gainNode);
        osc.frequency.value = i % 2 === 0 ? f0 : f1;
        g.gain.setValueAtTime(0,    t);
        g.gain.linearRampToValueAtTime(0.26, t + 0.008);
        g.gain.setValueAtTime(0.26, t + 0.085);
        g.gain.linearRampToValueAtTime(0,    t + 0.10);
        osc.start(t);  osc.stop(t + 0.11);
      }
    }

    function scheduleBeep() {
      if (!isPlaying) return;
      const wait = 280 + Math.random() * 1200;
      beepTimer = setTimeout(() => {
        if (!isPlaying) return;
        const r = Math.random();
        if      (r < 0.25) note(600  + Math.random() * 1400, 0.06 + Math.random() * 0.08);
        else if (r < 0.50) sweep(1800 + Math.random() * 800, 300  + Math.random() * 300, 0.20 + Math.random() * 0.15);
        else if (r < 0.75) warble();
        else               twoTone();
        scheduleBeep();
      }, wait);
    }

    return {
      gain:        gainNode,
      startBeeps() { if (!beepTimer) scheduleBeep(); },
      stopBeeps()  { clearTimeout(beepTimer); beepTimer = null; },
    };
  }

  function initAudio() {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();

    const compressor = audioCtx.createDynamicsCompressor();
    compressor.connect(audioCtx.destination);

    const masterGain = audioCtx.createGain();
    masterGain.gain.value = 0.5;
    masterGain.connect(compressor);

    const chatter = initChatter(audioCtx, masterGain);
    synths['yellow'] = {
      gain:    chatter.gain,
      blobEls: Array.from(document.querySelectorAll('.blob-yellow')),
    };

    const chat = initChatFile(audioCtx, masterGain);
    synths['lavender'] = {
      gain:    chat.gain,
      blobEls: Array.from(document.querySelectorAll('.blob-lavender')),
    };

    const forest = initForest(audioCtx, masterGain);
    synths['teal'] = {
      gain:       forest.gain,
      blobEls:    Array.from(document.querySelectorAll('.blob-teal')),
      startBirds: forest.startBirds,
      stopBirds:  forest.stopBirds,
    };

    const tech = initTechBeeps(audioCtx, masterGain);
    synths['orange'] = {
      gain:        tech.gain,
      blobEls:     Array.from(document.querySelectorAll('.blob-orange')),
      startBeeps:  tech.startBeeps,
      stopBeeps:   tech.stopBeeps,
    };
  }

  function updateButtonUI(btn, on) {
    if (!btn) return;
    btn.innerText        = on ? 'Switch sound off' : 'Turn sound on';
    btn.style.background = on ? '#06212C'    : 'none';
    btn.style.color      = on ? '#FFFBF4'    : '#06212C';
  }

  function toggleSound() {
    if (!audioStarted) {
      audioStarted = true;
      if (!audioCtx) initAudio();
      if (audioCtx.state === 'suspended') audioCtx.resume();
      synths['teal']?.startBirds();
      synths['orange']?.startBeeps();
      updateButtonUI(soundToggle, true);
      updateButtonUI(document.getElementById('soundToggleMobile'), true);
      return;
    }

    if (audioCtx.state === 'suspended') audioCtx.resume();

    isPlaying = !isPlaying;
    updateButtonUI(soundToggle, isPlaying);
    updateButtonUI(document.getElementById('soundToggleMobile'), isPlaying);

    if (isPlaying) {
      synths['teal']?.startBirds();
      synths['orange']?.startBeeps();
    } else {
      for (const key in synths) {
        synths[key].gain.gain.setTargetAtTime(0, audioCtx.currentTime, 0.15);
      }
      synths['teal']?.stopBirds();
      synths['orange']?.stopBeeps();
    }
  }

  soundToggle.addEventListener('click', e => { e.stopPropagation(); toggleSound(); });

  const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  if (isTouchDevice) {
    document.addEventListener('touchstart', function startOnTouch() {
      if (!audioStarted) toggleSound();
    }, { once: true, passive: true });
  } else {
    document.addEventListener('click', toggleSound);
  }

  // ── PROXIMITY → volume (only the nearest blob group plays) ──
  function updateProximity(clientX, clientY) {
    if (!isPlaying || !audioCtx) return;
    const maxDist = window.innerWidth * 0.22;

    const distances = {};
    for (const [key, synth] of Object.entries(synths)) {
      let minDist = Infinity;
      synth.blobEls.forEach(el => {
        const r  = el.getBoundingClientRect();
        const cx = r.left + r.width  / 2;
        const cy = r.top  + r.height / 2;
        const d  = Math.hypot(clientX - cx, clientY - cy);
        if (d < minDist) minDist = d;
      });
      distances[key] = minDist;
    }

    const closest = Object.entries(distances).reduce((a, b) => a[1] < b[1] ? a : b)[0];

    for (const [key, synth] of Object.entries(synths)) {
      let vol = 0;
      if (key === closest && distances[key] < maxDist) {
        vol = Math.pow(Math.max(0, 1 - distances[key] / maxDist), 2.0) * 0.6;
      }
      synth.gain.gain.setTargetAtTime(vol, audioCtx.currentTime, 0.10);
    }
  }

  function silenceAll() {
    if (!audioCtx) return;
    for (const key in synths) {
      synths[key].gain.gain.setTargetAtTime(0, audioCtx.currentTime, 0.10);
    }
  }

  document.addEventListener('mousemove', e => updateProximity(e.clientX, e.clientY));

  document.addEventListener('touchmove', e => {
    const t = e.touches[0];
    updateProximity(t.clientX, t.clientY);
  }, { passive: true });

  document.addEventListener('touchend', silenceAll);

  // ── TITLE COLOR: shifts toward nearest blob on mousemove ──
  const titleH1    = document.querySelector('.hero h1');
  const allBlobEls = Array.from(document.querySelectorAll('.svg-blob, .hero-top-info'));

  const blobColorsMap = {
    'blob-teal':     '#063F42',
    'blob-orange':   '#F66A58',
    'blob-lavender': '#B668DC',
    'blob-yellow':   '#E4DC35',
    'blob-pink':     '#F06C78',
    'hero-top-info': '#F66A58',
  };

  let currentRGB = [255, 251, 244];
  let targetRGB  = [255, 251, 244];
  let animating  = false;

  function hexToRgb(hex) {
    return [
      parseInt(hex.slice(1, 3), 16),
      parseInt(hex.slice(3, 5), 16),
      parseInt(hex.slice(5, 7), 16),
    ];
  }

  function rgbToHex(rgb) {
    return '#' + rgb.map(Math.round).map(v => v.toString(16).padStart(2, '0')).join('');
  }

  function animateColor() {
    let diff = 0;
    for (let i = 0; i < 3; i++) {
      currentRGB[i] += (targetRGB[i] - currentRGB[i]) * 0.02;
      diff += Math.abs(targetRGB[i] - currentRGB[i]);
    }
    if (titleH1) titleH1.style.setProperty('--blob-color', rgbToHex(currentRGB));
    if (diff > 1) requestAnimationFrame(animateColor);
    else animating = false;
  }

  if (titleH1) {
    document.addEventListener('mousemove', e => {
      const r = titleH1.getBoundingClientRect();
      const x = Math.max(-50, Math.min(150, ((e.clientX - r.left) / r.width)  * 100));
      const y = Math.max(-50, Math.min(150, ((e.clientY - r.top)  / r.height) * 100));
      titleH1.style.setProperty('--mouse-x', `${x}%`);
      titleH1.style.setProperty('--mouse-y', `${y}%`);

      let minScore   = Infinity;
      let closestHex = '#FFFBF4';

      allBlobEls.forEach(blob => {
        const br   = blob.getBoundingClientRect();
        let cx     = br.left + br.width  / 2;
        let cy     = br.top  + br.height / 2;
        let radius = (br.width + br.height) / 4;

        if (blob.classList.contains('hero-top-info')) {
          cx     = br.left + br.width * 0.78;
          radius = br.width * 1.5;
        }

        const score = Math.hypot(e.clientX - cx, e.clientY - cy) / radius;
        if (score < minScore) {
          minScore = score;
          const cls = Array.from(blob.classList).find(c => blobColorsMap[c]);
          if (cls) closestHex = blobColorsMap[cls];
        }
      });

      const next = hexToRgb(closestHex);
      if (next.join() !== targetRGB.join()) {
        targetRGB = next;
        if (!animating) { animating = true; requestAnimationFrame(animateColor); }
      }
    });
  }

}); // end DOMContentLoaded
