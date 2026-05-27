import { GoogleAuth } from 'google-auth-library'
const propertyId = process.env.GOOGLE_GA4_PROPERTY_ID
const auth = new GoogleAuth({
  credentials: { client_email: process.env.GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL, private_key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n') },
  scopes: ['https://www.googleapis.com/auth/analytics.edit'],
})
const token = (await (await auth.getClient()).getAccessToken()).token
async function get(path) {
  const r = await fetch(`https://analyticsadmin.googleapis.com${path}`, { headers: { Authorization: `Bearer ${token}` } })
  return { status: r.status, body: await r.json() }
}
const prop = await get(`/v1beta/properties/${propertyId}`)
console.log('PROPERTY:', JSON.stringify(prop.body, null, 2))
const sig = await get(`/v1alpha/properties/${propertyId}/googleSignalsSettings`)
console.log('\nGOOGLE SIGNALS:', JSON.stringify(sig.body, null, 2))
const stream = await get(`/v1beta/properties/${propertyId}/dataStreams`)
const webStream = stream.body.dataStreams?.find(s => s.type === 'WEB_DATA_STREAM')
if (webStream) {
  const enhanced = await get(`/v1beta/${webStream.name}/enhancedMeasurementSettings`)
  console.log('\nENHANCED MEASUREMENT:', JSON.stringify(enhanced.body, null, 2))
}
