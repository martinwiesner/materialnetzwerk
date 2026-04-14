import { useEffect, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Inbox, CheckCircle2, XCircle, Archive, Package, X, ChevronDown, ChevronUp, Undo2 } from 'lucide-react';
import { materialRequestService } from '../../services/materialRequestService';
import { StatusBadge } from './MaterialRequestModal';
import { useToast } from '../../store/toastStore';

/** Visual bar showing free / reserved / completed proportions */
function QuantityBar({ total, reserved, completed, unit }) {
  if (!total || total <= 0) return null;
  const pctCompleted = Math.min(100, (completed / total) * 100);
  const pctReserved  = Math.min(100 - pctCompleted, (reserved / total) * 100);
  const pctFree      = Math.max(0, 100 - pctCompleted - pctReserved);

  return (
    <div className="space-y-1 mt-2 mb-1">
      <div className="flex rounded-full overflow-hidden h-2 bg-gray-100">
        <div style={{ width: `${pctCompleted}%` }} className="bg-gray-500 transition-all" title={`Abgeholt: ${completed} ${unit}`} />
        <div style={{ width: `${pctReserved}%`  }} className="bg-orange-400 transition-all" title={`Reserviert: ${reserved} ${unit}`} />
        <div style={{ width: `${pctFree}%`      }} className="bg-green-400 transition-all"  title={`Frei: ${(total - completed - reserved).toFixed(2)} ${unit}`} />
      </div>
      <div className="flex gap-3 text-[11px] text-gray-500">
        {pctCompleted > 0 && <span><span className="inline-block w-2 h-2 rounded-full bg-gray-500 mr-1" />Abgeholt {completed} {unit}</span>}
        {pctReserved  > 0 && <span><span className="inline-block w-2 h-2 rounded-full bg-orange-400 mr-1" />Reserviert {reserved} {unit}</span>}
        <span><span className="inline-block w-2 h-2 rounded-full bg-green-400 mr-1" />Frei {Math.max(0, total - completed - reserved).toFixed(2).replace(/\.00$/,'')} {unit}</span>
      </div>
    </div>
  );
}

function RequestCard({ req, onAction, mutating }) {
  const [note, setNote] = useState('');
  const [showNote, setShowNote] = useState(false);

  const name = req.requester_first_name
    ? `${req.requester_first_name} ${req.requester_last_name || ''}`.trim()
    : req.requester_email?.split('@')[0] || 'Unbekannt';

  return (
    <div className="bg-gray-50 rounded-xl border border-gray-200 p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-medium text-gray-900 text-sm">{name}</p>
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
        <p className="text-xs text-gray-500 bg-white rounded px-2 py-1">Notiz: {req.owner_note}</p>
      )}

      {req.status === 'pending' && (
        <div className="space-y-2 pt-1">
          <button
            onClick={() => setShowNote(v => !v)}
            className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600"
          >
            {showNote ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            Notiz hinzufügen (optional)
          </button>
          {showNote && (
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="z.B. Abholung bitte bis …"
              className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-400 outline-none bg-white"
            />
          )}
          <div className="flex gap-2">
            <button onClick={() => onAction(req.id, 'accepted', note)}  disabled={mutating}
              className="flex-1 inline-flex items-center justify-center gap-1 px-2 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50">
              <CheckCircle2 className="w-3.5 h-3.5" /> Annehmen
            </button>
            <button onClick={() => onAction(req.id, 'reserved', note)}  disabled={mutating}
              className="flex-1 inline-flex items-center justify-center gap-1 px-2 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50">
              <Archive className="w-3.5 h-3.5" /> Reservieren
            </button>
            <button onClick={() => onAction(req.id, 'declined', note)}  disabled={mutating}
              className="flex-1 inline-flex items-center justify-center gap-1 px-2 py-1.5 bg-red-100 hover:bg-red-200 text-red-700 text-xs font-semibold rounded-lg transition-colors disabled:opacity-50">
              <XCircle className="w-3.5 h-3.5" /> Ablehnen
            </button>
          </div>
        </div>
      )}

      {req.status === 'reserved' && (
        <div className="flex gap-2 pt-1">
          <button onClick={() => onAction(req.id, 'completed', req.owner_note)} disabled={mutating}
            className="flex-1 inline-flex items-center justify-center gap-1 px-2 py-1.5 bg-gray-800 hover:bg-gray-900 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50">
            <Package className="w-3.5 h-3.5" /> Abgeholt
          </button>
          <button onClick={() => onAction(req.id, 'pending', req.owner_note)} disabled={mutating}
            className="flex-1 inline-flex items-center justify-center gap-1 px-2 py-1.5 bg-orange-100 hover:bg-orange-200 text-orange-700 text-xs font-semibold rounded-lg transition-colors disabled:opacity-50">
            <Undo2 className="w-3.5 h-3.5" /> Reservierung aufheben
          </button>
        </div>
      )}

      {req.status === 'accepted' && (
        <button onClick={() => onAction(req.id, 'completed', req.owner_note)} disabled={mutating}
          className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-900 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50">
          <Package className="w-3.5 h-3.5" /> Als abgeholt markieren
        </button>
      )}
    </div>
  );
}

