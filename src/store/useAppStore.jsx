import React, { createContext, useContext, useState, useEffect } from 'react';
import { INITIAL_MODULES, INITIAL_SIMULATIONS, MOCK_USER } from '../data/seed';

const AppStateContext = createContext(null);

export const AppStateProvider = ({ children }) => {
    const [isLoggedIn, setIsLoggedIn] = useState(() => {
        return localStorage.getItem('flagit_loggedIn') === 'true';
    });

    const [user, setUser] = useState(MOCK_USER);

    const [stats, setStats] = useState(() => {
        const saved = localStorage.getItem('flagit_stats');
        return saved ? JSON.parse(saved) : MOCK_USER.stats;
    });

    const [resilienceScore, setResilienceScore] = useState(() => {
        const saved = localStorage.getItem('flagit_score');
        return saved ? parseInt(saved, 10) : MOCK_USER.resilienceScore;
    });

    const [modules, setModules] = useState(() => {
        const saved = localStorage.getItem('flagit_modules');
        return saved ? JSON.parse(saved) : INITIAL_MODULES;
    });

    const [simulations, setSimulations] = useState(() => {
        const saved = localStorage.getItem('flagit_simulations');
        return saved ? JSON.parse(saved) : INITIAL_SIMULATIONS;
    });

    const [resultsHistory, setResultsHistory] = useState(() => {
        const saved = localStorage.getItem('flagit_history');
        return saved ? JSON.parse(saved) : [];
    });

    // Sync to localStorage
    useEffect(() => {
        localStorage.setItem('flagit_loggedIn', isLoggedIn);
        localStorage.setItem('flagit_stats', JSON.stringify(stats));
        localStorage.setItem('flagit_score', resilienceScore.toString());
        localStorage.setItem('flagit_modules', JSON.stringify(modules));
        localStorage.setItem('flagit_simulations', JSON.stringify(simulations));
        localStorage.setItem('flagit_history', JSON.stringify(resultsHistory));
    }, [isLoggedIn, stats, resilienceScore, modules, simulations, resultsHistory]);

    const login = () => setIsLoggedIn(true);
    const logout = () => {
        setIsLoggedIn(false);
        // Requirements: "clear login state (optionally preserve progress history)."
    };

    const reportSimulation = (simId, choice) => {
        const isCorrect = choice === 'phish'; // All seeded simulations are considered phishing here

        const newEntry = {
            id: Date.now(),
            simulationId: simId,
            choice,
            isCorrect,
            timestamp: new Date().toISOString()
        };

        setResultsHistory(prev => [...prev, newEntry]);

        setStats(prev => ({
            ...prev,
            simulationsCompleted: prev.simulationsCompleted + 1,
            phishDetected: (isCorrect && choice === 'phish') ? prev.phishDetected + 1 : prev.phishDetected
        }));

        return isCorrect;
    };

    const getLastResult = () => {
        return resultsHistory.length > 0 ? resultsHistory[resultsHistory.length - 1] : null;
    };

    return (
        <AppStateContext.Provider value={{
            isLoggedIn, login, logout,
            user, stats, resilienceScore,
            modules, simulations, resultsHistory,
            reportSimulation, getLastResult
        }}>
            {children}
        </AppStateContext.Provider>
    );
};

export const useAppStore = () => {
    const context = useContext(AppStateContext);
    if (!context) {
        throw new Error('useAppStore must be used within AppStateProvider');
    }
    return context;
};
