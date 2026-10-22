(function () {
'use strict';
var $ = function (s, r) { return (r || document).querySelector(s); }, app = $('#app'), me = null, scope = 'open', timer = null;
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
function fmt(d) { return d ? new Date(d).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' }) : 'Time not fixed'; }
function label(s) { s = String(s || '').replace(/_/g, ' '); return s.charAt(0).toUpperCase() + s.slice(1); }
function toast(m) { var t = $('#toast'); t.textContent = m; t.className = 'show'; setTimeout(function () { t.className = ''; }, 2600); }
async function api(path, o) {
  o = o || {};
  var r = await fetch('/api' + path, { method: o.method || 'GET', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'X-QFB': '1' }, body: o.body ? JSON.stringify(o.body) : undefined });
  var d = {}; try { d = await r.json(); } catch (e) {}
  if (!r.ok) { var e = new Error(d.error || 'Something went wrong'); e.status = r.status; throw e; }
  return d;
}
function head(withButtons) {
  return '<div class="hd"><div class="in"><img src="logo.jpg" alt="QuickFix Barak"><div><b>QuickFix Barak</b><small>Technician portal</small></div><span class="sp"></span>' + (withButtons ? '<button id="pw">Password</button><button id="out">Sign out</button>' : '') + '</div></div>';
}
function loginView(msg) {
  clearInterval(timer);
  app.innerHTML = head(false) + '<div class="wrap"><div class="card" style="margin-top:20px"><h1>Sign in</h1><p style="color:var(--m)">Use your Technician ID (like QFB-TECH-0001) or your registered mobile number.</p><form id="lf" style="display:grid;gap:14px"><label class="fl">Technician ID or mobile number<input id="li" autocomplete="username" autocapitalize="characters" required></label><label class="fl">Password<input id="lp" type="password" autocomplete="current-password" required></label><p class="err" id="le" role="alert">' + esc(msg || '') + '</p><button class="btn o" style="justify-content:center;padding:13px">Sign in</button></form><p style="color:var(--m);font-size:13px;margin-bottom:0">Forgot your password? Ask QuickFix Barak to reset it.</p></div></div>';
  $('#lf').onsubmit = async function (e) {
    e.preventDefault(); $('#le').textContent = '';
    try { me = await api('/tech/login', { method: 'POST', body: { id: $('#li').value, password: $('#lp').value } }); me.must_change ? pwView(true) : jobsView(); } catch (er) { $('#le').textContent = er.message; }
  };
}
function pwView(forced) {
  clearInterval(timer);
  app.innerHTML = head(!forced) + '<div class="wrap"><div class="card" style="margin-top:20px"><h1>' + (forced ? 'Set your own password' : 'Change password') + '</h1>' + (forced ? '<div class="note">For your safety, choose a new password before you continue.</div>' : '') + '<form id="pf" style="display:grid;gap:14px"><label class="fl">Current ' + (forced ? 'temporary ' : '') + 'password<input id="p0" type="password" autocomplete="current-password" required></label><label class="fl">New password (8+ characters)<input id="p1" type="password" autocomplete="new-password" minlength="8" required></label><p class="err" id="pe" role="alert"></p><div class="row"><button class="btn o">Save password</button>' + (forced ? '' : '<button type="button" class="btn ghost" id="bk">Back</button>') + '</div></form></div></div>';
  if (!forced) { $('#bk').onclick = jobsView; bar(); }
  $('#pf').onsubmit = async function (e) {
    e.preventDefault();
    try { await api('/tech/password', { method: 'POST', body: { current: $('#p0').value, password: $('#p1').value } }); me.must_change = false; toast('Password saved'); jobsView(); } catch (er) { $('#pe').textContent = er.message; }
  };
}
function bar() {
  if ($('#out')) $('#out').onclick = async function () { try { await api('/tech/logout', { method: 'POST', body: {} }); } catch (e) {} me = null; loginView(); };
  if ($('#pw')) $('#pw').onclick = function () { pwView(false); };
}
var NEXT = { assigned: ['en_route', 'On my way'], en_route: ['arrived', 'I have arrived'], arrived: ['in_progress', 'Start work'], diagnosing: ['in_progress', 'Start work'], quote_accepted: ['in_progress', 'Start work'], in_progress: ['completed', 'Mark job completed'] };
function note(title, ok) {
  return new Promise(function (res) {
    var d = $('#dlg'); d.innerHTML = '<form method="dialog"><h2>' + esc(title) + '</h2><p><label class="fl">Note for the office (optional)<textarea id="nn" rows="2"></textarea></label></p><div class="row"><button class="btn o" value="ok">' + esc(ok) + '</button><button class="btn ghost" value="cancel" formnovalidate>Cancel</button></div></form>';
    d.showModal(); d.onclose = function () { res(d.returnValue === 'ok' ? $('#nn').value.trim() : null); };
  });
}
async function jobsView(silent) {
  if (!me) return loginView();
  var jobs; try { jobs = await api('/tech/jobs?scope=' + scope); } catch (e) { if (e.status === 401) { me = null; return loginView('Please sign in again.'); } toast(e.message); return; }
  var open = scope === 'open';
  app.innerHTML = head(true) + '<div class="wrap"><p style="margin:14px 0 0">Hello, <b>' + esc(me.name) + '</b> <span class="badge">' + esc(me.tech_code) + '</span></p><div class="tabs"><button id="t1" class="' + (open ? 'on' : '') + '">My open jobs</button><button id="t2" class="' + (open ? '' : 'on') + '">Completed</button></div>' +
    (jobs.length ? jobs.map(function (j) {
      var n = NEXT[j.work_status], maps = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(j.address + ', ' + j.locality);
      return '<div class="job"><div class="top2"><div><h3>' + esc(j.service) + '</h3><div class="m">' + esc(j.booking_code) + '</div></div><span class="badge b-' + esc(j.work_status) + '">' + esc(label(j.work_status)) + '</span></div>' +
        '<p><b>' + esc(fmt(j.preferred_at)) + '</b></p><p>' + esc(j.customer_name) + '<br>' + esc(j.address) + ', ' + esc(j.locality) + '</p>' + (j.problem ? '<p class="m">Problem: ' + esc(j.problem) + '</p>' : '') + (Number(j.inspection_fee) > 0 ? '<p class="m">Inspection fee: ₹' + esc(j.inspection_fee) + '</p>' : '') +
        (j.customer_mobile ? '<div class="acts"><a class="btn ghost" href="tel:+91' + esc(j.customer_mobile) + '">Call</a><a class="btn ghost" target="_blank" rel="noopener" href="https://wa.me/91' + esc(j.customer_mobile) + '">WhatsApp</a><a class="btn ghost" target="_blank" rel="noopener" href="' + maps + '">Map</a></div>' : '') +
        (open && n ? '<button class="btn o next" data-c="' + esc(j.booking_code) + '" data-s="' + n[0] + '" data-l="' + n[1] + '">' + n[1] + '</button>' : '') + '</div>';
    }).join('') : '<div class="card"><p class="empty" style="margin:0">' + (open ? 'No open jobs right now. New jobs appear here when the office assigns them to you.' : 'No completed jobs yet.') + '</p></div>') +
    '<p style="text-align:center"><button class="btn ghost" id="rf">Refresh</button></p></div>';
  bar();
  $('#t1').onclick = function () { scope = 'open'; jobsView(); }; $('#t2').onclick = function () { scope = 'done'; jobsView(); }; $('#rf').onclick = function () { jobsView(); };
  document.querySelectorAll('[data-s]').forEach(function (b) {
    b.onclick = async function () {
      var r = await note(b.dataset.l + '? (' + b.dataset.c + ')', 'Confirm'); if (r === null) return;
      try { await api('/tech/jobs/' + b.dataset.c + '/status', { method: 'POST', body: { status: b.dataset.s, note: r } }); toast('Updated'); jobsView(); } catch (er) { toast(er.message); }
    };
  });
  clearInterval(timer); timer = setInterval(function () { if (!$('#dlg').open) jobsView(true); }, 60000);
}
(async function () {
  try { me = await api('/tech/me'); me.must_change ? pwView(true) : jobsView(); } catch (e) { loginView(); }
})();
})();
