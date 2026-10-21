'use strict';
const { Pool } = require('pg');
const crypto = require('crypto');
const SCHEMA = require('./schema.sql');
const E = process.env;

let pool;
function dbConfig() {
  let u = E.DATABASE_URL || ''; const cfg = { max: 3, idleTimeoutMillis: 10000 };
  // Supabase poolers use their own certificate chain; keep the connection encrypted but let node accept it.
  if (/supabase\.(co|com)/.test(u)) { u = u.replace(/([?&])sslmode=[^&]*&?/, '$1').replace(/[?&]$/, ''); cfg.ssl = { rejectUnauthorized: false }; }
  cfg.connectionString = u; return cfg;
}
const db = () => pool || (pool = new Pool(dbConfig()));
const Q = (s, p) => db().query(s, p);
class HttpError extends Error { constructor(c, m) { super(m); this.code = c; } }
const bad = (m) => new HttpError(400, m);

// ---------- security helpers ----------
const sign = (s) => crypto.createHmac('sha256', E.SESSION_SECRET).update(s).digest('base64url');
const same = (a, b) => { a = Buffer.from(String(a)); b = Buffer.from(String(b)); return a.length === b.length && crypto.timingSafeEqual(a, b); };
const mkToken = (id) => { const p = Buffer.from(JSON.stringify({ sub: id, exp: Date.now() + 8 * 3600e3 })).toString('base64url'); return p + '.' + sign(p); };
function readToken(t) {
  if (!t) return null; const [p, s] = t.split('.');
  if (!p || !s || !same(s, sign(p))) return null;
  try { const o = JSON.parse(Buffer.from(p, 'base64url')); return o.exp > Date.now() ? o.sub : null; } catch { return null; }
}
const hashPw = (pw) => { const s = crypto.randomBytes(16).toString('hex'); return 'scrypt$' + s + '$' + crypto.scryptSync(pw, s, 64).toString('hex'); };
const checkPw = (pw, h) => { const [, s, x] = h.split('$'); return same(crypto.scryptSync(pw, s, 64).toString('hex'), x); };
const cookie = (v, age) => `qfb_session=${v}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${age}`;

