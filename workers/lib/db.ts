import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as schema from '../../frontend/lib/schema/index';
import * as path from 'path';

// Carrega dot env local da raiz da aplicação
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const connectionString = process.env.DATABASE_URL!;
const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!; // Uso do service role na rotina worker

export const queryClient = postgres(connectionString);
export const db = drizzle(queryClient, { schema });

// Cliente Supabase dedicado ao worker para RLS rules bypassing backend
export const supabase = createClient(supabaseUrl, supabaseKey);
