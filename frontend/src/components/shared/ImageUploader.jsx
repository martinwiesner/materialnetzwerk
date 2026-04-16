import { useState, useRef } from 'react';
import { Upload, X, Star, Image as ImageIcon } from 'lucide-react';
import { MEDIA_BASE } from '../../services/api';

/**
 * ImageUploader
 *
 * Props:
 *  images       – array of {id, file_path, original_name, sort_order, step_index, step_caption}
 *  onUpload     – async fn(files: File[], options?) called with new files
 *  onDelete     – async fn(imageId)
 *  onSetCover   – async fn(imageId)  — marks image as cover
 *  onSetStep    – async fn(imageId, stepIndex, stepCaption) — assigns step
 *  stepCount    – number of steps available (0 = no step selectors shown)
 *  apiBase      – media base URL
 *  label        – section label
 */
export default function ImageUploader({
  images = [],
  onUpload,
  onDelete,
  onSetCover,
  onSetStep,
  onSetCredit,
  stepCount = 0,
  apiBase = MEDIA_BASE,
  label = 'Bilder',
}) {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef(null);

  const sorted = [...images].sort((a, b) => (a.sort_order ?? 999) - (b.sort_order ?? 999));
  const coverId = sorted[0]?.id;

  const handleFiles = async (files) => {
    if (!files.length) return;
    setUploading(true);
    try {
      await onUpload(Array.from(files), { sort_start: images.length });
    } finally {
      setUploading(false);
    }
  };

  const imageUrl = (img) => {
    if (!img?.file_path) return null;
    const base = apiBase.replace(/\/$/, '');
    const p = img.file_path.startsWith('/') ? img.file_path : '/' + img.file_path;
    return `${base}${p}`;
  };

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-gray-700">{label}</label>

      {/* Existing images */}
      {sorted.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {sorted.map((img) => {
            const isCover = img.id === coverId;
            return (
              <div key={img.id} className="flex flex-col">
              <div
                className={`relative group rounded-t-xl overflow-hidden border-2 bg-gray-50 transition-all ${
                  isCover ? 'border-primary-400 shadow-md' : 'border-gray-200'
                } ${onSetCredit ? 'rounded-b-none border-b-0' : 'rounded-b-xl'}`}
              >
                {/* Image preview */}
                <img
                  src={imageUrl(img)}
                  alt={img.original_name || 'Bild'}
                  className="w-full h-28 object-cover"
                  onError={(e) => { e.target.style.display = 'none'; }}
                />

                {/* Cover badge */}
                {isCover && (
                  <span className="absolute top-1 left-1 bg-primary-500 text-white text-[10px] px-2 py-0.5 rounded-full font-semibold flex items-center gap-1">
                    <Star className="w-2.5 h-2.5 fill-white" /> Cover
                  </span>
                )}

                {/* Hover actions */}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1 p-1">
                  {!isCover && onSetCover && (
                    <button
                      type="button"
                      onClick={() => onSetCover(img.id)}
                      className="w-full text-[11px] bg-primary-500 hover:bg-primary-600 text-white rounded px-2 py-1 font-medium"
                      title="Als Cover setzen"
                    >
                      Als Cover
                    </button>
                  )}
                  {onDelete && (
                    <button
                      type="button"
                      onClick={() => onDelete(img.id)}
                      className="w-full text-[11px] bg-red-500 hover:bg-red-600 text-white rounded px-2 py-1 font-medium flex items-center justify-center gap-1"
                    >
                      <X className="w-3 h-3" /> Löschen
                    </button>
                  )}
                </div>

                {/* Step assignment */}
                {stepCount > 0 && !isCover && onSetStep && (
                  <div className="absolute bottom-0 left-0 right-0 bg-white/90 px-1.5 py-1">
                    <select
                      value={img.step_index ?? ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        onSetStep(img.id, val === '' ? null : parseInt(val, 10), img.step_caption || null);
                      }}
                      className="w-full text-[10px] border border-gray-300 rounded px-1 py-0.5 outline-none focus:ring-1 focus:ring-primary-400"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <option value="">Kein Schritt</option>
                      {Array.from({ length: stepCount }, (_, i) => (
                        <option key={i + 1} value={i + 1}>Schritt {i + 1}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
              {onSetCredit && (
                <input
                  type="text"
                  placeholder="© Bildnachweis (optional)"
                  defaultValue={img.credit || ''}
                  onBlur={(e) => {
                    const val = e.target.value;
                    if (val !== (img.credit || '')) onSetCredit(img.id, val);
                  }}
                  className="w-full text-[11px] px-2 py-1 border-2 border-t-0 border-gray-200 rounded-b-xl focus:outline-none focus:ring-1 focus:ring-primary-300 bg-white text-gray-500 placeholder-gray-300"
                />
              )}
              </div>
            );
          })}
        </div>
      )}

      {sorted.length === 0 && (
        <p className="text-xs text-gray-500 italic">
          Das erste hochgeladene Bild wird automatisch zum Cover. Du kannst das später ändern.
        </p>
      )}

      {/* Upload zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files); }}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-colors ${
          dragging ? 'border-primary-400 bg-primary-50' : 'border-gray-300 hover:border-primary-400 hover:bg-gray-50'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/*"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <ImageIcon className="w-6 h-6 text-gray-400 mx-auto mb-1" />
        <p className="text-xs text-gray-500 font-medium">
          {uploading ? 'Wird hochgeladen…' : 'Bilder hier ablegen oder klicken'}
        </p>
        <p className="text-[10px] text-gray-400 mt-0.5">JPG, PNG, WEBP bis 10 MB</p>
      </div>
    </div>
  );
}
