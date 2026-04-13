import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { inventoryService } from '../../services/inventoryService';
import { materialService } from '../../services/materialService';
import { Plus, Search, Edit2, Trash2, Warehouse, ArrowRightLeft, Gift } from 'lucide-react';
import InventoryForm from '../../components/inventory/InventoryForm';
import TransferModal from '../../components/inventory/TransferModal';

export default function Inventory() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [transferItem, setTransferItem] = useState(null);

  const { data: inventoryData, isLoading } = useQuery({
    queryKey: ['inventory', { search }],
    queryFn: () => inventoryService.getAll({ search }),
  });

  const { data: transfersData } = useQuery({
    queryKey: ['inventory-transfers'],
    queryFn: inventoryService.getTransfers,
  });

  const deleteMutation = useMutation({
    mutationFn: inventoryService.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
    },
  });

  const acceptTransferMutation = useMutation({
    mutationFn: inventoryService.acceptTransfer,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-transfers'] });
    },
  });

  const handleDelete = (id) => {
    if (window.confirm('Are you sure you want to delete this inventory item?')) {
      deleteMutation.mutate(id);
    }
  };

  const handleEdit = (item) => {
    setEditingItem(item);
    setShowForm(true);
  };

  const handleFormClose = () => {
    setShowForm(false);
    setEditingItem(null);
  };

  const handleTransfer = (item) => {
    setTransferItem(item);
  };

  const inventory = Array.isArray(inventoryData) ? inventoryData : inventoryData?.data || [];
  const transfers = Array.isArray(transfersData) ? transfersData : transfersData?.data || [];
  const pendingTransfers = transfers.filter(t => t.status === 'pending');

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inventory</h1>
          <p className="text-gray-600">Track your material stock</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="inline-flex items-center gap-2 bg-primary-500 text-white px-4 py-2 rounded-lg font-medium hover:bg-primary-600 transition-colors"
        >
          <Plus className="w-5 h-5" />
          Add Inventory
        </button>
      </div>

      {/* Pending Transfers */}
      {pendingTransfers.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-6">
          <h3 className="font-medium text-yellow-800 mb-3">
            Pending Transfers ({pendingTransfers.length})
          </h3>
          <div className="space-y-2">
            {pendingTransfers.map((transfer) => (
              <div
                key={transfer.id}
                className="flex items-center justify-between bg-white rounded-lg p-3 border border-yellow-200"
              >
                <div>
                  <span className="font-medium">{transfer.material_name}</span>
                  <span className="text-gray-500 mx-2">•</span>
                  <span className="text-gray-600">
                    {transfer.quantity} {transfer.unit}
                  </span>
                  <span className="text-gray-500 mx-2">from</span>
                  <span className="text-gray-700">{transfer.from_user_name}</span>
                </div>
                <button
                  onClick={() => acceptTransferMutation.mutate(transfer.id)}
                  disabled={acceptTransferMutation.isPending}
                  className="px-3 py-1 bg-green-500 text-white text-sm rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50"
                >
                  Accept
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search inventory..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
          />
        </div>
      </div>

      {/* Inventory List */}
      {isLoading ? (
        <div className="text-center py-12">
          <div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full mx-auto" />
        </div>
      ) : inventory.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
          <Warehouse className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No inventory items</h3>
          <p className="text-gray-600 mb-4">Start tracking your material stock</p>
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-2 bg-primary-500 text-white px-4 py-2 rounded-lg font-medium hover:bg-primary-600 transition-colors"
          >
            <Plus className="w-5 h-5" />
            Add Inventory
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Material</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Quantity</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600 hidden md:table-cell">Location</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600 hidden md:table-cell">Status</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {inventory.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div>
                      <span className="font-medium text-gray-900">
                        {item.material_name || 'Unknown Material'}
                      </span>
                      {item.batch_number && (
                        <p className="text-sm text-gray-500">Batch: {item.batch_number}</p>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-900">
                    {item.quantity} {item.unit}
                  </td>
                  <td className="px-4 py-3 text-gray-600 hidden md:table-cell">
                    {item.location || '-'}
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <span className={`inline-block px-2 py-1 text-xs font-medium rounded-full ${
                      item.status === 'available' ? 'bg-green-100 text-green-700' :
                      item.status === 'reserved' ? 'bg-yellow-100 text-yellow-700' :
                      item.status === 'used' ? 'bg-gray-100 text-gray-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {item.status || 'available'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => handleTransfer(item)}
                        className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Transfer"
                      >
                        <ArrowRightLeft className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleEdit(item)}
                        className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <InventoryForm
          item={editingItem}
          onClose={handleFormClose}
        />
      )}

      {transferItem && (
        <TransferModal
          item={transferItem}
          onClose={() => setTransferItem(null)}
        />
      )}
    </div>
  );
}
