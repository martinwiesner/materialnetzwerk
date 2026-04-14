import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { X, ClipboardList, Package, Undo2 } from 'lucide-react';
import { materialRequestService } from '../../services/materialRequestService';
import { StatusBadge } from './MaterialRequestModal';
import { useToast } from '../../store/toastStore';

function MyRequestCard({ req, onWithdraw, mutating }) {
  const name = req.owner_first_name
    ? `${req.owner_first_name} ${req.owner_last_name || ''}`.trim()
    : req.owner_email?.split('@')[0] || 'Unbekannt';

  return (
    <div className="bg-gray-50 rounded-xl border border-gray-200 p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium text-gray-900 text-sm truncate">{req.material_name || 'Material'}</p>
          <p className="text-xs text-gray-400">Anbieter: {name}</p>
          <p className="text-xs text-gray-400">{new Date(req.created_at).toLocaleDateString('de-DE')}</p>
        </div>
        <StatusBadge status={req.status} />
      </div>

      {req.quantity && (
        <p className="text-sm text-gray-700">
          Anfrage: <span className="font-semibold">{req.quantity} {req.unit || ''}</span>
        </p>
      )}

      {req.message && (
        <p className="text-sm text-gray-600 bg-white rounded-lg px-3 py-2 border border-gray-100 italic">
          „{req.message}"
        </p>
      )}

      {req.owner_note && (
        <p className="text-xs text-gray-500 bg-white rounded px-2 py-1">
          Notiz des Anbieters: {req.owner_note}
        </p>
      )}

      {req.status === 'pending' && (
        <button
          onClick={() => onWithdraw(req.id)}
          disabled={mutating}
          className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-semibold rounded-lg transition-colors disabled:opacity-50"
        >
          <Undo2 className="w-3.5 h-3.5" />
          Anfrage zurückziehen
        </button>
      )}
    </div>
  );
}

export default function MyRequestsPanel({ onClose }) {
  const toast = useToast();
  const queryClient = useQueryClient();

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ['my-requests'],
    queryFn: materialRequestService.getMyRequests,
  });

  const withdrawMutation = useMutation({
    mutationFn: (id) => materialRequestService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-requests'] });
      toast.success('Anfrage zurückgezogen.');
    },
    onError: () => toast.error('Zurückziehen fehlgeschlagen.'),
  });

  const pending   = requests.filter(r => r.status === 'pending');
  const active    = requests.filter(r => ['accepted', 'reserved'].includes(r.status));
  const done      = requests.filter(r => ['completed', 'declined'].includes(r.status));

  return (
    <div className="fixed inset-0 bg-black/50 flex items-start justify-end z-[9998] p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md h-[calc(100vh-2rem)] flex flex-col">

        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-primary-500" />
            Meine Anfragen
            {pending.length > 0 && (
              <span className="ml-1 w-5 h-5 bg-yellow-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                {pending.length}
              </span>
            )}
          </h2>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin w-7 h-7 border-4 border-primary-400 border-t-transparent rounded-full" />
            </div>
          ) : requests.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <ClipboardList className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm">Du hast noch keine Anfragen gestellt.</p>
            </div>
          ) : (
            <>
              {pending.length > 0 && (
                <section className="space-y-2">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-1">Ausstehend</p>
                  {pending.map(r => (
                    <MyRequestCard key={r.id} req={r} onWithdraw={(id) => withdrawMutation.mutate(id)} mutating={withdrawMutation.isPending} />
                  ))}
                </section>
              )}
              {active.length > 0 && (
                <section className="space-y-2">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-1">Bestätigt</p>
                  {active.map(r => (
                    <MyRequestCard key={r.id} req={r} onWithdraw={(id) => withdrawMutation.mutate(id)} mutating={withdrawMutation.isPending} />
                  ))}
                </section>
              )}
              {done.length > 0 && (
                <section className="space-y-2">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-1">Abgeschlossen / Abgelehnt</p>
                  {done.map(r => (
                    <MyRequestCard key={r.id} req={r} onWithdraw={(id) => withdrawMutation.mutate(id)} mutating={withdrawMutation.isPending} />
                  ))}
                </section>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
