import React from 'react';

const Footer = () => {
    return (
        <footer style={{ marginTop: 'auto', padding: '1.5rem', borderTop: '1px solid #e5e7eb', textAlign: 'center', backgroundColor: '#f9fafb' }}>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '1.5rem', marginBottom: '0.75rem' }}>
                <a href="#" style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Privacy Policy</a>
                <a href="#" style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Terms of Service</a>
            </div>
            <p style={{ fontSize: '0.875rem', fontWeight: 'bold', color: 'var(--deep-navy)', marginBottom: '0.25rem' }}>Train smart. Stay safe.</p>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>&copy; {new Date().getFullYear()} FlagIt. All rights reserved.</p>
        </footer>
    );
};

export default Footer;