function OfferGroup({ inventoryId, materialName, requests, inventoryQty, inventoryUnit, onAction, mutating, highlighted }) {
  const ref = useRef(null);
  const [collapsed, setCollapsed] = useState(false);

  // Auto-scroll + open if highlighted (arrived via message link)
  useEffect(() => {
    if (highlighted && ref.current) {
      ref.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setCollapsed(false);
    }
  }, [highlighted]);

  const reserved   = requests.filter(r => r.status === 'reserved').reduce((s, r) => s + (Number(r.quantity) || 0), 0);
  const completed  = requests.filter(r => r.status === 'completed').reduce((s, r) => s + (Number(r.quantity) || 0), 0);
  const pendingCount = requests.filter(r => r.status === 'pending').length;

  return (
    <div ref={ref} className={`border rounded-xl overflow-hidden transition-all ${highlighted ? 'border-primary-400 ring-2 ring-primary-100' : 'border-gray-200'}`}>
      <button
        onClick={() => setCollapsed(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 bg-white hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0">
          <Package className="w-4 h-4 text-gray-400 flex-shrink-0" />
          <span className="font-semibold text-gray-900 text-sm truncate">{materialName}</span>
          {pendingCount > 0 && (
            <span className="w-5 h-5 bg-orange-500 text-white text-xs font-bold rounded-full flex items-center justify-center flex-shrink-0">
              {pendingCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {inventoryQty != null && (
            <span className="text-xs text-gray-500">
              {inventoryQty} {inventoryUnit || ''}
            </span>
          )}
          {collapsed ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronUp className="w-4 h-4 text-gray-400" />}
        </div>
      </button>

      {!collapsed && (
        <div className="px-4 pb-4 bg-white border-t border-gray-100">
          {inventoryQty != null && (
            <QuantityBar
              total={inventoryQty}
              reserved={reserved}
              completed={completed}
              unit={inventoryUnit || ''}
            />
          )}
          <div className="space-y-2 mt-3">
            {requests.map(r => (
              <RequestCard key={r.id} req={r} onAction={onAction} mutating={mutating} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function IncomingRequestsPanel({ onClose, initialInventoryId }) {
  const toast = useToast();
  const queryClient = useQueryClient();

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ['incoming-requests'],
    queryFn: materialRequestService.getIncoming,
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status, note }) => materialRequestService.updateStatus(id, status, note),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['incoming-requests'] });
      queryClient.invalidateQueries({ queryKey: ['marketplace-inventory'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-detail'] });
      toast.success('Status aktualisiert.');
    },
    onError: () => toast.error('Aktualisierung fehlgeschlagen.'),
  });

  // Group by inventory_id
  const groups = requests.reduce((acc, r) => {
    const key = r.inventory_id;
    if (!acc[key]) acc[key] = { materialName: r.material_name || 'Angebot', inventoryQty: r.inventory_quantity, inventoryUnit: r.inventory_unit, requests: [] };
    acc[key].requests.push(r);
    return acc;
  }, {});

  const pendingTotal = requests.filter(r => r.status === 'pending').length;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-start justify-end z-[9998] p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md h-[calc(100vh-2rem)] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Inbox className="w-5 h-5 text-primary-500" />
            Eingehende Anfragen
            {pendingTotal > 0 && (
              <span className="ml-1 w-5 h-5 bg-orange-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                {pendingTotal}
              </span>
            )}
          </h2>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin w-7 h-7 border-4 border-primary-400 border-t-transparent rounded-full" />
            </div>
          ) : Object.keys(groups).length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <Inbox className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm">Noch keine Anfragen eingegangen.</p>
            </div>
          ) : (
            Object.entries(groups).map(([invId, g]) => (
              <OfferGroup
                key={invId}
                inventoryId={invId}
                materialName={g.materialName}
                requests={g.requests}
                inventoryQty={g.inventoryQty}
                inventoryUnit={g.inventoryUnit}
                onAction={(id, status, note) => statusMutation.mutate({ id, status, note })}
                mutating={statusMutation.isPending}
                highlighted={invId === initialInventoryId}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
