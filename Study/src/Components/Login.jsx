// Login.jsx
import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import './style.css';

const Login = () => {
  const navigate = useNavigate();
  const { login } = useAuth();

  const api = axios.create({
    baseURL: 'http://localhost:3000',
    withCredentials: true,
  });

  const [isActive, setIsActive] = useState(false);
  const [loginValues, setLoginValues] = useState({ email: '', password: '' });
  const [loginError, setLoginError] = useState(null);
  const [signupValues, setSignupValues] = useState({ name: '', email: '', password: '' });

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setLoginError(null);

    try {
      const res = await api.post('/auth/login', loginValues);

      if (res.data.loginStatus) {
        // ── FIXED: use the role the SERVER returned, not an email comparison.
        // The backend sends role: "admin" | "student" — trust that.
        const serverRole = res.data.role; // "admin" or "student"

        const userData = {
          id:    res.data.user.id,
          name:  res.data.user.name,
          email: res.data.user.email,
          // Map server role to what AuthContext stores ("admin" | "user")
          role:  serverRole === 'admin' ? 'admin' : 'user',
          token: res.data.token,
        };

        login(userData);

        if (serverRole === 'admin') {
          navigate('/admin');
        } else {
          navigate('/dashboard');
        }
      } else {
        setLoginError(res.data.Error || 'Login failed');
      }
    } catch (err) {
      console.error('Login error:', err);
      setLoginError(
        err.response?.data?.Error ||
        err.response?.data?.message ||
        'Something went wrong. Check console.'
      );
    }
  };

  const handleSignupSubmit = async (e) => {
    e.preventDefault();

    try {
      const res = await api.post('/auth/register', {
        name:     signupValues.name,
        email:    signupValues.email,
        password: signupValues.password,
      });

      if (res.data.success) {
        alert('Registration successful! Please log in.');
        setIsActive(false);
        setSignupValues({ name: '', email: '', password: '' });
      } else {
        alert(res.data.message || 'Registration failed');
      }
    } catch (err) {
      console.error('Signup error:', err);
      alert(
        err.response?.data?.message ||
        'Registration failed. Email may already exist.'
      );
    }
  };

  return (
    <div className={`container ${isActive ? 'active' : ''}`}>
      <div className="video-container">
        <video autoPlay loop muted playsInline>
          <source src="/video.mp4" type="video/mp4" />
        </video>
        <div className="overlay"></div>
      </div>

      <div className="form-container sign-up">
        <form onSubmit={handleSignupSubmit}>
          <h1>Create Account</h1>
          <span>use your email for registration</span>
          <input type="text" placeholder="Name" value={signupValues.name} onChange={e => setSignupValues({ ...signupValues, name: e.target.value })} required />
          <input type="email" placeholder="Email" value={signupValues.email} onChange={e => setSignupValues({ ...signupValues, email: e.target.value })} required />
          <input type="password" placeholder="Password" value={signupValues.password} onChange={e => setSignupValues({ ...signupValues, password: e.target.value })} required />
          <button type="submit">Sign Up</button>
        </form>
      </div>

      <div className="form-container sign-in">
        <form onSubmit={handleLoginSubmit}>
          <h1>Log In</h1>
          <span>use your email & password</span>
          {loginError && <div style={{ color: 'red', margin: '10px 0' }}>{loginError}</div>}
          <input type="email" placeholder="Email" value={loginValues.email} onChange={e => setLoginValues({ ...loginValues, email: e.target.value })} required />
          <input type="password" placeholder="Password" value={loginValues.password} onChange={e => setLoginValues({ ...loginValues, password: e.target.value })} required />
          <a href="#">Forgot Your Password?</a>
          <button type="submit">Log In</button>
        </form>
      </div>

      <div className="toggle-container">
        <div className="toggle">
          <div className="toggle-panel toggle-left">
            <h1>Welcome Back!</h1>
            <p>To keep connected please login</p>
            <button className="hidden" onClick={() => setIsActive(false)}>Log In</button>
          </div>
          <div className="toggle-panel toggle-right">
            <h1>Hello, Friend!</h1>
            <p>Enter details and start your journey</p>
            <button className="hidden" onClick={() => setIsActive(true)}>Sign Up</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;