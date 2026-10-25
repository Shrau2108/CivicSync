import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const allowedRoles = new Set(['citizen', 'volunteer', 'supervisor', 'analyst', 'admin']);

function respond(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return respond({ error: 'Method not allowed' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    console.error('Admin invite function is missing Supabase environment configuration.');
    return respond({ error: 'User invitations are not configured on this project.' }, 500);
  }

  const authorization = request.headers.get('Authorization');
  const token = authorization?.replace(/^Bearer\s+/i, '');
  if (!token) return respond({ error: 'Authentication is required.' }, 401);

  const authClient = createClient(supabaseUrl, anonKey);
  const { data: authData, error: authError } = await authClient.auth.getUser(token);
  if (authError || !authData.user) return respond({ error: 'Your session is invalid or expired.' }, 401);

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: actor, error: actorError } = await adminClient
    .from('profiles')
    .select('role')
    .eq('id', authData.user.id)
    .maybeSingle();
  if (actorError) {
    console.error('Could not verify admin role:', actorError.message);
    return respond({ error: 'Could not verify administrator permissions.' }, 500);
  }
  if (actor?.role !== 'admin') return respond({ error: 'Only administrators can invite users.' }, 403);

  let input: { fullName?: unknown; email?: unknown; phone?: unknown; role?: unknown };
  try {
    input = await request.json();
  } catch {
    return respond({ error: 'Request body must be valid JSON.' }, 400);
  }

  const fullName = typeof input.fullName === 'string' ? input.fullName.trim() : '';
  const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : '';
  const phone = typeof input.phone === 'string' ? input.phone.trim() : '';
  const role = typeof input.role === 'string' ? input.role : '';
  if (fullName.length < 2 || fullName.length > 100) return respond({ error: 'Enter a name between 2 and 100 characters.' }, 400);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return respond({ error: 'Enter a valid email address.' }, 400);
  if (phone.length > 32) return respond({ error: 'Phone number must be 32 characters or fewer.' }, 400);
  if (!allowedRoles.has(role)) return respond({ error: 'Select a valid role.' }, 400);

  // Check for duplicate user email before sending invite
  const { data: existingProfile } = await adminClient
    .from('profiles')
    .select('id, email')
    .eq('email', email)
    .maybeSingle();
  if (existingProfile) {
    return respond({ error: 'An account with this email address already exists.' }, 400);
  }

  const { data: invitation, error: invitationError } = await adminClient.auth.admin.inviteUserByEmail(email, {
    data: { full_name: fullName, phone: phone || null, role },
  });
  if (invitationError || !invitation.user) {
    const errorMsg = invitationError?.message || '';
    if (errorMsg.toLowerCase().includes('already') || errorMsg.toLowerCase().includes('registered')) {
      return respond({ error: 'An account with this email address already exists.' }, 400);
    }
    return respond({ error: invitationError?.message || 'Supabase did not return the invited user.' }, 400);
  }

  const { data: profile, error: profileError } = await adminClient
    .from('profiles')
    .update({ full_name: fullName, phone: phone || null, role, is_active: true })
    .eq('id', invitation.user.id)
    .select('*')
    .single();
  if (profileError || !profile) {
    console.error('Could not assign the invited user role:', profileError?.message);
    await adminClient.auth.admin.deleteUser(invitation.user.id);
    return respond({ error: 'The invitation could not be assigned its requested role. No account was kept.' }, 500);
  }

  // Provision corresponding volunteer record if volunteer role was chosen
  if (role === 'volunteer') {
    await adminClient
      .from('volunteers')
      .upsert({ user_id: profile.id, is_verified: true, verification_status: 'verified' })
      .select()
      .maybeSingle();
  }

  const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('cf-connecting-ip') || null;
  const { error: auditError } = await adminClient.from('audit_logs').insert({
    actor_id: authData.user.id,
    action: 'invite_user',
    entity_type: 'profile',
    entity_id: profile.id,
    details: {
      email,
      role,
      target_name: fullName,
      target_email: email,
      target_role: role,
      result: 'success',
    },
    ip_address: clientIp,
    result: 'success',
  });
  if (auditError) console.error('Could not write invitation audit log:', auditError.message);

  return respond({ profile, invitationSent: true }, 201);
});