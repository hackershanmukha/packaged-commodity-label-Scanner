'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { scanAPI } from '@/lib/api';
import { 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  Download, 
  ArrowLeft, 
  FileText, 
  Shield, 
  Layers,
  QrCode,
  Ruler,
  UserCheck,
  Edit3,
  Check,
  Award,
  AlertCircle
} from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { useAuth } from '@/hooks/useAuth';

export default function ScanResultPage() {
  const { checked, user } = useAuth();
  const { id } = useParams();
  const [scan, setScan] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);

  // Inspector Workbench State
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [submittingReview, setSubmittingReview] = useState(false);
  const [correctedFields, setCorrectedFields] = useState<Record<string, any>>({});
  const [resolvedViolations, setResolvedViolations] = useState<Record<number, { status: string; inspector_remark: string }>>({});
  const [inspectorAction, setInspectorAction] = useState('APPROVED_COMPLIANT');
  const [inspectorNotes, setInspectorNotes] = useState('');
  const [caliperMm, setCaliperMm] = useState('2.5');
  const [caliperStatus, setCaliperStatus] = useState('COMPLIANT');
  const [caliperNotes, setCaliperNotes] = useState('Measured with digital vernier caliper on primary panel.');

  useEffect(() => {
    if (id && !isNaN(Number(id))) {
      fetchScan();
    }
  }, [id]);

  const fetchScan = () => {
    scanAPI.get(Number(id))
      .then(res => {
        setScan(res.data);
        setLoading(false);
        initReviewState(res.data);
      })
      .catch(() => {
        toast.error('Scan not found');
        setLoading(false);
      });
  };

  const initReviewState = (scanData: any) => {
    // Populate form initial fields
    const fields = scanData.extracted_fields || {};
    const flatFields: Record<string, string> = {};
    
    flatFields['common_name'] = fields.common_name || '';
    flatFields['mrp'] = typeof fields.mrp === 'object' ? (fields.mrp?.value !== undefined ? String(fields.mrp.value) : fields.mrp?.raw || '') : String(fields.mrp || '');
    flatFields['net_quantity'] = typeof fields.net_quantity === 'object' ? `${fields.net_quantity?.value ?? ''} ${fields.net_quantity?.unit ?? ''}`.trim() : String(fields.net_quantity || '');
    flatFields['manufacturer'] = typeof fields.manufacturer === 'object' ? fields.manufacturer?.value || fields.manufacturer?.raw || '' : String(fields.manufacturer || '');
    flatFields['dates'] = typeof fields.dates === 'object' ? (fields.dates?.manufacture_date?.value || fields.dates?.manufacture_date || fields.dates?.raw || '') : String(fields.dates || '');
    flatFields['consumer_care'] = typeof fields.consumer_care === 'object' ? (fields.consumer_care?.phone || fields.consumer_care?.email || fields.consumer_care?.details || '') : String(fields.consumer_care || '');
    flatFields['country_of_origin'] = fields.country_of_origin || '';
    flatFields['batch_number'] = fields.batch_number || '';
    flatFields['fssai_license'] = fields.fssai_license || '';

    setCorrectedFields(flatFields);

    // Populate violation resolution map
    const vMap: Record<number, { status: string; inspector_remark: string }> = {};
    if (scanData.violations) {
      scanData.violations.forEach((v: any) => {
        vMap[v.id] = {
          status: v.status || 'OPEN',
          inspector_remark: v.inspector_remark || '',
        };
      });
    }
    setResolvedViolations(vMap);

    if (scanData.inspector_action) setInspectorAction(scanData.inspector_action);
    if (scanData.inspector_notes) setInspectorNotes(scanData.inspector_notes);
    if (scanData.font_size_review) {
      setCaliperMm(String(scanData.font_size_review.measured_height_mm || '2.5'));
      setCaliperStatus(scanData.font_size_review.status || 'COMPLIANT');
      setCaliperNotes(scanData.font_size_review.notes || '');
    }
  };

  const downloadReport = async () => {
    try {
      const res = await scanAPI.report(Number(id));
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `janch-official-report-${id}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success('Inspection report downloaded');
    } catch {
      toast.error('Report not available');
    }
  };

  const handleViolationResolutionChange = (vId: number, newStatus: string) => {
    setResolvedViolations(prev => ({
      ...prev,
      [vId]: {
        ...prev[vId],
        status: newStatus,
        inspector_remark: prev[vId]?.inspector_remark || (
          newStatus === 'RESOLVED_COMPLIANT' ? 'Verified and resolved upon manual physical examination.' :
          newStatus === 'WAIVED' ? 'Minor variance waived under Rule 33 discretionary provisions.' :
          newStatus === 'VERIFIED_VIOLATION' ? 'Confirmed statutory non-compliance by authorized inspector.' : ''
        )
      }
    }));
  };

  const handleViolationRemarkChange = (vId: number, remark: string) => {
    setResolvedViolations(prev => ({
      ...prev,
      [vId]: {
        ...prev[vId],
        inspector_remark: remark
      }
    }));
  };

  const handleFieldChange = (field: string, val: string) => {
    setCorrectedFields(prev => ({ ...prev, [field]: val }));
  };

  const submitInspectorReview = async () => {
    setSubmittingReview(true);
    try {
      // Reformat corrected fields
      const formattedCorrected: Record<string, any> = { ...correctedFields };
      if (correctedFields['mrp']) {
        const numVal = parseFloat(correctedFields['mrp'].replace(/[^0-9.]/g, ''));
        if (!isNaN(numVal)) {
          formattedCorrected['mrp'] = { value: numVal, raw: `Rs. ${numVal.toFixed(2)}`, has_tax_note: true };
        }
      }
      if (correctedFields['net_quantity']) {
        const parts = correctedFields['net_quantity'].trim().split(/\s+/);
        const numVal = parseFloat(parts[0]);
        const unitVal = parts[1] || 'g';
        if (!isNaN(numVal)) {
          formattedCorrected['net_quantity'] = { value: numVal, unit: unitVal, raw: correctedFields['net_quantity'] };
        }
      }
      if (correctedFields['manufacturer']) {
        formattedCorrected['manufacturer'] = { value: correctedFields['manufacturer'], has_pincode: /\b\d{6}\b/.test(correctedFields['manufacturer']) };
      }
      if (correctedFields['dates']) {
        formattedCorrected['dates'] = { manufacture_date: { value: correctedFields['dates'], raw: correctedFields['dates'] } };
      }
      if (correctedFields['consumer_care']) {
        formattedCorrected['consumer_care'] = { details: correctedFields['consumer_care'], phone: correctedFields['consumer_care'] };
      }

      const resolutionList = Object.entries(resolvedViolations).map(([vId, data]) => ({
        id: Number(vId),
        status: data.status,
        inspector_remark: data.inspector_remark,
      }));

      const payload = {
        corrected_fields: formattedCorrected,
        resolved_violations: resolutionList,
        font_size_verification: {
          measured_height_mm: parseFloat(caliperMm) || 2.5,
          status: caliperStatus,
          notes: caliperNotes,
        },
        inspector_action: inspectorAction,
        inspector_notes: inspectorNotes,
        finalize_report: true,
      };

      const res = await scanAPI.review(Number(id), payload);
      setScan(res.data);
      setIsReviewOpen(false);
      toast.success('Inspection report verified and finalized with official endorsement!');
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to submit inspector review');
    } finally {
      setSubmittingReview(false);
    }
  };

  const statusConfig: Record<string, { icon: any; color: string; bg: string; label: string; badgeBg: string }> = {
    compliant: { icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50 border-green-200', label: 'Compliant', badgeBg: 'bg-green-100 text-green-800' },
    non_compliant: { icon: XCircle, color: 'text-red-600', bg: 'bg-red-50 border-red-200', label: 'Non-Compliant', badgeBg: 'bg-red-100 text-red-800' },
    partially_compliant: { icon: AlertTriangle, color: 'text-yellow-600', bg: 'bg-yellow-50 border-yellow-200', label: 'Partially Compliant', badgeBg: 'bg-yellow-100 text-yellow-800' },
    review_required: { icon: AlertCircle, color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200', label: 'Review Required (Uncalibrated Image)', badgeBg: 'bg-amber-100 text-amber-800' },
  };

  const severityColor: Record<string, string> = { critical: 'bg-red-100 text-red-800', major: 'bg-orange-100 text-orange-800', minor: 'bg-yellow-100 text-yellow-800', info: 'bg-blue-100 text-blue-800' };

  if (!checked || !user) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600" /></div>;
  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600" /></div>;
  if (!scan) return <div className="min-h-screen flex items-center justify-center text-gray-500">Scan not found</div>;

  const status = statusConfig[scan.compliance_status] || statusConfig.non_compliant;
  const StatusIcon = status.icon;

  const backendBase = process.env.NEXT_PUBLIC_API_URL 
    ? process.env.NEXT_PUBLIC_API_URL.replace(/\/api\/?$/, '') 
    : 'http://127.0.0.1:8000';

  const getImageUrl = (rawPath: string) => {
    if (!rawPath) return '';
    if (rawPath.startsWith('http://') || rawPath.startsWith('https://')) return rawPath;
    const cleanPath = rawPath.replace(/^[/\\]+/, '').replace(/\\/g, '/');
    return `${backendBase}/${cleanPath}`;
  };

  const imageList: Array<{ label: string; path: string }> = [];
  if (Array.isArray(scan.image_paths) && scan.image_paths.length > 0) {
    scan.image_paths.forEach((img: any, idx: number) => {
      imageList.push({
        label: img.label || `Angle ${idx + 1}`,
        path: img.path || img.url || '',
      });
    });
  } else if (scan.image_path) {
    imageList.push({
      label: 'Primary Panel',
      path: scan.image_path,
    });
  }

  const activeImage = imageList[selectedImageIndex] || imageList[0];

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6">
      <div className="max-w-4xl mx-auto">
        {/* Top Navigation & Action Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <Link href="/history" className="flex items-center gap-1.5 text-gray-500 hover:text-gray-800 text-sm font-medium transition-colors">
            <ArrowLeft className="h-4 w-4" /> Back to History
          </Link>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsReviewOpen(!isReviewOpen)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-semibold transition-all shadow-sm ${
                isReviewOpen
                  ? 'bg-amber-600 text-white hover:bg-amber-700'
                  : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              <UserCheck className="h-4 w-4 text-primary-600" />
              {isReviewOpen ? 'Close Review Workbench' : (scan.is_reviewed ? 'Edit Inspector Review' : 'Authorized Inspector Review')}
            </button>
            <button
              onClick={downloadReport}
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-semibold hover:bg-primary-700 transition-colors shadow-sm"
            >
              <Download className="h-4 w-4" /> Download Official PDF
            </button>
          </div>
        </div>

        {/* Main Status Hero */}
        <div className={`rounded-xl border p-6 mb-6 shadow-sm ${status.bg}`}>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <StatusIcon className={`h-12 w-12 shrink-0 ${status.color}`} />
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-2xl font-bold text-gray-900">{status.label}</h2>
                  {scan.is_reviewed && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800">
                      <Award className="h-3 w-3" /> Inspector Signed
                    </span>
                  )}
                </div>
                <p className="text-gray-600 text-sm mt-0.5">
                  Compliance Score: <span className="font-bold text-gray-900">{scan.compliance_score}%</span> &bull; {scan.passed_checks}/{scan.total_checks} checks passed
                </p>
              </div>
            </div>
            <div className="text-left sm:text-right">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Scan ID</span>
              <p className="font-mono text-sm font-bold text-gray-900">#{scan.id}</p>
            </div>
          </div>
        </div>

        {/* Official Inspector Review Endorsement Box */}
        {scan.is_reviewed && (
          <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-blue-950 text-white rounded-xl p-5 mb-6 shadow-md border border-blue-800">
            <div className="flex items-center justify-between pb-3 border-b border-blue-800/80 mb-3">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-full bg-blue-500/20 border border-blue-400/40 flex items-center justify-center text-blue-300">
                  <Award className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="font-bold text-base leading-tight">Official Inspector Verification & Endorsement</h3>
                  <p className="text-xs text-blue-200">Legal Metrology Enforcement Division</p>
                </div>
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-extrabold tracking-wider uppercase bg-emerald-500/20 border border-emerald-400/40 text-emerald-300">
                {scan.inspector_action?.replace(/_/g, ' ') || 'APPROVED COMPLIANT'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs mb-3">
              <div className="bg-white/5 rounded-lg p-2.5 border border-white/10">
                <span className="text-blue-300 block font-medium">Authorized Inspector</span>
                <span className="font-semibold text-sm text-white mt-0.5 block">{scan.inspector_name || 'Legal Metrology Officer'}</span>
              </div>
              <div className="bg-white/5 rounded-lg p-2.5 border border-white/10">
                <span className="text-blue-300 block font-medium">Verification Timestamp</span>
                <span className="font-semibold text-white mt-0.5 block">{scan.reviewed_at ? new Date(scan.reviewed_at).toLocaleString() : 'Recent'}</span>
              </div>
              <div className="bg-white/5 rounded-lg p-2.5 border border-white/10">
                <span className="text-blue-300 block font-medium">Physical Caliper Reading</span>
                <span className="font-semibold text-emerald-300 mt-0.5 block">
                  {scan.font_size_review?.measured_height_mm ? `${scan.font_size_review.measured_height_mm} mm (${scan.font_size_review.status})` : 'Caliper Verified'}
                </span>
              </div>
            </div>

            {scan.inspector_notes && (
              <div className="bg-white/5 rounded-lg p-3 border border-white/10 text-xs">
                <span className="text-blue-300 font-semibold block mb-0.5">Inspector Observations & Remarks:</span>
                <p className="text-blue-100 leading-relaxed">{scan.inspector_notes}</p>
              </div>
            )}
          </div>
        )}

        {/* Inspector Review Interactive Workbench Panel */}
        {isReviewOpen && (
          <div className="bg-white rounded-xl border-2 border-primary-500 shadow-xl p-6 mb-6">
            <div className="flex items-center justify-between pb-4 border-b border-gray-200 mb-5">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-lg bg-primary-50 text-primary-700 flex items-center justify-center font-bold">
                  <UserCheck className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-lg">Inspector Verification & Correction Workbench</h3>
                  <p className="text-xs text-gray-500">Manually verify AI findings, correct declarations, resolve uncertainties & sign report</p>
                </div>
              </div>
              <span className="text-xs px-2.5 py-1 bg-amber-100 text-amber-800 rounded font-bold uppercase">
                Active Edit Mode
              </span>
            </div>

            {/* Section 1: Extracted Declarations Correction */}
            <div className="mb-6">
              <h4 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                <Edit3 className="h-4 w-4 text-primary-600" /> 1. Manual OCR & Label Declarations Correction
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Product Name</label>
                  <input
                    type="text"
                    value={correctedFields['common_name'] || ''}
                    onChange={(e) => handleFieldChange('common_name', e.target.value)}
                    className="w-full text-xs p-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary-500 outline-none"
                    placeholder="e.g. Basmati Rice"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Maximum Retail Price (MRP)</label>
                  <input
                    type="text"
                    value={correctedFields['mrp'] || ''}
                    onChange={(e) => handleFieldChange('mrp', e.target.value)}
                    className="w-full text-xs p-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary-500 outline-none"
                    placeholder="e.g. 185.00"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Net Quantity</label>
                  <input
                    type="text"
                    value={correctedFields['net_quantity'] || ''}
                    onChange={(e) => handleFieldChange('net_quantity', e.target.value)}
                    className="w-full text-xs p-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary-500 outline-none"
                    placeholder="e.g. 1 kg or 500 g"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Date of Mfg / Packing</label>
                  <input
                    type="text"
                    value={correctedFields['dates'] || ''}
                    onChange={(e) => handleFieldChange('dates', e.target.value)}
                    className="w-full text-xs p-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary-500 outline-none"
                    placeholder="e.g. 05/2026"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Manufacturer Name & Address</label>
                  <input
                    type="text"
                    value={correctedFields['manufacturer'] || ''}
                    onChange={(e) => handleFieldChange('manufacturer', e.target.value)}
                    className="w-full text-xs p-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary-500 outline-none"
                    placeholder="e.g. Golden Harvest Foods, New Delhi - 110001"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Consumer Care Details</label>
                  <input
                    type="text"
                    value={correctedFields['consumer_care'] || ''}
                    onChange={(e) => handleFieldChange('consumer_care', e.target.value)}
                    className="w-full text-xs p-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary-500 outline-none"
                    placeholder="e.g. care@brand.com / 1800-111-222"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Country of Origin</label>
                  <input
                    type="text"
                    value={correctedFields['country_of_origin'] || ''}
                    onChange={(e) => handleFieldChange('country_of_origin', e.target.value)}
                    className="w-full text-xs p-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary-500 outline-none"
                    placeholder="e.g. India"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Batch / Lot Number</label>
                  <input
                    type="text"
                    value={correctedFields['batch_number'] || ''}
                    onChange={(e) => handleFieldChange('batch_number', e.target.value)}
                    className="w-full text-xs p-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary-500 outline-none"
                    placeholder="e.g. B2409"
                  />
                </div>
              </div>
            </div>

            {/* Section 2: Physical Font Size Caliper Verification */}
            <div className="mb-6 p-4 bg-gray-50 rounded-xl border border-gray-200">
              <h4 className="text-sm font-bold text-gray-900 mb-2 flex items-center gap-2">
                <Ruler className="h-4 w-4 text-primary-600" /> 2. Rule 7 Font Size Physical Caliper Verification
              </h4>
              <p className="text-xs text-gray-500 mb-3">
                Resolve the automated &quot;Review Required&quot; status by entering certified physical caliper or optical scale measurements.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Measured Font Height (mm)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.5"
                    max="20"
                    value={caliperMm}
                    onChange={(e) => setCaliperMm(e.target.value)}
                    className="w-full text-xs p-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary-500 outline-none font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Statutory Determination</label>
                  <select
                    value={caliperStatus}
                    onChange={(e) => setCaliperStatus(e.target.value)}
                    className="w-full text-xs p-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary-500 outline-none font-semibold"
                  >
                    <option value="COMPLIANT">Compliant (&ge; Statutory Min)</option>
                    <option value="NON_COMPLIANT">Non-Compliant (Below Statutory Min)</option>
                    <option value="WAIVED">Waived with Remark</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Caliper / Optical Tool Note</label>
                  <input
                    type="text"
                    value={caliperNotes}
                    onChange={(e) => setCaliperNotes(e.target.value)}
                    className="w-full text-xs p-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary-500 outline-none"
                    placeholder="e.g. Measured with calibrated digital caliper"
                  />
                </div>
              </div>
            </div>

            {/* Section 3: Compliance Finding Resolution Matrix */}
            {scan.violations && scan.violations.length > 0 && (
              <div className="mb-6">
                <h4 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                  <Shield className="h-4 w-4 text-primary-600" /> 3. Finding Resolution & Inspector Disposition Matrix ({scan.violations.length})
                </h4>
                <div className="space-y-3">
                  {scan.violations.map((v: any) => {
                    const currentRes = resolvedViolations[v.id] || { status: v.status || 'OPEN', inspector_remark: '' };
                    return (
                      <div key={v.id} className="p-3.5 bg-gray-50 rounded-lg border border-gray-200">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                          <div>
                            <span className="font-bold text-xs text-gray-900">{v.rule_name}</span>
                            <span className="text-xs text-gray-400 ml-2">({v.section_reference})</span>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleViolationResolutionChange(v.id, 'RESOLVED_COMPLIANT')}
                              className={`px-2.5 py-1 rounded text-xs font-bold transition-colors ${
                                currentRes.status === 'RESOLVED_COMPLIANT'
                                  ? 'bg-green-600 text-white shadow-sm'
                                  : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-100'
                              }`}
                            >
                              Resolve Compliant
                            </button>
                            <button
                              type="button"
                              onClick={() => handleViolationResolutionChange(v.id, 'VERIFIED_VIOLATION')}
                              className={`px-2.5 py-1 rounded text-xs font-bold transition-colors ${
                                currentRes.status === 'VERIFIED_VIOLATION' || currentRes.status === 'OPEN'
                                  ? 'bg-red-600 text-white shadow-sm'
                                  : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-100'
                              }`}
                            >
                              Confirm Violation
                            </button>
                            <button
                              type="button"
                              onClick={() => handleViolationResolutionChange(v.id, 'WAIVED')}
                              className={`px-2.5 py-1 rounded text-xs font-bold transition-colors ${
                                currentRes.status === 'WAIVED'
                                  ? 'bg-purple-600 text-white shadow-sm'
                                  : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-100'
                              }`}
                            >
                              Waive Finding
                            </button>
                          </div>
                        </div>
                        <p className="text-xs text-gray-600 mb-2">{v.description}</p>
                        <input
                          type="text"
                          value={currentRes.inspector_remark || ''}
                          onChange={(e) => handleViolationRemarkChange(v.id, e.target.value)}
                          placeholder="Enter statutory inspector remark / rationale..."
                          className="w-full text-xs p-1.5 rounded border border-gray-300 focus:ring-1 focus:ring-primary-500 outline-none"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Section 4: Enforcement Action & Sign Off */}
            <div className="p-4 bg-primary-50/50 rounded-xl border border-primary-200 mb-5">
              <h4 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                <Award className="h-4 w-4 text-primary-600" /> 4. Official Regulatory Action & Observations
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Enforcement Action</label>
                  <select
                    value={inspectorAction}
                    onChange={(e) => setInspectorAction(e.target.value)}
                    className="w-full text-xs p-2 rounded-lg border border-gray-300 font-bold outline-none"
                  >
                    <option value="APPROVED_COMPLIANT">Approved & Certified Compliant</option>
                    <option value="NOTICE_ISSUED">Statutory Notice Issued (Rule 32)</option>
                    <option value="WARNING_ISSUED">Official Rectification Warning Issued</option>
                    <option value="SEIZURE_RECOMMENDED">Seizure / Compound Proceeding Recommended</option>
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Official Inspector Remarks</label>
                  <input
                    type="text"
                    value={inspectorNotes}
                    onChange={(e) => setInspectorNotes(e.target.value)}
                    placeholder="e.g. Physical package inspected; mandatory declarations confirmed under Legal Metrology Rules."
                    className="w-full text-xs p-2 rounded-lg border border-gray-300 outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsReviewOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-gray-600 hover:text-gray-900"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={submitInspectorReview}
                  disabled={submittingReview}
                  className="flex items-center gap-2 px-5 py-2.5 bg-primary-600 text-white rounded-lg text-xs font-bold hover:bg-primary-700 disabled:opacity-50 transition-all shadow-md"
                >
                  {submittingReview ? (
                    <>
                      <div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-white border-t-transparent" />
                      Finalizing Official Report...
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4" /> Finalize & Sign Official Inspection Report
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Scanned Images Gallery */}
        {imageList.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2 text-sm">
                <Layers className="h-4 w-4 text-primary-600" /> Scanned Product Panels ({imageList.length})
              </h3>
              {imageList.length > 1 && (
                <span className="text-xs text-gray-400">Click angle to inspect</span>
              )}
            </div>

            {imageList.length > 1 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {imageList.map((img, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setSelectedImageIndex(idx)}
                    className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                      selectedImageIndex === idx 
                        ? 'bg-primary-600 text-white shadow-sm' 
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {img.label}
                  </button>
                ))}
              </div>
            )}

            {activeImage && (
              <div className="rounded-lg bg-gray-100 border border-gray-200 overflow-hidden flex flex-col items-center justify-center p-2">
                <img 
                  src={getImageUrl(activeImage.path)} 
                  alt={activeImage.label}
                  className="max-h-80 w-auto object-contain rounded"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
                <p className="text-xs text-gray-500 mt-2 font-medium">{activeImage.label}</p>
              </div>
            )}
          </div>
        )}

        {/* Font Size & Legibility Verification Card (Legal Metrology Rule 7 & 9) */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between pb-3 border-b border-gray-100 mb-4 gap-2">
            <div className="flex items-center gap-2">
              <Ruler className="h-5 w-5 text-primary-600" />
              <div>
                <h3 className="font-bold text-gray-900 text-base">Mandatory Font Size & Legibility (Rule 7 & 9)</h3>
                <p className="text-xs text-gray-500">Legal Metrology (Packaged Commodities) Rules, 2011</p>
              </div>
            </div>
            {scan.font_size_review?.status ? (
              <span className={`px-2.5 py-1 rounded-full text-xs font-bold tracking-wide uppercase ${
                scan.font_size_review.status === 'COMPLIANT' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
              }`}>
                Caliper Verified: {scan.font_size_review.status}
              </span>
            ) : (
              <span className="px-2.5 py-1 rounded-full text-xs font-bold tracking-wide uppercase bg-amber-100 text-amber-800 flex items-center gap-1">
                <AlertCircle className="h-3.5 w-3.5" /> Review Required
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 mb-4 text-xs">
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-gray-500 font-medium">Declared Quantity Tier</p>
              <p className="font-bold text-gray-900 text-sm mt-0.5">
                {scan.font_size_assessment?.quantity_tier || '50 g/ml to 200 g/ml'}
              </p>
              <p className="text-[10px] text-gray-400 mt-0.5">{scan.font_size_assessment?.declared_quantity || 'Standard Packaging'}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-gray-500 font-medium">Statutory Minimum Height</p>
              <p className="font-bold text-primary-700 text-sm mt-0.5">
                &ge; {scan.font_size_assessment?.statutory_min_height_mm || 2.0} mm
              </p>
              <p className="text-[10px] text-gray-400 mt-0.5">Rule 7 / Second Schedule</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-gray-500 font-medium">Estimated 2D Height</p>
              <p className="font-semibold text-gray-800 text-sm mt-0.5">
                ~{scan.font_size_assessment?.estimated_height_mm || 2.0} mm
              </p>
              <p className="text-[10px] text-amber-600 font-medium mt-0.5">Uncalibrated 2D Photo</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-gray-500 font-medium">Readability Index</p>
              <p className="font-bold text-emerald-600 text-sm mt-0.5">
                {scan.font_size_assessment?.readability_score || 85}%
              </p>
              <p className="text-[10px] text-gray-400 mt-0.5">Rule 9 Legibility Standard</p>
            </div>
          </div>

          {/* Caliper or Notice Banner */}
          {scan.font_size_review?.status ? (
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-xs text-green-900 flex items-start gap-2">
              <CheckCircle className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Inspector Physical Caliper Verification Recorded:</p>
                <p>
                  Measured Height: <b>{scan.font_size_review.measured_height_mm} mm</b> &bull; Status: <b>{scan.font_size_review.status}</b>
                  {scan.font_size_review.notes && <span> &bull; <i>{scan.font_size_review.notes}</i></span>}
                </p>
              </div>
            </div>
          ) : (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Review Required — 2D Image Physical Scale Limitation:</p>
                <p className="text-amber-800 mt-0.5">
                  Physical millimeter dimensions cannot be reliably certified from 2D photos without physical calibration targets. An authorized inspector can verify font dimensions using digital calipers in the Review Workbench.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Barcode Cross-Verification Audit Card */}
        {scan.extracted_fields?.barcode_audit && (
          <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6 shadow-sm">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 mb-4">
              <h3 className="font-bold text-gray-900 flex items-center gap-2 text-base">
                <QrCode className="h-5 w-5 text-primary-600" /> Barcode Cross-Verification Audit
              </h3>
              <span className={`px-2.5 py-1 rounded-full text-xs font-bold tracking-wide uppercase ${
                scan.extracted_fields.barcode_audit.status === 'MATCHED'
                  ? 'bg-green-100 text-green-800'
                  : 'bg-red-100 text-red-800'
              }`}>
                {scan.extracted_fields.barcode_audit.status === 'MATCHED' ? 'Authentic & Verified' : 'Mismatch / Discrepancy Alert'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4 text-sm">
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500 font-medium">GTIN / Barcode</p>
                <p className="font-mono text-sm font-semibold text-gray-900 mt-0.5">{scan.extracted_fields.barcode_audit.barcode || scan.barcode_detected}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500 font-medium">Registered Database Master</p>
                <p className="font-semibold text-gray-900 mt-0.5">{scan.extracted_fields.barcode_audit.master_name} {scan.extracted_fields.barcode_audit.master_brand ? `(${scan.extracted_fields.barcode_audit.master_brand})` : ''}</p>
              </div>
              {scan.extracted_fields.barcode_audit.master_net_quantity && (
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500 font-medium">Registered Volume</p>
                  <p className="font-semibold text-gray-900 mt-0.5">{scan.extracted_fields.barcode_audit.master_net_quantity}</p>
                </div>
              )}
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500 font-medium">Data Registry</p>
                <p className="font-semibold text-gray-700 mt-0.5">{scan.extracted_fields.barcode_audit.source || 'Central Legal Metrology Database'}</p>
              </div>
            </div>

            {Array.isArray(scan.extracted_fields.barcode_audit.checks) && scan.extracted_fields.barcode_audit.checks.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-gray-100 text-gray-600 uppercase font-semibold">
                    <tr>
                      <th className="p-2.5 rounded-l-lg">Check</th>
                      <th className="p-2.5">Registered Spec</th>
                      <th className="p-2.5">Found on Label</th>
                      <th className="p-2.5 rounded-r-lg text-right">Result</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {scan.extracted_fields.barcode_audit.checks.map((c: any, i: number) => {
                      const isOk = c.status === 'MATCHED';
                      return (
                        <tr key={i} className="hover:bg-gray-50/80">
                          <td className="p-2.5 font-medium text-gray-900">{c.field}</td>
                          <td className="p-2.5 text-gray-600">{String(c.expected || '-')}</td>
                          <td className="p-2.5 text-gray-600 font-medium">{String(c.found || '-')}</td>
                          <td className="p-2.5 text-right">
                            <span className={`inline-flex items-center gap-1 font-semibold ${isOk ? 'text-green-700' : 'text-red-600'}`}>
                              {isOk ? <CheckCircle className="h-3.5 w-3.5 inline" /> : <AlertTriangle className="h-3.5 w-3.5 inline" />}
                              {c.status}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-6 mb-6">
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2"><Shield className="h-4 w-4 text-primary-600" /> Scan Info</h3>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-gray-500">Type</dt><dd className="font-medium capitalize">{scan.scan_type?.replace('_', ' ')}</dd></div>
              <div className="flex justify-between"><dt className="text-gray-500">Date</dt><dd className="font-medium">{new Date(scan.created_at).toLocaleString()}</dd></div>
              {scan.barcode_detected && <div className="flex justify-between"><dt className="text-gray-500">Barcode</dt><dd className="font-mono text-xs font-bold">{scan.barcode_detected}</dd></div>}
              {scan.store_name && <div className="flex justify-between"><dt className="text-gray-500">Store</dt><dd className="font-medium">{scan.store_name}</dd></div>}
            </dl>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2"><FileText className="h-4 w-4 text-primary-600" /> Extracted Declarations</h3>
            <dl className="space-y-2.5 text-sm">
              {scan.extracted_fields && Object.entries(scan.extracted_fields)
                .filter(([key]) => key !== 'barcode_audit' && !key.startsWith('_'))
                .map(([key, val]: [string, any]) => {
                  let displayVal = 'Not Found';
                  if (val !== null && val !== undefined) {
                    if (key === 'mrp' && typeof val === 'object') {
                      displayVal = val.value !== undefined ? `₹${val.value}${val.has_tax_note ? ' (incl. of taxes)' : ''}` : String(val.raw || val);
                    } else if (key === 'net_quantity' && typeof val === 'object') {
                      displayVal = `${val.value ?? ''} ${val.unit ?? ''}`.trim() || String(val.raw || val);
                    } else if (key === 'dates' && typeof val === 'object') {
                      const mfg = val.manufacture_date?.value || val.manufacture_date;
                      displayVal = mfg ? `Mfg: ${mfg}` : String(val.raw || val.value || val);
                    } else if (typeof val === 'object') {
                      displayVal = val.value || val.raw || JSON.stringify(val);
                    } else {
                      displayVal = String(val);
                    }
                  }
                  return (
                    <div key={key} className="flex justify-between items-start gap-2">
                      <dt className="text-gray-500 capitalize">{key.replace(/_/g, ' ')}</dt>
                      <dd className="font-medium text-right max-w-[65%] text-gray-900 break-words">{displayVal}</dd>
                    </div>
                  );
                })}
            </dl>
          </div>
        </div>

        {/* Violations & Discrepancies Matrix */}
        {scan.violations && scan.violations.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">Violations & Discrepancies ({scan.violations.length})</h3>
              <span className="text-xs text-gray-400">Legal Metrology Rules 2011</span>
            </div>
            <div className="space-y-3">
              {scan.violations.map((v: any, i: number) => {
                const isResolved = v.status === 'RESOLVED_COMPLIANT' || v.status === 'WAIVED';
                const isReviewReq = v.status === 'REVIEW_REQUIRED';

                return (
                  <div key={i} className={`p-3.5 rounded-lg border transition-all ${
                    isResolved ? 'bg-green-50/70 border-green-200' :
                    isReviewReq ? 'bg-amber-50/70 border-amber-200' :
                    'bg-gray-50 border-gray-200'
                  }`}>
                    <div className="flex items-start gap-3">
                      {isResolved ? (
                        <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 shrink-0" />
                      ) : isReviewReq ? (
                        <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
                      ) : (
                        <XCircle className="h-5 w-5 text-red-500 mt-0.5 shrink-0" />
                      )}
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <span className="font-bold text-sm text-gray-900">{v.rule_name}</span>
                          <span className={`text-[11px] px-2 py-0.5 rounded-full font-bold uppercase ${
                            isResolved ? 'bg-green-100 text-green-800' :
                            isReviewReq ? 'bg-amber-100 text-amber-800' :
                            severityColor[v.severity] || 'bg-gray-100 text-gray-800'
                          }`}>
                            {v.status ? v.status.replace(/_/g, ' ') : v.severity}
                          </span>
                        </div>
                        <p className="text-xs text-gray-600 mb-1">{v.description}</p>
                        {v.expected_value && <p className="text-xs text-gray-500"><b>Expected:</b> {v.expected_value}</p>}
                        {v.actual_value && <p className="text-xs text-gray-500"><b>Found:</b> {v.actual_value}</p>}
                        {v.inspector_remark && (
                          <div className="mt-2 p-2 bg-blue-50/80 border border-blue-200 rounded text-xs text-blue-900 font-medium">
                            <span className="font-bold">Inspector Remark:</span> {v.inspector_remark}
                          </div>
                        )}
                        <p className="text-[10px] text-gray-400 mt-1.5">Ref: {v.section_reference} &bull; Code: {v.rule_code}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
