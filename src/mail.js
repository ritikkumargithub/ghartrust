import { supabase } from './supabase.js'

// Called right after the landlord pays: emails the tenant their verification link (if an email was given).
export async function emailTenantAfterPayment(req) {
  if (!req.tenant_email) return 'Payment done. Send the link to your tenant by WhatsApp or copy the link.'
  const { error } = await supabase.functions.invoke('send-tenant-email', { body: { request_id: req.id, site_url: location.origin } })
  return error
    ? 'Payment done. Automatic email is not set up yet, so send the link by WhatsApp or copy it.'
    : `Payment done. We emailed the verification link to ${req.tenant_email}.`
}
