import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { AppLayout } from './components/layout/AppLayout';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import DashboardPage from './pages/DashboardPage';
import ClientsListPage from './pages/ClientsListPage';
import ClientDetailPage from './pages/ClientDetailPage';
import DocumentDetailPage from './pages/DocumentDetailPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import AccountingEntryPage from './pages/AccountingEntryPage';
import DocumentsPage from './pages/DocumentsPage';
import ChatPage from './pages/ChatPage';
import SettingsPage from './pages/SettingsPage';
import ClientMessagesPage from './pages/ClientMessagesPage';
import InvitationsPage from './pages/InvitationsPage';
import AcceptInvitePage from './pages/AcceptInvitePage';
import ClientDocumentsPage from './pages/ClientDocumentsPage';
import ClientReceivedDocumentsPage from './pages/ClientReceivedDocumentsPage';
import ProfilePage from './pages/ProfilePage';
import TasksPage from './pages/TasksPage';
import NotesPage from './pages/NotesPage';
import TeamMemberPage from './pages/TeamMemberPage';
import EquipePage from './pages/EquipePage';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Routes publiques */}
          <Route path="/login"    element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/accept-invitation" element={<AcceptInvitePage />} />

          {/* Routes protégées — nécessitent un JWT valide */}
          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              <Route index element={<DashboardPage />} />
              <Route path="clients" element={<ClientsListPage />} />
              <Route path="clients/:clientId" element={<ClientDetailPage />} />
              <Route path="clients/:clientId/invoices/:invoiceId" element={<DocumentDetailPage />} />
              <Route path="tasks" element={<TasksPage />} />
              <Route path="notes" element={<NotesPage />} />
              <Route path="documents" element={<DocumentsPage />} />
              <Route path="chat" element={<ChatPage />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="accounting-entry" element={<AccountingEntryPage />} />
              <Route path="team/:memberId" element={<TeamMemberPage />} />
              <Route path="equipe" element={<EquipePage />} />
              <Route path="equipe/:memberId" element={<TeamMemberPage />} />
              <Route path="invitations" element={<InvitationsPage />} />
              <Route path="client/documents" element={<ClientDocumentsPage />} />
              <Route path="client/documents/received" element={<ClientReceivedDocumentsPage />} />
              <Route path="client/messages" element={<ClientMessagesPage />} />
              <Route path="client/profile" element={<ProfilePage />} />
              <Route path="profile" element={<ProfilePage />} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
