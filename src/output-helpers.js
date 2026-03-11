import chalk from 'chalk';

export const success = (msg) => console.log(chalk.green('✓'), msg);
export const warn = (msg) => console.log(chalk.yellow('⚠'), msg);
export const error = (msg) => console.error(chalk.red('✗'), msg);
export const info = (msg) => console.log(chalk.blue('ℹ'), msg);

export const table = (rows, headers) => {
  if (!rows.length) return;

  const cols = headers || Object.keys(rows[0]);
  const widths = cols.map((col) => {
    const maxData = Math.max(...rows.map((r) => String(r[col] || '').length));
    return Math.max(col.length, maxData);
  });

  // Header
  const headerLine = cols.map((c, i) => c.padEnd(widths[i])).join('  ');
  console.log(chalk.bold(headerLine));
  console.log(widths.map((w) => '─'.repeat(w)).join('──'));

  // Rows
  for (const row of rows) {
    const line = cols.map((c, i) => String(row[c] || '').padEnd(widths[i])).join('  ');
    console.log(line);
  }
};
