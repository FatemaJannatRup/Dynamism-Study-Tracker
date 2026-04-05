import React, { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './FAQ.css';

const faqData = [
  {
    question: "What is Dynamism?",
    answer: "Dynamism is a focused study platform built to help students achieve long-term academic goals through structured planning, performance tracking, and streak building.",
  },
  {
    question: "Is Dynamism free?",
    answer: "Yes—the core experience is completely free. Optional premium features include advanced visualizations, export tools, and custom interfaces.",
  },
  {
    question: "Is it available on mobile?",
    answer: "Not for now haha.Hopefully we'll be working on that.",
  },
  {
    question: "How do revision work?",
    answer: "Dynamism uses intelligent scheduling to send reminders and highlights pending items in your progress overview to ensure long-term retention.",
  },
  {
    question: "Is my data private?",
    answer: "Yes—all personal study data remains private to your account. We use encryption and never sell or share individual information.",
  },
  {
    question: "Can educators view progress?",
    answer: "With your explicit permission, approved supervisors can access read-only views of progress via secure sharing links.",
  }
];

export default function FAQ() {
  const navigate = useNavigate();
  const cardWidth = 440; // 400px card + 40px gap
  const originalLength = faqData.length;

  // Start at the middle set of cards for infinite effect
  const [offset, setOffset] = useState(originalLength * cardWidth);
  const [isTransitioning, setIsTransitioning] = useState(true);

  // Triplicate the data for infinite loop effect
  const displayData = useMemo(() => [...faqData, ...faqData, ...faqData], [originalLength]);

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
    // Infinite loop "snap" logic
    if (offset >= (originalLength * 2) * cardWidth || offset <= 0) {
      timeout = setTimeout(() => {
        setIsTransitioning(false);
        setOffset(originalLength * cardWidth);
      }, 600); 
    }
    return () => clearTimeout(timeout);
  }, [offset, originalLength]);

  useEffect(() => {
    if (!isTransitioning) {
      const timeout = setTimeout(() => {
        setIsTransitioning(true);
      }, 20); 
      return () => clearTimeout(timeout);
    }
  }, [isTransitioning]);

  return (
    <div className="faq-page-container">
      <div className="faq-background-overlay"></div>

      <button className="back-btn" onClick={() => navigate(-1)}>
        ← BACK
      </button>

      <div className="hero-header">
        <h1>
          F<span style={{ fontSize: '0.48em' }}>REQUENTLY</span>{' '}
          A<span style={{ fontSize: '0.48em' }}>SKED</span>{' '}
          Q<span style={{ fontSize: '0.48em' }}>UESTIONS</span>
        </h1>
        <p>STRENGTHENING THE PATH TO ACADEMIC SUCCESS</p>
      </div>

      <div className="faq-content-wrapper">
        
        <button className="side-nav-btn prev-btn" onClick={handlePrev} aria-label="Previous">
          <div className="arrow">←</div>
          <span>PREV</span>
        </button>

        <div className="faq-marquee-wrapper">
          <div 
            className="faq-track"
            style={{
              transform: `translateX(-${offset}px)`,
              transition: isTransitioning 
                ? 'transform 0.6s cubic-bezier(0.25, 1, 0.5, 1)' 
                : 'none',
            }}
          >
            {displayData.map((item, index) => (
              <div key={index} className="faq-card">
                <div className="card-tag">QUERY {(index % originalLength) + 1}</div>
                <h2 className="card-title">{item.question}</h2>
                <div className="card-divider"></div>
                <p className="card-content">{item.answer}</p>
              </div>
            ))}
          </div>
        </div>

        <button className="side-nav-btn next-btn" onClick={handleNext} aria-label="Next">
          <span>NEXT</span>
          <div className="arrow">→</div>
        </button>

      </div>

      <footer className="faq-mini-footer">
        © 2026 DYNAMISM • <a href="/contact">CONTACT SUPPORT</a>
      </footer>
    </div>
  );
}