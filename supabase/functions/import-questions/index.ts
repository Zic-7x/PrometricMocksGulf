// Supabase Edge Function: Import Questions from CSV
// Deploy: supabase functions deploy import-questions

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { parse } from "https://deno.land/std@0.168.0/csv/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface QuestionRow {
  profession: string;
  medical_field: string;
  health_authority: string;
  type: "mcq_single" | "mcq_multi" | "true_false" | "short_text" | "image_based";
  statement: string;
  choices_json: string; // JSON string
  correct_json: string; // JSON string
  explanation?: string;
  difficulty?: "easy" | "medium" | "hard";
  topic?: string;
  tags?: string; // Semicolon-separated
  source?: string;
  points?: string;
  negative_marking?: string;
}

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

    // Parse CSV from request body
    const { csv_data, file_name = "import.csv" } = await req.json();

    if (!csv_data) {
      return new Response(
        JSON.stringify({ error: "Missing csv_data" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Parse CSV
    const rows = parse(csv_data, {
      skipFirstRow: true,
      columns: [
        "profession",
        "medical_field",
        "health_authority",
        "type",
        "statement",
        "choices_json",
        "correct_json",
        "explanation",
        "difficulty",
        "topic",
        "tags",
        "source",
        "points",
        "negative_marking",
      ],
    }) as QuestionRow[];

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

    // Validate and insert questions
    const results = {
      successful: [] as any[],
      failed: [] as any[],
    };

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        // Validate required fields
        if (
          !row.profession ||
          !row.medical_field ||
          !row.health_authority ||
          !row.type ||
          !row.statement ||
          !row.correct_json
        ) {
          results.failed.push({
            row_number: i + 2, // +2 for header and 0-index
            row,
            error: "Missing required fields",
          });
          continue;
        }

        // Validate question type
        const validTypes = [
          "mcq_single",
          "mcq_multi",
          "true_false",
          "short_text",
          "image_based",
        ];
        if (!validTypes.includes(row.type)) {
          results.failed.push({
            row_number: i + 2,
            row,
            error: `Invalid type: ${row.type}`,
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
            row_number: i + 2,
            row,
            error: `Invalid reference: profession=${row.profession}, field=${row.medical_field}, authority=${row.health_authority}`,
          });
          continue;
        }

        // Parse JSON fields
        let choicesJson: any = null;
        if (row.choices_json) {
          try {
            choicesJson = JSON.parse(row.choices_json);
          } catch {
            results.failed.push({
              row_number: i + 2,
              row,
              error: "Invalid choices_json format",
            });
            continue;
          }
        }

        let correctAnswerJson: any = null;
        try {
          correctAnswerJson = JSON.parse(row.correct_json);
        } catch {
          results.failed.push({
            row_number: i + 2,
            row,
            error: "Invalid correct_json format",
          });
          continue;
        }

        // Parse tags
        const tags = row.tags
          ? row.tags.split(";").map((t) => t.trim()).filter((t) => t)
          : [];

        // Parse points and negative marking
        const points = row.points ? parseFloat(row.points) : 1.0;
        const negativeMarking = row.negative_marking
          ? parseFloat(row.negative_marking)
          : 0.0;

        // Validate difficulty
        const difficulty = row.difficulty || "medium";
        if (!["easy", "medium", "hard"].includes(difficulty)) {
          results.failed.push({
            row_number: i + 2,
            row,
            error: `Invalid difficulty: ${difficulty}`,
          });
          continue;
        }

        // Insert question
        const { data: question, error: insertError } = await supabaseAdmin
          .from("question_bank")
          .insert({
            statement: row.statement,
            type: row.type,
            choices_json: choicesJson,
            correct_answer_json: correctAnswerJson,
            explanation: row.explanation || null,
            profession_id: professionId,
            medical_field_id: medicalFieldId,
            health_authority_id: healthAuthorityId,
            topic: row.topic || null,
            difficulty: difficulty,
            tags: tags.length > 0 ? tags : null,
            source: row.source || null,
            points: points,
            negative_marking: negativeMarking,
            status: "active",
            created_by: user.id,
          })
          .select()
          .single();

        if (insertError) {
          results.failed.push({
            row_number: i + 2,
            row,
            error: insertError.message,
          });
          continue;
        }

        results.successful.push({
          row_number: i + 2,
          question_id: question.id,
        });
      } catch (error) {
        results.failed.push({
          row_number: i + 2,
          row,
          error: error.message,
        });
      }
    }

    // Log import history
    await supabaseAdmin.from("import_history").insert({
      import_type: "questions",
      imported_by: user.id,
      file_name: file_name,
      total_rows: rows.length,
      successful_rows: results.successful.length,
      failed_rows: results.failed.length,
      error_report: results.failed,
      status: "completed",
      completed_at: new Date().toISOString(),
    });

    return new Response(
      JSON.stringify({
        success: true,
        total: rows.length,
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

