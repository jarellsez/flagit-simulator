import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';

const Navbar = ({ toggleSidebar }) => {
    const { user, isLoggedIn, logout } = useAppStore();
    const [menuOpen, setMenuOpen] = useState(false);

    return (
        <nav className="navbar">
            <div className="navbar-brand">
                <button
                    className="hamburger"
                    onClick={toggleSidebar}
                    style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', display: 'flex' }}
                    aria-label="Toggle menu"
                    type="button"
                >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="3" y1="12" x2="21" y2="12"></line>
                        <line x1="3" y1="6" x2="21" y2="6"></line>
                        <line x1="3" y1="18" x2="21" y2="18"></line>
                    </svg>
                </button>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ backgroundColor: 'white', border: '2px solid var(--accent-orange)', borderRadius: '50%', padding: '4px', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyItems: 'center' }}>
                        <svg viewBox="0 0 24 24" fill="var(--deep-navy)" width="20" height="20">
                            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                            <circle cx="12" cy="10" r="3" fill="var(--primary-teal)" />
                        </svg>
                    </div>
                    <div>
                        <div style={{ fontWeight: 'bold', fontSize: '1.125rem', lineHeight: '1' }}>FlagIt</div>
                        <div style={{ fontSize: '0.625rem', color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase' }}>Security Training</div>
                    </div>
                </div>
            </div>
            {isLoggedIn && (
                <div className="navbar-links">
                    <NavLink to="/dashboard" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>Dashboard</NavLink>
                    <NavLink to="/simulations" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>Simulations</NavLink>
                    <NavLink to={useAppStore().getLastResult() ? (useAppStore().getLastResult().isCorrect ? '/results/success' : '/results/recap') : '/results/success'} className={({ isActive }) => `nav-link ${isActive || window.location.pathname.startsWith('/results') ? 'active' : ''}`}>Results</NavLink>
                    <NavLink to="/analytics" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>Analytics</NavLink>
                </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                {isLoggedIn ? (
                    <div className="user-pill flex items-center gap-2">
                        <span style={{ fontSize: '0.875rem' }}>Welcome back, <span style={{ fontWeight: 'bold' }}>{user.name.split(' ')[0]}!</span></span>
                        <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: 'var(--accent-orange)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                            {user.name.charAt(0)}
                        </div>
                        <button onClick={logout} className="btn btn-white" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', borderRadius: '4px', marginLeft: '0.5rem', display: 'none' }}>
                            Logout
                        </button>
                    </div>
                ) : (
                    <div></div>
                )}
            </div>
        </nav>
    );
};

export default Navbar;
