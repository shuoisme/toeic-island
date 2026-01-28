// lib/supabase.ts
import { createClient } from '@supabase/supabase-js'

// 加上 "!" 是為了告訴 TS：我保證這些變數一定有值，不會是 undefined
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseKey)