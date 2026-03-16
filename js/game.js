let laneSwitchTimer = 0;
const PERFECT_WINDOW = 12;
const PERFECT_DISTANCE = 8;
let perfectFlash = 0;
// Combo system
let combo = 0;
let comboTimer = 0;
const COMBO_DURATION = 180; // 180 frames ≈ 3 secondes
// Effets visuels de score flottant
let floatingScores = [];
// Fond d'étoiles léger
let stars = [];
// Particules pour near-miss
let particles = [];
// Mode basse performance (désactive particules, réduit étoiles)
let lowPerfMode = false;
// Spawn warnings (mobile): petits clignotants pour prévenir l'arrivée
let spawnWarnings = [];
const WARNING_DURATION = 36; // frames (~600ms)
// Pulse Storm (phase rapide/néon)
let pulseStorm = false;
let pulseStormTimer = 0;
let pulseStormCooldown = 0;
// obstacle neon pulse
let obstaclePulse = 0;
// Mode shift visual timer
let modeShiftTimer = 0;
// next automatic mode switch distance (meters) and cooldown (frames)
let nextModeSwitch = 1200 + Math.random() * 800;
let modeCooldown = 0; // frames remaining (use 60 ≈ 1s)

// current zone tracking for notifications (initialized after zones are declared)
let currentZoneName = null;
let zoneNoticeTimer = 0; // frames to show zone notice
// capture last console errors for in-game display (helpful during playtests)
const consoleErrors = [];
function pushConsoleError(e){
  try{
    const now = Date.now();
    consoleErrors.push(Object.assign({time: now}, e));
    // keep only last 4 entries
    while(consoleErrors.length > 4) consoleErrors.shift();
    // also print to real console for developer
    try{ console.error('Captured error:', e); }catch(e){}
  }catch(e){}
}

window.addEventListener('error', function(ev){
  pushConsoleError({ message: ev.message, source: ev.filename, lineno: ev.lineno, colno: ev.colno });
});
window.addEventListener('unhandledrejection', function(ev){
  const reason = ev.reason ? (ev.reason.message || String(ev.reason)) : 'Promise rejected';
  pushConsoleError({ message: reason, source: 'promise', detail: ev.reason });
});

// Micro caméra dynamique (zoom / offset / shake)
const camera = {
  x: 0,
  y: 0,
  zoom: 1
};

// simple frame counter for subtle background motion
let frame = 0;

// background tiling image (centre + repeat technique)
const bgImage = new Image();
// user-provided location fallback: prefer assets/fond.png then assets/backgrounds/fond.png
bgImage.src = 'assets/fond.png';
bgImage.onerror = function(){ bgImage.src = 'assets/backgrounds/fond.png'; };

// --- Zones (progressive route backgrounds) ---
const zones = [
  { name: "city", start: 0, bg: "assets/bg_city.png" },
  { name: "tunnel", start: 1500, bg: "assets/bg_tunnel.png" },
  { name: "space", start: 3000, bg: "assets/bg_space.png" }
];

// preload zone backgrounds into a map
const backgrounds = {};
for (const z of zones) {
  try{
    const img = new Image();
    img.src = z.bg;
    img.onerror = function(){ /* ignore missing zone art */ };
    backgrounds[z.name] = img;
  }catch(e){ /* ignore */ }
}

function getCurrentZone(){
  let zone = zones[0];
  for (let i = 0; i < zones.length; i++){
    if (distance >= zones[i].start) zone = zones[i];
  }
  return zone;
}

// now that `zones` exists, set initial current zone
currentZoneName = zones && zones.length ? zones[0].name : null;

// Diamonds: soft currency awarding logic
let nextDiamondDistance = 1000 + Math.random() * 500; // award when passing this distance

function updateDiamondsUI(){
  try{
    const el = document.getElementById('menuDiamonds');
    if(!el) return;
    let prof = null;
    try{ prof = (typeof loadProfile === 'function') ? loadProfile() : ((typeof initProfile === 'function') ? initProfile() : null); }catch(e){ prof = null; }
    const d = (prof && prof.inventory && typeof prof.inventory.diamonds === 'number') ? prof.inventory.diamonds : 0;
    el.textContent = d;
  }catch(e){}
}


// Pattern-based tiling to avoid seams. Generated tile is scaled to short axis.
let bgPattern = null;
let bgTileW = 0;
let bgTileH = 0;

function updateBgPattern(){
  if (!bgImage || !bgImage.complete || !bgImage.naturalWidth) return;
  try{
    if (canvas.width >= canvas.height){
      // landscape: scale image to canvas height
      const scale = canvas.height / bgImage.height;
      bgTileH = canvas.height;
      bgTileW = Math.max(1, Math.round(bgImage.width * scale));
    } else {
      // portrait: scale image to canvas width
      const scale = canvas.width / bgImage.width;
      bgTileW = canvas.width;
      bgTileH = Math.max(1, Math.round(bgImage.height * scale));
    }

    // create offscreen canvas for scaled tile
    const off = document.createElement('canvas');
    off.width = bgTileW;
    off.height = bgTileH;
    const octx = off.getContext('2d');
    // draw scaled image to offscreen
    octx.imageSmoothingEnabled = false;
    octx.clearRect(0,0,bgTileW,bgTileH);
    octx.drawImage(bgImage, 0, 0, bgTileW, bgTileH);

    // create a slightly larger temp canvas to bleed edges (avoid seams)
    const bleed = 2;
    const off2 = document.createElement('canvas');
    off2.width = bgTileW + bleed * 2;
    off2.height = bgTileH + bleed * 2;
    const o2 = off2.getContext('2d');
    o2.imageSmoothingEnabled = false;
    // draw center
    o2.drawImage(off, bleed, bleed);
    // copy left edge to right side
    o2.drawImage(off, 0, 0, bleed, bgTileH, bgTileW + bleed, bleed, bleed, bgTileH);
    // copy right edge to left side
    o2.drawImage(off, bgTileW - bleed, 0, bleed, bgTileH, 0, bleed, bleed, bgTileH);
    // copy top edge to bottom
    o2.drawImage(off, 0, 0, bgTileW, bleed, bleed, bgTileH + bleed, bgTileW, bleed);
    // copy bottom edge to top
    o2.drawImage(off, 0, bgTileH - bleed, bgTileW, bleed, bleed, 0, bgTileW, bleed);

    // pattern uses the center area only but the bleed ensures neighboring tiles sample extended pixels
    const patternCanvas = document.createElement('canvas');
    patternCanvas.width = bgTileW;
    patternCanvas.height = bgTileH;
    const pctx = patternCanvas.getContext('2d');
    pctx.imageSmoothingEnabled = false;
    // copy the central region
    pctx.drawImage(off2, bleed, bleed, bgTileW, bgTileH, 0, 0, bgTileW, bgTileH);

    // create pattern from processed canvas
    bgPattern = ctx.createPattern(patternCanvas, 'repeat');
  }catch(e){
    bgPattern = null;
  }
}