// ---------- validation helpers ----------
const S = (v, max = 200) => (v == null ? '' : String(v)).trim().slice(0, max);
const opt = (v, max = 500) => S(v, max) || null;
const req = (v, label, max) => { const x = S(v, max); if (!x) throw bad(label + ' is required'); return x; };
function mob(v, label, required) {
  let x = S(v, 20).replace(/[\s-]/g, '').replace(/^(\+91|91)(?=\d{10}$)/, '');
  if (!x) { if (required) throw bad(label + ' is required'); return null; }
  if (!/^[6-9]\d{9}$/.test(x)) throw bad(label + ' must be a valid 10-digit mobile number');
  return x;
}
const intOrNull = (v, label, min, max) => {
  if (v === '' || v == null) return null; const n = Number(v);
  if (!Number.isInteger(n) || n < min || n > max) throw bad(`${label} must be a whole number between ${min} and ${max}`); return n;
};
function techData(b) {
  const email = S(b.email, 120);
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw bad('Email address is not valid');
  const pin = S(b.pin_code, 6); if (!/^\d{6}$/.test(pin)) throw bad('PIN code must be 6 digits');
  const av = S(b.availability, 20) || null;
  if (av && !['full_time', 'part_time', 'weekend'].includes(av)) throw bad('Invalid availability');
  return {
    full_name: req(b.full_name, 'Full legal name', 120), mobile: mob(b.mobile, 'Mobile number', true),
    alt_mobile: mob(b.alt_mobile, 'Alternate mobile'), email: email || null,
    address: req(b.address, 'Current address', 300), locality: req(b.locality, 'Town/locality', 100), pin_code: pin,
    emergency_name: opt(b.emergency_name, 120), emergency_mobile: mob(b.emergency_mobile, 'Emergency contact number'),
    experience_years: intOrNull(b.experience_years, 'Years of experience', 0, 60), experience_notes: opt(b.experience_notes, 1000),
    qualifications: opt(b.qualifications, 500), tools: opt(b.tools, 500), own_transport: !!b.own_transport,
    working_hours: opt(b.working_hours, 100), availability: av, service_localities: opt(b.service_localities, 300),
    max_distance_km: intOrNull(b.max_distance_km, 'Maximum distance', 0, 500), assessment_notes: opt(b.assessment_notes, 1000),
  };
}
function agreementData(a) {
  a = a || {};
  const basis = S(a.commission_basis, 30), sched = S(a.settlement_schedule, 20), rate = Number(a.commission_rate);
  if (!['labour_only', 'labour_and_parts', 'fixed_per_job', 'custom'].includes(basis)) throw bad('Choose a commission basis');
  if (!['daily', 'weekly', 'fortnightly'].includes(sched)) throw bad('Choose a settlement schedule');
  if (!(rate >= 0 && rate <= 100)) throw bad('Commission rate must be between 0 and 100');
  return { version: S(a.version, 20) || 'v1.0', commission_basis: basis, commission_rate: rate, settlement_schedule: sched };
}
const CHECKS = ['mobile_verified', 'identity_checked', 'address_checked', 'skills_assessed', 'qualifications_reviewed'];
async function skillIds(c, arr) {
  const ids = [...new Set((arr || []).map(Number).filter(Number.isInteger))];
  if (!ids.length) return [];
  const r = await c.query('SELECT id FROM service_categories WHERE is_active AND id = ANY($1)', [ids]);
  if (r.rowCount !== ids.length) throw bad('One or more selected services are not available');
  return ids;
}
function build(kind, table, obj, where) {
  const k = Object.keys(obj), v = Object.values(obj);
  if (kind === 'ins') return [`INSERT INTO ${table} (${k.join(',')}) VALUES (${k.map((_, i) => '$' + (i + 1)).join(',')}) RETURNING *`, v];
  return [`UPDATE ${table} SET ${k.map((x, i) => x + '=$' + (i + 1)).join(',')}, updated_at=now() WHERE ${where[0]}=$${k.length + 1} RETURNING *`, [...v, where[1]]];
}
async function tx(fn) {
  const c = await db().connect();
  try { await c.query('BEGIN'); const r = await fn(c); await c.query('COMMIT'); return r; }
  catch (e) { await c.query('ROLLBACK').catch(() => {}); throw e; } finally { c.release(); }
}
const audit = (c, x, action, type, id, reason, details) =>
  c.query('INSERT INTO audit_logs(admin_id,action,entity_type,entity_id,reason,details,ip) VALUES($1,$2,$3,$4,$5,$6,$7)',
    [x.admin ? x.admin.id : null, action, type, id, reason || null, details ? JSON.stringify(details) : null, x.ip]);
const dupMsg = (e) => { if (e.code === '23505') { if (/mobile/.test(e.detail || e.constraint || '')) return 'A technician with this mobile number already exists'; return 'This record already exists'; } };

// ---------- routes ----------
const routes = [];
const R = (m, p, fn, pub) => routes.push([m, new RegExp('^' + p + '/?$'), fn, pub]);
const TC = '(QFB-TECH-\\d{4,})';

R('GET', '/setup/status', async () => {
  const out = { configured: !!(E.DATABASE_URL && E.SESSION_SECRET && E.SESSION_SECRET.length >= 32 && E.SETUP_TOKEN), tables: false, hasAdmin: false };
  if (!E.DATABASE_URL) return out;
  try { const r = await Q("SELECT to_regclass('public.admin_users') t"); out.tables = !!r.rows[0].t;
    if (out.tables) out.hasAdmin = (await Q('SELECT 1 FROM admin_users LIMIT 1')).rowCount > 0; } catch (e) {
  console.error("Setup status database error:", e?.message || e);
  out.dbError = true;
}
  return out;
}, true);

