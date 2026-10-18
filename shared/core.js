/* Parlor shared helpers. Every game loads this before its own script and reads what it
   needs off the Parlor object, e.g.  var $ = Parlor.$, rnd = Parlor.rnd;  */
var Parlor = (function(){
  "use strict";
  var $ = function(id){ return document.getElementById(id); };

  /* ===== Randomness ===== */
  function rnd(n){ // fair integer in [0, n)
    if (window.crypto && crypto.getRandomValues){
      var b = new Uint32Array(1), lim = Math.floor(4294967296 / n) * n;
      do { crypto.getRandomValues(b); } while (b[0] >= lim);
      return b[0] % n;
    }
    return Math.floor(Math.random() * n);
  }
  function shuffle(a, rand){ // in place; rand(n) defaults to rnd
    rand = rand || rnd;
    for (var i = a.length - 1; i > 0; i--){ var j = rand(i+1), t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  // Repeatable randomness from a text seed, so two devices can build the same game from a short code.
  function seeded(seed){
    var h = 1779033703 ^ seed.length;
    for (var i = 0; i < seed.length; i++){ h = Math.imul(h ^ seed.charCodeAt(i), 3432918353); h = h << 13 | h >>> 19; }
    var s = h >>> 0;
    function next(){ // mulberry32
      s = s + 0x6D2B79F5 | 0;
      var t = Math.imul(s ^ s >>> 15, 1 | s);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    }
    return function(n){ return Math.floor(next() * n); };
  }

  function fmt(sec){ sec = Math.max(0, Math.ceil(sec)); return Math.floor(sec/60) + ":" + String(sec%60).padStart(2,"0"); }

  /* ===== Storage: kept in the browser's local storage (no expiry), namespaced per game =====
     store("tumbleword").get("settings", ["boggle-settings"]) also reads older key names once. */
  function store(game){
    var prefix = "parlor." + game + ".";
    return {
      get: function(key, legacy){
        try {
          var v = localStorage.getItem(prefix + key);
          for (var i = 0; v === null && legacy && i < legacy.length; i++) v = localStorage.getItem(legacy[i]);
          return v === null ? null : JSON.parse(v);
        } catch(e){ return null; }
      },
      set: function(key, value){ try { localStorage.setItem(prefix + key, JSON.stringify(value)); } catch(e){} },
      remove: function(key){ try { localStorage.removeItem(prefix + key); } catch(e){} }
    };
  }
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch(e){}

  /* ===== Sound: call unlockAudio() from a tap before the first beep (iOS rule) ===== */
  var audioCtx = null;
  function unlockAudio(){
    try {
      if (!audioCtx){ var AC = window.AudioContext || window.webkitAudioContext; if (AC) audioCtx = new AC(); }
      if (audioCtx && audioCtx.state === "suspended") audioCtx.resume();
      if (audioCtx){ var b = audioCtx.createBuffer(1,1,22050), s = audioCtx.createBufferSource(); s.buffer=b; s.connect(audioCtx.destination); s.start(0); }
    } catch(e){}
  }
  function beep(freq, at, dur){
    if (!audioCtx) return;
    var o = audioCtx.createOscillator(), g = audioCtx.createGain(), t = audioCtx.currentTime + at;
    o.type = "square"; o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.25, t+0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t+dur);
    o.connect(g); g.connect(audioCtx.destination); o.start(t); o.stop(t+dur+0.05);
  }
  function buzzer(){ beep(660,0,.35); beep(660,.45,.35); beep(440,.9,.9); }

  /* ===== Countdown that survives the screen sleeping (it works from the end time, not by counting ticks) =====
     var clock = Parlor.countdown({ onTick: function(secondsLeft){...}, onDone: function(){...} });
     clock.start(60); clock.pause(); clock.resume(); clock.stop(); clock.tick() (redraw now); clock.running / clock.active */
  function countdown(opts){
    var c = { remaining: 0, running: false, active: false }, endAt = 0, iv = null;
    function tick(){
      if (!c.active) return;
      if (c.running) c.remaining = Math.max(0, (endAt - Date.now()) / 1000);
      if (opts.onTick) opts.onTick(c.remaining);
      if (c.remaining <= 0){ c.stop(); if (opts.onDone) opts.onDone(); }
    }
    c.start = function(sec){ c.remaining = sec; endAt = Date.now() + sec * 1000; c.running = c.active = true; clearInterval(iv); iv = setInterval(tick, 200); tick(); };
    c.pause = function(){ if (!c.running) return; c.remaining = Math.max(0, (endAt - Date.now()) / 1000); c.running = false; tick(); };
    c.resume = function(){ if (!c.active || c.running) return; endAt = Date.now() + c.remaining * 1000; c.running = true; tick(); };
    c.stop = function(){ c.active = c.running = false; clearInterval(iv); };
    c.tick = tick;
    document.addEventListener("visibilitychange", function(){ if (document.visibilityState === "visible") tick(); });
    return c;
  }

  /* ===== Editable list of player names =====
     var names = Parlor.nameList({ box: el, add: buttonEl, list: function(){ return settings.players; },
                                   min: 1, max: 8, onChange: save });   then names.render() whenever the setup shows.
     Markup: <div class="names" id="..."></div> <button class="ghost">Add player</button> */
  function nameList(o){
    var min = o.min || 1, max = o.max || 8;
    function esc(s){ return String(s).replace(/[&<>"]/g, function(ch){ return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]; }); }
    function render(){
      var list = o.list();
      if (o.box.children.length !== list.length){ // rebuild only when the count changes, so typing keeps focus
        o.box.innerHTML = list.map(function(n, i){
          return '<div class="nm"><input class="field" data-i="' + i + '" maxlength="18" placeholder="Player ' + (i + 1) + '" value="' + esc(n) + '" aria-label="Player ' + (i + 1) + ' name">' +
                 (list.length > min ? '<button class="x" data-i="' + i + '" aria-label="Remove player">×</button>' : "") + '</div>';
        }).join("");
      }
      o.add.hidden = list.length >= max;
    }
    o.box.addEventListener("input", function(e){ o.list()[+e.target.dataset.i] = e.target.value; o.onChange(); });
    o.box.addEventListener("click", function(e){
      var b = e.target.closest("button"); if (!b) return;
      o.list().splice(+b.dataset.i, 1); o.box.innerHTML = ""; o.onChange(); render();
    });
    o.add.addEventListener("click", function(){
      o.list().push(""); o.onChange(); render();
      var f = o.box.querySelectorAll("input"); f[f.length - 1].focus();
    });
    return { render: render };
  }
  function esc(s){ return String(s).replace(/[&<>"]/g, function(ch){ return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]; }); }
  /* Scoreboard buttons for <div class="award">: tap a player to give them the point.
     opts: { disabled: true (final scores), out: [i, ...] (players sitting this one out) } */
  function awardHTML(players, scores, opts){
    opts = opts || {};
    var best = Math.max.apply(null, scores);
    return players.map(function(p, i){
      var cls = (best > 0 && scores[i] === best ? "lead " : "") + (opts.out && opts.out.indexOf(i) >= 0 ? "out" : "");
      return '<button data-i="' + i + '"' + (cls ? ' class="' + cls.trim() + '"' : "") + (opts.disabled ? " disabled" : "") +
             '><span>' + esc(p) + '</span><b>' + scores[i] + '</b></button>';
    }).join("");
  }
  // Player names with blanks filled in as "Player n"
  function playerNames(list){ return list.map(function(n, i){ return String(n).trim() || "Player " + (i + 1); }); }

  /* ===== Keep the screen on while a game is in progress ===== */
  var wakeLock = null;
  function requestWake(){
    try { if ("wakeLock" in navigator) navigator.wakeLock.request("screen").then(function(l){ wakeLock = l; }).catch(function(){}); } catch(e){}
  }
  function releaseWake(){ try { if (wakeLock) wakeLock.release(); } catch(e){} wakeLock = null; }

  /* ===== Offline support: one service worker at the site root caches every game (needs https) ===== */
  function registerOffline(rootPath){
    if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")){
      window.addEventListener("load", function(){ navigator.serviceWorker.register(rootPath + "sw.js").catch(function(){}); });
    }
  }

  return { $: $, rnd: rnd, shuffle: shuffle, seeded: seeded, fmt: fmt, store: store,
           unlockAudio: unlockAudio, beep: beep, buzzer: buzzer, countdown: countdown, nameList: nameList, playerNames: playerNames, esc: esc, awardHTML: awardHTML,
           requestWake: requestWake, releaseWake: releaseWake, registerOffline: registerOffline };
})();
