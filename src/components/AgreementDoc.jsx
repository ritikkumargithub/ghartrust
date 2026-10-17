import { fmtDate } from '../agreement.js'

export function printAgreement() {
  document.body.classList.add('print-agreement')
  window.print()
  setTimeout(() => document.body.classList.remove('print-agreement'), 600)
}

// Shows the agreement text and the electronic signature block.
export default function AgreementDoc({ body, landlordName, tenantName, landlordSign, landlordAt, tenantSign, tenantAt, hash }) {
  return (
    <div className="agreement-print">
      <pre className="agreement">{body}</pre>
      <div className="sigs">
        <div className="sig"><b>LESSOR</b><div>{landlordName}</div>
          {landlordSign ? <><i>{landlordSign}</i><small>Signed electronically on {fmtDate(landlordAt)}</small></> : <small>Not signed yet</small>}</div>
        <div className="sig"><b>LESSEE</b><div>{tenantName}</div>
          {tenantSign ? <><i>{tenantSign}</i><small>Signed electronically on {fmtDate(tenantAt)}</small></> : <small>Not signed yet</small>}</div>
      </div>
      {hash && <p className="muted hashline">Electronically signed on GharTrust. Document fingerprint (SHA-256): {hash}</p>}
    </div>
  )
}