R('POST', '/setup', async (x) => {
  if (!E.SETUP_TOKEN || E.SETUP_TOKEN.length < 12) throw new HttpError(500, 'SETUP_TOKEN is not set on the server (min 12 characters)');
  if (!same(S(x.body.token, 200), E.SETUP_TOKEN)) throw new HttpError(403, 'Setup token is incorrect');
  if (x.body.action === 'migrate') { await Q(SCHEMA); return { ok: true, message: 'Database tables are ready' }; }
  if (x.body.action === 'create_admin') {
    if ((await Q('SELECT 1 FROM admin_users LIMIT 1')).rowCount) throw new HttpError(403, 'An administrator already exists. Setup is closed.');
    const email = req(x.body.email, 'Email', 120).toLowerCase(), name = req(x.body.name, 'Name', 100), pw = S(x.body.password, 200);
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw bad('Email address is not valid');
    if (pw.length < 10) throw bad('Password must be at least 10 characters');
    const r = await Q("INSERT INTO admin_users(email,name,role,password_hash) VALUES($1,$2,'owner',$3) RETURNING id", [email, name, hashPw(pw)]);
    await audit({ query: (...a) => Q(...a) }, { admin: { id: r.rows[0].id }, ip: x.ip }, 'admin.created', 'admin', r.rows[0].id, 'First owner account created');
    return { ok: true };
  }
  throw bad('Unknown setup action');
}, true);

R('POST', '/login', async (x) => {
  const email = S(x.body.email, 120).toLowerCase(), pw = S(x.body.password, 200);
  const r = await Q('SELECT * FROM admin_users WHERE email=$1', [email]);
  const a = r.rows[0], fail = new HttpError(401, 'Incorrect email or password');
  if (!a) { crypto.scryptSync(pw, 'x', 64); throw fail; }
  if (a.locked_until && a.locked_until > new Date()) throw new HttpError(429, 'Too many attempts. Try again in 15 minutes.');
  if (!a.is_active || !checkPw(pw, a.password_hash)) {
    await Q("UPDATE admin_users SET failed_attempts=failed_attempts+1, locked_until=CASE WHEN failed_attempts+1>=5 THEN now()+interval '15 minutes' END WHERE id=$1", [a.id]);
    await audit({ query: (...q) => Q(...q) }, { admin: { id: a.id }, ip: x.ip }, 'login.failed', 'admin', a.id);
    throw fail;
  }
  await Q('UPDATE admin_users SET failed_attempts=0, locked_until=NULL, last_login_at=now() WHERE id=$1', [a.id]);
  await audit({ query: (...q) => Q(...q) }, { admin: a, ip: x.ip }, 'login', 'admin', a.id);
  return { body: { name: a.name, email: a.email, role: a.role }, cookie: cookie(mkToken(a.id), 28800) };
}, true);

R('POST', '/logout', async (x) => ({ body: { ok: true }, cookie: cookie('', 0) }), true);
R('GET', '/me', async (x) => ({ name: x.admin.name, email: x.admin.email, role: x.admin.role }));
R('GET', '/categories', async () => (await Q('SELECT id,name,is_active FROM service_categories ORDER BY sort_order,name')).rows);

