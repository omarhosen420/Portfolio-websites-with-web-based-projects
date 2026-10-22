/* ==========================================================================
   AetherOS — canvas effects
   --------------------------------------------------------------------------
   Particles and rune circles for the spellcasting console. Everything is
   additive and short-lived; the loop stops itself when nothing is on screen,
   and with prefers-reduced-motion the effects are skipped entirely.
   ========================================================================== */
(function (root) {
  "use strict";

  var canvas = null;
  var ctx = null;
  var dpr = 1;
  var width = 0;
  var height = 0;
  var particles = [];
  var rings = [];
  var motes = [];
  var running = false;
  var reduced = false;
  var last = 0;

  function resize() {
    if (!canvas) return;
    var box = canvas.getBoundingClientRect();
    width = Math.max(1, box.width);
    height = Math.max(1, box.height);
    dpr = Math.min(root.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function seedMotes() {
    motes = [];
    var count = width < 640 ? 16 : 34;
    for (var i = 0; i < count; i++) {
      motes.push({
        x: Math.random() * width,
        y: Math.random() * height,
        r: 0.6 + Math.random() * 1.8,
        vy: -(0.05 + Math.random() * 0.22),
        vx: (Math.random() - 0.5) * 0.18,
        alpha: 0.12 + Math.random() * 0.4,
        hue: 250 + Math.random() * 70
      });
    }
  }

  function start() {
    if (running || !ctx) return;
    running = true;
    last = 0;
    root.requestAnimationFrame(frame);
  }

  function frame(time) {
    if (!running || !ctx) return;
    var delta = last ? Math.min((time - last) / 16.67, 3) : 1;
    last = time;

    ctx.clearRect(0, 0, width, height);
    ctx.globalCompositeOperation = "lighter";

    for (var i = 0; i < motes.length; i++) {
      var mote = motes[i];
      mote.x += mote.vx * delta;
      mote.y += mote.vy * delta;
      if (mote.y < -6) { mote.y = height + 6; mote.x = Math.random() * width; }
      if (mote.x < -6) mote.x = width + 6;
      if (mote.x > width + 6) mote.x = -6;
      ctx.beginPath();
      ctx.fillStyle = "hsla(" + mote.hue + ", 90%, 76%, " + mote.alpha + ")";
      ctx.arc(mote.x, mote.y, mote.r, 0, Math.PI * 2);
      ctx.fill();
    }

    for (var p = particles.length - 1; p >= 0; p--) {
      var particle = particles[p];
      particle.life -= delta;
      if (particle.life <= 0) { particles.splice(p, 1); continue; }
      particle.x += particle.vx * delta;
      particle.y += particle.vy * delta;
      particle.vy += 0.045 * delta;
      particle.vx *= 0.985;
      var ratio = particle.life / particle.max;
      ctx.beginPath();
      ctx.fillStyle = "hsla(" + particle.hue + ", 100%, " + (60 + ratio * 25) + "%, " + (ratio * 0.95) + ")";
      ctx.arc(particle.x, particle.y, particle.r * (0.4 + ratio), 0, Math.PI * 2);
      ctx.fill();
    }

    for (var r = rings.length - 1; r >= 0; r--) {
      var ring = rings[r];
      ring.life -= delta;
      if (ring.life <= 0) { rings.splice(r, 1); continue; }
      var t = 1 - ring.life / ring.max;
      var radius = ring.from + (ring.to - ring.from) * Math.sqrt(t);
      var alpha = (1 - t) * 0.85;
      ctx.save();
      ctx.translate(ring.x, ring.y);
      ctx.rotate(ring.spin * t);
      ctx.strokeStyle = "hsla(" + ring.hue + ", 100%, 72%, " + alpha + ")";
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.stroke();

      // rune ticks around the ring
      ctx.beginPath();
      for (var tick = 0; tick < ring.ticks; tick++) {
        var angle = (tick / ring.ticks) * Math.PI * 2;
        var inner = radius * 0.86;
        var outer = radius * (tick % 3 === 0 ? 1.12 : 1.04);
        ctx.moveTo(Math.cos(angle) * inner, Math.sin(angle) * inner);
        ctx.lineTo(Math.cos(angle) * outer, Math.sin(angle) * outer);
      }
      ctx.stroke();

      // inner rotating triangle for the bigger rings
      if (ring.triangle && radius > 18) {
        ctx.beginPath();
        for (var corner = 0; corner < 3; corner++) {
          var theta = (corner / 3) * Math.PI * 2 - Math.PI / 2;
          var px = Math.cos(theta) * radius * 0.52;
          var py = Math.sin(theta) * radius * 0.52;
          if (corner === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.stroke();
      }
      ctx.restore();
    }

    var busy = particles.length || rings.length;
    if (!busy && reduced) {
      ctx.clearRect(0, 0, width, height);
      running = false;
      return;
    }
    root.requestAnimationFrame(frame);
  }

  function burst(x, y, hue, force) {
    if (reduced || !ctx) return 0;
    var count = force || 46;
    for (var i = 0; i < count; i++) {
      var angle = Math.random() * Math.PI * 2;
      var speed = 1.2 + Math.random() * 5.4;
      particles.push({
        x: x,
        y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1.2,
        r: 1 + Math.random() * 2.4,
        life: 34 + Math.random() * 42,
        max: 76,
        hue: hue + (Math.random() * 36 - 18)
      });
    }
    if (particles.length > 420) particles.splice(0, particles.length - 420);
    start();
    return count;
  }

  function rune(x, y, hue) {
    if (reduced || !ctx) return;
    rings.push({ x: x, y: y, from: 6, to: Math.min(190, Math.max(90, width * 0.22)), life: 52, max: 52, hue: hue, spin: 1.6, ticks: 24, triangle: true });
    rings.push({ x: x, y: y, from: 10, to: Math.min(120, width * 0.14), life: 40, max: 40, hue: hue + 40, spin: -2.1, ticks: 12, triangle: false });
    start();
  }

  function init(element) {
    canvas = element;
    if (!canvas) return;
    try {
      ctx = canvas.getContext("2d");
    } catch (error) {
      ctx = null;
    }
    if (!ctx) return;
    reduced = !!(root.matchMedia && root.matchMedia("(prefers-reduced-motion: reduce)").matches);
    resize();
    seedMotes();
    start();
    root.addEventListener("resize", function () {
      resize();
      seedMotes();
    });
  }

  function setReduced(value) {
    reduced = !!value;
    if (reduced) {
      particles = [];
      rings = [];
      if (ctx) ctx.clearRect(0, 0, width, height);
    }
  }

  root.AetherFX = {
    init: init,
    burst: burst,
    rune: rune,
    setReduced: setReduced,
    isReduced: function () { return reduced; },
    stats: function () { return { particles: particles.length, rings: rings.length, motes: motes.length, ready: !!ctx }; }
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
