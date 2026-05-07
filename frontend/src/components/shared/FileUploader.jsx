import { useState, useRef } from 'react';
import { Upload, X, FileText, Download } from 'lucide-react';

const FILE_EXT_ICONS = {
  '.dxf': '📐', '.dwg': '📐',
  '.step': '🧊', '.stp': '🧊',
  '.stl': '🧊', '.obj': '🧊',
  '.pdf': '📄',
  '.svg': '🖼️',
  '.zip': '📦', '.rar': '📦',
};

function extIcon(name = '') {
  const ext = name.slice(name.lastIndexOf('.')).toLowerCase();
  return FILE_EXT_ICONS[ext] || '📎';
}

import { MEDIA_BASE } from '../../services/api';

export default function FileUploader({ files = [], onUpload, onDelete, apiBase = MEDIA_BASE, label = 'Fertigungsdaten / Dateien', accept }) {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef(null);

  const defaultAccept = '.dxf,.dwg,.step,.stp,.stl,.obj,.3ds,.igs,.iges,.svg,.pdf,.zip,.rar,.png,.jpg,.jpeg';

  const handleFiles = async (rawFiles) => {
    if (!rawFiles.length) return;
    setUploading(true);
    try {
      await onUpload(Array.from(rawFiles));
    } finally {
      setUploading(false);
    }
  };

  const fileUrl = (f) => {
    if (!f?.file_path) return null;
    const p = f.file_path.replace(/^\./,'');
    return `${apiBase}${p}`;
  };

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-gray-700">{label}</label>

      {files.length > 0 && (
        <ul className="space-y-1">
          {files.map(f => (
            <li key={f.id} className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2 border border-gray-200">
              <span className="text-base">{extIcon(f.original_name)}</span>
              <span className="text-sm text-gray-700 flex-1 truncate">{f.original_name || f.filename}</span>
              <a
                href={fileUrl(f)}
                download={f.original_name}
                target="_blank"
                rel="noreferrer"
                className="text-primary-600 hover:text-primary-700"
                title="Download"
              >
                <Download className="w-4 h-4" />
              </a>
              <button type="button" onClick={() => onDelete(f.id)} className="text-red-400 hover:text-red-600">
                <X className="w-4 h-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files); }}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${
          dragging ? 'border-primary-400 bg-primary-50' : 'border-gray-300 hover:border-primary-400 hover:bg-gray-50'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={accept || defaultAccept}
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <Upload className="w-5 h-5 text-gray-400 mx-auto mb-1" />
        <p className="text-xs text-gray-500">
          {uploading ? 'Wird hochgeladen…' : 'DXF, STEP, STL, PDF, SVG u.v.m. hierher ziehen oder klicken'}
        </p>
      </div>
    </div>
  );
}
