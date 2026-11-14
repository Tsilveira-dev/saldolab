import { Suspense, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  ArrowLeftRight,
  Wallet,
  Tags,
  ChartPie,
  ChartNoAxesCombined,
  Settings,
  Menu,
  X,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Moon,
  Sun,
  ShieldCheck,
  ArrowUpRight,
  HardDrive,
  Cloud,
  Plus,
} from 'lucide-react';
import { useFinance } from '../context/FinanceContext';
import { monthLabel, shiftMonth } from '../domain/finance';
import Editors, { Confirmation } from '../components/Editors';
import { Toast } from '../components/ui';
import StorageRecovery from '../pages/StorageRecovery';
import EditingNotice from '../components/EditingNotice';
import { authClient } from '../auth/neonClient';

const navigation = [
  ['/', 'Dashboard', LayoutDashboard],
  ['/transacoes', 'Transações', ArrowLeftRight],
  ['/contas', 'Contas', Wallet],
  ['/categorias', 'Categorias', Tags],
  ['/orcamentos', 'Orçamentos', ChartPie],
  ['/relatorios', 'Relatórios', ChartNoAxesCombined],
  ...(authClient ? [['/nuvem', 'Minha conta', Cloud]] : []),
];
function PageFallback() {
  return (
    <div className="loading-state" role="status">
      Carregando página…
    </div>
  );
}

export default function Layout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const {
    mode,
    theme,
    setTheme,
    month,
    setMonth,
    accountId,
    setAccountId,
    data,
    loading,
    error,
    setEditor,
    toast,
    setToast,
    canWrite,
  } = useFinance();
  const location = useLocation();
  const page = navigation.find(([path]) => path === location.pathname)?.[1] ?? 'Configurações';
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Pular para o conteúdo
      </a>
      {menuOpen && (
        <button
          className="sidebar-scrim"
          aria-label="Fechar menu"
          onClick={() => setMenuOpen(false)}
        />
      )}
      <aside className={`sidebar ${menuOpen ? 'open' : ''}`} aria-label="Navegação principal">
        <NavLink to="/" className="brand" onClick={() => setMenuOpen(false)}>
          <span className="brand-symbol">
            <i />
            <i />
            <i />
          </span>
          <span>
            saldo<span className="brand-light">lab</span>
            <span className="brand-point">.</span>
          </span>
        </NavLink>
        <button
          className="mobile-close icon-button"
          onClick={() => setMenuOpen(false)}
          aria-label="Fechar menu"
        >
          <X size={20} />
        </button>
        <div className="workspace-label">
          <span className="workspace-avatar">SL</span>
          <span>
            <strong>Meu espaço financeiro</strong>
            <small>Finanças pessoais</small>
          </span>
          <ChevronDown size={15} />
        </div>
        <div className="nav-caption">PRINCIPAL</div>
        <nav>
          {navigation.map(([path, label, Icon]) => (
            <NavLink
              key={path}
              to={path}
              end={path === '/'}
              onClick={() => setMenuOpen(false)}
              className={({ isActive }) => `nav-item-custom ${isActive ? 'active' : ''}`}
            >
              <Icon size={19} strokeWidth={1.7} />
              <span>{label}</span>
              {label === 'Dashboard' && <span className="active-nav-dot" />}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <span className="note-icon">
              <ShieldCheck size={22} />
            </span>
            <strong>
              Pequenos hábitos.
              <br />
              Grandes conquistas.
            </strong>
            <p>Cuidar do seu dinheiro começa com clareza.</p>
            <NavLink to="/orcamentos" onClick={() => setMenuOpen(false)}>
              Planejar meu mês <ArrowUpRight size={15} />
            </NavLink>
          </div>
          <NavLink
            className="nav-item-custom settings-link"
            to="/configuracoes"
            onClick={() => setMenuOpen(false)}
          >
            <Settings size={19} strokeWidth={1.7} />
            <span>Configurações</span>
          </NavLink>
          <div className="sidebar-footer">
            <span>APARÊNCIA</span>
            <button
              className="theme-switch"
              onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
              aria-label={theme === 'light' ? 'Ativar modo escuro' : 'Ativar modo claro'}
            >
              {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
              <span>{theme === 'light' ? 'Claro' : 'Escuro'}</span>
            </button>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb-custom">
            <button
              className="icon-button mobile-menu"
              onClick={() => setMenuOpen(true)}
              aria-label="Abrir menu"
            >
              <Menu size={22} />
            </button>
            <span>Meu espaço</span>
            <span className="breadcrumb-divider">/</span>
            <strong>{page}</strong>
          </div>
          <div className="topbar-right">
            {authClient && (
              <NavLink
                className="profile-avatar"
                to="/nuvem"
                aria-label="Minha conta"
                title="Minha conta"
              >
                SL
              </NavLink>
            )}
          </div>
        </header>
        <main id="main-content" className="main-content">
          {location.pathname !== '/nuvem' && <EditingNotice />}
          {location.pathname === '/nuvem' ? (
            <Suspense fallback={<PageFallback />}>
              <Outlet />
            </Suspense>
          ) : loading ? (
            <div className="loading-state" role="status">
              <div className="spinner-border spinner-border-sm" />
              <span>Organizando suas finanças…</span>
            </div>
          ) : error ? (
            <StorageRecovery />
          ) : (
            data && (
              <>
                {location.pathname !== '/configuracoes' && (
                  <div className="period-toolbar">
                    <span className="period-caption">
                      <span className="live-dot" />
                      Seu dinheiro, em perspectiva
                    </span>
                    <div className="period-controls">
                      <label>
                        <span className="visually-hidden">Filtrar por conta</span>
                        <select
                          className="form-select account-filter"
                          value={accountId}
                          onChange={(event) => setAccountId(event.target.value)}
                        >
                          <option value="">Todas as contas</option>
                          {data.accounts.map((account) => (
                            <option key={account.id} value={account.id}>
                              {account.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <div className="month-control">
                        <button
                          className="icon-button"
                          aria-label="Mês anterior"
                          onClick={() => setMonth(shiftMonth(month, -1))}
                        >
                          <ChevronLeft size={16} />
                        </button>
                        <label title={monthLabel(month)}>
                          <span className="visually-hidden">Mês de referência</span>
                          <input
                            aria-label="Mês de referência"
                            type="month"
                            value={month}
                            onChange={(event) => {
                              if (event.target.value && /^\d{4}-\d{2}$/.test(event.target.value))
                                setMonth(event.target.value);
                            }}
                          />
                        </label>
                        <button
                          className="icon-button"
                          aria-label="Próximo mês"
                          onClick={() => setMonth(shiftMonth(month, 1))}
                        >
                          <ChevronRight size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                )}
                <Suspense fallback={<PageFallback />}>
                  <Outlet />
                </Suspense>
                <footer className="content-footer">
                  <span>
                    SaldoLab <span className="footer-dot">·</span> Clareza para o seu próximo passo.
                  </span>
                  <span>
                    <HardDrive size={12} />
                    {mode === 'cloud'
                      ? 'Dados salvos na sua conta'
                      : 'Dados somente neste dispositivo'}
                  </span>
                </footer>
                <button
                  className="mobile-fab"
                  disabled={!canWrite}
                  onClick={() => setEditor({ entity: 'transactions' })}
                  aria-label="Adicionar transação"
                >
                  <Plus size={24} />
                </button>
              </>
            )
          )}
        </main>
      </div>
      <Editors />
      <Confirmation />
      <Toast toast={toast} dismiss={() => setToast(null)} />
    </div>
  );
}
