async function test() {
  console.log("Fetching http://127.0.0.1:3000...");
  try {
    const res = await fetch("http://127.0.0.1:3000");
    console.log("Status:", res.status);
    console.log("First 200 chars of HTML:", (await res.text()).substring(0, 200));
  } catch (e) {
    console.error("Fetch failed:", e);
  }
}
test();