R('GET', '/dashboard', async () => {
  const c = (await Q(`SELECT
   (SELECT count(*) FROM technicians) tech_total,
   (SELECT count(*) FROM technicians WHERE status='active') tech_active,
   (SELECT count(*) FROM technicians WHERE verification_status IN ('pending','under_review')) tech_pending,
   (SELECT count(*) FROM technicians WHERE status='suspended') tech_suspended,
   (SELECT count(*) FROM customers) customers,
   (SELECT count(*) FROM bookings) bookings,
   (SELECT count(*) FROM bookings WHERE work_status IN ('requested','confirmed','assigned')) bookings_open,
   (SELECT count(*) FROM bookings WHERE work_status='completed') bookings_done,
   (SELECT COALESCE(sum(amount_collected),0) FROM payments)-(SELECT COALESCE(sum(amount),0) FROM payment_adjustments WHERE kind='refund') cash,
   (SELECT COALESCE(sum(commission_amount),0) FROM technician_commission_ledger) owed,
   (SELECT COALESCE(sum(amount_settled),0) FROM technician_settlements WHERE status='verified') settled`)).rows[0];
  const n = (k) => Number(c[k]);
  return {
    cards: { tech_total: n('tech_total'), tech_active: n('tech_active'), tech_pending: n('tech_pending'), tech_suspended: n('tech_suspended'),
      customers: n('customers'), bookings: n('bookings'), bookings_open: n('bookings_open'), bookings_done: n('bookings_done'),
      cash: n('cash'), owed: n('owed'), outstanding: n('owed') - n('settled'), settled: n('settled') },
    activity: (await Q(`SELECT a.action,a.entity_id,a.reason,a.created_at,u.name admin FROM audit_logs a LEFT JOIN admin_users u ON u.id=a.admin_id WHERE a.action NOT IN ('login','login.failed') ORDER BY a.id DESC LIMIT 8`)).rows,
    bookings: (await Q(`SELECT b.booking_code,b.work_status,b.created_at,cu.name customer,sc.name service FROM bookings b JOIN customers cu ON cu.id=b.customer_id JOIN service_categories sc ON sc.id=b.category_id ORDER BY b.created_at DESC LIMIT 5`)).rows,
    approvals: (await Q(`SELECT tech_code,full_name,verification_status,created_at FROM technicians WHERE verification_status IN ('pending','under_review') ORDER BY created_at LIMIT 6`)).rows,
    overdue: (await Q(`SELECT s.id,t.tech_code,t.full_name,s.due_date,(s.commission_due+s.adjustments-s.amount_settled) balance FROM technician_settlements s JOIN technicians t ON t.id=s.technician_id WHERE s.status IN ('pending','submitted','rejected') AND s.due_date<current_date ORDER BY s.due_date LIMIT 6`)).rows,
  };
});

R('GET', '/technicians', async (x) => {
  const q = x.query, w = [], p = [], add = (sql, v) => { p.push(v); w.push(sql.replace('?', '$' + p.length)); };
  if (q.q) { p.push('%' + S(q.q, 60).toLowerCase() + '%'); w.push(`(lower(t.tech_code) LIKE $${p.length} OR lower(t.full_name) LIKE $${p.length} OR t.mobile LIKE $${p.length})`); }
  if (q.status) add('t.status=?', S(q.status, 20));
  if (q.verification) add('t.verification_status=?', S(q.verification, 20));
  if (q.area) add('lower(t.locality) LIKE ?', '%' + S(q.area, 60).toLowerCase() + '%');
  if (q.category) add('EXISTS (SELECT 1 FROM technician_skills s WHERE s.technician_id=t.id AND s.approved AND s.category_id=?)', parseInt(q.category, 10) || 0);
  const sorts = { created: 't.created_at', name: 't.full_name', code: 't.tech_code', experience: 't.experience_years' };
  const col = sorts[q.sort] || 't.created_at', dir = q.dir === 'asc' ? 'ASC' : 'DESC';
  const page = Math.max(1, parseInt(q.page, 10) || 1), size = 15, where = w.length ? 'WHERE ' + w.join(' AND ') : '';
  const total = Number((await Q(`SELECT count(*) FROM technicians t ${where}`, p)).rows[0].count);
  const rows = (await Q(`SELECT t.tech_code,t.full_name,t.mobile,t.locality,t.status,t.verification_status,t.experience_years,t.created_at,
    (SELECT string_agg(c.name,', ' ORDER BY c.sort_order) FROM technician_skills s JOIN service_categories c ON c.id=s.category_id WHERE s.technician_id=t.id AND s.approved) skills
    FROM technicians t ${where} ORDER BY ${col} ${dir}, t.id LIMIT ${size} OFFSET ${(page - 1) * size}`, p)).rows;
  return { rows, total, page, pages: Math.max(1, Math.ceil(total / size)) };
});

