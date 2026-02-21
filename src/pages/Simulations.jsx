import React, { useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import SimulationCard from '../components/SimulationCard';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';
import Footer from '../components/Footer';

const Simulations = () => {
    const { simulations } = useAppStore();
    const [sidebarOpen, setSidebarOpen] = useState(false);

    return (
        <div className="dashboard-layout" style={{ backgroundColor: 'white' }}>
            <Navbar toggleSidebar={() => setSidebarOpen(!sidebarOpen)} />

            <div className="dashboard-content">
                <Sidebar isOpen={sidebarOpen} close={() => setSidebarOpen(false)} />

                <main className="main-content" style={{ backgroundColor: '#fcfcfc', flex: 1 }}>
                    <div className="flex justify-between items-start mb-8 block-mobile">
                        <div>
                            <h1 style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--deep-navy)', marginBottom: '0.25rem' }}>Simulations</h1>
                            <p style={{ color: 'var(--text-muted)' }}>Navigate the Digital Landscape with Confidence</p>
                        </div>
                        <div className="flex gap-4 items-center mt-mobile">
                            <select className="form-input" style={{ width: 'auto', padding: '0.5rem 1rem', borderRadius: '2rem', fontSize: '0.875rem' }}>
                                <option>Last 2 weeks</option>
                                <option>Last month</option>
                            </select>
                            <div className="text-right text-xs" style={{ color: 'var(--text-muted)' }}>
                                <div>Last Updated</div>
                                <div style={{ fontWeight: 'bold' }}>Today, 3:42 PM</div>
                            </div>
                        </div>
                    </div>

                    <div className="simulations-grid">
                        {simulations.map(sim => (
                            <SimulationCard key={sim.id} {...sim} />
                        ))}
                    </div>
                </main>
            </div>

            <Footer />
        </div>
    );
};

export default Simulations;
