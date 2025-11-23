// API Route: Start Exam Attempt
// POST /api/exams/[id]/start

import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = user.id

    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId as any)
      .single()

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    const profileData = profile as any

    // Check if candidate
    if (profileData.role !== 'candidate') {
      return NextResponse.json({ error: 'Only candidates can start exams' }, { status: 403 })
    }

    // Check payment status
    if (profileData.payment_status !== 'paid') {
      return NextResponse.json(
        { error: 'Payment required. Please contact admin.' },
        { status: 403 }
      )
    }

    // Check exam access
    if (!profileData.exam_access_enabled || profileData.status !== 'active') {
      return NextResponse.json(
        { error: 'Exam access is disabled' },
        { status: 403 }
      )
    }

    const examInstanceId = params.id

    // Get exam instance (RLS will filter to only assigned exams)
    const { data: examInstance, error: examError } = await supabase
      .from('exam_instances')
      .select(
        `
        *,
        template:exam_templates(*)
      `
      )
      .eq('id', examInstanceId as any)
      .single()

    if (examError || !examInstance) {
      return NextResponse.json({ error: 'Exam not found' }, { status: 404 })
    }

    const examInstanceData = examInstance as any

    // Check availability window
    const now = new Date()
    const availableFrom = new Date(examInstanceData.available_from)
    const availableUntil = new Date(examInstanceData.available_until)

    if (now < availableFrom || now > availableUntil) {
      return NextResponse.json(
        { error: 'Exam is not available at this time' },
        { status: 403 }
      )
    }

    // Check for existing in-progress attempt
    const { data: existingAttempt } = await supabase
      .from('attempts')
      .select('id')
      .eq('exam_instance_id', examInstanceId as any)
      .eq('candidate_id', user.id as any)
      .eq('status', 'in_progress' as any)
      .single()

    if (existingAttempt) {
      const attemptData = existingAttempt as any
      return NextResponse.json(
        { error: 'You already have an in-progress attempt', attempt_id: attemptData.id },
        { status: 400 }
      )
    }

    // Get template
    const template = examInstanceData.template as any

    // Select questions based on template rules
    const questionSelectionRules = template.question_selection_rules as Array<{
      topic?: string
      difficulty?: string
      count: number
    }>

    const selectedQuestionIds: string[] = []

    for (const rule of questionSelectionRules) {
      let query = supabase
        .from('question_bank')
        .select('id')
        .eq('profession_id', profileData.profession_id as any)
        .eq('medical_field_id', profileData.medical_field_id as any)
        .eq('health_authority_id', profileData.health_authority_id as any)
        .eq('status', 'active' as any)
        .is('deleted_at', null)

      if (rule.topic) {
        query = query.eq('topic', rule.topic as any)
      }
      if (rule.difficulty) {
        query = query.eq('difficulty', rule.difficulty as any)
      }

      const { data: questions, error: questionsError } = await query

      if (questionsError || !questions || questions.length === 0) {
        return NextResponse.json(
          { error: `Not enough questions available for rule: ${JSON.stringify(rule)}` },
          { status: 400 }
        )
      }

      // Randomly select questions
      const questionsData = questions as any[]
      const shuffled = questionsData.sort(() => Math.random() - 0.5)
      const selected = shuffled.slice(0, rule.count).map((q: any) => q.id)
      selectedQuestionIds.push(...selected)
    }

    // Shuffle if configured
    if (template.shuffle_questions) {
      selectedQuestionIds.sort(() => Math.random() - 0.5)
    }

    // Create attempt
    const { data: attempt, error: attemptError } = await supabase
      .from('attempts')
      .insert({
        exam_instance_id: examInstanceId,
        candidate_id: user.id,
        selected_question_ids: selectedQuestionIds,
        status: 'in_progress',
        started_at: new Date().toISOString(),
      } as any)
      .select()
      .single()

    if (attemptError) {
      return NextResponse.json(
        { error: 'Failed to create attempt', details: attemptError.message },
        { status: 500 }
      )
    }

    // Get full question details
    const { data: questions, error: questionsError } = await supabase
      .from('question_bank')
      .select('*')
      .in('id', selectedQuestionIds as any)

    if (questionsError) {
      return NextResponse.json(
        { error: 'Failed to load questions' },
        { status: 500 }
      )
    }

    // Shuffle choices if configured (for display only, not stored)
    const questionsData = (questions || []) as any[]
    let questionsToReturn = questionsData
    if (template.shuffle_choices) {
      questionsToReturn = questionsData.map((q) => {
        if (q.choices_json && typeof q.choices_json === 'object') {
          const entries = Object.entries(q.choices_json)
          entries.sort(() => Math.random() - 0.5)
          return { ...q, choices_json: Object.fromEntries(entries) }
        }
        return q
      })
    }

    const attemptData = attempt as any

    return NextResponse.json({
      attempt_id: attemptData.id,
      questions: questionsToReturn,
      time_limit_seconds: template.time_limit_seconds,
      per_question_time_limit_seconds: template.per_question_time_limit_seconds,
      allow_review: template.allow_review,
      allow_navigation: template.allow_navigation,
    })
  } catch (error: any) {
    console.error('Error starting exam:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

