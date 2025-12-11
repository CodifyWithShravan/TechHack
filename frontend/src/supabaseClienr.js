import { createClient } from '@supabase/supabase-js'

// Replace these with your actual Supabase details!
// You can find these in Supabase Dashboard -> Project Settings -> API
const supabaseUrl = 'https://ekxpwkmhrqmqsasxwwrb.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVreHB3a21ocnFtcXNhc3h3d3JiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUzODA2NDAsImV4cCI6MjA4MDk1NjY0MH0.jv2utQbEU49Up8C8i35GfsfUCPyf0Yv4X7mS97GSNMo'

export const supabase = createClient(supabaseUrl, supabaseKey)