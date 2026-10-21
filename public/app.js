(function () {
'use strict';
var $ = function (s, r) { return (r || document).querySelector(s); }, app = $('#app'), me = null, cats = null;
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
function fmt(d) { return d ? new Date(d).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '-'; }
function inr(n) { return '₹' + Number(n || 0).toLocaleString('en-IN'); }
function label(s) { s = String(s || '').replace(/[._]/g, ' '); return s.charAt(0).toUpperCase() + s.slice(1); }
function badge(s) { return '<span class="badge b-' + esc(s) + '">' + esc(label(s)) + '</span>'; }
function toast(m) { var t = $('#toast'); t.textContent = m; t.className = 'show'; setTimeout(function () { t.className = ''; }, 2600); }
async function api(path, o) {
  o = o || {};
  var r = await fetch('/api' + path, { method: o.method || 'GET', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'X-QFB': '1' }, body: o.body ? JSON.stringify(o.body) : undefined });
  var d = {}; try { d = await r.json(); } catch (e) {}
  if (!r.ok) { var e = new Error(d.error || 'Something went wrong'); e.status = r.status; throw e; }
  return d;
}
function ask(title, required, lab, okText) {
  return new Promise(function (res) {
    var d = $('#dlg');
    d.innerHTML = '<form method="dialog"><h2>' + esc(title) + '</h2><p><label class="fl">' + esc(lab || 'Reason') + (required ? ' <b class="rq">*</b>' : '') + '<textarea id="rs" rows="3"></textarea></label></p><p class="err" id="re"></p><div class="row"><button class="btn o" value="ok">' + esc(okText || 'Confirm') + '</button><button class="btn ghost" value="cancel" formnovalidate>Cancel</button></div></form>';
    d.showModal();
    $('form', d).onsubmit = function (e) { if (e.submitter.value === 'ok' && required && $('#rs').value.trim().length < 3) { e.preventDefault(); $('#re').textContent = 'Please enter a reason (at least 3 characters).'; } };
    d.onclose = function () { res(d.returnValue === 'ok' ? $('#rs').value.trim() : null); };
  });
}
async function getCats() { if (!cats) cats = await api('/categories'); return cats; }

// ---------- layout ----------
function shell(html) {
  var h = location.hash || '#/dashboard';
  function a(href, text, cls, soon) { return '<a href="' + href + '" class="' + (cls || '') + (h === href ? ' on' : '') + '">' + text + (soon ? '<span class="soon">Stage 2</span>' : '') + '</a>'; }
  app.innerHTML = '<div class="shell"><nav class="side" id="side" aria-label="Main"><div class="brand"><img src="logo.jpg" alt="QuickFix Barak"><div><b>QuickFix Barak</b><small>Admin Panel</small></div></div>' +
    a('#/dashboard', 'Dashboard') + '<hr>' + a('#/technicians', 'Technicians') + a('#/technicians/new', 'Add technician', 'sub') +
    a('#/technicians?verification=pending', 'Pending verification', 'sub') + a('#/technicians?status=active', 'Active', 'sub') + a('#/technicians?status=inactive', 'Inactive', 'sub') + a('#/technicians?status=suspended', 'Suspended', 'sub') + '<hr>' +
    a('#/soon', 'Bookings', '', 1) + a('#/soon', 'Cash and settlements', '', 1) + a('#/soon', 'Reports', '', 1) + a('#/soon', 'Service categories', '', 1) + '</nav>' +
    '<div class="main"><div class="top"><button class="burger" id="bur" aria-label="Menu">☰</button><b style="color:var(--n)">Your Home Service Partner</b><span class="sp"></span><span>' + esc(me.name) + ' <span class="badge">' + esc(me.role) + '</span></span><button class="btn ghost" id="out">Sign out</button></div><main class="pad">' + html + '</main></div></div>';
  $('#bur').onclick = function () { $('#side').classList.toggle('open'); };
  $('#side').onclick = function () { $('#side').classList.remove('open'); };
  $('#out').onclick = async function () { try { await api('/logout', { method: 'POST' }); } catch (e) {} me = null; location.hash = '#/login'; route(); };
}
function loginView() {
  app.innerHTML = '<div class="login"><img src="logo.jpg" alt="QuickFix Barak"><h1 style="text-align:center">Admin sign in</h1><p style="text-align:center;color:var(--m)">Your Home Service Partner</p><form class="card" id="lf"><label class="fl">Email<input type="email" id="le" autocomplete="username" required></label><label class="fl">Password<input type="password" id="lp" autocomplete="current-password" required></label><p class="err" id="lerr" role="alert"></p><button class="btn o" style="justify-content:center">Sign in</button></form></div>';
  $('#lf').onsubmit = async function (e) {
    e.preventDefault(); $('#lerr').textContent = '';
    try { me = await api('/login', { method: 'POST', body: { email: $('#le').value, password: $('#lp').value } }); location.hash = '#/dashboard'; route(); }
    catch (er) { $('#lerr').textContent = er.message; }
  };
}

// ---------- dashboard ----------
async function dashboardView() {
  var d = await api('/dashboard'), c = d.cards;
  var S = function (v, l, cls) { return '<div class="stat ' + (cls || '') + '"><b>' + v + '</b><span>' + l + '</span></div>'; };
  var list = function (arr, fn, empty) { return arr.length ? '<ul class="list">' + arr.map(fn).join('') + '</ul>' : '<p class="empty">' + empty + '</p>'; };
  shell('<h1>Dashboard</h1><p style="color:var(--m)">Live figures from the database.</p><div class="cards">' +
    S(c.tech_total, 'Total technicians') + S(c.tech_active, 'Active technicians', 'g') + S(c.tech_pending, 'Pending verifications', 'o') + S(c.tech_suspended, 'Suspended technicians', 'r') +
    S(c.customers, 'Total customers') + S(c.bookings, 'Total bookings') + S(c.bookings_open, 'Pending and assigned bookings', 'o') + S(c.bookings_done, 'Completed bookings', 'g') +
    S(inr(c.cash), 'Cash collected by technicians') + S(inr(c.owed), 'Commission owed to QuickFix', 'o') + S(inr(c.outstanding), 'Outstanding settlements', 'r') + S(inr(c.settled), 'Settlements verified', 'g') + '</div>' +
    '<div class="grid2"><div class="card"><h2>Pending approvals</h2>' + list(d.approvals, function (t) { return '<li><a href="#/technicians/' + esc(t.tech_code) + '"><b>' + esc(t.tech_code) + '</b> ' + esc(t.full_name) + '</a> ' + badge(t.verification_status) + '<br><small>Added ' + fmt(t.created_at) + '</small></li>'; }, 'Nothing waiting for approval.') + '</div>' +
    '<div class="card"><h2>Overdue settlements</h2>' + list(d.overdue, function (s) { return '<li><b>' + esc(s.tech_code) + '</b> ' + esc(s.full_name) + ' owes ' + inr(s.balance) + '<br><small>Due ' + esc(String(s.due_date).slice(0, 10)) + '</small></li>'; }, 'No overdue settlements.') + '</div>' +
    '<div class="card"><h2>Recent bookings</h2>' + list(d.bookings, function (b) { return '<li><b>' + esc(b.booking_code) + '</b> ' + esc(b.service) + ' for ' + esc(b.customer) + ' ' + badge(b.work_status) + '</li>'; }, 'No bookings yet. Booking management arrives in Stage 2.') + '</div>' +
    '<div class="card"><h2>Recent activity</h2>' + list(d.activity, function (a) { return '<li>' + esc(label(a.action)) + ' <b>' + esc(a.entity_id || '') + '</b><br><small>' + esc(a.admin || 'System') + ' · ' + fmt(a.created_at) + (a.reason ? ' · ' + esc(a.reason) : '') + '</small></li>'; }, 'No activity yet.') + '</div></div>');
}

// ---------- technician list ----------
async function listView(qp) {
  var cs = await getCats(), qs = new URLSearchParams(qp).toString(), r = await api('/technicians?' + qs);
  var title = qp.status ? label(qp.status) + ' technicians' : qp.verification === 'pending' ? 'Pending verification' : 'All technicians';
  var opt = function (arr, cur) { return arr.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (String(cur || '') === String(o[0]) ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join(''); };
  function link(p) { var x = Object.assign({}, qp, { page: p }); return '#/technicians?' + new URLSearchParams(x).toString(); }
  shell('<div class="row sb"><h1>' + esc(title) + '</h1><a class="btn o" href="#/technicians/new">+ Add technician</a></div>' +
    '<form class="card" id="flt"><div class="grid2"><label class="fl">Search<input id="fq" placeholder="ID, name or mobile" value="' + esc(qp.q) + '"></label><label class="fl">Service area<input id="fa" placeholder="e.g. Hailakandi" value="' + esc(qp.area) + '"></label></div>' +
    '<div class="row" style="margin-top:12px"><label class="fl">Service<select id="fc"><option value="">All</option>' + opt(cs.map(function (c) { return [c.id, c.name]; }), qp.category) + '</select></label>' +
    '<label class="fl">Status<select id="fs"><option value="">All</option>' + opt([['pending', 'Pending'], ['active', 'Active'], ['inactive', 'Inactive'], ['suspended', 'Suspended']], qp.status) + '</select></label>' +
    '<label class="fl">Verification<select id="fv"><option value="">All</option>' + opt([['pending', 'Pending'], ['under_review', 'Under review'], ['verified', 'Verified'], ['rejected', 'Rejected']], qp.verification) + '</select></label>' +
    '<label class="fl">Sort<select id="fo">' + opt([['created', 'Newest'], ['name', 'Name'], ['code', 'ID'], ['experience', 'Experience']], qp.sort) + '</select></label>' +
    '<label class="fl">Order<select id="fd">' + opt([['desc', 'Descending'], ['asc', 'Ascending']], qp.dir) + '</select></label>' +
    '<button class="btn" style="align-self:end">Apply</button></div></form>' +
    '<div class="card tw">' + (r.rows.length ? '<table><thead><tr><th>ID</th><th>Name</th><th>Mobile</th><th>Area</th><th>Skills</th><th>Verification</th><th>Status</th></tr></thead><tbody>' +
    r.rows.map(function (t) { return '<tr><td><a href="#/technicians/' + esc(t.tech_code) + '"><b>' + esc(t.tech_code) + '</b></a></td><td>' + esc(t.full_name) + '</td><td>' + esc(t.mobile) + '</td><td>' + esc(t.locality) + '</td><td>' + esc(t.skills || '-') + '</td><td>' + badge(t.verification_status) + '</td><td>' + badge(t.status) + '</td></tr>'; }).join('') + '</tbody></table>'
      : '<p class="empty">No technicians found. <a href="#/technicians/new">Add the first technician</a>.</p>') + '</div>' +
    '<div class="row sb"><span style="color:var(--m)">' + r.total + ' technician' + (r.total === 1 ? '' : 's') + ' · page ' + r.page + ' of ' + r.pages + '</span><span class="row">' +
    (r.page > 1 ? '<a class="btn ghost" href="' + link(r.page - 1) + '">Previous</a>' : '') + (r.page < r.pages ? '<a class="btn ghost" href="' + link(r.page + 1) + '">Next</a>' : '') + '</span></div>');
  $('#flt').onsubmit = function (e) {
    e.preventDefault(); var p = { q: $('#fq').value.trim(), area: $('#fa').value.trim(), category: $('#fc').value, status: $('#fs').value, verification: $('#fv').value, sort: $('#fo').value, dir: $('#fd').value }, o = {};
    Object.keys(p).forEach(function (k) { if (p[k]) o[k] = p[k]; }); location.hash = '#/technicians' + (Object.keys(o).length ? '?' + new URLSearchParams(o).toString() : '');
  };
}

// ---------- onboarding / edit form ----------
var BASIS = [['labour_only', 'Labour only'], ['labour_and_parts', 'Labour and parts'], ['fixed_per_job', 'Fixed amount per job'], ['custom', 'Custom rule']];
var SCHED = [['daily', 'Daily'], ['weekly', 'Weekly'], ['fortnightly', 'Every two weeks']];
var SECTIONS = {
  personal: { title: 'A. Personal information', fields: [['full_name', 'Full legal name', 'text', 1], ['mobile', 'Mobile number (must be unique)', 'tel', 1], ['alt_mobile', 'Alternate mobile number', 'tel'], ['email', 'Email address', 'email'], ['address', 'Current address', 'textarea', 1], ['locality', 'Town / locality', 'text', 1], ['pin_code', 'PIN code', 'text', 1], ['emergency_name', 'Emergency contact name', 'text'], ['emergency_mobile', 'Emergency contact number', 'tel']] },
  professional: { title: 'C. Professional information', fields: [['experience_years', 'Years of experience', 'number'], ['experience_notes', 'Experience description', 'textarea'], ['qualifications', 'Qualifications and training', 'textarea'], ['tools', 'Tools and equipment available', 'textarea'], ['own_transport', 'Has own transport', 'check'], ['working_hours', 'Preferred working hours', 'text'], ['availability', 'Availability', 'select', 0, [['', 'Select'], ['full_time', 'Full-time'], ['part_time', 'Part-time'], ['weekend', 'Weekend only']]], ['service_localities', 'Preferred service localities', 'text'], ['max_distance_km', 'Maximum service distance (km)', 'number'], ['assessment_notes', 'Admin assessment notes', 'textarea'], ['skills', 'Approved services', 'skills']] },
  verification: { title: 'D. Verification checks', fields: [['v_mobile_verified', 'Mobile number verified', 'check'], ['v_identity_checked', 'Identity checked', 'check'], ['v_address_checked', 'Address checked (if required)', 'check'], ['v_skills_assessed', 'Skills assessed', 'check'], ['v_qualifications_reviewed', 'Qualifications reviewed', 'check']] },
  agreement: { title: 'E. Business agreement', fields: [['ag_accepted', 'Technician has accepted the written agreement', 'check'], ['ag_version', 'Agreement version', 'text'], ['ag_commission_basis', 'Commission basis', 'select', 0, BASIS], ['ag_commission_rate', 'Commission rate (%)', 'number'], ['ag_settlement_schedule', 'Settlement schedule', 'select', 0, SCHED]] }
};
var INFO = {
  personal: '<div class="note"><b>B. Technician ID.</b> A permanent ID such as <b>QFB-TECH-0001</b> is generated automatically by the server when you save. You never type it, and it is never reused.</div><div class="note">Profile photo upload arrives with private document storage in the next stage.</div>',
  verification: '<div class="note">Tick only what you have actually checked. The final verification decision (Verify or Reject) is made on the technician\'s profile.</div>',
  agreement: '<div class="note">The agreement should cover commission, cash settlement, customer privacy and conduct, quotation rules, cancellations and refunds, complaints, and suspension and termination.</div><div class="note"><b>F. Account status.</b> New technicians start as <b>Pending</b>. Activate them from the profile once verified.</div>'
};
function field(f, v, cs) {
  var n = f[0], l = esc(f[1]) + (f[3] ? ' <b class="rq">*</b>' : '');
  if (f[2] === 'check') return '<label class="ck"><input type="checkbox" name="' + n + '"' + (v ? ' checked' : '') + '> ' + esc(f[1]) + '</label>';
  if (f[2] === 'textarea') return '<label class="fl">' + l + '<textarea name="' + n + '" rows="2">' + esc(v) + '</textarea></label>';
  if (f[2] === 'select') return '<label class="fl">' + l + '<select name="' + n + '">' + f[4].map(function (o) { return '<option value="' + o[0] + '"' + (String(v || '') === o[0] ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('') + '</select></label>';
  if (f[2] === 'skills') return '<div class="fl">' + esc(f[1]) + '<div class="sk">' + cs.filter(function (c) { return c.is_active || (v || []).indexOf(c.id) > -1; }).map(function (c) { return '<label class="ck"><input type="checkbox" name="skill" value="' + c.id + '"' + ((v || []).indexOf(c.id) > -1 ? ' checked' : '') + '> ' + esc(c.name) + '</label>'; }).join('') + '</div></div>';
  return '<label class="fl">' + l + '<input name="' + n + '" type="' + f[2] + '" value="' + esc(v) + '"' + (f[2] === 'tel' ? ' inputmode="numeric"' : '') + '></label>';
}
async function formView(code) {
  var cs = await getCats(), edit = !!code, data = { locality: 'Hailakandi', pin_code: '788151', ag_version: 'v1.0', ag_commission_basis: 'labour_only', ag_settlement_schedule: 'daily', skills: [] };
  if (edit) { var p = await api('/technicians/' + code); Object.assign(data, p.tech); data.skills = p.categories.filter(function (c) { return c.approved; }).map(function (c) { return c.id; }); }
  var keys = edit ? ['personal', 'professional'] : ['personal', 'professional', 'verification', 'agreement'], step = 0, total = keys.length + 1;
  function collect() {
    var root = $('#stepbox'); if (!root) return;
    root.querySelectorAll('[name]').forEach(function (el) {
      if (el.name === 'skill') return;
      data[el.name] = el.type === 'checkbox' ? el.checked : el.value.trim();
    });
    if (root.querySelector('[name=skill]')) data.skills = Array.prototype.map.call(root.querySelectorAll('[name=skill]:checked'), function (e) { return Number(e.value); });
  }
  function validate() {
    if (step >= keys.length) return '';
    var s = SECTIONS[keys[step]];
    for (var i = 0; i < s.fields.length; i++) { var f = s.fields[i]; if (f[3] && !String(data[f[0]] || '').trim()) return f[1] + ' is required.'; }
    if (keys[step] === 'personal') {
      if (!/^\d{6}$/.test(data.pin_code)) return 'PIN code must be 6 digits.';
      var m = String(data.mobile).replace(/[\s-]/g, '').replace(/^(\+91|91)(?=\d{10}$)/, ''); if (!/^[6-9]\d{9}$/.test(m)) return 'Enter a valid 10-digit mobile number.';
    }
    if (keys[step] === 'agreement' && data.ag_accepted) { var r = Number(data.ag_commission_rate); if (data.ag_commission_rate === '' || data.ag_commission_rate == null || !(r >= 0 && r <= 100)) return 'Enter a commission rate between 0 and 100.'; }
    return '';
  }
  function review() {
    var rows = [['Full name', data.full_name], ['Mobile', data.mobile], ['Address', data.address + ', ' + data.locality + ' ' + data.pin_code], ['Experience', (data.experience_years || '-') + ' years'],
      ['Approved services', cs.filter(function (c) { return data.skills.indexOf(c.id) > -1; }).map(function (c) { return c.name; }).join(', ') || 'None selected']];
    if (!edit) rows.push(['Checks done', ['mobile_verified', 'identity_checked', 'address_checked', 'skills_assessed', 'qualifications_reviewed'].filter(function (k) { return data['v_' + k]; }).map(label).join(', ') || 'None'],
      ['Agreement', data.ag_accepted ? data.ag_version + ', ' + label(data.ag_commission_basis) + ' at ' + data.ag_commission_rate + '%, settled ' + data.ag_settlement_schedule : 'Not yet accepted (record it later on the profile)']);
    return '<h2>Review and ' + (edit ? 'save' : 'create') + '</h2><dl class="kv">' + rows.map(function (r) { return '<dt>' + esc(r[0]) + '</dt><dd>' + esc(r[1]) + '</dd>'; }).join('') + '</dl>';
  }
  function draw() {
    var names = keys.map(function (k) { return SECTIONS[k].title.slice(3); }).concat(['Review']);
    var body = step < keys.length ? '<h2>' + esc(SECTIONS[keys[step]].title) + '</h2>' + (edit ? '' : INFO[keys[step]] || '') + '<div class="grid2" style="margin-top:12px">' + SECTIONS[keys[step]].fields.map(function (f) { return (f[2] === 'textarea' || f[2] === 'skills') ? '<div style="grid-column:1/-1">' + field(f, data[f[0]], cs) + '</div>' : field(f, data[f[0]], cs); }).join('') + '</div>' : review();
    shell('<h1>' + (edit ? 'Edit ' + esc(code) : 'Add technician') + '</h1><div class="steps">' + names.map(function (n, i) { return '<span class="' + (i === step ? 'on' : i < step ? 'done' : '') + '">' + (i + 1) + '. ' + esc(n) + '</span>'; }).join('') + '</div>' +
      '<div class="card" id="stepbox">' + body + '</div><p class="err" id="ferr" role="alert"></p><div class="row"><button class="btn ghost" id="bk">' + (step ? 'Back' : 'Cancel') + '</button><button class="btn o" id="nx">' + (step === total - 1 ? (edit ? 'Save changes' : 'Create technician') : 'Next') + '</button></div>');
    $('#bk').onclick = function () { collect(); if (step) { step--; draw(); } else location.hash = edit ? '#/technicians/' + code : '#/technicians'; };
    $('#nx').onclick = async function () {
      collect(); var er = validate(); if (er) { $('#ferr').textContent = er; return; }
      if (step < total - 1) { step++; draw(); window.scrollTo(0, 0); return; }
      var pl = Object.assign({}, data); this.disabled = true;
      if (!edit) {
        pl.verification = {}; ['mobile_verified', 'identity_checked', 'address_checked', 'skills_assessed', 'qualifications_reviewed'].forEach(function (k) { pl.verification[k] = !!data['v_' + k]; });
        pl.agreement = data.ag_accepted ? { accepted: true, version: data.ag_version, commission_basis: data.ag_commission_basis, commission_rate: Number(data.ag_commission_rate), settlement_schedule: data.ag_settlement_schedule } : null;
      }
      try { var r = await api(edit ? '/technicians/' + code : '/technicians', { method: edit ? 'PATCH' : 'POST', body: pl }); toast(edit ? 'Changes saved' : 'Technician created: ' + r.tech_code); location.hash = '#/technicians/' + (edit ? code : r.tech_code); }
      catch (e) { this.disabled = false; $('#ferr').textContent = e.message; }
    };
  }
  draw();
}

// ---------- technician profile ----------
async function profileView(code) {
  var p = await api('/technicians/' + code), t = p.tech, v = p.verification, s = p.stats, ag = p.agreement;
  var S = function (x, l) { return '<div class="stat"><b>' + x + '</b><span>' + l + '</span></div>'; };
  var kv = function (r) { return '<dl class="kv">' + r.map(function (x) { return '<dt>' + esc(x[0]) + '</dt><dd>' + esc(x[1] == null || x[1] === '' ? '-' : x[1]) + '</dd>'; }).join('') + '</dl>'; };
  var acts = [];
  if (t.status === 'pending' || t.status === 'inactive') acts.push('<button class="btn g" data-a="activate">Activate</button>');
  if (t.status === 'active') acts.push('<button class="btn ghost" data-a="deactivate">Deactivate</button>');
  if (t.status !== 'suspended') acts.push('<button class="btn r" data-a="suspend">Suspend</button>'); else acts.push('<button class="btn g" data-a="reinstate">Reinstate</button>');
  var chk = [['mobile_verified', 'Mobile number verified'], ['identity_checked', 'Identity checked'], ['address_checked', 'Address checked'], ['skills_assessed', 'Skills assessed'], ['qualifications_reviewed', 'Qualifications reviewed']];
  shell('<div class="card"><div class="row sb"><div><div class="idbox" id="tid">' + esc(t.tech_code) + '</div><h1 style="margin-top:6px">' + esc(t.full_name) + '</h1><div class="row" style="margin-top:6px">' + badge(t.status) + badge(t.verification_status) + '<span style="color:var(--m)">Onboarded ' + fmt(t.created_at) + '</span></div></div>' +
    '<div class="row noprint"><button class="btn ghost" id="cp">Copy ID</button><button class="btn ghost" id="pr">Print / save as PDF</button><a class="btn" href="#/technicians/' + esc(code) + '/edit">Edit profile</a></div></div><div class="row noprint" style="margin-top:14px">' + acts.join('') + '</div></div>' +
    '<div class="cards">' + S(s.assigned, 'Jobs assigned') + S(s.completed, 'Completed') + S(s.cancelled, 'Cancelled') + S(s.rating || '-', 'Average rating') + S(s.complaints, 'Complaints') + S(inr(s.cash), 'Cash collected') + S(inr(s.owed), 'Commission owed') + S(inr(s.settled), 'Commission settled') + S(inr(s.outstanding), 'Outstanding balance') + '</div>' +
    '<div class="grid2"><div class="card"><h2>Personal details</h2>' + kv([['Mobile', t.mobile], ['Alternate mobile', t.alt_mobile], ['Email', t.email], ['Address', t.address], ['Locality', t.locality + ' ' + t.pin_code], ['Emergency contact', (t.emergency_name || '') + ' ' + (t.emergency_mobile || '')]]) + '</div>' +
    '<div class="card"><h2>Professional details</h2>' + kv([['Experience', t.experience_years != null ? t.experience_years + ' years' : ''], ['Description', t.experience_notes], ['Qualifications', t.qualifications], ['Tools', t.tools], ['Own transport', t.own_transport ? 'Yes' : 'No'], ['Working hours', t.working_hours], ['Availability', label(t.availability)], ['Preferred localities', t.service_localities], ['Max distance', t.max_distance_km != null ? t.max_distance_km + ' km' : ''], ['Assessment notes', t.assessment_notes]]) + '</div></div>' +
    '<div class="card"><h2>Approved services</h2><div class="sk" style="margin-top:8px">' + p.categories.map(function (c) { return '<div>' + (c.approved ? '✅' : '▫️') + ' ' + esc(c.name) + '</div>'; }).join('') + '</div><p style="color:var(--m);margin:8px 0 0">Jobs are only offered for approved services. Change them with Edit profile.</p></div>' +
    '<div class="card"><h2>Verification</h2><div class="sk" style="margin:8px 0">' + chk.map(function (c) { return '<label class="ck"><input type="checkbox" data-c="' + c[0] + '"' + (v[c[0]] ? ' checked' : '') + '> ' + c[1] + '</label>'; }).join('') + '</div>' +
    '<label class="fl">Verification notes<textarea id="vn" rows="2">' + esc(v.notes) + '</textarea></label><p>Status: ' + badge(t.verification_status) + (v.verified_at ? ' <small>Verified by ' + esc(v.verified_by_name || 'admin') + ' on ' + fmt(v.verified_at) + '</small>' : '') + (v.rejection_reason ? ' <small>Reason: ' + esc(v.rejection_reason) + '</small>' : '') + '</p>' +
    '<div class="row noprint"><button class="btn ghost" data-v="under_review">Mark under review</button><button class="btn g" data-v="verified">Verify</button><button class="btn r" data-v="rejected">Reject</button></div><p class="err" id="verr"></p></div>' +
    '<div class="card"><h2>Business agreement</h2>' + (ag ? kv([['Version', ag.version], ['Accepted', fmt(ag.accepted_at)], ['Commission', label(ag.commission_basis) + ' at ' + ag.commission_rate + '%'], ['Settlement', label(ag.settlement_schedule)]]) :
      '<p>No accepted agreement recorded yet.</p><form id="agf" class="noprint"><div class="grid2"><label class="fl">Version<input id="agv" value="v1.0"></label><label class="fl">Commission rate (%)<input id="agr" type="number" min="0" max="100" step="0.5"></label>' +
      '<label class="fl">Commission basis<select id="agb">' + BASIS.map(function (o) { return '<option value="' + o[0] + '">' + o[1] + '</option>'; }).join('') + '</select></label><label class="fl">Settlement schedule<select id="ags">' + SCHED.map(function (o) { return '<option value="' + o[0] + '">' + o[1] + '</option>'; }).join('') + '</select></label></div>' +
      '<label class="ck"><input type="checkbox" id="aga"> Technician has accepted the written agreement</label><p class="err" id="agerr"></p><button class="btn o">Record agreement</button></form>') + '</div>' +
    '<div class="grid2"><div class="card"><h2>Internal notes</h2><form id="nf" class="noprint"><textarea id="nt" rows="2" placeholder="Add a private note"></textarea><p><button class="btn">Add note</button></p></form>' +
    (p.notes.length ? '<ul class="list">' + p.notes.map(function (n) { return '<li>' + esc(n.note) + '<br><small>' + esc(n.admin || '') + ' · ' + fmt(n.created_at) + '</small></li>'; }).join('') + '</ul>' : '<p class="empty">No notes yet.</p>') + '</div>' +
    '<div class="card"><h2>Activity log</h2>' + (p.activity.length ? '<ul class="list">' + p.activity.map(function (a) { return '<li>' + esc(label(a.action)) + (a.reason ? ': ' + esc(a.reason) : '') + '<br><small>' + esc(a.admin || 'System') + ' · ' + fmt(a.created_at) + '</small></li>'; }).join('') + '</ul>' : '<p class="empty">No activity yet.</p>') + '</div></div>' +
    '<div class="card"><h2>Job, cash and settlement history</h2><p class="empty">Detailed job history, the cash ledger and settlement review arrive in Stage 2. The totals above already read from the database.</p></div>');
  var reload = function () { cats = null; route(); };
  $('#cp').onclick = function () { navigator.clipboard.writeText(t.tech_code).then(function () { toast('Copied ' + t.tech_code); }); };
  $('#pr').onclick = function () { window.print(); };
  document.querySelectorAll('[data-a]').forEach(function (b) {
    b.onclick = async function () {
      var a = b.dataset.a, needs = a !== 'activate', r = await ask(label(a) + ' ' + t.full_name + '?', needs, needs ? 'Reason (saved in the audit log)' : 'Note (optional)', label(a)); if (r === null) return;
      try { await api('/technicians/' + code + '/status', { method: 'POST', body: { action: a, reason: r } }); toast('Status updated'); reload(); } catch (e) { toast(e.message); }
    };
  });
  document.querySelectorAll('[data-v]').forEach(function (b) {
    b.onclick = async function () {
      var st = b.dataset.v, reason = '', checks = {}; $('#verr').textContent = '';
      document.querySelectorAll('[data-c]').forEach(function (c) { checks[c.dataset.c] = c.checked; });
      if (st === 'rejected') { reason = await ask('Reject ' + t.full_name + '?', true, 'Reason for rejection'); if (reason === null) return; }
      try { await api('/technicians/' + code + '/verification', { method: 'POST', body: { status: st, checks: checks, notes: $('#vn').value, reason: reason } }); toast('Verification updated'); reload(); } catch (e) { $('#verr').textContent = e.message; }
    };
  });
  if ($('#agf')) $('#agf').onsubmit = async function (e) {
    e.preventDefault();
    try { await api('/technicians/' + code + '/agreement', { method: 'POST', body: { accepted: $('#aga').checked, version: $('#agv').value, commission_basis: $('#agb').value, commission_rate: $('#agr').value, settlement_schedule: $('#ags').value } }); toast('Agreement recorded'); reload(); } catch (er) { $('#agerr').textContent = er.message; }
  };
  $('#nf').onsubmit = async function (e) { e.preventDefault(); try { await api('/technicians/' + code + '/notes', { method: 'POST', body: { note: $('#nt').value } }); toast('Note added'); reload(); } catch (er) { toast(er.message); } };
}

// ---------- router ----------
async function route() {
  var h = (location.hash || '#/dashboard').slice(2).split('?'), path = h[0], qp = Object.fromEntries(new URLSearchParams(h[1] || ''));
  try {
    if (!me) { try { me = await api('/me'); } catch (e) { me = null; } }
    if (!me) return loginView();
    var m;
    if (path === 'login' || path === '') { location.hash = '#/dashboard'; return; }
    if (path === 'dashboard') return await dashboardView();
    if (path === 'technicians') return await listView(qp);
    if (path === 'technicians/new') return await formView();
    if ((m = path.match(/^technicians\/(QFB-TECH-\d+)\/edit$/))) return await formView(m[1]);
    if ((m = path.match(/^technicians\/(QFB-TECH-\d+)$/))) return await profileView(m[1]);
    if (path === 'soon') return shell('<h1>Coming in Stage 2</h1><div class="card"><p>Bookings and assignment, cash collection and commission ledger, settlement verification, reports and CSV export, and service category management are the next stage. The database tables for all of them already exist.</p><a class="btn" href="#/dashboard">Back to dashboard</a></div>');
    shell('<h1>Page not found</h1><a class="btn" href="#/dashboard">Back to dashboard</a>');
  } catch (e) {
    if (e.status === 401) { me = null; return loginView(); }
    if (me) shell('<div class="card"><h2>Something went wrong</h2><p class="err">' + esc(e.message) + '</p><a class="btn" href="#/dashboard">Back to dashboard</a></div>'); else loginView();
  }
}
window.addEventListener('hashchange', route);
route();
})();
