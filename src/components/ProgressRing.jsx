import React, { useEffect, useState } from 'react';

const ProgressRing = ({ radius, stroke, progress, label, labelSub }) => {
    const [offset, setOffset] = useState(0);
    const normalizedRadius = radius - stroke * 2;
    const circumference = normalizedRadius * 2 * Math.PI;

    useEffect(() => {
        const strokeDashoffset = circumference - (progress / 100) * circumference;
        // adding a slight delay for animation effect
        const timeout = setTimeout(() => {
            setOffset(strokeDashoffset);
        }, 100);
        return () => clearTimeout(timeout);
    }, [progress, circumference]);

    return (
        <div className="score-ring">
            <svg
                height={radius * 2}
                width={radius * 2}
            >
                <circle
                    stroke="#e5e7eb"
                    fill="transparent"
                    strokeWidth={stroke}
                    r={normalizedRadius}
                    cx={radius}
                    cy={radius}
                />
                <circle
                    stroke="var(--accent-orange)"
                    fill="transparent"
                    strokeWidth={stroke}
                    strokeDasharray={circumference + ' ' + circumference}
                    style={{ strokeDashoffset: offset === 0 ? circumference : offset, transition: 'stroke-dashoffset 1s ease-in-out' }}
                    strokeLinecap="round"
                    r={normalizedRadius}
                    cx={radius}
                    cy={radius}
                    transform={`rotate(-90 ${radius} ${radius})`}
                />
            </svg>
            <div className="score-text">
                <div className="score-number">{progress}</div>
                <div className="score-label" style={{ fontSize: '1rem', color: 'var(--deep-navy)', fontWeight: 'bold' }}>/ 100</div>
                <div className="score-label" style={{ marginTop: '4px' }}>{label}</div>
                {labelSub && <div className="score-label" style={{ fontWeight: 'normal' }}>{labelSub}</div>}
            </div>
        </div>
    );
};

export default ProgressRing;
