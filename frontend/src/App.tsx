import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import Dashboard from './pages/Dashboard';
import { Login } from './pages/Login';

import PatchBoardPage from './pages/PatchBoardPage';
import ModulesPage from './pages/ModulesPage';
import ModuleAssignmentsPage from './pages/ModuleAssignmentsPage';
import ResourceHierarchyPage from './pages/ResourceHierarchyPage';
import { ErrorBoundary } from './components/ErrorBoundary';
import ReportsPage from './pages/ReportsPage';
import AdminPage from './pages/AdminPage';
import { useAuthStore } from './store/authStore';

const ProtectedRoute = ({ children }: { children: any }) => {
  const user = useAuthStore((state) => state.user);
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return children;
};

const AdminRoute = ({ children }: { children: any }) => {
  const user = useAuthStore((state) => state.user);
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'SUPER_ADMIN' && user.role !== 'ADMIN') {
    return <Navigate to="/" replace />;
  }
  return children;
};

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        
        {/* Protected Routes */}
        <Route 
          path="/" 
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="patches" element={
            <ErrorBoundary fallbackTitle="Patch Board Error">
              <PatchBoardPage />
            </ErrorBoundary>
          } />
          <Route path="tasks" element={<Navigate to="/patches" replace />} />
          <Route path="modules" element={<ModulesPage />} />
          <Route path="assignments" element={<ModuleAssignmentsPage />} />
          <Route path="hierarchy" element={<ResourceHierarchyPage />} />
          <Route path="reports" element={
            <ErrorBoundary fallbackTitle="Reports Error">
              <ReportsPage />
            </ErrorBoundary>
          } />

          <Route path="admin" element={
            <AdminRoute>
              <ErrorBoundary fallbackTitle="Admin Panel Error">
                <AdminPage />
              </ErrorBoundary>
            </AdminRoute>
          } />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