bgImage.onload = function(){ updateBgPattern(); };
let bgOffset = 0;
const bgScrollFactor = 0.35; // scroll speed multiplier for parallax effect
let bgY = 0; // vertical background offset for portrait/vertical mode
const PULSE_STORM_DURATION = 300; // ~5 secondes
const PULSE_STORM_COOLDOWN = 1200; // ~20 secondes
// Mode switch timing (progressive): start long, then shorten with progress
const MODE_SWITCH_BASE = 1200; // initial interval (~20s)
const MODE_SWITCH_MIN = 300;   // minimum interval (~5s)
// Helper to read runner progress from engine state or fallback
function getRunnerProfile(){
  try{
    if (window.state && state.progression && state.progression.runner) return state.progression.runner;
  } catch(e){}
  try{
    if (typeof getProfile === 'function'){
      const p = getProfile();
      if (p && p.progression && p.progression.runner) return p.progression.runner;
    }
  } catch(e){}
  // engine-only: if no engine profile available, return null
  return null;
}
// runProcessed évite de compter plusieurs fois la même fin de partie
let runProcessed = false;
// level up visual
let levelUpTimer = 0;
let levelUpLevel = 0;

// expose handler for profile module to call when leveling
window.onPlayerLevelUp = function(level){
  levelUpLevel = level || 0;
  levelUpTimer = 140; // ~2.3s at 60fps
  floatingScores.push({ x: canvas ? canvas.width/2 : 200, y: canvas ? canvas.height/2 : 120, value: '✨ LEVEL UP ✨', alpha: 1, vy: -0.6, style: 'perfect' });
  // play a celebratory chime (layered)
  try{
    playSound && playSound(900, 0.12, 'triangle', 0.22);
    setTimeout(()=> playSound && playSound(1200, 0.14, 'sine', 0.18), 80);
    setTimeout(()=> playSound && playSound(700, 0.08, 'triangle', 0.14), 160);
  }catch(e){}

  // small particle burst for visual feedback (if not low perf)
  if (!lowPerfMode){
    for(let i=0;i<18;i++){
      particles.push({
        x: (canvas ? canvas.width/2 : 200) + (Math.random()-0.5)*60,
        y: (canvas ? canvas.height/2 : 120) + (Math.random()-0.5)*30,
        vx: (Math.random()-0.5)*3,
        vy: (Math.random()-0.8)*-2,
        life: 30 + Math.floor(Math.random()*20),
        size: Math.random()*2 + 1.5,
        color: '#c77dff'
      });
    }
  }
};

function endRun(){
  if(runProcessed) return;
  runProcessed = true;

  // award end-run bonus diamonds based on performance
  try{
    const endBonus = Math.floor(score / 500) + Math.floor(distance / 2000);
    if (endBonus > 0 && typeof addDiamonds === 'function'){
      try{ addDiamonds(endBonus); updateDiamondsUI(); floatingScores.push({ x: canvas.width/2, y: canvas.height*0.3, value: `♦ +${endBonus}`, alpha: 1, vy: -0.6, style: 'bonus' }); }catch(e){}
    }
  }catch(e){}

  // Prefer engine profile API if available
  if (typeof updateState === 'function'){
    try{
      updateState(state => {
        state.progression = state.progression || {};
        state.progression.runner = state.progression.runner || { bestScore:0, bestDistance:0, bestCombo:0, runs:0 };
        const r = state.progression.runner;
        r.runs = (r.runs || 0) + 1;
        r.bestScore = Math.max(r.bestScore || 0, Math.floor(score));
        r.bestDistance = Math.max(r.bestDistance || 0, Math.floor(distance));
        r.bestCombo = Math.max(r.bestCombo || 0, combo);
      });
      if (typeof saveProfile === 'function') saveProfile();
      // award XP for the run
      try{ if (typeof addXP === 'function') addXP(Math.floor(score/10)); }catch(e){}
      try{
        if (typeof loadMenuProfile === 'function') loadMenuProfile();
        const menuEl = document.getElementById('menu');
        if (menuEl) menuEl.style.display = 'flex';
      }catch(e){}
      return;
    } catch(e){
      // silently ignore engine profile errors in engine-only mode
    }
  }

  // engine-only: do not perform fallback persistence
  try{
    // award XP for the run (fallback path)
    try{ if (typeof addXP === 'function') addXP(Math.floor(score/10)); }catch(e){}
    // also update local profile bests when engine is not present
    try{
      if (typeof loadProfile === 'function' && typeof saveProfile === 'function'){
        let profile = loadProfile() || createDefaultProfile();
        profile.progression = profile.progression || {};
        profile.progression.runner = profile.progression.runner || { bestScore:0, bestDistance:0, bestCombo:0, runs:0 };
        const r = profile.progression.runner;
        r.runs = (r.runs || 0) + 1;
        r.bestScore = Math.max(r.bestScore || 0, Math.floor(score));
        r.bestDistance = Math.max(r.bestDistance || 0, Math.floor(distance));
        r.bestCombo = Math.max(r.bestCombo || 0, combo);
        saveProfile(profile);
        // notify UI (menu) that a local save occurred
        try{ if (typeof showLocalSaveNotice === 'function') showLocalSaveNotice(); }catch(e){}
      }
    }catch(e){}
    if (typeof loadMenuProfile === 'function') loadMenuProfile();
    const menuEl = document.getElementById('menu');
    if (menuEl) menuEl.style.display = 'flex';
  }catch(e){}
}
function soundMove() {
  playSound(750, 0.04, "triangle", 0.18);
  setTimeout(() => playSound(900, 0.04, "triangle", 0.15), 20);
}



