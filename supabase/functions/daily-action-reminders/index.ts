import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Acquire Microsoft Graph API access token
async function getGraphAccessToken(): Promise<string> {
  const tenantId = Deno.env.get('AZURE_TENANT_ID')!;
  const clientId = Deno.env.get('AZURE_CLIENT_ID')!;
  const clientSecret = Deno.env.get('AZURE_CLIENT_SECRET')!;

  const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    scope: 'https://graph.microsoft.com/.default',
    grant_type: 'client_credentials',
  });

  const res = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Failed to get Graph token: ${res.status} ${errText}`);
  }

  const data = await res.json();
  return data.access_token;
}

// Send email via Microsoft Graph API
async function sendEmailViaGraph(
  accessToken: string,
  toEmail: string,
  toName: string,
  subject: string,
  htmlBody: string
): Promise<boolean> {
  const senderEmail = Deno.env.get('AZURE_SENDER_EMAIL')!;
  const url = `https://graph.microsoft.com/v1.0/users/${senderEmail}/sendMail`;

  const emailPayload = {
    message: {
      subject,
      body: { contentType: 'HTML', content: htmlBody },
      toRecipients: [{ emailAddress: { address: toEmail, name: toName } }],
    },
    saveToSentItems: false,
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(emailPayload),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error(`Graph sendMail failed for ${toEmail}: ${res.status} ${errText}`);
    return false;
  }

  // 202 Accepted - no body to consume
  return true;
}

