import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faShieldHalved, faEnvelope, faStar, faFlag, faArchive } from '@fortawesome/free-solid-svg-icons';
import './GmailListViewScreen.css';

export default function GmailListViewScreen({ setScreen }) {
  return (
    <div className="gmail-list-screen">
      {/* Header with Logo */}
      <div className="header">
        <div className="logo-container">
          <div className="logo-box">
            <img 
              src="/icons/flagit-logo.png" 
              alt="FlagIt" 
            />
          </div>
          <div className="logo-text">
            <h1>FlagIt</h1>
            <p>Outsmarting Phishing, Together.</p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="main-content">
        <div className="shield-container">
          <div className="shield-icon">
            <FontAwesomeIcon icon={faShieldHalved} beatFade style={{ color: "#F97316" }} />
          </div>
          <h2>ARMED & READY</h2>
          <p className="status-text">To detect phishes in your inbox</p>
        </div>

        {/* Mini feature icons */}
        <div className="feature-icons">
          <div className="feature-item">
            <FontAwesomeIcon icon={faEnvelope} />
            <span>Inbox</span>
          </div>
          <div className="feature-item">
            <FontAwesomeIcon icon={faStar} />
            <span>Starred</span>
          </div>
          <div className="feature-item">
            <FontAwesomeIcon icon={faFlag} /> 
            <span>Spam</span>
          </div>
          <div className="feature-item">
            <FontAwesomeIcon icon={faArchive} />
            <span>All folders</span>
          </div>
        </div>

        {/* Only Go to Website button */}
        <div className="actions">
          <button 
            className="btn-secondary"
            onClick={() => window.open('http://localhost:5173', '_blank')}
          >
            Go to Website
          </button>
        </div>
      </div>
    </div>
  );
}