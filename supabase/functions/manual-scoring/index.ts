// Supabase Edge Function: Manual Scoring Helper
// Deploy: supabase functions deploy manual-scoring

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
    const { answer_id, points_awarded, grading_notes } = await req.json();

    if (!answer_id || points_awarded === undefined) {
      return new Response(
        JSON.stringify({
          error: "answer_id and points_awarded are required",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Get answer with question details
    const { data: answer, error: answerError } = await supabaseAdmin
      .from("answers")
      .select(
        `
        *,
        question:question_bank(points, negative_marking),
        attempt:attempts(id, status)
      `
      )
      .eq("id", answer_id)
      .single();

    if (answerError || !answer) {
      return new Response(
        JSON.stringify({ error: "Answer not found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Validate attempt status
    if (answer.attempt.status !== "submitted") {
      return new Response(
        JSON.stringify({ error: "Attempt must be submitted before grading" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const question = answer.question as any;
    const maxPoints = question.points || 1.0;

    // Validate points_awarded
    if (points_awarded < 0 || points_awarded > maxPoints) {
      return new Response(
        JSON.stringify({
          error: `points_awarded must be between 0 and ${maxPoints}`,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Update answer
    const { error: updateError } = await supabaseAdmin
      .from("answers")
      .update({
        manually_graded: true,
        graded_by: user.id,
        graded_at: new Date().toISOString(),
        points_awarded: points_awarded,
        points_deducted: 0, // Manual grading doesn't use negative marking
        grading_notes: grading_notes || null,
      })
      .eq("id", answer_id);

    if (updateError) {
      throw updateError;
    }

    // Recalculate attempt score
    const { error: calcError } = await supabaseAdmin.rpc(
      "calculate_attempt_score",
      { attempt_uuid: answer.attempt.id }
    );

    if (calcError) {
      console.error("Error calculating attempt score:", calcError);
      // Don't fail the request, but log the error
    }

    // Check if all subjective questions are graded
    const { data: remainingAnswers } = await supabaseAdmin
      .from("answers")
      .select("id")
      .eq("attempt_id", answer.attempt.id)
      .eq("manually_graded", false)
      .in("question:question_bank.type", [
        "short_text",
        "image_based",
      ] as any);

    // If all subjective questions are graded, mark attempt as graded
    if (!remainingAnswers || remainingAnswers.length === 0) {
      await supabaseAdmin
        .from("attempts")
        .update({
          manual_grading_completed: true,
          status: "graded",
        })
        .eq("id", answer.attempt.id);
    }

    // Log audit
    await supabaseAdmin.from("audit_logs").insert({
      user_id: user.id,
      action: "grade_answer",
      resource_type: "answer",
      resource_id: answer_id,
      details: {
        attempt_id: answer.attempt.id,
        points_awarded,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: "Answer graded successfully",
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

