import { useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { X, Lightbulb, Send } from 'lucide-react';
import { useFeatureRequestStore } from '../../store/featureRequestStore';
import { useAuthStore } from '../../store/authStore';
import { useToast } from '../../store/toastStore';
import { featureRequestService } from '../../services/featureRequestService';

export default function FeatureRequestOverlay() {
  const { isOpen, close } = useFeatureRequestStore();
  const { isAuthenticated } = useAuthStore();
  const toast = useToast();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');

  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [close]);

  const mutation = useMutation({
    mutationFn: () => featureRequestService.create({ title, description, name, email }),
    onSuccess: () => {
      toast.success('Danke für deine Idee! Wir haben sie erhalten.');
      setTitle('');
      setDescription('');
      setName('');
      setEmail('');
      close();
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Senden fehlgeschlagen.'),
  });

  if (!isOpen) return null;

  const canSubmit = title.trim().length > 0 && description.trim().length > 0 && !mutation.isPending;

  return (
    <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={close} />
      <div className="relative bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden">

        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <Lightbulb className="w-4 h-4 text-gray-400" />
            <span className="text-sm font-semibold text-gray-800">Idee / Feature-Request einreichen</span>
          </div>
          <button onClick={close} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-5 space-y-4">
          <p className="text-xs text-gray-500 leading-relaxed">
            Fehlt eine Funktion oder hast du einen Verbesserungsvorschlag? Deine Idee wird an unser
            Entwickler-Team weitergeleitet.
          </p>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Titel</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              placeholder="Kurzer Titel deiner Idee"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Beschreibung</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              maxLength={3000}
              placeholder="Was fehlt dir, oder was würdest du dir wünschen?"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none resize-none text-sm"
            />
          </div>

          {!isAuthenticated && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  E-Mail <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none text-sm"
                />
              </div>
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-gray-100 flex justify-end gap-3 flex-shrink-0">
          <button onClick={close} className="px-4 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200">
            Abbrechen
          </button>
          <button
            onClick={() => mutation.mutate()}
            disabled={!canSubmit}
            className="inline-flex items-center gap-2 px-5 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
            {mutation.isPending ? 'Senden…' : 'Senden'}
          </button>
        </div>
      </div>
    </div>
  );
}
