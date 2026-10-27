import { useState } from 'react';
import { FinanceProvider } from './context/FinanceContext';
import Layout from './components/Layout';
import { NavTab } from './types';
import Dashboard from './components/dashboard/Dashboard';
import Simulator from './components/simulator/Simulator';
import CreditCards from './components/cards/CreditCards';
import Installments from './components/installments/Installments';
import Checklist from './components/checklist/Checklist';
import Investments from './components/investments/Investments';
import FixedIncome from './components/income/FixedIncome';

function AppContent() {
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard': return <Dashboard />;
      case 'simulator': return <Simulator />;
      case 'cards': return <CreditCards />;
      case 'installments': return <Installments />;
      case 'checklist': return <Checklist />;
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
