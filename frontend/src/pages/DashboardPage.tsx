import { useNavigate } from 'react-router-dom';
import AccountingDashboardHome from '../features/dashboard/AccountingDashboardHome';

export default function DashboardPage() {
  const navigate = useNavigate();
  return (
    <AccountingDashboardHome
      onViewDocuments={() => navigate('/clients')}
      onViewAllValidation={() => navigate('/clients')}
      onViewAllActivity={() => navigate('/clients')}
    />
  );
}
