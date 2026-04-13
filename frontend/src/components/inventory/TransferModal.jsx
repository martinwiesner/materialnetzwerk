import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { inventoryService } from '../../services/inventoryService';
import { relationshipService } from '../../services/relationshipService';
import { X, ArrowRightLeft, Gift } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';

export default function TransferModal({ item, onClose }) {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const [mode, setMode] = useState('transfer'); // 'transfer' or 'gift'
  const [quantity, setQuantity] = useState('');
  const [recipientId, setRecipientId] = useState('');
  const [error, setError] = useState('');

  const { data: contactsData } = useQuery({
    queryKey: ['contacts', user?.id],
    queryFn: relationshipService.getContacts,
    enabled: !!user?.id,
  });

  const transferMutation = useMutation({
    mutationFn: () => inventoryService.transfer(item.id, {
      toUserId: recipientId,
      quantity: parseFloat(quantity),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      onClose();
    },
    onError: (err) => {
      setError(err.response?.data?.error || 'Failed to transfer');
    },
  });

  const giftMutation = useMutation({
    mutationFn: () => inventoryService.gift(item.id, {
      toUserId: recipientId,
      quantity: parseFloat(quantity),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      onClose();
    },
    onError: (err) => {
      setError(err.response?.data?.error || 'Failed to gift');
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    if (!quantity || parseFloat(quantity) <= 0) {
      setError('Please enter a valid quantity');
      return;
    }

    if (parseFloat(quantity) > item.quantity) {
      setError('Quantity exceeds available stock');
      return;
    }

    if (!recipientId) {
      setError('Please select a recipient');
      return;
    }

    if (mode === 'transfer') {
      transferMutation.mutate();
    } else {
      giftMutation.mutate();
    }
  };

  const isPending = transferMutation.isPending || giftMutation.isPending;
  const contacts = contactsData?.data || [];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            {mode === 'transfer' ? 'Transfer' : 'Gift'} Material
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4">
          {/* Mode Toggle */}
          <div className="flex rounded-lg bg-gray-100 p-1 mb-4">
            <button
              onClick={() => setMode('transfer')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-colors ${
                mode === 'transfer'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <ArrowRightLeft className="w-4 h-4" />
              Transfer
            </button>
            <button
              onClick={() => setMode('gift')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-colors ${
                mode === 'gift'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Gift className="w-4 h-4" />
              Gift
            </button>
          </div>

          {/* Item Info */}
          <div className="bg-gray-50 rounded-lg p-3 mb-4">
            <p className="font-medium text-gray-900">{item.material_name}</p>
            <p className="text-sm text-gray-600">
              Available: {item.quantity} {item.unit}
            </p>
          </div>

          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm mb-4">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Recipient *
              </label>
              <select
                value={recipientId}
                onChange={(e) => setRecipientId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                required
              >
                <option value="">Select Contact</option>
                {contacts.map((contact) => (
                  <option key={contact.id} value={contact.id}>
                    {contact.firstName || contact.username} {contact.lastName || ''}
                  </option>
                ))}
              </select>
              {contacts.length === 0 && (
                <p className="text-sm text-gray-500 mt-1">
                  No contacts available. Add contacts first.
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Quantity ({item.unit}) *
              </label>
              <input
                type="number"
                step="0.01"
                max={item.quantity}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                required
              />
            </div>

            <div className="text-sm text-gray-600">
              {mode === 'transfer' ? (
                <p>The recipient will need to accept this transfer.</p>
              ) : (
                <p>The material will be immediately added to the recipient's inventory.</p>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isPending || contacts.length === 0}
                className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors disabled:opacity-50"
              >
                {isPending ? 'Processing...' : mode === 'transfer' ? 'Send Transfer' : 'Send Gift'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
