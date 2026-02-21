import React, { useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import ProgressRing from '../components/ProgressRing';
import StatCard from '../components/StatCard';
import ModuleCard from '../components/ModuleCard';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';
import Footer from '../components/Footer';

const Dashboard = () => {
    const { resilienceScore, stats, modules } = useAppStore();
    const navigate = useNavigate();
    const [sidebarOpen, setSidebarOpen] = useState(false);

    return (
        <div className="dashboard-layout">
            <Navbar toggleSidebar={() => setSidebarOpen(!sidebarOpen)} />

            <div className="dashboard-content">
                <Sidebar isOpen={sidebarOpen} close={() => setSidebarOpen(false)} />

                <main className="main-content">
                    <div className="dashboard-main-grid">
                        {/* Left Big Card */}
                        <div className="card text-center flex-col justify-center items-center" style={{ backgroundColor: 'white', padding: '3rem 2rem' }}>
                            <ProgressRing
                                radius={90}
                                stroke={12}
                                progress={resilienceScore}
                                label="RESILIENCE SCORE"
                            />
                            <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginTop: '2rem' }}>Excellent Security Awareness!</h2>
                            <p style={{ color: 'var(--text-muted)' }}>You're demonstrating strong phishing detection skills. Keep up the great work!</p>
                        </div>

                        {/* Right Stacked Cards */}
                        <div className="stats-grid">
                            <StatCard
                                title="Simulations Completed"
                                value={stats.simulationsCompleted}
                                icon={(
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
                                        <polyline points="2 17 12 22 22 17"></polyline>
                                        <polyline points="2 12 12 17 22 12"></polyline>
                                    </svg>
                                )}
                            />
                            <StatCard
                                title="Phish Detected"
                                value={stats.phishDetected}
                                icon={(
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                                        <polyline points="22 4 12 14.01 9 11.01"></polyline>
                                    </svg>
                                )}
                            />
                            <StatCard
                                title="Training Modules Finished"
                                value={stats.modulesFinished}
                                icon={(
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
                                        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
                                    </svg>
                                )}
                            />
                        </div>
                    </div>

                    <div className="flex gap-4 mt-8 flex-wrap" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
                        <button
                            onClick={() => navigate('/simulations/1')}
                            className="btn btn-orange btn-full"
                            style={{ padding: '1.25rem' }}
                        >
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polygon points="5 3 19 12 5 21 5 3"></polygon>
                            </svg>
                            Launch New Simulation
                        </button>
                        <button
                            onClick={() => navigate('/simulations')}
                            className="btn btn-white btn-full"
                            style={{ padding: '1.25rem', fontWeight: 'bold' }}
                        >
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
                            </svg>
                            View Detailed Progress
                        </button>
                    </div>

                    <div className="mt-8">
                        <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'white' }}>Training Modules</h2>
                        <p style={{ color: 'rgba(255,255,255,0.7)', marginBottom: '1.5rem', fontSize: '0.875rem' }}>Enhance your security knowledge</p>

                        <div className="modules-grid">
                            {modules.map(mod => (
                                <ModuleCard key={mod.id} {...mod} />
                            ))}
                        </div>
                    </div>
                </main>

                <div style={{ paddingBottom: '2rem' }}></div>
            </div>

            <Footer />
        </div>
    );
};

export default Dashboard;
