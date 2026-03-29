// ── FORMULA ENGINE ────────────────────────────────────────
// Supports: SUM, AVG, COUNT, MIN, MAX (free tier)
// Usage in a cell: =SUM(B1:B10) or =AVG(C1:C5)

export function evaluateFormula(value, rows, columns) {
  if (!value || !String(value).startsWith('=')) return value

  const formula = String(value).slice(1).trim().toUpperCase()

  try {
    // Match function name and range e.g. SUM(B1:B10)
    const match = formula.match(/^(\w+)\(([A-Z]+\d+):([A-Z]+\d+)\)$/)
    if (!match) return '#ERROR'

    const [, fnName, startRef, endRef] = match

    // Parse column letter and row number from cell reference
    const parseRef = ref => {
      const col = ref.match(/[A-Z]+/)[0]
      const row = parseInt(ref.match(/\d+/)[0]) - 1
      return { col, row }
    }

    const start = parseRef(startRef)
    const end = parseRef(endRef)

    // Get column index from letter (A=0, B=1, etc)
    const colLetterToIndex = letter =>
      letter.charCodeAt(0) - 'A'.charCodeAt(0)

    const startColIdx = colLetterToIndex(start.col)
    const endColIdx = colLetterToIndex(end.col)
    const startRowIdx = start.row
    const endRowIdx = end.row

    // Collect all values in the range
    const values = []

    for (let r = startRowIdx; r <= endRowIdx; r++) {
      for (let c = startColIdx; c <= endColIdx; c++) {
        const row = rows[r]
        const col = columns[c]
        if (!row || !col) continue
        const cellValue = row.cells?.[col.id]
        const num = parseFloat(cellValue)
        if (!isNaN(num)) values.push(num)
      }
    }

    if (values.length === 0) return 0

    switch (fnName) {
      case 'SUM':
        return values.reduce((a, b) => a + b, 0)
      case 'AVG':
        return (values.reduce((a, b) => a + b, 0) / values.length).toFixed(2)
      case 'COUNT':
        return values.length
      case 'MIN':
        return Math.min(...values)
      case 'MAX':
        return Math.max(...values)
      default:
        return '#UNKNOWN'
    }
  } catch {
    return '#ERROR'
  }
}

// Check if a cell value is a formula
export function isFormula(value) {
  return String(value).startsWith('=')
}

// Get display value for a cell
// If it's a formula, evaluate it
// Otherwise return the raw value
export function getDisplayValue(value, rows, columns) {
  if (isFormula(value)) {
    return evaluateFormula(value, rows, columns)
  }
  return value ?? ''
}
export function formatCellValue(value, type) {
    if (!value || type !== 'date') return value
      const date = new Date(value)
        if (isNaN(date)) return value
          return date.toLocaleDateString(navigator.language, {
              day: '2-digit', month: '2-digit', year: 'numeric'
                })
                }
