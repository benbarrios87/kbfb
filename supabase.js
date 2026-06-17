console.log("SUPABASE.JS ER LASTET");
const SUPABASE_URL = "https://otsaqlidvnlwsdvfhcqq.supabase.co";
const SUPABASE_KEY = "sb_publishable_GnxwJ05PVpzN-MBGTBpI0Q_3HsQU0nb";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

async function testSupabase() {
  const { data, error } = await supabaseClient
    .from("kbfb_events")
    .select("*")
    .limit(5);

  console.log("SUPABASE TEST");
  console.log(data);
  console.log(error);
}

testSupabase();
