import Dexie from 'dexie'

// Define the database and its structure
export const db = new Dexie('onyxsheets')

db.version(1).stores({
  sheets: '++id, name, createdAt, updatedAt',
  columns: '++id, sheetId, name, type, position',
  rows: '++id, sheetId, position, createdAt',
  cells: '++id, rowId, columnId, value'
})

// ── SHEET OPERATIONS ──────────────────────────────────────

export async function createSheet(name) {
  const now = Date.now()
  const sheetId = await db.sheets.add({
    name,
    createdAt: now,
    updatedAt: now
  })
  return sheetId
}

export async function getSheets() {
  return await db.sheets.orderBy('createdAt').reverse().toArray()
}

export async function updateSheetName(sheetId, name) {
  await db.sheets.update(sheetId, { name, updatedAt: Date.now() })
}

export async function deleteSheet(sheetId) {
  // Get all columns for this sheet
  const columns = await db.columns.where('sheetId').equals(sheetId).toArray()
  const columnIds = columns.map(c => c.id)

  // Get all rows for this sheet
  const rows = await db.rows.where('sheetId').equals(sheetId).toArray()
  const rowIds = rows.map(r => r.id)

  // Delete all cells belonging to those rows
  await db.cells.where('rowId').anyOf(rowIds).delete()

  // Delete all rows
  await db.rows.where('sheetId').equals(sheetId).delete()

  // Delete all columns
  await db.columns.where('sheetId').equals(sheetId).delete()

  // Delete the sheet itself
  await db.sheets.delete(sheetId)
}

// ── COLUMN OPERATIONS ─────────────────────────────────────

export async function createColumn(sheetId, name, type, position) {
  const colId = await db.columns.add({ sheetId, name, type, position })
  return colId
}

export async function getColumns(sheetId) {
  return await db.columns
    .where('sheetId')
    .equals(sheetId)
    .sortBy('position')
}

export async function updateColumn(columnId, changes) {
  await db.columns.update(columnId, changes)
}

export async function deleteColumn(columnId, sheetId) {
  // Delete all cells in this column
  await db.cells.where('columnId').equals(columnId).delete()

  // Delete the column
  await db.columns.delete(columnId)

  // Reorder remaining columns
  const remaining = await db.columns
    .where('sheetId')
    .equals(sheetId)
    .sortBy('position')

  for (let i = 0; i < remaining.length; i++) {
    await db.columns.update(remaining[i].id, { position: i })
  }
}

// ── ROW OPERATIONS ────────────────────────────────────────

export async function createRow(sheetId, cellData) {
  // Count existing rows to set position
  const count = await db.rows.where('sheetId').equals(sheetId).count()

  const rowId = await db.rows.add({
    sheetId,
    position: count,
    createdAt: Date.now()
  })

  // Create a cell for each column value
  for (const [columnId, value] of Object.entries(cellData)) {
    await db.cells.add({
      rowId,
      columnId: Number(columnId),
      value: String(value)
    })
  }

  return rowId
}

export async function getRows(sheetId) {
  const rows = await db.rows
    .where('sheetId')
    .equals(sheetId)
    .sortBy('createdAt')

  // Attach cells to each row
  for (const row of rows) {
    const cells = await db.cells.where('rowId').equals(row.id).toArray()
    row.cells = {}
    for (const cell of cells) {
      row.cells[cell.columnId] = cell.value
    }
  }

  return rows
}

export async function updateCell(rowId, columnId, value) {
  // Check if cell exists
  const existing = await db.cells
    .where('rowId').equals(rowId)
    .and(c => c.columnId === columnId)
    .first()

  if (existing) {
    await db.cells.update(existing.id, { value: String(value) })
  } else {
    await db.cells.add({ rowId, columnId, value: String(value) })
  }
}

export async function deleteRow(rowId, sheetId) {
  // Delete all cells in this row
  await db.cells.where('rowId').equals(rowId).delete()

  // Delete the row
  await db.rows.delete(rowId)

  // Reorder remaining rows
  const remaining = await db.rows
    .where('sheetId')
    .equals(sheetId)
    .sortBy('position')

  for (let i = 0; i < remaining.length; i++) {
    await db.rows.update(remaining[i].id, { position: i })
  }
}

export async function duplicateRow(rowId, sheetId) {
  // Get the original row
  const original = await db.rows.get(rowId)
  const cells = await db.cells.where('rowId').equals(rowId).toArray()

  // Count rows to position at end
  const count = await db.rows.where('sheetId').equals(sheetId).count()

  // Create new row
  const newRowId = await db.rows.add({
    sheetId,
    position: count,
    createdAt: Date.now()
  })

  // Duplicate all cells
  for (const cell of cells) {
    await db.cells.add({
      rowId: newRowId,
      columnId: cell.columnId,
      value: cell.value
    })
  }

  return newRowId
}

// ── FREE TIER LIMIT CHECKS ────────────────────────────────

export const FREE_LIMITS = {
  sheets: 5,
  rowsPerSheet: 100
}

export async function canCreateSheet() {
  const count = await db.sheets.count()
  return count < FREE_LIMITS.sheets
}

export async function canAddRow(sheetId) {
  const count = await db.rows.where('sheetId').equals(sheetId).count()
  return count < FREE_LIMITS.rowsPerSheet
}