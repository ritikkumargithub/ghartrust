import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../supabase.js'
import { Loading } from '../Loading.jsx'

const STEPS = ['Review', 'Verify', 'Sign']
const TYPES = [['permanent', 'Permanent'], ['contract', 'Contract'], ['probation', 'Probation'], ['intern', 'Intern'], ['other', 'Other']]
const Icon = ({ name }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {name === 'lock' ? <><rect x="4" y="11" width="16" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></> : <path d="M5 13l4 4L19 7" />}
  </svg>
)
const inr = (n) => '₹' + Number(n).toLocaleString('en-IN')

function Choice({ value, onChange, options }) {
  return (
    <div className="seg">
      {options.map(([v, t]) => (
        <button type="button" key={String(v)} className={value === v ? 'on' : ''} onClick={() => onChange(v)}>{t}</button>
      ))}
    </div>
  )
}

export default function HrVerify() {
  const { token } = useParams()
  const [info, setInfo] = useState(undefined)
  const [step, setStep] = useState(0)
  const [f, setF] = useState({ employment_confirmed: null, designation_matches: null, income_matches: null, employment_type: 'permanent',
    actual_designation: '', joining_date: '', actual_monthly_income: '', notes: '', hr_name: '', hr_designation: '', signed_name: '', attested: false })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }))

  useEffect(() => {
    document.body.classList.add('hr-body')
    return () => document.body.classList.remove('hr-body')
  }, [])
  useEffect(() => { supabase.rpc('get_hr_request', { p_token: token }).then(({ data, error }) => setInfo(error ? null : data)) }, [token])

  if (info === undefined) return <Loading />
  const shell = (body) => (
    <div className="hrmode">
      <header className="hr-top"><div className="hr-brand"><span className="hr-badge">G</span><b>GharTrust</b></div><span className="muted">Employer verification</span></header>
      <main className="narrow"><div className="card">{body}</div></main>
      <footer className="hr-foot">Powered by GharTrust · Your response is used only for this verification.</footer>
    </div>
  )
  if (info === null) return shell(<><h2>Link not found</h2><p className="muted">This verification link is invalid.</p></>)
  if (info.status === 'withdrawn') return shell(<><h2>Request withdrawn</h2><p className="muted">The employee withdrew this request. Nothing more is needed. Thank you.</p></>)
  if (info.status === 'expired') return shell(<><h2>Link expired</h2><p className="muted">This link is no longer active. Please ask the requester to send a new one.</p></>)
  if (info.status === 'responded' && step !== 3) return shell(<div className="success"><div className="hr-done"><Icon name="check" /></div><h3>Already submitted</h3><p className="muted">This request has been answered. Thank you.</p></div>)

  const yes = f.employment_confirmed === true
  const ready1 = f.employment_confirmed !== null && (!yes || (f.designation_matches !== null && f.income_matches !== null &&
    (f.designation_matches || f.actual_designation.trim()) && (f.income_matches !== 'no' || f.actual_monthly_income)))
  const ready2 = f.hr_name.trim().length > 2 && f.signed_name.trim().length > 2 && f.attested

  const submit = async () => {
    setBusy(true); setErr('')
    const { error } = await supabase.rpc('submit_hr_response', { p_token: token, p_data: f })
    setBusy(false)
    if (error) return setErr(error.message)
    setStep(3)
  }

  return shell(
    <>
      {step < 3 && (
        <div className="stepper" aria-label="Progress">
          {STEPS.map((t, i) => (
            <span key={t} style={{ display: 'contents' }}>{i > 0 && <hr />}
              <span className={`step ${i < step ? 'done' : i === step ? 'on' : ''}`}><i>{i < step ? '✓' : i + 1}</i><em>{t}</em></span></span>
          ))}
        </div>
      )}

      {step === 0 && (
        <>
          <h2>Please confirm an employee's details</h2>
          <p className="muted">{info.employee_name} has applied to rent a home and listed your company as their employer. With their consent, we'd like HR to confirm the details below. It takes about 2 minutes, and no login is needed.</p>
          <div className="hr-profile">
            <div className="hr-avatar">{info.employee_name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('')}</div>
            <div><b>{info.employee_name}</b><div>{info.designation || 'Role not stated'} at {info.employer_name || '—'}</div>
              <div className="muted">Stated monthly income: {info.monthly_income ? inr(info.monthly_income) : '—'}</div></div>
          </div>
          <p className="hr-note"><Icon name="lock" /><span>We share only the details above. No ID numbers or addresses are shown. Your answers are used only for this rental check.</span></p>
          <button className="btn" style={{ width: '100%' }} onClick={() => setStep(1)}>Start verification</button>
        </>
      )}

      {step === 1 && (
        <>
          <h3>Is {info.employee_name} currently employed with {info.employer_name || 'your company'}?</h3>
          <Choice value={f.employment_confirmed} onChange={(v) => set('employment_confirmed', v)} options={[[true, 'Yes, employed'], [false, 'No / not found']]} />

          {yes && (
            <>
              <h3 style={{ marginTop: 22 }}>Designation: “{info.designation}”. Is this correct?</h3>
              <Choice value={f.designation_matches} onChange={(v) => set('designation_matches', v)} options={[[true, 'Correct'], [false, 'Different']]} />
              {f.designation_matches === false && <label>Actual designation<input value={f.actual_designation} onChange={(e) => set('actual_designation', e.target.value)} /></label>}

              <div className="two" style={{ marginTop: 14 }}>
                <label>Employment type<select value={f.employment_type} onChange={(e) => set('employment_type', e.target.value)}>{TYPES.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select></label>
                <label>Date of joining<input type="date" value={f.joining_date} onChange={(e) => set('joining_date', e.target.value)} /></label>
              </div>

              <h3 style={{ marginTop: 18 }}>Monthly income: {info.monthly_income ? inr(info.monthly_income) : 'not stated'}. Is this about right?</h3>
              <Choice value={f.income_matches} onChange={(v) => set('income_matches', v)} options={[['yes', 'Yes'], ['no', 'No'], ['cannot_disclose', "Can't disclose"]]} />
              {f.income_matches === 'no' && <label>Actual monthly income (₹)<input inputMode="numeric" value={f.actual_monthly_income} onChange={(e) => set('actual_monthly_income', e.target.value.replace(/[^\d.]/g, ''))} /></label>}
            </>
          )}
          <label style={{ marginTop: 14 }}>Notes (optional)<textarea rows={2} value={f.notes} onChange={(e) => set('notes', e.target.value)} /></label>
          <div className="actions"><button className="btn alt" onClick={() => setStep(0)}>Back</button><button className="btn" disabled={!ready1} onClick={() => setStep(2)}>Continue</button></div>
        </>
      )}

      {step === 2 && (
        <>
          <h3>Sign and submit</h3>
          <div className="two">
            <label>Your name<input value={f.hr_name} onChange={(e) => set('hr_name', e.target.value)} /></label>
            <label>Your role<input placeholder="e.g. HR Manager" value={f.hr_designation} onChange={(e) => set('hr_designation', e.target.value)} /></label>
          </div>
          <label className="check"><input type="checkbox" checked={f.attested} onChange={(e) => set('attested', e.target.checked)} />
            <span>I confirm this information is accurate to the best of my knowledge and I am authorised by my employer to provide it.</span></label>
          <label>Type your full name to sign<input value={f.signed_name} onChange={(e) => set('signed_name', e.target.value)} /></label>
          {err && <p className="note err">{err}</p>}
          <div className="actions"><button className="btn alt" onClick={() => setStep(1)}>Back</button><button className="btn" disabled={!ready2 || busy} onClick={submit}>{busy ? 'Submitting…' : 'Submit verification'}</button></div>
        </>
      )}

      {step === 3 && <div className="success"><div className="hr-done"><Icon name="check" /></div><h3>Thank you!</h3><p className="muted">Your response has been recorded. You can close this page.</p></div>}
    </>
  )
}
