import { useEffect, useState } from 'react'
import { supabase } from './supabase.js'

let cache = null
// Loads the verification packages (prices and included checks) from the `plans` table.
export function usePlans() {
  const [plans, setPlans] = useState(cache)
  useEffect(() => {
    if (cache) return
    supabase.from('plans').select('*').order('sort').then(({ data }) => { cache = data || []; setPlans(cache) })
  }, [])
  return plans // null while loading
}
