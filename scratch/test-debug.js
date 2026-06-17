async function test() {
  const url = 'https://rifx-marketinggithubio-main.vercel.app/api/whatsapp/debug';
  try {
    const res = await fetch(url);
    console.log("Debug Route Response:");
    console.log(JSON.stringify(await res.json(), null, 2));
  } catch (err) {
    console.error("Failed to fetch debug route:", err);
  }
}
test();
