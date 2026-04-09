import { supabase } from './supabase'

// Push local Dexie data to Supabase for a specific user
export async function syncToCloud(userId, db) {
  try {
    const sheets = await db.sheets.toArray()

    for (const sheet of sheets) {
      // Generate a stable UUID from the integer ID
      const sheetUUID = intToUUID(sheet.id)

      await supabase.from('sheets').upsert({
        id: sheetUUID,
        user_id: userId,
        name: sheet.name,
        created_at: sheet.createdAt,
        updated_at: sheet.updatedAt,
        status: sheet.status || 'active',
        deleted_at: sheet.deletedAt || null
      })

      const columns = await db.columns.where('sheetId').equals(sheet.id).toArray()
      for (const col of columns) {
        await supabase.from('columns').upsert({
          id: intToUUID(col.id),
          sheet_id: sheetUUID,
          name: col.name,
          type: col.type,
          position: col.position
        })
      }

      const rows = await db.rows.where('sheetId').equals(sheet.id).toArray()
      for (const row of rows) {
        const rowUUID = intToUUID(row.id)
        await supabase.from('rows').upsert({
          id: rowUUID,
          sheet_id: sheetUUID,
          created_at: row.createdAt
        })

        const cells = await db.cells.where('rowId').equals(row.id).toArray()
        for (const cell of cells) {
          await supabase.from('cells').upsert({
            id: intToUUID(cell.id),
            row_id: rowUUID,
            column_id: intToUUID(cell.columnId),
            value: cell.value
          })
        }
      }
    }

    console.log('Sync to cloud complete')
  } catch (e) {
    console.error('Sync failed:', e)
  }
}

// Convert integer ID to stable UUID format
// This ensures the same integer always maps to the same UUID
function intToUUID(id) {
  const hex = id.toString(16).padStart(12, '0')
  return `00000000-0000-4000-8000-${hex}`
}

// Pull data from Supabase into local Dexie
export async function syncFromCloud(userId, db) {
  try {
    const { data: sheets, error } = await supabase
      .from('sheets')
      .select('*')
      .eq('user_id', userId)

    // SAFETY — if Supabase returns error or empty, never clear local data
    if (error) {
      console.error('Sync error:', error)
      return false
    }
    if (!sheets?.length) {
        // Safety check — if Supabase is empty but local DB has data, don't wipe
          const localSheets = await db.sheets.toArray()
            if (localSheets.length > 0) {
                // Push local data to cloud instead of wiping it
                    console.warn('Supabase empty but local data exists — skipping cloud pull')
                        return false
                          }
                            return false
                            }

    // Only clear local data AFTER confirming Supabase has data
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
        .from('columns')
        .select('*')
        .eq('sheet_id', sheet.id)

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
        .from('rows')
        .select('*')
        .eq('sheet_id', sheet.id)

      for (const row of rows || []) {
        await db.rows.add({
          id: uuidToInt(row.id),
          sheetId: uuidToInt(row.sheet_id),
          createdAt: row.created_at
        })

        const { data: cells } = await supabase
          .from('cells')
          .select('*')
          .eq('row_id', row.id)

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

function uuidToInt(uuid) {
  if (!uuid) return Date.now()
  const hex = uuid.split('-').pop()
  return parseInt(hex, 16) || Date.now()
}
