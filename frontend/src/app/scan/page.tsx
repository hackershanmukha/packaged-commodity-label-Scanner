'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Upload, 
  Camera, 
  QrCode, 
  X, 
  Loader2, 
  MapPin, 
  Plus, 
  CheckCircle2, 
  Layers, 
  Sparkles,
  RefreshCw,
  Trash2,
  ShieldCheck,
  AlertTriangle,
  Globe,
  Database,
  Package,
  Download
} from 'lucide-react';
import { scanAPI, productAPI } from '@/lib/api';
import toast from 'react-hot-toast';
import Webcam from 'react-webcam';
import { useAuth } from '@/hooks/useAuth';

type Tab = 'upload' | 'camera' | 'barcode';

interface ImageSlot {
  id: string;
  label: string;
  description: string;
  file: File | null;
  preview: string | null;
  required?: boolean;
}

const INITIAL_SLOTS: ImageSlot[] = [
  { 
    id: 'front', 
    label: 'Image 1 (Front Panel)', 
    description: 'Brand name, product name, net quantity', 
    file: null, 
    preview: null, 
    required: true 
  },
  { 
    id: 'back', 
    label: 'Image 2 (Back Panel)', 
    description: 'MRP, mfg/exp date, manufacturer info, customer care', 
    file: null, 
    preview: null 
  },
  { 
    id: 'left', 
    label: 'Image 3 (Side Panel 1)', 
    description: 'Ingredients, nutritional facts, storage directions', 
    file: null, 
    preview: null 
  },
  { 
    id: 'right', 
    label: 'Image 4 (Side Panel 2 / Barcode)', 
    description: 'Barcode, batch number, FSSAI / registration marks', 
    file: null, 
    preview: null 
  },
];