// Build HTML email for action item reminders
function buildReminderEmail(
  userName: string,
  actionItems: Array<{ title: string; due_date: string | null; priority: string; status: string }>,
  overdueCount: number,
  highPriorityCount: number,
  appUrl: string
): string {
  const today = new Date().toISOString().split('T')[0];

  const rows = actionItems
    .map((item) => {
      const isOverdue = item.due_date && item.due_date < today;
      const isHigh = item.priority === 'High';
      const rowStyle = isOverdue
        ? 'background-color:#FEF2F2;'
        : isHigh
        ? 'background-color:#FFFBEB;'
        : '';
      const dueDateDisplay = item.due_date
        ? `${item.due_date}${isOverdue ? ' ⚠️' : ''}`
        : '—';
      const priorityBadge =
        item.priority === 'High'
          ? '<span style="color:#DC2626;font-weight:600;">High</span>'
          : item.priority === 'Medium'
          ? '<span style="color:#D97706;">Medium</span>'
          : '<span style="color:#6B7280;">Low</span>';

      return `<tr style="${rowStyle}">
        <td style="padding:10px 12px;border-bottom:1px solid #E5E7EB;">${item.title}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #E5E7EB;">${dueDateDisplay}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #E5E7EB;">${priorityBadge}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #E5E7EB;">${item.status}</td>
      </tr>`;
    })
    .join('');

  const summaryParts: string[] = [];
  if (overdueCount > 0) summaryParts.push(`<span style="color:#DC2626;font-weight:600;">${overdueCount} overdue</span>`);
  if (highPriorityCount > 0) summaryParts.push(`<span style="color:#D97706;font-weight:600;">${highPriorityCount} high priority</span>`);
  const summaryLine = summaryParts.length > 0 ? `<p style="margin:0 0 16px;">${summaryParts.join(' · ')}</p>` : '';

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background-color:#F3F4F6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#F3F4F6;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background-color:#FFFFFF;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
        <!-- Header -->
        <tr><td style="background-color:#1E40AF;padding:24px 32px;">
          <h1 style="margin:0;color:#FFFFFF;font-size:20px;font-weight:600;">📋 Daily Action Items Reminder</h1>
        </td></tr>
        <!-- Body -->
        <tr><td style="padding:32px;">
          <p style="margin:0 0 16px;font-size:16px;color:#111827;">Hi ${userName},</p>
          <p style="margin:0 0 16px;font-size:15px;color:#374151;">You have <strong>${actionItems.length}</strong> pending action item${actionItems.length > 1 ? 's' : ''} that need your attention.</p>
          ${summaryLine}
          <!-- Table -->
          <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E5E7EB;border-radius:6px;overflow:hidden;font-size:14px;color:#374151;">
            <thead>
              <tr style="background-color:#F9FAFB;">
                <th style="padding:10px 12px;text-align:left;font-weight:600;border-bottom:2px solid #E5E7EB;">Title</th>
                <th style="padding:10px 12px;text-align:left;font-weight:600;border-bottom:2px solid #E5E7EB;">Due Date</th>
                <th style="padding:10px 12px;text-align:left;font-weight:600;border-bottom:2px solid #E5E7EB;">Priority</th>
                <th style="padding:10px 12px;text-align:left;font-weight:600;border-bottom:2px solid #E5E7EB;">Status</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
          <!-- CTA -->
          <div style="margin-top:24px;text-align:center;">
            <a href="${appUrl}/action-items" style="display:inline-block;padding:12px 28px;background-color:#1E40AF;color:#FFFFFF;text-decoration:none;border-radius:6px;font-weight:600;font-size:14px;">View Action Items</a>
          </div>
        </td></tr>
        <!-- Footer -->
        <tr><td style="padding:16px 32px;background-color:#F9FAFB;border-top:1px solid #E5E7EB;">
          <p style="margin:0;font-size:12px;color:#9CA3AF;text-align:center;">You received this email because you have action item reminders enabled. Manage your preferences in CRM Settings.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const appUrl = 'https://crm.realthingks.com';

    // Check for test mode
    let testUserId: string | null = null;
    try {
      const body = await req.json();
      testUserId = body?.test_user_id || null;
    } catch { /* no body or not JSON */ }

    if (testUserId) {
      console.log(`TEST MODE: Running for user ${testUserId} only, bypassing time checks`);
    }

    // Get all users with task_reminders enabled
    let prefsQuery = supabase
      .from('notification_preferences')
      .select('user_id, daily_reminder_time, last_reminder_sent_at, email_notifications')
      .eq('task_reminders', true);

    if (testUserId) {
      prefsQuery = prefsQuery.eq('user_id', testUserId);
    }

    const { data: prefs, error: prefsError } = await prefsQuery;

    if (prefsError) throw prefsError;
    if (!prefs || prefs.length === 0) {
      return new Response(JSON.stringify({ message: 'No users with task reminders enabled' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get user timezones and emails from profiles
    const userIds = prefs.map(p => p.user_id);
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, timezone, full_name, "Email ID"')
      .in('id', userIds);

    if (profilesError) throw profilesError;

    const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
    const now = new Date();
    let notificationsSent = 0;
    let emailsSent = 0;

    // Acquire Graph token once (only if any user has email_notifications enabled)
    let graphToken: string | null = null;
    const anyEmailEnabled = prefs.some(p => p.email_notifications);
    if (anyEmailEnabled) {
      try {
        graphToken = await getGraphAccessToken();
        console.log('Graph API token acquired successfully');
      } catch (err) {
        console.error('Failed to acquire Graph token, emails will be skipped:', err);
      }
    }

    for (const pref of prefs) {
      const profile = profileMap.get(pref.user_id);
      const timezone = profile?.timezone || 'Asia/Kolkata';
      const reminderTime = pref.daily_reminder_time || '09:00';

      // Get current time in user's timezone
      const userNow = new Date(now.toLocaleString('en-US', { timeZone: timezone }));
      const userHour = userNow.getHours();
      const userMinute = userNow.getMinutes();

      // Parse reminder time
      const [reminderHour, reminderMinute] = reminderTime.split(':').map(Number);

      // Check if current time is within a 15-minute window of the reminder time
      const userTotalMinutes = userHour * 60 + userMinute;
      const reminderTotalMinutes = reminderHour * 60 + reminderMinute;
      const diff = userTotalMinutes - reminderTotalMinutes;

      if (!testUserId && (diff < 0 || diff >= 15)) {
        continue;
      }

      // Check if reminder already sent today (in user's timezone)
      const userToday = `${userNow.getFullYear()}-${(userNow.getMonth() + 1).toString().padStart(2, '0')}-${userNow.getDate().toString().padStart(2, '0')}`;
      if (!testUserId && pref.last_reminder_sent_at === userToday) {
        continue;
      }

      // Query incomplete action items for this user
      const { data: actionItems, error: aiError } = await supabase
        .from('action_items')
        .select('id, title, due_date, priority, status')
        .eq('assigned_to', pref.user_id)
        .neq('status', 'Completed')
        .is('archived_at', null);

      if (aiError) {
        console.error(`Error fetching action items for user ${pref.user_id}:`, aiError);
        continue;
      }

      if (!actionItems || actionItems.length === 0) {
        continue;
      }

      // Count overdue and high priority items
      const overdueCount = actionItems.filter(item => {
        if (!item.due_date) return false;
        return new Date(item.due_date) < new Date(userToday);
      }).length;

      const highPriorityCount = actionItems.filter(item => item.priority === 'High').length;

      // Build in-app notification message
      let message = `📋 Daily Reminder: You have ${actionItems.length} pending action item${actionItems.length > 1 ? 's' : ''}`;
      const details: string[] = [];
      if (overdueCount > 0) details.push(`${overdueCount} overdue`);
      if (highPriorityCount > 0) details.push(`${highPriorityCount} high priority`);
      if (details.length > 0) message += ` (${details.join(', ')})`;

      // Insert in-app notification
      const { error: notifError } = await supabase
        .from('notifications')
        .insert({
          user_id: pref.user_id,
          message,
          notification_type: 'task_reminder',
          status: 'unread',
        });

      if (notifError) {
        console.error(`Error inserting notification for user ${pref.user_id}:`, notifError);
        continue;
      }

      notificationsSent++;
      console.log(`Sent in-app reminder to user ${pref.user_id}: ${message}`);

      // Send email if enabled and Graph token available
      if (pref.email_notifications && graphToken && profile) {
        const userEmail = profile['Email ID'];
        const userName = profile.full_name || 'User';

        if (userEmail) {
          try {
            const subject = overdueCount > 0
              ? `⚠️ ${overdueCount} Overdue Action Items - Daily Reminder`
              : `📋 ${actionItems.length} Pending Action Items - Daily Reminder`;

            const htmlBody = buildReminderEmail(userName, actionItems, overdueCount, highPriorityCount, appUrl);
            const sent = await sendEmailViaGraph(graphToken, userEmail, userName, subject, htmlBody);

            if (sent) {
              emailsSent++;
              console.log(`Email sent to ${userEmail} for user ${pref.user_id}`);
            }
          } catch (emailErr) {
            console.error(`Error sending email to ${userEmail}:`, emailErr);
          }
        } else {
          console.log(`No email found for user ${pref.user_id}, skipping email`);
        }
      }

      // Update last_reminder_sent_at
      await supabase
        .from('notification_preferences')
        .update({ last_reminder_sent_at: userToday })
        .eq('user_id', pref.user_id);
    }

    return new Response(JSON.stringify({
      message: `Processed ${prefs.length} users, sent ${notificationsSent} in-app reminders, ${emailsSent} emails`,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in daily-action-reminders:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
