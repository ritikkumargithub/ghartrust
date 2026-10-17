import { useEffect, useState } from 'react'
import { Routes, Route, Navigate, Link } from 'react-router-dom'
import { supabase } from './supabase.js'
import Login from './pages/Login.jsx'
import Dashboard from './pages/Dashboard.jsx'
import RequestDetail from './pages/RequestDetail.jsx'
import Tenant from './pages/Tenant.jsx'
import HrVerify from './pages/HrVerify.jsx'
import Admin from './pages/Admin.jsx'
import AdminReview from './pages/AdminReview.jsx'
import { Loading } from './Loading.jsx'


function Home({ session }) {
  return (
    <main className="hero">
      <div>
        <div className="pill glass"><i className="dot" />Verified renting, built for India</div>
        <h1>Rent to people you can <span className="grad">actually trust.</span></h1>
        <p className="lead">Send one link. Your tenant gives consent and uploads documents. You get a clear verification report.</p>
        <div className="cta">
          <Link className="btn" to={session ? '/dashboard' : '/login'}>{session ? 'Open dashboard' : 'Landlord login'}</Link>
        </div>
      </div>
      <div className="glass mock" aria-label="Sample verification report">
        <header><b>Live verification</b><span className="muted">Sample data</span></header>
        <div className="scan"><div className="face" /><div><b>Rahul S.</b><br /><span className="muted">Scanning face and documents</span></div></div>
        <div className="mrow"><span>PAN + identity</span><b>Verified</b></div>
        <div className="mrow"><span>Face match</span><b>Verified</b></div>
        <div className="mrow"><span>Employer confirmation</span><b>Confirmed</b></div>
        <div className="mrow"><span>Police verification</span><b className="w">In progress</b></div>
      </div>
    </main>
  )
}

export default function App() {
  const [session, setSession] = useState(undefined)
  const [adminFor, setAdminFor] = useState({ id: null, val: false })
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => subscription.unsubscribe()
  }, [])
  const uid = session?.user?.id
  useEffect(() => {
    if (!uid) return
    supabase.rpc('is_admin').then(({ data }) => setAdminFor({ id: uid, val: data === true }))
  }, [uid])
  // null = still checking (prevents redirecting /admin away before the check finishes)
  const isAdmin = !session ? false : adminFor.id === uid ? adminFor.val : null
  const guard = (el) => (session ? el : <Navigate to="/login" replace />)
  return (
    <>
            {session === undefined || (session && isAdmin === null) ? <Loading /> : (
        <Routes>
          <Route path="/" element={<Home session={session} />} />
          <Route path="/login" element={session ? <Navigate to="/dashboard" replace /> : <Login />} />
          <Route path="/dashboard" element={guard(<Dashboard isAdmin={isAdmin} />)} />
          <Route path="/admin" element={isAdmin ? <Admin /> : <Navigate to="/dashboard" replace />} />
          <Route path="/admin/:id" element={isAdmin ? <AdminReview /> : <Navigate to="/dashboard" replace />} />
          <Route path="/request/:id" element={guard(<RequestDetail />)} />
          <Route path="/t/:token" element={<Tenant />} />
          <Route path="/hr/:token" element={<HrVerify />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      )}
    </>
  )
}
