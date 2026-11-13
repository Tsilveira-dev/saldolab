import { Component } from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import FinanceProvider from '../context/FinanceProvider';
import Layout from './Layout';
import Dashboard from '../pages/Dashboard';
import Transactions from '../pages/Transactions';
import Accounts from '../pages/Accounts';
import Categories from '../pages/Categories';
import Budgets from '../pages/Budgets';
import Reports from '../pages/Reports';
import Settings from '../pages/Settings';
import CloudAccess from '../pages/CloudAccess';

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
