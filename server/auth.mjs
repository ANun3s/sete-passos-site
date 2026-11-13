import { betterAuth } from 'better-auth';

export const FRONTEND_ORIGINS = Object.freeze([
  'http://127.0.0.1:5177', 'http://localhost:5177',
  'http://127.0.0.1:5500', 'http://localhost:5500',
]);

export function createAuth({ db, secret, baseURL = 'http://127.0.0.1:3007', mode = 'development', googleClientId = process.env.GOOGLE_CLIENT_ID, googleClientSecret = process.env.GOOGLE_CLIENT_SECRET }) {
  if (!['development', 'test'].includes(mode) || process.env.NODE_ENV === 'production') {
    throw new Error('Production is blocked: this authentication service is local-only.');
  }
  if (typeof secret !== 'string' || secret.length < 32) throw new Error('A project-specific secret of at least 32 characters is required.');
  const url = new URL(baseURL);
  if (!['127.0.0.1', 'localhost'].includes(url.hostname)) throw new Error('Only a loopback auth URL is allowed.');
  return betterAuth({
    appName: 'Sete Passos — local',
    baseURL,
    basePath: '/api/auth',
    secret,
    database: db,
    trustedOrigins: [...FRONTEND_ORIGINS, baseURL, `${url.protocol}//localhost:${url.port}`],
    emailAndPassword: {
      enabled: true,
      disableSignUp: mode === 'production',
      autoSignIn: false,
      requireEmailVerification: false,
      minPasswordLength: 12,
      maxPasswordLength: 128,
      revokeSessionsOnPasswordReset: true,
    },
    // Google Identity Services sends an ID token directly. Better Auth verifies
    // that token against Google's public keys and the configured Client ID, so
    // this path does not require an OAuth client secret.
    ...(googleClientId ? {
      account: { accountLinking: { trustedProviders: ['google'], requireLocalEmailVerified: true } },
      socialProviders: {
        google: { clientId: googleClientId, clientSecret: googleClientSecret || '', requireEmailVerification: true },
      },
    } : {}),
    user: {
      additionalFields: {
        cpf: { type: 'string', required: false, unique: true, input: true, returned: false },
      },
    },
    session: {
      expiresIn: 60 * 60 * 24,
      updateAge: 60 * 60,
      cookieCache: { enabled: false },
    },
    advanced: {
      cookiePrefix: 'sete-passos',
      useSecureCookies: url.protocol === 'https:',
      defaultCookieAttributes: { httpOnly: true, sameSite: 'lax', path: '/' },
      ipAddress: { ipAddressHeaders: ['x-sete-passos-peer-ip'] },
      disableCSRFCheck: false,
      disableOriginCheck: false,
    },
    rateLimit: {
      enabled: true,
      storage: 'database',
      window: 60,
      max: 120,
      customRules: {
        '/sign-in/email': { window: 60, max: 10 },
        '/sign-up/email': { window: 60, max: 10 },
      },
    },
    // No credential bodies, tokens, or account identifiers in library logs.
    logger: { disabled: true },
    telemetry: { enabled: false },
  });
}