export default function ScanPage() {
  const { user, checked } = useAuth();
  const [tab, setTab] = useState<Tab>('upload');
  const [slots, setSlots] = useState<ImageSlot[]>(INITIAL_SLOTS);
  const [activeCameraSlotId, setActiveCameraSlotId] = useState<string>('front');
  const [loading, setLoading] = useState(false);
  const [barcode, setBarcode] = useState('');
  const [barcodeResult, setBarcodeResult] = useState<any>(null);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [storeName, setStoreName] = useState('');
  const [storeAddress, setStoreAddress] = useState('');
  
  const webcamRef = useRef<Webcam>(null);
  const batchFileRef = useRef<HTMLInputElement>(null);
  const individualFileRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});
  const router = useRouter();

  useEffect(() => {
    if (checked && user?.role === 'manufacturer') {
      router.replace('/manufacturer');
    }
  }, [checked, user, router]);

  const filledCount = slots.filter(s => s.file !== null).length;

  const getLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          toast.success('Location captured');
        },
        () => toast.error('Location access denied')
      );
    }
  };

  // Handle single slot file selection
  const handleSlotFileChange = (slotId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 10 * 1024 * 1024) { 
      toast.error('Max file size is 10MB'); 
      return; 
    }
    const previewUrl = URL.createObjectURL(f);
    setSlots(prev => prev.map(s => s.id === slotId ? { ...s, file: f, preview: previewUrl } : s));
    toast.success(`Added photo for ${slots.find(s => s.id === slotId)?.label}`);
    e.target.value = '';
  };

  // Handle batch selection of multiple files
  const handleBatchFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    let fileIdx = 0;

    // Fill empty slots first, then overwrite if more files
    const updatedSlots = slots.map(slot => {
      if (fileIdx < files.length) {
        const file = files[fileIdx];
        if (file.size <= 10 * 1024 * 1024) {
          fileIdx++;
          return {
            ...slot,
            file,
            preview: URL.createObjectURL(file),
          };
        }
      }
      return slot;
    });

    // If there are still extra files, add custom angle slots
    const extraSlots: ImageSlot[] = [];
    while (fileIdx < files.length) {
      const file = files[fileIdx];
      if (file.size <= 10 * 1024 * 1024) {
        const slotNum = updatedSlots.length + extraSlots.length + 1;
        extraSlots.push({
          id: `angle_${Date.now()}_${fileIdx}`,
          label: `Image ${slotNum} (Additional Angle)`,
          description: 'Additional product angle or details',
          file,
          preview: URL.createObjectURL(file),
        });
      }
      fileIdx++;
    }

    setSlots([...updatedSlots, ...extraSlots]);
    toast.success(`Assigned ${Math.min(files.length, updatedSlots.length + extraSlots.length)} photos to slots!`);
    e.target.value = '';
  };

  const clearSlot = (slotId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSlots(prev => prev.map(s => s.id === slotId ? { ...s, file: null, preview: null } : s));
  };

  const removeExtraSlot = (slotId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSlots(prev => prev.filter(s => s.id !== slotId));
  };

  const addCustomAngle = () => {
    const count = slots.length + 1;
    const newSlot: ImageSlot = {
      id: `custom_${Date.now()}`,
      label: `Image ${count} (Additional Angle)`,
      description: 'Additional angle or label panel',
      file: null,
      preview: null,
    };
    setSlots(prev => [...prev, newSlot]);
    setActiveCameraSlotId(newSlot.id);
  };

  // Capture photo from webcam into active slot
  const capturePhoto = useCallback(() => {
    const screenshot = webcamRef.current?.getScreenshot();
    if (!screenshot) {
      toast.error('Could not capture frame from camera');
      return;
    }

    fetch(screenshot)
      .then(r => r.blob())
      .then(blob => {
        const targetSlot = slots.find(s => s.id === activeCameraSlotId) || slots[0];
        const f = new File([blob], `${targetSlot.id}_capture.jpg`, { type: 'image/jpeg' });
        
        setSlots(prev => prev.map(s => s.id === targetSlot.id ? { ...s, file: f, preview: screenshot } : s));
        toast.success(`Captured for ${targetSlot.label}!`);

        // Automatically advance to the next empty slot
        const currentIndex = slots.findIndex(s => s.id === targetSlot.id);
        const nextEmpty = slots.find((s, idx) => idx > currentIndex && !s.file) || slots.find(s => !s.file);
        if (nextEmpty) {
          setActiveCameraSlotId(nextEmpty.id);
        }
      });
  }, [activeCameraSlotId, slots]);

  const submitScan = async (scanType: string) => {
    if (loading) return;
    const filledSlots = slots.filter(s => s.file !== null);
    if (!filledSlots.length) { 
      toast.error('Please upload or capture at least one product label photo (e.g. Front Panel)'); 
      return; 
    }

    const token = localStorage.getItem('token');
    if (!token) { 
      toast.error('Session expired — please log in again'); 
      router.push('/login'); 
      return; 
    }

    setLoading(true);
    try {
      const fd = new FormData();
      const labels: string[] = [];

      // Append all uploaded images and their panel labels
      filledSlots.forEach((slot) => {
        if (slot.file) {
          fd.append('images', slot.file);
          labels.push(slot.label);
        }
      });

      // Backward compatibility: append first image to 'image'
      if (filledSlots[0]?.file) {
        fd.append('image', filledSlots[0].file);
      }

      fd.append('image_labels', JSON.stringify(labels));
      fd.append('scan_type', scanType);

      if (barcode && barcode.trim()) {
        fd.append('barcode', barcode.trim());
      }

      if (location) {
        fd.append('latitude', String(location.lat));
        fd.append('longitude', String(location.lng));
      }
      if (storeName) fd.append('store_name', storeName);
      if (storeAddress) fd.append('store_address', storeAddress);

      const res = await scanAPI.create(fd);
      toast.success('Multi-panel scan complete!');
      router.push(`/scan/${res.data.id}`);
    } catch (err: any) {
      if (err.response?.status === 401) {
        toast.error('Session expired — please log in again');
        router.push('/login');
      } else if (err.response?.status === 500 || err.code === 'ERR_NETWORK') {
        const detail = err.response?.data?.detail;
        if (detail) {
          toast.error(typeof detail === 'string' ? detail : JSON.stringify(detail));
        } else {
          toast.error('Cannot connect to backend server. Make sure FastAPI is running on port 8000.');
        }
      } else {
        const detail = err.response?.data?.detail;
        let msg = err.response?.data?.message || err.message || 'Scan failed';
        if (typeof detail === 'string') {
          msg = detail;
        } else if (Array.isArray(detail)) {
          msg = detail.map((d: any) => (typeof d === 'string' ? d : d.msg || JSON.stringify(d))).join(', ');
        } else if (detail && typeof detail === 'object') {
          msg = detail.msg || JSON.stringify(detail);
        }
        toast.error(msg);
      }
    }
    setLoading(false);
  };

  const lookupBarcode = async (overrideCode?: string) => {
    const code = (overrideCode || barcode).trim();
    if (!code) { 
      toast.error('Enter a barcode number'); 
      return; 
    }
    if (overrideCode) {
      setBarcode(overrideCode);
    }
    setLoading(true);
    setBarcodeResult(null);
    try {
      const res = await productAPI.verify(code);
      setBarcodeResult(res.data);
      if (res.data.found) {
        toast.success(res.data.message || 'Product verified in registry!');
      } else {
        toast.error('Barcode not found in registry');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Product verification lookup failed');
    }
    setLoading(false);
  };

  const [downloadingReport, setDownloadingReport] = useState(false);

  const downloadBarcodeReport = async () => {
    if (!barcodeResult?.product?.barcode) return;
    const bcode = barcodeResult.product.barcode;
    setDownloadingReport(true);
    try {
      const res = await productAPI.report(bcode);
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `barcode-verification-${bcode}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Verification Report downloaded!');
    } catch (err: any) {
      toast.error('Failed to generate verification PDF');
    }
    setDownloadingReport(false);
  };

  const tabs = [
    { id: 'upload' as Tab, label: 'Upload Panels', icon: Upload },
    { id: 'camera' as Tab, label: 'Live Multi-Camera', icon: Camera },
    { id: 'barcode' as Tab, label: 'Barcode Lookup', icon: QrCode },
  ];

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
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Scan Product Label</h1>
          <p className="text-gray-500 text-sm mt-1">
            Capture multiple sides (Front, Back, Sides) to verify all mandatory Legal Metrology declarations.
          </p>
        </div>

        {/* Tab switcher */}
        <div className="flex bg-white rounded-xl border border-gray-200 p-1 mb-6 shadow-sm">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                tab === t.id ? 'bg-primary-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <t.icon className="h-4 w-4" /> {t.label}
            </button>
          ))}
        </div>

        {/* Tab 1: Upload Panels */}
        {tab === 'upload' && (
          <div className="space-y-6">
            {/* Batch Upload Banner */}
            <div 
              onClick={() => batchFileRef.current?.click()}
              className="border-2 border-dashed border-primary-200 bg-primary-50/40 rounded-xl p-6 text-center cursor-pointer hover:border-primary-400 hover:bg-primary-50/70 transition-colors"
            >
              <input 
                ref={batchFileRef} 
                type="file" 
                multiple 
                accept="image/*" 
                onChange={handleBatchFileSelect} 
                className="hidden" 
              />
              <div className="flex items-center justify-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center text-primary-600">
                  <Layers className="h-5 w-5" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-semibold text-primary-900">Batch Upload Product Photos</p>
                  <p className="text-xs text-primary-700">Select multiple files at once — auto-fills Front, Back, Sides</p>
                </div>
              </div>
            </div>

            {/* Panel Slots Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {slots.map((slot) => {
                const isCustom = slot.id.startsWith('angle_') || slot.id.startsWith('custom_');
                return (
                  <div 
                    key={slot.id} 
                    className={`bg-white rounded-xl border p-4 transition-all relative flex flex-col justify-between ${
                      slot.file ? 'border-green-300 shadow-sm' : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    {/* Header */}
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-gray-900 text-sm">{slot.label}</span>
                          {slot.required && (
                            <span className="text-[11px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-medium">
                              Primary
                            </span>
                          )}
                          {slot.file && (
                            <span className="flex items-center gap-1 text-[11px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-medium">
                              <CheckCircle2 className="h-3 w-3" /> Ready
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">{slot.description}</p>
                      </div>

                      {/* Remove/Clear Actions */}
                      <div className="flex items-center gap-1">
                        {slot.file && (
                          <button
                            type="button"
                            onClick={(e) => clearSlot(slot.id, e)}
                            title="Clear image"
                            className="p-1 text-gray-400 hover:text-red-600 rounded-md hover:bg-gray-100 transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                        {isCustom && (
                          <button
                            type="button"
                            onClick={(e) => removeExtraSlot(slot.id, e)}
                            title="Remove slot"
                            className="p-1 text-gray-400 hover:text-red-600 rounded-md hover:bg-gray-100 transition-colors"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Content Preview / Upload Trigger */}
                    {slot.preview ? (
                      <div className="relative rounded-lg overflow-hidden bg-gray-100 border border-gray-200 aspect-[4/3] flex items-center justify-center">
                        <img 
                          src={slot.preview} 
                          alt={slot.label} 
                          className="w-full h-full object-contain" 
                        />
                        <button
                          type="button"
                          onClick={() => individualFileRefs.current[slot.id]?.click()}
                          className="absolute bottom-2 right-2 px-2.5 py-1 bg-white/90 backdrop-blur-sm text-xs font-medium text-gray-700 rounded-md shadow hover:bg-white flex items-center gap-1 transition-all"
                        >
                          <RefreshCw className="h-3 w-3" /> Replace
                        </button>
                      </div>
                    ) : (
                      <div 
                        onClick={() => individualFileRefs.current[slot.id]?.click()}
                        className="rounded-lg border border-dashed border-gray-300 hover:border-primary-400 hover:bg-primary-50/20 aspect-[4/3] flex flex-col items-center justify-center cursor-pointer p-4 text-center transition-colors"
                      >
                        <Upload className="h-6 w-6 text-gray-400 mb-2" />
                        <span className="text-xs font-medium text-gray-700">Click to upload {slot.label}</span>
                        <span className="text-[11px] text-gray-400 mt-0.5">JPG, PNG up to 10MB</span>
                      </div>
                    )}

                    {/* Hidden input for this slot */}
                    <input 
                      ref={el => { individualFileRefs.current[slot.id] = el; }}
                      type="file" 
                      accept="image/*" 
                      onChange={(e) => handleSlotFileChange(slot.id, e)} 
                      className="hidden" 
                    />

                    {/* Quick camera button */}
                    {!slot.file && (
                      <div className="mt-2.5 pt-2 border-t border-gray-100 flex justify-end">
                        <button
                          type="button"
                          onClick={() => {
                            setActiveCameraSlotId(slot.id);
                            setTab('camera');
                          }}
                          className="text-xs text-primary-600 hover:text-primary-700 flex items-center gap-1 font-medium"
                        >
                          <Camera className="h-3.5 w-3.5" /> Capture with camera
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Add Extra Angle Button */}
            <div className="flex justify-center">
              <button
                type="button"
                onClick={addCustomAngle}
                className="px-4 py-2 border border-gray-300 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-100 flex items-center gap-1.5 transition-colors"
              >
                <Plus className="h-4 w-4" /> Add Another Image / Angle (Top, Bottom, etc.)
              </button>
            </div>

            {/* Barcode & Metadata */}
            <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <QrCode className="h-4 w-4 text-primary-600" />
                  Product Barcode / GTIN (Optional)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="e.g. 8901764175022 (Cross-verifies against Central Registry & Open Food Facts)"
                    value={barcode}
                    onChange={e => setBarcode(e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                  />
                  {barcode && (
                    <button
                      type="button"
                      onClick={() => setBarcode('')}
                      className="px-3 py-2 text-xs text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg"
                    >
                      Clear
                    </button>
                  )}
                </div>
                <p className="text-[11px] text-gray-500 mt-1">
                  Enables instant cross-verification of product name, declared MRP, and net volume against registered standards.
                </p>
              </div>

              <div className="border-t border-gray-100 pt-3">
                <div className="flex items-center justify-between">
                  <button 
                    type="button" 
                    onClick={getLocation} 
                    className="flex items-center gap-2 text-sm text-primary-600 hover:text-primary-700 font-medium"
                  >
                    <MapPin className="h-4 w-4" />
                    {location ? `Location: ${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}` : 'Add GPS Location (for field crowdsourcing)'}
                  </button>
                  {location && (
                    <span className="text-xs text-green-600 font-medium">GPS Active</span>
                  )}
                </div>

                {location && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    <input 
                      type="text" 
                      placeholder="Store / Retailer name" 
                      value={storeName} 
                      onChange={e => setStoreName(e.target.value)}
                      className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none" 
                    />
                    <input 
                      type="text" 
                      placeholder="Store address or market" 
                      value={storeAddress} 
                      onChange={e => setStoreAddress(e.target.value)}
                      className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none" 
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Submit Bar */}
            <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-gray-900">
                  {filledCount} of {slots.length} angles uploaded
                </p>
                <p className="text-xs text-gray-500">
                  {filledCount === 0 
                    ? 'Upload at least one angle to begin analysis' 
                    : 'All uploaded sides will be processed and aggregated for Legal Metrology compliance'}
                </p>
              </div>

              <button 
                onClick={() => submitScan(location ? 'crowdsource' : 'manual')} 
                disabled={filledCount === 0 || loading}
                className="w-full sm:w-auto px-6 py-3 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />}
                {loading ? 'Analyzing Product...' : `Scan Product (${filledCount} photo${filledCount > 1 ? 's' : ''})`}
              </button>
            </div>
          </div>
        )}

        {/* Tab 2: Live Camera Multi-Capture */}
        {tab === 'camera' && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
            {/* Slot Target Selector */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                Currently Capturing Angle:
              </label>
              <div className="flex flex-wrap gap-2">
                {slots.map(s => {
                  const isActive = s.id === activeCameraSlotId;
                  const hasPhoto = !!s.file;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setActiveCameraSlotId(s.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all ${
                        isActive 
                          ? 'bg-primary-600 text-white shadow-sm' 
                          : hasPhoto 
                            ? 'bg-green-50 text-green-700 border border-green-200' 
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {hasPhoto && <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />}
                      {s.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Webcam viewport */}
            <div className="rounded-xl overflow-hidden bg-black aspect-video relative flex items-center justify-center">
              <Webcam
                ref={webcamRef}
                audio={false}
                screenshotFormat="image/jpeg"
                videoConstraints={{ facingMode: 'environment', width: 1280, height: 720 }}
                className="w-full h-full object-cover"
              />
              <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-sm text-white text-xs px-2.5 py-1 rounded-md font-medium">
                Aiming at: {slots.find(s => s.id === activeCameraSlotId)?.label}
              </div>
            </div>

            {/* Shutter Button */}
            <div className="flex flex-col items-center justify-center gap-2">
              <button 
                onClick={capturePhoto}
                className="w-16 h-16 bg-primary-600 rounded-full flex items-center justify-center hover:bg-primary-700 shadow-lg transition-transform hover:scale-105 active:scale-95"
              >
                <Camera className="h-7 w-7 text-white" />
              </button>
              <p className="text-center text-xs text-gray-500">
                Tap camera to capture <span className="font-semibold text-gray-700">{slots.find(s => s.id === activeCameraSlotId)?.label}</span>
              </p>
            </div>

            {/* Thumbnail preview strip */}
            <div className="border-t border-gray-100 pt-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                Captured Panels ({filledCount}/{slots.length})
              </p>
              <div className="grid grid-cols-4 gap-2">
                {slots.map(s => (
                  <div 
                    key={s.id}
                    onClick={() => setActiveCameraSlotId(s.id)}
                    className={`cursor-pointer rounded-lg p-2 border text-center transition-all ${
                      s.id === activeCameraSlotId 
                        ? 'border-primary-500 ring-2 ring-primary-200' 
                        : 'border-gray-200'
                    }`}
                  >
                    <div className="aspect-[4/3] rounded bg-gray-100 overflow-hidden mb-1.5 flex items-center justify-center">
                      {s.preview ? (
                        <img src={s.preview} alt={s.label} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-[10px] text-gray-400">Empty</span>
                      )}
                    </div>
                    <p className="text-[11px] font-medium text-gray-700 truncate">{s.label}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Action Buttons in Camera View */}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setTab('upload')}
                className="flex-1 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Review All Panels
              </button>
              <button
                type="button"
                onClick={() => submitScan('live_camera')}
                disabled={filledCount === 0 || loading}
                className="flex-1 py-2.5 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {loading ? 'Analyzing...' : `Analyze (${filledCount} photo${filledCount > 1 ? 's' : ''})`}
              </button>
            </div>
          </div>
        )}

        {/* Tab 3: Barcode Lookup */}
        {tab === 'barcode' && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
            <div className="text-center py-2">
              <QrCode className="h-12 w-12 text-primary-500 mx-auto mb-2" />
              <h2 className="text-lg font-bold text-gray-900">Cross-Verify by Barcode</h2>
              <p className="text-gray-500 text-xs mt-1">
                Instant check against the Central Legal Metrology Registry & Open Food Facts Global Database
              </p>
            </div>

            {/* Input & Action */}
            <div className="space-y-3">
              <div className="flex gap-2">
                <input 
                  type="text" 
                  placeholder="Enter barcode number (e.g. 8901491101837)" 
                  value={barcode} 
                  onChange={e => setBarcode(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') lookupBarcode(); }}
                  className="flex-1 px-4 py-3 border border-gray-200 rounded-lg text-center sm:text-left text-base tracking-wider font-mono focus:ring-2 focus:ring-primary-500 outline-none" 
                />
                <button 
                  onClick={() => lookupBarcode()} 
                  disabled={loading}
                  className="px-6 py-3 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 disabled:opacity-50 transition-colors flex items-center gap-2 text-sm shrink-0"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <QrCode className="h-4 w-4" />}
                  {loading ? 'Verifying...' : 'Verify'}
                </button>
              </div>

              {/* Sample Test Pills */}
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="text-[11px] font-semibold text-gray-400 uppercase mr-1">Try samples:</span>
                <button
                  type="button"
                  onClick={() => lookupBarcode('8901491101837')}
                  className="px-2.5 py-1 bg-gray-100 hover:bg-primary-50 hover:text-primary-700 text-gray-600 rounded-md text-xs font-mono transition-colors"
                >
                  8901491101837 (Lay's)
                </button>
                <button
                  type="button"
                  onClick={() => lookupBarcode('8901725181222')}
                  className="px-2.5 py-1 bg-gray-100 hover:bg-primary-50 hover:text-primary-700 text-gray-600 rounded-md text-xs font-mono transition-colors"
                >
                  8901725181222 (Yippee)
                </button>
                <button
                  type="button"
                  onClick={() => lookupBarcode('8901234567890')}
                  className="px-2.5 py-1 bg-gray-100 hover:bg-primary-50 hover:text-primary-700 text-gray-600 rounded-md text-xs font-mono transition-colors"
                >
                  8901234567890 (Basmati Rice)
                </button>
                <button
                  type="button"
                  onClick={() => lookupBarcode('8902345678901')}
                  className="px-2.5 py-1 bg-gray-100 hover:bg-primary-50 hover:text-primary-700 text-gray-600 rounded-md text-xs font-mono transition-colors"
                >
                  8902345678901 (Biscuits)
                </button>
              </div>
            </div>

            {/* Results Section */}
            {barcodeResult && (
              <div className="pt-2">
                {barcodeResult.found ? (
                  <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
                    {/* Source Header Banner */}
                    <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        {barcodeResult.source === 'open_food_facts' ? (
                          <span className="flex items-center gap-1.5 text-xs font-medium text-blue-700 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-200">
                            <Globe className="h-3.5 w-3.5" /> Open Food Facts Global Registry
                          </span>
                        ) : (
                          <span className="flex items-center gap-1.5 text-xs font-medium text-green-700 bg-green-50 px-2.5 py-1 rounded-full border border-green-200">
                            <Database className="h-3.5 w-3.5" /> Central Legal Metrology Database
                          </span>
                        )}
                      </div>
                      <span className="text-xs font-mono text-gray-500">Barcode: {barcodeResult.product?.barcode}</span>
                    </div>

                    {/* Product Details Body */}
                    <div className="p-5">
                      <div className="flex flex-col sm:flex-row items-start gap-4">
                        {/* Product Image Thumbnail */}
                        {barcodeResult.image_url ? (
                          <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-lg overflow-hidden bg-gray-50 border border-gray-200 flex-shrink-0 flex items-center justify-center p-1">
                            <img 
                              src={barcodeResult.image_url} 
                              alt={barcodeResult.product?.name}
                              className="w-full h-full object-contain"
                            />
                          </div>
                        ) : (
                          <div className="w-20 h-20 rounded-lg bg-primary-50 border border-primary-100 flex items-center justify-center text-primary-500 flex-shrink-0">
                            <Package className="h-8 w-8" />
                          </div>
                        )}

                        {/* Title, Brand, Category */}
                        <div className="flex-1 space-y-1.5">
                          <div className="flex flex-wrap gap-1.5 items-center">
                            {barcodeResult.product?.brand && (
                              <span className="text-xs font-bold uppercase tracking-wider text-primary-700 bg-primary-50 px-2 py-0.5 rounded">
                                {barcodeResult.product.brand}
                              </span>
                            )}
                            {barcodeResult.product?.category && (
                              <span className="text-xs text-gray-600 bg-gray-100 px-2 py-0.5 rounded">
                                {barcodeResult.product.category}
                              </span>
                            )}
                          </div>
                          <h3 className="text-lg font-bold text-gray-900">
                            {barcodeResult.product?.name || 'Verified Packaged Commodity'}
                          </h3>

                          {/* Key Specs Grid */}
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2 text-xs">
                            {barcodeResult.product?.mrp && (
                              <div>
                                <span className="text-gray-400 block">Registered MRP</span>
                                <span className="font-bold text-green-700 text-sm">₹{barcodeResult.product.mrp}</span>
                              </div>
                            )}
                            {barcodeResult.product?.net_quantity && (
                              <div>
                                <span className="text-gray-400 block">Net Quantity</span>
                                <span className="font-semibold text-gray-800">{barcodeResult.product.net_quantity}</span>
                              </div>
                            )}
                            {barcodeResult.product?.country_of_origin && (
                              <div>
                                <span className="text-gray-400 block">Origin</span>
                                <span className="font-semibold text-gray-800">{barcodeResult.product.country_of_origin}</span>
                              </div>
                            )}
                            {barcodeResult.product?.manufacturer_name && (
                              <div className="col-span-2">
                                <span className="text-gray-400 block">Manufacturer</span>
                                <span className="font-medium text-gray-800 truncate block">{barcodeResult.product.manufacturer_name}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Integrity / Anti-Counterfeit Status Banner */}
                      <div className="mt-4 pt-4 border-t border-gray-100">
                        {barcodeResult.is_consistent ? (
                          <div className="flex items-center gap-2.5 p-3 rounded-lg bg-green-50 border border-green-200 text-green-800 text-xs">
                            <ShieldCheck className="h-5 w-5 text-green-600 shrink-0" />
                            <div>
                              <span className="font-semibold">Registry Match Verified</span>
                              <p className="text-green-700 mt-0.5">
                                Product barcode is authentic with no reported overpricing or manufacturer discrepancies on record.
                              </p>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2.5 p-3 rounded-lg bg-red-50 border border-red-200 text-red-800 text-xs">
                            <AlertTriangle className="h-5 w-5 text-red-600 shrink-0" />
                            <div>
                              <span className="font-semibold">Audit Discrepancy Alert</span>
                              <p className="text-red-700 mt-0.5">
                                {barcodeResult.alert || 'Previous scans reported an MRP or manufacturer mismatch against this barcode.'}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Action Buttons */}
                      <div className="mt-4 flex flex-wrap items-center justify-end gap-2.5">
                        <button
                          type="button"
                          onClick={downloadBarcodeReport}
                          disabled={downloadingReport}
                          className="px-4 py-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg text-xs font-medium flex items-center gap-1.5 shadow-sm transition-colors"
                        >
                          {downloadingReport ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Download className="h-3.5 w-3.5 text-primary-600" />
                          )}
                          {downloadingReport ? 'Generating Certificate...' : 'Download Verification Report (PDF)'}
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setTab('upload');
                            toast('Ready to scan label photos for this product', { icon: '📸' });
                          }}
                          className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors"
                        >
                          <Upload className="h-3.5 w-3.5" /> Scan Label Panels for this Product
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-center">
                    <AlertTriangle className="h-8 w-8 text-amber-500 mx-auto mb-2" />
                    <h3 className="text-sm font-semibold text-amber-900">Barcode Not Found in Registry</h3>
                    <p className="text-xs text-amber-700 mt-1 max-w-md mx-auto">
                      Barcode <span className="font-mono font-bold">{barcode}</span> is not registered in the central database or Open Food Facts.
                    </p>
                    <div className="mt-4">
                      <button
                        type="button"
                        onClick={() => {
                          setTab('upload');
                          toast('Upload the label photo to register this product', { icon: '📝' });
                        }}
                        className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-medium transition-colors"
                      >
                        Upload Product Label to Register
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
