// Admin Dashboard - Simple client-side auth
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { format } from 'date-fns'

export default function AdminDashboardPage() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<any>(null)
  const [stats, setStats] = useState({
    users: 0,
    exams: 0,
    attempts: 0,
    questions: 0,
  })
  const [recentUsers, setRecentUsers] = useState<any[]>([])
  const [recentAttempts, setRecentAttempts] = useState<any[]>([])

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

      // Check if admin
      if (profileData.role !== 'admin') {
        router.push('/dashboard')
        return
      }

      setProfile(profileData)

      // Get statistics
      const [usersResult, examsResult, attemptsResult, questionsResult] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'candidate'),
        supabase.from('exam_instances').select('id', { count: 'exact', head: true }),
        supabase.from('attempts').select('id', { count: 'exact', head: true }),
        supabase.from('questions').select('id', { count: 'exact', head: true }),
      ])

      setStats({
        users: usersResult.count || 0,
        exams: examsResult.count || 0,
        attempts: attemptsResult.count || 0,
        questions: questionsResult.count || 0,
      })

      // Get recent users
      const { data: users } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'candidate')
        .order('created_at', { ascending: false })
        .limit(5)

      setRecentUsers(users || [])

      // Get recent attempts
      const { data: attempts } = await supabase
        .from('attempts')
        .select(
          `
          *,
          candidate:profiles!attempts_candidate_id_fkey(full_name, email),
          exam_instance:exam_instances(name)
        `
        )
        .order('started_at', { ascending: false })
        .limit(5)

      setRecentAttempts(attempts || [])
      setLoading(false)
    }

    loadData()
  }, [router, supabase])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div>Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Admin Dashboard</h1>
          <Link
            href="/admin/users/create"
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            Create User
          </Link>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm text-gray-600 mb-2">Total Candidates</div>
            <div className="text-3xl font-bold">{stats.users}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm text-gray-600 mb-2">Total Exams</div>
            <div className="text-3xl font-bold">{stats.exams}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm text-gray-600 mb-2">Total Attempts</div>
            <div className="text-3xl font-bold">{stats.attempts}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm text-gray-600 mb-2">Total Questions</div>
            <div className="text-3xl font-bold">{stats.questions}</div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Recent Users */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-xl font-semibold">Recent Candidates</h2>
            </div>
            <div className="p-6">
              {recentUsers.length > 0 ? (
                <div className="space-y-4">
                  {recentUsers.map((user) => (
                    <div key={user.id} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0">
                      <div>
                        <div className="font-medium">{user.full_name}</div>
                        <div className="text-sm text-gray-600">{user.email}</div>
                      </div>
                      <div className="text-right">
                        <div
                          className={`text-sm font-medium ${
                            user.payment_status === 'paid'
                              ? 'text-green-600'
                              : 'text-red-600'
                          }`}
                        >
                          {user.payment_status.toUpperCase()}
                        </div>
                        <div className="text-xs text-gray-500">
                          {user.created_at
                            ? format(new Date(user.created_at), 'MMM d, yyyy')
                            : 'N/A'}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center text-gray-500 py-8">No candidates yet</div>
              )}
            </div>
          </div>

          {/* Recent Attempts */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-xl font-semibold">Recent Attempts</h2>
            </div>
            <div className="p-6">
              {recentAttempts.length > 0 ? (
                <div className="space-y-4">
                  {recentAttempts.map((attempt: any) => {
                    const candidate = attempt.candidate as any
                    const examInstance = attempt.exam_instance as any
                    return (
                      <div
                        key={attempt.id}
                        className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0"
                      >
                        <div>
                          <div className="font-medium">
                            {candidate?.full_name || 'Unknown'}
                          </div>
                          <div className="text-sm text-gray-600">
                            {examInstance?.name || 'Unknown Exam'}
                          </div>
                        </div>
                        <div className="text-right">
                          <div
                            className={`text-sm font-medium ${
                              attempt.status === 'released'
                                ? 'text-green-600'
                                : attempt.status === 'submitted'
                                ? 'text-yellow-600'
                                : 'text-gray-600'
                            }`}
                          >
                            {attempt.status}
                          </div>
                          <div className="text-xs text-gray-500">
                            {attempt.score_percent !== null
                              ? `${attempt.score_percent.toFixed(1)}%`
                              : 'Pending'}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="text-center text-gray-500 py-8">No attempts yet</div>
              )}
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mt-8 bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link
              href="/admin/users/create"
              className="p-4 border border-gray-200 rounded-lg hover:border-primary-500 hover:bg-primary-50 transition-colors"
            >
              <div className="font-medium mb-1">Create Candidate</div>
              <div className="text-sm text-gray-600">Add a new candidate user</div>
            </Link>
            <div className="p-4 border border-gray-200 rounded-lg opacity-50">
              <div className="font-medium mb-1">Bulk Import (Coming Soon)</div>
              <div className="text-sm text-gray-600">Import candidates from CSV</div>
            </div>
            <div className="p-4 border border-gray-200 rounded-lg opacity-50">
              <div className="font-medium mb-1">Manage Exams (Coming Soon)</div>
              <div className="text-sm text-gray-600">Create and manage exams</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