// Moteur audio Web Audio API (créé à la demande après interaction utilisateur)
let audioCtx;
function getAudioCtx() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === "suspended") {
    audioCtx.resume();
  }
  return audioCtx;
}

function playSound(freq, duration, type = "sine", volume = 0.2) {
  const ctx = getAudioCtx();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.value = volume;
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  gain.gain.exponentialRampToValueAtTime(
    0.0001,
    ctx.currentTime + duration
  );
  osc.stop(ctx.currentTime + duration);
}
// Débloque l'audio au premier geste utilisateur
window.addEventListener("pointerdown", getAudioCtx, { once: true });
window.addEventListener("keydown", getAudioCtx, { once: true });

function soundBonus() {
  playSound(900, 0.15, "sine", 0.25);
  setTimeout(() => playSound(1200, 0.15, "sine", 0.2), 80);
}

function soundHit() {
  playSound(150, 0.3, "sawtooth", 0.4);
}

function soundPulse() {
  playSound(300, 0.1, "triangle", 0.25);
  setTimeout(() => playSound(600, 0.2, "triangle", 0.25), 80);
}

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// Responsive canvas + mobile detection
let isMobile = window.innerWidth < 768;
function resizeCanvas() {
  // use CSS pixels for canvas coordinate system to keep input and game logic consistent
  canvas.style.width = window.innerWidth + 'px';
  canvas.style.height = window.innerHeight + 'px';
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  isMobile = window.innerWidth < 768;

  // heuristique simple pour détecter appareils faibles
  lowPerfMode = isMobile || (navigator.deviceMemory && navigator.deviceMemory < 2);

  // apply a CSS class so styles can reduce visual detail on weak devices
  try{ document.body.classList.toggle('lowPerf', !!lowPerfMode); }catch(e){}

  lanes[0] = canvas.height / 4;
  lanes[1] = canvas.height / 2;
  lanes[2] = canvas.height * 3 / 4;

  verticalLanes[0] = canvas.width * 0.3;
  verticalLanes[1] = canvas.width * 0.5;
  verticalLanes[2] = canvas.width * 0.7;
  // refresh background pattern when size changes
  try{ updateBgPattern(); }catch(e){}
}

function initStars(){
  stars = [];
  const count = lowPerfMode ? 30 : (isMobile ? 40 : 80);
  for(let i=0;i<count;i++){
    stars.push({
      x: Math.random()*canvas.width,
      y: Math.random()*canvas.height,
      speed: Math.random()*0.4 + 0.2,
      size: Math.random()*1.6 + 0.6
    });
  }
}

function updateStars(){
  const speedFactor = 1 + gameSpeed * 0.06; // stronger relation to speed for sensation
  for(let s of stars){
    if (gameMode === 'vertical') {
      // vertical mode: stars move downwards to match world movement
      s.y += s.speed * speedFactor;
      if (s.y > canvas.height + 4) {
        s.y = -4;
        s.x = Math.random()*canvas.width;
        s.speed = Math.random()*0.4 + 0.2;
        s.size = Math.random()*1.6 + 0.6;
      }
    } else {
      // horizontal mode: stars move left
      s.x -= s.speed * speedFactor;
      if(s.x < -4){
        s.x = canvas.width + 4;
        s.y = Math.random()*canvas.height;
        s.speed = Math.random()*0.4 + 0.2;
        s.size = Math.random()*1.6 + 0.6;
      }
    }
  }
}

