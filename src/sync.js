import { supabase } from './supabase'

// Convert integer ID to stable UUID format
function intToUUID(id) {
  const hex = id.toString(16).padStart(12, '0')
  return `00000000-0000-4000-8000-${hex}`
}

// Convert UUID back to integer for Dexie
function uuidToInt(uuid) {
  if (!uuid) return Date.now()
  const hex = uuid.split('-').pop()
  return parseInt(hex, 16) || Date.now()
}

// Push local Dexie data to Supabase — batched for speed
export async function syncToCloud(userId, db) {
  try {
    const sheets = await db.sheets.toArray()
    if (!sheets.length) return

    // Batch upsert all sheets at once
    const sheetRows = sheets.map(sheet => ({
      id: intToUUID(sheet.id),
      user_id: userId,
      name: sheet.name,
      created_at: sheet.createdAt,
      updated_at: sheet.updatedAt,
      status: sheet.status || 'active',
      deleted_at: sheet.deletedAt || null
    }))

    const { error: sheetsError } = await supabase.from('sheets').upsert(sheetRows)
    if (sheetsError) { console.error('Sheets sync error:', sheetsError); return }

    // Batch upsert all columns at once
    const allColumns = await db.columns.toArray()
    if (allColumns.length) {
      const columnRows = allColumns.map(col => ({
        id: intToUUID(col.id),
        sheet_id: intToUUID(col.sheetId),
        name: col.name,
        type: col.type,
        position: col.position
      }))
      const { error: colsError } = await supabase.from('columns').upsert(columnRows)
      if (colsError) console.error('Columns sync error:', colsError)
    }

    // Batch upsert all rows at once
    const allRows = await db.rows.toArray()
    if (allRows.length) {
      const rowRows = allRows.map(row => ({
        id: intToUUID(row.id),
        sheet_id: intToUUID(row.sheetId),
        created_at: row.createdAt
      }))
      const { error: rowsError } = await supabase.from('rows').upsert(rowRows)
      if (rowsError) console.error('Rows sync error:', rowsError)
    }

    // Batch upsert all cells at once
    const allCells = await db.cells.toArray()
    if (allCells.length) {
      const cellRows = allCells.map(cell => ({
        id: intToUUID(cell.id),
        row_id: intToUUID(cell.rowId),
        column_id: intToUUID(cell.columnId),
        value: cell.value
      }))
      // Split into chunks of 500 to avoid payload limits
      const chunkSize = 500
      for (let i = 0; i < cellRows.length; i += chunkSize) {
        const chunk = cellRows.slice(i, i + chunkSize)
        const { error: cellsError } = await supabase.from('cells').upsert(chunk)
        if (cellsError) console.error('Cells sync error:', cellsError)
      }
    }

    console.log('Sync complete —', sheets.length, 'sheets,', allRows.length, 'rows,', allCells.length, 'cells')
  } catch (e) {
    console.error('Sync failed:', e)
  }
}

// Pull data from Supabase into local Dexie
export async function syncFromCloud(userId, db) {
  try {
    const { data: sheets, error } = await supabase
      .from('sheets')
      .select('*')
      .eq('user_id', userId)

    // SAFETY — never clear local data on error or empty response
    if (error) { console.error('Sync error:', error); return false }
    if (!sheets?.length) {
      const localSheets = await db.sheets.toArray()
      if (localSheets.length > 0) {
        console.warn('Supabase empty but local data exists — skipping pull')
        return false
      }
      return false
    }

    // Only clear after confirming Supabase has data
    await db.sheets.clear()
    await db.columns.clear()
    await db.rows.clear()
    await db.cells.clear()

    for (const sheet of sheets) {
      await db.sheets.add({
        id: uuidToInt(sheet.id),
        name: sheet.name,
        createdAt: sheet.created_at,
        updatedAt: sheet.updated_at,
        status: sheet.status || 'active',
        deletedAt: sheet.deleted_at || null
      })

      const { data: columns } = await supabase
        .from('columns').select('*').eq('sheet_id', sheet.id)

      for (const col of columns || []) {
        await db.columns.add({
          id: uuidToInt(col.id),
          sheetId: uuidToInt(col.sheet_id),
          name: col.name,
          type: col.type,
          position: col.position
        })
      }

      const { data: rows } = await supabase
        .from('rows').select('*').eq('sheet_id', sheet.id)

      for (const row of rows || []) {
        await db.rows.add({
          id: uuidToInt(row.id),
          sheetId: uuidToInt(row.sheet_id),
          createdAt: row.created_at
        })

        const { data: cells } = await supabase
          .from('cells').select('*').eq('row_id', row.id)

        for (const cell of cells || []) {
          await db.cells.add({
            id: uuidToInt(cell.id),
            rowId: uuidToInt(cell.row_id),
            columnId: uuidToInt(cell.column_id),
            value: cell.value
          })
        }
      }
    }

    return true
  } catch (e) {
    console.error('syncFromCloud failed:', e)
    return false
  }
}
