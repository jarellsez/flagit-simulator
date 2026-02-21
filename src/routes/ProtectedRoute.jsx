import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';

const ProtectedRoute = ({ children }) => {
    const { isLoggedIn } = useAppStore();

    if (!isLoggedIn) {
        return <Navigate to="/login" replace />;
    }

    return children;
};

export default ProtectedRoute;
