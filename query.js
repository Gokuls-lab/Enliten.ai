const { createClient } = require('@supabase/supabase-js');
const SUPABASE_URL = "https://nufmkzmukwplugqvtiie.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im51Zm1rem11a3dwbHVncXZ0aWllIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3Nzk3NzgsImV4cCI6MjA5MDM1NTc3OH0.-rYm-UnMSbEJQCowxU2RpvsNT3k27O2zH93D9ohZpz0";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function main() {
    // try to get a note
    const { data: tables, error } = await supabase
        .rpc('get_tables'); // Or some way to get tables

    const { data: subjects, error: error3 } = await supabase.from('subjects').select('*');
    console.log("subjects:", subjects?.length, error3);
    
    // let's try 'units', 'chapters', 'topics'
    const { data: topics, error: error4 } = await supabase.from('topics').select('*');
    console.log("topics:", topics?.length, error4);
}
main();
