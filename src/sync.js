import { supabase } from './supabase'

// Push local Dexie data to Supabase for a specific user
export async function syncToCloud(userId, db) {
  try {
    const sheets = await db.sheets.toArray()

    for (const sheet of sheets) {
      // Upsert sheet
      await supabase.from('sheets').upsert({
          id: sheet.id.toString(),
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
          id: col.id.toString(),
          sheet_id: sheet.id.toString(),
          name: col.name,
          type: col.type,
          position: col.position
        })
      }

      const rows = await db.rows.where('sheetId').equals(sheet.id).toArray()
      for (const row of rows) {
        await supabase.from('rows').upsert({
          id: row.id.toString(),
          sheet_id: sheet.id.toString(),
          created_at: row.createdAt
        })

        const cells = await db.cells.where('rowId').equals(row.id).toArray()
        for (const cell of cells) {
          await supabase.from('cells').upsert({
            id: cell.id.toString(),
            row_id: row.id.toString(),
            column_id: cell.columnId.toString(),
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
    if (!sheets?.length) return false

    // Only clear local data AFTER confirming Supabase has data
    await db.sheets.clear()
    await db.columns.clear()
    await db.rows.clear()
    await db.cells.clear()

    for (const sheet of sheets) {
      await db.sheets.add({
        id: parseInt(sheet.id) || sheet.id,
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
          id: parseInt(col.id) || col.id,
          sheetId: parseInt(col.sheet_id) || col.sheet_id,
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
          id: parseInt(row.id) || row.id,
          sheetId: parseInt(row.sheet_id) || row.sheet_id,
          createdAt: row.created_at
        })

        const { data: cells } = await supabase
          .from('cells')
          .select('*')
          .eq('row_id', row.id)

        for (const cell of cells || []) {
          await db.cells.add({
            id: parseInt(cell.id) || cell.id,
            rowId: parseInt(cell.row_id) || cell.row_id,
            columnId: parseInt(cell.column_id) || cell.column_id,
            value: cell.value
          })
        }
      }
    }

    return true
  } catch (e) {
    // SAFETY — any unexpected error must never wipe local data
    console.error('syncFromCloud failed:', e)
    return false
  }
}
