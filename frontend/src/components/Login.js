import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import './Auth.css';
import logo2 from '../img/logo2.webp';

const Login = ({ onLogin }) => {
  const [formData, setFormData] = useState({
    email: '',
    password: ''
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

    // Custom validation
    if (!formData.email || !formData.password) {
      setShowValidationModal(true);
      return;
    }

    // Mock login - in real app, this would call API
    const mockUser = {
      id: Math.random().toString(36).substr(2, 9),
      username: formData.email.split('@')[0],
      email: formData.email,
      token: 'mock-jwt-token-' + Date.now()
    };

    onLogin(mockUser);
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <img src={logo2} alt="The Talking logo" className="auth-logo" />
          <h1>The Talking</h1>
          <p>Welcome back! Please login to continue</p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">

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
              placeholder="Enter your password"
            />
          </div>

          <button type="submit" className="btn-primary">
            Login
          </button>
        </form>

        <div className="auth-footer">
          <p>Don't have an account? <Link to="/register">Register here</Link></p>
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

export default Login;
