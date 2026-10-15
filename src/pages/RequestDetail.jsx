import { StatusIcon } from '../Icon.jsx'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../supabase.js'
import { Loading } from '../Loading.jsx'
import HrPanel from '../components/HrPanel.jsx'
import PayModal from '../components/PayModal.jsx'
import { CHECK_ORDER, CHECK_LABEL, CHECK_HELP, DOC_LABEL, FEE_PAISE, inr } from '../lib.js'

export default function RequestDetail() {
  const { id } = useParams()
  const [d, setD] = useState(null)
  const [err, setErr] = useState('')
  const [pay, setPay] = useState(false)

  const load = async () => {
    const [r, c, docs, ch, pm, sm] = await Promise.all([
      supabase.from('verification_requests').select('*').eq('id', id).single(),
      supabase.from('consents').select('*').eq('request_id', id).maybeSingle(),
      supabase.from('documents').select('*').eq('request_id', id),
      supabase.from('checks').select('*').eq('request_id', id),
      supabase.from('payments').select('*').eq('request_id', id).eq('status', 'paid').maybeSingle(),
      supabase.rpc('get_request_summary', { p_request_id: id }),
    ])
    if (r.error) return setErr(r.error.message)
    const withUrls = await Promise.all((docs.data || []).map(async (x) => {
      const { data } = await supabase.storage.from('tenant-docs').createSignedUrl(x.storage_path, 300)
      return { ...x, url: data?.signedUrl }
    }))
    setD({ req: r.data, consent: c.data, docs: withUrls, checks: ch.data || [], payment: pm.data, sum: sm.data || {} })
  }
  useEffect(() => { load() }, [id])

  if (err) return <p className="center err">{err}</p>
  if (!d) return <Loading />
  const { req, consent, docs, checks, payment, sum } = d
  const byType = Object.fromEntries(checks.map((c) => [c.check_type, c]))
  const passed = checks.filter((c) => c.status === 'passed').length

  return (
    <main className="wrap">
      <header className="bar noprint"><div className="logo">Ghar<span className="grad">Trust</span></div>
        <div className="actions"><button className="btn alt sm" onClick={() => window.print()}>Print report</button><Link className="btn alt sm" to="/dashboard">← Back</Link></div></header>

      <section className="card">
        <h2>{req.tenant_name} <span className={`badge ${req.status}`}>{req.status.replace('_', ' ')}</span></h2>
        <p className="muted">{req.property_label || '—'} · {req.tenant_phone}{req.tenant_email ? ` · ${req.tenant_email}` : ''}</p>
        <p>{consent ? `Consent signed by "${consent.signed_name}" on ${new Date(consent.signed_at).toLocaleString()}` : 'Tenant has not given consent yet.'}</p>
        <div className="krow noprint">
          <span>Payment: {payment ? <span className="badge passed">Paid {inr(payment.amount_paise)} · {payment.reference}</span> : <span className="badge failed">Unpaid</span>}</span>
          {!payment && <button className="btn sm" onClick={() => setPay(true)}>Pay {inr(FEE_PAISE)}</button>}
        </div>
      </section>

      <section className="card">
        <h2>Verification progress</h2>
        <p className="muted">{checks.length ? `${passed} of ${CHECK_ORDER.length} checks passed` : 'Checks start after the tenant submits.'}</p>
        <div className="progress"><i style={{ width: `${(passed / CHECK_ORDER.length) * 100}%` }} /></div>
        <div className="timeline">
          {CHECK_ORDER.map((k) => {
            const c = byType[k]; const st = c?.status || 'pending'
            return (
              <div className={`tl ${st}`} key={k}>
                <span className="tl-ico"><StatusIcon status={st} /></span>
                <div><b>{CHECK_LABEL[k]}</b> <span className={`badge ${st}`}>{st.replace('_', ' ')}</span>
                  <div className="muted">{c?.detail || CHECK_HELP[k]}</div></div>
              </div>
            )
          })}
        </div>
      </section>

      <HrPanel requestId={id} defaultEmail={sum.hr_email} status={req.status} tenantName={req.tenant_name} claimed={sum} />

      {sum.employer_name || sum.pan_masked ? (
        <section className="card">
          <h2>Details provided by tenant</h2>
          <div className="facts">
            <div><span>PAN</span><b>{sum.pan_masked || '—'}</b></div>
            <div><span>Name on PAN</span><b>{sum.pan_name || '—'}</b></div>
            <div><span>Aadhaar</span><b>{sum.aadhaar_masked || '—'}</b></div>
            <div><span>DigiLocker</span><b>{sum.digilocker_status === 'connected' ? 'Connected' : 'Not connected'}</b></div>
            <div><span>Employer</span><b>{sum.employer_name || '—'}</b></div>
            <div><span>Designation</span><b>{sum.designation || '—'}</b></div>
            <div><span>Monthly income</span><b>{sum.monthly_income ? '₹' + Number(sum.monthly_income).toLocaleString('en-IN') : '—'}</b></div>
            <div><span>Police verification city</span><b>{sum.police_city || '—'}</b></div>
          </div>
          <p className="muted">PAN and Aadhaar numbers are partly hidden for your safety.</p>
        </section>
      ) : null}

      <section className="card noprint">
        <h2>Documents</h2>
        {docs.length === 0 && <p className="muted">No documents uploaded.</p>}
        {docs.map((x) => (
          <div className="krow" key={x.id}><span>{DOC_LABEL[x.doc_type]}</span>
            {x.url ? <a href={x.url} target="_blank" rel="noreferrer">Open (5 min link)</a> : <span className="muted">unavailable</span>}</div>
        ))}
      </section>
      {pay && <PayModal request={req} onClose={() => setPay(false)} onPaid={() => { setPay(false); load() }} />}
    </main>
  )
}
