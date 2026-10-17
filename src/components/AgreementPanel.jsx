import { useEffect, useState } from 'react'
import { supabase } from '../supabase.js'
import AgreementDoc, { printAgreement } from './AgreementDoc.jsx'
import { buildAgreementText, PROPERTY_TYPES, REQUIRED } from '../agreement.js'

const today = () => new Date().toISOString().slice(0, 10)

export default function AgreementPanel({ request, readOnly = false }) {
  const [row, setRow] = useState(undefined)
  const [d, setD] = useState({ agreement_date: today(), property_type: 'Apartment', lease_term: '11 months', notice_period: 'one month', rent_due_day: '1st day', property_address: request.property_label || '' })
  const [preview, setPreview] = useState(false)
  const [agree, setAgree] = useState(false)
  const [sign, setSign] = useState('')
  const [busy, setBusy] = useState('')
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const set = (k, val) => setD((x) => ({ ...x, [k]: val }))

  const load = async () => {
    const { data } = await supabase.from('agreements').select('*').eq('request_id', request.id).maybeSingle()
    setRow(data); if (data?.data) setD((x) => ({ ...x, ...data.data }))
  }
  useEffect(() => { load() }, [request.id])

  if (row === undefined) return null
  const locked = !!row?.tenant_signed_at || readOnly
  const draftText = buildAgreementText(d, request.tenant_name, row?.tenant_address)

  const save = async (signName) => {
    setBusy(signName ? 'sign' : 'save'); setErr(''); setMsg('')
    if (signName && REQUIRED.some((k) => !String(d[k] ?? '').trim())) { setBusy(''); return setErr('Please fill in the owner name, owner address, place, property address, lease term, start date, rent and deposit.') }
    const { error } = await supabase.rpc('save_agreement', { p_request_id: request.id, p_data: d, p_body: draftText, p_sign_name: signName || null })
    setBusy('')
    if (error) return setErr(error.message)
    setMsg(signName ? 'Signed and sent. Your tenant can now sign it from their link.' : 'Draft saved.')
    setAgree(false); await load()
  }

  const status = row?.tenant_signed_at ? ['passed', 'Signed by both'] : row?.landlord_signed_at ? ['needs_review', 'Signed by you · waiting for tenant'] : row ? ['pending', 'Draft'] : ['pending', 'Not started']
  const field = (k, label, props = {}) => <label>{label}<input disabled={locked} value={d[k] ?? ''} onChange={(e) => set(k, e.target.value)} {...props} /></label>

  return (
    <section className="card">
      <div className="bar"><h2 style={{ margin: 0 }}>Rental agreement</h2><span className={`badge ${status[0]}`}>{status[1]}</span></div>

      {row?.tenant_signed_at ? (
        <>
          <AgreementDoc body={row.final_body} landlordName={d.landlord_name} tenantName={request.tenant_name} landlordSign={row.landlord_signed_name}
            landlordAt={row.landlord_signed_at} tenantSign={row.tenant_signed_name} tenantAt={row.tenant_signed_at} hash={row.final_hash} />
          <button className="btn alt sm noprint" onClick={printAgreement}>Print / save as PDF</button>
        </>
      ) : readOnly ? <p className="muted">The landlord has not signed an agreement yet.</p> : (
        <>
          <p className="muted">Fill in the details. The agreement is created in the standard residential rental format, and your tenant signs it after submitting their verification.</p>
          <div className="two">
            {field('landlord_name', 'Owner (lessor) name *')}{field('city_state', 'Place of agreement (city, state) *')}
          </div>
          {field('landlord_address', 'Owner address *')}
          {field('property_address', 'Rented property address *')}
          <div className="two">
            <label>Property type<select disabled={locked} value={d.property_type} onChange={(e) => set('property_type', e.target.value)}>{PROPERTY_TYPES.map((t) => <option key={t}>{t}</option>)}</select></label>
            {field('area_sqft', 'Area (sq ft)', { inputMode: 'numeric' })}
          </div>
          <div className="three">
            {field('bedrooms', 'Bedrooms', { inputMode: 'numeric' })}{field('bathrooms', 'Bathrooms', { inputMode: 'numeric' })}{field('carparks', 'Car parks', { inputMode: 'numeric' })}
          </div>
          <div className="two">
            {field('lease_term', 'Lease term *')}{field('lease_start', 'Lease start date *', { type: 'date' })}
          </div>
          <div className="two">
            {field('monthly_rent', 'Monthly rent (₹) *', { inputMode: 'numeric' })}{field('deposit', 'Security deposit (₹) *', { inputMode: 'numeric' })}
          </div>
          <div className="three">
            {field('rent_due_day', 'Rent due on', { placeholder: '1st day' })}{field('notice_period', 'Notice period')}{field('start_meter_reading', 'Start meter reading')}
          </div>
          <div className="two">{field('agreement_date', 'Agreement date', { type: 'date' })}</div>
          <label>Fixtures and fittings (one per line)<textarea rows={3} disabled={locked} value={d.fixtures || ''} onChange={(e) => set('fixtures', e.target.value)} /></label>
          <div className="two">{field('witness1', 'Witness one (name & address)')}{field('witness2', 'Witness two (name & address)')}</div>

          <div className="actions" style={{ margin: '12px 0' }}>
            <button className="btn alt sm" onClick={() => setPreview(!preview)}>{preview ? 'Hide preview' : 'Preview agreement'}</button>
            <button className="btn alt sm" disabled={!!busy} onClick={() => save(null)}>{busy === 'save' ? 'Saving…' : 'Save draft'}</button>
          </div>
          {preview && <pre className="agreement">{draftText.replace('{{TENANT_ADDRESS}}', '[tenant address: filled in by tenant]')}</pre>}

          <h3>Sign and send to tenant</h3>
          <label className="check"><input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} /> I have read the agreement and agree to its terms</label>
          <label>Type your full name to sign<input value={sign} onChange={(e) => setSign(e.target.value)} /></label>
          <button className="btn" disabled={!agree || sign.trim().length < 3 || !!busy} onClick={() => save(sign.trim())}>{busy === 'sign' ? 'Signing…' : 'Sign and send to tenant'}</button>
          {row?.landlord_signed_at && <p className="muted">You signed on {new Date(row.landlord_signed_at).toLocaleString('en-IN')}. Editing and signing again replaces your signature.</p>}
          <p className="note"><span>This is an electronic agreement for your records. In India, rental agreements are usually made on stamp paper (stamp duty differs by state), and leases of more than 11 months generally need registration. Please have a lawyer review the format before relying on it.</span></p>
        </>
      )}
      {msg && <p className="note">{msg}</p>}{err && <p className="note err">{err}</p>}
    </section>
  )
}
