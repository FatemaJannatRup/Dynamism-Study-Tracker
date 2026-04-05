import React, { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './AboutUs.css';

const aboutData = [
  {
    title: "Our Mission",
    content: "We built Dynamism because we believe disciplined, long-term effort beats short bursts of motivation. Our goal is simple: help every student turn vague academic dreams into concrete daily habits.",
  },
  {
    title: "Born from Real Struggle",
    content: "Dynamism started in 2024 when its founder failed three major exams in a row. The problem wasn’t effort; it was structure, visibility, and memory.",
  },
  {
    title: "How We’re Different",
    content: "Most study apps reward you for opening the app. We reward you for consistency over months. Everything is built for 90+ day outcomes.",
  },
  {
    title: "The Small Team",
    content: "We’re intentionally small. No corporate bloat, no investor pressure. Just people who still use the product every day themselves.",
  },
  {
    title: "Where We’re Going",
    content: "2026 roadmap includes spaced-repetition flashcards, AI-powered study-plan suggestions, and supervisor dashboards that respect privacy.",
  }
];

export default function About() {
  const navigate = useNavigate();
  const cardWidth = 440; // 400px card + 40px gap
  const originalLength = aboutData.length;

  // Start at the middle set of cards
  const [offset, setOffset] = useState(originalLength * cardWidth);
  const [isTransitioning, setIsTransitioning] = useState(true);

  // Triplicate the data for infinite loop effect
  const displayData = useMemo(() => [...aboutData, ...aboutData, ...aboutData], [originalLength]);

  const handleNext = () => {
    if (!isTransitioning) return;
    setOffset((prev) => prev + cardWidth);
  };

  const handlePrev = () => {
    if (!isTransitioning) return;
    setOffset((prev) => prev - cardWidth);
  };

  useEffect(() => {
    let timeout;
    // If we move beyond the boundaries of the middle set, snap back without animation
    if (offset >= (originalLength * 2) * cardWidth || offset <= 0) {
      timeout = setTimeout(() => {
        setIsTransitioning(false);
        // Reset to the equivalent position in the middle set
        if (offset >= (originalLength * 2) * cardWidth) {
          setOffset(originalLength * cardWidth);
        } else if (offset <= 0) {
          setOffset(originalLength * cardWidth);
        }
      }, 600); // Must match CSS transition time
    }
    return () => clearTimeout(timeout);
  }, [offset, originalLength]);

  // Re-enable transitions after the "snap"
  useEffect(() => {
    if (!isTransitioning) {
      const timeout = setTimeout(() => {
        setIsTransitioning(true);
      }, 20); 
      return () => clearTimeout(timeout);
    }
  }, [isTransitioning]);

  return (
    <div className="about-page-container">
      <div className="about-background-overlay"></div>

      {/* Top Header Section */}
      <button className="back-btn" onClick={() => navigate(-1)}>
        ← BACK
      </button>

      <div className="hero-header">
        <h1>
          A<span style={{ fontSize: '0.48em' }}>BOUT</span>{' '}
          D<span style={{ fontSize: '0.48em' }}>YNAMISM</span>
        </h1>
        <p>BUILT BY STUDENTS • FOR STUDENTS WHO WANT TO WIN LONG-TERM</p>
      </div>

      {/* MAIN CONTENT AREA: Buttons and Cards Side-by-Side */}
      <div className="about-content-wrapper">
        
        <button 
          className="side-nav-btn prev-btn" 
          onClick={handlePrev} 
          aria-label="Previous"
        >
          <div className="arrow">←</div>
          <span>PREV</span>
        </button>

        <div className="flashcard-marquee-wrapper">
          <div 
            className="flashcard-track"
            style={{
              transform: `translateX(-${offset}px)`,
              transition: isTransitioning 
                ? 'transform 0.6s cubic-bezier(0.25, 1, 0.5, 1)' 
                : 'none',
            }}
          >
            {displayData.map((item, index) => (
              <div key={index} className="about-flashcard">
                <div className="card-tag">SECTION {(index % originalLength) + 1}</div>
                <h2 className="card-title">{item.title}</h2>
                <div className="card-divider"></div>
                <p className="card-content">{item.content}</p>
              </div>
            ))}
          </div>
        </div>

        <button 
          className="side-nav-btn next-btn" 
          onClick={handleNext} 
          aria-label="Next"
        >
          <span>NEXT</span>
          <div className="arrow">→</div>
        </button>

      </div>

      <footer className="about-mini-footer">
        © 2026 DYNAMISM • <a href="/contact">GET IN TOUCH</a>
      </footer>
    </div>
  );
}