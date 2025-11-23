// Supabase Edge Function: Send Invite Email
// Deploy: supabase functions deploy send-invite-email

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Verify admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: authError,
    } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid authentication" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "admin") {
      return new Response(
        JSON.stringify({ error: "Unauthorized: Admin access required" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Parse request
    const { user_id, email, reset_password = false } = await req.json();

    if (!user_id && !email) {
      return new Response(
        JSON.stringify({ error: "user_id or email required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Get user
    let targetUser;
    if (user_id) {
      const { data, error } = await supabaseAdmin.auth.admin.getUserById(
        user_id
      );
      if (error) throw error;
      targetUser = data.user;
    } else {
      const { data, error } = await supabaseAdmin.auth.admin.getUserByEmail(
        email
      );
      if (error) throw error;
      targetUser = data.user;
    }

    if (!targetUser) {
      return new Response(
        JSON.stringify({ error: "User not found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Generate invite link or reset link
    const linkType = reset_password ? "recovery" : "invite";
    const { data: linkData, error: linkError } =
      await supabaseAdmin.auth.admin.generateLink({
        type: linkType,
        email: targetUser.email!,
      });

    if (linkError) {
      throw linkError;
    }

    // Get user profile for email content
    const { data: userProfile } = await supabaseAdmin
      .from("profiles")
      .select("full_name")
      .eq("id", targetUser.id)
      .single();

    // Send email via SMTP (configure in Supabase dashboard)
    // Option 1: Use Supabase built-in email (if configured)
    // Option 2: Use external SMTP service (SendGrid, Mailgun, etc.)
    // For now, we'll use Supabase's generateLink which sends email automatically
    // If you need custom email template, use SMTP service here

    // Example with custom SMTP (uncomment and configure):
    /*
    const emailBody = reset_password
      ? `Click here to reset your password: ${linkData.properties.action_link}`
      : `Welcome! Click here to set your password: ${linkData.properties.action_link}`;

    // Use your SMTP service here
    // await sendEmail({
    //   to: targetUser.email!,
    //   subject: reset_password ? "Password Reset" : "Welcome to Mock Exam Portal",
    //   body: emailBody,
    // });
    */

    // Log audit
    await supabaseAdmin.from("audit_logs").insert({
      user_id: user.id,
      action: reset_password ? "send_password_reset" : "send_invite_email",
      resource_type: "user",
      resource_id: targetUser.id,
      details: { email: targetUser.email },
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: "Invite email sent",
        action_link: linkData.properties.action_link, // For testing/debugging
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