R('POST', '/technicians', async (x) => {
  const d = techData(x.body), b = x.body, ag = b.agreement && b.agreement.accepted ? agreementData(b.agreement) : null;
  try {
    return await tx(async (c) => {
      const ids = await skillIds(c, b.skills);
      if ((await c.query('SELECT 1 FROM technicians WHERE mobile=$1', [d.mobile])).rowCount) throw new HttpError(409, 'A technician with this mobile number already exists');
      const code = (await c.query("SELECT 'QFB-TECH-' || lpad(nextval('technician_code_seq')::text, 4, '0') AS code")).rows[0].code;
      const [sql, v] = build('ins', 'technicians', { ...d, tech_code: code, created_by: x.admin.id });
      const t = (await c.query(sql, v)).rows[0];
      for (const id of ids) await c.query('INSERT INTO technician_skills(technician_id,category_id,approved_by) VALUES($1,$2,$3)', [t.id, id, x.admin.id]);
      const vc = b.verification || {};
      await c.query(`INSERT INTO technician_verifications(technician_id,${CHECKS.join(',')}) VALUES($1,${CHECKS.map((_, i) => '$' + (i + 2)).join(',')})`, [t.id, ...CHECKS.map((k) => !!vc[k])]);
      if (ag) await c.query('INSERT INTO technician_agreements(technician_id,version,commission_basis,commission_rate,settlement_schedule,recorded_by) VALUES($1,$2,$3,$4,$5,$6)', [t.id, ag.version, ag.commission_basis, ag.commission_rate, ag.settlement_schedule, x.admin.id]);
      await audit(c, x, 'technician.created', 'technician', code, null, { name: d.full_name });
      return { tech_code: code };
    });
  } catch (e) { const m = dupMsg(e); if (m) throw new HttpError(409, m); throw e; }
});

async function loadTech(code) {
  const t = (await Q('SELECT * FROM technicians WHERE tech_code=$1', [code])).rows[0];
  if (!t) throw new HttpError(404, 'Technician not found'); return t;
}

R('GET', '/technicians/' + TC, async (x) => {
  const t = await loadTech(x.params[0]), id = t.id;
  const one = async (s, p) => (await Q(s, p || [id])).rows;
  const st = (await Q(`SELECT
    (SELECT count(*) FROM booking_assignments WHERE technician_id=$1) assigned,
    (SELECT count(*) FROM booking_assignments a JOIN bookings b ON b.id=a.booking_id WHERE a.technician_id=$1 AND a.is_current AND b.work_status='completed') completed,
    (SELECT count(*) FROM booking_assignments a JOIN bookings b ON b.id=a.booking_id WHERE a.technician_id=$1 AND b.work_status='cancelled') cancelled,
    (SELECT round(avg(rating),1) FROM reviews WHERE technician_id=$1) rating,
    (SELECT count(*) FROM complaints WHERE technician_id=$1) complaints,
    (SELECT COALESCE(sum(amount_collected),0) FROM payments WHERE technician_id=$1)-(SELECT COALESCE(sum(ad.amount),0) FROM payment_adjustments ad JOIN payments p ON p.id=ad.payment_id WHERE ad.kind='refund' AND p.technician_id=$1) cash,
    (SELECT COALESCE(sum(commission_amount),0) FROM technician_commission_ledger WHERE technician_id=$1) owed,
    (SELECT COALESCE(sum(amount_settled),0) FROM technician_settlements WHERE technician_id=$1 AND status='verified') settled`, [id])).rows[0];
  return {
    tech: t, stats: { ...st, outstanding: Number(st.owed) - Number(st.settled) },
    categories: await one('SELECT c.id,c.name,(s.technician_id IS NOT NULL AND s.approved) approved FROM service_categories c LEFT JOIN technician_skills s ON s.category_id=c.id AND s.technician_id=$1 WHERE c.is_active OR s.technician_id IS NOT NULL ORDER BY c.sort_order'),
    verification: (await one('SELECT v.*,u.name verified_by_name FROM technician_verifications v LEFT JOIN admin_users u ON u.id=v.verified_by WHERE technician_id=$1'))[0],
    agreement: (await one('SELECT * FROM technician_agreements WHERE technician_id=$1 ORDER BY accepted_at DESC LIMIT 1'))[0] || null,
    notes: await one('SELECT n.note,n.created_at,u.name admin FROM technician_notes n LEFT JOIN admin_users u ON u.id=n.admin_id WHERE technician_id=$1 ORDER BY n.id DESC LIMIT 30'),
    activity: await one(`SELECT a.action,a.reason,a.created_at,u.name admin FROM audit_logs a LEFT JOIN admin_users u ON u.id=a.admin_id WHERE a.entity_type='technician' AND a.entity_id=$1 ORDER BY a.id DESC LIMIT 30`, [t.tech_code]),
  };
});

