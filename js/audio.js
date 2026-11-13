// Sound effects synthesized with the Web Audio API (no audio files), plus
// umpire calls through speech synthesis where the browser supports it.
(function (root) {
  'use strict';
  const BB = (root.BB = root.BB || {});

  let ctx = null;
  let master = null;
  let noiseBuf = null;
  let muted = false;

  function init() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return;
    }
    const AC = root.AudioContext || root.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.8;
    master.connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }

  function setMuted(m) {
    muted = m;
    if (master) master.gain.value = m ? 0 : 0.8;
    if (m && root.speechSynthesis) {
      try {
        root.speechSynthesis.cancel();
      } catch (e) {
        /* ignore */
      }
    }
  }

  function noise(dur, filterType, freq, q, gain, attack, when) {
    if (!ctx) return;
    const t = ctx.currentTime + (when || 0);
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = filterType;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + (attack || 0.005));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(master);
    src.start(t, Math.random());
    src.stop(t + dur + 0.05);
    return { f, g, t };
  }

  function tone(freq, dur, type, gain, when, slideTo) {
    if (!ctx) return;
    const t = ctx.currentTime + (when || 0);
    const o = ctx.createOscillator();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(master);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  const sfx = {
    // Bat on ball. quality 0..1 makes it sharper and louder.
    crack(quality) {
      const q = quality == null ? 1 : quality;
      noise(0.09 + 0.05 * q, 'bandpass', 1800 + 1600 * q, 1.2, 0.9 * (0.5 + 0.5 * q), 0.002);
      tone(900 + 500 * q, 0.06, 'triangle', 0.35 * q);
      noise(0.25, 'lowpass', 500, 0.7, 0.25);
    },
    foulTip() {
      noise(0.06, 'highpass', 2500, 0.8, 0.35, 0.002);
    },
    mitt() {
      noise(0.12, 'lowpass', 420, 1, 0.9, 0.002);
      tone(110, 0.08, 'sine', 0.5);
    },
    whoosh() {
      const n = noise(0.22, 'bandpass', 600, 0.8, 0.3, 0.06);
      if (n) n.f.frequency.exponentialRampToValueAtTime(2200, n.t + 0.2);
    },
    release() {
      noise(0.08, 'bandpass', 1200, 0.6, 0.08, 0.02);
    },
    glove() {
      noise(0.07, 'lowpass', 700, 1, 0.5, 0.002);
    },
    // Crowd reaction. size 0..1.
    cheer(size) {
      const s = size == null ? 0.5 : size;
      const dur = 1.2 + 2.2 * s;
      if (!ctx) return;
      const t = ctx.currentTime;
      for (const [freq, q] of [[700, 0.6], [1400, 0.9], [2600, 1.2]]) {
        const src = ctx.createBufferSource();
        src.buffer = noiseBuf;
        src.loop = true;
        const f = ctx.createBiquadFilter();
        f.type = 'bandpass';
        f.frequency.value = freq;
        f.Q.value = q;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.18 + 0.3 * s, t + 0.25);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        src.connect(f).connect(g).connect(master);
        src.start(t, Math.random());
        src.stop(t + dur + 0.1);
      }
    },
    groan() {
      if (!ctx) return;
      const n = noise(1.1, 'bandpass', 500, 1.5, 0.35, 0.15);
      if (n) n.f.frequency.exponentialRampToValueAtTime(260, n.t + 1.0);
    },
    // Ballpark organ riff for home runs and wins.
    organ() {
      const notes = [523, 659, 784, 1047, 784, 1047];
      notes.forEach((n, i) => {
        tone(n, 0.16, 'square', 0.08, i * 0.12);
        tone(n / 2, 0.16, 'triangle', 0.1, i * 0.12);
      });
    },
    charge() {
      const notes = [392, 523, 659, 784];
      notes.forEach((n, i) => tone(n, i === 3 ? 0.4 : 0.14, 'square', 0.07, i * 0.15));
    },
    click() {
      tone(1200, 0.04, 'square', 0.05);
    },
    out() {
      tone(330, 0.18, 'triangle', 0.18);
      tone(247, 0.25, 'triangle', 0.18, 0.12);
    },
  };

  let lastSpeech = 0;
  function ump(text) {
    if (muted || !root.speechSynthesis || !root.SpeechSynthesisUtterance) return;
    try {
      const now = Date.now();
      if (now - lastSpeech < 350) root.speechSynthesis.cancel();
      lastSpeech = now;
      const u = new root.SpeechSynthesisUtterance(text);
      u.rate = 1.15;
      u.pitch = 0.75;
      u.volume = 0.9;
      root.speechSynthesis.speak(u);
    } catch (e) {
      /* speech not available */
    }
  }

  BB.audio = Object.assign({ init, setMuted, ump, isMuted: () => muted }, sfx);
})(typeof window !== 'undefined' ? window : globalThis);
