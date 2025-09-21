
import { createClient } from '@supabase/supabase-js';


const getEnvVar = (key, fallback) => {
  
  if (typeof window !== 'undefined' && typeof import.meta !== 'undefined' && import.meta.env) {
    return import.meta.env[key] || fallback;
  }
  
  return fallback;
};


export const supabaseConfig = {
  url: getEnvVar('VITE_SUPABASE_URL', ''),
  anonKey: getEnvVar('VITE_SUPABASE_ANON_KEY', '')
};


let supabase = null;

if (supabaseConfig.url && supabaseConfig.anonKey) {
  try {
    supabase = createClient(supabaseConfig.url, supabaseConfig.anonKey);
    console.log('✅ Real Supabase client initialized successfully');
    console.log('🌐 GPS coordinates will be sent to:', supabaseConfig.url);
  } catch (error) {
    console.error('❌ Failed to initialize Supabase client:', error);
    supabase = createMockSupabaseClient();
  }
} else {
  console.warn('⚠️ Supabase credentials not found - using mock client');
  supabase = createMockSupabaseClient();
}


function createMockSupabaseClient() {
  return {
    from: (table) => ({
      insert: (data) => {
        console.log(`Mock insert into ${table}:`, data);
        
        return {
          select: (columns = '*') => ({
            single: () => {
              console.log(`Mock insert with select single from ${table}`);
              return Promise.resolve({ 
                data: { id: Date.now(), ...data }, 
                error: null 
              });
            }
          })
        };
      },
      update: (data) => ({
        eq: (column, value) => ({
          select: (columns = '*') => ({
            single: () => {
              console.log(`Mock update ${table} where ${column} = ${value}:`, data);
              return Promise.resolve({ 
                data: { id: Date.now(), ...data }, 
                error: null 
              });
            }
          })
        })
      }),
      select: (columns = '*') => ({
        eq: (column, value) => ({
          eq: (column2, value2) => ({
            single: () => {
              console.log(`Mock select from ${table} where ${column} = ${value} and ${column2} = ${value2}`);
              return Promise.resolve({ 
                data: null, 
                error: { code: 'PGRST116', message: 'No rows found' } 
              });
            }
          }),
          single: () => {
            console.log(`Mock select from ${table} where ${column} = ${value}`);
            return Promise.resolve({ 
              data: null, 
              error: { code: 'PGRST116', message: 'No rows found' } 
            });
          }
        })
      })
    })
  };
}

export { supabase };
