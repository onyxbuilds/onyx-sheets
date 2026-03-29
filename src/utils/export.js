// ── EXPORT ENGINE ─────────────────────────────────────────
// CSV export: free tier
// Excel export: pro tier

import { getDisplayValue } from './formulas'

// ── CSV EXPORT ────────────────────────────────────────────

export function exportToCSV(sheet, columns, rows) {
  // Build header row
  const headers = columns.map(col => escapeCsvValue(col.name))
  const lines = [headers.join(',')]

  // Build data rows
  for (const row of rows) {
    const values = columns.map(col => {
      const raw = row.cells?.[col.id] ?? ''
      const display = getDisplayValue(raw, rows, columns)
      return escapeCsvValue(String(display))
    })
    lines.push(values.join(','))
  }

  const csvContent = lines.join('\n')
  downloadFile(csvContent, `${sheet.name}.csv`, 'text/csv')
}

function escapeCsvValue(value) {
  // Wrap in quotes if contains comma, quote, or newline
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

// ── EXCEL EXPORT ──────────────────────────────────────────
// Uses SheetJS (xlsx) library
// Only available on pro tier

export async function exportToExcel(sheet, columns, rows) {
  // Dynamically import xlsx only when needed
  const XLSX = await import('xlsx')

  // Build data array
  const data = []

  // Header row
  data.push(columns.map(col => col.name))

  // Data rows
  for (const row of rows) {
    const values = columns.map(col => {
      const raw = row.cells?.[col.id] ?? ''
      const display = getDisplayValue(raw, rows, columns)

      // Try to keep numbers as numbers
      if (col.type === 'number') {
        const num = parseFloat(display)
        return isNaN(num) ? display : num
      }

      return String(display)
    })
    data.push(values)
  }

  // Create workbook
  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.aoa_to_sheet(data)

  // Style header row bold
  const range = XLSX.utils.decode_range(ws['!ref'])
  for (let c = range.s.c; c <= range.e.c; c++) {
    const cellRef = XLSX.utils.encode_cell({ r: 0, c })
    if (ws[cellRef]) {
      ws[cellRef].s = { font: { bold: true } }
    }
  }

  // Set column widths
  ws['!cols'] = columns.map(() => ({ wch: 20 }))

  XLSX.utils.book_append_sheet(wb, ws, sheet.name)

  // Download
  XLSX.writeFile(wb, `${sheet.name}.xlsx`)
}

// ── CSV IMPORT ────────────────────────────────────────────
// Parse a CSV file into columns and rows
// Pro tier feature

export function parseCSV(text) {
  const lines = text.trim().split('\n')
  if (lines.length < 2) return null

  const headers = parseCSVLine(lines[0])
  const rows = []

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i])
    const row = {}
    headers.forEach((header, idx) => {
      row[header] = values[idx] ?? ''
    })
    rows.push(row)
  }

  return { headers, rows }
}

function parseCSVLine(line) {
  const values = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === ',' && !inQuotes) {
      values.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }

  values.push(current.trim())
  return values
}

// ── FILE DOWNLOAD HELPER ──────────────────────────────────

function downloadFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// — PDF EXPORT
export async function exportToPDF(sheet, columns, rows) {
  const { jsPDF } = await import('jspdf')
    const doc = new jsPDF({ orientation: 'landscape' })

      doc.setFontSize(16)
        doc.text(sheet.name, 14, 20)

          doc.setFontSize(8)
            doc.setFont('helvetica', 'bold')

              const colWidth = 40
                const startX = 14
                  let y = 32

                    // Header row
                      columns.forEach((col, i) => {
                          doc.text(col.name, startX + i * colWidth, y)
                            })

                              doc.setFont('helvetica', 'normal')
                                y += 8

                                  // Data rows
                                    for (const row of rows) {
                                        if (y > 190) {
                                              doc.addPage()
                                                    y = 20
                                                        }
                                                            columns.forEach((col, i) => {
                                                                  const val = String(row.cells?.[col.id] || '')
                                                                        doc.text(val.substring(0, 18), startX + i * colWidth, y)
                                                                            })
                                                                                y += 7
                                                                                  }

                                                                                    doc.save(`${sheet.name}.pdf`)
                                                                                    }