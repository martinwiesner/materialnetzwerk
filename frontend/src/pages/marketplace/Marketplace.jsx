import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { inventoryService } from '../../services/inventoryService';
import { messageService } from '../../services/messageService';
import { Search, Package, MapPin, MessageSquare, X, Send, Plus, Warehouse, Edit2, Trash2, ArrowRightLeft } from 'lucide-react';
import clsx from 'clsx';
import InventoryForm from '../../components/inventory/InventoryForm';
import TransferModal from '../../components/inventory/TransferModal';

export default function Marketplace() {
  const queryClient = useQueryClient();
  const location = useLocation();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('my-inventory');
  const [searchQuery, setSearchQuery] = useState('');
  const [messageModal, setMessageModal] = useState(null);
  const [messageContent, setMessageContent] = useState('');
  
  // Inventory state
  const [showInventoryForm, setShowInventoryForm] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [transferItem, setTransferItem] = useState(null);

  const { data: inventoryData, isLoading: inventoryLoading } = useQuery({
    queryKey: ['marketplace-inventory', searchQuery],
    queryFn: () => inventoryService.getAvailable({ search: searchQuery || undefined }),
  });

  const { data: myInventoryData, isLoading: myInventoryLoading } = useQuery({
    queryKey: ['my-inventory', searchQuery],
    queryFn: () => inventoryService.getAll({ search: searchQuery || undefined }),
  });

  const { data: transfersData } = useQuery({
    queryKey: ['inventory-transfers'],
    queryFn: inventoryService.getTransfers,
  });

  const sendMessageMutation = useMutation({
    mutationFn: messageService.send,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages-sent'] });
      setMessageModal(null);
      setMessageContent('');
      alert('Message sent successfully!');
    },
  });

  const deleteInventoryMutation = useMutation({
    mutationFn: inventoryService.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-inventory'] });
    },
  });

  const acceptTransferMutation = useMutation({
    mutationFn: inventoryService.acceptTransfer,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-inventory'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-transfers'] });
    },
  });

  const inventory = Array.isArray(inventoryData) ? inventoryData : [];
  const myInventory = Array.isArray(myInventoryData) ? myInventoryData : myInventoryData?.data || [];
  const transfers = Array.isArray(transfersData) ? transfersData : transfersData?.data || [];
  const pendingTransfers = transfers.filter(t => t.status === 'pending');

  // Sync tab with URL query param
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tab = params.get('tab');
    if (tab && ['my-inventory', 'inventory'].includes(tab)) {
      setActiveTab(tab);
    }
  }, [location.search]);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    const params = new URLSearchParams(location.search);
    params.set('tab', tab);
    navigate({ search: params.toString() }, { replace: true });
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!messageContent.trim()) return;
    
    sendMessageMutation.mutate({
      receiver_id: messageModal.owner_id,
      inventory_id: messageModal.inventory_id || undefined,
      subject: messageModal.subject,
      content: messageContent,
    });
  };

  const handleDeleteInventory = (id) => {
    if (window.confirm('Are you sure you want to delete this inventory item?')) {
      deleteInventoryMutation.mutate(id);
    }
  };

  const handleEditInventory = (item) => {
    setEditingItem(item);
    setShowInventoryForm(true);
  };

  const handleInventoryFormClose = () => {
    setShowInventoryForm(false);
    setEditingItem(null);
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Marketplace</h1>
          <p className="text-gray-600">Browse available materials</p>
        </div>
        
        {activeTab === 'my-inventory' && (
          <button
            onClick={() => setShowInventoryForm(true)}
            className="inline-flex items-center gap-2 bg-primary-500 text-white px-4 py-2 rounded-lg font-medium hover:bg-primary-600 transition-colors"
          >
            <Plus className="w-5 h-5" />
            Add Material
          </button>
        )}
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          placeholder="Search materials, locations..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-4 mb-6 border-b border-gray-200">
        <button
          onClick={() => handleTabChange('my-inventory')}
          className={clsx(
            'pb-3 px-1 font-medium text-sm transition-colors flex items-center gap-2',
            activeTab === 'my-inventory'
              ? 'text-primary-600 border-b-2 border-primary-600'
              : 'text-gray-500 hover:text-gray-700'
          )}
        >
          <Warehouse className="w-4 h-4" />
          My Materials ({myInventory.length})
          {pendingTransfers.length > 0 && (
            <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">
              {pendingTransfers.length}
            </span>
          )}
        </button>
        
        <button
          onClick={() => handleTabChange('inventory')}
          className={clsx(
            'pb-3 px-1 font-medium text-sm transition-colors flex items-center gap-2',
            activeTab === 'inventory'
              ? 'text-primary-600 border-b-2 border-primary-600'
              : 'text-gray-500 hover:text-gray-700'
          )}
        >
          <Package className="w-4 h-4" />
          Available Materials ({inventory.length})
        </button>
      </div>

      {/* Inventory Tab */}
      {activeTab === 'inventory' && (
        <>
          {inventoryLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full mx-auto" />
            </div>
          ) : inventory.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
              <Package className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No materials available</h3>
              <p className="text-gray-600">Check back later for available materials</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {inventory.map((item) => (
                <div
                  key={item.id}
                  className="bg-white rounded-xl shadow-sm border border-gray-200 p-4"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-gray-900">{item.material_name}</h3>
                      <p className="text-sm text-gray-500">{item.category}</p>
                    </div>
                    <div className="flex gap-1">
                      {item.available_for_transfer && (
                        <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded">Transfer</span>
                      )}
                      {item.available_for_gift && (
                        <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded">Gift</span>
                      )}
                    </div>
                  </div>
                  
                  <div className="space-y-2 mb-4">
                    <p className="text-sm text-gray-700">
                      <strong>Quantity:</strong> {item.quantity} {item.unit || item.material_unit}
                    </p>
                    {(item.location_name || item.address) && (
                      <p className="text-sm text-gray-600 flex items-start gap-1">
                        <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
                        {item.location_name || item.address}
                      </p>
                    )}
                  </div>

                  <div className="border-t border-gray-100 pt-3 flex items-center justify-between">
                    <p className="text-sm text-gray-500">
                      Owner: {item.owner_first_name || item.owner_email?.split('@')[0]}
                    </p>
                    <button
                      onClick={() => setMessageModal({
                        owner_id: item.user_id,
                        inventory_id: item.id,
                        subject: `Inquiry about ${item.material_name}`,
                        material_name: item.material_name,
                      })}
                      className="inline-flex items-center gap-1 text-primary-600 hover:text-primary-700 text-sm font-medium"
                    >
                      <MessageSquare className="w-4 h-4" />
                      Contact
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* My Inventory Tab */}
      {activeTab === 'my-inventory' && (
        <>
          {/* Pending Transfers UI */}
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
                      className="text-primary-600 hover:text-primary-700 font-medium text-sm disabled:opacity-50"
                    >
                      Accept
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {myInventoryLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full mx-auto" />
            </div>
          ) : myInventory.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
              <Warehouse className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Your inventory is empty</h3>
              <p className="text-gray-600 mb-6">Start by adding materials to your inventory</p>
              <button
                onClick={() => setShowInventoryForm(true)}
                className="inline-flex items-center gap-2 bg-primary-500 text-white px-4 py-2 rounded-lg font-medium hover:bg-primary-600 transition-colors"
              >
                <Plus className="w-5 h-5" />
                Add Inventory
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {myInventory.map((item) => (
                <div
                  key={item.id}
                  className="bg-white rounded-xl shadow-sm border border-gray-200 p-4"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-gray-900">{item.material_name}</h3>
                      <p className="text-sm text-gray-500">{item.category}</p>
                    </div>
                    <div className="flex gap-1">
                      {item.available_for_transfer && (
                        <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded">Transfer</span>
                      )}
                      {item.available_for_gift && (
                        <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded">Gift</span>
                      )}
                    </div>
                  </div>
                  
                  <div className="space-y-2 mb-4">
                    <p className="text-sm text-gray-700">
                      <strong>Quantity:</strong> {item.quantity} {item.unit}
                    </p>
                    {(item.location_name || item.address) && (
                      <p className="text-sm text-gray-600 flex items-start gap-1">
                        <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
                        {item.location_name || item.address}
                      </p>
                    )}
                  </div>

                  <div className="border-t border-gray-100 pt-3 flex gap-2">
                    <button
                      onClick={() => handleEditInventory(item)}
                      className="flex-1 inline-flex items-center justify-center gap-1 text-gray-600 hover:text-primary-600 text-sm font-medium py-1"
                    >
                      <Edit2 className="w-4 h-4" />
                      Edit
                    </button>
                    <button
                      onClick={() => setTransferItem(item)}
                      className="flex-1 inline-flex items-center justify-center gap-1 text-gray-600 hover:text-blue-600 text-sm font-medium py-1"
                    >
                      <ArrowRightLeft className="w-4 h-4" />
                      Transfer
                    </button>
                    <button
                      onClick={() => handleDeleteInventory(item.id)}
                      className="flex-1 inline-flex items-center justify-center gap-1 text-gray-600 hover:text-red-600 text-sm font-medium py-1"
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Message Modal */}
      {messageModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">Send Message</h3>
              <button
                onClick={() => setMessageModal(null)}
                className="p-2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSendMessage}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
                <input
                  type="text"
                  value={messageModal.subject}
                  readOnly
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50"
                />
              </div>
              {messageModal.material_name && (
                <div className="mb-4 p-3 bg-primary-50 rounded-lg">
                  <p className="text-sm text-primary-700">
                    <strong>Material:</strong> {messageModal.material_name}
                  </p>
                </div>
              )}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Your Message</label>
                <textarea
                  value={messageContent}
                  onChange={(e) => setMessageContent(e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                  placeholder="Hi, I'm interested in this material..."
                  required
                />
              </div>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setMessageModal(null)}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={sendMessageMutation.isPending}
                  className="inline-flex items-center gap-2 bg-primary-500 text-white px-4 py-2 rounded-lg font-medium hover:bg-primary-600 transition-colors disabled:opacity-50"
                >
                  <Send className="w-4 h-4" />
                  Send Message
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Inventory Form Modal */}
      {showInventoryForm && (
        <InventoryForm
          onClose={handleInventoryFormClose}
          editingItem={editingItem}
        />
      )}

      {/* Transfer Modal */}
      {transferItem && (
        <TransferModal
          item={transferItem}
          onClose={() => setTransferItem(null)}
        />
      )}
    </div>
  );
}
