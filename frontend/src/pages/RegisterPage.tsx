import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Shield, AlertCircle, CheckCircle2 } from 'lucide-react';
import api from '../api/client';

const ROLES = [
  { value: 'hospital_admin', label: 'Hospital Admin', description: 'Manage medical resources and ambulances' },
  { value: 'police_admin', label: 'Police Admin', description: 'Manage police dispatch operations' },
  { value: 'fire_admin', label: 'Fire Admin', description: 'Manage fire service operations' },
  { value: 'ambulance_driver', label: 'Ambulance Driver', description: 'Respond to medical emergencies' },
];

export default function RegisterPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'hospital_admin',
    organization_id: '',
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (form.password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    try {
      await api.post('/auth/register', {
        name: form.name,
        email: form.email,
        password: form.password,
        role: form.role,
        organization_id: form.organization_id || null,
      });
      setSuccess(true);
      setTimeout(() => navigate('/login'), 2000);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        {/* Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-brand-600 mb-4">
            <Shield className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-lg font-semibold text-gray-900">Create an Account</h1>
          <p className="text-sm text-gray-500 mt-1">Register to join the operations platform</p>
        </div>

        {success ? (
          <div className="card text-center py-8">
            <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto mb-3" />
            <p className="text-sm font-medium text-gray-900">Account created successfully!</p>
            <p className="text-sm text-gray-500 mt-1">Redirecting to login…</p>
          </div>
        ) : (
          <div className="card">
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="flex items-center gap-2 rounded-md bg-red-50 border border-red-200 px-3 py-2.5">
                  <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              <div>
                <label className="label">Full Name *</label>
                <input
                  value={form.name}
                  onChange={(e) => set('name', e.target.value)}
                  className="input-field"
                  placeholder="Kwame Mensah"
                  required
                />
              </div>

              <div>
                <label className="label">Email Address *</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => set('email', e.target.value)}
                  className="input-field"
                  placeholder="name@example.com"
                  required
                />
              </div>

              <div>
                <label className="label">Role *</label>
                <select
                  value={form.role}
                  onChange={(e) => set('role', e.target.value)}
                  className="input-field"
                >
                  {ROLES.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
                <p className="text-xs text-gray-400 mt-1">
                  {ROLES.find((r) => r.value === form.role)?.description}
                </p>
              </div>

              <div>
                <label className="label">Organization</label>
                <input
                  value={form.organization_id}
                  onChange={(e) => set('organization_id', e.target.value)}
                  className="input-field"
                  placeholder="e.g. korlebu, accra_police, ghana_fire"
                />
              </div>

              <div>
                <label className="label">Password *</label>
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => set('password', e.target.value)}
                  className="input-field"
                  placeholder="Minimum 6 characters"
                  required
                />
              </div>

              <div>
                <label className="label">Confirm Password *</label>
                <input
                  type="password"
                  value={form.confirmPassword}
                  onChange={(e) => set('confirmPassword', e.target.value)}
                  className="input-field"
                  placeholder="Re-enter password"
                  required
                />
              </div>

              <button type="submit" disabled={loading} className="btn-primary w-full">
                {loading ? 'Creating account…' : 'Create Account'}
              </button>
            </form>
          </div>
        )}

        <p className="text-center text-sm text-gray-500 mt-6">
          Already have an account?{' '}
          <Link to="/login" className="text-brand-600 hover:text-brand-700 font-medium">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
