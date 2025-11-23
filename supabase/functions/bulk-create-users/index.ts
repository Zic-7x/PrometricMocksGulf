// Supabase Edge Function: Bulk Create Users
// Deploy: supabase functions deploy bulk-create-users

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

interface CandidateRow {
  email: string;
  full_name: string;
  profession: string;
  medical_field: string;
  health_authority: string;
  payment_status?: "paid" | "unpaid" | "pending";
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    // Initialize Supabase Admin Client (bypasses RLS)
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

    // Get auth token from request
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

    // Verify admin user
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

    // Check if user is admin
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profileError || profile?.role !== "admin") {
      return new Response(
        JSON.stringify({ error: "Unauthorized: Admin access required" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Parse request body
    const { candidates, send_invites = false } = await req.json();

    if (!Array.isArray(candidates) || candidates.length === 0) {
      return new Response(
        JSON.stringify({ error: "Invalid candidates array" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Get reference data
    const { data: professions } = await supabaseAdmin
      .from("professions")
      .select("id, code");

    const { data: medicalFields } = await supabaseAdmin
      .from("medical_fields")
      .select("id, code");

    const { data: healthAuthorities } = await supabaseAdmin
      .from("health_authorities")
      .select("id, code");

    const professionMap = new Map(
      professions?.map((p) => [p.code.toLowerCase(), p.id]) ?? []
    );
    const medicalFieldMap = new Map(
      medicalFields?.map((m) => [m.code.toLowerCase(), m.id]) ?? []
    );
    const healthAuthorityMap = new Map(
      healthAuthorities?.map((h) => [h.code.toLowerCase(), h.id]) ?? []
    );

    // Process candidates
    const results = {
      successful: [] as any[],
      failed: [] as any[],
    };

    for (const candidate of candidates) {
      try {
        const row: CandidateRow = candidate;

        // Validate required fields
        if (
          !row.email ||
          !row.full_name ||
          !row.profession ||
          !row.medical_field ||
          !row.health_authority
        ) {
          results.failed.push({
            row,
            error: "Missing required fields",
          });
          continue;
        }

        // Resolve IDs
        const professionId =
          professionMap.get(row.profession.toLowerCase()) ??
          professionMap.get(row.profession);
        const medicalFieldId =
          medicalFieldMap.get(row.medical_field.toLowerCase()) ??
          medicalFieldMap.get(row.medical_field);
        const healthAuthorityId =
          healthAuthorityMap.get(row.health_authority.toLowerCase()) ??
          healthAuthorityMap.get(row.health_authority);

        if (!professionId || !medicalFieldId || !healthAuthorityId) {
          results.failed.push({
            row,
            error: `Invalid reference: profession=${row.profession}, field=${row.medical_field}, authority=${row.health_authority}`,
          });
          continue;
        }

        // Check if user already exists
        const { data: existingUser } = await supabaseAdmin.auth.admin.getUserByEmail(
          row.email
        );

        if (existingUser?.user) {
          results.failed.push({
            row,
            error: "User already exists",
          });
          continue;
        }

        // Generate temporary password
        const tempPassword =
          Math.random().toString(36).slice(-12) +
          Math.random().toString(36).slice(-12).toUpperCase() +
          "!@#";

        // Create auth user
        const { data: newUser, error: createError } =
          await supabaseAdmin.auth.admin.createUser({
            email: row.email,
            password: tempPassword,
            email_confirm: true, // Auto-confirm email
            user_metadata: {
              full_name: row.full_name,
            },
          });

        if (createError || !newUser.user) {
          results.failed.push({
            row,
            error: createError?.message ?? "Failed to create user",
          });
          continue;
        }

        // Create profile
        const { error: profileError } = await supabaseAdmin
          .from("profiles")
          .insert({
            id: newUser.user.id,
            email: row.email,
            full_name: row.full_name,
            role: "candidate",
            profession_id: professionId,
            medical_field_id: medicalFieldId,
            health_authority_id: healthAuthorityId,
            payment_status: row.payment_status ?? "unpaid",
            status: "active",
            exam_access_enabled: true,
            created_by: user.id,
          });

        if (profileError) {
          // Rollback: delete auth user
          await supabaseAdmin.auth.admin.deleteUser(newUser.user.id);
          results.failed.push({
            row,
            error: profileError.message,
          });
          continue;
        }

        // Send invite email if requested
        if (send_invites) {
          // Call email function or use Supabase Auth invite
          await supabaseAdmin.auth.admin.generateLink({
            type: "invite",
            email: row.email,
          });
        }

        results.successful.push({
          email: row.email,
          user_id: newUser.user.id,
          temp_password: send_invites ? undefined : tempPassword, // Only return if not sending invite
        });
      } catch (error) {
        results.failed.push({
          row: candidate,
          error: error.message,
        });
      }
    }

    // Log import history
    await supabaseAdmin.from("import_history").insert({
      import_type: "candidates",
      imported_by: user.id,
      file_name: "bulk_import",
      total_rows: candidates.length,
      successful_rows: results.successful.length,
      failed_rows: results.failed.length,
      error_report: results.failed,
      status: "completed",
      completed_at: new Date().toISOString(),
    });

    return new Response(
      JSON.stringify({
        success: true,
        total: candidates.length,
        successful: results.successful.length,
        failed: results.failed.length,
        results,
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

