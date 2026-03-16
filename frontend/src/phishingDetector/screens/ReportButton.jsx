import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBug, faCheck } from '@fortawesome/free-solid-svg-icons';

export default function ReportButton({ platform, text, sender, type }) {
    const [reported, setReported] = useState(false);

    const handleReport = () => {
        if (typeof chrome !== "undefined" && chrome.runtime) {
            chrome.runtime.sendMessage({
                type: "SEND_REPORT",
                payload: {
                    platform,
                    text,
                    sender: sender || "Unknown",
                    report_type: type
                }
            }, (response) => {
                if (response?.success) setReported(true);
            });
        }
    };

    // Logic to determine the button text based on the report type
    const getButtonText = () => {
        if (reported) return "Reported to FlagIT";
        if (type === 'false_positive') return "Report False Positive";
        if (type === 'missed_phishing') return "Report Phishing";
        return "Report Issue";
    };

    return (
        <button
            className="btn-secondary-danger"
            onClick={handleReport}
            disabled={reported}
            style={{
                borderColor: reported ? "#22c55e" : "rgba(239, 68, 68, 0.3)",
                color: reported ? "#22c55e" : "#fca5a5",
                cursor: reported ? "default" : "pointer",
                opacity: reported ? 0.8 : 1,
                flexShrink: 0,
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
            }}
        >
            <FontAwesomeIcon icon={reported ? faCheck : faBug} style={{ marginRight: '8px' }} />
            {getButtonText()}
        </button>
    );
}