R('PATCH', '/technicians/' + TC, async (x) => {
  const t = await loadTech(x.params[0]), d = techData(x.body);
  try {
    await tx(async (c) => {
      const [sql, v] = build('upd', 'technicians', d, ['id', t.id]); await c.query(sql, v);
      if (Array.isArray(x.body.skills)) {
        const ids = await skillIds(c, x.body.skills);
        await c.query('DELETE FROM technician_skills WHERE technician_id=$1 AND NOT (category_id = ANY($2))', [t.id, ids]);
        for (const id of ids) await c.query('INSERT INTO technician_skills(technician_id,category_id,approved_by) VALUES($1,$2,$3) ON CONFLICT DO NOTHING', [t.id, id, x.admin.id]);
      }
      await audit(c, x, 'technician.edited', 'technician', t.tech_code);
    });
  } catch (e) { const m = dupMsg(e); if (m) throw new HttpError(409, m); throw e; }
  return { ok: true };
});

R('POST', '/technicians/' + TC + '/status', async (x) => {
  const t = await loadTech(x.params[0]), act = S(x.body.action, 20), reason = S(x.body.reason, 500);
  const rules = { activate: [['pending', 'inactive'], 'active', false], deactivate: [['active'], 'inactive', true], suspend: [['active', 'inactive', 'pending'], 'suspended', true], reinstate: [['suspended'], 'active', true] };
  const r = rules[act]; if (!r) throw bad('Unknown action');
  if (!r[0].includes(t.status)) throw bad(`Cannot ${act} a technician whose status is ${t.status}`);
  if (r[2] && reason.length < 3) throw bad('A reason is required');
  if (r[1] === 'active') {
    if (t.verification_status !== 'verified') throw bad('Only verified technicians can be activated');
    if (!(await Q('SELECT 1 FROM technician_agreements WHERE technician_id=$1', [t.id])).rowCount) throw bad('Record the accepted agreement first');
    if (!(await Q('SELECT 1 FROM technician_skills WHERE technician_id=$1 AND approved', [t.id])).rowCount) throw bad('Approve at least one skill first');
  }
  await tx(async (c) => { await c.query('UPDATE technicians SET status=$1, updated_at=now() WHERE id=$2', [r[1], t.id]); await audit(c, x, 'technician.' + act, 'technician', t.tech_code, reason, { from: t.status, to: r[1] }); });
  return { ok: true, status: r[1] };
});

R('POST', '/technicians/' + TC + '/verification', async (x) => {
  const t = await loadTech(x.params[0]), b = x.body, status = S(b.status, 20), reason = S(b.reason, 500);
  if (!['pending', 'under_review', 'verified', 'rejected'].includes(status)) throw bad('Invalid verification status');
  if (status === 'rejected' && reason.length < 3) throw bad('A reason is required to reject');
  const ch = CHECKS.map((k) => !!(b.checks || {})[k]), cur = (await Q('SELECT 1 FROM technician_agreements WHERE technician_id=$1', [t.id])).rowCount;
  if (status === 'verified') {
    if (!(ch[1] && ch[3])) throw bad('Identity must be checked and skills assessed before verifying');
    if (!cur) throw bad('Record the accepted agreement before verifying');
  }
  await tx(async (c) => {
    await c.query(`UPDATE technician_verifications SET ${CHECKS.map((k, i) => k + '=$' + (i + 1)).join(',')}, notes=$6, rejection_reason=$7, verified_at=$8, verified_by=$9, updated_at=now() WHERE technician_id=$10`,
      [...ch, opt(b.notes, 1000), status === 'rejected' ? reason : null, status === 'verified' ? new Date() : null, status === 'verified' ? x.admin.id : null, t.id]);
    await c.query('UPDATE technicians SET verification_status=$1, status=CASE WHEN $1 IN (\'rejected\',\'pending\',\'under_review\') AND status=\'active\' THEN \'inactive\' ELSE status END, updated_at=now() WHERE id=$2', [status, t.id]);
    await audit(c, x, 'technician.verification.' + status, 'technician', t.tech_code, reason || null);
  });
  return { ok: true };
});

