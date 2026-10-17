import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../supabase.js'
import { Loading } from '../Loading.jsx'
import { Icon } from '../Icon.jsx'
import AgreementDoc, { printAgreement } from '../components/AgreementDoc.jsx'
import DigiLockerModal from '../components/DigiLockerModal.jsx'
import { sleep, CHECK_LABEL, CHECK_ORDER } from '../lib.js'

const ALL_DOCS = [
  { type: 'pan', icon: 'card', label: 'PAN card', required: true, accept: 'image/*,application/pdf' },
  { type: 'id_proof', icon: 'id', label: 'Aadhaar / ID proof', required: true, accept: 'image/*,application/pdf' },
  { type: 'selfie', icon: 'camera', label: 'Selfie', required: true, accept: 'image/*', capture: 'user' },
  { type: 'employment_doc', icon: 'briefcase', label: 'Offer letter or recent payslip', required: true, accept: 'image/*,application/pdf', work: true },
  { type: 'bank_statement', icon: 'bank', label: 'Bank statement (optional)', required: false, accept: 'application/pdf', work: true },
]
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
  const [ag, setAg] = useState(undefined)
  const [agAgree, setAgAgree] = useState(false)
  const [agName, setAgName] = useState('')
  const [agAddr, setAgAddr] = useState('')
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }))

  // What the landlord's package includes decides which steps and fields the tenant sees
  const pc = info?.plan_checks || []
  const hasWork = pc.includes('employment') || pc.includes('income')
  const hasPolice = pc.includes('police')
  const keys = ['consent', 'identity', ...(hasWork ? ['work'] : []), 'docs', 'agreement', 'done']
  const LABEL = { consent: 'Consent', identity: 'Identity', work: hasPolice ? 'Work & address' : 'Employment', docs: 'Documents', agreement: 'Agreement', done: 'Done' }
  const key = keys[step]
  const DOCS = ALL_DOCS.filter((d) => !d.work || hasWork)

  const load = async () => {
    const { data, error } = await supabase.rpc('get_tenant_request', { p_token: token })
    const row = error || !data?.length ? null : data[0]
    setInfo(row)
    if (row && step === null) {
      const d = row.details || {}
      setF({ ...d, monthly_income: d.monthly_income ?? '' })
      if (d.pan_number) setPan('ok')
      const work = row.plan_checks.includes('employment') || row.plan_checks.includes('income')
      const k = ['consent', 'identity', ...(work ? ['work'] : []), 'docs', 'agreement', 'done']
      const submitted = ['submitted', 'reviewed'].includes(row.status)
      let signed = false
      if (submitted) { const { data: a } = await supabase.rpc('get_tenant_agreement', { p_token: token }); setAg(a || null); signed = !!a?.tenant_signed_at }
      const idDone = d.pan_number && d.digilocker_status === 'connected'
      setStep(submitted ? (signed ? k.length - 1 : k.indexOf('agreement')) : !row.has_consent ? 0 : !idDone ? 1 : work && !d.employer_name ? 2 : k.indexOf('docs'))
    }
    return row
  }
  useEffect(() => { load() }, [token])
  const loadAg = async () => {
    const { data } = await supabase.rpc('get_tenant_agreement', { p_token: token })
    setAg(data || null)
    setAgAddr((x) => x || f.permanent_address || f.current_address || '')
  }
  useEffect(() => { if (key === 'agreement') loadAg() }, [key])
  const signAgreement = () => run('agsign', async () => {
    const { error } = await supabase.rpc('sign_agreement_tenant', { p_token: token, p_name: agName, p_address: agAddr })
    if (error) throw error
    await loadAg(); setStep(keys.length - 1)
  })

  const run = async (k, fn) => {
    setBusy(k); setErr('')
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
    const need = ['employer_name', 'designation', 'monthly_income', ...(hasPolice ? ['current_address', 'police_city'] : [])]
    if (need.some((k) => !String(f[k] ?? '').trim())) throw new Error('Please fill all required fields')
    await save({ employer_name: f.employer_name, designation: f.designation, monthly_income: String(f.monthly_income), hr_email: f.hr_email || '',
      ...(hasPolice ? { current_address: f.current_address, permanent_address: f.permanent_address || '', police_city: f.police_city } : {}) })
    setStep(step + 1)
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
    if (hasWork) supabase.functions.invoke('notify-hr', { body: { tenant_token: token, site_url: location.origin } }).catch(() => {})
    await load(); setStep(keys.indexOf('agreement'))
  })
  const withdraw = () => confirm('Withdraw your consent and close this request?') &&
    run('withdraw', async () => { await supabase.rpc('withdraw_consent', { p_token: token }); setStep(null); await load() })

  if (info === undefined || (info && step === null)) return <Loading />
  if (info === null) return <main className="narrow"><div className="card"><h2>Link not active</h2><p className="muted">This link is invalid, expired or has been withdrawn.</p></div></main>
  if (!info.is_paid && step === 0) return (
    <main className="narrow"><div className="card success"><div className="done-ico"><Icon name="clock" size={32} /></div><h3>Almost ready</h3>
      <p className="muted">Hi {info.tenant_name}, your landlord hasn't activated this verification yet. Please check back soon.</p></div></main>
  )

  const consentText = `I agree that GharTrust and the landlord named above may collect and check my identity and PAN details${hasWork ? ", contact my employer's HR team to confirm my employment details" : ''}${hasPolice ? ', and share my address with local police for tenant registration where required' : ''}, to verify my tenancy application. I understand I can withdraw my consent at any time.`
  const required = DOCS.filter((d) => d.required)
  const have = required.filter((d) => done[d.type]).length
  const identityReady = pan === 'ok' && f.digilocker_status === 'connected'

  return (
    <main className="narrow">
      <div className="card">
        <div className="logo">GharTrust</div>
        <h2 style={{ marginTop: 14 }}>Hi {info.tenant_name}</h2>
        <p className="muted">{info.property_label ? `Verification for ${info.property_label}. ` : ''}Package requested by your landlord: <b>{info.plan_name}</b></p>
        <div className="chips">{CHECK_ORDER.filter((k) => pc.includes(k)).map((k) => <span className="chip" key={k}>{CHECK_LABEL[k]}</span>)}</div>

        <div className="stepper" aria-label="Progress">
          {keys.map((k, i) => (
            <span key={k} style={{ display: 'contents' }}>
              {i > 0 && <hr />}
              <span className={`step ${i < step ? 'done' : i === step ? 'on' : ''}`}><i>{i < step ? '✓' : i + 1}</i><em>{LABEL[k]}</em></span>
            </span>
          ))}
        </div>

        {key === 'consent' && (
          <>
            <p>{consentText}</p>
            <label className="check"><input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} /> I have read and agree</label>
            <label>Type your full name to sign<input value={name} onChange={(e) => setName(e.target.value)} /></label>
            <button className="btn" disabled={!agree || name.trim().length < 3 || !!busy} onClick={sign}>{busy === 'consent' ? 'Signing…' : 'Sign consent'}</button>
          </>
        )}

        {key === 'identity' && (
          <>
            <h3>PAN verification</h3>
            <label>Name as on PAN<input value={f.pan_name || ''} onChange={(e) => { set('pan_name', e.target.value); setPan('idle') }} /></label>
            <div className="two">
              <label>PAN number<input placeholder="ABCDE1234F" maxLength={10} value={f.pan_number || ''} onChange={(e) => { set('pan_number', e.target.value.toUpperCase()); setPan('idle') }} /></label>
              <label>Date of birth<input type="date" value={f.dob || ''} onChange={(e) => set('dob', e.target.value)} /></label>
            </div>
            {pan === 'ok' ? <p className="note ok-note"><Icon name="check" /><span>PAN received. Our team completes the final check with official records.</span></p>
              : <button className="btn alt" disabled={!!busy} onClick={verifyPan}>{pan === 'checking' ? 'Checking with records…' : 'Verify PAN'}</button>}

            <h3 style={{ marginTop: 24 }}>Aadhaar via DigiLocker</h3>
            {f.digilocker_status === 'connected' ? <p className="note ok-note"><Icon name="check" /><span>DigiLocker connected · Aadhaar ending {f.aadhaar_last4}</span></p>
              : <button className="btn alt" onClick={() => setDl(true)}>Connect DigiLocker</button>}
            <button className="btn" style={{ width: '100%', marginTop: 22 }} disabled={!identityReady} onClick={() => setStep(step + 1)}>Continue</button>
            {dl && <DigiLockerModal onClose={() => setDl(false)} onConnected={connected} />}
          </>
        )}

        {key === 'work' && (
          <>
            <h3>Employment</h3>
            <label>Employer / company name *<input value={f.employer_name || ''} onChange={(e) => set('employer_name', e.target.value)} /></label>
            <div className="two">
              <label>Designation *<input value={f.designation || ''} onChange={(e) => set('designation', e.target.value)} /></label>
              <label>Monthly income (₹) *<input inputMode="numeric" value={f.monthly_income ?? ''} onChange={(e) => set('monthly_income', e.target.value.replace(/[^\d.]/g, ''))} /></label>
            </div>
            <label>HR email (recommended)<input type="email" placeholder="hr@yourcompany.com" value={f.hr_email || ''} onChange={(e) => set('hr_email', e.target.value)} /></label>
            <p className="muted">Use your company HR email, not a personal one. We'll email them automatically after you submit, to confirm your job, role and income.</p>
            {hasPolice && (
              <>
                <h3 style={{ marginTop: 20 }}>Address & police verification</h3>
                <label>Current address *<input value={f.current_address || ''} onChange={(e) => set('current_address', e.target.value)} /></label>
                <label>Permanent address<input value={f.permanent_address || ''} onChange={(e) => set('permanent_address', e.target.value)} /></label>
                <label>City of the rented property *<input list="cities" value={f.police_city || ''} onChange={(e) => set('police_city', e.target.value)} /></label>
                <datalist id="cities">{CITIES.map((c) => <option key={c} value={c} />)}</datalist>
                <p className="muted">Your address may be shared with local police for tenant registration, as covered by your consent.</p>
              </>
            )}
            <button className="btn" style={{ width: '100%' }} disabled={!!busy} onClick={saveWork}>{busy === 'work' ? 'Saving…' : 'Continue'}</button>
          </>
        )}

        {key === 'docs' && (
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

        {key === 'agreement' && (
          <>
            <h3>Rental agreement</h3>
            {ag === undefined ? <Loading /> : !ag ? (
              <>
                <p className="muted">Your verification has been submitted. Your landlord is preparing the rental agreement, and you'll sign it here once it is ready. You can close this page and come back using the same link.</p>
                <button className="btn alt" onClick={loadAg}>Check again</button>
              </>
            ) : (
              <>
                <p className="muted">Please read the agreement carefully, then sign at the bottom.</p>
                <pre className="agreement">{ag.body.replace('{{TENANT_ADDRESS}}', agAddr.trim() || '[your address]')}</pre>
                <label>Your full address (for the agreement) *<input value={agAddr} onChange={(e) => setAgAddr(e.target.value)} /></label>
                <label className="check"><input type="checkbox" checked={agAgree} onChange={(e) => setAgAgree(e.target.checked)} /> I have read and agree to the terms of this rental agreement</label>
                <label>Type your full name to sign<input value={agName} onChange={(e) => setAgName(e.target.value)} /></label>
                <button className="btn" style={{ width: '100%' }} disabled={!agAgree || agName.trim().length < 3 || agAddr.trim().length < 10 || !!busy} onClick={signAgreement}>{busy === 'agsign' ? 'Signing…' : 'Sign agreement'}</button>
              </>
            )}
          </>
        )}

        {key === 'done' && (
          <div className="success">
            <div className="done-ico"><Icon name="check" size={34} /></div><h3>All done!</h3>
            <p className="muted">Here's what happens next:</p>
            <ol className="next">
              <li>PAN, identity and face checks</li>
              {hasWork && <li>Your HR is emailed to confirm your employment</li>}
              {hasPolice && <li>Police verification (can take a few days)</li>}
              <li>Your landlord receives the report</li>
              {ag?.tenant_signed_at && <li>Your signed rental agreement is saved</li>}
            </ol>
            {ag?.tenant_signed_at && (
              <div style={{ textAlign: 'left' }}>
                <h3>Your signed agreement</h3>
                <AgreementDoc body={ag.body} landlordName={ag.landlord_name} tenantName={ag.tenant_name} landlordSign={ag.landlord_signed_name}
                  landlordAt={ag.landlord_signed_at} tenantSign={ag.tenant_signed_name} tenantAt={ag.tenant_signed_at} hash={ag.hash} />
                <button className="btn alt sm" onClick={printAgreement}>Print / save as PDF</button>
              </div>
            )}
          </div>
        )}

        {err && <p className="note err">{err}</p>}
        {info.has_consent && key !== 'done' && <p className="muted" style={{ marginTop: 18 }}><a href="#" onClick={(e) => { e.preventDefault(); withdraw() }}>Withdraw my consent</a></p>}
      </div>
    </main>
  )
}
