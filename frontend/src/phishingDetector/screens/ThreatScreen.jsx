// src/screens/ThreatScreen.jsx
import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faTriangleExclamation,
  faArrowLeft,
  faMagnifyingGlassChart,
  faShieldHalved,
  faCircleExclamation,
  faMessage,
  faRobot,
  faChevronLeft,
  faChevronRight
} from '@fortawesome/free-solid-svg-icons';
import ReportButton from './ReportButton';
import './ThreatScreen.css';

export default function ThreatScreen({ setScreen, scanResult }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentText, setCurrentText] = useState("");

  // --- DATA NORMALIZATION ---
  const threats = scanResult?.detectedPhishing || (scanResult ? [scanResult] : []);
  const totalThreats = threats.length;
  const currentThreat = threats[currentIndex];

  // 1. Fetch the actual content text for the report
  useEffect(() => {
    if (typeof chrome !== "undefined" && chrome.storage) {
      chrome.storage.local.get(['currentEmailText'], (data) => {
        if (data.currentEmailText) {
          setCurrentText(data.currentEmailText);
        }
      });
    }
  }, []);

  // 2. 🚨 BULLETPROOF DOM SYNC (Highlights elements in the background)
  useEffect(() => {
    if (totalThreats <= 1 || !currentThreat || !currentThreat.threatId) return;
    if (typeof chrome === "undefined" || !chrome.tabs) return;

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs.length > 0) {
        chrome.tabs.sendMessage(tabs[0].id, {
          type: "SET_ACTIVE_THREAT",
          threatId: currentThreat.threatId
        }, () => {
          if (chrome.runtime.lastError) {
            console.log("[FlagIt Popup] Sync delayed - waiting for content.js");
          }
        });
      }
    });
  }, [currentIndex, currentThreat, totalThreats]);

  // --- SAFETY GUARD: Prevent Blank Screen if data is missing ---
  if (!scanResult && totalThreats === 0) {
    return (
      <div className="threat-screen">
        <div className="main-content" style={{ textAlign: 'center', paddingTop: '50px' }}>
          <p>Loading threat data...</p>
          <button className="btn-secondary-danger" onClick={() => setScreen('platformList')}>
            Back
          </button>
        </div>
      </div>
    );
  }

  const platform = scanResult?.platform || threats[0]?.platform || "unknown";
  const isEmail = platform === "gmail" || platform === "outlook";

  const handlePrev = () => setCurrentIndex((prev) => (prev > 0 ? prev - 1 : totalThreats - 1));
  const handleNext = () => setCurrentIndex((prev) => (prev < totalThreats - 1 ? prev + 1 : 0));

  const rawScore = totalThreats > 1
    ? Math.max(...threats.map(t => t.score || 0))
    : (scanResult?.score || threats[0]?.score || 0);

  const riskScore = rawScore !== undefined ? Math.round(rawScore * 100) : "N/A";

  const confidenceLabel = scanResult?.confidence || threats[0]?.confidence || "High";
  const confidenceClass = confidenceLabel.toLowerCase().includes('high') ? 'high' : 'medium';
  const auth = scanResult?.auth_check || threats[0]?.auth_check || { spf_status: 'Unknown', dmarc_policy: 'Unknown' };

  const handleBack = () => {
    if (typeof chrome !== "undefined" && chrome.storage) {
      // Clean up all scan-related data when going back
      chrome.storage.local.remove(["popupReason", "chatReport", "scanResult", "currentEmailText"], () => {
        setScreen('platformList');
      });
    } else {
      setScreen('platformList');
    }
  };

  return (
    <div className="threat-screen">
      {/* PINNED HEADER */}
      <div className="header">
        <div className="logo-container">
          <div className="logo-box warning-box">
            <img src="/icons/flagit-logo.png" alt="FlagIt" />
          </div>
          <div className="logo-text">
            <h1>FlagIt</h1>
            <div className="status-badge-container">
              <p className="text-red">Security Alert: {riskScore}% Risk</p>
              <span className={`confidence-badge ${confidenceClass}`}>
                {confidenceLabel}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* SCROLLABLE CONTENT AREA */}
      <div className="main-content">
        <div className="danger-container">
          <div className="danger-icon">
            <FontAwesomeIcon icon={faTriangleExclamation} />
          </div>

          <h2>
            {isEmail ? "EMAIL THREAT" : (totalThreats > 1 ? "CHAT THREATS" : "THREAT DETECTED")}
          </h2>

          <p className="status-text">
            {totalThreats > 1
              ? `FlagIt detected ${totalThreats} suspicious message${totalThreats > 1 ? 's' : ''}. AI models identified social engineering signatures.`
              : "Our AI ensemble (BERT + XGBoost) has flagged this content based on malicious behavioral signatures."}
          </p>
        </div>

        <div className="threat-group-container">
          {totalThreats > 1 && (
            <div className="carousel-header">
              <button className="carousel-nav-btn" onClick={handlePrev}>
                <FontAwesomeIcon icon={faChevronLeft} />
              </button>
              <span className="carousel-indicator">THREAT {currentIndex + 1} OF {totalThreats}</span>
              <button className="carousel-nav-btn" onClick={handleNext}>
                <FontAwesomeIcon icon={faChevronRight} />
              </button>
            </div>
          )}

          <div className={`threat-details ${totalThreats > 1 ? 'has-carousel' : ''}`}>
            <div className="threat-sender-info">
              <FontAwesomeIcon icon={currentThreat?.sender ? faMessage : faRobot} size="sm" />
              <span>{currentThreat?.sender || "Behavioral Signature"}</span>
            </div>

            {(currentThreat?.reasons && currentThreat.reasons.length > 0 ? currentThreat.reasons : ["AI Analysis: Structural phishing signatures detected."]).map((reason, rIndex) => (
              <div className="threat-item" key={rIndex}>
                <span className="dot"></span>
                <p>{reason}</p>
              </div>
            ))}
          </div>
        </div>

        {isEmail && auth.spf_status !== 'Unknown' && (
          <div className="auth-status-box">
            <div className="auth-item">
              <FontAwesomeIcon
                icon={auth.spf_status === 'Pass' ? faShieldHalved : faCircleExclamation}
                className={auth.spf_status === 'Pass' ? 'icon-green' : 'icon-yellow'}
              />
              <span>SPF: {auth.spf_status}</span>
            </div>
            <div className="auth-item">
              <FontAwesomeIcon
                icon={auth.dmarc_policy !== 'Unknown' && auth.dmarc_policy !== 'None' ? faShieldHalved : faCircleExclamation}
                className={auth.dmarc_policy !== 'Unknown' && auth.dmarc_policy !== 'None' ? 'icon-green' : 'icon-yellow'}
              />
              <span>DMARC: {auth.dmarc_policy}</span>
            </div>
          </div>
        )}
      </div>

      {/* PINNED ACTIONS */}
      <div className="actions">
        <button className="btn-primary-danger" onClick={() => window.open('http://localhost:5173/report', '_blank')}>
          <FontAwesomeIcon icon={faMagnifyingGlassChart} style={{ marginRight: '8px' }} />
          Deep AI Analysis
        </button>

        {/* Dynamic Report Button: Context is "False Positive" on this screen */}
        <ReportButton
          platform={platform}
          text={currentText}
          sender={currentThreat?.sender}
          type="false_positive"
        />

        <button className="btn-secondary-danger" onClick={handleBack}>
          <FontAwesomeIcon icon={faArrowLeft} style={{ marginRight: '8px' }} />
          Back to Dashboard
        </button>
      </div>
    </div>
  );
}