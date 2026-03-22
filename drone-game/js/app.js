/* ============================================================
   🚁 드론 탐험대 — 메인 앱
   Vanilla JS / HTML5 Canvas / Google Gemini API
   ============================================================ */

'use strict';

/* ── 전역 상태 객체 ── */
const state = {
  apiKey: '',
  location: '',
  bgImageSrc: null,   // 생성된 배경 이미지 (data URL)
  bgImage: null,      // Image 객체
  uploadedFile: null, // 업로드된 파일

  // 게임 상태
  score: 0,
  lives: 3,
  elapsed: 0,         // 초
  running: false,
  phase: 'ready',     // 'ready' | 'playing' | 'gameover'

  // 입력
  keys: { up: false, down: false, left: false, right: false },

  // 드론
  drone: null,

  // 장애물 & 코인
  obstacles: [],
  coins: [],

  // 배경 스크롤
  bgX: 0,
  bgSpeed: 60,        // px/s

  // 타이머
  lastTime: 0,
  spawnTimer: 0,
  coinSpawnTimer: 0,
  spawnInterval: 2.2,  // 초
  minSpawnInterval: 0.8,
};

/* ── Gemini API 스타일 매핑 ── */
const STYLE_MAP = {
  pixel:      'pixel art game background, 16-bit retro style, vibrant colors, no UI elements',
  anime:      'cartoon game background, colorful anime style, cel-shaded, bright',
  fantasy:    'fantasy game background, magical glowing atmosphere, ethereal light, mystical',
  cyberpunk:  'sci-fi game background, futuristic neon cyberpunk, glowing signs, dark city',
  watercolor: 'watercolor game background, soft pastel illustration, gentle brush strokes',
};

/* ── 화면 전환 ── */
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const el = document.getElementById(id);
  if (el) el.classList.add('active');
}

/* ── 에러 표시/숨기기 ── */
function showError(elId, msg) {
  const el = document.getElementById(elId);
  if (!el) return;
  el.textContent = msg;
  el.classList.remove('hidden');
}

function hideError(elId) {
  const el = document.getElementById(elId);
  if (el) el.classList.add('hidden');
}

/* ============================================================
   Screen 1 — API 키 설정
   ============================================================ */
function initSetupScreen() {
  const apiKeyInput  = document.getElementById('api-key-input');
  const locationInput = document.getElementById('location-input');
  const toggleEye    = document.getElementById('toggle-eye');
  const btnNext      = document.getElementById('btn-next-setup');

  // localStorage 복원
  const savedKey = localStorage.getItem('drone_gemini_key') || '';
  const savedLoc = localStorage.getItem('drone_location') || '';
  apiKeyInput.value  = savedKey;
  locationInput.value = savedLoc;

  // 눈 아이콘 토글
  toggleEye.addEventListener('click', () => {
    const isPass = apiKeyInput.type === 'password';
    apiKeyInput.type = isPass ? 'text' : 'password';
    toggleEye.textContent = isPass ? '🙈' : '👁️';
  });

  // 다음으로
  btnNext.addEventListener('click', () => {
    const key = apiKeyInput.value.trim();
    const loc = locationInput.value.trim();

    if (key.length < 20) {
      showError('setup-error', '⚠️ API 키가 너무 짧습니다 (20자 이상 입력해주세요)');
      return;
    }
    hideError('setup-error');

    state.apiKey   = key;
    state.location = loc;
    localStorage.setItem('drone_gemini_key', key);
    localStorage.setItem('drone_location', loc);

    showScreen('screen-generate');
  });
}

/* ============================================================
   Screen 2 — 이미지 생성
   ============================================================ */
