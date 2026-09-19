'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { dashboardAPI } from '@/lib/api';
import { BarChart3, TrendingUp, AlertTriangle, CheckCircle, XCircle, MapPin } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import toast from 'react-hot-toast';
import { useAuth } from '@/hooks/useAuth';

export default function DashboardPage() {
  const { checked, user } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (checked && user?.role === 'manufacturer') {
      router.replace('/manufacturer');
      return;
    }
    dashboardAPI.stats().then(res => { setStats(res.data); setLoading(false); })
      .catch(() => { toast.error('Failed to load dashboard'); setLoading(false); });
  }, []);

  const COLORS = ['#22c55e', '#ef4444', '#f59e0b'];
  const SEVERITY_COLORS = ['#dc2626', '#f97316', '#eab308'];

  if (!checked || !user) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600" /></div>;
  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600" /></div>;
  if (!stats) return <div className="min-h-screen flex items-center justify-center text-gray-500">No data available</div>;

  const compliancePie = [
    { name: 'Compliant', value: stats.compliant_count || 0 },
    { name: 'Non-Compliant', value: stats.non_compliant_count || 0 },
    { name: 'Partial', value: stats.partial_count || 0 },
  ].filter(d => d.value > 0);

  const severityData = stats.severity_breakdown ? Object.entries(stats.severity_breakdown).map(([k, v]) => ({ name: k, count: v })) : [];
  const scanTypeData = stats.scans_by_type ? Object.entries(stats.scans_by_type).map(([k, v]) => ({ name: k.replace('_', ' '), count: v })) : [];

  const statCards = [
    { label: 'Total Scans', value: stats.total_scans || 0, icon: BarChart3, color: 'text-primary-600', bg: 'bg-primary-50' },
    { label: 'Compliant', value: stats.compliant_count || 0, icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50' },
    { label: 'Non-Compliant', value: stats.non_compliant_count || 0, icon: XCircle, color: 'text-red-600', bg: 'bg-red-50' },
    { label: 'Violations', value: stats.top_violations?.length || 0, icon: AlertTriangle, color: 'text-yellow-600', bg: 'bg-yellow-50' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Enforcement Dashboard</h1>
            <p className="text-gray-500 text-sm mt-1">Real-time compliance analytics across all scans</p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {statCards.map(s => (
            <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-5">
              <div className={`w-10 h-10 ${s.bg} rounded-lg flex items-center justify-center mb-3`}>
                <s.icon className={`h-5 w-5 ${s.color}`} />
              </div>
              <p className="text-2xl font-bold text-gray-900">{s.value}</p>
              <p className="text-sm text-gray-500">{s.label}</p>
            </div>
          ))}
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-900 mb-4">Compliance Distribution</h3>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={compliancePie} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                  {compliancePie.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-900 mb-4">Scans by Type</h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={scanTypeData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-900 mb-4">Severity Breakdown</h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={severityData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 12 }} width={80} />
                <Tooltip />
                <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                  {severityData.map((_, i) => <Cell key={i} fill={SEVERITY_COLORS[i % SEVERITY_COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-900 mb-4">Top Violations</h3>
            <div className="space-y-3">
              {(stats.top_violations || []).slice(0, 5).map((v: any, i: number) => (
                <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900">{v.rule_name || v[0]}</span>
                  </div>
                  <span className="text-sm font-semibold text-red-600">{v.count || v[1]}x</span>
                </div>
              ))}
              {(!stats.top_violations || stats.top_violations.length === 0) && (
                <p className="text-sm text-gray-500 text-center py-4">No violations recorded</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
