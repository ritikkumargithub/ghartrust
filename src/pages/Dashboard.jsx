import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../supabase.js'
import { Loading } from '../Loading.jsx'
import PayModal from '../components/PayModal.jsx'
import { FEE_PAISE, inr } from '../lib.js'

const empty = { tenant_name: '', tenant_phone: '', tenant_email: '', property_label: '' }
const linkFor = (t) => `${location.origin}/t/${t}`
const initials = (n) => n.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('')
const waLink = (r) => {
  let p = r.tenant_phone.replace(/\D/g, '')
  if (p.length === 10) p = '91' + p
  const text = `Hi ${r.tenant_name}, please complete your tenant verification here: ${linkFor(r.token)}`
  return `https://wa.me/${p}?text=${encodeURIComponent(text)}`
}
const mailtoLink = (r) => {
  const body = `Hi ${r.tenant_name},\n\nPlease complete your tenant verification here:\n${linkFor(r.token)}\n\nIt takes a few minutes. Nothing is checked until you give consent.`
  return `mailto:${r.tenant_email}?subject=${encodeURIComponent('Please complete your tenant verification')}&body=${encodeURIComponent(body)}`
}

export default function Dashboard({ isAdmin }) {
  const [rows, setRows] = useState(null)
  const [f, setF] = useState(empty)
  const [err, setErr] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const [sending, setSending] = useState('')
  const [payFor, setPayFor] = useState(null)

  const load = async () => {
    const { data, error } = await supabase.from('verification_requests').select('*, payments(status)').order('created_at', { ascending: false })
    if (error) { setErr(error.message); setRows([]) } else setRows(data)
  }
  useEffect(() => { load() }, [])

  const create = async (e) => {
    e.preventDefault(); setBusy(true); setErr(''); setMsg('')
    const payload = { ...f, tenant_email: f.tenant_email.trim() || null }
    const { error } = await supabase.from('verification_requests').insert(payload)
    setBusy(false)
    if (error) return setErr(error.message)
    setF(empty); setMsg('Request created. Send the link to your tenant below.'); load()
  }

  const sendEmail = async (r) => {
    setSending(r.id); setMsg(''); setErr('')
    const { error } = await supabase.functions.invoke('send-tenant-email', { body: { request_id: r.id, site_url: location.origin } })
    setSending('')
    if (!error) return setMsg(`Email sent to ${r.tenant_email}`)
    setMsg('Automatic email is not set up yet, so your email app was opened instead.')
    window.location.href = mailtoLink(r)
  }

  const copy = async (r) => { await navigator.clipboard.writeText(linkFor(r.token)); setMsg('Link copied') }
  const paid = (r) => (r.payments || []).some((p) => p.status === 'paid')
  const count = (fn) => (rows || []).filter(fn).length

  return (
    <main className="wrap">
      <header className="bar">
        <div className="logo">Ghar<span className="grad">Trust</span></div>
        <div className="actions">
          {isAdmin && <Link className="btn alt sm" to="/admin">Admin panel</Link>}
          <button className="btn alt sm" onClick={() => supabase.auth.signOut()}>Sign out</button>
        </div>
      </header>

      <div className="stats">
        <div className="glass stat"><b>{count(() => true)}</b><span>Total requests</span></div>
        <div className="glass stat"><b>{count((r) => ['invited', 'in_progress'].includes(r.status))}</b><span>Waiting on tenant</span></div>
        <div className="glass stat"><b>{count((r) => ['submitted', 'reviewed'].includes(r.status))}</b><span>Submitted</span></div>
      </div>

      <section className="card">
        <h2>New verification request</h2>
        <form onSubmit={create} className="grid4">
          <label>Tenant name<input required value={f.tenant_name} onChange={(e) => setF({ ...f, tenant_name: e.target.value })} /></label>
          <label>Tenant mobile<input required inputMode="tel" value={f.tenant_phone} onChange={(e) => setF({ ...f, tenant_phone: e.target.value })} /></label>
          <label>Tenant email (optional)<input type="email" value={f.tenant_email} onChange={(e) => setF({ ...f, tenant_email: e.target.value })} /></label>
          <label>Property (optional)<input value={f.property_label} onChange={(e) => setF({ ...f, property_label: e.target.value })} /></label>
          <button className="btn" disabled={busy}>{busy ? 'Creating…' : 'Create request'}</button>
        </form>
        {err && <p className="note err">{err}</p>}
        {msg && <p className="note">{msg}</p>}
      </section>

      <section className="card">
        <h2>Your requests</h2>
        {rows === null && <Loading />}
        {rows && rows.length === 0 && <div className="empty"><div className="big">🏠</div><p>No requests yet. Create your first one above.</p></div>}
        {rows && rows.map((r) => (
          <div className="req" key={r.id}>
            <div className="who">
              <div className="avatar">{initials(r.tenant_name)}</div>
              <div style={{ minWidth: 0 }}>
                <b>{r.tenant_name}</b> <span className={`badge ${r.status}`}>{r.status.replace('_', ' ')}</span> {paid(r) ? <span className="badge passed">Paid</span> : <span className="badge failed">Unpaid</span>}
                <div className="muted">{r.property_label || '—'} · {r.tenant_phone}{r.tenant_email ? ` · ${r.tenant_email}` : ''}</div>
              </div>
            </div>
            <div className="actions">
              {!paid(r) && <button className="btn sm" onClick={() => setPayFor(r)}>Pay {inr(FEE_PAISE)}</button>}
              {paid(r) && <a className="btn alt sm" href={waLink(r)} target="_blank" rel="noreferrer">WhatsApp</a>}
              {paid(r) && r.tenant_email && <button className="btn alt sm" disabled={sending === r.id} onClick={() => sendEmail(r)}>{sending === r.id ? 'Sending…' : 'Email'}</button>}
              {paid(r) && <button className="btn alt sm" onClick={() => copy(r)}>Copy link</button>}
              <Link className="btn sm" to={`/request/${r.id}`}>View</Link>
            </div>
          </div>
        ))}
      </section>
      {payFor && <PayModal request={payFor} onClose={() => setPayFor(null)} onPaid={() => { setPayFor(null); setMsg('Payment done. You can now send the link to your tenant.'); load() }} />}
    </main>
  )
}
