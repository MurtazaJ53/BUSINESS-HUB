import React from 'react';
import AppLayout from './components/AppLayout';
import Dashboard from './pages/Dashboard';
import Inventory from './pages/Inventory';
import POS from './pages/POS';
import Analytics from './pages/Analytics';
import Settings from './pages/Settings';
import History from './pages/History';
import Customers from './pages/Customers';

const PAGES: Record<string, React.ReactNode> = {
  dashboard: <Dashboard />,
  inventory: <Inventory />,
  pos: <POS />,
  analytics: <Analytics />,
  history: <History />,
  customers: <Customers />,
  settings: <Settings />,
};

export default function App() {
  return <AppLayout pages={PAGES} />;
}