function initGenerateScreen() {
  const uploadZone    = document.getElementById('upload-zone');
  const uploadInner   = document.getElementById('upload-inner');
  const fileInput     = document.getElementById('file-input');
  const uploadPreview = document.getElementById('upload-preview');
  const btnRemove     = document.getElementById('btn-remove-img');
  const btnGenerate   = document.getElementById('btn-generate');
  const btnSkip       = document.getElementById('btn-skip-gen');
  const btnBack       = document.getElementById('btn-back-setup');
  const btnStart      = document.getElementById('btn-start-game');
  const resultImg     = document.getElementById('result-img');
  const resultPlaceholder = document.getElementById('result-placeholder');

  // 뒤로
  btnBack.addEventListener('click', () => showScreen('screen-setup'));

  // 업로드 클릭
  uploadZone.addEventListener('click', () => {
    if (!state.uploadedFile) fileInput.click();
  });

  fileInput.addEventListener('change', () => {
    if (fileInput.files[0]) handleFile(fileInput.files[0]);
  });

  // 드래그앤드롭
  uploadZone.addEventListener('dragover', e => {
    e.preventDefault();
    uploadZone.classList.add('drag-over');
  });
  uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('drag-over'));
  uploadZone.addEventListener('drop', e => {
    e.preventDefault();
    uploadZone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file && /image\/(jpeg|png|webp)/.test(file.type)) handleFile(file);
    else showError('gen-error', '⚠️ JPG, PNG, WEBP 형식만 지원합니다.');
  });

  function handleFile(file) {
    state.uploadedFile = file;
    const url = URL.createObjectURL(file);
    uploadPreview.src = url;
    uploadPreview.classList.remove('hidden');
    uploadInner.style.display = 'none';
    btnRemove.style.display   = 'inline-block';
    btnGenerate.disabled = false;
    hideError('gen-error');
  }

  // 사진 제거
  btnRemove.addEventListener('click', e => {
    e.stopPropagation();
    state.uploadedFile = null;
    fileInput.value = '';
    uploadPreview.classList.add('hidden');
    uploadPreview.src = '';
    uploadInner.style.display = '';
    btnRemove.style.display = 'none';
    btnGenerate.disabled = true;
  });

  // AI 배경 만들기
  btnGenerate.addEventListener('click', async () => {
    hideError('gen-error');
    await generateBackground();
  });

  // 기본 배경으로 시작
  btnSkip.addEventListener('click', () => {
    state.bgImageSrc = null;
    state.bgImage    = null;
    startGame();
  });

  // 게임 시작 (생성 완료 후)
  btnStart.addEventListener('click', () => {
    startGame();
  });

  /* Gemini API 호출 */
  async function generateBackground() {
    const style     = document.getElementById('style-select').value;
    const extra     = document.getElementById('extra-input').value.trim();
    const styleText = STYLE_MAP[style] || STYLE_MAP.pixel;

    // 프롬프트 구성
    let prompt = `Convert this drone photo into a seamless ${styleText}. `;
    if (state.location) prompt += `The scene shows ${state.location}. `;
    if (extra)          prompt += `Mood/style extra: ${extra}. `;
    prompt += 'Make it suitable as a side-scrolling game background. Wide panoramic view, no text or UI elements.';

    // 파일을 base64로 변환
    const file = state.uploadedFile;
    const base64Data = await fileToBase64(file);
    const mimeType   = file.type;

    // 로딩 표시
    setLoading(true, 'AI가 배경을 그리고 있어요...');

    const model = 'gemini-2.0-flash-preview-image-generation';
    const url   = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${state.apiKey}`;

    const payload = {
      contents: [{
        parts: [
          { text: prompt },
          { inline_data: { mime_type: mimeType, data: base64Data } }
        ]
      }],
      generationConfig: {
        responseModalities: ['IMAGE', 'TEXT']
      }
    };

    try {
      setLoading(true, 'Gemini AI와 통신 중...');
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await resp.json();

      if (!resp.ok) {
        const errCode = data?.error?.code || resp.status;
        const errMsg  = data?.error?.message || '';
        throw { code: errCode, message: errMsg };
      }

      setLoading(true, '이미지 처리 중...');

      // 이미지 추출
      let imageSrc = null;
      const parts = data?.candidates?.[0]?.content?.parts || [];
      for (const part of parts) {
        if (part?.inline_data?.data) {
          imageSrc = `data:${part.inline_data.mime_type};base64,${part.inline_data.data}`;
          break;
        }
      }

      if (!imageSrc) throw { code: 0, message: '이미지 데이터를 받지 못했습니다.' };

      // 결과 표시
      state.bgImageSrc = imageSrc;
      resultImg.src = imageSrc;
      resultImg.classList.remove('hidden');
      resultPlaceholder.classList.add('hidden');
      btnStart.disabled = false;
      setLoading(false);

    } catch (err) {
      setLoading(false);
      const msg = apiErrorMessage(err);
      showError('gen-error', msg);
    }
  }

  function setLoading(show, text = '') {
    const overlay   = document.getElementById('loading-overlay');
    const loadText  = document.getElementById('loading-text');
    if (show) {
      loadText.textContent = text;
      overlay.classList.remove('hidden');
    } else {
      overlay.classList.add('hidden');
    }
  }

  function apiErrorMessage(err) {
    const code = err.code || 0;
    const msg  = (err.message || '').toLowerCase();
    if (code === 400 || msg.includes('api_key') || msg.includes('invalid'))
      return '⚠️ API 키가 올바르지 않습니다. 설정 화면에서 다시 확인해주세요.';
    if (code === 403)
      return '⚠️ API 키 권한이 없습니다. 키를 확인하거나 Billing을 활성화해주세요.';
    if (code === 429)
      return '⚠️ 요청 한도를 초과했습니다. 잠시 후 다시 시도해주세요.';
    return `⚠️ 오류가 발생했습니다: ${err.message || '알 수 없는 오류'}`;
  }

  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload  = () => resolve(reader.result.split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }
}

/* ============================================================
   Screen 3 — 게임 시작 진입
   ============================================================ */
function startGame() {
  showScreen('screen-game');

  // 배경 이미지 로드
  if (state.bgImageSrc) {
    const img = new Image();
    img.onload = () => {
      state.bgImage = img;
    };
    img.src = state.bgImageSrc;
  } else {
    state.bgImage = null;
  }

  initGame();
}

/* ============================================================
   게임 엔진
   ============================================================ */
const CANVAS_W = 800;
const CANVAS_H = 450;

let canvas, ctx, rafId;

/* ── 드론 객체 ── */
class Drone {
  constructor() {
    this.x  = 120;
    this.y  = CANVAS_H / 2;
    this.vx = 0;
    this.vy = 0;
    this.w  = 48;
    this.h  = 32;
    this.propAngle = 0;  // 프로펠러 회전 각도
    this.invincible    = false;
    this.invincibleTime = 0;
    this.blinkOn = true;
  }

  get hitBox() {
    return {
      x: this.x - this.w / 2 + 6,
      y: this.y - this.h / 2 + 4,
      w: this.w - 12,
      h: this.h - 8
    };
  }

  update(dt) {
    const GRAVITY    = 180;
    const THRUST     = 340;
    const SIDE_FORCE = 260;
    const DRAG       = 0.88;

    // 중력
    this.vy += GRAVITY * dt;

    // 입력
    if (state.keys.up)    this.vy -= THRUST * dt;
    if (state.keys.down)  this.vy += (THRUST * 0.5) * dt;
    if (state.keys.left)  this.vx -= SIDE_FORCE * dt;
    if (state.keys.right) this.vx += SIDE_FORCE * dt;

    // 감속 (관성)
    this.vx *= DRAG;
    this.vy *= (state.keys.up || state.keys.down) ? 0.92 : 0.88;

    // 이동
    this.x += this.vx * dt;
    this.y += this.vy * dt;

    // 경계 처리
    const hw = this.w / 2, hh = this.h / 2;
    if (this.x - hw < 0)        { this.x = hw;          this.vx = 0; }
    if (this.x + hw > CANVAS_W) { this.x = CANVAS_W - hw; this.vx = 0; }
    if (this.y - hh < 0)        { this.y = hh;          this.vy = 0; }
    if (this.y + hh > CANVAS_H) { this.y = CANVAS_H - hh; this.vy = 0; }

    // 프로펠러 회전
    this.propAngle += 12 * dt;

    // 무적 타이머
    if (this.invincible) {
      this.invincibleTime -= dt;
      this.blinkOn = Math.floor(this.invincibleTime * 10) % 2 === 0;
      if (this.invincibleTime <= 0) {
        this.invincible = false;
        this.blinkOn    = true;
      }
    }
  }

  draw(ctx) {
    if (!this.blinkOn) return;

    ctx.save();
    ctx.translate(this.x, this.y);

    const hw = this.w / 2;
    const armLen = hw + 6;
    const armY   = -2;

    // 팔 (4개)
    const armAngle = this.propAngle * 0.2; // 살짝 흔들림
    const arms = [
      [-armLen, armY - 4],
      [ armLen, armY - 4],
      [-armLen, armY + 4],
      [ armLen, armY + 4],
    ];

    ctx.strokeStyle = '#555';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    arms.forEach(([ax, ay]) => {
      ctx.beginPath();
      ctx.moveTo(0, armY);
      ctx.lineTo(ax, ay);
      ctx.stroke();
    });

    // 프로펠러
    ctx.save();
    ctx.strokeStyle = 'rgba(100,180,255,0.85)';
    ctx.lineWidth = 2.5;
    arms.forEach(([ax, ay]) => {
      ctx.save();
      ctx.translate(ax, ay);
      ctx.rotate(this.propAngle);
      ctx.beginPath();
      ctx.moveTo(-10, 0); ctx.lineTo(10, 0);
      ctx.stroke();
      ctx.rotate(Math.PI / 2);
      ctx.beginPath();
      ctx.moveTo(-10, 0); ctx.lineTo(10, 0);
      ctx.stroke();
      ctx.restore();
    });
    ctx.restore();

    // 몸체
    ctx.beginPath();
    ctx.roundRect(-hw + 4, -8, this.w - 8, 16, 6);
    ctx.fillStyle = '#2c3e50';
    ctx.fill();

    // 몸체 하이라이트
    ctx.beginPath();
    ctx.roundRect(-hw + 6, -6, this.w - 20, 5, 3);
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fill();

    // 카메라 렌즈
    ctx.beginPath();
    ctx.arc(0, 8, 7, 0, Math.PI * 2);
    ctx.fillStyle = '#1a1a2e';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0, 8, 4.5, 0, Math.PI * 2);
    ctx.fillStyle = '#2980b9';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(-1.5, 6, 1.5, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.fill();

    // LED 표시등
    ctx.beginPath();
    ctx.arc(-hw + 8, 0, 3, 0, Math.PI * 2);
    ctx.fillStyle = '#e74c3c';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(hw - 8, 0, 3, 0, Math.PI * 2);
    ctx.fillStyle = '#2ecc71';
    ctx.fill();

    ctx.restore();
  }

  hit() {
    if (this.invincible) return false;
    state.lives--;
    this.invincible     = true;
    this.invincibleTime = 1.5;
    updateHUD();
    return true;
  }
}

/* ── 장애물 ── */
const OBSTACLE_TYPES = [
  { emoji: '🏔️', label: '산',    w: 55, h: 55, speed: 1.0 },
  { emoji: '🦅', label: '새',    w: 42, h: 42, speed: 1.4 },
  { emoji: '🏢', label: '빌딩', w: 50, h: 80, speed: 0.85 },
  { emoji: '⛈️', label: '먹구름', w: 65, h: 48, speed: 0.95 },
];

class Obstacle {
  constructor() {
    const type = OBSTACLE_TYPES[Math.floor(Math.random() * OBSTACLE_TYPES.length)];
    Object.assign(this, type);
    this.x = CANVAS_W + this.w;
    this.y = randomRange(this.h / 2 + 20, CANVAS_H - this.h / 2 - 20);
    // 새는 위아래 흔들림
    this.wobble      = type.label === '새';
    this.wobblePhase = Math.random() * Math.PI * 2;
    this.wobbleAmp   = 30;
    this.baseY       = this.y;
  }

  update(dt, bgSpeed) {
    this.x -= bgSpeed * this.speed * dt;
    if (this.wobble) {
      this.wobblePhase += 2.5 * dt;
      this.y = this.baseY + Math.sin(this.wobblePhase) * this.wobbleAmp;
    }
  }

  get hitBox() {
    const pad = 8;
    return {
      x: this.x - this.w / 2 + pad,
      y: this.y - this.h / 2 + pad,
      w: this.w - pad * 2,
      h: this.h - pad * 2
    };
  }

  draw(ctx) {
    ctx.font = `${this.h}px serif`;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.emoji, this.x, this.y);
  }
}

/* ── 코인 ── */
class Coin {
  constructor() {
    this.x       = CANVAS_W + 20;
    this.y       = randomRange(40, CANVAS_H - 40);
    this.r       = 14;
    this.baseY   = this.y;
    this.phase   = Math.random() * Math.PI * 2;
    this.glowT   = 0;
    this.collected = false;
  }

  update(dt, bgSpeed) {
    this.x -= bgSpeed * dt;
    this.phase += 3 * dt;
    this.y = this.baseY + Math.sin(this.phase) * 8;
    this.glowT += dt;
  }

  get hitBox() {
    return { x: this.x - this.r, y: this.y - this.r, w: this.r * 2, h: this.r * 2 };
  }

  draw(ctx) {
    // Glow
    const glow = Math.abs(Math.sin(this.glowT * 2));
    ctx.save();
    ctx.shadowColor = `rgba(255, 215, 0, ${0.5 + glow * 0.5})`;
    ctx.shadowBlur  = 12 + glow * 10;

    ctx.font = '28px serif';
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('💰', this.x, this.y);

    ctx.restore();
  }
}

/* ── 기본 배경 드로잉 (이미지 없을 때) ── */
function drawDefaultBg(ctx, bgX) {
  // 하늘 그라데이션
  const skyGrad = ctx.createLinearGradient(0, 0, 0, CANVAS_H * 0.7);
  skyGrad.addColorStop(0, '#87CEEB');
  skyGrad.addColorStop(1, '#c9e8f5');
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  // 땅
  const groundY = CANVAS_H * 0.75;
  const groundGrad = ctx.createLinearGradient(0, groundY, 0, CANVAS_H);
  groundGrad.addColorStop(0, '#4caf50');
  groundGrad.addColorStop(1, '#2e7d32');
  ctx.fillStyle = groundGrad;
  ctx.fillRect(0, groundY, CANVAS_W, CANVAS_H - groundY);

  // 구름 (bgX 기반으로 스크롤)
  const clouds = [
    { x: 100, y: 60, r: 30 },
    { x: 350, y: 40, r: 22 },
    { x: 550, y: 80, r: 28 },
    { x: 750, y: 50, r: 20 },
    { x: 950, y: 70, r: 26 },
  ];

  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  clouds.forEach(c => {
    const cx = ((c.x - bgX * 0.4) % (CANVAS_W + 200) + CANVAS_W + 200) % (CANVAS_W + 200) - 100;
    drawCloud(ctx, cx, c.y, c.r);
  });
}

function drawCloud(ctx, x, y, r) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.arc(x + r * 0.9, y - r * 0.3, r * 0.75, 0, Math.PI * 2);
  ctx.arc(x + r * 1.7, y, r * 0.6, 0, Math.PI * 2);
  ctx.fill();
}

/* ── 이미지 배경 드로잉 (무한 스크롤) ── */
function drawImageBg(ctx, img, bgX) {
  const iw = img.width || CANVAS_W;
  const ih = img.height || CANVAS_H;

  // Canvas 비율에 맞게 이미지 높이 조정
  const scale = CANVAS_H / ih;
  const sw    = iw * scale;

  // bgX로 스크롤 위치 계산 (무한 반복)
  const offset = bgX % sw;

  // 두 장을 붙여서 이음새 없이 스크롤
  ctx.drawImage(img, -offset, 0, sw, CANVAS_H);
  ctx.drawImage(img, sw - offset, 0, sw, CANVAS_H);
}

/* ── HUD 업데이트 ── */
function updateHUD() {
  document.getElementById('hud-score').textContent = state.score;
  const hearts = '❤️'.repeat(Math.max(0, state.lives));
  document.getElementById('hud-lives').textContent = hearts || '💔';
  const m = Math.floor(state.elapsed / 60).toString().padStart(2, '0');
  const s = Math.floor(state.elapsed % 60).toString().padStart(2, '0');
  document.getElementById('hud-time').textContent = `${m}:${s}`;
}

/* ── AABB 충돌 판정 ── */
function aabbCollide(a, b) {
  return (
    a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.y < b.y + b.h &&
    a.y + a.h > b.y
  );
}

/* ── 랜덤 유틸 ── */
function randomRange(min, max) {
  return Math.random() * (max - min) + min;
}

/* ── 게임 초기화 ── */
function initGame() {
  canvas = document.getElementById('game-canvas');
  ctx    = canvas.getContext('2d');

  // 상태 리셋
  Object.assign(state, {
    score: 0, lives: 3, elapsed: 0,
    running: false, phase: 'ready',
    keys: { up: false, down: false, left: false, right: false },
    drone: new Drone(),
    obstacles: [], coins: [],
    bgX: 0, bgSpeed: 60,
    lastTime: 0, spawnTimer: 0, coinSpawnTimer: 0,
    spawnInterval: 2.2,
  });

  // 이전 RAF 취소
  if (rafId) cancelAnimationFrame(rafId);

  updateHUD();
  scaleCanvas();

  // Ready 오버레이 표시
  document.getElementById('overlay-ready').classList.remove('hidden');
  document.getElementById('overlay-gameover').classList.add('hidden');

  // 탐험 시작 버튼
  document.getElementById('btn-ready-start').onclick = () => {
    document.getElementById('overlay-ready').classList.add('hidden');
    state.phase   = 'playing';
    state.running = true;
    state.lastTime = performance.now();
    rafId = requestAnimationFrame(gameLoop);
  };

  // 다시 시작
  document.getElementById('btn-restart').onclick = () => {
    initGame();
  };

  // 메뉴로
  document.getElementById('btn-to-menu').onclick = () => {
    state.running = false;
    if (rafId) cancelAnimationFrame(rafId);
    showScreen('screen-generate');
  };

  // HUD 뒤로
  document.getElementById('btn-back-gen').onclick = () => {
    state.running = false;
    if (rafId) cancelAnimationFrame(rafId);
    showScreen('screen-generate');
  };

  // 첫 프레임 렌더 (정지 상태)
  renderFrame(0);
}

/* ── Canvas 크기 조정 ── */
function scaleCanvas() {
  const wrap = document.getElementById('canvas-wrap');
  const ww   = wrap.clientWidth;
  const wh   = wrap.clientHeight;
  const scale = Math.min(ww / CANVAS_W, wh / CANVAS_H);
  canvas.style.width  = `${CANVAS_W * scale}px`;
  canvas.style.height = `${CANVAS_H * scale}px`;
}

window.addEventListener('resize', scaleCanvas);

/* ── 게임 루프 ── */
function gameLoop(timestamp) {
  if (!state.running) return;

  const dt = Math.min((timestamp - state.lastTime) / 1000, 0.05); // 최대 50ms
  state.lastTime = timestamp;

  update(dt);
  renderFrame(dt);

  rafId = requestAnimationFrame(gameLoop);
}

/* ── 업데이트 ── */
function update(dt) {
  if (state.phase !== 'playing') return;

  // 경과 시간 & HUD
  state.elapsed += dt;
  updateHUD();

  // 배경 속도 점진 증가
  state.bgSpeed = 60 + state.elapsed * 1.5;

  // 배경 스크롤
  state.bgX += state.bgSpeed * dt;

  // spawn 간격 단축
  state.spawnInterval = Math.max(state.minSpawnInterval, 2.2 - state.elapsed * 0.015);

  // 드론 업데이트
  state.drone.update(dt);

  // 장애물 spawn
  state.spawnTimer += dt;
  if (state.spawnTimer >= state.spawnInterval) {
    state.obstacles.push(new Obstacle());
    state.spawnTimer = 0;
  }

  // 코인 spawn (1.5~3초 간격)
  state.coinSpawnTimer += dt;
  const coinInterval = randomRange(1.5, 3.0);
  if (state.coinSpawnTimer >= coinInterval) {
    state.coins.push(new Coin());
    state.coinSpawnTimer = 0;
  }

  // 장애물 업데이트 & 충돌
  state.obstacles = state.obstacles.filter(ob => {
    ob.update(dt, state.bgSpeed);
    if (ob.x + ob.w / 2 < -20) return false;

    // 충돌
    if (aabbCollide(state.drone.hitBox, ob.hitBox)) {
      if (state.drone.hit()) {
        if (state.lives <= 0) {
          gameOver();
          return false;
        }
      }
    }
    return true;
  });

  // 코인 업데이트 & 수집
  state.coins = state.coins.filter(coin => {
    coin.update(dt, state.bgSpeed);
    if (coin.x + coin.r < -20) return false;
    if (aabbCollide(state.drone.hitBox, coin.hitBox)) {
      state.score += 10;
      updateHUD();
      return false;
    }
    return true;
  });
}

/* ── 렌더 ── */
function renderFrame(dt) {
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

  // 배경
  if (state.bgImage) {
    drawImageBg(ctx, state.bgImage, state.bgX);
  } else {
    drawDefaultBg(ctx, state.bgX);
  }

  // 코인
  state.coins.forEach(c => c.draw(ctx));

  // 장애물
  state.obstacles.forEach(o => o.draw(ctx));

  // 드론
  if (state.drone) state.drone.draw(ctx);
}

/* ── 게임 오버 ── */
function gameOver() {
  state.running = false;
  state.phase   = 'gameover';

  const score = state.score;
  let grade;
  if (score >= 200) grade = '🏆';
  else if (score >= 100) grade = '🥇';
  else if (score >= 50)  grade = '🥈';
  else                   grade = '🌟';

  document.getElementById('grade-badge').textContent = grade;
  document.getElementById('final-score').textContent  = score;
  document.getElementById('overlay-gameover').classList.remove('hidden');
}

/* ============================================================
   키보드 입력
   ============================================================ */
const KEY_MAP = {
  ArrowUp: 'up', KeyW: 'up', ArrowW: 'up',
  ArrowDown: 'down', KeyS: 'down',
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
};

document.addEventListener('keydown', e => {
  const dir = KEY_MAP[e.code];
  if (dir) { state.keys[dir] = true; e.preventDefault(); }
});

document.addEventListener('keyup', e => {
  const dir = KEY_MAP[e.code];
  if (dir) state.keys[dir] = false;
});

/* ============================================================
   모바일 D-pad
   ============================================================ */
function initDpad() {
  const btns = {
    'dpad-up':    'up',
    'dpad-down':  'down',
    'dpad-left':  'left',
    'dpad-right': 'right',
  };

  Object.entries(btns).forEach(([id, dir]) => {
    const btn = document.getElementById(id);
    if (!btn) return;

    btn.addEventListener('pointerdown', e => {
      e.preventDefault();
      state.keys[dir] = true;
      btn.classList.add('pressed');
    });

    const release = e => {
      e.preventDefault();
      state.keys[dir] = false;
      btn.classList.remove('pressed');
    };

    btn.addEventListener('pointerup',     release);
    btn.addEventListener('pointercancel', release);
    btn.addEventListener('pointerleave',  release);
  });
}

/* ============================================================
   앱 부트스트랩
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
  initSetupScreen();
  initGenerateScreen();
  initDpad();

  // 초기 화면
  showScreen('screen-setup');
});
