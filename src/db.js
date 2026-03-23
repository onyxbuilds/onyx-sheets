import Dexie from 'dexie'

export const db = new Dexie('onyxsheets')

db.version(1).stores({
  sheets: '++id, name, createdAt, updatedAt',
  columns: '++id, sheetId, name, type, position',
  rows: '++id, sheetId, createdAt',
  cells: '++id, rowId, columnId, value'
})

// — SHEET OPERATIONS —

export async function createSheet(name) {
  const now = Date.now()
  const sheetId = await db.sheets.add({ name, createdAt: now, updatedAt: now })
  return sheetId
}

export async function getSheets() {
  return await db.sheets.orderBy('createdAt').reverse().toArray()
}

export async function updateSheetName(sheetId, name) {
  await db.sheets.update(sheetId, { name, updatedAt: Date.now() })
}

export async function deleteSheet(sheetId) {
  const rows = await db.rows.where('sheetId').equals(sheetId).toArray()
  const rowIds = rows.map(r => r.id)
  await db.cells.where('rowId').anyOf(rowIds).delete()
  await db.rows.where('sheetId').equals(sheetId).delete()
  await db.columns.where('sheetId').equals(sheetId).delete()
  await db.sheets.delete(sheetId)
}

// — COLUMN OPERATIONS —

export async function createColumn(sheetId, name, type, position) {
  const colId = await db.columns.add({ sheetId, name, type, position })
  return colId
}

export async function getColumns(sheetId) {
  return await db.columns.where('sheetId').equals(sheetId).sortBy('position')
}

export async function updateColumn(columnId, changes) {
  await db.columns.update(columnId, changes)
}

export async function deleteColumn(columnId, sheetId) {
  await db.cells.where('columnId').equals(columnId).delete()
  await db.columns.delete(columnId)
  const remaining = await db.columns.where('sheetId').equals(sheetId).sortBy('position')
  for (let i = 0; i < remaining.length; i++) {
    await db.columns.update(remaining[i].id, { position: i })
  }
}

// — ROW OPERATIONS —

export async function createRow(sheetId, cellData) {
  const rowId = await db.rows.add({ sheetId, createdAt: Date.now() })
  for (const [columnId, value] of Object.entries(cellData)) {
    if (String(value).trim()) {
      await db.cells.add({ rowId, columnId: Number(columnId), value: String(value) })
    }
  }
  return rowId
}

export async function getRows(sheetId) {
  const rows = await db.rows.where('sheetId').equals(sheetId).sortBy('createdAt')
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
  await db.cells.where('rowId').equals(rowId).delete()
  await db.rows.delete(rowId)
}

export async function duplicateRow(rowId, sheetId) {
  const cells = await db.cells.where('rowId').equals(rowId).toArray()
  const newRowId = await db.rows.add({ sheetId, createdAt: Date.now() })
  for (const cell of cells) {
    await db.cells.add({ rowId: newRowId, columnId: cell.columnId, value: cell.value })
  }
  return newRowId
}

// — FREE TIER LIMIT CHECKS —

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
