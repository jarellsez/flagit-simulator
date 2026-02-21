import React from 'react';

const RadarChart = () => {
    // A simplified SVG Radar/Spider chart.
    // 4 axes: Deceptive URLs (top), BiTB Attacks (right), Fake Branding (bottom), Urgency Tactics (left)

    // Center at (100, 100), radius 70.
    return (
        <div style={{ position: 'relative', width: '250px', height: '250px', margin: '0 auto' }}>
            <svg viewBox="0 0 200 200" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
                {/* Background grid */}
                <polygon points="100,30 170,100 100,170 30,100" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="1" />
                <polygon points="100,53 147,100 100,147 53,100" fill="none" stroke="#cbd5e1" strokeWidth="1" />
                <polygon points="100,76 124,100 100,124 76,100" fill="none" stroke="#cbd5e1" strokeWidth="1" />

                {/* Axes */}
                <line x1="100" y1="30" x2="100" y2="170" stroke="#cbd5e1" strokeDasharray="4 2" />
                <line x1="30" y1="100" x2="170" y2="100" stroke="#cbd5e1" strokeDasharray="4 2" />

                {/* Data Polygon */}
                {/* Values: Deceptive URLs(82), BiTB(60), Fake Branding(75), Urgency(35 - i.e 65 susceptible means low score on axis) */}
                {/* Top: 100 - (70 * 0.82) = 42.6 */}
                {/* Right: 100 + (70 * 0.6) = 142 */}
                {/* Bottom: 100 + (70 * 0.75) = 152.5 */}
                {/* Left: 100 - (70 * 0.4) = 72 */}

                <polygon points="100,42.6 142,100 100,152.5 72,100" fill="var(--primary-teal)" fillOpacity="0.4" stroke="var(--primary-teal)" strokeWidth="2" strokeLinejoin="round" />

                {/* Data points */}
                <circle cx="100" cy="42.6" r="3" fill="var(--deep-navy)" />
                <circle cx="142" cy="100" r="3" fill="var(--deep-navy)" />
                <circle cx="100" cy="152.5" r="3" fill="var(--deep-navy)" />
                <circle cx="72" cy="100" r="3" fill="var(--deep-navy)" />

                {/* Labels */}
                <text x="100" y="20" textAnchor="middle" fontSize="10" fill="var(--deep-navy)">Deceptive URLs</text>
                <text x="175" y="103" textAnchor="start" fontSize="10" fill="var(--deep-navy)">BiTB Attacks</text>
                <text x="100" y="185" textAnchor="middle" fontSize="10" fill="var(--deep-navy)">Fake Branding</text>
                <text x="25" y="103" textAnchor="end" fontSize="10" fill="var(--deep-navy)">Urgency Tactics</text>
            </svg>
        </div>
    );
};

export default RadarChart;
