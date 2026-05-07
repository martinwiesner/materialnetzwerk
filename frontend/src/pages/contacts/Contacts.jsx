import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { relationshipService } from '../../services/relationshipService';
import { Search, UserPlus, Check, X, Users, Trash2 } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';

export default function Contacts() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  const { data: contactsData, isLoading } = useQuery({
    queryKey: ['contacts', user?.id],
    queryFn: relationshipService.getContacts,
    enabled: !!user?.id,
  });

  const { data: pendingData } = useQuery({
    queryKey: ['relationships-pending', user?.id],
    queryFn: relationshipService.getPending,
    enabled: !!user?.id,
  });

  const { data: searchResults } = useQuery({
    queryKey: ['user-search', searchQuery],
    queryFn: () => relationshipService.search(searchQuery),
    enabled: searchQuery.length >= 2,
  });

  const addContactMutation = useMutation({
    mutationFn: relationshipService.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      queryClient.invalidateQueries({ queryKey: ['relationships-pending'] });
      setSearchQuery('');
      setIsSearching(false);
    },
  });

  const acceptMutation = useMutation({
    mutationFn: relationshipService.accept,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      queryClient.invalidateQueries({ queryKey: ['relationships-pending'] });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: relationshipService.reject,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['relationships-pending'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: relationshipService.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
    },
  });

  const contacts = Array.isArray(contactsData) ? contactsData : contactsData?.data || [];
  const pending = Array.isArray(pendingData) ? pendingData : pendingData?.data || [];
  const searchUsers = Array.isArray(searchResults) ? searchResults : searchResults?.data || [];

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Contacts</h1>
          <p className="text-gray-600">Manage your network for material sharing</p>
        </div>
        <button
          onClick={() => setIsSearching(true)}
          className="inline-flex items-center gap-2 bg-primary-500 text-white px-4 py-2 rounded-lg font-medium hover:bg-primary-600 transition-colors"
        >
          <UserPlus className="w-5 h-5" />
          Add Contact
        </button>
      </div>

      {/* Add Contact Search */}
      {isSearching && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-medium text-gray-900">Find Users</h3>
            <button
              onClick={() => {
                setIsSearching(false);
                setSearchQuery('');
              }}
              className="p-1 text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by username or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
              autoFocus
            />
          </div>
          {searchQuery.length >= 2 && (
            <div className="mt-3 space-y-2">
              {searchUsers.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">No users found</p>
              ) : (
                searchUsers.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div>
                      <span className="font-medium text-gray-900">
                         {user.first_name || user.last_name 
                           ? `${user.first_name || ''} ${user.last_name || ''}`.trim() 
                           : user.email.split('@')[0]}
                      </span>
                      <p className="text-sm text-gray-500">{user.email}</p>
                    </div>
                    <button
                      onClick={() => addContactMutation.mutate(user.id)}
                      disabled={addContactMutation.isPending}
                      className="px-3 py-1 bg-primary-500 text-white text-sm rounded-lg hover:bg-primary-600 transition-colors disabled:opacity-50"
                    >
                      Add
                    </button>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}

      {/* Pending Requests */}
      {pending.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-6">
          <h3 className="font-medium text-yellow-800 mb-3">
            Pending Requests ({pending.length})
          </h3>
          <div className="space-y-2">
            {pending.map((request) => (
              <div
                key={request.id}
                className="flex items-center justify-between bg-white rounded-lg p-3 border border-yellow-200"
              >
                <div>
                  <span className="font-medium">
                    {request.requester_first_name 
                      ? `${request.requester_first_name} ${request.requester_last_name || ''}`.trim()
                      : request.requester_email?.split('@')[0]}
                  </span>
                  <p className="text-sm text-gray-500">{request.requester_email}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => acceptMutation.mutate(request.id)}
                    disabled={acceptMutation.isPending}
                    className="p-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => rejectMutation.mutate(request.id)}
                    disabled={rejectMutation.isPending}
                    className="p-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Contacts List */}
      {isLoading ? (
        <div className="text-center py-12">
          <div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full mx-auto" />
        </div>
      ) : contacts.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
          <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No contacts yet</h3>
          <p className="text-gray-600 mb-4">Add contacts to share materials</p>
          <button
            onClick={() => setIsSearching(true)}
            className="inline-flex items-center gap-2 bg-primary-500 text-white px-4 py-2 rounded-lg font-medium hover:bg-primary-600 transition-colors"
          >
            <UserPlus className="w-5 h-5" />
            Add Contact
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {contacts.map((contact) => (
            <div
              key={contact.contact_id || contact.id}
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-4"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
                    <span className="text-primary-700 font-medium">
                      {contact.contact_first_name?.[0] || contact.contact_email?.[0] || 'U'}
                    </span>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">
                      {contact.contact_first_name 
                        ? `${contact.contact_first_name} ${contact.contact_last_name || ''}` 
                        : contact.contact_email?.split('@')[0]}
                    </p>
                    <p className="text-sm text-gray-500">{contact.contact_email}</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    if (window.confirm('Remove this contact?')) {
                      deleteMutation.mutate(contact.relationship_id);
                    }
                  }}
                  className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
