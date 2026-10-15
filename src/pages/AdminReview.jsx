import { StatusIcon } from '../Icon.jsx'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../supabase.js'
import { Loading } from '../Loading.jsx'
import HrPanel from '../components/HrPanel.jsx'
import { CHECK_ORDER, CHECK_LABEL, DOC_LABEL } from '../lib.js'

const STATUSES = ['pending', 'passed', 'failed', 'needs_review']

export default function AdminReview() {
  const { id } = useParams()
  const [d, setD] = useState(null)
  const [edit, setEdit] = useState({})
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  const load = async () => {
    const [r, docs, ch, sm] = await Promise.all([
      supabase.from('verification_requests').select('*').eq('id', id).single(),
      supabase.from('documents').select('*').eq('request_id', id),
      supabase.from('checks').select('*').eq('request_id', id),
      supabase.rpc('get_request_summary', { p_request_id: id }),
    ])
    if (r.error) return setErr(r.error.message)
    const withUrls = await Promise.all((docs.data || []).map(async (x) => {
      const { data } = await supabase.storage.from('tenant-docs').createSignedUrl(x.storage_path, 600)
      return { ...x, url: data?.signedUrl }
    }))
    const checks = Object.fromEntries((ch.data || []).map((c) => [c.check_type, c]))
    setD({ req: r.data, docs: withUrls, checks, sum: sm.data || {} })
    setEdit(Object.fromEntries((ch.data || []).map((c) => [c.id, { status: c.status, detail: c.detail || '' }])))
  }
  useEffect(() => { load() }, [id])

  const saveCheck = async (c) => {
    setMsg(''); setErr('')
    const e = edit[c.id]
    const { error } = await supabase.from('checks').update({ status: e.status, detail: e.detail || null, updated_at: new Date().toISOString() }).eq('id', c.id)
    if (error) return setErr(error.message)
    setMsg(`${CHECK_LABEL[c.check_type]} saved`)
  }
  const passAll = async () => {
    const ids = Object.values(d.checks).map((c) => c.id)
    const { error } = await supabase.from('checks').update({ status: 'passed', updated_at: new Date().toISOString() }).in('id', ids)
    if (error) return setErr(error.message)
    setMsg('All checks marked passed'); load()
  }
  const markReviewed = async () => {
    const { error } = await supabase.from('verification_requests').update({ status: 'reviewed' }).eq('id', id)
    if (error) return setErr(error.message)
    setMsg('Request marked as reviewed. The landlord can now see the final report.'); load()
  }

  if (err && !d) return <p className="center err">{err}</p>
  if (!d) return <Loading />
  const { req, docs, checks, sum } = d
  const list = CHECK_ORDER.map((k) => checks[k]).filter(Boolean)

  return (
    <main className="wrap">
      <header className="bar"><div className="logo">Ghar<span className="grad">Trust</span> <span className="badge needs_review">Admin</span></div>
        <Link className="btn alt sm" to="/admin">← Queue</Link></header>

      <section className="card">
        <h2>{req.tenant_name} <span className={`badge ${req.status}`}>{req.status.replace('_', ' ')}</span></h2>
        <p className="muted">{req.property_label || '—'} · {req.tenant_phone}{req.tenant_email ? ` · ${req.tenant_email}` : ''}</p>
        <div className="actions">
          <button className="btn sm" disabled={!list.length} onClick={passAll}>Mark all checks passed (demo)</button>
          <button className="btn alt sm" disabled={req.status !== 'submitted'} onClick={markReviewed}>Mark request reviewed</button>
        </div>
        {msg && <p className="note">{msg}</p>}{err && <p className="note err">{err}</p>}
      </section>

      <section className="card">
        <h2>Full tenant details</h2>
        <div className="facts">
          <div><span>PAN</span><b>{sum.pan_number || '—'}</b></div><div><span>Name on PAN</span><b>{sum.pan_name || '—'}</b></div>
          <div><span>Date of birth</span><b>{sum.dob || '—'}</b></div><div><span>Aadhaar (last 4)</span><b>{sum.aadhaar_last4 || '—'}</b></div>
          <div><span>DigiLocker</span><b>{sum.digilocker_status || '—'} {sum.digilocker_ref || ''}</b></div><div><span>Police city</span><b>{sum.police_city || '—'}</b></div>
          <div><span>Employer</span><b>{sum.employer_name || '—'}</b></div><div><span>Designation</span><b>{sum.designation || '—'}</b></div>
          <div><span>Monthly income</span><b>{sum.monthly_income ? '₹' + Number(sum.monthly_income).toLocaleString('en-IN') : '—'}</b></div><div><span>HR email</span><b>{sum.hr_email || '—'}</b></div>
          <div><span>Current address</span><b>{sum.current_address || '—'}</b></div><div><span>Permanent address</span><b>{sum.permanent_address || '—'}</b></div>
        </div>
      </section>

      <HrPanel requestId={id} defaultEmail={sum.hr_email} status={req.status} tenantName={req.tenant_name} claimed={sum} />

      <section className="card">
        <h2>Checks</h2>
        {list.length === 0 && <p className="muted">Checks appear after the tenant submits.</p>}
        {list.map((c) => (
          <div className="krow" key={c.id}>
            <span><b><StatusIcon status={edit[c.id]?.status} /> {CHECK_LABEL[c.check_type]}</b></span>
            <span className="actions">
              <select value={edit[c.id]?.status} onChange={(e) => setEdit({ ...edit, [c.id]: { ...edit[c.id], status: e.target.value } })}>
                {STATUSES.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}</select>
              <input placeholder="Note for landlord (optional)" value={edit[c.id]?.detail} onChange={(e) => setEdit({ ...edit, [c.id]: { ...edit[c.id], detail: e.target.value } })} />
              <button className="btn sm" onClick={() => saveCheck(c)}>Save</button>
            </span>
          </div>
        ))}
      </section>

      <section className="card">
        <h2>Documents</h2>
        {docs.length === 0 && <p className="muted">No documents.</p>}
        {docs.map((x) => (
          <div className="krow" key={x.id}><span>{DOC_LABEL[x.doc_type]}</span>{x.url ? <a href={x.url} target="_blank" rel="noreferrer">Open (10 min link)</a> : <span className="muted">unavailable</span>}</div>
        ))}
      </section>
    </main>
  )
}
