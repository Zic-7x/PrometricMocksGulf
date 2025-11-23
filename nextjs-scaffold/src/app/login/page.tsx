'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isMagicLink, setIsMagicLink] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      if (isMagicLink) {
        // Send magic link
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: {
            emailRedirectTo: `${window.location.origin}/dashboard`,
          },
        })

        if (error) throw error

        alert('Check your email for the magic link!')
      } else {
        // Email/password login
        console.log('Attempting login for:', email)
        const { data: authData, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })

        if (error) {
          console.error('Login error:', error)
          throw error
        }

        if (!authData.user) {
          throw new Error('Login failed: No user data returned')
        }

        console.log('Login successful, user ID:', authData.user.id)

        // Get user profile to determine redirect
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', authData.user.id)
          .single()

        if (profileError) {
          console.error('Profile fetch error:', profileError)
          // Still redirect to dashboard even if profile fetch fails
          router.refresh()
          // Use window.location for more reliable redirect after auth
          setTimeout(() => {
            window.location.href = '/dashboard'
          }, 100)
          return
        }

        console.log('Profile fetched, role:', profile?.role)

        // Simple redirect based on role
        const redirectPath = profile?.role === 'admin' ? '/admin' : '/dashboard'
        router.push(redirectPath)
      }
    } catch (err: any) {
      console.error('Login error:', err)
      setError(err.message || 'Failed to login. Please check your credentials and try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
        <h1 className="text-3xl font-bold text-center mb-8">Login</h1>

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="email" className="block text-sm font-medium mb-2">
              Email
            </label>
            <input
              type="email"
              id="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="your@email.com"
            />
          </div>

          {!isMagicLink && (
            <div>
              <label htmlFor="password" className="block text-sm font-medium mb-2">
                Password
              </label>
              <input
                type="password"
                id="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="Enter your password"
              />
            </div>
          )}

          <div className="flex items-center">
            <input
              type="checkbox"
              id="magic-link"
              checked={isMagicLink}
              onChange={(e) => setIsMagicLink(e.target.checked)}
              className="mr-2"
            />
            <label htmlFor="magic-link" className="text-sm text-gray-600">
              Use magic link instead
            </label>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
          >
            {loading
              ? 'Loading...'
              : isMagicLink
              ? 'Send Magic Link'
              : 'Login'}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-gray-600">
          <p>No account? Contact your administrator.</p>
          <p className="mt-2">Admin creates all accounts.</p>
        </div>
      </div>
    </div>
  )
}