function drawStars(){
  ctx.save();
  for(let s of stars){
    ctx.globalAlpha = Math.max(0.15, Math.min(0.9, s.size/2));
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(Math.floor(s.x), Math.floor(s.y), s.size, s.size);
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

function updateParticles(){
  for(let p of particles){
    p.x += p.vx;
    p.y += p.vy;
    p.vx *= 0.98;
    p.vy += 0.04; // slight gravity
    p.life--;
  }
  particles = particles.filter(p => p.life > 0 && p.x > -20 && p.x < canvas.width + 20 && p.y > -20 && p.y < canvas.height + 20);
}

function drawParticles(){
  ctx.save();
  for(let p of particles){
    ctx.globalAlpha = Math.max(0, p.life/20);
    ctx.fillStyle = p.color || '#c77dff';
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size || 2, 0, Math.PI*2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

// --- Simple night background helpers (lightweight) ---
function drawNightStars(){
  ctx.fillStyle = "#ffffff22";
  for (let i = 0; i < 40; i++) {
    const x = (i * 97) % canvas.width;
    const y = (i * 53 + frame * 0.1) % canvas.height;
    ctx.fillRect(Math.floor(x), Math.floor(y), 2, 2);
  }
}

function drawHorizon(){
  const gradient = ctx.createLinearGradient(
    0,
    canvas.height*0.4,
    0,
    canvas.height
  );
  gradient.addColorStop(0,"#0a0015");
  gradient.addColorStop(1,"#220044");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, canvas.height*0.4, canvas.width, canvas.height);
}

function drawMountains(){
  ctx.fillStyle = "#12002a";
  ctx.beginPath();
  ctx.moveTo(0, canvas.height*0.55);
  for(let i=0;i<canvas.width;i+=120){
    const height = canvas.height*0.55 - Math.sin(i*0.01)*40;
    ctx.lineTo(i,height);
  }
  ctx.lineTo(canvas.width,canvas.height);
  ctx.lineTo(0,canvas.height);
  ctx.fill();
}

// initial values (arrays declared before use)
const lanes = [0, 0, 0];
const verticalLanes = [0, 0, 0];
resizeCanvas();
initStars();
window.addEventListener("resize", resizeCanvas);
window.addEventListener("orientationchange", resizeCanvas);

// Toggle low performance mode with 'L' (helpful for quick testing)
document.addEventListener('keydown', (e) => {
  if (e.key === 'l' || e.key === 'L'){
    lowPerfMode = !lowPerfMode;
    initStars();
    // brief on-screen notice
    floatingScores.push({ x: 120, y: 80, value: lowPerfMode ? "LowPerf ON" : "LowPerf OFF", alpha: 1, vy: -0.6 });
  }
});


let slowTimer = 0;
const SLOW_DURATION = 300; // 300 frames ≈ 5 secondes
let nearMissFlash = 0;
const NEAR_DISTANCE = 20;
const player = new Player(200, lanes[1]);

const patterns = [
  [0, 2],
  [2, 0],
  [0, 2, 1],
  [2, 0, 1],
  [0, 1, 2],
  [2, 1, 0]
];

let obstacles = [];
let bonuses = [];

let spawnTimer = 0;
let gameOver = false;
let score = 0;
let distance = 0;
let gameMode = "horizontal";
let gameSpeed = 4;
let lastLane = -1;
let pulse = 0;
let modeTimer = 0;
let pulseFlash = 0;
let shake = 0;
// Game start control (don't auto-run until user starts)
var gameStarted = false;

function spawnPattern() {
  const pattern = patterns[Math.floor(Math.random() * patterns.length)];

  // spawn offset scales with screen size so reaction time is preserved on mobile
  const baseX = canvas.width + Math.max(400, canvas.width * 0.6);
  const baseY = -Math.max(400, canvas.height * 0.6);

  pattern.forEach((lane, i) => {
    if (gameMode === "horizontal") {
      obstacles.push(
        new Obstacle(
          baseX + i * 140,
          lanes[lane]
        )
      );
      // mobile warning at screen edge
      if (isMobile) {
        spawnWarnings.push({ x: canvas.width - 40, y: lanes[lane], life: WARNING_DURATION });
        if (navigator.vibrate) navigator.vibrate(30);
        playSound(700, 0.06, "sine", 0.12);
      }
    } else {
      obstacles.push(
        new Obstacle(
          verticalLanes[lane],
          baseY - i * 140
        )
      );
      if (isMobile) {
        spawnWarnings.push({ x: verticalLanes[lane], y: 40, life: WARNING_DURATION });
        if (navigator.vibrate) navigator.vibrate(30);
        playSound(700, 0.06, "sine", 0.12);
      }
    }
  });
}

function spawnObstacle() {
  let lane;

  do {
    lane = Math.floor(Math.random() * 3);
  } while (lane === lastLane);

  lastLane = lane;

  const baseX = canvas.width + Math.max(400, canvas.width * 0.6);
  const baseY = -Math.max(400, canvas.height * 0.6);

  if (gameMode === "horizontal") {
    obstacles.push(
      new Obstacle(baseX, lanes[lane])
    );
    if (isMobile) {
      spawnWarnings.push({ x: canvas.width - 40, y: lanes[lane], life: WARNING_DURATION });
      if (navigator.vibrate) navigator.vibrate(30);
      playSound(700, 0.06, "sine", 0.12);
    }
  } else {
    obstacles.push(
      new Obstacle(verticalLanes[lane], baseY)
    );
    if (isMobile) {
      spawnWarnings.push({ x: verticalLanes[lane], y: 40, life: WARNING_DURATION });
      if (navigator.vibrate) navigator.vibrate(30);
      playSound(700, 0.06, "sine", 0.12);
    }
  }
}

function spawnBonus() {
  if (Math.random() < 0.005 && bonuses.length < 1) {
    const lane = Math.floor(Math.random() * 3);
    if (gameMode === "horizontal") {
      const baseX = canvas.width + Math.max(400, canvas.width * 0.6);
      bonuses.push(
        new Bonus(baseX, lanes[lane], "slow")
      );
      if (isMobile) {
        spawnWarnings.push({ x: canvas.width - 40, y: lanes[lane], life: WARNING_DURATION });
        if (navigator.vibrate) navigator.vibrate(30);
        playSound(900, 0.06, "sine", 0.12);
      }
    } else {
      const baseY = -Math.max(400, canvas.height * 0.6);
      bonuses.push(
        new Bonus(verticalLanes[lane], baseY, "slow")
      );
      if (isMobile) {
        spawnWarnings.push({ x: verticalLanes[lane], y: 40, life: WARNING_DURATION });
        if (navigator.vibrate) navigator.vibrate(30);
        playSound(900, 0.06, "sine", 0.12);
      }
    }
  }
}

function resetGame() {
  score = 0;
  distance = 0;
  gameSpeed = 4;
  spawnTimer = 0;
  obstacles = [];
  bonuses = [];
  gameOver = false;
  pulse = 0;
  pulseFlash = 0;
  shake = 0;
  modeTimer = 0;
  lastLane = -1;

  player.targetLane = 1;
  player.trail = [];

  // allow endRun to run again for the next playthrough
  runProcessed = false;

  if (gameMode === "horizontal") {
    player.x = Math.max(120, canvas.width * 0.15);
    player.y = lanes[1];
  } else {
    player.x = verticalLanes[1];
    player.y = canvas.height * 0.75;
  }

  gameLoop();
}

function startGame(){
  if(gameStarted) return;
  gameStarted = true;
  runProcessed = false;
  resetGame();
}


function update() {
      if (laneSwitchTimer > 0) {
        laneSwitchTimer--;
      }
      // update background stars and particles
      updateStars();
      updateParticles();
      // Combo timer handling
      if (comboTimer > 0) {
        comboTimer--;
      } else {
        combo = 0;
      }

      // Pulse Storm cycle
      if (!pulseStorm) {
        pulseStormCooldown++;
        if (pulseStormCooldown > PULSE_STORM_COOLDOWN) {
          pulseStorm = true;
          pulseStormTimer = PULSE_STORM_DURATION;
          pulseStormCooldown = 0;
          soundPulse();
        }
      } else {
        pulseStormTimer--;
        if (pulseStormTimer <= 0) {
          pulseStorm = false;
        }
      }

    let spawnRate = Math.max(80 - gameSpeed * 3, 30);
    if (pulseStorm) {
      spawnRate *= 0.6;
    }
    // Score multiplier during pulse storm
    let scoreMultiplier = pulseStorm ? 2 : 1;
  if (gameOver) return;

  // decrement cooldown (frames)
  if (modeCooldown > 0) modeCooldown--;

  // Automatic mode switch based on travelled distance with randomized intervals
  if (distance >= nextModeSwitch && modeCooldown <= 0) {
    // toggle mode
    gameMode = (gameMode === "horizontal") ? "vertical" : "horizontal";

    pulseFlash = 20;
    shake = 10;

    // visual indicator for mode shift
    modeShiftTimer = 56; // just under 1s
    try{ if (typeof playSound === 'function') playSound(700, 0.08, 'triangle', 0.16); }catch(e){}

    player.targetLane = 1;
    player.trail = [];

    if (gameMode === "horizontal") {
      player.x = Math.max(120, canvas.width * 0.15);
      player.y = lanes[1];
    } else {
      player.x = verticalLanes[1];
      player.y = canvas.height * 0.75;
    }

    // avoid immediate collisions after mode change
    obstacles = [];
    bonuses = [];
    spawnTimer = 0;

    // set next switch threshold and a short cooldown to prevent double-switch
    nextModeSwitch += 1200 + Math.random() * 800; // stagger next switch
    modeCooldown = 120; // ~2 seconds at 60fps
  }

  // obstacle neon pulse update
  obstaclePulse += 0.1;

  // camera: do not change camera during mode shift transitions
  if (modeShiftTimer > 0) {
    // keep current camera values stable (optionally slight decay to center)
    camera.x += (0 - camera.x) * 0.02;
    camera.y += (0 - camera.y) * 0.02;
    // gently reduce zoom toward neutral if very far (prevents sudden jump after long runs)
    camera.zoom += (1 - camera.zoom) * 0.02;
  } else {
    // camera: zoom follows speed, lighter on mobile / lowPerf
    if (lowPerfMode) {
      // disable camera motion on very low perf devices
      camera.zoom = 1;
      camera.x += (0 - camera.x) * 0.12;
      camera.y += (0 - camera.y) * 0.12;
    } else if (isMobile) {
      // subtle zoom + offset on mobile
      const factor = 0.008; // much smaller multiplier
      camera.zoom = Math.min(1 + gameSpeed * factor, 1.07);
      // follow active axis: vertical mode -> follow X, horizontal mode -> follow Y
      let targetCamX = 0;
      let targetCamY = 0;
      if (gameMode === 'horizontal') {
        // player moves vertically between lanes -> follow Y
        targetCamY = (player.y - canvas.height / 2) * 0.03;
      } else {
        // vertical mode: keep camera centered (player stays visually fixed)
        targetCamX = 0;
      }
      camera.x += (targetCamX - camera.x) * 0.04;
      camera.y += (targetCamY - camera.y) * 0.04;
    } else {
      // desktop: stronger but clamped
      const factor = 0.02;
      camera.zoom = Math.min(1 + gameSpeed * factor, 1.25);
      let targetCamX = 0;
      let targetCamY = 0;
      if (gameMode === 'horizontal') {
        targetCamY = (player.y - canvas.height / 2) * 0.06;
      } else {
        targetCamX = 0;
      }
      camera.x += (targetCamX - camera.x) * 0.08;
      camera.y += (targetCamY - camera.y) * 0.08;
    }
  }

  if (gameMode === "horizontal") {

    player.update(lanes, gameMode);
  } else {
    player.update(verticalLanes, gameMode);
    // Simple vertical camera: follow player Y only (common runner behaviour)
    camera.y = player.y - canvas.height * 0.65;
    // lock horizontal camera
    camera.x = 0;
  }

  // Détection du centre de ligne (perfect)
  let laneArray = (gameMode === "horizontal") ? lanes : verticalLanes;
  let laneCenter = laneArray[player.targetLane];
  let dist;
  if (gameMode === "horizontal") {
    dist = Math.abs(player.y - laneCenter);
  } else {
    dist = Math.abs(player.x - laneCenter);
  }
  if (dist < PERFECT_DISTANCE && !player.perfectDone) {
    if (laneSwitchTimer > 0) {
      combo += 2;
      comboTimer = COMBO_DURATION;
      
      score += 50 * (combo + 1) * scoreMultiplier;
      floatingScores.push({
        x: player.x,
        y: player.y - 32,
        value: "PERFECT",
        alpha: 1,
        vy: -1.2,
        style: "perfect"
      });
      floatingScores.push({
        x: player.x,
        y: player.y - 10,
        value: "+50",
        alpha: 1,
        vy: -1.4,
        style: "bonus"
      });
      perfectFlash = 8;
      soundMove && soundMove();
      player.perfectDone = true;
      laneSwitchTimer = 0;
      // award a small diamond for perfect execution
      try{ if (typeof addDiamonds === 'function') { addDiamonds(1); updateDiamondsUI(); floatingScores.push({ x: player.x, y: player.y - 46, value: '♦ +1', alpha: 1, vy: -0.8, style: 'bonus' }); } }catch(e){}
    }
  }
  if (dist > PERFECT_DISTANCE) {
    player.perfectDone = false;
  }

  // progression, vitesse et spawn timer
  score += 0.1 * scoreMultiplier;
  distance += gameSpeed * 0.1;

  // award a diamond when passing nextDiamondDistance threshold
  try{
    if (distance >= nextDiamondDistance) {
      if (typeof addDiamonds === 'function'){
        try{ addDiamonds(1); updateDiamondsUI(); floatingScores.push({ x: canvas.width - 120, y: 120, value: '♦ +1', alpha: 1, vy: -0.6, style: 'bonus' }); }catch(e){}
      }
      nextDiamondDistance += 1000 + Math.random() * 500;
    }
  }catch(e){}

  gameSpeed += 0.0001;
  gameSpeed = Math.min(gameSpeed, 14);

  pulse += 0.1 + gameSpeed * 0.15;

  spawnTimer++;

  // advance vertical background offset when in vertical mode so zone backgrounds loop
  try {
    const bgFactor = lowPerfMode ? bgScrollFactor * 0.25 : (isMobile ? bgScrollFactor * 0.6 : bgScrollFactor);
    if (gameMode === 'vertical') {
      bgY = (bgY + gameSpeed * bgFactor * 1.2) % canvas.height;
    }
  } catch (e) {}

  // detect zone change based on distance and show a short notice
  try{
    const zoneNow = getCurrentZone();
    if (zoneNow && zoneNow.name !== currentZoneName) {
      currentZoneName = zoneNow.name;
      zoneNoticeTimer = 180; // ~3s
      // push a floating big label for playtesting
      floatingScores.push({ x: canvas.width/2, y: 120, value: zoneNow.name.toUpperCase(), alpha: 1, vy: -0.4, style: 'zone' });
      try{ console.log('Zone switched to', zoneNow.name, 'at distance', Math.floor(distance)); }catch(e){}
    }
    if (zoneNoticeTimer > 0) zoneNoticeTimer--;
  }catch(e){}


  if (spawnTimer > spawnRate) {
    spawnTimer = 0;

    if (Math.random() < 0.3) {
      spawnPattern();
    } else {
      spawnObstacle();
    }
  }

  // Tentative de spawn des bonuses (vérifie la probabilité et la limite)
  spawnBonus();


  // Gestion du slowTimer
  if (slowTimer > 0) {
    slowTimer--;
  }

  for (let b of bonuses) {
    b.update();

    const dx = Math.abs(player.x - b.x);
    const dy = Math.abs(player.y - b.y);

    if (dx < player.radius + b.radius && dy < player.radius + b.radius) {
      if (b.type === "slow") {
  
     // background vertical scroll for portrait / vertical mode
     try {
       const bgFactor = lowPerfMode ? bgScrollFactor * 0.25 : (isMobile ? bgScrollFactor * 0.6 : bgScrollFactor);
       if (gameMode === 'vertical') {
         const tileH = bgTileH || canvas.height;
         bgY = (bgY + gameSpeed * bgFactor * 1.8) % tileH;
       }
     } catch (e) {}
        slowTimer = SLOW_DURATION;
        soundBonus();
      }

      if (b.type === "score") {
        score += 100 * (pulseStorm ? 2 : 1);
        // soundBonus();
      }

      b.collected = true;
    }
  }

  bonuses = bonuses.filter(b => !b.collected && b.x > -50 && b.y < canvas.height + 50);

  for (let o of obstacles) {
    o.update();

    const dx = Math.abs(player.x - o.x);
    const dy = Math.abs(player.y - o.y);

    const hitX = o.width / 2 + player.radius;
    const hitY = o.height / 2 + player.radius;

    // NEAR MISS
    if (
      dx < hitX + NEAR_DISTANCE &&
      dy < hitY + NEAR_DISTANCE &&
      !(dx < hitX && dy < hitY) &&
      !o.near
    ) {
      combo++;
      comboTimer = COMBO_DURATION;

      score += 25 * (combo + 1) * scoreMultiplier;
      nearMissFlash = 10;
      soundMove && soundMove();
      // Ajoute un effet visuel +25 à la position du joueur
      floatingScores.push({
        x: player.x,
        y: player.y,
        value: "+25",
        alpha: 1,
        vy: -1.2
      });
      // particules near-miss
      if(!lowPerfMode){
        for(let i=0;i<10;i++){
          particles.push({
            x: player.x + (Math.random()-0.5)*8,
            y: player.y + (Math.random()-0.5)*8,
            vx: (Math.random()-0.5)*2 - (gameMode==='horizontal'? 0.6 : 0),
            vy: (Math.random()-0.5)*2,
            life: 18 + Math.floor(Math.random()*8),
            size: Math.random()*2 + 1,
            color: '#c77dff'
          });
        }
      }
      // small camera shake on near-miss (reduced on mobile)
      shake = Math.max(shake, isMobile ? 3 : 6);
      o.near = true;
      // award small diamond for skillful near-miss
      try{ if (typeof addDiamonds === 'function') { addDiamonds(1); updateDiamondsUI(); floatingScores.push({ x: player.x, y: player.y - 22, value: '♦ +1', alpha: 1, vy: -0.8, style: 'bonus' }); } }catch(e){}
    }

    // COLLISION
    if (dx < hitX && dy < hitY) {
      gameOver = true;
      soundHit();
      endRun();
    }
  }

  if (gameMode === "horizontal") {
    obstacles = obstacles.filter(o => o.x + o.width > 0);
  } else {
    obstacles = obstacles.filter(o => o.y - o.height < canvas.height);
  }
}

function draw() {
  // Clear canvas first
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Background: use tiled image if available, otherwise procedural fallback
  // zone-based background override
  const zone = getCurrentZone();
  const zoneBg = zone && backgrounds[zone.name];
  if (zoneBg && zoneBg.complete && zoneBg.naturalWidth) {
    try{
      // draw zone background as a vertically looping image to avoid seams
      const w = canvas.width;
      const h = canvas.height;
      const intOffset = Math.floor(bgY % h);
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      // draw two copies offset by canvas height so the image loops seamlessly
      ctx.drawImage(zoneBg, 0, intOffset - h, w, h);
      ctx.drawImage(zoneBg, 0, intOffset, w, h);
      ctx.restore();
    }catch(e){}
  } else if (bgImage && bgImage.complete && bgImage.naturalWidth) {
    // advance offset based on speed (smaller on low perf/mobile)
    const factor = lowPerfMode ? bgScrollFactor * 0.25 : (isMobile ? bgScrollFactor * 0.6 : bgScrollFactor);

    // Auto-compatible tiling: repeat along the long axis so a single image works
    try{
      if (bgPattern) {
        // use pattern fill and translate for seamless scrolling
        if (canvas.width >= canvas.height) {
          // landscape: scroll horizontally
          const intOffset = Math.floor(bgOffset % bgTileW);
          bgOffset = (bgOffset + gameSpeed * factor) % bgTileW;
          ctx.save();
          ctx.imageSmoothingEnabled = false;
          ctx.translate(-intOffset, 0);
          ctx.fillStyle = bgPattern;
          ctx.fillRect(0, 0, canvas.width + bgTileW, canvas.height);
          ctx.restore();
        } else {
          // portrait: scroll vertically using bgY updated in update()
          const intOffset = Math.floor(bgY % bgTileH);
          ctx.save();
          ctx.imageSmoothingEnabled = false;
          ctx.translate(0, -intOffset);
          ctx.fillStyle = bgPattern;
          ctx.fillRect(0, 0, canvas.width, canvas.height + bgTileH);
          ctx.restore();
        }
      } else {
        // fallback to direct drawing if pattern generation failed
        if (canvas.width >= canvas.height) {
          const scale = canvas.height / bgImage.height;
          const tileW = Math.max(1, Math.round(bgImage.width * scale));
          const tileH = canvas.height;
          bgOffset = (bgOffset + gameSpeed * factor) % tileW;
          const intOffset = Math.floor(bgOffset);
          for (let x = -tileW - intOffset; x < canvas.width + tileW; x += tileW) {
            ctx.drawImage(bgImage, Math.floor(x), 0, tileW + 1, tileH + 1);
          }
        } else {
        const scale = canvas.width / bgImage.width;
        const tileW = canvas.width;
        const tileH = Math.max(1, Math.round(bgImage.height * scale));
        const intOffset = Math.floor(bgY % tileH);
        for (let y = -tileH - intOffset; y < canvas.height + tileH; y += tileH) {
          ctx.drawImage(bgImage, 0, Math.floor(y), tileW + 1, tileH + 1);
        }
      }
      }
    }catch(e){
      // fallback to procedural if drawImage fails
      drawNightStars();
      drawHorizon();
      drawMountains();
    }
  } else {
    drawNightStars();
    drawHorizon();
    drawMountains();
  }

  // Motion blur / trail en fonction de la vitesse
  let blur = Math.min(gameSpeed * 0.015, 0.15);
  ctx.fillStyle = "rgba(10,0,20," + blur + ")";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Pulse Storm visual
  if (pulseStorm) {
    ctx.fillStyle = "rgba(155,108,255,0.08)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "#c77dff";
    ctx.font = isMobile ? '28px Arial' : '48px Arial';
    ctx.textAlign = "center";
    ctx.shadowColor = "#9b6cff";
    ctx.shadowBlur = 25;

    ctx.fillText(
      "PULSE STORM",
      canvas.width / 2,
      canvas.height * 0.25
    );

    ctx.shadowBlur = 0;
  }

  // Draw spawn warnings (mobile)
  if (spawnWarnings.length > 0) {
    for (let w of spawnWarnings) {
      ctx.save();
      const alpha = Math.max(0, w.life / WARNING_DURATION);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = "#ff66ff";
      ctx.shadowColor = "#ff66ff";
      ctx.shadowBlur = 12 * alpha;
      ctx.beginPath();
      ctx.arc(w.x, w.y, 10 + (1 - alpha) * 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      w.life--;
    }
    spawnWarnings = spawnWarnings.filter(w => w.life > 0);
  }

  // Flash visuel perfect
  if (perfectFlash > 0) {
    ctx.fillStyle = "rgba(155,108,255,0.12)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    perfectFlash--;
  }

  // UI font sizes (responsive)
  const uiSmall = isMobile ? '18px Arial' : '20px Arial';
  const uiScoreFont = isMobile ? '24px Arial' : '30px Arial';
  const uiComboFont = isMobile ? '20px Arial' : '28px Arial';
  const floatingPerfectFont = isMobile ? 'bold 18px Arial' : 'bold 22px Arial';
  const floatingNormalFont = isMobile ? 'bold 16px Arial' : 'bold 20px Arial';
  const pulseShiftFont = isMobile ? '48px Arial' : '60px Arial';
  const pulseStormFont = isMobile ? '28px Arial' : '48px Arial';

  // Flash near miss
  if (nearMissFlash > 0) {
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    nearMissFlash--;
  }

  // Affiche les scores flottants (styled)
  for (let fs of floatingScores) {
    ctx.save();
    ctx.globalAlpha = fs.alpha;
    if (fs.style === "perfect") {
      ctx.fillStyle = "#fff";
      ctx.shadowColor = "#c77dff";
      ctx.shadowBlur = 18;
      ctx.font = floatingPerfectFont;
    } else if (fs.style === 'zone') {
      ctx.fillStyle = "#fff";
      ctx.shadowColor = "#88f";
      ctx.shadowBlur = 20;
      ctx.font = isMobile ? 'bold 36px Arial' : 'bold 48px Arial';
    } else {
      ctx.fillStyle = "#c77dff";
      ctx.shadowColor = "#9b6cff";
      ctx.shadowBlur = 15;
      ctx.font = floatingNormalFont;
    }
    ctx.textAlign = "center";
    ctx.fillText(fs.value, fs.x, fs.y);
    ctx.shadowBlur = 0;
    ctx.restore();
  }

  // Update floating scores
  for (let fs of floatingScores) {
    fs.y += fs.vy;
    fs.alpha -= 0.03;
  }
  floatingScores = floatingScores.filter(fs => fs.alpha > 0);

  // camera jitter (shake) and apply camera transform (center -> scale -> translate)
  let jitterX = 0;
  let jitterY = 0;
  if (shake > 0) {
    // orient shake along active axis: in vertical mode prefer vertical shake
    if (gameMode === 'vertical'){
      jitterX = 0;
      jitterY = (Math.random() - 0.5) * shake;
    } else {
      jitterX = (Math.random() - 0.5) * shake;
      jitterY = (Math.random() - 0.5) * shake;
    }
    shake--;
  }

  // apply transform: simple camera in vertical mode, centered+zoom in horizontal
  if (gameMode === 'vertical'){
    ctx.save();
    ctx.translate(-Math.floor(camera.x), -Math.floor(camera.y));
  } else {
    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.scale(camera.zoom, camera.zoom);
    ctx.translate(-canvas.width / 2 - (camera.x + jitterX), -canvas.height / 2 - (camera.y + jitterY));
  }

  let glow = 8 + Math.sin(pulse) * 6 + gameSpeed * 0.6;
  // Atténue les effets sur mobile pour performance et lisibilité
  if (isMobile) glow *= 0.6;
  // Rails + mode shift overlay (prettier transition)
  const ms = Math.max(0, Math.min(1, modeShiftTimer / 56));
  if (ms > 0) {
    // soft purple wash centered, subtle
    ctx.save();
    ctx.fillStyle = `rgba(199,127,255,${0.08 * ms})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
  }

  // Rails colors - slightly brighten during shift
  if (slowTimer > 0) {
    ctx.strokeStyle = ms > 0 ? '#8fe8ff' : '#4cc9f0';
    ctx.shadowColor = ms > 0 ? '#b3fff7' : '#4cc9f0';
  } else {
    ctx.strokeStyle = ms > 0 ? '#ffb3ff' : '#6b3cff';
    ctx.shadowColor = ms > 0 ? '#ffd6ff' : '#9b6cff';
  }
  ctx.lineWidth = Math.max(1, isMobile ? 1.5 : (2 + ms * 1.2));
  if (gameSpeed > 10 && !isMobile) {
    ctx.shadowBlur = glow + 15 + ms * 18;
  } else {
    ctx.shadowBlur = glow + ms * 12;
  }

if (gameMode === "horizontal") {
  for (let lane of lanes) {
    ctx.beginPath();
    ctx.moveTo(0, lane);
    ctx.lineTo(canvas.width, lane);
    ctx.stroke();
  }
}

if (gameMode === "vertical") {
  for (let lane of verticalLanes) {
    ctx.beginPath();
    ctx.moveTo(lane, 0);
    ctx.lineTo(lane, canvas.height);
    ctx.stroke();
  }
}

ctx.shadowBlur = 0;

  // Bonus
  for (let b of bonuses) {
    b.draw(ctx);
  }

  // Obstacles + Player
  if (!gameOver) {
    for (let o of obstacles) {
      o.draw(ctx);
    }

    player.draw(ctx);
  }

  ctx.restore();

  // draw particles above player/obstacles
  drawParticles();

  // UI
  ctx.fillStyle = "#9b6cff";
  ctx.font = uiSmall;
  ctx.textAlign = "center";
  ctx.fillText(
    "MODE : " + gameMode.toUpperCase(),
    canvas.width / 2,
    40
  );

  ctx.fillStyle = "white";
  ctx.font = uiScoreFont;
  ctx.textAlign = "left";
  ctx.fillText("Score : " + Math.floor(score), 20, 40);
  ctx.fillText("Speed : " + gameSpeed.toFixed(1), 20, 80);
  ctx.fillText("Distance : " + Math.floor(distance) + " m", 20, 120);

  // Affiche best score et runs (depuis le profil moteur si disponible)
  const runnerProfile = getRunnerProfile();
  ctx.fillStyle = "white";
  ctx.font = uiScoreFont;
  ctx.textAlign = "left";
  ctx.fillText(
    "BEST : " + (runnerProfile ? (runnerProfile.bestScore || 0) : 0),
    canvas.width - 240,
    40
  );

  ctx.fillText(
    "RUNS : " + (runnerProfile ? (runnerProfile.runs || 0) : 0),
    canvas.width - 240,
    80
  );

  // If engine profile is missing, show a small dev warning (engine-only mode)
  if (!runnerProfile) {
    ctx.save();
    const warnFont = isMobile ? '12px Arial' : '14px Arial';
    const pad = 12;
    const w = 230;
    const h = 28;
    const x = canvas.width - w - pad;
    const y = 12;
    ctx.fillStyle = 'rgba(255,60,60,0.12)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = 'rgba(255,60,60,0.28)';
    ctx.strokeRect(x, y, w, h);
    ctx.fillStyle = '#ffb3b3';
    ctx.font = warnFont;
    ctx.textAlign = 'center';
    ctx.fillText('Profil moteur introuvable', x + w / 2, y + h - 8);
    ctx.restore();
  }

  // Affiche combo si actif
  if (combo > 0) {
    ctx.fillStyle = "#c77dff";
    ctx.shadowColor = "#9b6cff";
    ctx.shadowBlur = 15;
    ctx.font = uiComboFont;
    ctx.textAlign = "left";

    ctx.fillText("COMBO x" + combo, 20, 160);

    ctx.shadowBlur = 0;
  }

  // Flash Pulse Shift
  if (pulseFlash > 0) {
    ctx.fillStyle = "rgba(155,108,255,0.2)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "#9b6cff";
    ctx.font = pulseShiftFont;
    ctx.textAlign = "center";
    ctx.fillText(
      "PULSE SHIFT",
      canvas.width / 2,
      canvas.height / 2
    );

    pulseFlash--;
  }

  // MODE SHIFT display
  if (modeShiftTimer > 0) {
    ctx.fillStyle = "#c77dff";
    ctx.font = isMobile ? '28px Arial' : '42px Arial';
    ctx.textAlign = "center";
    ctx.shadowColor = "#9b6cff";
    ctx.shadowBlur = 30;
    ctx.fillText("⚡ MODE SHIFT", canvas.width / 2, canvas.height * 0.18);
    ctx.shadowBlur = 0;
    modeShiftTimer--;
  }

  // Level up visual
  if (levelUpTimer > 0) {
    const t = levelUpTimer / 140;
    ctx.save();
    ctx.globalAlpha = Math.min(1, t * 1.2);
    ctx.fillStyle = "#ffd6ff";
    ctx.font = isMobile ? '34px Arial' : '52px Arial';
    ctx.textAlign = 'center';
    ctx.shadowColor = '#c77dff';
    ctx.shadowBlur = 30 * (t);
    ctx.fillText('✨ LEVEL UP ✨', canvas.width/2, canvas.height*0.45);
    ctx.shadowBlur = 0;
    ctx.restore();
    levelUpTimer--;
  }

  // Game Over
  if (gameOver) {
    // Responsive Game Over text sizing
    const gameOverSize = Math.max(28, Math.min(Math.floor(canvas.width * 0.08), 120));
    const instrSize = Math.max(14, Math.min(Math.floor(canvas.width * 0.035), 40));
    const yCenter = canvas.height * 0.5;

    ctx.fillStyle = "white";
    ctx.font = gameOverSize + "px Arial";
    ctx.textAlign = "center";
    ctx.shadowColor = "#9b6cff";
    ctx.shadowBlur = Math.min(25, gameOverSize * 0.35);
    ctx.fillText("GAME OVER", canvas.width / 2, yCenter);
    ctx.shadowBlur = 0;

    ctx.font = instrSize + "px Arial";
    const restartText = isMobile ? "Tap to restart" : "Press SPACE to restart";
    ctx.fillText(restartText, canvas.width / 2, yCenter + gameOverSize * 0.9);
  }

  // advance simple background frame counter
  frame++;

  // draw last console errors (dev overlay)
  try{
    if (consoleErrors.length > 0) {
      const show = consoleErrors.slice(-2);
      const pad = 8;
      const w = 420;
      let y = canvas.height - (show.length * 28) - 20;
      ctx.save();
      ctx.font = isMobile ? '12px Arial' : '14px Arial';
      for (let i = 0; i < show.length; i++){
        const e = show[i];
        const text = (e.message || 'Error') + (e.source ? (' — ' + (e.source.split('/').pop() || e.source) + (e.lineno?':' + e.lineno:'')) : '');
        ctx.fillStyle = 'rgba(30,10,10,0.7)';
        ctx.fillRect(10, y - 6, w, 24);
        ctx.fillStyle = '#ffb3b3';
        ctx.fillText(text, 14, y + 12);
        y += 28;
      }
      ctx.restore();
    }
  }catch(e){}

}
function gameLoop() {
  update();
  draw();

  if (!gameOver) {
    requestAnimationFrame(gameLoop);
  }
}

