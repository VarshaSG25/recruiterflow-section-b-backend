/**
 * Beautiful ASCII / Unicode Table Formatter with word wrapping,
 * alignment, and ANSI color support. Prevents horizontal line overflow
 * and misaligned table columns in terminal windows.
 */

export interface Column<T> {
  header: string;
  width: number;
  align?: 'left' | 'center' | 'right';
  value: (row: T, index: number) => string;
}

// Regex to strip ANSI escape codes when computing visual string width
const ANSI_REGEX = /\x1b\[[0-9;]*m/g;

export function stripAnsi(str: string): string {
  return str.replace(ANSI_REGEX, '');
}

/**
 * Splits text into lines of max `maxWidth` visual characters,
 * respecting word boundaries.
 */
export function wrapText(text: string, maxWidth: number): string[] {
  if (!text) return [''];
  const clean = String(text);
  const words = clean.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const candidate = currentLine ? `${currentLine} ${word}` : word;
    if (stripAnsi(candidate).length <= maxWidth) {
      currentLine = candidate;
    } else {
      if (currentLine) {
        lines.push(currentLine);
      }
      // If single word is longer than maxWidth, chunk it
      if (stripAnsi(word).length > maxWidth) {
        let remaining = word;
        while (stripAnsi(remaining).length > maxWidth) {
          lines.push(remaining.substring(0, maxWidth));
          remaining = remaining.substring(maxWidth);
        }
        currentLine = remaining;
      } else {
        currentLine = word;
      }
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines.length > 0 ? lines : [''];
}

/**
 * Pads a string to `targetWidth` with proper alignment
 */
export function padCell(content: string, targetWidth: number, align: 'left' | 'center' | 'right' = 'left'): string {
  const visualLength = stripAnsi(content).length;
  const paddingNeeded = Math.max(0, targetWidth - visualLength);

  if (align === 'center') {
    const leftPad = Math.floor(paddingNeeded / 2);
    const rightPad = paddingNeeded - leftPad;
    return ' '.repeat(leftPad) + content + ' '.repeat(rightPad);
  } else if (align === 'right') {
    return ' '.repeat(paddingNeeded) + content;
  } else {
    return content + ' '.repeat(paddingNeeded);
  }
}

/**
 * Formats an array of objects into a gorgeous boxed table.
 */
export function renderTable<T>(data: T[], columns: Column<T>[]): string {
  const GRAY = '\x1b[90m';
  const BOLD_CYAN = '\x1b[1m\x1b[36m';
  const RESET = '\x1b[0m';

  const output: string[] = [];

  // Top border: ┌──────┬──────┐
  const topBorder = GRAY + '┌' + columns.map(c => '─'.repeat(c.width + 2)).join('┬') + '┐' + RESET;
  output.push(topBorder);

  // Header row: │ Col1 │ Col2 │
  const headerCells = columns.map(c => {
    const padded = padCell(BOLD_CYAN + c.header + RESET, c.width, 'center');
    return ` ${padded} `;
  });
  output.push(GRAY + '│' + RESET + headerCells.join(GRAY + '│' + RESET) + GRAY + '│' + RESET);

  // Header separator: ├──────┼──────┤
  const headerSep = GRAY + '├' + columns.map(c => '─'.repeat(c.width + 2)).join('┼') + '┤' + RESET;
  output.push(headerSep);

  // Data rows
  data.forEach((row, rowIndex) => {
    // Generate wrapped lines for each cell in this row
    const cellLines: string[][] = columns.map(col => {
      const rawVal = col.value(row, rowIndex);
      return wrapText(rawVal, col.width);
    });

    // Row height is the max lines across all cells in this row
    const rowHeight = Math.max(...cellLines.map(lines => lines.length));

    for (let lineIdx = 0; lineIdx < rowHeight; lineIdx++) {
      const lineCells = columns.map((col, colIdx) => {
        const textSegment = cellLines[colIdx][lineIdx] || '';
        const padded = padCell(textSegment, col.width, col.align || 'left');
        return ` ${padded} `;
      });
      output.push(GRAY + '│' + RESET + lineCells.join(GRAY + '│' + RESET) + GRAY + '│' + RESET);
    }

    // Row divider (subtle dashed line or separator) except after last row
    if (rowIndex < data.length - 1) {
      const rowDivider = GRAY + '├' + columns.map(c => '┄'.repeat(c.width + 2)).join('┼') + '┤' + RESET;
      output.push(rowDivider);
    }
  });

  // Bottom border: └──────┴──────┘
  const bottomBorder = GRAY + '└' + columns.map(c => '─'.repeat(c.width + 2)).join('┴') + '┘' + RESET;
  output.push(bottomBorder);

  return output.join('\n');
}
