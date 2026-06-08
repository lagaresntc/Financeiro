import { useState } from 'react';
import { FinanceProvider } from './context/FinanceContext';
import Layout from './components/Layout';
import { NavTab } from './types';
import Dashboard from './components/dashboard/Dashboard';
import CreditCards from './components/cards/CreditCards';
import Installments from './components/installments/Installments';
import Investments from './components/investments/Investments';
import FixedIncome from './components/income/FixedIncome';

function AppContent() {
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard': return <Dashboard />;
      case 'cards': return <CreditCards />;
      case 'installments': return <Installments />;
      case 'investments': return <Investments />;
      case 'income': return <FixedIncome />;
    }
  };

  return (
    <Layout activeTab={activeTab} setActiveTab={setActiveTab}>
      {renderContent()}
    </Layout>
  );
}

export default function App() {
  return (
    <FinanceProvider>
      <AppContent />
    </FinanceProvider>
  );
}
