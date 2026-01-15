import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import Profile from './Profile';
import './ChatInterface.css';

const ChatInterface = ({ user, onLogout, onUpdateProfile }) => {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const activeUsersKey = `activeUsers_${roomId}`;
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [activeUsers, setActiveUsers] = useState([]);
  const [roomInfo, setRoomInfo] = useState(null);
  const [isTyping, setIsTyping] = useState(false);
  const [typingUsers, setTypingUsers] = useState([]);
  const [openMenuId, setOpenMenuId] = useState(null);
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [isMobileUsersView, setIsMobileUsersView] = useState(false);
  const [userMenuId, setUserMenuId] = useState(null);
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editedContent, setEditedContent] = useState('');
  const [messageMenuId, setMessageMenuId] = useState(null);
  const [showProfile, setShowProfile] = useState(false);
  const [joinRequests, setJoinRequests] = useState([]);
  const [showJoinRequests, setShowJoinRequests] = useState(false);
  const socketRef = useRef(null);

  // Mock room data
  const mockRooms = useMemo(() => ({
    '1': { id: '1', name: 'General Discussion', description: 'General topics and conversations' },
    '2': { id: '2', name: 'Tech Talk', description: 'Discuss latest in technology' },
    '3': { id: '3', name: 'Random Chat', description: 'Talk about anything!' },
    '4': { id: '4', name: 'Gaming Zone', description: 'For all gaming enthusiasts' }
  }), []);

  // Mock users
  const mockUsers = useMemo(() => [
    { id: '1', username: 'Alice', status: 'online' },
    { id: '2', username: 'Bob', status: 'online' },
    { id: '3', username: 'Charlie', status: 'online' },
    { id: '4', username: 'Diana', status: 'online' },
    { id: '5', username: 'Eve', status: 'online' }
  ], []);

  useEffect(() => {
    // Load room info
    const customRooms = localStorage.getItem('customChatrooms');
    let room = mockRooms[roomId];

    if (!room && customRooms) {
      const parsedRooms = JSON.parse(customRooms);
      room = parsedRooms.find(r => r.id === roomId);
    }

    if (room) {
      setRoomInfo(room);
    } else {
      // Fallback: fetch from backend (rooms created via server)
      fetch('http://localhost:4000/api/chatrooms')
        .then(res => res.ok ? res.json() : [])
        .then(data => {
          if (!Array.isArray(data)) return;
          const found = data.find(r => String(r.id) === String(roomId));
          if (found) {
            setRoomInfo(found);
          }
        })
        .catch(err => {
          console.error('Error fetching room info:', err);
        });
    }

    // Set active users (load saved or default) and ensure current user is included
    const savedActive = localStorage.getItem(activeUsersKey);
    let initialActiveUsers = savedActive
      ? JSON.parse(savedActive)
      : [{ ...user, status: 'online' }, ...mockUsers];

    const alreadyPresent = initialActiveUsers.some(u => u.id === user.id);
    if (!alreadyPresent) {
      initialActiveUsers = [...initialActiveUsers, { ...user, status: 'online' }];
    }

    setActiveUsers(initialActiveUsers);
    localStorage.setItem(activeUsersKey, JSON.stringify(initialActiveUsers));

    // Load messages from localStorage or use mock messages
    const messagesKey = `chatMessages_${roomId}`;
    const savedMessages = localStorage.getItem(messagesKey);

    let initialMessages;
    if (savedMessages) {
      initialMessages = JSON.parse(savedMessages).map(msg => ({
        ...msg,
        timestamp: new Date(msg.timestamp)
      }));
    } else {
      // Load mock messages only if no saved messages
      initialMessages = [
        {
          id: '1',
          user: { id: '1', username: 'Alice' },
          content: 'Hey everyone! 👋',
          timestamp: new Date(Date.now() - 300000)
        },
        {
          id: '2',
          user: { id: '2', username: 'Bob' },
          content: 'Hello! How is everyone doing?',
          timestamp: new Date(Date.now() - 240000)
        },
        {
          id: '3',
          user: { id: '3', username: 'Charlie' },
          content: 'Pretty good! Just working on some projects.',
          timestamp: new Date(Date.now() - 180000)
        },
        {
          id: '4',
          user: { id: '1', username: 'Alice' },
          content: 'That sounds interesting! What kind of projects?',
          timestamp: new Date(Date.now() - 120000)
        },
        {
          id: '5',
          user: { id: '4', username: 'Diana' },
          content: 'Welcome to the chatroom! 🎉',
          timestamp: new Date(Date.now() - 60000)
        }
      ];
    }

    setMessages(initialMessages);

    // Mark room as joined; show join message when coming from Join, suppress for Open
    try {
      const keyCurrent = `joinedRooms_${user.id}`;
      const current = JSON.parse(localStorage.getItem(keyCurrent) || '[]');
      const isOwner = room?.createdBy === user.username;
      const isAlreadyJoined = current.includes(roomId) || isOwner;

      if (!isAlreadyJoined) {
        const updatedCurrent = [...current, roomId];
        localStorage.setItem(keyCurrent, JSON.stringify(updatedCurrent));
      }
    } catch (_) { }

    // NOTE: system join messages are now broadcast by the Socket.IO server

    // Typing indicators are now driven by Socket.IO events, not random simulation
    return () => {};
  }, [roomId, activeUsersKey, mockRooms, mockUsers, user]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Real-time messaging: connect to Socket.IO server
  useEffect(() => {
    const socket = io('http://localhost:4000');
    socketRef.current = socket;

    // Join the current room with user info
    socket.emit('joinRoom', { roomId, user });

    // Request existing messages for this room
    socket.emit('getMessages', { roomId });

    // Receive chat messages
    socket.on('message', (message) => {
      setMessages((prev) => {
        const updated = [
          ...prev,
          {
            ...message,
            timestamp: new Date(message.timestamp)
          }
        ];
        const messagesKey = `chatMessages_${roomId}`;
        localStorage.setItem(messagesKey, JSON.stringify(updated));
        return updated;
      });
    });

    // Initial message history from database
    socket.on('messages', (dbMessages) => {
      const normalized = (dbMessages || []).map((m) => ({
        id: m.id,
        user: m.isSystem
          ? { id: 'system', username: 'System' }
          : { id: m.userId, username: m.username },
        content: m.content,
        timestamp: new Date(m.createdAt),
        isSystem: !!m.isSystem
      }));

      setMessages(normalized);

      const messagesKey = `chatMessages_${roomId}`;
      localStorage.setItem(messagesKey, JSON.stringify(normalized));
    });

    // Receive system messages (join/leave)
    socket.on('systemMessage', (message) => {
      setMessages((prev) => {
        const updated = [
          ...prev,
          {
            ...message,
            timestamp: new Date(message.timestamp)
          }
        ];
        const messagesKey = `chatMessages_${roomId}`;
        localStorage.setItem(messagesKey, JSON.stringify(updated));
        return updated;
      });
    });

    // Receive active users updates
    socket.on('activeUsers', (users) => {
      setActiveUsers(users);
    });

    // Receive typing indicators from other users
    socket.on('userTyping', ({ user: typingUser }) => {
      if (!typingUser || typingUser.id === user.id) return;
      setTypingUsers((prev) => {
        if (prev.includes(typingUser.username)) return prev;
        return [...prev, typingUser.username];
      });
    });

    socket.on('userStopTyping', ({ user: typingUser }) => {
      if (!typingUser) return;
      setTypingUsers((prev) => prev.filter((name) => name !== typingUser.username));
    });

    // Listen for new join requests (admin only)
    socket.on('newJoinRequest', ({ roomId: reqRoomId, user: requestUser }) => {
      if (reqRoomId === roomId) {
        const request = {
          userId: String(requestUser.id),
          username: requestUser.username
        };
        setJoinRequests((prev) => {
          // avoid duplicates for the same user
          if (prev.some(r => r.userId === request.userId)) return prev;
          return [...prev, request];
        });
        alert(`${requestUser.username} wants to join this chatroom!`);
      }
    });

    socket.on('joinRequestsList', ({ roomId: reqRoomId, requests }) => {
      if (reqRoomId === roomId) {
        console.log('Received join requests:', requests);
        setJoinRequests(requests);
      }
    });

    socket.on('requestApproved', ({ username }) => {
      alert(`Approved ${username}'s request!`);
      // Refresh join requests
      socket.emit('getJoinRequests', { roomId });
    });

    socket.on('requestRejected', ({ username }) => {
      alert(`Rejected ${username}'s request.`);
      // Refresh join requests
      socket.emit('getJoinRequests', { roomId });
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [roomId, user]);

  // Get join requests when room info is loaded (admin only)
  useEffect(() => {
    if (roomInfo?.createdBy === user.username && socketRef.current) {
      console.log('Admin detected, fetching join requests for room:', roomId);
      socketRef.current.emit('getJoinRequests', { roomId });
    }
  }, [roomInfo, user.username, roomId]);

  // Track mobile/desktop and reset mobile view on resize
  useEffect(() => {
    const onResize = () => {
      const mobile = window.innerWidth <= 768;
      setIsMobile(mobile);
      if (!mobile) {
        setIsMobileUsersView(false);
      }
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = (e) => {
    e.preventDefault();

    if (!newMessage.trim()) return;

    const message = {
      id: Date.now().toString(),
      user: user,
      content: newMessage,
      timestamp: new Date().toISOString()
    };

    if (socketRef.current) {
      socketRef.current.emit('sendMessage', { roomId, message });
    }

    setNewMessage('');
    setIsTyping(false);
  };

  const handleTyping = (e) => {
    setNewMessage(e.target.value);

    if (!isTyping) {
      setIsTyping(true);
      // Notify others that this user started typing
      if (socketRef.current) {
        socketRef.current.emit('typing', { roomId, user });
      }
    }

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set new timeout; when it fires, user stopped typing
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      if (socketRef.current) {
        socketRef.current.emit('stopTyping', { roomId, user });
      }
    }, 1000);
  };

  const handleBack = () => {
    // Navigate back without leaving the room (remain a member)
    navigate('/chatrooms');
  };

  const handleLeaveRoom = () => {
    // Notify server so all users see the leave event
    if (socketRef.current) {
      socketRef.current.emit('leaveRoom', { roomId, user });
    }

    // Local optimistic update of active users
    setActiveUsers((prev) => prev.filter((u) => u.id !== user.id));
    setRoomInfo(null);

    // Remove room from joined list
    try {
      const key = `joinedRooms_${user.id}`;
      const existing = JSON.parse(localStorage.getItem(key) || '[]');
      const updated = existing.filter(rid => rid !== roomId);
      localStorage.setItem(key, JSON.stringify(updated));
    } catch (_) { }

    setTimeout(() => {
      navigate('/chatrooms');
    }, 800);
  };

  const handleDeleteRoom = () => {
    // Remove room from customChatrooms
    try {
      const savedRooms = localStorage.getItem('customChatrooms');
      if (savedRooms) {
        const customRooms = JSON.parse(savedRooms);
        const updated = customRooms.filter(r => r.id !== roomId);
        localStorage.setItem('customChatrooms', JSON.stringify(updated));
      }
    } catch (_) { }

    // Clear this room from all members' joinedRooms
    // This is a simplified approach - in production, you'd track all members
    try {
      // Clear from current user
      const key = `joinedRooms_${user.id}`;
      const existing = JSON.parse(localStorage.getItem(key) || '[]');
      const updated = existing.filter(rid => rid !== roomId);
      localStorage.setItem(key, JSON.stringify(updated));
    } catch (_) { }

    setRoomInfo(null);

    // Navigate back immediately
    navigate('/chatrooms');
  };

  const formatTime = (date) => {
    return new Date(date).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleRemoveUser = (targetUser) => {
    if (!roomInfo || roomInfo.createdBy !== user.username) return;
    if (!targetUser || targetUser.id === user.id) return;

    setActiveUsers((prev) => {
      const updated = prev.filter((u) => u.id !== targetUser.id);
      localStorage.setItem(activeUsersKey, JSON.stringify(updated));
      return updated;
    });

    const removalMessage = {
      id: Date.now().toString(),
      user: { id: 'system', username: 'System' },
      content: `${targetUser.username} was removed from the chatroom.`,
      timestamp: new Date(),
      isSystem: true
    };

    setMessages((prev) => {
      const updated = [...prev, removalMessage];
      const messagesKey = `chatMessages_${roomId}`;
      localStorage.setItem(messagesKey, JSON.stringify(updated));
      return updated;
    });

    setUserMenuId(null);
  };

  const handleEditMessage = (messageId, content) => {
    setEditingMessageId(messageId);
    setEditedContent(content);
    setMessageMenuId(null);
  };

  const handleSaveEdit = (messageId) => {
    if (!editedContent.trim()) return;

    setMessages((prev) => {
      const updated = prev.map((msg) =>
        msg.id === messageId
          ? { ...msg, content: editedContent, edited: true }
          : msg
      );
      const messagesKey = `chatMessages_${roomId}`;
      localStorage.setItem(messagesKey, JSON.stringify(updated));
      return updated;
    });

    setEditingMessageId(null);
    setEditedContent('');
  };

  const handleCancelEdit = () => {
    setEditingMessageId(null);
    setEditedContent('');
  };

  const handleDeleteMessage = (messageId) => {
    setMessages((prev) => {
      const updated = prev.filter((msg) => msg.id !== messageId);
      const messagesKey = `chatMessages_${roomId}`;
      localStorage.setItem(messagesKey, JSON.stringify(updated));
      return updated;
    });
    setMessageMenuId(null);
  };

  const handleUpdateProfile = (updatedUser) => {
    onUpdateProfile(updatedUser);
    setShowProfile(false);
  };

  const handleApproveRequest = (request) => {
    if (socketRef.current) {
      const targetId = String(request.userId);
      socketRef.current.emit('approveJoinRequest', {
        roomId,
        userId: targetId,
        username: request.username
      });
      setJoinRequests((prev) => prev.filter(r => r.userId !== targetId));
    }
  };

  const handleRejectRequest = (request) => {
    if (socketRef.current) {
      const targetId = String(request.userId);
      socketRef.current.emit('rejectJoinRequest', {
        roomId,
        userId: targetId,
        username: request.username
      });
      setJoinRequests((prev) => prev.filter(r => r.userId !== targetId));
    }
  };

  return (
    <div className="chat-interface">
      {/* Header */}
      <div className="chat-header">
        <div className="chat-header-left">
          <button onClick={handleBack} className="btn-back">
            ←
            {/* ← Back */}
          </button>
          <div className="room-info">
            <h2>{roomInfo?.name || 'Loading...'}</h2>
            <button
              type="button"
              className="room-members-link"
              onClick={() => {
                if (isMobile) setIsMobileUsersView(true);
              }}
            >
              {activeUsers.length} members online
            </button>
          </div>
        </div>
        <div className="chat-header-right">
          <button
            onClick={() => setShowProfile(true)}
            className="btn-profile"
            title="Edit Profile"
          >
            👤
          </button>

          {roomInfo && (
            <>
              {roomInfo.createdBy === user.username && joinRequests.length > 0 && (
                <button
                  onClick={() => setShowJoinRequests(true)}
                  className="btn-requests"
                  title="Join Requests"
                >
                  🔔 {joinRequests.length}
                </button>
              )}

              {roomInfo.createdBy !== user.username && (
                <button onClick={handleLeaveRoom} className="btn-leave">Leave Room</button>
              )}

              {roomInfo.createdBy === user.username && (
                <div className="menu-container">
                  <button
                    className="btn-menu"
                    onClick={() => setOpenMenuId(openMenuId ? null : 'room-menu')}
                    title="Room options"
                  >
                    ⋮
                  </button>
                  {openMenuId === 'room-menu' && (
                    <div className="room-menu">
                      <button
                        className="menu-item delete"
                        onClick={() => handleDeleteRoom()}
                      >
                        Delete Room
                      </button>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <div className="chat-content">
        {/* Active Users Sidebar (desktop only) */}
        <div className="users-sidebar">
          <div className="sidebar-section">
            <h3>Friends</h3>
            <div className="users-list">
              {activeUsers.map((u) => (
                <div key={u.id} className="user-item">
                  <div className="user-avatar">
                    {u.avatar || u.username.charAt(0).toUpperCase()}
                  </div>
                  <div className="user-details">
                    <span className="user-name">
                      {u.username}
                      {roomInfo?.createdBy === u.username && <span className="admin-badge">Admin</span>}
                      {u.id === user.id && <span className="you-badge">(You)</span>}
                    </span>
                  </div>
                  {roomInfo?.createdBy === user.username && u.id !== user.id && (
                    <div className="user-actions">
                      <button
                        type="button"
                        className="user-menu-trigger"
                        onClick={() => setUserMenuId(userMenuId === u.id ? null : u.id)}
                        aria-label={`Actions for ${u.username}`}
                      >
                        …
                      </button>
                      {userMenuId === u.id && (
                        <div className="user-menu">
                          <button
                            type="button"
                            className="user-menu-item remove"
                            onClick={() => handleRemoveUser(u)}
                          >
                            Remove
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
          
        </div>

        {/* Mobile Users View vs Messages */}
        {isMobile && isMobileUsersView ? (
          <div className="mobile-users-panel">
            <div className="mobile-users-header">
              <h3>Friends ({activeUsers.length})</h3>
              <button
                type="button"
                className="btn-back-chat"
                onClick={() => setIsMobileUsersView(false)}
              >
                ←
              </button>
            </div>
            <div className="friends-list">
              {activeUsers.map((u) => (
                <div key={u.id} className={`friend-item ${u.id === user.id ? 'current-user' : ''}`}>
                  <div className="friend-avatar">
                    {u.avatar || u.username.charAt(0).toUpperCase()}
                    <span className={`status-indicator ${u.status === 'online' ? 'online' : 'inactive'}`}></span>
                  </div>
                  <div className="friend-info">
                    <div className="friend-name">
                      {u.username}
                      {u.id === user.id && <span className="you-tag">(You)</span>}
                    </div>
                    <div className="friend-status">
                      {u.status === 'online' ? 'Active now' : 'Inactive'}
                    </div>
                  </div>
                  {roomInfo?.createdBy === user.username && u.id !== user.id && (
                    <div className="friend-actions">
                      <button
                        type="button"
                        className="action-menu-btn"
                        onClick={() => setUserMenuId(userMenuId === u.id ? null : u.id)}
                        aria-label={`Actions for ${u.username}`}
                      >
                        ⋮
                      </button>
                      {userMenuId === u.id && (
                        <div className="action-menu">
                          <button
                            type="button"
                            className="action-menu-item remove"
                            onClick={() => handleRemoveUser(u)}
                          >
                            Remove
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* Messages Area */
          <div className="messages-container">
            <div className="messages-list">
              {messages.map((msg) => (
                msg.isSystem ? (
                  <div key={msg.id} className="system-message">
                    {msg.content}
                  </div>
                ) : (
                  <div
                    key={msg.id}
                    className={`message ${msg.user.id === user.id ? 'message-self' : 'message-other'}`}
                  >
                    <div className="message-avatar">
                      {msg.user.avatar || msg.user.username.charAt(0).toUpperCase()}
                    </div>
                    <div className="message-content">
                      <div className="message-header">
                        <span className="message-author">{msg.user.username}</span>
                        <span className="message-time">
                          {formatTime(msg.timestamp)}
                          {msg.edited && <span className="edited-badge"> (edited)</span>}
                        </span>
                        {msg.user.id === user.id && (
                          <div className="message-actions">
                            <button
                              type="button"
                              className="message-menu-trigger"
                              onClick={() => setMessageMenuId(messageMenuId === msg.id ? null : msg.id)}
                            >
                              ⋮
                            </button>
                            {messageMenuId === msg.id && (
                              <div className="message-menu">
                                <button
                                  type="button"
                                  className="message-menu-item"
                                  onClick={() => handleEditMessage(msg.id, msg.content)}
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  className="message-menu-item delete"
                                  onClick={() => handleDeleteMessage(msg.id)}
                                >
                                  Delete
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      {editingMessageId === msg.id ? (
                        <div className="message-edit-form">
                          <input
                            type="text"
                            value={editedContent}
                            onChange={(e) => setEditedContent(e.target.value)}
                            className="message-edit-input"
                            autoFocus
                          />
                          <div className="message-edit-actions">
                            <button
                              type="button"
                              onClick={() => handleSaveEdit(msg.id)}
                              className="btn-save-edit"
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={handleCancelEdit}
                              className="btn-cancel-edit"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="message-text">{msg.content}</div>
                      )}
                    </div>
                  </div>
                )
              ))}

              {/* Typing Indicator */}
              {typingUsers.length > 0 && (
                <div className="typing-indicator">
                  <div className="typing-avatar">...</div>
                  <div className="typing-content">
                    <span>{typingUsers.join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing</span>
                    <div className="typing-dots">
                      <span></span>
                      <span></span>
                      <span></span>
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            <form onSubmit={handleSendMessage} className="message-input-container">
              <input
                type="text"
                value={newMessage}
                onChange={handleTyping}
                placeholder="I Type here"
                className="message-input"
              />
              <button type="submit" className="btn-send" disabled={!newMessage.trim()}>
              </button>
            </form>
          </div>
        )}
      </div>

      {showProfile && (
        <Profile
          user={user}
          onUpdateProfile={handleUpdateProfile}
          onClose={() => setShowProfile(false)}
        />
      )}

      {showJoinRequests && (
        <div className="modal-overlay" onClick={() => setShowJoinRequests(false)}>
          <div className="join-requests-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Join Requests</h2>
              <button className="btn-close-modal" onClick={() => setShowJoinRequests(false)}>×</button>
            </div>
            <div className="requests-list">
              {joinRequests.length === 0 ? (
                <p className="no-requests">No pending requests</p>
              ) : (
                joinRequests.map((request) => (
                  <div key={request.userId} className="request-item">
                    <div className="request-avatar">
                      {request.username.charAt(0).toUpperCase()}
                    </div>
                    <div className="request-info">
                      <div className="request-name">{request.username}</div>
                      <div className="request-time">wants to join</div>
                    </div>
                    <div className="request-actions">
                      <button
                        className="btn-approve"
                        onClick={() => handleApproveRequest(request)}
                      >
                        ✓ Approve
                      </button>
                      <button
                        className="btn-reject"
                        onClick={() => handleRejectRequest(request)}
                      >
                        × Reject
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatInterface;
