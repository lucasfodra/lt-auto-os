// Vercel Serverless Function — Official UK DVSA MOT History Proxy (Bypasses Browser CORS)
// Endpoint: GET /api/dvsa?vrn=SG09ZNJ

let cachedToken = null;
let cachedExpiresAt = 0;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, x-dvsa-token-url, x-dvsa-client-id, x-dvsa-client-secret, x-dvsa-api-key, x-dvsa-scope'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const vrn = String(req.query.vrn || '')
    .replace(/\s+/g, '')
    .toUpperCase();

  if (!vrn) {
    return res.status(400).json({ error: 'Missing VRN parameter' });
  }

  const tokenUrl =
    req.headers['x-dvsa-token-url'] || process.env.DVSA_TOKEN_URL || '';
  const clientId =
    req.headers['x-dvsa-client-id'] || process.env.DVSA_CLIENT_ID || '';
  const clientSecret =
    req.headers['x-dvsa-client-secret'] || process.env.DVSA_CLIENT_SECRET || '';
  const apiKey =
    req.headers['x-dvsa-api-key'] || process.env.DVSA_API_KEY || '';
  const scope =
    req.headers['x-dvsa-scope'] ||
    process.env.DVSA_SCOPE_URL ||
    'https://tapi.dvsa.gov.uk/.default';

  if (!tokenUrl || !clientId || !clientSecret || !apiKey) {
    return res.status(400).json({
      error: 'DVSA_CREDENTIALS_MISSING',
      message: 'Configure as credenciais DVSA na aba Config & APIs.',
    });
  }

  try {
    const now = Date.now();
    if (!cachedToken || cachedExpiresAt <= now + 60_000) {
      const body = new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: String(clientId),
        client_secret: String(clientSecret),
        scope: String(scope),
      });

      const tokenResp = await fetch(String(tokenUrl), {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      });

      if (!tokenResp.ok) {
        const errText = await tokenResp.text();
        return res.status(tokenResp.status).json({
          error: 'DVSA_OAUTH_ERROR',
          details: errText.slice(0, 300),
        });
      }

      const tokenData = await tokenResp.json();
      cachedToken = tokenData.access_token;
      cachedExpiresAt = now + Number(tokenData.expires_in || 3599) * 1000;
    }

    const motUrl = `https://history.mot.api.gov.uk/v1/trade/vehicles/registration/${encodeURIComponent(
      vrn
    )}`;
    const motResp = await fetch(motUrl, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${cachedToken}`,
        'X-API-Key': String(apiKey),
        Accept: 'application/json',
      },
    });

    if (!motResp.ok) {
      const errBody = await motResp.text();
      return res.status(motResp.status).json({
        error: 'DVSA_LOOKUP_ERROR',
        status: motResp.status,
        details: errBody.slice(0, 300),
      });
    }

    const data = await motResp.json();
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({
      error: 'DVSA_SERVER_EXCEPTION',
      message: err instanceof Error ? err.message : String(err),
    });
  }
}
