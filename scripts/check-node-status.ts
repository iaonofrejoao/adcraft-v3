import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.join(process.cwd(), 'frontend', '.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

async function main() {
  const nodeId = 'df909972-9e19-4b15-b9f5-f4331b9f829d'

  const { data } = await supabase
    .from('canvas_nodes')
    .select('id, generation_status, error_message, updated_at')
    .eq('id', nodeId)
    .single()

  console.log('Status        :', data?.generation_status)
  console.log('Error message :', data?.error_message ?? '(nenhum)')
  console.log('Updated at    :', data?.updated_at)
}

main().catch(console.error)
