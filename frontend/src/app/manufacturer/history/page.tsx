'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Factory, 
  History, 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  Search, 
  Filter, 
  ChevronDown, 
  ChevronUp, 
  Plus, 
  Layers, 
  Calendar,
  CheckCircle2
} from 'lucide-react';
import { manufacturerAPI } from '@/lib/api';
import toast from 'react-hot-toast';
import { useAuth } from '@/hooks/useAuth';

export default function ManufacturerHistoryPage() {
  const { checked, user } = useAuth();
  const [labels, setLabels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [expandedIds, setExpandedIds] = useState<Record<number, boolean>>({});

  useEffect(() => {
    manufacturerAPI.listLabels()
      .then((res) => {
        setLabels(res.data || []);
        setLoading(false);
      })
      .catch(() => {
        toast.error('Failed to load label check history');
        setLoading(false);
      });
  }, []);

  const toggleExpand = (id: number) => {
    setExpandedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const statusConfig: Record<string, { icon: any; color: string; bg: string; badge: string; label: string }> = {
    compliant: { 
      icon: CheckCircle, 
      color: 'text-green-600', 
      bg: 'bg-green-50 border-green-200', 
      badge: 'bg-green-100 text-green-800 border-green-200',
      label: 'Compliant' 
    },
    non_compliant: { 
      icon: XCircle, 
      color: 'text-red-600', 
      bg: 'bg-red-50 border-red-200', 
      badge: 'bg-red-100 text-red-800 border-red-200',
      label: 'Non-Compliant' 
    },
    partially_compliant: { 
      icon: AlertTriangle, 
      color: 'text-yellow-600', 
      bg: 'bg-yellow-50 border-yellow-200', 
      badge: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      label: 'Partially Compliant' 
    },
  };

  const filtered = labels.filter((item) => {
    if (filter !== 'all' && item.compliance_status !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      const nameMatch = (item.product_name || '').toLowerCase().includes(q);
      const statusMatch = (item.compliance_status || '').toLowerCase().includes(q);
      if (!nameMatch && !statusMatch) return false;
    }
    return true;
  });

  const totalCount = labels.length;
  const compliantCount = labels.filter((l) => l.compliance_status === 'compliant').length;
  const partialCount = labels.filter((l) => l.compliance_status === 'partially_compliant').length;
  const nonCompliantCount = labels.filter((l) => l.compliance_status === 'non_compliant').length;

  const getCleanImageUrl = (path: string) => {
    if (!path) return '';
    if (path.startsWith('http://') || path.startsWith('https://')) return path;
    const clean = path.replace(/\\/g, '/');
    const filename = clean.split('/').pop();
    return `/uploads/${filename}`;
  };

  if (!checked || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header with Navigation */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary-50 rounded-lg flex items-center justify-center">
              <History className="h-5 w-5 text-primary-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Pre-Print Label History</h1>
              <p className="text-sm text-gray-500">Track and review all packaging label compliance checks</p>
            </div>
          </div>
          <Link
            href="/manufacturer"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors shadow-sm self-start sm:self-auto"
          >
            <Plus className="h-4 w-4" />
            New Label Check
          </Link>
        </div>

        {/* Stats Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
            <span className="text-xs text-gray-500 font-medium block">Total Checks</span>
            <span className="text-2xl font-bold text-gray-900 mt-1 block">{totalCount}</span>
          </div>
          <div className="bg-white rounded-xl border border-green-200 p-4 shadow-sm bg-green-50/20">
            <span className="text-xs text-green-700 font-medium block">Compliant</span>
            <span className="text-2xl font-bold text-green-600 mt-1 block">{compliantCount}</span>
          </div>
          <div className="bg-white rounded-xl border border-yellow-200 p-4 shadow-sm bg-yellow-50/20">
            <span className="text-xs text-yellow-700 font-medium block">Partial</span>
            <span className="text-2xl font-bold text-yellow-600 mt-1 block">{partialCount}</span>
          </div>
          <div className="bg-white rounded-xl border border-red-200 p-4 shadow-sm bg-red-50/20">
            <span className="text-xs text-red-700 font-medium block">Non-Compliant</span>
            <span className="text-2xl font-bold text-red-600 mt-1 block">{nonCompliantCount}</span>
          </div>
        </div>

        {/* Search & Filter Controls */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by product name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none bg-white"
            />
          </div>
          <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg p-1 overflow-x-auto">
            <Filter className="h-4 w-4 text-gray-400 ml-2 shrink-0" />
            {['all', 'compliant', 'partially_compliant', 'non_compliant'].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
                  filter === f ? 'bg-primary-600 text-white' : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                {f === 'all'
                  ? 'All'
                  : f.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
              </button>
            ))}
          </div>
        </div>

        {/* Loading Spinner */}
        {loading ? (
          <div className="text-center py-16">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600 mx-auto" />
            <p className="text-gray-500 text-sm mt-3">Loading label history...</p>
          </div>
        ) : filtered.length === 0 ? (
          /* Empty State */
          <div className="text-center py-16 bg-white rounded-xl border border-gray-200 p-8 shadow-sm">
            <Factory className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-900 font-semibold text-lg">No label checks found</p>
            <p className="text-gray-500 text-sm mt-1">
              {search || filter !== 'all'
                ? 'Try adjusting your search query or filter.'
                : 'You have not checked any packaging labels yet.'}
            </p>
            <Link
              href="/manufacturer"
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors mt-4"
            >
              <Plus className="h-4 w-4" />
              Check Your First Label
            </Link>
          </div>
        ) : (
          /* List of Labels */
          <div className="space-y-4">
            {filtered.map((item) => {
              const comp = item.compliance_result?.compliance || item.compliance_result || {};
              const extracted = item.compliance_result?.extracted_fields || {};
              const allImages: string[] = item.compliance_result?.images || (item.label_image_path ? [item.label_image_path] : []);
              const panelCount = item.compliance_result?.panel_count || allImages.length || 1;
              const status = statusConfig[item.compliance_status] || statusConfig.non_compliant;
              const StatusIcon = status.icon;
              const isExpanded = !!expandedIds[item.id];
              const score = comp.compliance_score ?? comp.score ?? 0;
              const passedChecks = comp.passed_checks ?? 0;
              const totalChecks = comp.total_checks ?? 0;
              const violations = comp.violations || [];
              const passedRules = comp.passed_rules || [];

              return (
                <div
                  key={item.id}
                  className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow"
                >
                  {/* Card Header & Summary */}
                  <div
                    onClick={() => toggleExpand(item.id)}
                    className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer select-none"
                  >
                    <div className="flex items-start sm:items-center gap-4 min-w-0">
                      {/* Primary Thumbnail */}
                      <div className="w-16 h-16 rounded-lg bg-gray-100 border border-gray-200 overflow-hidden shrink-0 flex items-center justify-center">
                        {item.label_image_path ? (
                          <img
                            src={getCleanImageUrl(item.label_image_path)}
                            alt={item.product_name}
                            className="w-full h-full object-contain"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          <Layers className="h-6 w-6 text-gray-400" />
                        )}
                      </div>

                      {/* Info */}
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <h3 className="text-base font-bold text-gray-900 truncate">
                            {item.product_name || `Label Check #${item.id}`}
                          </h3>
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${status.badge}`}>
                            <StatusIcon className="h-3 w-3" />
                            {status.label}
                          </span>
                          <span className="text-[11px] px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full font-medium">
                            {panelCount} panel{panelCount > 1 ? 's' : ''}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-y-1 gap-x-3 text-xs text-gray-500">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {new Date(item.submitted_at).toLocaleDateString('en-IN', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                          <span>•</span>
                          <span>
                            Score: <strong className="text-gray-800">{score}%</strong> ({passedChecks}/{totalChecks} checks)
                          </span>
                          {violations.length > 0 && (
                            <>
                              <span>•</span>
                              <span className="text-red-600 font-medium">
                                {violations.length} issue{violations.length > 1 ? 's' : ''} found
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Toggle expand button */}
                    <div className="flex items-center gap-2 self-end sm:self-auto text-primary-600 hover:text-primary-700 text-xs font-semibold shrink-0">
                      <span>{isExpanded ? 'Hide Details' : 'View Full Report'}</span>
                      {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </div>
                  </div>

                  {/* Expanded Report Details */}
                  {isExpanded && (
                    <div className="border-t border-gray-100 p-5 bg-gray-50/50 space-y-4">
                      {/* Attached Panels Gallery */}
                      {allImages.length > 0 && (
                        <div>
                          <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">
                            Checked Packaging Panels ({allImages.length})
                          </h4>
                          <div className="flex flex-wrap gap-2">
                            {allImages.map((imgPath, idx) => (
                              <div
                                key={idx}
                                className="w-20 h-20 rounded-lg border border-gray-200 overflow-hidden bg-white p-1"
                              >
                                <img
                                  src={getCleanImageUrl(imgPath)}
                                  alt={`Panel ${idx + 1}`}
                                  className="w-full h-full object-contain"
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Extracted Declarations Grid */}
                      <div>
                        <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                          <Layers className="h-3.5 w-3.5 text-primary-600" />
                          Extracted Declarations
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 text-xs">
                          <div className="p-2.5 bg-white rounded-lg border border-gray-200">
                            <span className="text-gray-400 block text-[11px]">Commodity Name</span>
                            <strong className="text-gray-800">{extracted.common_name || 'Not detected'}</strong>
                          </div>
                          <div className="p-2.5 bg-white rounded-lg border border-gray-200">
                            <span className="text-gray-400 block text-[11px]">Net Quantity</span>
                            <strong className="text-gray-800">
                              {extracted.net_quantity ? `${extracted.net_quantity.value} ${extracted.net_quantity.unit}` : 'Not detected'}
                            </strong>
                          </div>
                          <div className="p-2.5 bg-white rounded-lg border border-gray-200">
                            <span className="text-gray-400 block text-[11px]">MRP</span>
                            <strong className="text-gray-800">
                              {extracted.mrp ? `Rs. ${extracted.mrp.value}` : 'Not detected'}
                            </strong>
                            {extracted.mrp?.has_tax_note && (
                              <span className="text-[10px] text-green-600 ml-1 font-medium">(Incl. taxes)</span>
                            )}
                          </div>
                          <div className="p-2.5 bg-white rounded-lg border border-gray-200">
                            <span className="text-gray-400 block text-[11px]">Dates</span>
                            <strong className="text-gray-800">
                              {extracted.dates?.manufacture_date?.value
                                ? `Mfg: ${extracted.dates.manufacture_date.value}`
                                : extracted.dates?.expiry_date?.value
                                ? `Exp: ${extracted.dates.expiry_date.value}`
                                : 'Not detected'}
                            </strong>
                          </div>
                          <div className="p-2.5 bg-white rounded-lg border border-gray-200">
                            <span className="text-gray-400 block text-[11px]">Origin</span>
                            <strong className="text-gray-800">{extracted.country_of_origin || 'Not detected'}</strong>
                          </div>
                          <div className="p-2.5 bg-white rounded-lg border border-gray-200">
                            <span className="text-gray-400 block text-[11px]">Consumer Care</span>
                            <strong className="text-gray-800">
                              {extracted.consumer_care?.phone || extracted.consumer_care?.email || 'Not detected'}
                            </strong>
                          </div>
                        </div>
                      </div>

                      {/* Violations / Issues */}
                      {violations.length > 0 && (
                        <div>
                          <h4 className="text-xs font-semibold text-red-600 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                            <AlertTriangle className="h-3.5 w-3.5" />
                            Issues to Rectify Before Printing ({violations.length})
                          </h4>
                          <div className="space-y-1.5">
                            {violations.map((v: any, i: number) => (
                              <div
                                key={i}
                                className="flex items-start gap-2 p-2.5 bg-red-50/70 border border-red-100 rounded-lg text-xs"
                              >
                                <XCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                                <div>
                                  <p className="font-semibold text-gray-900">{v.rule_name || v.name}</p>
                                  <p className="text-gray-600 mt-0.5">{v.description}</p>
                                  <p className="text-[10px] text-gray-400 mt-0.5">Section: {v.section_reference || v.section}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Passed Checks */}
                      {passedRules.length > 0 && (
                        <div>
                          <h4 className="text-xs font-semibold text-green-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Passed Checks ({passedRules.length})
                          </h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                            {passedRules.map((r: any, i: number) => (
                              <div
                                key={i}
                                className="flex items-center gap-2 text-xs font-medium text-green-800 bg-green-50/60 border border-green-100 px-2.5 py-1.5 rounded-md"
                              >
                                <CheckCircle className="h-3.5 w-3.5 text-green-600 shrink-0" />
                                <span>{typeof r === 'string' ? r : r.rule_name || r.name}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
