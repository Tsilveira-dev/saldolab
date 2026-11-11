import {
  ArrowDownLeft,
  ArrowUpRight,
  ArrowLeftRight,
  Landmark,
  Wallet,
  CreditCard,
  Utensils,
  House,
  Car,
  BookOpen,
  Heart,
  Coffee,
  ShoppingBag,
  BriefcaseBusiness,
  ChartNoAxesCombined,
  Tag,
  Plus,
  Pencil,
  Trash2,
  Inbox,
  X,
  AlertCircle,
} from 'lucide-react';
import { money, percentChange } from '../domain/finance';

const iconMap = {
  bank: Landmark,
  wallet: Wallet,
  credit: CreditCard,
  food: Utensils,
  home: House,
  car: Car,
  book: BookOpen,
  heart: Heart,
  coffee: Coffee,
  shopping: ShoppingBag,
  briefcase: BriefcaseBusiness,
  chart: ChartNoAxesCombined,
  tag: Tag,
};
export function CategoryIcon({ name = 'tag', color = '#57867e', size = 18 }) {
  const Icon = iconMap[name] ?? Tag;
  return (
    <span className="category-icon" style={{ '--category-color': color }}>
      <Icon size={size} aria-hidden="true" />
    </span>
  );
}
export function TypeIcon({ type }) {
  const Icon =
    type === 'income' ? ArrowDownLeft : type === 'expense' ? ArrowUpRight : ArrowLeftRight;
  return (
    <span className={`type-icon ${type}`}>
      <Icon size={18} aria-hidden="true" />
    </span>
  );
}
export function EmptyState({
  title = 'Nada por aqui ainda',
  description = 'Adicione seu primeiro registro para começar.',
  action,
  label = 'Adicionar registro',
}) {
  return (
    <div className="empty-state">
      <Inbox size={32} aria-hidden="true" />
      <h3>{title}</h3>
      <p>{description}</p>
      {action && (
        <button className="btn btn-primary" onClick={action}>
          <Plus size={16} />
          {label}
        </button>
      )}
    </div>
  );
}
export function PageHeading({ eyebrow, title, description, action, label }) {
  return (
    <div className="page-heading">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action && (
        <button className="btn btn-primary" onClick={action}>
          <Plus size={18} />
          {label}
        </button>
      )}
    </div>
  );
}
export function Panel({ title, subtitle, action, children, className = '' }) {
  return (
    <section className={`panel ${className}`}>
      <div className="panel-heading">
        <div>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
export function RowActions({ name, onEdit, onDelete }) {
  return (
    <div className="row-actions">
      <button className="icon-button" aria-label={`Editar ${name}`} title="Editar" onClick={onEdit}>
        <Pencil size={15} />
      </button>
      <button
        className="icon-button delete-action"
        aria-label={`Excluir ${name}`}
        title="Excluir"
        onClick={onDelete}
      >
        <Trash2 size={15} />
      </button>
    </div>
  );
}
export function Change({ value, previous, expense = false }) {
  const change = percentChange(value, previous);
  const good = expense ? change <= 0 : change >= 0;
  return (
    <div className="metric-change">
      <span className={good ? 'text-positive' : 'text-negative'}>
        {change === null
          ? 'Novo período'
          : `${change >= 0 ? '↗' : '↘'} ${Math.abs(change).toFixed(1).replace('.', ',')}%`}
      </span>
      <span>vs. mês anterior</span>
    </div>
  );
}
export function BudgetBar({ item, category, showRemaining = true }) {
  return (
    <div className="budget-row">
      <div className="budget-row-heading">
        <span>
          <CategoryIcon name={category?.icon} color={category?.color} size={15} />
          {category?.name ?? 'Categoria'}
        </span>
        <strong className={item.percent >= 100 ? 'text-negative' : ''}>
          {Math.round(item.percent)}%
        </strong>
      </div>
      <div
        className="budget-track"
        role="progressbar"
        aria-label={`Orçamento ${category?.name}`}
        aria-valuenow={Math.round(item.percent)}
        aria-valuemin={0}
        aria-valuemax={Math.max(100, Math.round(item.percent))}
      >
        <span
          style={{
            width: `${Math.min(100, item.percent)}%`,
            background:
              item.percent >= 100
                ? '#c86a69'
                : item.percent >= 80
                  ? '#bb9557'
                  : (category?.color ?? '#57867e'),
          }}
        />
      </div>
      <div className="budget-caption">
        <span>
          {money(item.spent)} <small>de {money(item.limitCents)}</small>
        </span>
        {showRemaining && (
          <span>
            {item.remaining < 0
              ? `${money(-item.remaining)} excedidos`
              : `${money(item.remaining)} livres`}
          </span>
        )}
      </div>
    </div>
  );
}
export function Field({ label, error, children, hint, className = '' }) {
  return (
    <div className={`field ${className}`}>
      <label>
        {label}
        {children}
      </label>
      {hint && <small className="field-hint">{hint}</small>}
      {error && (
        <span className="field-error" role="alert">
          {error.message}
        </span>
      )}
    </div>
  );
}
export function InlineError({ message }) {
  return (
    message && (
      <div className="inline-error" role="alert">
        <AlertCircle size={17} />
        <span>{message}</span>
      </div>
    )
  );
}
export function Toast({ toast, dismiss }) {
  return (
    toast && (
      <div className={`app-toast ${toast.variant}`} role="status">
        <span className="toast-dot" />
        <span>{toast.message}</span>
        <button className="icon-button" aria-label="Fechar aviso" onClick={dismiss}>
          <X size={16} />
        </button>
      </div>
    )
  );
}
