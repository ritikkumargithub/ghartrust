import { Icon } from '../Icon.jsx'
import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../supabase.js'
import { Loading } from '../Loading.jsx'
import DigiLockerModal from '../components/DigiLockerModal.jsx'
import { sleep } from '../lib.js'

const CONSENT_TEXT = `I agree that GharTrust and the landlord named above may collect and check my identity, PAN, employment and address details, contact my employer's HR team to confirm my employment details, and share my address with local police for tenant registration where required, to verify my tenancy application. I understand I can withdraw my consent at any time.`
const DOCS = [
  { type: 'pan', icon: 'card', label: 'PAN card', required: true, accept: 'image/*,application/pdf' },
  { type: 'id_proof', icon: 'id', label: 'Aadhaar / ID proof', required: true, accept: 'image/*,application/pdf' },
  { type: 'selfie', icon: 'camera', label: 'Selfie', required: true, accept: 'image/*', capture: 'user' },
  { type: 'employment_doc', icon: 'briefcase', label: 'Offer letter or recent payslip', required: true, accept: 'image/*,application/pdf' },
  { type: 'bank_statement', icon: 'bank', label: 'Bank statement (optional)', required: false, accept: 'application/pdf' },
]
const STEPS = ['Consent', 'Identity', 'Work & address', 'Documents', 'Done']
const CITIES = ['Bengaluru', 'Mumbai', 'Pune', 'Hyderabad', 'Delhi NCR', 'Chennai', 'Kolkata']

