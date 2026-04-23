import { createClient } from '@supabase/supabase-js';

// service_role key — 서버 전용 (크롤러, 크론잡, 데이터 적재)
// 절대 클라이언트에 노출하지 말 것
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
