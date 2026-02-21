import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppStateProvider, useAppStore } from './store/useAppStore';
import ProtectedRoute from './routes/ProtectedRoute';

import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Simulations from './pages/Simulations';
import SimulationDetail from './pages/SimulationDetail';
import ResultsSuccess from './pages/ResultsSuccess';
import ResultsRecap from './pages/ResultsRecap';
import Analytics from './pages/Analytics';

// A wrapper to handle the root route logic since we need access to the store
const RootRedirect = () => {
  const { isLoggedIn } = useAppStore();
  return <Navigate to={isLoggedIn ? "/dashboard" : "/login"} replace />;
};

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<RootRedirect />} />
      <Route path="/login" element={<Login />} />
      <Route path="/dashboard" element={
        <ProtectedRoute>
          <Dashboard />
        </ProtectedRoute>
      } />
      <Route path="/simulations" element={
        <ProtectedRoute>
          <Simulations />
        </ProtectedRoute>
      } />
      <Route path="/simulations/:id" element={
        <ProtectedRoute>
          <SimulationDetail />
        </ProtectedRoute>
      } />
      <Route path="/results/success" element={
        <ProtectedRoute>
          <ResultsSuccess />
        </ProtectedRoute>
      } />
      <Route path="/results/recap" element={
        <ProtectedRoute>
          <ResultsRecap />
        </ProtectedRoute>
      } />
      <Route path="/analytics" element={
        <ProtectedRoute>
          <Analytics />
        </ProtectedRoute>
      } />
      {/* Catch-all redirect */}
      <Route path="*" element={<RootRedirect />} />
    </Routes>
  );
}

function App() {
  return (
    <AppStateProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AppStateProvider>
  );
}

export default App;