export default function Tenant() {
  const { token } = useParams()
  const [info, setInfo] = useState(undefined)
  const [step, setStep] = useState(null)
  const [name, setName] = useState('')
  const [agree, setAgree] = useState(false)
  const [f, setF] = useState({})
  const [pan, setPan] = useState('idle')
  const [dl, setDl] = useState(false)
  const [done, setDone] = useState({})
  const [busy, setBusy] = useState('')
  const [err, setErr] = useState('')
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }))

  const load = async () => {
    const { data, error } = await supabase.rpc('get_tenant_request', { p_token: token })
    const row = error || !data?.length ? null : data[0]
    setInfo(row)
    if (row && step === null) {
      const d = row.details || {}
      setF({ ...d, monthly_income: d.monthly_income ?? '' })
      if (d.pan_number) setPan('ok')
      const submitted = ['submitted', 'reviewed'].includes(row.status)
      setStep(submitted ? 4 : !row.has_consent ? 0 : d.pan_number && d.digilocker_status === 'connected' ? (d.employer_name ? 3 : 2) : 1)
    }
    return row
  }
  useEffect(() => { load() }, [token])

  const run = async (key, fn) => {
    setBusy(key); setErr('')
    try { await fn() } catch (e) { setErr(e.message || 'Something went wrong') }
    setBusy('')
  }
  const save = async (data) => { const { error } = await supabase.rpc('save_tenant_details', { p_token: token, p_data: data }); if (error) throw error }

  const sign = () => run('consent', async () => {
    const { error } = await supabase.rpc('submit_consent', { p_token: token, p_name: name })
    if (error) throw error
    await load(); setStep(1)
  })
  const verifyPan = () => run('pan', async () => {
    const v = (f.pan_number || '').toUpperCase()
    if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(v)) throw new Error('PAN must look like ABCDE1234F')
    if (!f.pan_name?.trim()) throw new Error('Enter your name as on PAN')
    setPan('checking'); await sleep(1700)
    await save({ pan_number: v, pan_name: f.pan_name, dob: f.dob || '' })
    setPan('ok')
  }).then(() => setPan((p) => (p === 'checking' ? 'idle' : p)))
  const connected = (d) => run('dl', async () => { await save(d); setDl(false); await load(); setF((x) => ({ ...x, digilocker_status: 'connected', aadhaar_last4: d.aadhaar_last4 })) })
  const saveWork = () => run('work', async () => {
    for (const k of ['employer_name', 'designation', 'monthly_income', 'current_address', 'police_city'])
      if (!String(f[k] ?? '').trim()) throw new Error('Please fill all required fields')
    await save({ employer_name: f.employer_name, designation: f.designation, monthly_income: String(f.monthly_income), hr_email: f.hr_email || '',
      current_address: f.current_address, permanent_address: f.permanent_address || '', police_city: f.police_city })
    setStep(3)
  })
  const upload = (type, file) => file && run(type, async () => {
    if (file.size > 5 * 1024 * 1024) throw new Error('File must be under 5 MB')
    const path = `${token}/${type}-${Date.now()}-${file.name.replace(/[^\w.-]/g, '_')}`
    const up = await supabase.storage.from('tenant-docs').upload(path, file, { contentType: file.type })
    if (up.error) throw up.error
    const reg = await supabase.rpc('register_document', { p_token: token, p_type: type, p_path: path })
    if (reg.error) throw reg.error
    setDone((d) => ({ ...d, [type]: file.name }))
  })
  const submit = () => run('submit', async () => {
    const { error } = await supabase.rpc('submit_tenant', { p_token: token })
    if (error) throw error
    await load(); setStep(4)
  })
  const withdraw = () => confirm('Withdraw your consent and close this request?') &&
    run('withdraw', async () => { await supabase.rpc('withdraw_consent', { p_token: token }); setStep(null); await load() })

  if (info === undefined || (info && step === null)) return <Loading />
  if (info === null) return <main className="narrow"><div className="card"><h2>Link not active</h2><p className="muted">This link is invalid, expired or has been withdrawn.</p></div></main>
  if (!info.is_paid && step === 0) return (
    <main className="narrow"><div className="card success"><div className="done-ico"><Icon name="clock" size={32} /></div><h3>Almost ready</h3>
      <p className="muted">Hi {info.tenant_name}, your landlord hasn't activated this verification yet. Please check back soon.</p></div></main>
  )

  const required = DOCS.filter((d) => d.required)
  const have = required.filter((d) => done[d.type]).length
  const identityReady = pan === 'ok' && f.digilocker_status === 'connected'

  return (
    <main className="narrow">
      <div className="card">
        <div className="logo">Ghar<span className="grad">Trust</span></div>
        <h2 style={{ marginTop: 14 }}>Hi {info.tenant_name}</h2>
        <p className="muted">{info.property_label ? `Verification for ${info.property_label}. ` : ''}About 5 minutes.</p>

        <div className="stepper" aria-label="Progress">
          {STEPS.map((t, i) => (
            <span key={t} style={{ display: 'contents' }}>
              {i > 0 && <hr />}
              <span className={`step ${i < step ? 'done' : i === step ? 'on' : ''}`}><i>{i < step ? '✓' : i + 1}</i><em>{t}</em></span>
            </span>
          ))}
        </div>

        {step === 0 && (
          <>
            <p>{CONSENT_TEXT}</p>
            <label className="check"><input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} /> I have read and agree</label>
            <label>Type your full name to sign<input value={name} onChange={(e) => setName(e.target.value)} /></label>
            <button className="btn" disabled={!agree || name.trim().length < 3 || !!busy} onClick={sign}>{busy === 'consent' ? 'Signing…' : 'Sign consent'}</button>
          </>
        )}

        {step === 1 && (
          <>
            <h3>PAN verification</h3>
            <label>Name as on PAN<input value={f.pan_name || ''} onChange={(e) => { set('pan_name', e.target.value); setPan('idle') }} /></label>
            <div className="two">
              <label>PAN number<input placeholder="ABCDE1234F" maxLength={10} value={f.pan_number || ''} onChange={(e) => { set('pan_number', e.target.value.toUpperCase()); setPan('idle') }} /></label>
              <label>Date of birth<input type="date" value={f.dob || ''} onChange={(e) => set('dob', e.target.value)} /></label>
            </div>
            {pan === 'ok' ? <p className="note ok-note"><Icon name="check" /><span>PAN received. Our team completes the final check with official records.</span></p>
              : <button className="btn alt" disabled={!!busy} onClick={verifyPan}>{pan === 'checking' ? 'Checking with records (demo)…' : 'Verify PAN'}</button>}

            <h3 style={{ marginTop: 24 }}>Aadhaar via DigiLocker</h3>
            {f.digilocker_status === 'connected' ? <p className="note ok-note"><Icon name="check" /><span>DigiLocker connected · Aadhaar ending {f.aadhaar_last4}</span></p>
              : <button className="btn alt" onClick={() => setDl(true)}>Connect DigiLocker</button>}
            <button className="btn" style={{ width: '100%', marginTop: 22 }} disabled={!identityReady} onClick={() => setStep(2)}>Continue</button>
            {dl && <DigiLockerModal onClose={() => setDl(false)} onConnected={connected} />}
          </>
        )}

        {step === 2 && (
          <>
            <h3>Employment</h3>
            <label>Employer / company name *<input value={f.employer_name || ''} onChange={(e) => set('employer_name', e.target.value)} /></label>
            <div className="two">
              <label>Designation *<input value={f.designation || ''} onChange={(e) => set('designation', e.target.value)} /></label>
              <label>Monthly income (₹) *<input inputMode="numeric" value={f.monthly_income ?? ''} onChange={(e) => set('monthly_income', e.target.value.replace(/[^\d.]/g, ''))} /></label>
            </div>
            <label>HR email (recommended)<input placeholder="hr@yourcompany.com" type="email" value={f.hr_email || ''} onChange={(e) => set('hr_email', e.target.value)} /></label>
            <p className="muted">Use your company HR email, not a personal one. We'll ask HR to confirm your job, role and income.</p>
            <h3 style={{ marginTop: 20 }}>Address & police verification</h3>
            <label>Current address *<input value={f.current_address || ''} onChange={(e) => set('current_address', e.target.value)} /></label>
            <label>Permanent address<input value={f.permanent_address || ''} onChange={(e) => set('permanent_address', e.target.value)} /></label>
            <label>City of the rented property *<input list="cities" value={f.police_city || ''} onChange={(e) => set('police_city', e.target.value)} /></label>
            <datalist id="cities">{CITIES.map((c) => <option key={c} value={c} />)}</datalist>
            <p className="muted">Your address may be shared with local police for tenant registration, as covered by your consent.</p>
            <button className="btn" style={{ width: '100%' }} disabled={!!busy} onClick={saveWork}>{busy === 'work' ? 'Saving…' : 'Continue'}</button>
          </>
        )}

        {step === 3 && (
          <>
            <div className="muted">{have} of {required.length} required documents added</div>
            <div className="progress"><i style={{ width: `${(have / required.length) * 100}%` }} /></div>
            {DOCS.map((d) => (
              <label key={d.type} className={`tile ${done[d.type] ? 'done' : ''}`}>
                <span className="ico">{done[d.type] ? <Icon name="check" /> : <Icon name={d.icon} />}</span>
                <span>{d.label}{d.required && ' *'}
                  <small>{busy === d.type ? 'Uploading…' : done[d.type] || 'Tap to upload · JPG, PNG or PDF · max 5 MB'}</small></span>
                <input type="file" accept={d.accept} capture={d.capture} disabled={busy === d.type} onChange={(e) => upload(d.type, e.target.files[0])} />
              </label>
            ))}
            <button className="btn" style={{ width: '100%', marginTop: 8 }} disabled={have < required.length || !!busy} onClick={submit}>{busy === 'submit' ? 'Submitting…' : 'Submit for verification'}</button>
          </>
        )}

        {step === 4 && (
          <div className="success">
            <div className="done-ico"><Icon name="check" size={34} /></div><h3>All done!</h3>
            <p className="muted">Here's what happens next:</p>
            <ol className="next"><li>PAN and identity checks</li><li>Employment confirmation</li><li>Police verification (can take a few days)</li><li>Your landlord receives the report</li></ol>
          </div>
        )}

        {err && <p className="note err">{err}</p>}
        {info.has_consent && step !== 4 && <p className="muted" style={{ marginTop: 18 }}><a href="#" onClick={(e) => { e.preventDefault(); withdraw() }}>Withdraw my consent</a></p>}
      </div>
    </main>
  )
}
