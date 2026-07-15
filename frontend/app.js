/**
 * VehicleScan Terminal — app.js
 * Frontend logic: Matrix rain, API call, token verification.
 */

'use strict';

/* ================================================================
   1. MATRIX RAIN — WebGL Shader
   ================================================================ */
(function initMatrixRain() {
  const canvas = document.getElementById('matrix-canvas');
  if (!canvas) return;

  function syncSize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    if (canvas.width !== w)  canvas.width  = w;
    if (canvas.height !== h) canvas.height = h;
  }
  window.addEventListener('resize', syncSize);
  syncSize();

  const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
  if (!gl) return;

  const vs = [
    'attribute vec2 a;',
    'varying vec2 v;',
    'void main() { v = a * 0.5 + 0.5; gl_Position = vec4(a, 0.0, 1.0); }',
  ].join('');

  const fs = [
    'precision highp float;',
    'varying vec2 v;',
    'uniform float t;',
    'uniform vec2 r;',
    'float rnd(vec2 s) { return fract(sin(dot(s, vec2(12.9898, 78.233))) * 43758.5453); }',
    'void main() {',
    '  float cols = 50.0;',
    '  vec2 g = floor(v * vec2(cols, cols * r.y / r.x));',
    '  float sp  = 0.4 + rnd(vec2(g.x, 0.0)) * 0.6;',
    '  float yo  = rnd(vec2(g.x, 7.3)) * 100.0;',
    '  float y   = fract(v.y + t * sp + yo);',
    '  float b   = step(0.88, rnd(g + floor(t * 12.0))) * pow(1.0 - y, 2.5);',
    '  vec3 col  = vec3(0.0, 1.0, 0.25) * b + vec3(0.0, 0.04, 0.008);',
    '  gl_FragColor = vec4(col, 1.0);',
    '}',
  ].join('');

  function compileShader(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    return s;
  }

  const prog = gl.createProgram();
  gl.attachShader(prog, compileShader(gl.VERTEX_SHADER, vs));
  gl.attachShader(prog, compileShader(gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(prog);
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);

  const aPos = gl.getAttribLocation(prog, 'a');
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  const uTime = gl.getUniformLocation(prog, 't');
  const uRes  = gl.getUniformLocation(prog, 'r');

  function frame(timestamp) {
    syncSize();
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform1f(uTime, timestamp * 0.001);
    gl.uniform2f(uRes, canvas.width, canvas.height);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();


/* ================================================================
   2. UTILITIES
   ================================================================ */
const $ = (id) => document.getElementById(id);

function esc(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;')
    .replace(/'/g,  '&#039;');
}

function fmt(val) {
  const v = val == null ? '' : String(val).trim();
  if (!v || v === 'NA' || v === 'null' || v === 'false' || v === 'N/A') {
    return '&#8212;';
  }
  return esc(v);
}

function setStatus(msg) { $('statusText').textContent = msg; }


/* ================================================================
   3. TOKEN MANAGEMENT
   ================================================================ */
function initTokenFlow() {
  const params = new URLSearchParams(window.location.search);
  const urlToken = params.get('token');
  
  if (urlToken) {
    localStorage.setItem('vs_token', urlToken);
    localStorage.setItem('vs_uses', '5'); // Assumed fresh token
    window.history.replaceState({}, document.title, window.location.pathname);
  }

  checkTokenState();

  $('getTokenBtn').addEventListener('click', async () => {
    $('getTokenBtn').textContent = '[ GENERATING SECURE LINK... ]';
    $('getTokenBtn').disabled = true;
    try {
      const res = await fetch('/api/generate-link');
      const data = await res.json();
      if (data.success && data.shortened_url) {
        window.location.href = data.shortened_url;
      } else {
        alert("Error: " + (data.error || "Could not generate link"));
        $('getTokenBtn').textContent = '[ GET ACCESS TOKEN (5 FREE SEARCHES) ]';
        $('getTokenBtn').disabled = false;
      }
    } catch (e) {
      alert("Network Error");
      $('getTokenBtn').textContent = '[ GET ACCESS TOKEN (5 FREE SEARCHES) ]';
      $('getTokenBtn').disabled = false;
    }
  });
}

function checkTokenState() {
  const token = localStorage.getItem('vs_token');
  if (!token) {
    $('searchBarBlock').style.display = 'none';
    $('tokenBlock').style.display = 'block';
    $('tokenStatusText').textContent = 'STATUS: UNAUTHORIZED';
    return false;
  } else {
    $('searchBarBlock').style.display = 'flex';
    $('tokenBlock').style.display = 'none';
    const uses = localStorage.getItem('vs_uses') || '?';
    $('tokenStatusText').textContent = `SEARCHES LEFT: ${uses}`;
    return token;
  }
}

/* ================================================================
   4. UI STATE MANAGEMENT
   ================================================================ */
function resetUI() {
  $('resultsGrid').style.display = 'none';
  $('resultsGrid').innerHTML     = '';
  $('errorBlock').style.display  = 'none';
  $('warningBar').style.display  = 'none';
  $('loadingBlock').style.display= 'none';
}

function showError(msg) {
  $('errorBlock').style.display = 'block';
  $('errorBlock').textContent   = '\u26a0 ' + msg;
  setStatus('STATUS: ERROR');
}

function showWarning(msg) {
  $('warningBar').style.display = 'block';
  $('warningBar').textContent   = '\u26a0 ' + msg;
}

function startLoading() {
  $('loadingBlock').style.display = 'block';
  $('scanBtn').disabled = true;

  const msgs = [
    'VERIFYING TOKEN...',
    'CONNECTING TO DATABASE...',
    'QUERYING VEHICLE RECORDS...',
    'FETCHING RC DATA...',
    'CROSS-REFERENCING CHALLAN LOG...',
    'COMPILING REPORT...',
  ];

  let i = 0;
  const interval = setInterval(() => {
    if (i < msgs.length) {
      $('loadingMsg').textContent = msgs[i++];
    } else {
      clearInterval(interval);
    }
  }, 280);

  const pf = $('progressFill');
  pf.style.animation = 'none';
  pf.getBoundingClientRect();
  pf.style.animation = '';

  return interval;
}

function stopLoading(interval) {
  clearInterval(interval);
  $('loadingBlock').style.display = 'none';
  $('scanBtn').disabled = false;
}


/* ================================================================
   5. MAIN SCAN FUNCTION
   ================================================================ */
async function runScan() {
  const token = checkTokenState();
  if (!token) return;

  const raw = ($('vehicleInput').value || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '');

  if (!raw) {
    showError('INPUT_ERROR: Please enter a vehicle registration number.');
    return;
  }
  if (raw.length < 4) {
    showError('INPUT_ERROR: Invalid format. Example: UK04AP2300');
    return;
  }

  resetUI();
  setStatus('SCANNING...');
  const loadInterval = startLoading();

  try {
    const response = await fetch('/api/scan?reg=' + encodeURIComponent(raw) + '&token=' + encodeURIComponent(token), {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
    });

    const data = await response.json();

    if (response.status === 401 || response.status === 403) {
      // Token issue
      localStorage.removeItem('vs_token');
      localStorage.removeItem('vs_uses');
      checkTokenState();
      throw new Error(data.error || 'ACCESS_DENIED: Token invalid or expired.');
    }

    if (!response.ok || !data.success) {
      throw new Error(data.error || 'DATA_ERROR: No data available for this vehicle.');
    }

    // Update uses left
    if (data.uses_left !== undefined) {
      localStorage.setItem('vs_uses', data.uses_left);
      $('tokenStatusText').textContent = `SEARCHES LEFT: ${data.uses_left}`;
      if (data.uses_left <= 0) {
        localStorage.removeItem('vs_token');
        // Let them see the current result, but next time they will be blocked
      }
    }

    if (data.warning) showWarning(data.warning);
    renderResults(data);

  } catch (err) {
    showError('SCAN_FAILED: ' + (err.message || 'Unknown error.'));
  } finally {
    stopLoading(loadInterval);
  }
}


/* ================================================================
   6. RESULT RENDERING
   ================================================================ */
function renderResults(json) {
  const d        = json.data            || {};
  const vi       = (d.vehicle_info && d.vehicle_info.data) ? d.vehicle_info.data : {};
  const ci       = d.challan_info       || {};
  const challans = Array.isArray(ci.data) ? ci.data : [];
  const rcInfo   = ci.rc_info           || {};

  const grid = $('resultsGrid');
  grid.innerHTML    = '';
  grid.style.display = 'grid';

  // Helper to color red if it's protected
  const protectedStyle = (val) => val === '[ PROTECTED BY OWNER ]' ? 'danger' : '';

  /* ── Card 1: Owner Identity ──────────────────────────────── */
  grid.appendChild(buildCard({
    icon: 'person',
    title: 'OWNER_IDENTITY',
    rows: [
      dataRow('REG_NO',    vi.reg_no || d.vnum, 'accent'),
      dataRow('OWNER',     vi.owner_name, protectedStyle(vi.owner_name)),
      dataRow('SR_NO',     vi.owner_sr_no),
      // MASKING REMOVED - Show raw mobile number unless protected by backend
      dataRow('MOBILE',    d.mobile_no || vi.mobile_no, protectedStyle(d.mobile_no || vi.mobile_no)),
      dataRow('FATHER',    vi.father_name, protectedStyle(vi.father_name)),
      dataRow('BLACKLIST', vi.blacklist_details === 'false' ? 'CLEAR' : vi.blacklist_details,
                           vi.blacklist_details === 'false' ? 'accent' : 'danger'),
    ],
  }));

  /* ── Card 2: Vehicle Specs ───────────────────────────────── */
  grid.appendChild(buildCard({
    icon: 'directions_car',
    title: 'VEHICLE_SPECS',
    rows: [
      dataRow('MAKER',      vi.maker),
      dataRow('MODEL',      vi.maker_modal || rcInfo.maker_modal),
      dataRow('BODY_TYPE',  vi.body_type),
      dataRow('VH_CLASS',   vi.vh_class),
      dataRow('FUEL',       vi.fuel_type),
      dataRow('COLOR',      vi.vehicle_color),
      dataRow('SEATS',      vi.number_of_seat),
      dataRow('CYLINDERS',  vi.no_of_cyl),
      dataRow('CUBIC_CAP',  vi.cubic_cap ? vi.cubic_cap + ' cc' : null),
      dataRow('FUEL_NORM',  vi.fuel_norms),
      tagRow ('STATUS',     vi.status || 'UNKNOWN', ['ACTIVE'], [], ['INACTIVE', 'SUSPENDED']),
    ],
  }));

  /* ── Card 3: Registration ────────────────────────────────── */
  grid.appendChild(buildCard({
    icon: 'article',
    title: 'REGISTRATION_DATA',
    rows: [
      dataRow('REG_DATE',    vi.regn_dt),
      dataRow('RTO',         vi.rto),
      dataRow('RTO_CODE',    vi.rto_code),
      dataRow('VEHICLE_AGE', vi.vehicle_age),
      dataRow('FITNESS_UPTO',vi.fitness_upto),
      dataRow('TAX_UPTO',    vi.tax_upto),
      dataRow('ENGINE_NO',   vi.engine_no),
      dataRow('CHASSIS_NO',  vi.chasi_no),
    ],
  }));

  /* ── Card 4: Insurance ───────────────────────────────────── */
  const insExpired = vi.insurance_expiry_in &&
                     vi.insurance_expiry_in.toLowerCase().includes('expired');
  grid.appendChild(buildCard({
    icon: 'shield',
    title: 'INSURANCE_LOG',
    dotClass: insExpired ? 'red' : '',
    rows: [
      dataRow('COMPANY',    vi.insurance_company),
      dataRow('POLICY_NO',  vi.insurance_no),
      dataRow('VALID_UPTO', vi.insurance_upto),
      dataRow('EXPIRES_IN', vi.insurance_expiry_in),
      tagRow ('STATUS',     insExpired ? 'EXPIRED' : 'VALID', ['VALID'], [], ['EXPIRED']),
    ],
  }));

  /* ── Card 5: PUC & Finance ───────────────────────────────── */
  const pucExpired = vi.puc_expiry_in &&
                     vi.puc_expiry_in.toLowerCase().includes('expired');
  grid.appendChild(buildCard({
    icon: 'eco',
    title: 'PUC & FINANCE',
    dotClass: pucExpired ? 'amber' : '',
    rows: [
      dataRow('PUC_NO',       vi.puc_no),
      dataRow('PUC_UPTO',     vi.puc_upto),
      tagRow ('PUC_STATUS',   pucExpired ? 'EXPIRED' : 'VALID', ['VALID'], [], ['EXPIRED']),
      sectionDivider('── FINANCE ──'),
      dataRow('FINANCER',     vi.financer_name),
      dataRow('FIN_FROM',     vi.financed_from),
    ],
  }));

  /* ── Card 6: Permit ──────────────────────────────────────── */
  grid.appendChild(buildCard({
    icon: 'local_shipping',
    title: 'PERMIT_DATA',
    rows: [
      dataRow('PERMIT_NO',   vi.permit_no),
      dataRow('PERMIT_TYPE', vi.permit_type),
      dataRow('ISSUED_DT',   vi.permit_issued_dt),
      dataRow('VALID_FROM',  vi.permit_valid_from),
      dataRow('VALID_UPTO',  vi.permit_valid_upto),
      dataRow('NP_NO',       vi.np_no),
      dataRow('NP_UPTO',     vi.np_upto),
      dataRow('NP_BY',       vi.np_issued_by),
    ],
  }));

  /* ── Card 7: Challans (full-width) ──────────────────────── */
  renderChallans(grid, challans);

  setStatus('STATUS: SCAN_COMPLETE // ' + esc(vi.reg_no || d.vnum || raw));
}


/* ── Challan Renderer ─────────────────────────────────────── */
function renderChallans(grid, challans) {
  const card = buildCard({
    icon: 'gavel',
    title: challans.length > 0
      ? 'CHALLAN_RECORDS <span style="color:var(--red);font-size:10px;margin-left:8px">[ ' + challans.length + ' FOUND ]</span>'
      : 'CHALLAN_RECORDS',
    dotClass: challans.length > 0 ? 'red' : '',
    fullWidth: true,
    rows: [],
  });

  const body = card.querySelector('.t-card-body');

  if (challans.length === 0) {
    body.innerHTML = '<div style="text-align:center;padding:20px;color:var(--green);letter-spacing:0.12em;font-size:13px">[ NO CHALLANS ON RECORD ]</div>';
    grid.appendChild(card);
    return;
  }

  challans.forEach((ch) => {
    const isPending = String(ch.challan_status || '').toLowerCase() === 'pending';
    const hasPay    = isPending && ch.challan_pay_url;
    
    // Check if violator is protected
    const violatorClass = ch.violator_name === '[ PROTECTED BY OWNER ]' ? 'style="color:var(--red)"' : '';

    const offencesHTML = (ch.offece || []).map((o) => `
      <div class="offence-box">
        <div><span class="offence-mva">MVA: </span>${esc(o.mva)}</div>
        <div style="margin-top:4px">${esc(o.offence_name)}</div>
        <div style="margin-top:4px"><span class="offence-penalty">PENALTY: &#8377;${esc(o.penalty)}</span></div>
      </div>
    `).join('');

    const item = document.createElement('div');
    item.className = 'challan-item';
    item.innerHTML = `
      <div class="challan-header">
        <div class="challan-meta">
          <div>CHALLAN: <span>${esc(ch.challan_no)}</span></div>
          <div>DATE: <span>${esc(ch.challan_date)}</span></div>
          <div>REG: <span class="reg">${esc(ch.reg_no)}</span></div>
          <div>VIOLATOR: <span ${violatorClass}>${esc(ch.violator_name)}</span></div>
          ${ch.challan_payment_date && ch.challan_payment_date !== 'NA'
            ? `<div>PAID: <span>${esc(ch.challan_payment_date)}</span></div>`
            : ''}
        </div>
        <div>
          <div class="challan-amount">&#8377;${esc(ch.challan_amount)}</div>
          <div class="challan-status">
            ${isPending
              ? '<span class="status-tag tag-danger">[ PENDING ]</span>'
              : `<span class="status-tag tag-ok">[ ${esc(ch.challan_status)} ]</span>`}
          </div>
        </div>
      </div>
      ${offencesHTML}
      ${hasPay ? `<a class="challan-pay-btn" href="${esc(ch.challan_pay_url)}" target="_blank" rel="noopener noreferrer">[ PAY CHALLAN ]</a>` : ''}
    `;
    body.appendChild(item);
  });

  grid.appendChild(card);
}


/* ================================================================
   7. CARD & ROW BUILDER HELPERS
   ================================================================ */

function buildCard({ icon, title, rows = [], fullWidth = false, dotClass = '' }) {
  const card = document.createElement('div');
  card.className = 't-card' + (fullWidth ? ' full-width' : '');

  card.innerHTML = `
    <div class="t-card-header">
      <div class="t-card-title">
        <span class="material-symbols-outlined">${icon}</span>
        ${title}
      </div>
      <div class="blink-dot ${dotClass}"></div>
    </div>
    <div class="t-card-body"></div>
  `;

  const body = card.querySelector('.t-card-body');
  rows.forEach((row) => {
    if (typeof row === 'string') {
      const wrapper = document.createElement('div');
      wrapper.innerHTML = row;
      while (wrapper.firstChild) body.appendChild(wrapper.firstChild);
    } else if (row instanceof Node) {
      body.appendChild(row);
    }
  });

  return card;
}

function dataRow(key, val, cls) {
  const el = document.createElement('div');
  el.className = 'data-row';
  const valClass = 'data-val' + (cls ? ' ' + cls : '');
  el.innerHTML = `<div class="data-key">${key}:</div><div class="${valClass}">${fmt(val)}</div>`;
  return el;
}

function tagRow(key, val, ok = [], warn = [], danger = []) {
  const el = document.createElement('div');
  el.className = 'data-row';
  el.innerHTML = `<div class="data-key">${key}:</div><div class="data-val">${statusTag(val, ok, warn, danger)}</div>`;
  return el;
}

function sectionDivider(label) {
  const el = document.createElement('div');
  el.className = 'data-row section-divider';
  el.innerHTML = `<div class="data-key" style="color:var(--green)">${esc(label)}</div><div></div>`;
  return el;
}

function statusTag(val, ok, warn, danger) {
  const upper = String(val || '').toUpperCase();
  let cls = 'tag-ok';
  if (danger.some((v) => upper.includes(v))) cls = 'tag-danger';
  else if (warn.some((v) => upper.includes(v))) cls = 'tag-warn';
  return `<span class="status-tag ${cls}">[ ${esc(upper)} ]</span>`;
}

/* ================================================================
   8. INIT
   ================================================================ */
(function bindListeners() {
  initTokenFlow();

  const input = $('vehicleInput');
  const btn   = $('scanBtn');

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') runScan();
  });

  input.addEventListener('input', function () {
    const pos = this.selectionStart;
    this.value = this.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    this.setSelectionRange(pos, pos);
  });

  btn.addEventListener('click', runScan);
})();
