(function () {
'use strict';
var $ = function (s, r) { return (r || document).querySelector(s); }, app = $('#app'), me = null, cats = null;
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
function fmt(d) { return d ? new Date(d).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' }) : '-'; }
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
  function a(href, text, cls, soon) { return '<a href="' + href + '" class="' + (cls || '') + (h === href ? ' on' : '') + '">' + text + (soon ? '<span class="soon">Stage 3</span>' : '') + '</a>'; }
  app.innerHTML = '<div class="shell"><nav class="side" id="side" aria-label="Main"><div class="brand"><img src="logo.jpg" alt="QuickFix Barak"><div><b>QuickFix Barak</b><small>Admin Panel</small></div></div>' +
    a('#/dashboard', 'Dashboard') + '<hr>' + a('#/bookings', 'Bookings') + a('#/bookings/new', 'New booking', 'sub') + a('#/bookings?assignment=unassigned', 'Needs a technician', 'sub') + '<hr>' + a('#/technicians', 'Technicians') + a('#/technicians/new', 'Add technician', 'sub') +
    a('#/technicians?verification=pending', 'Pending verification', 'sub') + a('#/technicians?status=active', 'Active', 'sub') + a('#/technicians?status=inactive', 'Inactive', 'sub') + a('#/technicians?status=suspended', 'Suspended', 'sub') + '<hr>' +
    a('#/categories', 'Service categories') + a('#/soon', 'Cash and settlements', '', 1) + a('#/soon', 'Reports', '', 1) + '</nav>' +
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
    S(c.customers, 'Total customers') + S(c.bookings, 'Total bookings') + S(c.bookings_unassigned, 'Awaiting a technician', 'r') + S(c.bookings_open, 'Pending and assigned bookings', 'o') + S(c.bookings_done, 'Completed bookings', 'g') +
    S(inr(c.cash), 'Cash collected by technicians') + S(inr(c.owed), 'Commission owed to QuickFix', 'o') + S(inr(c.outstanding), 'Outstanding settlements', 'r') + S(inr(c.settled), 'Settlements verified', 'g') + '</div>' +
    '<div class="grid2"><div class="card"><h2>Pending approvals</h2>' + list(d.approvals, function (t) { return '<li><a href="#/technicians/' + esc(t.tech_code) + '"><b>' + esc(t.tech_code) + '</b> ' + esc(t.full_name) + '</a> ' + badge(t.verification_status) + '<br><small>Added ' + fmt(t.created_at) + '</small></li>'; }, 'Nothing waiting for approval.') + '</div>' +
    '<div class="card"><h2>Overdue settlements</h2>' + list(d.overdue, function (s) { return '<li><b>' + esc(s.tech_code) + '</b> ' + esc(s.full_name) + ' owes ' + inr(s.balance) + '<br><small>Due ' + esc(String(s.due_date).slice(0, 10)) + '</small></li>'; }, 'No overdue settlements.') + '</div>' +
    '<div class="card"><h2>Recent bookings</h2>' + list(d.bookings, function (b) { return '<li><a href="#/bookings/' + esc(b.booking_code) + '"><b>' + esc(b.booking_code) + '</b></a> ' + esc(b.service) + ' for ' + esc(b.customer) + ' ' + badge(b.work_status) + '</li>'; }, 'No bookings yet.') + '</div>' +
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
    '<div class="row" style="margin-top:12px"><label class="fl">Service<select id="fc"><option value="">All</option>' + opt(cs.filter(function (c) { return c.is_active; }).map(function (c) { return [c.id, c.name]; }), qp.category) + '</select></label>' +
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
    '<div class="card"><h2>Technician portal login</h2><p>Login is <b>' + (t.has_login ? 'enabled' : 'not enabled') + '</b>.' + (t.last_login_at ? ' Last sign-in ' + fmt(t.last_login_at) + '.' : '') + ' The technician signs in at <b>' + esc(location.origin) + '/tech.html</b> with their Technician ID or mobile number and a password, and sees only their own assigned jobs.</p><div class="row noprint">' + (t.verification_status === 'verified' ? '<button class="btn o" data-l="' + (t.has_login ? 'reset' : 'create') + '">' + (t.has_login ? 'Reset password' : 'Enable portal login') + '</button>' + (t.has_login ? '<button class="btn ghost" data-l="revoke">Revoke access</button>' : '') : '<span style="color:var(--m)">Verify the technician first.</span>') + '</div></div>' +
    '<div class="grid2"><div class="card"><h2>Internal notes</h2><form id="nf" class="noprint"><textarea id="nt" rows="2" placeholder="Add a private note"></textarea><p><button class="btn">Add note</button></p></form>' +
    (p.notes.length ? '<ul class="list">' + p.notes.map(function (n) { return '<li>' + esc(n.note) + '<br><small>' + esc(n.admin || '') + ' · ' + fmt(n.created_at) + '</small></li>'; }).join('') + '</ul>' : '<p class="empty">No notes yet.</p>') + '</div>' +
    '<div class="card"><h2>Activity log</h2>' + (p.activity.length ? '<ul class="list">' + p.activity.map(function (a) { return '<li>' + esc(label(a.action)) + (a.reason ? ': ' + esc(a.reason) : '') + '<br><small>' + esc(a.admin || 'System') + ' · ' + fmt(a.created_at) + '</small></li>'; }).join('') + '</ul>' : '<p class="empty">No activity yet.</p>') + '</div></div>' +
    '<div class="card"><h2>Job, cash and settlement history</h2><p class="empty">Detailed job history, the cash ledger and settlement review arrive in Stage 2. The totals above already read from the database.</p></div>');
  var reload = function () { cats = null; route(); };
  document.querySelectorAll('[data-l]').forEach(function (b) {
    b.onclick = async function () {
      var a = b.dataset.l;
      if (a === 'revoke') { var r = await ask('Revoke portal access for ' + t.full_name + '?', true, 'Reason', 'Revoke'); if (r === null) return; try { await api('/technicians/' + code + '/login-access', { method: 'POST', body: { action: 'revoke' } }); toast('Access revoked'); reload(); } catch (e) { toast(e.message); } return; }
      try {
        var d = await api('/technicians/' + code + '/login-access', { method: 'POST', body: { action: a } });
        var msg = 'Hello ' + d.name + ', your QuickFix Barak technician portal is ready.\nLink: ' + location.origin + '/tech.html\nLogin: ' + d.tech_code + ' (or your mobile number)\nTemporary password: ' + d.password + '\nPlease change the password after your first login.';
        var p = modal('Portal login ready', '<div class="note">Shown only once. Send it to the technician now.</div><div class="idbox" style="margin:10px 0">' + esc(d.password) + '</div><pre style="white-space:pre-wrap;background:#f2f4f8;padding:10px;border-radius:8px;font:13px system-ui">' + esc(msg) + '</pre><p class="row"><button type="button" class="btn ghost" id="cpm">Copy message</button><a class="btn g" target="_blank" rel="noopener" href="https://wa.me/91' + esc(d.mobile) + '?text=' + encodeURIComponent(msg) + '">Send on WhatsApp</a></p>', 'Done');
        $('#cpm').onclick = function () { navigator.clipboard.writeText(msg).then(function () { toast('Message copied'); }); };
        await p; reload();
      } catch (e) { toast(e.message); }
    };
  });
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

// ---------- Stage 2: bookings ----------
function istInput(d) {
  if (!d) return '';
  var p = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(d)).reduce(function (a, x) { a[x.type] = x.value; return a; }, {});
  return p.year + '-' + p.month + '-' + p.day + 'T' + p.hour + ':' + p.minute;
}
function modal(title, body, okText, getVals) {
  return new Promise(function (res) {
    var d = $('#dlg'), out = null;
    d.innerHTML = '<form method="dialog"><h2>' + esc(title) + '</h2>' + body + '<p class="err" id="re"></p><div class="row"><button class="btn o" value="ok">' + esc(okText || 'Confirm') + '</button><button class="btn ghost" value="cancel" formnovalidate>Cancel</button></div></form>';
    d.showModal();
    $('form', d).onsubmit = function (e) { if (e.submitter.value !== 'ok') return; var r = getVals ? getVals(d) : {}; if (typeof r === 'string') { e.preventDefault(); $('#re').textContent = r; } else out = r; };
    d.onclose = function () { res(d.returnValue === 'ok' ? out : null); };
  });
}
var SRC = [['whatsapp', 'WhatsApp'], ['phone', 'Phone call'], ['website', 'Website'], ['walk_in', 'Walk-in'], ['other', 'Other']];
function opts(arr, cur) { return arr.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (String(cur || '') === String(o[0]) ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join(''); }
function pager(r, mk) { return '<div class="row sb"><span style="color:var(--m)">' + r.total + ' result' + (r.total === 1 ? '' : 's') + ' · page ' + r.page + ' of ' + r.pages + '</span><span class="row">' + (r.page > 1 ? '<a class="btn ghost" href="' + mk(r.page - 1) + '">Previous</a>' : '') + (r.page < r.pages ? '<a class="btn ghost" href="' + mk(r.page + 1) + '">Next</a>' : '') + '</span></div>'; }

async function bookingListView(qp) {
  var cs = (await getCats()).filter(function (c) { return c.is_active; }), r = await api('/bookings?' + new URLSearchParams(qp).toString());
  var ST = ['requested', 'confirmed', 'assigned', 'en_route', 'arrived', 'diagnosing', 'quote_pending', 'quote_accepted', 'quote_rejected', 'in_progress', 'completed', 'cancelled', 'disputed'].map(function (s) { return [s, label(s)]; });
  shell('<div class="row sb"><h1>Bookings</h1><a class="btn o" href="#/bookings/new">+ New booking</a></div>' +
    '<form class="card" id="flt"><div class="grid2"><label class="fl">Search<input id="fq" placeholder="Booking no., customer name or mobile" value="' + esc(qp.q) + '"></label><label class="fl">Area<input id="fa" placeholder="e.g. Hailakandi" value="' + esc(qp.area) + '"></label></div>' +
    '<div class="row" style="margin-top:12px"><label class="fl">Service<select id="fc"><option value="">All</option>' + opts(cs.map(function (c) { return [c.id, c.name]; }), qp.category) + '</select></label>' +
    '<label class="fl">Status<select id="fs"><option value="">All</option>' + opts(ST, qp.status) + '</select></label>' +
    '<label class="fl">Technician<select id="fg"><option value="">Any</option>' + opts([['unassigned', 'Not assigned yet'], ['assigned', 'Assigned']], qp.assignment) + '</select></label><button class="btn" style="align-self:end">Apply</button></div></form>' +
    '<div class="card tw">' + (r.rows.length ? '<table><thead><tr><th>Booking</th><th>Customer</th><th>Service</th><th>Area</th><th>Preferred time</th><th>Technician</th><th>Status</th></tr></thead><tbody>' +
    r.rows.map(function (b) { return '<tr><td><a href="#/bookings/' + esc(b.booking_code) + '"><b>' + esc(b.booking_code) + '</b></a></td><td>' + esc(b.customer) + '<br><small style="color:var(--m)">' + esc(b.mobile) + '</small></td><td>' + esc(b.service) + '</td><td>' + esc(b.locality) + '</td><td>' + (b.preferred_at ? fmt(b.preferred_at) : '-') + '</td><td>' + (b.tech_code ? '<a href="#/technicians/' + esc(b.tech_code) + '">' + esc(b.tech_name) + '</a>' : '<span class="badge b-pending">Not assigned</span>') + '</td><td>' + badge(b.work_status) + '</td></tr>'; }).join('') + '</tbody></table>'
      : '<p class="empty">No bookings found. <a href="#/bookings/new">Add the first booking</a>.</p>') + '</div>' + pager(r, function (p) { return '#/bookings?' + new URLSearchParams(Object.assign({}, qp, { page: p })).toString(); }));
  $('#flt').onsubmit = function (e) {
    e.preventDefault(); var p = { q: $('#fq').value.trim(), area: $('#fa').value.trim(), category: $('#fc').value, status: $('#fs').value, assignment: $('#fg').value }, o = {};
    Object.keys(p).forEach(function (k) { if (p[k]) o[k] = p[k]; }); location.hash = '#/bookings' + (Object.keys(o).length ? '?' + new URLSearchParams(o).toString() : '');
  };
}

async function bookingFormView() {
  var cs = (await getCats()).filter(function (c) { return c.is_active; });
  shell('<h1>New booking</h1><p style="color:var(--m)">Enter an order received on WhatsApp, phone or in person.</p><form class="card" id="bf" novalidate>' +
    '<div class="grid2"><label class="fl">Customer mobile <b class="rq">*</b><input name="mobile" type="tel" inputmode="numeric" autocomplete="off"></label><label class="fl">Customer name <b class="rq">*</b><input name="name"></label>' +
    '<label class="fl">Email (optional)<input name="email" type="email"></label><label class="fl">Town / locality <b class="rq">*</b><input name="locality" value="Hailakandi"></label></div>' +
    '<label class="fl" style="margin-top:12px">Service address <b class="rq">*</b><textarea name="address" rows="2"></textarea></label>' +
    '<div class="grid2" style="margin-top:12px"><label class="fl">Service <b class="rq">*</b><select name="category_id"><option value="">Choose a service</option>' + opts(cs.map(function (c) { return [c.id, c.name]; })) + '</select></label>' +
    '<label class="fl">Preferred date and time<input name="preferred_at" type="datetime-local"></label>' +
    '<label class="fl">Order came from<select name="source">' + opts(SRC) + '</select></label></div>' +
    '<label class="fl" style="margin-top:12px">Problem / notes<textarea name="problem" rows="3"></textarea></label><p class="err" id="ferr" role="alert"></p>' +
    '<div class="row"><a class="btn ghost" href="#/bookings">Cancel</a><button class="btn o">Create booking</button></div></form>');
  var f = $('#bf');
  f.elements.mobile.onblur = async function () {
    var m = this.value.trim(); if (!/\d{10}/.test(m.replace(/\D/g, ''))) return;
    try { var c = await api('/customers/lookup?mobile=' + encodeURIComponent(m)); if (c) { if (!f.elements.name.value) f.elements.name.value = c.name; if (!f.elements.address.value) f.elements.address.value = c.address || ''; if (c.locality) f.elements.locality.value = c.locality; if (!f.elements.email.value) f.elements.email.value = c.email || ''; toast('Existing customer found'); } } catch (e) {}
  };
  f.onsubmit = async function (e) {
    e.preventDefault(); var b = {}; Array.prototype.forEach.call(f.elements, function (el) { if (el.name) b[el.name] = el.value.trim(); });
    if (!b.mobile || !b.name || !b.address || !b.locality || !b.category_id) { $('#ferr').textContent = 'Please fill the customer mobile, name, address, locality and service.'; return; }
    try { var r = await api('/bookings', { method: 'POST', body: b }); toast('Booking ' + r.booking_code + ' created'); location.hash = '#/bookings/' + r.booking_code; } catch (er) { $('#ferr').textContent = er.message; }
  };
}

async function bookingDetailView(code) {
  var d = await api('/bookings/' + code), b = d.booking, cur = d.current, open = ['completed', 'cancelled'].indexOf(b.work_status) < 0;
  var kv = function (r) { return '<dl class="kv">' + r.map(function (x) { return '<dt>' + esc(x[0]) + '</dt><dd>' + (x[2] ? x[1] : esc(x[1] == null || x[1] === '' ? '-' : x[1])) + '</dd>'; }).join('') + '</dl>'; };
  var wa = 'https://wa.me/91' + esc(b.customer_mobile);
  shell('<div class="card"><div class="row sb"><div><div class="idbox">' + esc(b.booking_code) + '</div><h1 style="margin-top:6px">' + esc(b.service) + '</h1><div class="row" style="margin-top:6px">' + badge(b.work_status) + '<span style="color:var(--m)">Received ' + fmt(b.created_at) + ' via ' + esc((SRC.filter(function (o) { return o[0] === b.source; })[0] || [0, b.source])[1]) + '</span></div></div>' +
    '<div class="row noprint">' + (open ? '<button class="btn ghost" id="rs">Reschedule</button><button class="btn ghost" id="st">Change status</button><button class="btn r" id="cn">Cancel booking</button>' : '') + '</div></div></div>' +
    '<div class="grid2"><div class="card"><h2>Customer</h2>' + kv([['Name', b.customer_name], ['Mobile', '<a href="tel:+91' + esc(b.customer_mobile) + '">' + esc(b.customer_mobile) + '</a> · <a href="' + wa + '" target="_blank" rel="noopener">WhatsApp</a>', 1], ['Address', b.address], ['Locality', b.locality]]) + '</div>' +
    '<div class="card"><h2>Job details</h2>' + kv([['Preferred time', b.preferred_at ? fmt(b.preferred_at) : '-'], ['Problem', b.problem], ['Inspection fee', b.inspection_fee > 0 ? inr(b.inspection_fee) : '-'], ['Cancel reason', b.cancel_reason]]) + '</div></div>' +
    '<div class="card"><h2>Technician</h2>' + (cur ? '<p><b><a href="#/technicians/' + esc(cur.tech_code) + '">' + esc(cur.tech_code) + ' · ' + esc(cur.full_name) + '</a></b> · ' + esc(cur.mobile) + '<br><small style="color:var(--m)">Assigned ' + fmt(cur.assigned_at) + ' by ' + esc(cur.assigned_by || 'admin') + '</small></p>' : '<p class="err">No technician assigned yet.</p>') +
    (open ? '<div class="row noprint">' + (cur ? '<button class="btn ghost" id="fnd">Reassign to someone else</button>' : '<button class="btn o" id="fnd">Find technician</button>') + '</div><div id="cand"></div>' : '') + '</div>' +
    '<div class="grid2"><div class="card"><h2>Assignment history</h2>' + (d.history.length ? '<ul class="list">' + d.history.map(function (h) { return '<li><b>' + esc(h.tech_code) + '</b> ' + esc(h.full_name) + (h.is_current ? ' ' + badge('active') : '') + '<br><small>' + fmt(h.assigned_at) + (h.ended_at ? ' to ' + fmt(h.ended_at) : '') + (h.reason ? ' · ' + esc(h.reason) : '') + '</small></li>'; }).join('') + '</ul>' : '<p class="empty">Nobody assigned yet.</p>') + '</div>' +
    '<div class="card"><h2>Activity</h2><ul class="list">' + d.activity.map(function (a) { var who = a.details && a.details.actor === 'technician' ? 'Technician ' + a.details.tech_code : (a.admin || 'System'); return '<li>' + esc(label(a.action.replace('booking.', '').replace('status.', 'status: '))) + (a.reason ? ': ' + esc(a.reason) : '') + '<br><small>' + esc(who) + ' · ' + fmt(a.created_at) + '</small></li>'; }).join('') + '</ul></div></div>');
  var reload = function () { route(); };
  if ($('#fnd')) $('#fnd').onclick = async function () {
    var box = $('#cand'); box.innerHTML = '<p>Finding technicians...</p>';
    async function load(area) {
      try {
        var c = await api('/bookings/' + code + '/candidates' + (area != null ? '?area=' + encodeURIComponent(area) : '')), only = $('#oa') ? $('#oa').checked : false;
        var rows = c.rows.filter(function (t) { return !t.is_current && (!only || t.area_match); });
        box.innerHTML = '<div class="note">Showing active, verified technicians approved for <b>' + esc(c.service) + '</b>. Best matches first: same area, then fewest open jobs, then rating.</div>' +
          '<div class="row noprint"><label class="fl">Area<input id="ar" value="' + esc(c.area) + '"></label><label class="ck" style="align-self:end"><input type="checkbox" id="oa"' + (only ? ' checked' : '') + '> Only this area</label><button class="btn" id="sr" style="align-self:end">Search</button></div>' +
          (rows.length ? '<div class="tw"><table><thead><tr><th>Technician</th><th>Base area</th><th>Open jobs</th><th>Same day</th><th>Rating</th><th></th></tr></thead><tbody>' + rows.map(function (t) { return '<tr><td><b>' + esc(t.tech_code) + '</b> ' + esc(t.full_name) + '<br><small style="color:var(--m)">' + esc(t.mobile) + (t.own_transport ? ' · own transport' : '') + '</small></td><td>' + esc(t.locality) + (t.area_match ? ' <span class="badge b-verified">Area match</span>' : '') + '</td><td>' + t.open_jobs + '</td><td>' + t.same_day_jobs + '</td><td>' + (t.rating || '-') + '</td><td><button class="btn o" data-as="' + esc(t.tech_code) + '" data-nm="' + esc(t.full_name) + '">Assign</button></td></tr>'; }).join('') + '</tbody></table></div>' : '<p class="empty">No matching technicians. Try another area, or approve more technicians for this service.</p>');
        $('#sr').onclick = function (e) { e.preventDefault(); load($('#ar').value.trim()); };
        $('#oa').onchange = function () { load($('#ar').value.trim()); };
        box.querySelectorAll('[data-as]').forEach(function (bt) {
          bt.onclick = async function () {
            var r = await ask('Assign ' + bt.dataset.nm + ' to ' + code + '?', !!cur, cur ? 'Reason for reassigning (required)' : 'Note for the technician (optional)', 'Assign'); if (r === null) return;
            try { await api('/bookings/' + code + '/assign', { method: 'POST', body: { technician_code: bt.dataset.as, reason: r } }); toast('Technician assigned'); reload(); } catch (er) { toast(er.message); }
          };
        });
      } catch (er) { box.innerHTML = '<p class="err">' + esc(er.message) + '</p>'; }
    }
    load();
  };
  if ($('#rs')) $('#rs').onclick = async function () {
    var v = await modal('Reschedule ' + code, '<label class="fl">New date and time <b class="rq">*</b><input type="datetime-local" id="nd" value="' + istInput(b.preferred_at) + '"></label><p><label class="fl">Reason <b class="rq">*</b><textarea id="rr" rows="2"></textarea></label></p>', 'Reschedule', function () { if (!$('#nd').value) return 'Choose a date and time.'; if ($('#rr').value.trim().length < 3) return 'Please enter a reason.'; return { at: $('#nd').value, reason: $('#rr').value.trim() }; });
    if (!v) return; try { await api('/bookings/' + code + '/reschedule', { method: 'POST', body: { preferred_at: v.at, reason: v.reason } }); toast('Rescheduled'); reload(); } catch (er) { toast(er.message); }
  };
  async function setStatus(st, reason) { try { await api('/bookings/' + code + '/status', { method: 'POST', body: { status: st, reason: reason } }); toast('Status updated'); reload(); } catch (er) { toast(er.message); } }
  if ($('#cn')) $('#cn').onclick = async function () { var r = await ask('Cancel booking ' + code + '?', true, 'Reason for cancelling', 'Cancel booking'); if (r !== null) setStatus('cancelled', r); };
  if ($('#st')) $('#st').onclick = async function () {
    var all = ['requested', 'confirmed', 'en_route', 'arrived', 'diagnosing', 'quote_pending', 'quote_accepted', 'quote_rejected', 'in_progress', 'completed', 'disputed'].filter(function (s) { return s !== b.work_status; }).map(function (s) { return [s, label(s)]; });
    var v = await modal('Change status of ' + code, '<label class="fl">New status<select id="ns">' + opts(all) + '</select></label><p><label class="fl">Reason (required for disputed and quote rejected)<textarea id="rr" rows="2"></textarea></label></p>', 'Update', function () { var s = $('#ns').value, r = $('#rr').value.trim(); if (['disputed', 'quote_rejected'].indexOf(s) > -1 && r.length < 3) return 'Please enter a reason.'; return { s: s, r: r }; });
    if (v) setStatus(v.s, v.r);
  };
}

// ---------- Stage 2: service categories ----------
async function categoriesView() {
  cats = null; var cs = await getCats();
  shell('<div class="row sb"><h1>Service categories</h1><button class="btn o" id="addc">+ Add service</button></div><p style="color:var(--m)">Technicians are approved per service, and bookings are matched to technicians by service. Retired services stay in history.</p>' +
    '<div class="card tw"><table><thead><tr><th>Order</th><th>Service</th><th>Inspection fee</th><th>Status</th><th></th></tr></thead><tbody>' + cs.map(function (c) { return '<tr><td>' + c.sort_order + '</td><td><b>' + esc(c.name) + '</b><br><small style="color:var(--m)">' + esc(c.description || '') + '</small></td><td>' + (c.inspection_fee != null ? inr(c.inspection_fee) : '-') + '</td><td>' + badge(c.is_active ? 'active' : 'inactive') + '</td><td><button class="btn ghost" data-e="' + c.id + '">Edit</button></td></tr>'; }).join('') + '</tbody></table></div>');
  async function edit(c) {
    c = c || { name: '', description: '', inspection_fee: '', sort_order: 50, is_active: true };
    var v = await modal(c.id ? 'Edit service' : 'Add service', '<label class="fl">Service name <b class="rq">*</b><input id="cn" value="' + esc(c.name) + '"></label><p><label class="fl">Description<input id="cd" value="' + esc(c.description) + '"></label></p><div class="grid2"><label class="fl">Inspection fee (₹)<input id="cf" type="number" min="0" value="' + esc(c.inspection_fee) + '"></label><label class="fl">Display order<input id="co" type="number" min="0" value="' + esc(c.sort_order) + '"></label></div>' + (c.id ? '<label class="ck"><input type="checkbox" id="ca"' + (c.is_active ? ' checked' : '') + '> Active</label><p><label class="fl">Reason (required to deactivate)<input id="cr"></label></p>' : ''), 'Save', function () { if (!$('#cn').value.trim()) return 'Service name is required.'; if (c.id && c.is_active && !$('#ca').checked && $('#cr').value.trim().length < 3) return 'Please give a reason for deactivating.'; return { name: $('#cn').value.trim(), description: $('#cd').value.trim(), inspection_fee: $('#cf').value, sort_order: $('#co').value, is_active: c.id ? $('#ca').checked : true, reason: c.id ? $('#cr').value.trim() : '' }; });
    if (!v) return; try { await api(c.id ? '/categories/' + c.id : '/categories', { method: c.id ? 'PATCH' : 'POST', body: v }); cats = null; toast('Saved'); route(); } catch (er) { toast(er.message); }
  }
  $('#addc').onclick = function () { edit(); };
  document.querySelectorAll('[data-e]').forEach(function (b) { b.onclick = function () { edit(cs.filter(function (c) { return String(c.id) === b.dataset.e; })[0]); }; });
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
    if (path === 'bookings') return await bookingListView(qp);
    if (path === 'bookings/new') return await bookingFormView();
    if ((m = path.match(/^bookings\/(QF-\d+)$/))) return await bookingDetailView(m[1]);
    if (path === 'categories') return await categoriesView();
    if (path === 'soon') return shell('<h1>Coming in Stage 3</h1><div class="card"><p>Cash collection and the commission ledger, settlement verification, and reports with CSV export are the next stage. The database tables for them already exist.</p><a class="btn" href="#/dashboard">Back to dashboard</a></div>');
    shell('<h1>Page not found</h1><a class="btn" href="#/dashboard">Back to dashboard</a>');
  } catch (e) {
    if (e.status === 401) { me = null; return loginView(); }
    if (me) shell('<div class="card"><h2>Something went wrong</h2><p class="err">' + esc(e.message) + '</p><a class="btn" href="#/dashboard">Back to dashboard</a></div>'); else loginView();
  }
}
window.addEventListener('hashchange', route);
route();
})();
