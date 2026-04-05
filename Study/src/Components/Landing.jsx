import { useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import "./Landing.css";

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div className="landing">

      {/* ===== Background Video ===== */}
      <div className="video-container">
        <video autoPlay loop muted playsInline>
          <source src="/video.mp4" type="video/mp4" />
        </video>
        <div className="overlay"></div>
      </div>

      {/* ===== Navbar ===== */}
      <nav className="navbar">
        <div className="logo">DYNAMISM</div>

        <div className="nav-buttons">
          <button className="login-btn" onClick={() => navigate("/login")}>
            Log in
          </button>

          <button className="primary-btn" onClick={() => navigate("/login")}>
            Get started
          </button>
        </div>
      </nav>

      {/* ===== Hero Section ===== */}
      <section className="hero">
        <h1>
          Study smarter.<br />
          Track everything.<br />
          <span>Achieve more.</span>
        </h1>

        <p>
          Dynamism helps students organize sessions, track performance,
          build streaks, and turn effort into measurable academic success.
        </p>

        <div className="hero-buttons">
          <button
            className="primary-large"
            onClick={() => navigate("/login")}
          >
            Start for free <ArrowRight size={18} />
          </button>
          <button
            className="secondary-large"
            onClick={() => navigate("/about")}
          >
            About Us <ArrowRight size={18} />
          </button>

        </div>
      </section>

      {/* ===== Footer ===== */}
      <footer className="footer">
        © {new Date().getFullYear()} Dynamism. All rights reserved.
      </footer>
    </div>
  );
}
