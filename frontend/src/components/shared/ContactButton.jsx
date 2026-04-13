/**
 * ContactButton
 * Shows owner name + "Nachricht senden" button.
 * Opens a quick compose modal; requires auth.
 */
import { useState } from 'react';
import { MessageSquare, X, Send, User } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { useAuthStore } from '../../store/authStore';
import { useAuthOverlayStore } from '../../store/authOverlayStore';
import { messageService } from '../../services/messageService';
import { useToast } from '../../store/toastStore';

function ComposeModal({ ownerId, ownerName, contextLabel, onClose }) {
  const [subject, setSubject] = useState(contextLabel ? `Anfrage: ${contextLabel}` : '');
  const [content, setContent] = useState('');
  const toast = useToast();

  const mutation = useMutation({
    mutationFn: messageService.send,
    onSuccess: () => {
      toast.success(`Nachricht an ${ownerName} gesendet.`);
      onClose();
    },
    onError: (err) => {
      toast.error(err?.response?.data?.message || 'Senden fehlgeschlagen.');
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!content.trim()) return;
    mutation.mutate({ receiver_id: ownerId, subject, content });
  };

  return (
    <div className="fixed inset-0 z-[99999] flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <p className="text-sm font-semibold text-gray-900">Nachricht an {ownerName}</p>
            {contextLabel && <p className="text-xs text-gray-500 mt-0.5">{contextLabel}</p>}
          </div>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Betreff</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="z.B. Anfrage zum Material"
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-primary-400 outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Nachricht <span className="text-actor-500">*</span></label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={4}
              required
              placeholder="Schreibe deine Nachricht..."
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none focus:ring-2 focus:ring-primary-400 outline-none"
            />
          </div>
          <div className="flex gap-2 justify-end pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              disabled={mutation.isPending || !content.trim()}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-primary-700 hover:bg-primary-800 text-white rounded-xl transition-colors disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              {mutation.isPending ? 'Senden…' : 'Senden'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function ContactButton({ ownerId, ownerName, contextLabel, className = '' }) {
  const [open, setOpen] = useState(false);
  const { isAuthenticated, token, user } = useAuthStore();
  const openAuth = useAuthOverlayStore((s) => s.open);

  // Don't show button if owner is the current user
  if (!ownerId || (user?.id && user.id === ownerId)) return null;

  const handleClick = () => {
    if (!isAuthenticated || !token) {
      openAuth({ tab: 'login', reason: 'Bitte logge dich ein, um Nachrichten zu senden.' });
      return;
    }
    setOpen(true);
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium border border-primary-200 text-primary-700 bg-primary-50 hover:bg-primary-100 transition-colors ${className}`}
      >
        <MessageSquare className="w-3.5 h-3.5" />
        Nachricht senden
      </button>

      {open && (
        <ComposeModal
          ownerId={ownerId}
          ownerName={ownerName}
          contextLabel={contextLabel}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

/** Small owner byline — "von Vorname Nachname" + contact button */
export function OwnerLine({ ownerId, ownerFirstName, ownerLastName, ownerEmail, contextLabel }) {
  const name = ownerFirstName
    ? `${ownerFirstName} ${ownerLastName || ''}`.trim()
    : ownerEmail?.split('@')[0] || 'Unbekannt';

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="inline-flex items-center gap-1 text-xs text-gray-500">
        <User className="w-3 h-3" />
        {name}
      </span>
      <ContactButton
        ownerId={ownerId}
        ownerName={name}
        contextLabel={contextLabel}
      />
    </div>
  );
}
