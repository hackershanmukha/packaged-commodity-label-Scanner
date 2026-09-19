'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { scanAPI } from '@/lib/api';
import { CheckCircle, XCircle, AlertTriangle, Search, Filter, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '@/hooks/useAuth';

export default function HistoryPage() {
  const { checked, user } = useAuth();
  const router = useRouter();
  const [scans, setScans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (checked && user?.role === 'manufacturer') {
      router.replace('/manufacturer/history');
      return;
    }
    scanAPI.list().then(res => { setScans(res.data); setLoading(false); })
      .catch(() => { toast.error('Failed to load scans'); setLoading(false); });
  }, []);

  const statusIcon: Record<string, any> = {
    compliant: <CheckCircle className="h-5 w-5 text-green-500" />,
    non_compliant: <XCircle className="h-5 w-5 text-red-500" />,
    partially_compliant: <AlertTriangle className="h-5 w-5 text-yellow-500" />,
  };

  const statusBadge: Record<string, string> = {
    compliant: 'badge-compliant',
    non_compliant: 'badge-non-compliant',
    partially_compliant: 'badge-partial',
  };

  const filtered = scans.filter(s => {
    if (filter !== 'all' && s.compliance_status !== filter) return false;
    if (search && !JSON.stringify(s).toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  if (!checked || !user) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600" /></div>;
  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600" /></div>;

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Scan History</h1>

        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            <input type="text" placeholder="Search scans..." value={search} onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none bg-white" />
          </div>
          <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg p-1">
            <Filter className="h-4 w-4 text-gray-400 ml-2" />
            {['all', 'compliant', 'non_compliant', 'partially_compliant'].map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  filter === f ? 'bg-primary-600 text-white' : 'text-gray-600 hover:bg-gray-50'
                }`}>
                {f === 'all' ? 'All' : f.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
              </button>
            ))}
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <p className="text-lg">No scans found</p>
            <Link href="/scan" className="text-primary-600 hover:text-primary-700 text-sm mt-2 inline-block">Start a new scan</Link>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(scan => (
              <Link key={scan.id} href={`/scan/${scan.id}`}
                className="flex items-center gap-4 bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow group">
                {statusIcon[scan.compliance_status]}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-gray-900 text-sm">Scan #{scan.id}</span>
                    <span className={`compliance-badge ${statusBadge[scan.compliance_status]}`}>
                      {scan.compliance_status?.replace('_', ' ')}
                    </span>
                    <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full capitalize">{scan.scan_type?.replace('_', ' ')}</span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <span>Score: {scan.compliance_score}%</span>
                    <span>{scan.passed_checks}/{scan.total_checks} passed</span>
                    <span>{new Date(scan.created_at).toLocaleDateString()}</span>
                    {scan.store_name && <span>{scan.store_name}</span>}
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-gray-300 group-hover:text-primary-500 transition-colors" />
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
