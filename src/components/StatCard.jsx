import React from 'react';

const StatCard = ({ title, value, icon }) => {
    return (
        <div className="card flex items-center gap-4" style={{ padding: '2rem 1.5rem' }}>
            <div style={{ backgroundColor: 'var(--accent-orange)', color: 'white', padding: '1rem', borderRadius: 'var(--radius-md)' }}>
                {icon}
            </div>
            <div>
                <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--deep-navy)', lineHeight: '1.2' }}>{value}</div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>{title}</div>
            </div>
        </div>
    );
};

export default StatCard;
