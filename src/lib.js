export const FEE_PAISE = 29900
export const inr = (paise) => '₹' + (paise / 100).toLocaleString('en-IN')
export const CHECK_ORDER = ['pan', 'identity', 'face_match', 'employment', 'income', 'police']
export const CHECK_LABEL = {
  pan: 'PAN verification', identity: 'Aadhaar via DigiLocker', face_match: 'Face match',
  employment: 'Employment', income: 'Income', police: 'Police verification',
}
export const CHECK_HELP = {
  pan: 'PAN matched with the Income Tax record', identity: 'Identity fetched from DigiLocker', face_match: 'Selfie compared with ID photo',
  employment: 'Employer and role confirmed', income: 'Salary evidence reviewed', police: 'Registered with local police',
}
export const DOC_LABEL = { pan: 'PAN card', id_proof: 'ID proof', selfie: 'Selfie', employment_doc: 'Offer letter / payslip', bank_statement: 'Bank statement' }
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
