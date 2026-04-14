import { useState, useEffect, useRef, useMemo } from 'react';
import { useAuthStore } from '../../store/authStore';
import { useAuthOverlayStore } from '../../store/authOverlayStore';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { messageService } from '../../services/messageService';
import { Mail, Send, CheckCheck, Trash2, ArrowLeft, X, Inbox } from 'lucide-react';
import clsx from 'clsx';
import IncomingRequestsPanel from '../../components/requests/IncomingRequestsPanel';

export default function Messages() {
  const queryClient = useQueryClient();
  const { user, isAuthenticated, token } = useAuthStore();
  const openAuth = useAuthOverlayStore((s) => s.open);

  const requireAuth = (onSuccess) => {
    if (isAuthenticated && token) return true;
    openAuth({
      tab: 'login',
      reason: 'Bitte logge dich ein, um Nachrichten zu sehen oder zu senden.',
      onSuccess,
    });
    return false;
  };
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [isComposing, setIsComposing] = useState(false);
  const [requestsPanelInventoryId, setRequestsPanelInventoryId] = useState(null);
  const [composeData, setComposeData] = useState({ receiver_id: '', subject: '', content: '', inventory_id: '' });
  const [replyContent, setReplyContent] = useState('');
  const messagesEndRef = useRef(null);

  const { data: inboxData, isLoading: inboxLoading } = useQuery({
    queryKey: ['messages-inbox'],
    queryFn: messageService.getInbox,
    enabled: Boolean(isAuthenticated && token),
  });

  const { data: sentData, isLoading: sentLoading } = useQuery({
    queryKey: ['messages-sent'],
    queryFn: messageService.getSent,
    enabled: Boolean(isAuthenticated && token),
  });

  const { data: unreadCount } = useQuery({
    queryKey: ['messages-unread-count'],
    queryFn: messageService.getUnreadCount,
    enabled: Boolean(isAuthenticated && token),
  });

  const { data: conversationData, isLoading: conversationLoading } = useQuery({
    queryKey: ['conversation', selectedConversation?.otherUserId],
    queryFn: () => messageService.getConversation(selectedConversation.otherUserId),
    enabled: Boolean(isAuthenticated && token && selectedConversation),
  });

  const sendMutation = useMutation({
    mutationFn: messageService.send,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages-sent'] });
      queryClient.invalidateQueries({ queryKey: ['messages-inbox'] });
      if (selectedConversation) {
        queryClient.invalidateQueries({ queryKey: ['conversation', selectedConversation.otherUserId] });
        setReplyContent('');
      } else {
        setIsComposing(false);
        setComposeData({ receiver_id: '', subject: '', content: '', inventory_id: '' });
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: messageService.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages-inbox'] });
      queryClient.invalidateQueries({ queryKey: ['messages-sent'] });
      if (selectedConversation) {
        queryClient.invalidateQueries({ queryKey: ['conversation', selectedConversation.otherUserId] });
      }
    },
  });

  const markReadMutation = useMutation({
    mutationFn: messageService.markAsRead,
    onSuccess: (updatedMessage) => {
      queryClient.setQueryData(['messages-inbox'], (existing) => {
        if (!Array.isArray(existing)) return existing;
        return existing.map((msg) => (msg.id === updatedMessage.id ? { ...msg, is_read: 1 } : msg));
      });
      queryClient.invalidateQueries({ queryKey: ['messages-unread-count'] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: messageService.markAllAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages-inbox'] });
      queryClient.invalidateQueries({ queryKey: ['messages-unread-count'] });
    },
  });

  const inbox = Array.isArray(inboxData) ? inboxData : [];
  const sent = Array.isArray(sentData) ? sentData : [];
  const allMessages = [...inbox, ...sent].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  const isLoading = inboxLoading || sentLoading;
  const conversation = Array.isArray(conversationData) ? conversationData : [];

  // Group messages by conversation partner
  const conversations = useMemo(() => {
    const conversationMap = new Map();
    
    allMessages.forEach(message => {
      const otherUserId = message.receiver_id === user?.id ? message.sender_id : message.receiver_id;
      
      if (!conversationMap.has(otherUserId)) {
        // Get other user info
        const otherUserName = message.receiver_id === user?.id 
          ? `${message.sender_first_name || ''} ${message.sender_last_name || ''}`.trim() || message.sender_email
          : `${message.receiver_first_name || ''} ${message.receiver_last_name || ''}`.trim() || message.receiver_email;
        
        // Count unread messages in this conversation
        const unreadCount = allMessages.filter(msg => 
          msg.sender_id === otherUserId && 
          msg.receiver_id === user?.id && 
          !msg.is_read
        ).length;
        
        conversationMap.set(otherUserId, {
          otherUserId,
          otherUserName,
          latestMessage: message,
          unreadCount,
          lastMessageDate: new Date(message.created_at)
        });
      }
    });
    
    return Array.from(conversationMap.values()).sort((a, b) => 
      b.lastMessageDate - a.lastMessageDate
    );
  }, [allMessages, user?.id]);

  // Scroll to bottom when conversation loads or new message arrives
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversation]);

  // Invalidate queries when conversation loads to update read status in list
  useEffect(() => {
    if (selectedConversation && !conversationLoading && conversation.length > 0) {
      // Small delay to allow backend to mark messages as read
      const timer = setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['messages-inbox'] });
        queryClient.invalidateQueries({ queryKey: ['messages-unread-count'] });
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [selectedConversation, conversationLoading, conversation.length, queryClient]);

  const handleSelectMessage = (otherUserId, otherUserName) => {
    setSelectedConversation({ otherUserId, otherUserName });
  };

  const handleSendReply = (e) => {
    e.preventDefault();
    if (!replyContent.trim()) return;
    sendMutation.mutate({
      receiver_id: selectedConversation.otherUserId,
      content: replyContent,
    });
  };

  const handleSend = (e) => {
    e.preventDefault();
    if (!composeData.receiver_id || !composeData.content) return;
    sendMutation.mutate(composeData);
  };

  // Conversation View
  if (selectedConversation) {
    return (
      <div className="flex flex-col h-[calc(100vh-8rem)]">
        <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSelectedConversation(null)}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <h2 className="text-xl font-bold text-gray-900">{selectedConversation.otherUserName}</h2>
              <p className="text-sm text-gray-500">Conversation</p>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto mb-4 space-y-4">
          {conversationLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full mx-auto" />
            </div>
          ) : conversation.length === 0 ? (
            <div className="text-center py-12">
              <Mail className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600">No messages yet</p>
            </div>
          ) : (
            <>
              {conversation.map((message) => {
                const isFromMe = message.sender_id === user?.id;
                return (
                  <div
                    key={message.id}
                    className={clsx('flex', isFromMe ? 'justify-end' : 'justify-start')}
                  >
                    <div className={clsx('max-w-[70%] rounded-lg p-4', isFromMe ? 'bg-primary-500 text-white' : 'bg-gray-100 text-gray-900')}>
                      {message.subject && (
                        <p className={clsx('font-semibold mb-2', isFromMe ? 'text-white' : 'text-gray-900')}>
                          {message.subject}
                        </p>
                      )}
                      {message.inventory_id && !isFromMe && (
                        <button
                          onClick={() => setRequestsPanelInventoryId(message.inventory_id)}
                          className="mb-2 inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-300 text-gray-700 text-xs font-semibold rounded-lg hover:bg-gray-50 transition-colors"
                        >
                          <Inbox className="w-3.5 h-3.5" />
                          Anfrage verwalten
                        </button>
                      )}
                      <p className="whitespace-pre-wrap">{message.content}</p>
                      <p className={clsx('text-xs mt-2', isFromMe ? 'text-primary-100' : 'text-gray-500')}>
                        {new Date(message.created_at).toLocaleString('de-DE')}
                      </p>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Reply Form */}
        <form onSubmit={handleSendReply} className="border-t border-gray-200 pt-4">
          <div className="flex gap-2">
            <textarea
              value={replyContent}
              onChange={(e) => setReplyContent(e.target.value)}
              rows={3}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none resize-none"
              placeholder="Type your message..."
              required
            />
            <button
              type="submit"
              disabled={sendMutation.isPending || !replyContent.trim()}
              className="self-end bg-primary-500 text-white px-6 py-2 rounded-lg font-medium hover:bg-primary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </form>
      </div>
    );
  }

  // Compose View
  if (isComposing) {
    return (
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900">New Message</h2>
          <button
            onClick={() => setIsComposing(false)}
            className="p-2 text-gray-400 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSend} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Recipient ID</label>
            <input
              type="text"
              value={composeData.receiver_id}
              onChange={(e) => setComposeData({ ...composeData, receiver_id: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
              placeholder="User ID (from marketplace)"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
            <input
              type="text"
              value={composeData.subject}
              onChange={(e) => setComposeData({ ...composeData, subject: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
              placeholder="Subject (optional)"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Inventory ID (optional)</label>
            <input
              type="text"
              value={composeData.inventory_id}
              onChange={(e) => setComposeData({ ...composeData, inventory_id: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
              placeholder="Link to specific inventory item"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
            <textarea
              value={composeData.content}
              onChange={(e) => setComposeData({ ...composeData, content: e.target.value })}
              rows={6}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
              placeholder="Your message..."
              required
            />
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={sendMutation.isPending}
              className="inline-flex items-center gap-2 bg-primary-500 text-white px-6 py-2 rounded-lg font-medium hover:bg-primary-600 transition-colors disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              Send
            </button>
          </div>
        </form>
      </div>
    );
  }

  // Guests: show read-only placeholder (no auto-redirect). Login is required to view/send messages.
  if (!isAuthenticated || !token) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-primary-50 flex items-center justify-center">
            <Mail className="w-6 h-6 text-primary-700" />
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-semibold text-gray-900">Nachrichten</h1>
            <p className="text-gray-600 mt-1">
              Um Nachrichten zu lesen oder zu senden, musst du eingeloggt sein.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() =>
                  openAuth({
                    tab: 'login',
                    reason: 'Bitte logge dich ein, um Nachrichten zu lesen oder zu senden.',
                  })
                }
                className="inline-flex items-center justify-center rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                Login
              </button>
              <button
                type="button"
                onClick={() =>
                  openAuth({
                    tab: 'register',
                    reason: 'Erstelle einen Account, um Nachrichten zu lesen oder zu senden.',
                  })
                }
                className="inline-flex items-center justify-center rounded-lg bg-primary-500 px-4 py-2 text-sm text-white hover:bg-primary-600"
              >
                Registrieren
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // List View
  return (
    <>
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Messages</h1>
          <p className="text-gray-600">Communicate with other users about materials</p>
        </div>
        <div className="flex gap-2">
          {unreadCount?.count > 0 && (
            <button
              onClick={() => markAllReadMutation.mutate()}
              className="inline-flex items-center gap-2 bg-gray-100 text-gray-700 px-4 py-2 rounded-lg font-medium hover:bg-gray-200 transition-colors"
            >
              <CheckCheck className="w-5 h-5" />
              Mark All Read
            </button>
          )}
          <button
            onClick={() => setIsComposing(true)}
            className="inline-flex items-center gap-2 bg-primary-500 text-white px-4 py-2 rounded-lg font-medium hover:bg-primary-600 transition-colors"
          >
            <Mail className="w-5 h-5" />
            Compose
          </button>
        </div>
      </div>

      {/* Message List */}
      {isLoading ? (
        <div className="text-center py-12">
          <div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full mx-auto" />
        </div>
      ) : conversations.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
          <Mail className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No messages</h3>
          <p className="text-gray-600">You don't have any messages yet</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 divide-y divide-gray-200">
          {conversations.map((conv) => {
            const latestMsg = conv.latestMessage;
            const isUnread = conv.unreadCount > 0;
            const isFromMe = latestMsg.sender_id === user?.id;

            return (
              <div
                key={conv.otherUserId}
                onClick={() => handleSelectMessage(conv.otherUserId, conv.otherUserName)}
                className={clsx(
                  'p-4 cursor-pointer hover:bg-gray-50 transition-colors',
                  isUnread && 'bg-primary-100 border-l-4 border-primary-500'
                )}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className={clsx('text-sm font-medium', isUnread && 'font-bold text-primary-900')}>
                        {conv.otherUserName}
                      </p>
                      {isUnread && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary-200 text-primary-700 text-xs rounded-full font-semibold">
                          {conv.unreadCount} unread
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-900 truncate font-medium">
                      {latestMsg.subject || '(No Subject)'}
                    </p>
                    <p className="text-sm text-gray-600 truncate">
                      {isFromMe && <span className="text-gray-500">You: </span>}
                      {latestMsg.content}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className="text-xs text-gray-400 whitespace-nowrap">
                      {new Date(latestMsg.created_at).toLocaleDateString()}
                    </span>
                    <span className="text-xs text-gray-500">
                      {new Date(latestMsg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
                {latestMsg.material_name && (
                  <span className="inline-block mt-2 px-2 py-1 bg-primary-100 text-primary-700 text-xs rounded">
                    {latestMsg.material_name}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>

      {requestsPanelInventoryId && (
        <IncomingRequestsPanel
          initialInventoryId={requestsPanelInventoryId}
          onClose={() => setRequestsPanelInventoryId(null)}
        />
      )}
    </>
  );
}
