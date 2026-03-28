import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './features/auth/AuthContext';
import ProtectedRoute from './routes/ProtectedRoute';
import AppLayout from './layouts/AppLayout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import IncidentsPage from './pages/IncidentsPage';
import NewIncidentPage from './pages/NewIncidentPage';
import IncidentDetailPage from './pages/IncidentDetailPage';
import VehiclesPage from './pages/VehiclesPage';
import TrackingPage from './pages/TrackingPage';
import AnalyticsPage from './pages/AnalyticsPage';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
            <Route index element={<DashboardPage />} />
            <Route path="incidents" element={<IncidentsPage />} />
            <Route path="incidents/new" element={<NewIncidentPage />} />
            <Route path="incidents/:id" element={<IncidentDetailPage />} />
            <Route path="vehicles" element={<VehiclesPage />} />
            <Route path="tracking" element={<TrackingPage />} />
            <Route path="analytics" element={<AnalyticsPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
