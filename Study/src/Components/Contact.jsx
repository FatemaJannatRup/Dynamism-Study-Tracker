// src/Components/Contact.jsx
import React from 'react';
import './Contact.css';

export default function Contact() {
  return (
    <div className="contact-page-wrapper">
      <div className="fixed-background-contact"></div>

      <section className="contact-hero-section">
        <div className="section-overlay"></div>

        <div className="contact-content">
          <h1>
            CONTACT <span className="small-caps">US</span>
          </h1>
          <p className="tagline">
            WE'RE HERE TO HELP YOU BUILD UNBREAKABLE STUDY HABITS
          </p>

          <div className="contact-main">
            <div className="intro-text">
              <p>
                Got a question about Dynamism? Running into an issue? Have an idea that could make the platform even stronger?  
                Drop us a message — our small team usually replies within 24–48 hours.
              </p>
            </div>

            <form 
              className="contact-form"
              onSubmit={(e) => {
                e.preventDefault();
                // Replace with real submission logic (EmailJS, Formspoke, your backend, etc.)
                alert('Message sent! We will get back to you soon.');
              }}
            >
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="name">Name</label>
                  <input 
                    type="text" 
                    id="name" 
                    name="name" 
                    placeholder="Your name" 
                    required 
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="email">Email</label>
                  <input 
                    type="email" 
                    id="email" 
                    name="email" 
                    placeholder="you@example.com" 
                    required 
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="subject">Subject</label>
                <select id="subject" name="subject" required>
                  <option value="">Choose one</option>
                  <option value="support">Technical Support / Bug</option>
                  <option value="feature">Feature Request / Idea</option>
                  <option value="account">Account / Subscription</option>
                  <option value="business">Business / School Partnership</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="message">Your Message</label>
                <textarea 
                  id="message" 
                  name="message" 
                  rows="7" 
                  placeholder="Tell us what's on your mind..." 
                  required
                ></textarea>
              </div>

              <button type="submit" className="submit-button">
                LAUNCH MESSAGE
              </button>
            </form>

            <footer className="contact-footer">
              © 2026 DYNAMISM — BUILT FOR LONG-TERM WINS
            </footer>
          </div>
        </div>
      </section>
    </div>
  );
}