R('POST', '/technicians/' + TC + '/agreement', async (x) => {
  const t = await loadTech(x.params[0]); if (!x.body.accepted) throw bad('Confirm that the technician accepted the agreement');
  const a = agreementData(x.body);
  await tx(async (c) => {
    await c.query('INSERT INTO technician_agreements(technician_id,version,commission_basis,commission_rate,settlement_schedule,recorded_by) VALUES($1,$2,$3,$4,$5,$6)', [t.id, a.version, a.commission_basis, a.commission_rate, a.settlement_schedule, x.admin.id]);
    await audit(c, x, 'technician.agreement', 'technician', t.tech_code, null, a);
  });
  return { ok: true };
});

R('POST', '/technicians/' + TC + '/notes', async (x) => {
  const t = await loadTech(x.params[0]), note = req(x.body.note, 'Note', 1000);
  await tx(async (c) => { await c.query('INSERT INTO technician_notes(technician_id,admin_id,note) VALUES($1,$2,$3)', [t.id, x.admin.id, note]); await audit(c, x, 'technician.note', 'technician', t.tech_code); });
  return { ok: true };
});

// ---------- entry ----------
const J = (code, body, extra) => ({ statusCode: code, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...(extra || {}) }, body: JSON.stringify(body) });
exports.handler = async (event) => {
  try {
    if (!E.DATABASE_URL || !E.SESSION_SECRET || E.SESSION_SECRET.length < 32) throw new HttpError(500, 'Server is not configured. Set DATABASE_URL and SESSION_SECRET (32+ characters) in Netlify.');
    const path = event.path.replace(/^\/(\.netlify\/functions\/api|api)/, '') || '/', m = event.httpMethod;
    const h = {}; for (const k in event.headers) h[k.toLowerCase()] = event.headers[k];
    if (m !== 'GET' && (h['x-qfb'] !== '1' || !/json/.test(h['content-type'] || ''))) throw new HttpError(403, 'Request blocked');
    let body = {}; if (event.body) { try { body = JSON.parse(event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString() : event.body); } catch { throw bad('Invalid request'); } }
    const x = { body, query: event.queryStringParameters || {}, ip: (h['x-nf-client-connection-ip'] || h['x-forwarded-for'] || '').split(',')[0].trim(), admin: null };
    for (const [rm, re, fn, pub] of routes) {
      const mt = path.match(re); if (rm !== m || !mt) continue;
      x.params = mt.slice(1);
      if (!pub) {
        const sid = readToken((h.cookie || '').split(';').map((s) => s.trim()).find((s) => s.startsWith('qfb_session='))?.slice(12));
        const a = sid && (await Q('SELECT id,name,email,role FROM admin_users WHERE id=$1 AND is_active', [sid])).rows[0];
        if (!a) throw new HttpError(401, 'Please sign in'); x.admin = a;
      }
      const out = await fn(x);
      return out && out.cookie ? J(200, out.body, { 'Set-Cookie': out.cookie }) : J(200, out);
    }
    throw new HttpError(404, 'Not found');
  } catch (e) {
    if (e instanceof HttpError) return J(e.code, { error: e.message });
    console.error(e);
    return J(500, { error: 'Something went wrong on the server' });
  }
};
