import React, { useState, useEffect, useRef } from 'react';
import { Send, Loader, Trash2, ChevronDown, Users } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebase/config';
import {
  collection,
  addDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  or,
  and,
  deleteDoc,
  doc,
  getDocs,
  getDoc
} from 'firebase/firestore';

const Chat = () => {
  const { user, getPartner } = useAuth();
  const defaultPartner = getPartner();
  const [selectedPartner, setSelectedPartner] = useState(null);
  const [allPartners, setAllPartners] = useState([]);
  const [showPartnerDropdown, setShowPartnerDropdown] = useState(false);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [messageType, setMessageType] = useState('message');
  const [loading, setLoading] = useState(true);
  const [loadingPartners, setLoadingPartners] = useState(true);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [messageToDelete, setMessageToDelete] = useState(null);
  const [showAlertModal, setShowAlertModal] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');
  const messagesEndRef = useRef(null);
  const listenerRef = useRef(null); // Track listener to avoid duplicates
  const dropdownRef = useRef(null);

  // Load all partners/friends who have messages with the user
  useEffect(() => {
    if (!user) return;

    const fetchAllPartners = async () => {
      try {
        setLoadingPartners(true);
        const messagesRef = collection(db, 'messages');
        
        // Get all messages where user is sender or receiver
        const sentQuery = query(messagesRef, where('senderId', '==', user.id));
        const receivedQuery = query(messagesRef, where('receiverId', '==', user.id));
        
        const [sentSnapshot, receivedSnapshot] = await Promise.all([
          getDocs(sentQuery),
          getDocs(receivedQuery)
        ]);

        // Collect unique partner IDs
        const partnerIds = new Set();
        
        sentSnapshot.docs.forEach(doc => {
          const data = doc.data();
          if (data.receiverId !== user.id) {
            partnerIds.add(data.receiverId);
          }
        });
        
        receivedSnapshot.docs.forEach(doc => {
          const data = doc.data();
          if (data.senderId !== user.id) {
            partnerIds.add(data.senderId);
          }
        });

        // Add default partner if exists
        if (defaultPartner && !partnerIds.has(defaultPartner.id)) {
          partnerIds.add(defaultPartner.id);
        }

        // Fetch partner details
        const partnersData = [];
        for (const partnerId of partnerIds) {
          try {
            const partnerDoc = await getDoc(doc(db, 'users', partnerId));
            if (partnerDoc.exists()) {
              partnersData.push({
                id: partnerDoc.id,
                ...partnerDoc.data()
              });
            }
          } catch (error) {
            console.error('Error fetching partner:', partnerId, error);
          }
        }

        setAllPartners(partnersData);
        
        // Set default selected partner
        if (partnersData.length > 0) {
          // Prefer the default partner from context, or first available
          const preferred = defaultPartner && partnersData.find(p => p.id === defaultPartner.id);
          setSelectedPartner(preferred || partnersData[0]);
        }
      } catch (error) {
        console.error('Error loading partners:', error);
      } finally {
        setLoadingPartners(false);
      }
    };

    fetchAllPartners();
  }, [user, defaultPartner]);

  // Auto-scroll to bottom when new messages arrive
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowPartnerDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Real-time message listener - MOST RELIABLE VERSION (No complex queries)
  useEffect(() => {
    if (!user || !selectedPartner) {
      setLoading(false);
      return;
    }

    // Clean up previous listener if exists
    if (listenerRef.current) {
      listenerRef.current();
      listenerRef.current = null;
    }

    setLoading(true);

    const messagesRef = collection(db, 'messages');
    
    // Listen to ALL messages collection (no complex queries that cause internal errors)
    // We'll filter client-side for this specific conversation
    const q = query(messagesRef, orderBy('createdAt', 'asc'));

    try {
      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          // Filter to only messages in this conversation
          const conversationMessages = [];
          
          snapshot.docs.forEach(doc => {
            const data = doc.data();
            const msg = {
              id: doc.id,
              ...data,
              createdAt: data.createdAt?.toDate() || new Date()
            };
            
            // Check if this message is part of the conversation
            const isSentByMe = msg.senderId === user.id && msg.receiverId === selectedPartner.id;
            const isReceivedFromPartner = msg.senderId === selectedPartner.id && msg.receiverId === user.id;
            
            if (isSentByMe || isReceivedFromPartner) {
              conversationMessages.push(msg);
            }
          });
          
          setMessages(conversationMessages);
          setLoading(false);
          
          setTimeout(() => scrollToBottom(), 100);
        },
        (error) => {
          console.error('Message listener error:', error);
          setLoading(false);
        }
      );

      listenerRef.current = unsubscribe;
      
    } catch (error) {
      console.error('Error setting up listener:', error);
      setLoading(false);
    }

    return () => {
      console.log('🔌 Unmounting - cleaning up listener');
      if (listenerRef.current) {
        listenerRef.current();
        listenerRef.current = null;
      }
    };
  }, [user?.id, selectedPartner?.id]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !user || !selectedPartner) return;

    const messageText = newMessage.trim();
    setNewMessage(''); // Clear input immediately

    console.log('📤 SENDING MESSAGE:', messageText);
    console.log('👤 From:', user.id, '(' + user.name + ')');
    console.log('👥 To:', selectedPartner.id, '(' + selectedPartner.name + ')');
    console.log('⏰ Time:', new Date().toLocaleTimeString());

    // Optimistic UI - add message immediately
    const tempMessage = {
      id: 'temp_' + Date.now(),
      senderId: user.id,
      senderName: user.name,
      receiverId: selectedPartner.id,
      receiverName: selectedPartner.name,
      message: messageText,
      type: messageType,
      createdAt: new Date(),
      isPending: true
    };

    setMessages(prev => [...prev, tempMessage]);
    setTimeout(() => scrollToBottom(), 50);

    try {
      const messageData = {
        senderId: user.id,
        senderName: user.name,
        receiverId: selectedPartner.id,
        receiverName: selectedPartner.name,
        message: messageText,
        type: messageType,
        createdAt: serverTimestamp()
      };

      console.log('📝 Sending message with data:');
      console.log('   senderId:', messageData.senderId, '(' + messageData.senderName + ')');
      console.log('   receiverId:', messageData.receiverId, '(' + messageData.receiverName + ')');
      console.log('   message:', messageData.message);
      console.log('   type:', messageData.type);
      
      const docRef = await addDoc(collection(db, 'messages'), messageData);
      console.log('✅ MESSAGE SAVED TO FIRESTORE!');
      console.log('🆔 Document ID:', docRef.id);
      console.log('⏰ Saved at:', new Date().toLocaleTimeString());
      
      // Replace temp message with real one immediately
      setMessages(prev => prev.map(msg => 
        msg.id === tempMessage.id 
          ? { ...tempMessage, id: docRef.id, isPending: false }
          : msg
      ));
      
      console.log('✅ Message displayed in UI');
      
    } catch (error) {
      console.error('❌ SEND MESSAGE ERROR:', error);
      console.error('Error code:', error.code);
      console.error('Error message:', error.message);
      console.error('Full error:', error);
      
      // Remove temp message on error
      setMessages(prev => prev.filter(msg => msg.id !== tempMessage.id));
      setNewMessage(messageText);
      setAlertMessage('Failed to send message: ' + error.message);
      setShowAlertModal(true);
    }
  };

  const handleDeleteMessage = (messageId) => {
    setMessageToDelete(messageId);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!messageToDelete) return;

    try {
      console.log('🗑️ Deleting message:', messageToDelete);
      
      // Remove from UI immediately
      setMessages(prev => prev.filter(msg => msg.id !== messageToDelete));
      
      // Delete from Firestore
      await deleteDoc(doc(db, 'messages', messageToDelete));
      console.log('✅ Message deleted from Firestore');
      
      setShowDeleteModal(false);
      setMessageToDelete(null);
    } catch (error) {
      console.error('❌ Delete message error:', error);
      // Refresh messages to restore if delete failed
      // The onSnapshot listener will restore it
      setShowDeleteModal(false);
      setMessageToDelete(null);
    }
  };

  const cancelDelete = () => {
    setShowDeleteModal(false);
    setMessageToDelete(null);
  };

  const getMessageStyle = (type) => {
    switch (type) {
      case 'achievement':
        return 'border-l-4 border-green-500 bg-green-900/20';
      case 'update':
        return 'border-l-4 border-blue-500 bg-blue-900/20';
      default:
        return '';
    }
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case 'achievement':
        return '🎉';
      case 'update':
        return '📢';
      default:
        return '';
    }
  };

  const formatTime = (date) => {
    if (!date) return '';
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (date) => {
    if (!date) return '';
    const today = new Date();
    const messageDate = new Date(date);
    
    if (messageDate.toDateString() === today.toDateString()) {
      return 'Today';
    }
    
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (messageDate.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    }
    
    return messageDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // Group messages by date
  const groupMessagesByDate = (messages) => {
    const groups = {};
    messages.forEach(msg => {
      const dateKey = formatDate(msg.createdAt);
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(msg);
    });
    return groups;
  };

  const messageGroups = groupMessagesByDate(messages);

  if (loadingPartners) {
    return (
      <div className="h-full flex flex-col">
        <div className="mb-4">
          <h2 className="text-2xl font-bold text-white mb-2">Daily Chat</h2>
          <p className="text-gray-400">Loading your conversations...</p>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <Loader className="animate-spin text-indigo-400" size={48} />
        </div>
      </div>
    );
  }

  if (!selectedPartner || allPartners.length === 0) {
    return (
      <div className="h-full flex flex-col">
        <div className="mb-4">
          <h2 className="text-2xl font-bold text-white mb-2">Daily Chat</h2>
          <p className="text-gray-400">Share your progress and stay connected</p>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center max-w-md">
            <div className="w-16 h-16 rounded-full bg-gray-800 mx-auto mb-4 flex items-center justify-center">
              <Send size={32} className="text-gray-600" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">No Conversations Yet</h3>
            <p className="text-gray-400 mb-6">Connect with a partner to start chatting</p>
            <button 
              onClick={() => window.location.href = '/?page=partner'}
              className="inline-block bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg transition"
            >
              Find Partner
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white mb-2">Daily Chat</h2>
          <p className="text-gray-400">
            Chatting with <span className="text-white font-semibold">{selectedPartner.name}</span>
          </p>
        </div>
        
        {/* Partner Switcher Dropdown */}
        {allPartners.length > 1 && (
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setShowPartnerDropdown(!showPartnerDropdown)}
              className="flex items-center gap-2 px-4 py-2 bg-gray-900 border border-gray-800 rounded-lg hover:border-gray-700 transition-colors"
            >
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-600 to-blue-600 flex items-center justify-center text-white text-sm font-semibold">
                {selectedPartner.name?.[0]?.toUpperCase() || 'P'}
              </div>
              <div className="text-left">
                <div className="text-white font-semibold text-sm">{selectedPartner.name}</div>
                <div className="text-gray-400 text-xs">{selectedPartner.email}</div>
              </div>
              <ChevronDown size={16} className={`text-gray-400 transition-transform ${showPartnerDropdown ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown Menu */}
            {showPartnerDropdown && (
              <div className="absolute right-0 top-full mt-2 w-64 bg-gray-900 border border-gray-800 rounded-lg shadow-xl z-50 max-h-96 overflow-y-auto">
                <div className="p-2">
                  <div className="px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wide flex items-center gap-2">
                    <Users size={14} />
                    Your Conversations ({allPartners.length})
                  </div>
                  {allPartners.map((partner) => (
                    <button
                      key={partner.id}
                      onClick={() => {
                        setSelectedPartner(partner);
                        setShowPartnerDropdown(false);
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                        selectedPartner.id === partner.id
                          ? 'bg-indigo-600 text-white'
                          : 'hover:bg-gray-800 text-gray-300'
                      }`}
                    >
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-semibold ${
                        selectedPartner.id === partner.id
                          ? 'bg-white/20'
                          : 'bg-gradient-to-br from-cyan-600 to-blue-600'
                      }`}>
                        {partner.name?.[0]?.toUpperCase() || 'P'}
                      </div>
                      <div className="text-left flex-1">
                        <div className="font-semibold text-sm">{partner.name}</div>
                        <div className={`text-xs ${selectedPartner.id === partner.id ? 'text-indigo-200' : 'text-gray-500'}`}>
                          {partner.email}
                        </div>
                      </div>
                      {selectedPartner.id === partner.id && (
                        <div className="w-2 h-2 rounded-full bg-white"></div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex-1 max-w-5xl w-full mx-auto flex flex-col min-h-0">
        <div className="bg-gray-900 border border-gray-800 rounded-xl flex flex-col flex-1">
            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 min-h-0">
              {loading ? (
                <div className="flex items-center justify-center h-full">
                  <Loader className="animate-spin text-indigo-400" size={32} />
                </div>
              ) : messages.length === 0 ? (
                <div className="flex items-center justify-center h-full text-gray-500">
                  <div className="text-center">
                    <Send size={48} className="mx-auto mb-4 opacity-30" />
                    <p>No messages yet. Start the conversation!</p>
                  </div>
                </div>
              ) : (
                Object.entries(messageGroups).map(([date, msgs]) => (
                  <div key={date}>
                    {/* Date Separator */}
                    <div className="flex items-center justify-center my-4">
                      <div className="bg-gray-800 text-gray-400 text-xs px-3 py-1 rounded-full">
                        {date}
                      </div>
                    </div>

                    {/* Messages for this date */}
                    {msgs.map((msg) => (
                      <div key={msg.id} className={`flex ${msg.senderId === user.id ? 'justify-end' : 'justify-start'} mb-4 group`}>
                        <div className={`max-w-md ${msg.senderId === user.id ? 'order-2' : 'order-1'}`}>
                          <div className="flex items-center gap-2 mb-1">
                            {msg.senderId !== user.id && (
                              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-cyan-600 to-blue-600 flex items-center justify-center text-white text-xs font-semibold">
                                {selectedPartner.name?.[0]?.toUpperCase() || 'P'}
                              </div>
                            )}
                            <span className="text-sm text-gray-400 font-medium">
                              {msg.senderId === user.id ? 'You' : selectedPartner.name}
                            </span>
                            <span className="text-xs text-gray-500">{formatTime(msg.createdAt)}</span>
                            {msg.senderId === user.id && !msg.isPending && (
                              <button
                                onClick={() => handleDeleteMessage(msg.id)}
                                className="opacity-0 group-hover:opacity-100 transition-opacity text-red-400 hover:text-red-300 p-1"
                                title="Delete message"
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                          <div className={`p-4 rounded-lg ${
                            msg.senderId === user.id ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-100'
                          } ${getMessageStyle(msg.type)} ${msg.isPending ? 'opacity-70' : ''}`}>
                            {getTypeIcon(msg.type) && <span className="mr-2">{getTypeIcon(msg.type)}</span>}
                            {msg.message}
                            {msg.isPending && <span className="ml-2 text-xs opacity-50">⏳</span>}
                          </div>
                        </div>
                        {msg.senderId === user.id && (
                          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center text-white text-xs font-semibold ml-2 order-3">
                            {user.name?.[0]?.toUpperCase() || 'Y'}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Message Input - Fixed at bottom */}
            <div className="border-t border-gray-800 p-4 flex-shrink-0 bg-gray-900">
              <form onSubmit={handleSendMessage} className="space-y-3">
                <div className="flex gap-2">
                  <button 
                    type="button" 
                    onClick={() => setMessageType('message')} 
                    className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${messageType === 'message' ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
                  >
                    Message
                  </button>
                  <button 
                    type="button" 
                    onClick={() => setMessageType('update')} 
                    className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${messageType === 'update' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
                  >
                    📢 Update
                  </button>
                  <button 
                    type="button" 
                    onClick={() => setMessageType('achievement')} 
                    className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${messageType === 'achievement' ? 'bg-green-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
                  >
                    🎉 Achievement
                  </button>
                </div>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    value={newMessage} 
                    onChange={(e) => setNewMessage(e.target.value)} 
                    placeholder="Type your message..." 
                    className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-600" 
                  />
                  <button 
                    type="submit" 
                    disabled={!newMessage.trim()}
                    className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white px-6 py-3 rounded-lg transition-colors flex items-center gap-2"
                  >
                    <Send size={20} />
                  </button>
                </div>
              </form>
            </div>
          </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={cancelDelete}>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-xl font-bold text-white mb-3">Delete Message?</h3>
            <p className="text-gray-400 mb-6">
              Are you sure you want to delete this message? This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={cancelDelete}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Alert Modal */}
      {showAlertModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={() => setShowAlertModal(false)}>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-xl font-bold text-red-400 mb-3">Error</h3>
            <p className="text-gray-300 mb-6">{alertMessage}</p>
            <button
              onClick={() => setShowAlertModal(false)}
              className="w-full px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
            >
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Chat;
