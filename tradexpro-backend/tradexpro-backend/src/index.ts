const DERIV_APP_ID = '339IyLjCcUmBEXEzG6tsS';
const DERIV_AUTH_URL = 'https://auth.deriv.com';
const DERIV_API_URL = 'https://api.derivws.com';
const ALLOWED_ORIGIN = 'https://tradexpro.co.ke';

function corsHeaders(origin: string) {
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
  };
}

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') || '';

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    // POST /token - exchange OAuth code for token
    if (url.pathname === '/token' && request.method === 'POST') {
      const body = await request.json() as any;
      const { code, code_verifier, redirect_uri } = body;

      const resp = await fetch(`${DERIV_AUTH_URL}/oauth2/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          client_id: DERIV_APP_ID,
          code,
          code_verifier,
          redirect_uri,
        }),
      });

      const data = await resp.json();
      return new Response(JSON.stringify(data), {
        status: resp.status,
        headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
      });
    }

    // POST /otp - get WebSocket OTP URL
    if (url.pathname === '/otp' && request.method === 'POST') {
      const body = await request.json() as any;
      const { account_id, access_token } = body;

      const resp = await fetch(`${DERIV_API_URL}/trading/v1/options/accounts/${account_id}/otp`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${access_token}`,
          'Deriv-App-ID': DERIV_APP_ID,
        },
      });

      const data = await resp.json();
      return new Response(JSON.stringify(data), {
        status: resp.status,
        headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
      });
    }

    // GET /session - validate token
    if (url.pathname === '/session' && request.method === 'GET') {
      const auth = request.headers.get('Authorization') || '';
      const resp = await fetch(`${DERIV_API_URL}/trading/v1/accounts`, {
        headers: {
          'Authorization': auth,
          'Deriv-App-ID': DERIV_APP_ID,
        },
      });

      const data = await resp.json();
      return new Response(JSON.stringify(data), {
        status: resp.status,
        headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
      });
    }

    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
    });
  },
};
