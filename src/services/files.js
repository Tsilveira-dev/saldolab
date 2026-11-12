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
  // Some spreadsheet consumers skip whitespace/control prefixes before formulas.
  // Guard those cells before applying standard CSV quoting.
  let cursor = 0;
  while (cursor < text.length) {
    const character = text[cursor];
    const code = text.charCodeAt(cursor);
    if (
      code <= 31 ||
      code === 127 ||
      /\s/u.test(character) ||
      (code >= 0x200b && code <= 0x200d) ||
      code === 0x2060
    ) {
      cursor += 1;
    } else {
      break;
    }
  }
  const formula = /^[=+\-@]/u.test(text.slice(cursor));
  const leadingControl = [9, 10, 13].includes(text.charCodeAt(0));
  if (formula || leadingControl) text = `'${text}`;
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
