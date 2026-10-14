import { useState } from 'react'
import { supabase } from '../supabase.js'
import { FEE_PAISE, inr, sleep } from '../lib.js'

const BANKS = ['State Bank of India', 'HDFC Bank', 'ICICI Bank', 'Axis Bank', 'Kotak Mahindra Bank']

export default function PayModal({ request, onClose, onPaid }) {
  const [method, setMethod] = useState('upi')
  const [upi, setUpi] = useState('')
  const [card, setCard] = useState({ number: '', exp: '', cvv: '' })
  const [bank, setBank] = useState(BANKS[0])
  const [stage, setStage] = useState('form')
  const [err, setErr] = useState('')

  const validate = () => {
    if (method === 'upi' && !/^[\w.-]{2,}@[a-zA-Z]{2,}$/.test(upi.trim())) return 'Enter a valid UPI ID, e.g. name@okbank'
    if (method === 'card') {
      if (card.number.replace(/\s/g, '').length !== 16) return 'Enter a 16-digit card number'
      if (!/^\d{2}\/\d{2}$/.test(card.exp)) return 'Expiry must be MM/YY'
      if (!/^\d{3}$/.test(card.cvv)) return 'Enter the 3-digit CVV'
    }
    return ''
  }

  const pay = async () => {
    const v = validate()
    if (v) return setErr(v)
    setErr(''); setStage('processing')
    await sleep(1800)
    const { error } = await supabase.rpc('mock_pay', { p_request_id: request.id, p_method: method })
    if (error) { setStage('form'); return setErr(error.message) }
    setStage('success')
    await sleep(1300)
    onPaid()
  }

  return (
    <div className="overlay" onClick={stage === 'form' ? onClose : undefined}>
      <div className="modal glass" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        {stage === 'success' ? (
          <div className="success"><div className="big">✅</div><h3>Payment successful</h3><p className="muted">Verification link is now active for {request.tenant_name}.</p></div>
        ) : stage === 'processing' ? (
          <div className="success"><div className="center"><div className="spin" /></div><h3>Processing payment…</h3><p className="muted">Please don't close this window.</p></div>
        ) : (
          <>
            <div className="bar"><h3 style={{ margin: 0 }}>Pay for verification</h3><button className="btn alt sm" onClick={onClose}>✕</button></div>
            <div className="note">🧪 <b>Test mode.</b> No real money is charged. A real gateway (UPI / cards) replaces this later.</div>
            <div className="amount"><span className="muted">Tenant: {request.tenant_name}</span><b>{inr(FEE_PAISE)}</b></div>
            <div className="tabs">
              {[['upi', 'UPI'], ['card', 'Card'], ['netbanking', 'Net banking']].map(([k, t]) => (
                <button key={k} className={`tab ${method === k ? 'on' : ''}`} onClick={() => { setMethod(k); setErr('') }}>{t}</button>
              ))}
            </div>
            {method === 'upi' && <label>UPI ID<input placeholder="name@okbank" value={upi} onChange={(e) => setUpi(e.target.value)} /></label>}
            {method === 'card' && (
              <>
                <label>Card number<input inputMode="numeric" placeholder="4242 4242 4242 4242" maxLength={19} value={card.number}
                  onChange={(e) => setCard({ ...card, number: e.target.value.replace(/[^\d]/g, '').replace(/(.{4})/g, '$1 ').trim() })} /></label>
                <div className="two">
                  <label>Expiry<input placeholder="MM/YY" maxLength={5} value={card.exp} onChange={(e) => setCard({ ...card, exp: e.target.value })} /></label>
                  <label>CVV<input inputMode="numeric" placeholder="123" maxLength={3} type="password" value={card.cvv} onChange={(e) => setCard({ ...card, cvv: e.target.value.replace(/\D/g, '') })} /></label>
                </div>
              </>
            )}
            {method === 'netbanking' && (
              <label>Choose your bank
                <select value={bank} onChange={(e) => setBank(e.target.value)}>{BANKS.map((b) => <option key={b}>{b}</option>)}</select>
              </label>
            )}
            {err && <p className="note err">{err}</p>}
            <button className="btn" style={{ width: '100%' }} onClick={pay}>Pay {inr(FEE_PAISE)}</button>
          </>
        )}
      </div>
    </div>
  )
}
