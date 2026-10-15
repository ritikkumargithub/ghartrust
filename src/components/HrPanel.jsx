import { Icon } from '../Icon.jsx'
import { useEffect, useState } from 'react'
import { supabase } from '../supabase.js'

const FREE = ['gmail.com', 'yahoo.com', 'yahoo.in', 'outlook.com', 'hotmail.com', 'rediffmail.com', 'icloud.com', 'proton.me', 'protonmail.com', 'live.com']
const inr = (n) => '₹' + Number(n).toLocaleString('en-IN')
const yn = (v) => (v === true ? 'Yes' : v === false ? 'No' : '—')

export default function HrPanel({ requestId, defaultEmail, status, tenantName, claimed = {} }) {
  const [hv, setHv] = useState(undefined)
  const [email, setEmail] = useState(defaultEmail || '')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  const load = async () => {
    const { data } = await supabase.from('hr_verifications').select('*').eq('request_id', requestId).maybeSingle()
    setHv(data); if (data) setEmail(data.hr_email)
  }
  useEffect(() => { load() }, [requestId])

  const linkOf = (t) => `${location.origin}/hr/${t}`
  const mailto = (t) => `mailto:${email}?subject=${encodeURIComponent(`Employment verification request for ${tenantName}`)}&body=${encodeURIComponent(`Hello,\n\n${tenantName} has applied to rent a home and listed your company as their employer. Please confirm their employment details (about 2 minutes, no login):\n${linkOf(t)}\n\nThank you.`)}`

  const send = async () => {
    setBusy(true); setErr(''); setMsg('')
    const { data: token, error } = await supabase.rpc('create_hr_request', { p_request_id: requestId, p_hr_email: email })
    if (error) { setBusy(false); return setErr(error.message) }
    const { error: fe } = await supabase.functions.invoke('send-hr-email', { body: { request_id: requestId, site_url: location.origin } })
    setBusy(false)
    setMsg(fe ? 'Link created. Automatic email is not set up yet, so copy the link or use "Open in email app" below.' : `Email sent to ${email}`)
    await load()
  }

  if (hv === undefined) return null
  const ok = ['submitted', 'reviewed'].includes(status)
  const domain = (hv?.hr_email || email).split('@')[1]?.toLowerCase()
  const personal = domain && FREE.includes(domain)
  const resp = hv?.status === 'responded'

  return (
    <section className="card">
      <h2>Employment verification by HR</h2>
      {!ok && <p className="muted">Available after the tenant submits their details.</p>}

      {ok && !hv && (
        <>
          <p className="muted">Send a secure link to the employer's HR. They confirm the tenant's job, role and income in a separate 2-minute flow, with no login.</p>
          <label>HR email<input type="email" placeholder="hr@company.com" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
          <button className="btn" disabled={busy || !email} onClick={send}>{busy ? 'Creating…' : 'Send to HR'}</button>
        </>
      )}

      {hv && !resp && (
        <>
          <p><span className="badge needs_review">{hv.status === 'opened' ? 'Opened, waiting for answer' : 'Sent, not opened yet'}</span> <span className="muted"> to {hv.hr_email} · expires {new Date(hv.expires_at).toLocaleDateString('en-IN')}</span></p>
          <div className="actions">
            <button className="btn alt sm" onClick={() => { navigator.clipboard.writeText(linkOf(hv.hr_token)); setMsg('HR link copied') }}>Copy link</button>
            <a className="btn alt sm" href={mailto(hv.hr_token)}>Open in email app</a>
            <button className="btn alt sm" disabled={busy} onClick={send}>{busy ? 'Sending…' : 'Resend'}</button>
            <button className="btn alt sm" onClick={load}>Refresh</button>
          </div>
          <label>Change HR email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
        </>
      )}

      {resp && (
        <>
          <p><span className={`badge ${hv.employment_confirmed ? 'passed' : 'failed'}`}>{hv.employment_confirmed ? 'HR confirmed employment' : 'HR did not confirm employment'}</span>
            <span className="muted"> · {new Date(hv.responded_at).toLocaleString('en-IN')}</span></p>
          {hv.employment_confirmed && (
            <div className="facts">
              <div><span>Designation (stated: {claimed.designation || '—'})</span><b>{yn(hv.designation_matches)}{hv.actual_designation ? ` · actual: ${hv.actual_designation}` : ''}</b></div>
              <div><span>Income (stated: {claimed.monthly_income ? inr(claimed.monthly_income) : '—'})</span>
                <b>{hv.income_matches === 'yes' ? 'Matches' : hv.income_matches === 'no' ? `Different${hv.actual_monthly_income ? ` · actual ${inr(hv.actual_monthly_income)}` : ''}` : "Can't disclose"}</b></div>
              <div><span>Employment type</span><b>{hv.employment_type || '—'}</b></div>
              <div><span>Date of joining</span><b>{hv.joining_date ? new Date(hv.joining_date).toLocaleDateString('en-IN') : '—'}</b></div>
            </div>
          )}
          <p className="muted">Answered by {hv.hr_name || '—'}{hv.hr_designation ? `, ${hv.hr_designation}` : ''} · signed “{hv.signed_name}”{hv.notes ? ` · Note: ${hv.notes}` : ''}</p>
        </>
      )}

      {personal && <p className="note err"><Icon name="warn" /><span>This HR email uses a personal address ({domain}). Anyone could have received the link, so ask for a company email or verify another way.</span></p>}
      {msg && <p className="note">{msg}</p>}{err && <p className="note err">{err}</p>}
    </section>
  )
}
