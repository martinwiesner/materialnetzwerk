import { useState } from 'react';
import { Share2, Printer, Check } from 'lucide-react';

export default function SharePrintBar({ url, title, onPrint }) {
  const [copied, setCopied] = useState(false);

  async function handleShare() {
    try {
      if (navigator.share) {
        await navigator.share({ title, url });
      } else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch (_) {}
  }

  return (
    <div className="flex items-center justify-between gap-3 px-5 py-4 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
      <span className="text-xs text-gray-400 font-mono truncate max-w-[200px]">{url}</span>
      <div className="flex gap-2">
        <button
          onClick={handleShare}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 transition-colors"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Share2 className="w-3.5 h-3.5" />}
          {copied ? 'Kopiert!' : 'Teilen'}
        </button>
        {onPrint && (
          <button
            onClick={onPrint}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <Printer className="w-3.5 h-3.5" />
            Poster
          </button>
        )}
      </div>
    </div>
  );
}
