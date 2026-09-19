'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Shield, Mail, Lock, User, Building, Eye, EyeOff } from 'lucide-react';
import { authAPI } from '@/lib/api';
import toast from 'react-hot-toast';
import Link from 'next/link';

export default function LoginPage() {
  const [isRegister, setIsRegister] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ email: '', password: '', username: '', full_name: '', role: 'consumer', organization: '' });
  const router = useRouter();

  // If already logged in, redirect based on role
  useEffect(() => {
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');
    if (token && userData) {
      try {
        const u = JSON.parse(userData);
        router.replace(u?.role === 'manufacturer' ? '/manufacturer' : '/scan');
      } catch {
        router.replace('/scan');
      }
    }
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isRegister) {
        await authAPI.register(form);
        toast.success('Account created! Please login.');
        setIsRegister(false);
      } else {
        const res = await authAPI.login({ email: form.email, password: form.password });
        // Store auth data synchronously before navigating
        localStorage.setItem('token', res.data.access_token);
        localStorage.setItem('user', JSON.stringify(res.data.user));
        toast.success('Welcome back!');
        const userRole = res.data.user?.role;
        router.push(userRole === 'manufacturer' ? '/manufacturer' : '/scan');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Something went wrong');
    }
    setLoading(false);
  };

  const update = (field: string, value: string) => setForm({ ...form, [field]: value });

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 via-white to-blue-50 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-4 text-center justify-center">
            <Shield className="h-10 w-10 text-primary-600 flex-shrink-0" />
            <span className="text-2xl font-bold text-gray-900">Packaged Commodity Label Scanner</span>
          </Link>
          <p className="text-gray-500">Legal Metrology Compliance & Inspection System</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
          <div className="flex mb-6 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setIsRegister(false)}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${!isRegister ? 'bg-white text-primary-700 shadow-sm' : 'text-gray-500'}`}
            >Login</button>
            <button
              onClick={() => setIsRegister(true)}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${isRegister ? 'bg-white text-primary-700 shadow-sm' : 'text-gray-500'}`}
            >Register</button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {isRegister && (
              <>
                <div className="relative">
                  <User className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <input type="text" placeholder="Full Name" required value={form.full_name} onChange={e => update('full_name', e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none" />
                </div>
                <div className="relative">
                  <User className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <input type="text" placeholder="Username" required value={form.username} onChange={e => update('username', e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none" />
                </div>
              </>
            )}
            <div className="relative">
              <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <input type="email" placeholder="Email" required value={form.email} onChange={e => update('email', e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none" />
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <input type={showPassword ? 'text' : 'password'} placeholder="Password" required value={form.password} onChange={e => update('password', e.target.value)}
                className="w-full pl-10 pr-10 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none" />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-3 text-gray-400 hover:text-gray-600">
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {isRegister && (
              <>
                <select value={form.role} onChange={e => update('role', e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none text-gray-700">
                  <option value="consumer">Consumer</option>
                  <option value="inspector">Inspector</option>
                  <option value="manufacturer">Manufacturer</option>
                </select>
                {(form.role === 'inspector' || form.role === 'manufacturer') && (
                  <div className="relative">
                    <Building className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <input type="text" placeholder="Organization" value={form.organization} onChange={e => update('organization', e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none" />
                  </div>
                )}
              </>
            )}
            <button type="submit" disabled={loading}
              className="w-full py-3 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 disabled:opacity-50 transition-colors">
              {loading ? 'Please wait...' : isRegister ? 'Create Account' : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
