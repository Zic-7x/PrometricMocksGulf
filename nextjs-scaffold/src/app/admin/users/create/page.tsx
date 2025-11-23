'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function CreateUserPage() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    email: '',
    full_name: '',
    profession: '',
    medical_field: '',
    health_authority: '',
    payment_status: 'unpaid' as 'paid' | 'unpaid' | 'pending',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session) {
        throw new Error('Not authenticated')
      }

      // Call Edge Function to create user
      const { data, error: functionError } = await supabase.functions.invoke(
        'bulk-create-users',
        {
          body: {
            candidates: [formData],
            send_invites: false,
          },
        }
      )

      if (functionError) throw functionError

      if (data?.results?.failed?.length > 0) {
        throw new Error(data.results.failed[0].error)
      }

      router.push('/admin/users')
    } catch (err: any) {
      setError(err.message || 'Failed to create user')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Create Candidate</h1>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="email" className="block text-sm font-medium mb-2">
            Email *
          </label>
          <input
            type="email"
            id="email"
            required
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>

        <div>
          <label htmlFor="full_name" className="block text-sm font-medium mb-2">
            Full Name *
          </label>
          <input
            type="text"
            id="full_name"
            required
            value={formData.full_name}
            onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>

        <div>
          <label htmlFor="profession" className="block text-sm font-medium mb-2">
            Profession (Code) *
          </label>
          <input
            type="text"
            id="profession"
            required
            value={formData.profession}
            onChange={(e) => setFormData({ ...formData, profession: e.target.value })}
            placeholder="e.g., PHARMACIST"
            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>

        <div>
          <label htmlFor="medical_field" className="block text-sm font-medium mb-2">
            Medical Field (Code) *
          </label>
          <input
            type="text"
            id="medical_field"
            required
            value={formData.medical_field}
            onChange={(e) => setFormData({ ...formData, medical_field: e.target.value })}
            placeholder="e.g., CLINICAL_PHARMACY"
            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>

        <div>
          <label htmlFor="health_authority" className="block text-sm font-medium mb-2">
            Health Authority (Code) *
          </label>
          <input
            type="text"
            id="health_authority"
            required
            value={formData.health_authority}
            onChange={(e) => setFormData({ ...formData, health_authority: e.target.value })}
            placeholder="e.g., DHA"
            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>

        <div>
          <label htmlFor="payment_status" className="block text-sm font-medium mb-2">
            Payment Status *
          </label>
          <select
            id="payment_status"
            value={formData.payment_status}
            onChange={(e) =>
              setFormData({
                ...formData,
                payment_status: e.target.value as 'paid' | 'unpaid' | 'pending',
              })
            }
            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          >
            <option value="unpaid">Unpaid</option>
            <option value="pending">Pending</option>
            <option value="paid">Paid</option>
          </select>
        </div>

        <div className="flex items-center gap-4">
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
          >
            {loading ? 'Creating...' : 'Create Candidate'}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="px-6 py-2 border rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}

