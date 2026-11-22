import 'server-only';

/**
 * Public Supabase project settings. The publishable key is designed to be public
 * (it is restricted by RLS / security-definer RPCs). No service-role key is used
 * anywhere in this app: privileged admin operations run inside the existing
 * `aicholpon-client-admin` Edge Function, which verifies the admin password.
 */
export const SUPABASE_URL = process.env.SUPABASE_URL ?? 'https://qmuzgzolumobfpburvdb.supabase.co';
export const SUPABASE_PUBLISHABLE_KEY =
  process.env.SUPABASE_PUBLISHABLE_KEY ?? 'sb_publishable_-Ot4rmGU_7O749DLLmhOIw_1TmnlXs7';

/** Mock mode is for local tests only and can never be enabled on a Vercel production deployment. */
export const MOCK_MODE = process.env.AICHOLPON_MOCK === '1' && process.env.VERCEL_ENV !== 'production';

export const UPSTREAM_TIMEOUT_MS = 10_000;
