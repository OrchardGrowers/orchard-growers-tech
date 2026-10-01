// Proposals never mutate the form. Applying them is an explicit review action.
export function captureReview(detected = {}, form = {}, label) {
  const allowed = {tradeLicence:["tradeLicenceNumber","tradeBusinessName"],idProof:["idProofNumber"],pan:["panNumber"],gstCertificate:["gstNumber"],passbookFile:["accountNumber","ifscCode","bankAccountHolderName"]}[label] || [];
  return Object.entries(detected).filter(([field,value])=>allowed.includes(field) && typeof value==="string" && value.trim()).map(([field,value])=>({field,value,entered:String(form[field]||""),changed:Boolean(form[field] && form[field]!==value), ...(label === "tradeLicence" ? {displayOnly:true} : {})}));
}
export function confirmCaptureReview(form, proposals) {
  return {...form,...Object.fromEntries(proposals.filter(item=>!item.displayOnly).map(({field,value})=>[field,value]))};
}
