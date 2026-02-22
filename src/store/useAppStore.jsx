import React, { createContext, useContext, useState, useEffect } from 'react';
import { INITIAL_MODULES, INITIAL_SIMULATIONS, MOCK_USER, ADMIN_STATS, MOCK_USERS, ACTIVE_CAMPAIGNS, PAST_CAMPAIGNS, REPORT_TRENDS, AI_MODELS, AI_DATASETS } from '../data/seed';

const AppStateContext = createContext(null);

const safeLoad = (key, fallback) => {
    try {
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : fallback;
    } catch (e) {
        console.warn(`Error parsing localStorage key "${key}":`, e);
        return fallback;
    }
};

export const AppStateProvider = ({ children }) => {
    const [isLoggedIn, setIsLoggedIn] = useState(() => {
        return localStorage.getItem('flagit_loggedIn') === 'true';
    });

    const [role, setRole] = useState(() => {
        const savedRole = localStorage.getItem('flagit_role');
        const validRoles = ['user', 'admin', 'aiMaintainer'];
        return validRoles.includes(savedRole) ? savedRole : 'user';
    });

    const [user, setUser] = useState(() => safeLoad('flagit_user', MOCK_USER));
    const [stats, setStats] = useState(() => safeLoad('flagit_stats', MOCK_USER.stats));

    const [resilienceScore, setResilienceScore] = useState(() => {
        try {
            const saved = localStorage.getItem('flagit_score');
            return saved !== null && !isNaN(parseInt(saved, 10)) ? parseInt(saved, 10) : MOCK_USER.resilienceScore;
        } catch {
            return MOCK_USER.resilienceScore;
        }
    });

    const [modules, setModules] = useState(() => safeLoad('flagit_modules', INITIAL_MODULES));
    const [simulations, setSimulations] = useState(() => safeLoad('flagit_simulations', INITIAL_SIMULATIONS));
    const [resultsHistory, setResultsHistory] = useState(() => safeLoad('flagit_history', []));

    // Admin States
    const [adminUsers, setAdminUsers] = useState(() => safeLoad('flagit_adminUsers', MOCK_USERS));
    const [adminActiveCampaigns, setAdminActiveCampaigns] = useState(() => safeLoad('flagit_adminActiveCampaigns', ACTIVE_CAMPAIGNS));

    // Static seeded states for reports
    const adminStats = ADMIN_STATS;
    const adminPastCampaigns = PAST_CAMPAIGNS;
    const reportTrends = REPORT_TRENDS;

    // AI Maintainer States
    const [aiModels, setAiModels] = useState(() => safeLoad('flagit_aiModels', AI_MODELS));
    const [aiDatasets, setAiDatasets] = useState(() => safeLoad('flagit_aiDatasets', AI_DATASETS));
    const [aiSamples, setAiSamples] = useState(() => safeLoad('flagit_aiSamples', []));

    // Sync to localStorage
    useEffect(() => {
        localStorage.setItem('flagit_loggedIn', isLoggedIn);
        localStorage.setItem('flagit_role', role);
        localStorage.setItem('flagit_user', JSON.stringify(user));
        localStorage.setItem('flagit_stats', JSON.stringify(stats));
        localStorage.setItem('flagit_score', resilienceScore.toString());
        localStorage.setItem('flagit_modules', JSON.stringify(modules));
        localStorage.setItem('flagit_simulations', JSON.stringify(simulations));
        localStorage.setItem('flagit_history', JSON.stringify(resultsHistory));
        localStorage.setItem('flagit_adminUsers', JSON.stringify(adminUsers));
        localStorage.setItem('flagit_adminActiveCampaigns', JSON.stringify(adminActiveCampaigns));
        localStorage.setItem('flagit_aiModels', JSON.stringify(aiModels));
        localStorage.setItem('flagit_aiDatasets', JSON.stringify(aiDatasets));
        localStorage.setItem('flagit_aiSamples', JSON.stringify(aiSamples));
    }, [isLoggedIn, role, user, stats, resilienceScore, modules, simulations, resultsHistory, adminUsers, adminActiveCampaigns, aiModels, aiDatasets, aiSamples]);

    const login = (selectedRole = 'user') => {
        setIsLoggedIn(true);
        setRole(selectedRole);

        if (selectedRole === 'admin') {
            setUser({ name: 'Sarah Mitchell', email: 'sarah.mitchell@admin.com', roleLabel: 'System Administrator' });
        } else if (selectedRole === 'aiMaintainer') {
            setUser({ name: 'AI Maintainer', email: 'ai@maintainer.com', roleLabel: 'Model Management' });
        } else {
            setUser(MOCK_USER);
        }
    };

    const logout = () => {
        setIsLoggedIn(false);
        setRole('user');
        setUser(MOCK_USER);
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
            isLoggedIn, role, user, login, logout,
            stats, resilienceScore,
            modules, simulations, resultsHistory,
            reportSimulation, getLastResult,
            adminUsers, setAdminUsers,
            adminActiveCampaigns, setAdminActiveCampaigns,
            adminStats, adminPastCampaigns, reportTrends,
            aiModels, setAiModels,
            aiDatasets, setAiDatasets,
            aiSamples, setAiSamples
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
