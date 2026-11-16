import { Component, lazy } from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import FinanceProvider from '../context/FinanceProvider';
import Layout from './Layout';
import Dashboard from '../pages/Dashboard';
const Transactions = lazy(() => import('../pages/Transactions'));
const Accounts = lazy(() => import('../pages/Accounts'));
const Categories = lazy(() => import('../pages/Categories'));
const Budgets = lazy(() => import('../pages/Budgets'));
const Reports = lazy(() => import('../pages/Reports'));
const Settings = lazy(() => import('../pages/Settings'));
const CloudAccess = lazy(() => import('../pages/CloudAccess'));

class ErrorBoundary extends Component {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  render() {
    if (this.state.error)
      return (
        <main className="error-boundary">
          <h1>Não foi possível abrir esta tela.</h1>
          <p>Recarregue a aplicação para tentar novamente. Os dados locais foram preservados.</p>
          <button className="btn btn-primary" onClick={() => window.location.reload()}>
            Recarregar
          </button>
        </main>
      );
    return this.props.children;
  }
}
export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <FinanceProvider>
          <Routes>
            <Route element={<Layout />}>
              <Route index element={<Dashboard />} />
              <Route path="transacoes" element={<Transactions />} />
              <Route path="contas" element={<Accounts />} />
              <Route path="categorias" element={<Categories />} />
              <Route path="orcamentos" element={<Budgets />} />
              <Route path="relatorios" element={<Reports />} />
              <Route path="configuracoes" element={<Settings />} />
              <Route path="nuvem" element={<CloudAccess />} />
              <Route
                path="*"
                element={
                  <div className="empty-state">
                    <h1>Página não encontrada</h1>
                    <Link className="btn btn-primary" to="/">
                      Voltar ao dashboard
                    </Link>
                  </div>
                }
              />
            </Route>
          </Routes>
        </FinanceProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
