import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import './Dashboard.css';

const Logout = () => {
  const [message, setMessage] = useState("You are Logging out...");
  const navigate = useNavigate();

   useEffect(() => {
    // Show "You are Logging out..." for 1 second
    const timer = setTimeout(() => {
      setMessage("You have been successfully logged out.");
      // Redirect immediately after showing success message
      navigate("/"); // adjust route if needed
    }, 1000);  // 1 second after showing success message


    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div className="logout-container">
      <p>{message}</p>
    </div>
  );
};

export default Logout;