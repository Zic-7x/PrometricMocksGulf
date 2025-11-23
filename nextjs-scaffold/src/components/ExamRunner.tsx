'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatDistanceToNow } from 'date-fns'

interface Question {
  id: string
  statement: string
  type: 'mcq_single' | 'mcq_multi' | 'true_false' | 'short_text' | 'image_based'
  choices_json: Record<string, string> | null
  correct_answer_json: string[] | null
  explanation: string | null
  points: number
}

interface Answer {
  question_id: string
  answer_json: string[] | null
  answer_text: string | null
  marked_for_review: boolean
}

interface ExamRunnerProps {
  attemptId: string
  examInstanceId: string
  questions: Question[]
  timeLimitSeconds: number | null
  perQuestionTimeLimitSeconds: number | null
  allowReview: boolean
  allowNavigation: boolean
  onComplete: () => void
}

export default function ExamRunner({
  attemptId,
  examInstanceId,
  questions,
  timeLimitSeconds,
  perQuestionTimeLimitSeconds,
  allowReview,
  allowNavigation,
  onComplete,
}: ExamRunnerProps) {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, Answer>>({})
  const [timeRemaining, setTimeRemaining] = useState<number | null>(timeLimitSeconds)
  const [questionStartTime, setQuestionStartTime] = useState<Date>(new Date())
  const [isSubmitting, setIsSubmitting] = useState(false)
  const supabase = createClient()

  const currentQuestion = questions[currentQuestionIndex]
  const currentAnswer = answers[currentQuestion.id] || {
    question_id: currentQuestion.id,
    answer_json: null,
    answer_text: null,
    marked_for_review: false,
  }

  // Auto-save every 15 seconds
  useEffect(() => {
    const autoSaveInterval = setInterval(() => {
      saveAnswer(currentQuestion.id, currentAnswer)
    }, 15000)

    return () => clearInterval(autoSaveInterval)
  }, [currentQuestion.id, currentAnswer])

  // Overall timer
  useEffect(() => {
    if (timeLimitSeconds === null) return

    const timer = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev === null || prev <= 1) {
          handleSubmit()
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [timeLimitSeconds])

  // Per-question timer
  useEffect(() => {
    if (perQuestionTimeLimitSeconds === null) return

    setQuestionStartTime(new Date())
    const timer = setInterval(() => {
      const elapsed = Math.floor(
        (new Date().getTime() - questionStartTime.getTime()) / 1000
      )
      if (elapsed >= perQuestionTimeLimitSeconds) {
        // Auto-advance to next question
        handleNext()
      }
    }, 1000)

    return () => clearInterval(timer)
  }, [currentQuestionIndex, perQuestionTimeLimitSeconds])

  const saveAnswer = useCallback(
    async (questionId: string, answer: Answer) => {
      try {
        const { error } = await supabase.from('answers').upsert({
          attempt_id: attemptId,
          question_id: questionId,
          answer_json: answer.answer_json,
          answer_text: answer.answer_text,
          marked_for_review: answer.marked_for_review,
          time_spent_seconds: Math.floor(
            (new Date().getTime() - questionStartTime.getTime()) / 1000
          ),
          answered_at: new Date().toISOString(),
        })

        if (error) {
          console.error('Error saving answer:', error)
        }
      } catch (error) {
        console.error('Error saving answer:', error)
      }
    },
    [attemptId, supabase, questionStartTime]
  )

  const handleAnswerChange = (value: string | string[]) => {
    const newAnswer: Answer = {
      question_id: currentQuestion.id,
      answer_json: Array.isArray(value) ? value : [value],
      answer_text: currentQuestion.type === 'short_text' || currentQuestion.type === 'image_based' 
        ? (typeof value === 'string' ? value : value[0]) 
        : null,
      marked_for_review: currentAnswer.marked_for_review,
    }

    setAnswers((prev) => ({
      ...prev,
      [currentQuestion.id]: newAnswer,
    }))

    // Save immediately on change
    saveAnswer(currentQuestion.id, newAnswer)
  }

  const handleMarkForReview = () => {
    const newAnswer: Answer = {
      ...currentAnswer,
      marked_for_review: !currentAnswer.marked_for_review,
    }
    setAnswers((prev) => ({
      ...prev,
      [currentQuestion.id]: newAnswer,
    }))
    saveAnswer(currentQuestion.id, newAnswer)
  }

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      saveAnswer(currentQuestion.id, currentAnswer)
      setCurrentQuestionIndex(currentQuestionIndex - 1)
    }
  }

  const handleNext = () => {
    if (currentQuestionIndex < questions.length - 1) {
      saveAnswer(currentQuestion.id, currentAnswer)
      setCurrentQuestionIndex(currentQuestionIndex + 1)
    }
  }

  const handleSubmit = async () => {
    if (isSubmitting) return
    setIsSubmitting(true)

    try {
      // Save final answer
      await saveAnswer(currentQuestion.id, currentAnswer)

      // Submit attempt
      const { error } = await supabase
        .from('attempts')
        .update({
          status: 'submitted',
          submitted_at: new Date().toISOString(),
          time_spent_seconds: timeLimitSeconds
            ? timeLimitSeconds - (timeRemaining || 0)
            : null,
        })
        .eq('id', attemptId)

      if (error) throw error

      // Trigger scoring (this would typically be done server-side)
      // For now, we'll mark as submitted and let server handle scoring

      onComplete()
    } catch (error) {
      console.error('Error submitting exam:', error)
      alert('Error submitting exam. Please try again.')
      setIsSubmitting(false)
    }
  }

  const formatTime = (seconds: number | null) => {
    if (seconds === null) return 'Unlimited'
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const renderQuestion = () => {
    switch (currentQuestion.type) {
      case 'mcq_single':
        return (
          <div className="space-y-4">
            {Object.entries(currentQuestion.choices_json || {}).map(([key, value]) => (
              <label
                key={key}
                className="flex items-center p-4 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
              >
                <input
                  type="radio"
                  name={`question-${currentQuestion.id}`}
                  value={key}
                  checked={currentAnswer.answer_json?.includes(key) || false}
                  onChange={(e) => handleAnswerChange(e.target.value)}
                  className="mr-3 w-5 h-5"
                />
                <span className="font-medium mr-2">{key}.</span>
                <span>{value}</span>
              </label>
            ))}
          </div>
        )

      case 'mcq_multi':
        return (
          <div className="space-y-4">
            {Object.entries(currentQuestion.choices_json || {}).map(([key, value]) => (
              <label
                key={key}
                className="flex items-center p-4 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
              >
                <input
                  type="checkbox"
                  value={key}
                  checked={currentAnswer.answer_json?.includes(key) || false}
                  onChange={(e) => {
                    const current = currentAnswer.answer_json || []
                    const newValue = e.target.checked
                      ? [...current, key]
                      : current.filter((v) => v !== key)
                    handleAnswerChange(newValue)
                  }}
                  className="mr-3 w-5 h-5"
                />
                <span className="font-medium mr-2">{key}.</span>
                <span>{value}</span>
              </label>
            ))}
          </div>
        )

      case 'true_false':
        return (
          <div className="space-y-4">
            {['true', 'false'].map((option) => (
              <label
                key={option}
                className="flex items-center p-4 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
              >
                <input
                  type="radio"
                  name={`question-${currentQuestion.id}`}
                  value={option}
                  checked={currentAnswer.answer_json?.includes(option) || false}
                  onChange={(e) => handleAnswerChange(e.target.value)}
                  className="mr-3 w-5 h-5"
                />
                <span className="capitalize">{option}</span>
              </label>
            ))}
          </div>
        )

      case 'short_text':
      case 'image_based':
        return (
          <textarea
            value={currentAnswer.answer_text || ''}
            onChange={(e) => handleAnswerChange(e.target.value)}
            className="w-full p-4 border rounded-lg min-h-[200px] resize-y"
            placeholder="Enter your answer here..."
          />
        )

      default:
        return null
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header with timer and progress */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold">Exam in Progress</h1>
              <p className="text-sm text-gray-600">
                Question {currentQuestionIndex + 1} of {questions.length}
              </p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-mono font-bold text-red-600">
                {formatTime(timeRemaining)}
              </div>
              <div className="text-sm text-gray-600">Time Remaining</div>
            </div>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-primary-600 h-2 rounded-full transition-all"
              style={{
                width: `${((currentQuestionIndex + 1) / questions.length) * 100}%`,
              }}
            />
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-lg p-8">
          {/* Question */}
          <div className="mb-8">
            <div className="flex items-start justify-between mb-4">
              <h2 className="text-xl font-semibold">
                Question {currentQuestionIndex + 1}
              </h2>
              <span className="px-3 py-1 bg-primary-100 text-primary-800 rounded-full text-sm">
                {currentQuestion.points} {currentQuestion.points === 1 ? 'point' : 'points'}
              </span>
            </div>
            <p className="text-lg mb-6 whitespace-pre-wrap">{currentQuestion.statement}</p>
            {renderQuestion()}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-6 border-t">
            <div className="flex items-center gap-4">
              {allowNavigation && (
                <button
                  onClick={handlePrevious}
                  disabled={currentQuestionIndex === 0}
                  className="px-6 py-2 border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
                >
                  Previous
                </button>
              )}
              <button
                onClick={handleMarkForReview}
                className={`px-6 py-2 border rounded-lg transition-colors ${
                  currentAnswer.marked_for_review
                    ? 'bg-yellow-100 border-yellow-300 text-yellow-800'
                    : 'hover:bg-gray-50'
                }`}
              >
                {currentAnswer.marked_for_review ? '✓ Marked for Review' : 'Mark for Review'}
              </button>
            </div>
            <div className="flex items-center gap-4">
              {currentQuestionIndex < questions.length - 1 ? (
                <button
                  onClick={handleNext}
                  className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                >
                  Next
                </button>
              ) : (
                <button
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? 'Submitting...' : 'Submit Exam'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

