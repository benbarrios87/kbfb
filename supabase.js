const SUPABASE_URL = "https://otsaqlidvnlwsdvfhcqq.supabase.co";
const SUPABASE_KEY = "sb_publishable_GnxwJ05PVpzN-MBGTBpI0Q_3HsQU0nb";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

console.log("SUPABASE.JS ER LASTET");

async function loadEventsFromSupabase() {
  const { data, error } = await supabaseClient
    .from("kbfb_events")
    .select("*")
    .order("date");

  console.log("EVENTS:", data);
  console.log("ERROR:", error);
}

loadEventsFromSupabase();
