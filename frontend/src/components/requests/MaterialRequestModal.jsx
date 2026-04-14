import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Package, Send } from 'lucide-react';
import { materialRequestService } from '../../services/materialRequestService';
import { useToast } from '../../store/toastStore';

const STATUS_LABELS = {
  pending:   { label: 'Ausstehend',  color: 'bg-yellow-100 text-yellow-700' },
  accepted:  { label: 'Angenommen', color: 'bg-green-100 text-green-700' },
  declined:  { label: 'Abgelehnt',  color: 'bg-red-100 text-red-700' },
  reserved:  { label: 'Reserviert', color: 'bg-blue-100 text-blue-700' },
  completed: { label: 'Abgeschlossen', color: 'bg-gray-100 text-gray-600' },
};

export function StatusBadge({ status }) {
  const s = STATUS_LABELS[status] || STATUS_LABELS.pending;
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${s.color}`}>{s.label}</span>;
}

export default function MaterialRequestModal({ item, onClose }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [quantity, setQuantity] = useState('');
  const [message, setMessage] = useState('');

  const mutation = useMutation({
    mutationFn: () => materialRequestService.create({
      inventory_id: item.id,
      quantity: quantity ? parseFloat(quantity) : null,
      unit: item.unit || item.material_unit || '',
      message,
    }),
    onSuccess: () => {
      toast.success('Anfrage gesendet!');
      queryClient.invalidateQueries({ queryKey: ['my-requests'] });
      onClose();
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Anfrage fehlgeschlagen.'),
  });

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[10000] p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Package className="w-5 h-5 text-primary-500" />
            Material anfragen
          </h2>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div className="bg-gray-50 rounded-xl p-3 text-sm text-gray-700">
            <p className="font-semibold">{item.material_name || 'Materialangebot'}</p>
            {item.quantity && (
              <p className="text-gray-500 mt-0.5">Verfügbar: {item.quantity} {item.unit || item.material_unit || ''}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Gewünschte Menge <span className="text-gray-400 font-normal">(leer = gesamte Menge)</span>
            </label>
            <div className="flex gap-2">
              <input
                type="number"
                step="any"
                min="0"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder={item.quantity ? String(item.quantity) : ''}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none text-sm"
              />
              <span className="px-3 py-2 bg-gray-100 rounded-lg text-sm text-gray-600 min-w-[60px] text-center">
                {item.unit || item.material_unit || 'Stk.'}
              </span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nachricht ans Angebot</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              placeholder="Kurze Beschreibung, wofür du das Material benötigst, wann du es abholen könntest, …"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none resize-none text-sm"
            />
          </div>
        </div>

        <div className="px-6 pb-5 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200">
            Abbrechen
          </button>
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className="inline-flex items-center gap-2 px-5 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
            {mutation.isPending ? 'Senden…' : 'Anfrage senden'}
          </button>
        </div>
      </div>
    </div>
  );
}
