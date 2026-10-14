import { useState } from 'react'
import { supabase } from '../supabase.js'

export default function Login() {
  const [mode, setMode] = useState('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setMsg('')
    const { error, data } = mode === 'signin'
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password })
    setBusy(false)
    if (error) setMsg(error.message)
    else if (mode === 'signup' && !data.session) setMsg('Check your email to confirm your account, then sign in.')
  }

  return (
    <main className="narrow" style={{paddingTop:"8vh"}}><div className="card">
      <div className="logo" style={{marginBottom:12}}>Ghar<span className="grad">Trust</span></div>
      <h2>{mode === 'signin' ? 'Landlord sign in' : 'Create landlord account'}</h2>
      <form onSubmit={submit}>
        <label>Email<input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
        <label>Password<input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} /></label>
        <button className="btn" disabled={busy}>{busy ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Sign up'}</button>
      </form>
      {msg && <p className="note">{msg}</p>}
      <p className="muted">
        {mode === 'signin' ? 'New here? ' : 'Have an account? '}
        <a href="#" onClick={(e) => { e.preventDefault(); setMode(mode === 'signin' ? 'signup' : 'signin') }}>
          {mode === 'signin' ? 'Create an account' : 'Sign in'}
        </a>
      </p>
    </div></main>
  )
}
