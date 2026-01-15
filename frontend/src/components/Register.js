import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import './Auth.css';
import logo2 from '../img/logo2.webp';

const Register = ({ onRegister }) => {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [showValidationModal, setShowValidationModal] = useState(false);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    // Show a single simple modal for any invalid case
    if (
      !formData.username ||
      !formData.email ||
      !formData.password ||
      !formData.confirmPassword ||
      formData.password.length < 6 ||
      formData.password !== formData.confirmPassword
    ) {
      setShowValidationModal(true);
      return;
    }

    // Mock registration - in real app, this would call API
    const mockUser = {
      id: Math.random().toString(36).substr(2, 9),
      username: formData.username,
      email: formData.email,
      token: 'mock-jwt-token-' + Date.now()
    };

    onRegister(mockUser);
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <img src={logo2} alt="The Talking logo" className="auth-logo" />
          <h1>The Talking</h1>
          <p>Create your account to get started</p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">

          <div className="form-group">
            <label htmlFor="username">Username</label>
            <input
              type="text"
              id="username"
              name="username"
              value={formData.username}
              onChange={handleChange}
              placeholder="Choose a username"
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
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="Create a password"
            />
          </div>

          <div className="form-group">
            <label htmlFor="confirmPassword">Confirm Password</label>
            <input
              type="password"
              id="confirmPassword"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              placeholder="Confirm your password"
            />
          </div>

          <button type="submit" className="btn-primary">
            Register
          </button>
        </form>

        <div className="auth-footer">
          <p>Already have an account? <Link to="/login">Login here</Link></p>
        </div>
      </div>

      {showValidationModal && (
        <div className="modal-overlay validation-modal" onClick={() => setShowValidationModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <p>Please fill the empty fields.</p>
            <div className="modal-actions">
              <button
                onClick={() => setShowValidationModal(false)}
                className="btn-submit"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Register;
