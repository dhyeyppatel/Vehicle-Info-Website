/**
 * VehicleScan Terminal — protect.js
 * Logic for protecting vehicle information.
 */

'use strict';

// ── Matrix Rain Background ──
(function initMatrixRain() {
  const canvas = document.getElementById('matrix-canvas');
  if (!canvas) return;
  function syncSize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  window.addEventListener('resize', syncSize);
  syncSize();
  const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
  if (!gl) return;
  const vs = 'attribute vec2 a; varying vec2 v; void main() { v = a * 0.5 + 0.5; gl_Position = vec4(a, 0.0, 1.0); }';
  const fs = 'precision highp float; varying vec2 v; uniform float t; uniform vec2 r; float rnd(vec2 s) { return fract(sin(dot(s, vec2(12.9898, 78.233))) * 43758.5453); } void main() { float cols = 50.0; vec2 g = floor(v * vec2(cols, cols * r.y / r.x)); float sp = 0.4 + rnd(vec2(g.x, 0.0)) * 0.6; float yo = rnd(vec2(g.x, 7.3)) * 100.0; float y = fract(v.y + t * sp + yo); float b = step(0.88, rnd(g + floor(t * 12.0))) * pow(1.0 - y, 2.5); vec3 col = vec3(0.0, 1.0, 0.25) * b + vec3(0.0, 0.04, 0.008); gl_FragColor = vec4(col, 1.0); }';
  function compileShader(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src); gl.compileShader(s); return s;
  }
  const prog = gl.createProgram();
  gl.attachShader(prog, compileShader(gl.VERTEX_SHADER, vs));
  gl.attachShader(prog, compileShader(gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(prog); gl.useProgram(prog);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(prog, 'a');
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
  const uTime = gl.getUniformLocation(prog, 't');
  const uRes = gl.getUniformLocation(prog, 'r');
  function frame(timestamp) {
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform1f(uTime, timestamp * 0.001);
    gl.uniform2f(uRes, canvas.width, canvas.height);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();

// ── Form Logic ──
const form = document.getElementById('protectForm');
const regInput = document.getElementById('regInput');
const mobileInput = document.getElementById('mobileInput');
const submitBtn = document.getElementById('submitBtn');
const msgBox = document.getElementById('msgBox');

function showMessage(msg, isSuccess) {
  msgBox.style.display = 'block';
  msgBox.className = 'message-box ' + (isSuccess ? 'success' : 'error');
  msgBox.textContent = msg;
}

regInput.addEventListener('input', function() {
  const pos = this.selectionStart;
  this.value = this.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
  this.setSelectionRange(pos, pos);
});

mobileInput.addEventListener('input', function() {
  this.value = this.value.replace(/[^0-9]/g, '');
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const reg = regInput.value.trim();
  const mobile = mobileInput.value.trim();
  
  if (!reg || !mobile) {
    showMessage('Please enter both Registration and Mobile Number.', false);
    return;
  }
  
  submitBtn.disabled = true;
  submitBtn.textContent = '[ VERIFYING_WITH_RTO_DATABASE... ]';
  msgBox.style.display = 'none';
  
  try {
    const res = await fetch('/api/protect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reg_no: reg, mobile_no: mobile })
    });
    
    const data = await res.json();
    
    if (res.ok && data.success) {
      showMessage(data.message, true);
      form.reset();
    } else {
      showMessage(data.error || 'Failed to protect info.', false);
    }
  } catch (err) {
    showMessage('Network error. Please try again.', false);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = '[ INITIATE_PROTECTION_PROTOCOL ]';
  }
});
