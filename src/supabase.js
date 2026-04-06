import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_KEY
)

export async function getSubscriptionStatus(userId) {
    try {
        const { data, error } = await supabase
              .from('subscriptions')
                    .select('status, ends_at, renews_at')
                          .eq('user_id', userId)
                                .single()
                                    if (error || !data) return false
                                        return data.status === 'active' || data.status === 'on_trial'
                                          } catch (e) {
                                              return false
                                                }
                                                }