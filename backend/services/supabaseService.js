const { createClient } = require('@supabase/supabase-js');

// ─── Supabase admin client ────────────────────────────────────────────────────
const getAdminClient = () => {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
};

// ─── Email sender (Brevo) ─────────────────────────────────────────────────────
const sendVerificationEmail = async (toEmail, confirmationLink) => {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

  // Always log link so devs can test without any provider configured
  console.log('\n========================================');
  console.log('📧 EMAIL VERIFICATION LINK');
  console.log(`   To:   ${toEmail}`);
  console.log(`   Link: ${confirmationLink}`);
  console.log('========================================\n');

  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey || apiKey === 'your_brevo_api_key_here') {
    console.warn('[Brevo] BREVO_API_KEY not set — email not sent. Open the link above to verify manually.');
    return;
  }

  const { BrevoClient } = require('@getbrevo/brevo');
  const client = new BrevoClient({ apiKey });

  await client.transactionalEmails.sendTransacEmail({
    sender: {
      name: process.env.BREVO_FROM_NAME || 'MedChain',
      email: process.env.BREVO_FROM_EMAIL || 'lanishathomas7606@gmail.com'
    },
    to: [{ email: toEmail }],
    subject: 'Verify your MedChain email address',
    htmlContent: `<!DOCTYPE html>
<html>
<body style="font-family:Arial,sans-serif;background:#f4f7fb;margin:0;padding:0;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 0;">
<tr><td align="center">
<table width="520" cellpadding="0" cellspacing="0"
  style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
<tr><td style="background:#2563eb;padding:32px;text-align:center;">
  <h1 style="color:#fff;margin:0;font-size:24px;">MedChain</h1>
  <p style="color:#bfdbfe;margin:6px 0 0;font-size:14px;">Healthcare Management System</p>
</td></tr>
<tr><td style="padding:36px 40px;">
  <h2 style="color:#1e293b;margin:0 0 12px;font-size:20px;">Verify your email address</h2>
  <p style="color:#475569;font-size:15px;line-height:1.6;margin:0 0 24px;">
    Thanks for registering with MedChain. Click the button below to confirm your email and activate your account.
  </p>
  <div style="text-align:center;margin:32px 0;">
    <a href="${confirmationLink}"
      style="background:#2563eb;color:#fff;text-decoration:none;padding:14px 36px;
             border-radius:8px;font-size:15px;font-weight:600;display:inline-block;">
      Confirm Email Address
    </a>
  </div>
  <p style="color:#94a3b8;font-size:13px;margin:0;">
    This link expires in 24 hours. If you didn't create a MedChain account, ignore this email.
  </p>
</td></tr>
<tr><td style="background:#f8fafc;padding:20px 40px;text-align:center;border-top:1px solid #e2e8f0;">
  <p style="color:#94a3b8;font-size:12px;margin:0;">
    &copy; ${new Date().getFullYear()} MedChain &middot;
    <a href="${frontendUrl}" style="color:#2563eb;">medchain.app</a>
  </p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`
  });

  console.log(`[Brevo] Verification email sent to ${toEmail}`);
};

// ─── Public API ───────────────────────────────────────────────────────────────

const createSupabaseUser = async (email, password) => {
  const supabase = getAdminClient();

  let userId;
  let isExistingUser = false;

  const { data: createData, error: createError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: false
  });

  if (createError) {
    const msg = createError.message?.toLowerCase() ?? '';
    if (msg.includes('already registered') || msg.includes('already been registered') || createError.status === 422) {
      console.warn(`[Supabase] User already exists for ${email}, reusing`);
      const { data: listData, error: listError } = await supabase.auth.admin.listUsers();
      if (listError) throw listError;
      const existing = listData.users.find(u => u.email === email);
      if (!existing) throw new Error(`[Supabase] Cannot find existing user for ${email}`);
      userId = existing.id;
      isExistingUser = true;
    } else {
      throw createError;
    }
  } else {
    userId = createData.user.id;
  }

  const redirectTo = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/email-verified`;

  const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
    type: isExistingUser ? 'magiclink' : 'signup',
    email,
    ...(isExistingUser ? {} : { password }),
    options: { redirectTo }
  });

  if (linkError) {
    console.error(`[Supabase] generateLink failed for ${email}:`, linkError.message);
  } else {
    const confirmationLink = linkData?.properties?.action_link;
    if (confirmationLink) {
      await sendVerificationEmail(email, confirmationLink);
    }
  }

  return { supabaseUserId: userId };
};

const checkEmailVerified = async ({ supabaseUserId, email }) => {
  const supabase = getAdminClient();
  let supabaseUser = null;

  if (supabaseUserId) {
    const { data, error } = await supabase.auth.admin.getUserById(supabaseUserId);
    if (error) throw error;
    supabaseUser = data.user;
  } else if (email) {
    const { data, error } = await supabase.auth.admin.listUsers();
    if (error) throw error;
    supabaseUser = data.users.find(u => u.email === email) ?? null;
  } else {
    throw new Error('Provide supabaseUserId or email to checkEmailVerified');
  }

  if (!supabaseUser) return false;
  return !!(supabaseUser.email_confirmed_at || supabaseUser.last_sign_in_at);
};

const confirmUserEmail = async (supabaseUserId) => {
  const supabase = getAdminClient();
  const { error } = await supabase.auth.admin.updateUserById(supabaseUserId, {
    email_confirm: true
  });
  if (error) throw error;
};

const resendVerificationEmail = async (email) => {
  const supabase = getAdminClient();
  const redirectTo = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/email-verified`;

  const { data: linkData, error } = await supabase.auth.admin.generateLink({
    type: 'magiclink',
    email,
    options: { redirectTo }
  });

  if (error) throw error;

  const confirmationLink = linkData?.properties?.action_link;
  if (confirmationLink) {
    await sendVerificationEmail(email, confirmationLink);
  }
};

module.exports = { createSupabaseUser, checkEmailVerified, resendVerificationEmail, confirmUserEmail };
