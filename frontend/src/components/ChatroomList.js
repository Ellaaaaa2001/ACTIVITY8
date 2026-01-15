import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import Profile from './Profile';
import './ChatroomList.css';
import user1 from '../img/user1.png';
import user2 from '../img/user2.png';
import logo2 from '../img/logo2.webp';

const ChatroomList = ({ user, onLogout, onUpdateProfile }) => {
  const navigate = useNavigate();
  const [chatrooms, setChatrooms] = useState([]);
  const [joinedRooms, setJoinedRooms] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newRoom, setNewRoom] = useState({ name: '', description: '' });
  const [openMenuId, setOpenMenuId] = useState(null);
  const [logoutHover, setLogoutHover] = useState(false);
  const [showValidationModal, setShowValidationModal] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [pendingRequests, setPendingRequests] = useState({});

  const socketRef = useRef(null);

  const mockChatrooms = useMemo(() => [], []);

  // Initial chatrooms and joined rooms
  useEffect(() => {
    setChatrooms(mockChatrooms);

    // Load joined rooms for current user
    try {
      const key = `joinedRooms_${user.id}`;
      const joined = JSON.parse(localStorage.getItem(key) || '[]');
      setJoinedRooms(joined);
    } catch (_) { }
  }, [mockChatrooms, user.id]);

  // Real-time custom rooms via Socket.IO
  useEffect(() => {
    const socket = io('http://localhost:4000');
    socketRef.current = socket;

    // Request current custom rooms
    socket.emit('getRooms');

    socket.on('rooms', (customRooms) => {
      setChatrooms([...mockChatrooms, ...customRooms]);
    });

    socket.on('roomCreated', (room) => {
      setChatrooms((prev) => {
        if (prev.some((r) => r.id === room.id)) return prev;
        return [...prev, room];
      });
    });

    // Listen for join request status
    socket.on('joinRequestStatus', ({ status }) => {
      if (status === 'sent') {
        alert('Join request sent! Waiting for admin approval.');
      } else if (status === 'already_pending') {
        alert('You already have a pending request for this room.');
      } else if (status === 'error') {
        alert('Error sending join request. Please try again.');
      }
    });

    // Listen for join approval (real-time auto-join)
    socket.on('joinRequestApproved', ({ roomId, userId }) => {
      if (String(userId) === String(user.id)) {
        // Add room to joined rooms
        const key = `joinedRooms_${user.id}`;
        const joined = JSON.parse(localStorage.getItem(key) || '[]');
        if (!joined.includes(roomId)) {
          joined.push(roomId);
          localStorage.setItem(key, JSON.stringify(joined));
          setJoinedRooms(joined);
        }

        // Clear pending state for this room
        setPendingRequests(prev => {
          const copy = { ...prev };
          delete copy[roomId];
          return copy;
        });

        // Automatically navigate the user into the room
        navigate(`/chat/${roomId}`, { state: { fromJoin: true } });
      }
    });

    // Listen for join rejection
    socket.on('joinRequestRejected', ({ roomId, userId }) => {
      if (userId === user.id) {
        alert('Your join request was rejected by the admin.');
      }
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [mockChatrooms, user.id, navigate]);

  const handleJoinRoom = (roomId, isOpen) => {
    const room = chatrooms.find(r => r.id === roomId);
    
    // If user is the creator or already joined, open directly
    if (isOpen) {
      navigate(`/chat/${roomId}`, { state: { fromJoin: !isOpen } });
    } else {
      // Request to join (needs admin approval)
      if (socketRef.current && room) {
        socketRef.current.emit('requestJoinRoom', {
          roomId,
          user: user,
          adminId: room.createdBy
        });
        
        // Mark as pending
        setPendingRequests(prev => ({ ...prev, [roomId]: true }));
      }
    }
  };

  const handleCreateRoom = (e) => {
    e.preventDefault();

    // Only require name field, description is optional
    if (!newRoom.name.trim()) {
      setShowValidationModal(true);
      return;
    }

    const room = {
      id: Date.now().toString(),
      name: newRoom.name,
      description: newRoom.description,
      members: 1,
      activeUsers: 1,
      createdBy: user.username,
      createdAt: new Date().toISOString()
    };

    // Optimistic update
    setChatrooms((prev) => [...prev, room]);

    // Inform server so other clients receive this room
    if (socketRef.current) {
      socketRef.current.emit('createRoom', { room });
    }

    setNewRoom({ name: '', description: '' });
    setShowCreateModal(false);
  };

  const handleUpdateProfile = (updatedUser) => {
    onUpdateProfile(updatedUser);
    setShowProfile(false);
  };

  return (
    <div className="chatroom-list-container">
      <div className="chatroom-list-header">
        <div className="header-content">
          <div className="header-logo-title">
            <img src={logo2} alt="The Talking logo" className="app-logo" />
            <h1>The Talking</h1>
          </div>
          <div className="user-info">
            <span className="welcome-text">Welcome, <strong>{user.username}</strong></span>  {/* THE WELCOME LOGIN PART */}
            <div className="profile-menu-container">
              <button
                onClick={() => setShowProfileMenu(!showProfileMenu)}
                className="btn-logout"
                onMouseEnter={() => setLogoutHover(true)}
                onMouseLeave={() => setLogoutHover(false)}
                style={{
                  backgroundImage: `url(${logoutHover ? user2 : user1})`,
                  backgroundSize: 'contain',
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'center',
                  border: 'none',
                  backgroundColor: 'transparent',
                  width: '30px',
                  height: '30px',
                  cursor: 'pointer',
                  padding: 0
                }}
              />
              {showProfileMenu && (
                <div className="profile-menu">
                  <button
                    onClick={() => {
                      setShowProfileMenu(false);
                      setShowProfile(true);
                    }}
                    className="profile-menu-item"
                  >
                    Edit Profile
                  </button>
                  <button
                    onClick={() => {
                      setShowProfileMenu(false);
                      onLogout();
                    }}
                    className="profile-menu-item"
                  >
                    Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="chatroom-list-content">
        {/* Left Sidebar - User Profile */}
        <div className="user-profile-sidebar">
          <div className="profile-avatar-large">
            {user.avatar || user.username.charAt(0).toUpperCase()}
          </div>
          <div className="profile-username">{user.username}</div>
          <div className="profile-status">online</div>
        </div>

        {/* Center Content - Chatrooms */}
        <div className="chatrooms-main-content">
          <div className="content-header">
            <h2>Available Chatrooms</h2>
            <button
              onClick={() => setShowCreateModal(true)}
              className="btn-create"
            >
              Create Room
            </button>
          </div>

          <div className="chatrooms-grid">
            {chatrooms.map((room) => (
              <div key={room.id} className="chatroom-card">
                <div className="chatroom-card-header">
                  <div className="chatroom-icon">
                    {room.name.charAt(0).toUpperCase()}
                  </div>
                  {room.createdBy === user.username && (
                    <div className="menu-container">
                      <button
                        className="btn-menu"
                        onClick={() => setOpenMenuId(openMenuId === room.id ? null : room.id)}
                      >
                        ⋮
                      </button>
                      {openMenuId === room.id && (
                        <div className="room-menu">
                          <button
                            className="menu-item delete"
                            onClick={() => {
                              const updatedRooms = chatrooms.filter(r => r.id !== room.id);
                              setChatrooms(updatedRooms);
                              setOpenMenuId(null);
                            }}
                          >
                            Delete Room
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div className="chatroom-info">
                  <span className="chatroom-name">{room.name}</span>
                  <span className="chatroom-description">{room.description}</span>
                  <div className="chatroom-meta">
                    <span className="meta-item">
                      👥 {room.members} members
                    </span>
                    <span className="meta-item">
                      🟢 {room.activeUsers} online
                    </span>
                  </div>
                </div>
                <div className="chatroom-actions">
                  {(() => {
                    const isJoined = room.createdBy === user.username || joinedRooms.includes(room.id);
                    const isPending = pendingRequests[room.id];
                    
                    if (isPending) {
                      return (
                        <button className="btn-pending" disabled>
                          Pending Approval...
                        </button>
                      );
                    }
                    
                    return (
                      <button
                        onClick={() => handleJoinRoom(room.id, isJoined)}
                        className={isJoined ? 'btn-open' : 'btn-join'}
                      >
                        {isJoined ? 'Open' : 'Request to Join'}
                      </button>
                    );
                  })()}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Sidebar */}
        <div className="trending-sidebar">
          <div className="sidebar-section">
            <h3>Statistics</h3>
            <div className="stats-list">
              <div className="stat-item">
                <span className="stat-label">Total Rooms</span>
                <span className="stat-value">{chatrooms.length}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Your Rooms</span>
                <span className="stat-value">{joinedRooms.length}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Create Room Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Create New Chatroom</h2>
            <form onSubmit={handleCreateRoom} className="modal-form">
              <div className="form-group">
                <label>Room Name *</label>
                <input
                  type="text"
                  value={newRoom.name}
                  onChange={(e) => setNewRoom({ ...newRoom, name: e.target.value })}
                  placeholder="Enter room name"
                />
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea
                  value={newRoom.description}
                  onChange={(e) => setNewRoom({ ...newRoom, description: e.target.value })}
                  placeholder="Enter room description (optional)"
                  rows="3"
                />
              </div>
              <div className="modal-actions">
                <button type="button" onClick={() => setShowCreateModal(false)} className="btn-cancel">
                  Cancel
                </button>
                <button type="submit" className="btn-submit">
                  Create Room
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showValidationModal && (
        <div className="modal-overlay" onClick={() => setShowValidationModal(false)}>
          <div className="modal validation-modal" onClick={(e) => e.stopPropagation()}>
            <p>Please fill the empty fields.</p>
            <button
              onClick={() => setShowValidationModal(false)}
              className="btn-ok"
            >
              OK
            </button>
          </div>
        </div>
      )}

      {showProfile && (
        <Profile
          user={user}
          onUpdateProfile={handleUpdateProfile}
          onClose={() => setShowProfile(false)}
        />
      )}
    </div>
  );
};

export default ChatroomList;
