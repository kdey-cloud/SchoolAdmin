import { createClient } from "@supabase/supabase-js";

export const projectId = "eskluvdjznopaeuwlwqb";

export const publicAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

export const supabase = createClient(supabaseUrl, publicAnonKey);
