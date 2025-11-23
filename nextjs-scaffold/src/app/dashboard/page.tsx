// Candidate Dashboard - Simple client-side auth
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { format } from 'date-fns'

export default function DashboardPage() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<any>(null)
  const [examInstances, setExamInstances] = useState<any[]>([])
  const [attempts, setAttempts] = useState<any[]>([])

  useEffect(() => {
    const loadData = async () => {
      // Check auth
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        router.push('/login')
        return
      }

      // Get profile
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single()

      if (profileError || !profileData) {
        router.push('/login')
        return
      }

      // Redirect admin to admin dashboard
      if (profileData.role === 'admin') {
        router.push('/admin')
        return
      }

      setProfile(profileData)

      // Get assigned exams (RLS will filter automatically)
      const { data: exams } = await supabase
        .from('exam_instances')
        .select(
          `
          *,
          template:exam_templates(name, total_questions, time_limit_seconds)
        `
        )
        .order('available_from', { ascending: false })

      setExamInstances(exams || [])

      // Get attempt history
      const { data: attemptsData } = await supabase
        .from('attempts')
        .select(
          `
          *,
          exam_instance:exam_instances(name, template:exam_templates(name))
        `
        )
        .eq('candidate_id', session.user.id)
        .order('started_at', { ascending: false })
        .limit(10)

      setAttempts(attemptsData || [])
      setLoading(false)
    }

    loadData()
  }, [router, supabase])

  if (loading || !profile) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div>Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">Dashboard</h1>

        {/* Profile Info */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Profile</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-sm text-gray-600">Name</div>
              <div className="font-medium">{profile.full_name}</div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Email</div>
              <div className="font-medium">{profile.email}</div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Payment Status</div>
              <div
                className={`font-medium ${
                  profile.payment_status === 'paid'
                    ? 'text-green-600'
                    : 'text-red-600'
                }`}
              >
                {profile.payment_status.toUpperCase()}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Status</div>
              <div className="font-medium">{profile.status.toUpperCase()}</div>
            </div>
          </div>
        </div>

        {/* Available Exams */}
        <div className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">Available Exams</h2>
          {examInstances.length > 0 ? (
            <div className="grid gap-4">
              {examInstances.map((exam) => {
                const template = exam.template as any
                const now = new Date()
                const availableFrom = new Date(exam.available_from)
                const availableUntil = new Date(exam.available_until)
                const isAvailable =
                  now >= availableFrom && now <= availableUntil

                return (
                  <div
                    key={exam.id}
                    className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="text-xl font-semibold mb-2">
                          {exam.name}
                        </h3>
                        <p className="text-gray-600 mb-4">{exam.description}</p>
                        <div className="flex items-center gap-6 text-sm text-gray-600">
                          <span>
                            Questions: {template?.total_questions || 'N/A'}
                          </span>
                          {template?.time_limit_seconds && (
                            <span>
                              Time: {Math.floor(template.time_limit_seconds / 60)}{' '}
                              minutes
                            </span>
                          )}
                          <span>
                            Available:{' '}
                            {format(availableFrom, 'MMM d, yyyy')} -{' '}
                            {format(availableUntil, 'MMM d, yyyy')}
                          </span>
                        </div>
                      </div>
                      <div>
                        {isAvailable ? (
                          <Link
                            href={`/exam/${exam.id}/start`}
                            className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                          >
                            Start Exam
                          </Link>
                        ) : (
                          <div className="px-6 py-2 bg-gray-200 text-gray-600 rounded-lg cursor-not-allowed">
                            Not Available
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow p-6 text-center text-gray-600">
              No exams available at this time.
            </div>
          )}
        </div>

        {/* Attempt History */}
        <div>
          <h2 className="text-2xl font-semibold mb-4">Recent Attempts</h2>
          {attempts.length > 0 ? (
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Exam
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Started
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Score
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {attempts.map((attempt) => {
                    const examInstance = attempt.exam_instance as any
                    return (
                      <tr key={attempt.id}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {examInstance?.name || 'Unknown'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {format(new Date(attempt.started_at), 'MMM d, yyyy HH:mm')}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`px-2 py-1 text-xs rounded-full ${
                              attempt.status === 'released'
                                ? 'bg-green-100 text-green-800'
                                : attempt.status === 'submitted'
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-gray-100 text-gray-800'
                            }`}
                          >
                            {attempt.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {attempt.score_percent !== null
                            ? `${attempt.score_percent.toFixed(1)}%`
                            : 'Pending'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <Link
                            href={`/exam/${attempt.exam_instance_id}/review/${attempt.id}`}
                            className="text-primary-600 hover:text-primary-800"
                          >
                            View
                          </Link>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow p-6 text-center text-gray-600">
              No attempts yet.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
