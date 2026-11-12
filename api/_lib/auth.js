import { createRemoteJWKSet, jwtVerify } from 'jose';
import { ApiError } from './errors.js';

let cachedVerifier;
let cachedConfig;

export async function authenticatedUser(request) {
  const authorization = request.headers.get('authorization') ?? '';
  const match = /^Bearer ([A-Za-z0-9_.-]+)$/.exec(authorization);
  if (!match) throw new ApiError(401, 'Faça login para acessar seus dados financeiros.');

  const base = process.env.NEON_AUTH_BASE_URL;
  const jwksUrl = process.env.NEON_AUTH_JWKS_URL;
  if (!base || !jwksUrl) throw new ApiError(503, 'Autenticação indisponível neste ambiente.');

  let origin;
  try {
    const auth = new URL(base);
    const keys = new URL(jwksUrl);
    if (
      auth.protocol !== 'https:' ||
      keys.protocol !== 'https:' ||
      auth.origin !== keys.origin ||
      auth.username ||
      auth.password ||
      keys.username ||
      keys.password
    )
      throw new Error('Configuração de autenticação inválida.');
    origin = auth.origin;
  } catch {
    throw new ApiError(503, 'Configuração de autenticação indisponível.');
  }

  if (cachedConfig !== jwksUrl) {
    cachedVerifier = createRemoteJWKSet(new URL(jwksUrl));
    cachedConfig = jwksUrl;
  }

  try {
    const { payload } = await jwtVerify(match[1], cachedVerifier, {
      algorithms: ['EdDSA'],
      issuer: origin,
      audience: origin,
      requiredClaims: ['sub', 'exp'],
      clockTolerance: '10 seconds',
    });
    if (typeof payload.sub !== 'string' || payload.sub.length < 1 || payload.sub.length > 120)
      throw new Error('Identity invalid');
    return payload.sub;
  } catch (error) {
    if (
      error instanceof TypeError ||
      ['ERR_JWKS_TIMEOUT', 'ERR_JWKS_INVALID', 'ERR_JOSE_GENERIC'].includes(error.code)
    )
      throw new ApiError(503, 'Não foi possível verificar sua sessão. Tente novamente.');
    throw new ApiError(401, 'Sua sessão expirou ou é inválida. Entre novamente.');
  }
}
