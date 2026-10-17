import { Icon } from '../Icon.jsx'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../supabase.js'
import { Loading } from '../Loading.jsx'

const TABS = [['all', 'All'], ['submitted', 'Needs review'], ['reviewed', 'Reviewed'], ['open', 'In progress']]

export default function Admin() {
  const [rows, setRows] = useState(null)
  const [tab, setTab] = useState('submitted')
  const [err, setErr] = useState('')

  useEffect(() => {
    supabase.from('verification_requests').select('*, payments(status), checks(status)').order('created_at', { ascending: false })
      .then(({ data, error }) => { if (error) setErr(error.message); setRows(data || []) })
  }, [])

  const show = (rows || []).filter((r) => tab === 'all' || (tab === 'open' ? ['invited', 'in_progress'].includes(r.status) : r.status === tab))
  const paid = (r) => (r.payments || []).some((p) => p.status === 'paid')

  return (
    <main className="wrap">
      <header className="bar"><div className="logo">Ghar<span className="grad">Trust</span> <span className="badge needs_review">Admin</span></div>
        <Link className="btn alt sm" to="/dashboard">← Dashboard</Link></header>
      <section className="card">
        <h2>Review queue</h2>
        <div className="tabs">{TABS.map(([k, t]) => <button key={k} className={`tab ${tab === k ? 'on' : ''}`} onClick={() => setTab(k)}>{t}</button>)}</div>
        {err && <p className="note err">{err}</p>}
        {rows === null && <Loading />}
        {rows && show.length === 0 && <div className="empty"><Icon name="inbox" size={40} /><p>Nothing here.</p></div>}
        {show.map((r) => {
          const done = (r.checks || []).filter((c) => c.status === 'passed').length
          return (
            <Link to={`/admin/${r.id}`} className="req" key={r.id} style={{ textDecoration: 'none', color: 'inherit' }}>
              <div><b>{r.tenant_name}</b> <span className={`badge ${r.status}`}>{r.status.replace('_', ' ')}</span> <span className="badge">{r.plan}</span> {paid(r) ? <span className="badge passed">Paid</span> : <span className="badge failed">Unpaid</span>}
                <div className="muted">{r.property_label || '—'} · {r.tenant_phone} · {new Date(r.created_at).toLocaleDateString()}</div></div>
              <span className="muted">{(r.checks || []).length ? `${done}/${r.checks.length} checks passed` : 'no checks yet'} →</span>
            </Link>
          )
        })}
      </section>
    </main>
  )
}
