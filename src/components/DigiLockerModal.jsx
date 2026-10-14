import { useState } from 'react'
import { sleep } from '../lib.js'

export default function DigiLockerModal({ onClose, onConnected }) {
  const [step, setStep] = useState(0)
  const [a4, setA4] = useState('')
  const [otp, setOtp] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const sendOtp = async () => {
    if (!/^\d{4}$/.test(a4)) return setErr('Enter the last 4 digits of your Aadhaar')
    setErr(''); setBusy(true); await sleep(900); setBusy(false); setStep(1)
  }
  const verifyOtp = async () => {
    if (!/^\d{6}$/.test(otp)) return setErr('Enter the 6-digit OTP')
    setErr(''); setBusy(true); await sleep(1000); setBusy(false); setStep(2)
  }
  const allow = async () => {
    setBusy(true); await sleep(1200); setStep(3); await sleep(1100)
    onConnected({ aadhaar_last4: a4, digilocker_status: 'connected' })
  }

  return (
    <div className="overlay" onClick={step < 3 && !busy ? onClose : undefined}>
      <div className="modal glass" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="note">🧪 <b>Demo DigiLocker.</b> This is a simulation, not the real DigiLocker. Real integration comes with a licensed provider.</div>
        {step === 0 && (
          <>
            <h3>Sign in to DigiLocker</h3>
            <p className="muted">We'll send an OTP to your Aadhaar-linked mobile.</p>
            <label>Last 4 digits of Aadhaar<input inputMode="numeric" maxLength={4} placeholder="1234" value={a4} onChange={(e) => setA4(e.target.value.replace(/\D/g, ''))} /></label>
            <p className="muted">We never ask for or store your full Aadhaar number.</p>
            {err && <p className="note err">{err}</p>}
            <button className="btn" style={{ width: '100%' }} disabled={busy} onClick={sendOtp}>{busy ? 'Sending OTP…' : 'Send OTP'}</button>
          </>
        )}
        {step === 1 && (
          <>
            <h3>Enter OTP</h3>
            <p className="muted">Demo: enter any 6 digits.</p>
            <label>6-digit OTP<input inputMode="numeric" maxLength={6} placeholder="••••••" value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))} /></label>
            {err && <p className="note err">{err}</p>}
            <button className="btn" style={{ width: '100%' }} disabled={busy} onClick={verifyOtp}>{busy ? 'Verifying…' : 'Verify OTP'}</button>
          </>
        )}
        {step === 2 && (
          <>
            <h3>Allow GharTrust to access</h3>
            <ul className="pts">
              <li>Your Aadhaar identity details (name, date of birth, address)</li>
              <li>Your PAN card, if available in DigiLocker</li>
            </ul>
            <p className="muted">Used only to verify your tenancy application. You can withdraw consent any time.</p>
            <div className="actions"><button className="btn alt" onClick={onClose} disabled={busy}>Deny</button><button className="btn" onClick={allow} disabled={busy}>{busy ? 'Connecting…' : 'Allow'}</button></div>
          </>
        )}
        {step === 3 && <div className="success"><div className="big">🔗</div><h3>DigiLocker connected</h3><p className="muted">Identity details received.</p></div>}
      </div>
    </div>
  )
}
