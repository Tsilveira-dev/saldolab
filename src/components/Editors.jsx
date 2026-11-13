import { useEffect, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useFinance } from '../context/FinanceContext';
import {
  transactionFormSchema,
  accountFormSchema,
  categoryFormSchema,
  budgetFormSchema,
  icons,
} from '../domain/schemas';
import { centsInput, parseMoney, today } from '../domain/finance';
import { Field, InlineError } from './ui';
import Modal from './Modal';

const accountTypes = {
  checking: 'Conta corrente',
  digital: 'Conta digital',
  savings: 'Poupança / reserva',
  cash: 'Carteira',
};
const iconLabels = {
  wallet: 'Carteira',
  bank: 'Banco',
  credit: 'Cartão',
  food: 'Alimentação',
  home: 'Casa',
  car: 'Transporte',
  book: 'Livro',
  heart: 'Saúde',
  coffee: 'Café',
  shopping: 'Compras',
  briefcase: 'Trabalho',
  chart: 'Investimentos',
  tag: 'Etiqueta',
};
export default function Editors() {
  const { editor, setEditor } = useFinance();
  if (!editor) return null;
  return (
    <Editor
      key={`${editor.entity}-${editor.row?.id ?? 'new'}`}
      entity={editor.entity}
      row={editor.row}
      initialType={editor.initialType}
      onClose={() => setEditor(null)}
    />
  );
}
function Editor({ entity, row, initialType, onClose }) {
  const { data, month, save, mutate, canWrite } = useFinance();
  const [error, setError] = useState('');
  const [categoryName, setCategoryName] = useState('');
  const [categoryError, setCategoryError] = useState('');
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [accountName, setAccountName] = useState('');
  const [accountInitialBalance, setAccountInitialBalance] = useState('0,00');
  const [accountError, setAccountError] = useState('');
  const [creatingAccount, setCreatingAccount] = useState(false);
  const defaults = {
    transactions: {
      description: row?.description ?? '',
      type: row?.type ?? 'expense',
      amount: row ? centsInput(row.amountCents) : '',
      categoryId: row?.categoryId ?? '',
      accountId: row?.accountId ?? data.accounts[0]?.id ?? '',
      destinationAccountId: row?.destinationAccountId ?? '',
      date: row?.date ?? today(),
      status: row?.status ?? 'confirmed',
      notes: row?.notes ?? '',
    },
    accounts: {
      name: row?.name ?? '',
      type: row?.type ?? 'checking',
      initialBalance: row ? centsInput(row.initialBalanceCents) : '0,00',
      color: row?.color ?? '#4d6386',
      icon: row?.icon ?? 'bank',
    },
    categories: {
      name: row?.name ?? '',
      type: row?.type ?? initialType ?? 'expense',
      color: row?.color ?? '#408f88',
      icon: row?.icon ?? 'tag',
    },
    budgets: {
      categoryId: row?.categoryId ?? '',
      month: row?.month ?? month,
      limit: row ? centsInput(row.limitCents) : '',
    },
  };
  const schema = {
    transactions: transactionFormSchema,
    accounts: accountFormSchema,
    categories: categoryFormSchema,
    budgets: budgetFormSchema,
  }[entity];
  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: defaults[entity],
    shouldFocusError: true,
  });
  const type = useWatch({ control, name: 'type' });
  const selectedCategoryId = useWatch({ control, name: 'categoryId' });
  const missingAccount = entity === 'transactions' && !data.accounts.length;
  const missingCategory =
    entity === 'transactions' &&
    type !== 'transfer' &&
    !data.categories.some((category) => category.type === type);
  useEffect(() => {
    if (
      entity === 'transactions' &&
      type !== 'transfer' &&
      selectedCategoryId &&
      !data.categories.some(
        (category) => category.id === selectedCategoryId && category.type === type,
      )
    )
      setValue('categoryId', '');
  }, [entity, type, selectedCategoryId, data.categories, setValue]);
  async function createAccount() {
    if (!canWrite || creatingAccount) return;
    const parsed = accountFormSchema.safeParse({
      name: accountName.trim(),
      type: 'checking',
      initialBalance: accountInitialBalance,
      color: '#4d6386',
      icon: 'bank',
    });
    if (!parsed.success) {
      setAccountError('Confira o nome da conta e o saldo inicial (ex.: 0,00).');
      return;
    }
    setCreatingAccount(true);
    setAccountError('');
    try {
      const { initialBalance, ...rest } = parsed.data;
      const created = await mutate(
        (repo) =>
          repo.create('accounts', {
            ...rest,
            initialBalanceCents: parseMoney(initialBalance),
            createdAt: today(),
          }),
        'Conta criada. Conclua a transação.',
      );
      if (created?.id)
        setValue('accountId', created.id, { shouldValidate: true, shouldDirty: true });
    } catch (cause) {
      setAccountError(cause.message ?? 'Não foi possível criar a conta.');
    } finally {
      setCreatingAccount(false);
    }
  }
  async function createCategory() {
    if (!canWrite || creatingCategory) return;
    const parsed = categoryFormSchema.safeParse({
      name: categoryName.trim(),
      type,
      color: '#408f88',
      icon: 'tag',
    });
    if (!parsed.success) {
      setCategoryError('Informe um nome de categoria entre 2 e 100 caracteres.');
      return;
    }
    setCreatingCategory(true);
    setCategoryError('');
    try {
      const created = await mutate(
        (repo) => repo.create('categories', parsed.data),
        'Categoria criada. Conclua a transação.',
      );
      if (created?.id) {
        setValue('categoryId', created.id, { shouldValidate: true, shouldDirty: true });
        setCategoryName('');
      }
    } catch (cause) {
      setCategoryError(cause.message ?? 'Não foi possível criar a categoria.');
    } finally {
      setCreatingCategory(false);
    }
  }
  const submit = handleSubmit(async (values) => {
    setError('');
    try {
      let payload = values;
      if (entity === 'transactions') {
        const { amount, ...rest } = values;
        payload = {
          ...rest,
          amountCents: parseMoney(amount),
          categoryId: type === 'transfer' ? null : values.categoryId,
          destinationAccountId: type === 'transfer' ? values.destinationAccountId : null,
        };
      }
      if (entity === 'accounts') {
        const { initialBalance, ...rest } = values;
        payload = {
          ...rest,
          initialBalanceCents: parseMoney(initialBalance),
          createdAt: row?.createdAt ?? today(),
        };
      }
      if (entity === 'budgets') {
        const { limit, ...rest } = values;
        payload = { ...rest, limitCents: parseMoney(limit) };
      }
      await save(entity, payload, row?.id, row);
      onClose();
    } catch (cause) {
      setError(cause.message);
    }
  });
  const field = (key, label, input, extra = {}) => (
    <Field key={key} label={label} error={errors[key]} {...extra}>
      {input}
    </Field>
  );
  const input = (key, props = {}) => (
    <input
      className={`form-control ${errors[key] ? 'is-invalid' : ''}`}
      aria-invalid={Boolean(errors[key])}
      {...register(key)}
      {...props}
    />
  );
  const select = (key, options, placeholder) => (
    <select
      className={`form-select ${errors[key] ? 'is-invalid' : ''}`}
      aria-invalid={Boolean(errors[key])}
      {...register(key)}
      {...(key === 'categoryId' ? { value: selectedCategoryId ?? '' } : {})}
    >
      {placeholder && <option value="">{placeholder}</option>}
      {options.map(([value, label]) => (
        <option key={value} value={value}>
          {label}
        </option>
      ))}
    </select>
  );
  const titles = {
    transactions: 'transação',
    accounts: 'conta',
    categories: 'categoria',
    budgets: 'orçamento',
  };
  return (
    <Modal
      title={`${row ? 'Editar' : 'Adicionar'} ${titles[entity]}`}
      onClose={onClose}
      busy={isSubmitting || creatingCategory || creatingAccount}
    >
      <form onSubmit={submit} noValidate>
        <div className="modal-body-custom">
          <InlineError message={error} />
          <fieldset
            className="form-grid"
            disabled={!canWrite || creatingCategory || creatingAccount}
          >
            {entity === 'transactions' && (
              <>
                {field(
                  'type',
                  'Tipo de movimentação',
                  select('type', [
                    ['expense', 'Despesa'],
                    ['income', 'Receita'],
                    ['transfer', 'Transferência'],
                  ]),
                  { className: 'full-width' },
                )}
                {field(
                  'description',
                  'Descrição',
                  input('description', { placeholder: 'Ex.: Compras do mês', maxLength: 100 }),
                  { className: 'full-width' },
                )}
                {field(
                  'amount',
                  'Valor (R$)',
                  input('amount', { inputMode: 'decimal', placeholder: '0,00' }),
                )}
                {field('date', 'Data', input('date', { type: 'date' }))}
                {field(
                  'accountId',
                  type === 'transfer' ? 'Conta de origem' : 'Conta',
                  select(
                    'accountId',
                    data.accounts.map((account) => [account.id, account.name]),
                    'Selecione a conta',
                  ),
                )}
                {type === 'transfer'
                  ? field(
                      'destinationAccountId',
                      'Conta de destino',
                      select(
                        'destinationAccountId',
                        data.accounts.map((account) => [account.id, account.name]),
                        'Selecione o destino',
                      ),
                    )
                  : field(
                      'categoryId',
                      'Categoria',
                      select(
                        'categoryId',
                        data.categories
                          .filter((category) => category.type === type)
                          .map((category) => [category.id, category.name]),
                        'Selecione a categoria',
                      ),
                    )}
                {missingAccount && (
                  <div className="full-width alert alert-info">
                    <p role="status">
                      Você ainda não tem contas. Cadastre uma aqui para continuar sem perder os
                      dados da transação.
                    </p>
                    <label className="d-block">
                      Nome da nova conta
                      <input
                        className="form-control mt-1"
                        value={accountName}
                        maxLength={100}
                        placeholder="Ex.: Conta de teste"
                        onChange={(event) => setAccountName(event.target.value)}
                      />
                    </label>
                    <label className="d-block mt-2">
                      Saldo inicial da conta (R$)
                      <input
                        className="form-control mt-1"
                        value={accountInitialBalance}
                        inputMode="decimal"
                        onChange={(event) => setAccountInitialBalance(event.target.value)}
                      />
                    </label>
                    <InlineError message={accountError} />
                    <button
                      className="btn btn-outline-secondary mt-2"
                      type="button"
                      disabled={creatingAccount || accountName.trim().length < 2}
                      onClick={createAccount}
                    >
                      {creatingAccount ? 'Criando conta…' : 'Criar conta e selecionar'}
                    </button>
                  </div>
                )}
                {missingCategory && (
                  <div className="full-width alert alert-info">
                    <p role="status">
                      Você ainda não tem categorias de {type === 'income' ? 'receita' : 'despesa'}.
                      Crie uma aqui para continuar; os dados desta transação serão mantidos.
                    </p>
                    <label className="d-block">
                      Nome da nova categoria
                      <input
                        className="form-control mt-1"
                        value={categoryName}
                        maxLength={100}
                        onChange={(event) => setCategoryName(event.target.value)}
                        placeholder={type === 'income' ? 'Ex.: Salário' : 'Ex.: Alimentação'}
                      />
                    </label>
                    <InlineError message={categoryError} />
                    <button
                      className="btn btn-outline-secondary mt-2"
                      type="button"
                      disabled={creatingCategory || categoryName.trim().length < 2}
                      onClick={createCategory}
                    >
                      {creatingCategory
                        ? 'Criando categoria…'
                        : `Criar categoria de ${type === 'income' ? 'receita' : 'despesa'}`}
                    </button>
                  </div>
                )}
                {field(
                  'status',
                  'Status',
                  select('status', [
                    ['confirmed', 'Confirmado'],
                    ['pending', 'Pendente'],
                  ]),
                  { className: 'full-width' },
                )}
                {field(
                  'notes',
                  'Observações (opcional)',
                  <textarea
                    className="form-control"
                    {...register('notes')}
                    rows={3}
                    maxLength={1000}
                  />,
                  { className: 'full-width' },
                )}
              </>
            )}
            {entity === 'accounts' && (
              <>
                {field(
                  'name',
                  'Nome da conta',
                  input('name', { placeholder: 'Ex.: Minha conta corrente' }),
                  { className: 'full-width' },
                )}
                {field('type', 'Tipo da conta', select('type', Object.entries(accountTypes)))}
                {field(
                  'initialBalance',
                  'Saldo inicial (R$)',
                  input('initialBalance', { inputMode: 'decimal' }),
                  { hint: 'Pode ser negativo. Movimentações serão somadas a esse valor.' },
                )}
              </>
            )}
            {entity === 'categories' && (
              <>
                {field(
                  'name',
                  'Nome da categoria',
                  input('name', { placeholder: 'Ex.: Alimentação' }),
                  { className: 'full-width' },
                )}
                {field(
                  'type',
                  'Tipo',
                  select('type', [
                    ['expense', 'Despesa'],
                    ['income', 'Receita'],
                  ]),
                  { className: 'full-width' },
                )}
              </>
            )}
            {(entity === 'accounts' || entity === 'categories') && (
              <>
                {field(
                  'icon',
                  'Ícone',
                  select(
                    'icon',
                    icons.map((icon) => [icon, iconLabels[icon]]),
                  ),
                )}
                {field(
                  'color',
                  'Cor de identificação',
                  input('color', { type: 'color', className: 'form-control form-control-color' }),
                )}
              </>
            )}
            {entity === 'budgets' && (
              <>
                {field(
                  'categoryId',
                  'Categoria de despesa',
                  select(
                    'categoryId',
                    data.categories
                      .filter((category) => category.type === 'expense')
                      .map((category) => [category.id, category.name]),
                    'Selecione a categoria',
                  ),
                  { className: 'full-width' },
                )}
                {field('month', 'Mês do orçamento', input('month', { type: 'month' }))}
                {field(
                  'limit',
                  'Limite mensal (R$)',
                  input('limit', { inputMode: 'decimal', placeholder: '0,00' }),
                )}
              </>
            )}
          </fieldset>
        </div>
        <div className="modal-footer-custom">
          <button
            type="button"
            disabled={isSubmitting || creatingCategory || creatingAccount}
            className="btn btn-light"
            onClick={onClose}
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={
              isSubmitting ||
              !canWrite ||
              creatingCategory ||
              creatingAccount ||
              missingAccount ||
              missingCategory
            }
            className="btn btn-primary"
          >
            {isSubmitting ? 'Salvando…' : row ? 'Salvar alterações' : 'Adicionar registro'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
export function Confirmation() {
  const { confirmation, setConfirmation, canWrite } = useFinance();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (!confirmation) return null;
  const close = () => {
    setError('');
    setConfirmation(null);
  };
  const confirm = async () => {
    setBusy(true);
    setError('');
    try {
      await confirmation.action();
      close();
    } catch (cause) {
      setError(cause.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal title={confirmation.title} onClose={close} busy={busy}>
      <div className="modal-body-custom">
        <p>{confirmation.message}</p>
        <InlineError message={error} />
      </div>
      <div className="modal-footer-custom">
        <button disabled={busy} className="btn btn-light" onClick={close}>
          Cancelar
        </button>
        <button
          disabled={busy || !canWrite}
          className={`btn ${confirmation.danger ? 'btn-danger' : 'btn-primary'}`}
          onClick={confirm}
        >
          {busy ? 'Aguarde…' : (confirmation.confirmLabel ?? 'Confirmar')}
        </button>
      </div>
    </Modal>
  );
}
