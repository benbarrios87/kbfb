const SUPABASE_URL = "https://otsaqlidvnlwsdvfhcqq.supabase.co";
const SUPABASE_KEY = "sb_publishable_GnxwJ05PVpzN-MBGTBpI0Q_3HsQU0nb";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

console.log("1: SUPABASE.JS ER LASTET");

async function testSupabaseEvents() {
  console.log("2: TEST STARTER");

  const { data, error } = await supabaseClient
    .from("kbfb_events")
    .select("*")
    .order("date", { ascending: true });

  console.log("3: EVENTS DATA", data);
  console.log("4: EVENTS ERROR", error);
}

testSupabaseEvents();
