export function downloadFile(content, name, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const escapeCsv = (value) => {
  let text = String(value ?? '');
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
};
export function transactionsCsv(transactions, accounts, categories) {
  const lines = [
    [
      'ID',
      'Descrição',
      'Tipo',
      'Valor (BRL)',
      'Categoria',
      'Conta',
      'Destino',
      'Data',
      'Status',
      'Observações',
    ],
    ...transactions.map((tx) => [
      tx.id,
      tx.description,
      { income: 'Receita', expense: 'Despesa', transfer: 'Transferência' }[tx.type],
      (tx.amountCents / 100).toFixed(2).replace('.', ','),
      categories.find((row) => row.id === tx.categoryId)?.name ?? '',
      accounts.find((row) => row.id === tx.accountId)?.name,
      accounts.find((row) => row.id === tx.destinationAccountId)?.name ?? '',
      tx.date,
      tx.status === 'confirmed' ? 'Confirmado' : 'Pendente',
      tx.notes,
    ]),
  ];
  return '\ufeff' + lines.map((row) => row.map(escapeCsv).join(';')).join('\r\n');
}
