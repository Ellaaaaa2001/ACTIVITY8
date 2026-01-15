import React, { useState } from 'react';
import './Profile.css';

const Profile = ({ user, onUpdateProfile, onClose }) => {
  const [formData, setFormData] = useState({
    username: user.username,
    email: user.email,
    avatar: user.avatar || user.username.charAt(0).toUpperCase()
  });
  const [showValidationModal, setShowValidationModal] = useState(false);

  const avatarOptions = ['😀', '😎', '🎨', '🚀', '💻', '🎮', '🌟', '🔥', '⚡', '💡', '🎭', '🦄'];

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleAvatarSelect = (avatar) => {
    setFormData({
      ...formData,
      avatar
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!formData.username.trim() || !formData.email.trim()) {
      setShowValidationModal(true);
      return;
    }

    const updatedUser = {
      ...user,
      username: formData.username,
      email: formData.email,
      avatar: formData.avatar
    };

    onUpdateProfile(updatedUser);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content profile-modal" onClick={(e) => e.stopPropagation()}>
        <div className="profile-header">
          <h2>Edit Profile</h2>
          <button onClick={onClose} className="btn-close">×</button>
        </div>

        <form onSubmit={handleSubmit} className="profile-form">
          <div className="form-group">
            <label htmlFor="username">Username</label>
            <input
              type="text"
              id="username"
              name="username"
              value={formData.username}
              onChange={handleChange}
              placeholder="Enter your username"
            />
          </div>

          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="Enter your email"
            />
          </div>

          <div className="form-group">
            <label>Choose Avatar</label>
            <div className="avatar-grid">
              {avatarOptions.map((avatar, index) => (
                <button
                  key={index}
                  type="button"
                  className={`avatar-option ${formData.avatar === avatar ? 'selected' : ''}`}
                  onClick={() => handleAvatarSelect(avatar)}
                >
                  {avatar}
                </button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label>Current Avatar Preview</label>
            <div className="avatar-preview">
              {formData.avatar}
            </div>
          </div>

          <div className="modal-actions">
            <button type="button" onClick={onClose} className="btn-cancel">
              Cancel
            </button>
            <button type="submit" className="btn-submit">
              Save Changes
            </button>
          </div>
        </form>

        {showValidationModal && (
          <div className="validation-overlay" onClick={() => setShowValidationModal(false)}>
            <div className="validation-content" onClick={(e) => e.stopPropagation()}>
              <p>Please fill all required fields.</p>
              <button
                onClick={() => setShowValidationModal(false)}
                className="btn-submit"
              >
                OK
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Profile;
