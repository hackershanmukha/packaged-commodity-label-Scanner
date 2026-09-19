'use client';

import { useState, useRef, useCallback } from 'react';
import { 
  Upload, 
  Camera, 
  Loader2, 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  Factory, 
  Plus, 
  Trash2, 
  Layers, 
  CheckCircle2, 
  RefreshCw, 
  X,
  Sparkles
} from 'lucide-react';
import Webcam from 'react-webcam';
import { manufacturerAPI } from '@/lib/api';
import toast from 'react-hot-toast';
import { useAuth } from '@/hooks/useAuth';

interface LabelFile {
  id: string;
  file: File;
  preview: string;
  name: string;
  source: 'upload' | 'camera';
}

export default function ManufacturerPage() {
  const { checked, user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [files, setFiles] = useState<LabelFile[]>([]);
  const [productName, setProductName] = useState('');
  const [showCamera, setShowCamera] = useState(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');

  const fileRef = useRef<HTMLInputElement>(null);
  const webcamRef = useRef<Webcam>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles || selectedFiles.length === 0) return;

    const newFiles: LabelFile[] = Array.from(selectedFiles).map((f, idx) => ({
      id: `${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 7)}`,
      file: f,
      preview: URL.createObjectURL(f),
      name: f.name,
      source: 'upload',
    }));

    setFiles((prev) => [...prev, ...newFiles]);
    if (fileRef.current) fileRef.current.value = '';
    toast.success(`Added ${newFiles.length} panel image${newFiles.length > 1 ? 's' : ''}`);
  };

  const captureFromCamera = useCallback(() => {
    const screenshot = webcamRef.current?.getScreenshot();
    if (!screenshot) {
      toast.error('Could not capture frame from camera. Please verify camera permissions.');
      return;
    }

    fetch(screenshot)
      .then((res) => res.blob())
      .then((blob) => {
        const panelNumber = files.length + 1;
        const file = new File([blob], `camera_panel_${panelNumber}.jpg`, { type: 'image/jpeg' });
        const newFile: LabelFile = {
          id: `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          file,
          preview: screenshot,
          name: `Camera Panel ${panelNumber}`,
          source: 'camera',
        };

        setFiles((prev) => [...prev, newFile]);
        toast.success(`Captured Panel ${panelNumber}! Snap another or close camera.`);
      })
      .catch(() => {
        toast.error('Error processing captured frame');
      });
  }, [files.length]);

  const toggleFacingMode = () => {
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
    toast.success(`Switched camera mode`);
  };

  const removeFile = (id: string) => {
    setFiles((prev) => {
      const removed = prev.find((f) => f.id === id);
      if (removed) URL.revokeObjectURL(removed.preview);
      return prev.filter((f) => f.id !== id);
    });
  };

  const clearAllFiles = () => {
    files.forEach((f) => URL.revokeObjectURL(f.preview));
    setFiles([]);
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleSubmit = async () => {
    if (files.length === 0) {
      toast.error('Please upload or capture at least one label image');
      return;
    }
    if (!productName.trim()) {
      toast.error('Please enter the product name');
      return;
    }

    setLoading(true);
    try {
      const fd = new FormData();
      files.forEach((f) => {
        fd.append('images', f.file);
      });
      fd.append('product_name', productName.trim());

      const res = await manufacturerAPI.checkLabel(fd);
      setResult(res.data);
      toast.success(`Analysis complete across ${files.length} panel${files.length > 1 ? 's' : ''}!`);
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Compliance check failed');
    }
    setLoading(false);
  };

  const statusConfig: Record<string, { icon: any; color: string; bg: string; label: string }> = {
    compliant: { icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50 border-green-200', label: 'Compliant' },
    non_compliant: { icon: XCircle, color: 'text-red-600', bg: 'bg-red-50 border-red-200', label: 'Non-Compliant' },
    partially_compliant: { icon: AlertTriangle, color: 'text-yellow-600', bg: 'bg-yellow-50 border-yellow-200', label: 'Partially Compliant' },
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
      <div className="max-w-3xl mx-auto">
        {/* Page Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-primary-50 rounded-lg flex items-center justify-center">
            <Factory className="h-5 w-5 text-primary-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Pre-Print Label Check</h1>
            <p className="text-sm text-gray-500">Verify label compliance across multiple packaging panels before printing</p>
          </div>
        </div>

        {/* Input Card */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6 shadow-sm">
          <div className="space-y-5">
            {/* Product Name Input */}
            <div>
              <label className="block text-sm font-semibold text-gray-800 mb-1.5">Product Name</label>
              <input
                type="text"
                placeholder="e.g. Maaza Mango Drink 150ml or Premium Basmati Rice"
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none transition-all"
              />
            </div>

            {/* Label Images Section */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-semibold text-gray-800">
                  Packaging Panels & Images{' '}
                  <span className="text-xs font-normal text-gray-500">
                    ({files.length} attached • upload or capture with camera)
                  </span>
                </label>
                {files.length > 0 && (
                  <button
                    type="button"
                    onClick={clearAllFiles}
                    className="text-xs font-medium text-red-600 hover:text-red-700 transition-colors"
                  >
                    Clear All
                  </button>
                )}
              </div>

              {/* Action Buttons: Choose File vs Use Camera */}
              <div className="flex flex-wrap gap-2 mb-3">
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-primary-50 text-primary-700 hover:bg-primary-100 rounded-lg text-xs font-medium transition-colors"
                >
                  <Upload className="h-3.5 w-3.5" />
                  Upload Images
                </button>
                <button
                  type="button"
                  onClick={() => setShowCamera((prev) => !prev)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    showCamera
                      ? 'bg-red-50 text-red-600 border border-red-200 hover:bg-red-100'
                      : 'bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200'
                  }`}
                >
                  <Camera className="h-3.5 w-3.5" />
                  {showCamera ? 'Close Camera' : 'Capture with Camera'}
                </button>
              </div>

              {/* Live Camera Viewport */}
              {showCamera && (
                <div className="mb-4 bg-gray-900 rounded-xl p-4 text-white shadow-inner relative overflow-hidden border border-gray-800">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
                      <span className="text-xs font-semibold text-gray-200 uppercase tracking-wider">
                        Live Camera • Aim at panel (Front, Back, Top, Sides)
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={toggleFacingMode}
                        className="px-2.5 py-1 bg-white/10 hover:bg-white/20 rounded-md text-[11px] font-medium text-gray-200 flex items-center gap-1 transition-colors"
                        title="Switch between front and back cameras"
                      >
                        <RefreshCw className="h-3 w-3" /> Flip
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowCamera(false)}
                        className="p-1 text-gray-400 hover:text-white rounded-md transition-colors"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {/* Camera Screen */}
                  <div className="relative rounded-lg overflow-hidden bg-black aspect-video sm:aspect-[4/3] max-h-80 mx-auto flex items-center justify-center">
                    <Webcam
                      ref={webcamRef}
                      audio={false}
                      screenshotFormat="image/jpeg"
                      videoConstraints={{
                        facingMode,
                        width: { ideal: 1920 },
                        height: { ideal: 1080 },
                      }}
                      className="w-full h-full object-cover"
                    />

                    {/* Framing Reticle */}
                    <div className="absolute inset-4 sm:inset-8 border-2 border-dashed border-white/60 pointer-events-none rounded-lg flex items-center justify-center">
                      <span className="text-white/70 text-[11px] bg-black/40 px-2 py-0.5 rounded backdrop-blur-sm">
                        Keep panel flat and well-lit inside frame
                      </span>
                    </div>
                  </div>

                  {/* Shutter Controls */}
                  <div className="mt-4 flex flex-col items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={captureFromCamera}
                      className="flex items-center gap-2 px-5 py-2.5 bg-primary-600 hover:bg-primary-500 text-white rounded-full font-medium text-sm shadow-lg hover:scale-105 active:scale-95 transition-all"
                    >
                      <Camera className="h-4 w-4" />
                      Snap & Add Panel {files.length + 1}
                    </button>
                    <span className="text-[11px] text-gray-400">
                      Click to snap — each click adds a new panel without closing the camera!
                    </span>
                  </div>
                </div>
              )}

              {/* Upload / Empty State */}
              {files.length === 0 && !showCamera && (
                <div
                  onClick={() => fileRef.current?.click()}
                  className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer hover:border-primary-500 hover:bg-primary-50/40 transition-all group"
                >
                  <div className="w-12 h-12 bg-primary-50 rounded-full flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                    <Upload className="h-6 w-6 text-primary-600" />
                  </div>
                  <p className="text-gray-800 text-sm font-medium">Upload or snap label panels</p>
                  <p className="text-gray-500 text-xs mt-1">Select files or use the camera to snap Front, Back, Top cap, Sides</p>
                  <p className="text-gray-400 text-[11px] mt-1.5">Supports PNG, JPG, WebP up to 10MB</p>
                </div>
              )}

              {/* Grid of uploaded images */}
              {files.length > 0 && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {files.map((item, index) => (
                      <div
                        key={item.id}
                        className="relative group border border-gray-200 rounded-lg overflow-hidden bg-gray-50 shadow-sm"
                      >
                        <div className="h-36 w-full flex items-center justify-center bg-gray-100 overflow-hidden">
                          <img
                            src={item.preview}
                            alt={`Panel ${index + 1}`}
                            className="h-full w-full object-contain"
                          />
                        </div>
                        <div className="p-2 bg-white flex items-center justify-between border-t border-gray-100">
                          <div className="truncate pr-2">
                            <div className="flex items-center gap-1 mb-0.5">
                              <span className="inline-block px-1.5 py-0.5 text-[10px] font-semibold bg-primary-50 text-primary-700 rounded">
                                Panel {index + 1}
                              </span>
                              {item.source === 'camera' && (
                                <span className="text-[10px] text-blue-600 font-medium flex items-center gap-0.5">
                                  <Camera className="h-2.5 w-2.5" /> Cam
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-gray-600 truncate">{item.name}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeFile(item.id)}
                            className="p-1 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors shrink-0"
                            title="Remove image"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))}

                    {/* Add More via File */}
                    <button
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      className="h-full min-h-[144px] border-2 border-dashed border-gray-200 rounded-lg flex flex-col items-center justify-center p-4 hover:border-primary-400 hover:bg-primary-50/30 transition-all text-gray-500 hover:text-primary-600"
                    >
                      <Plus className="h-6 w-6 mb-1" />
                      <span className="text-xs font-medium">+ Add from File</span>
                      <span className="text-[10px] text-gray-400 mt-0.5">Browse PC / phone storage</span>
                    </button>

                    {/* Add More via Camera */}
                    <button
                      type="button"
                      onClick={() => setShowCamera(true)}
                      className="h-full min-h-[144px] border-2 border-dashed border-blue-200 rounded-lg flex flex-col items-center justify-center p-4 hover:border-blue-400 hover:bg-blue-50/30 transition-all text-blue-600"
                    >
                      <Camera className="h-6 w-6 mb-1" />
                      <span className="text-xs font-medium">+ Snap with Camera</span>
                      <span className="text-[10px] text-blue-400 mt-0.5">Capture live angle</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Hidden file input */}
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>

            {/* Submit Button */}
            <button
              onClick={handleSubmit}
              disabled={loading || files.length === 0}
              className="w-full flex items-center justify-center gap-2 py-3 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 disabled:opacity-50 transition-colors shadow-sm cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Analyzing {files.length} panel{files.length > 1 ? 's' : ''} with OCR...
                </>
              ) : (
                <>
                  <CheckCircle className="h-5 w-5" />
                  Check Compliance {files.length > 0 ? `(${files.length} panel${files.length > 1 ? 's' : ''})` : ''}
                </>
              )}
            </button>
          </div>
        </div>

        {/* Results Section */}
        {result && (() => {
          const comp = result.compliance_result?.compliance || result.compliance_result || result;
          const extracted = result.compliance_result?.extracted_fields || {};
          const status = statusConfig[comp.status || comp.compliance_status || result.compliance_status] || statusConfig.non_compliant;
          const StatusIcon = status.icon;

          return (
            <div className="space-y-4">
              {/* Status Banner */}
              <div className={`rounded-xl border p-5 ${status.bg} shadow-sm`}>
                <div className="flex items-center gap-3">
                  <StatusIcon className={`h-10 w-10 ${status.color} shrink-0`} />
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">{status.label}</h3>
                    <p className="text-gray-600 text-sm mt-0.5">
                      Score: <strong className="text-gray-900">{comp.compliance_score ?? comp.score ?? 0}%</strong> • {comp.passed_checks || 0}/{comp.total_checks || 0} checks passed across {result.compliance_result?.panel_count || files.length} panel(s)
                    </p>
                  </div>
                </div>
              </div>

              {/* Extracted Declarations Summary */}
              <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <Layers className="h-4 w-4 text-primary-600" />
                  Extracted Mandatory Declarations
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-2.5 bg-gray-50 rounded-lg border border-gray-100">
                    <span className="text-gray-500 block">Commodity Name</span>
                    <strong className="text-gray-900">{extracted.common_name || 'Not detected'}</strong>
                  </div>
                  <div className="p-2.5 bg-gray-50 rounded-lg border border-gray-100">
                    <span className="text-gray-500 block">Net Quantity</span>
                    <strong className="text-gray-900">
                      {extracted.net_quantity ? `${extracted.net_quantity.value} ${extracted.net_quantity.unit}` : 'Not detected'}
                    </strong>
                  </div>
                  <div className="p-2.5 bg-gray-50 rounded-lg border border-gray-100">
                    <span className="text-gray-500 block">MRP</span>
                    <strong className="text-gray-900">
                      {extracted.mrp ? `Rs. ${extracted.mrp.value}` : 'Not detected'}
                    </strong>
                    {extracted.mrp?.has_tax_note && (
                      <span className="text-[10px] text-green-600 ml-1.5 font-medium">(Incl. of taxes)</span>
                    )}
                  </div>
                  <div className="p-2.5 bg-gray-50 rounded-lg border border-gray-100">
                    <span className="text-gray-500 block">Dates</span>
                    <strong className="text-gray-900">
                      {extracted.dates?.manufacture_date?.value ? `Mfg: ${extracted.dates.manufacture_date.value}` : (extracted.dates?.expiry_date?.value ? `Exp: ${extracted.dates.expiry_date.value}` : 'Not detected')}
                    </strong>
                  </div>
                  <div className="p-2.5 bg-gray-50 rounded-lg border border-gray-100">
                    <span className="text-gray-500 block">Country of Origin</span>
                    <strong className="text-gray-900">{extracted.country_of_origin || 'Not detected'}</strong>
                  </div>
                  <div className="p-2.5 bg-gray-50 rounded-lg border border-gray-100">
                    <span className="text-gray-500 block">Consumer Care</span>
                    <strong className="text-gray-900">
                      {extracted.consumer_care?.phone || extracted.consumer_care?.email || 'Not detected'}
                    </strong>
                  </div>
                </div>
              </div>

              {/* Issues to Fix */}
              {(comp.violations || []).length > 0 && (
                <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                  <h3 className="font-semibold text-gray-900 mb-3 text-red-600 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    Issues to Fix Before Mass Printing ({comp.violations.length})
                  </h3>
                  <div className="space-y-2">
                    {comp.violations.map((v: any, i: number) => (
                      <div key={i} className="flex items-start gap-2 p-3 bg-red-50 border border-red-100 rounded-lg">
                        <XCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{v.rule_name || v.name}</p>
                          <p className="text-xs text-gray-600 mt-0.5">{v.description}</p>
                          <p className="text-[11px] text-gray-400 mt-1">Section: {v.section_reference || v.section}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Passed Checks */}
              {(comp.passed_rules || []).length > 0 && (
                <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                  <h3 className="font-semibold text-gray-900 mb-3 text-green-700 flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4" />
                    Passed Statutory Checks ({comp.passed_rules.length})
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {comp.passed_rules.map((r: any, i: number) => (
                      <div key={i} className="flex items-center gap-2 text-xs font-medium text-green-800 bg-green-50/70 border border-green-100 px-3 py-2 rounded-md">
                        <CheckCircle className="h-3.5 w-3.5 text-green-600 shrink-0" />
                        <span>{typeof r === 'string' ? r : (r.rule_name || r.name)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })()}
      </div>
    </div>
  );
}
