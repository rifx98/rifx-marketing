const { execSync } = require('child_process');
try {
  const output = execSync('wmic process where "name=\'node.exe\'" get ProcessID, CommandLine').toString();
  const lines = output.split('\n');
  for (const line of lines) {
    if (line.includes('rifx-marketing') && !line.includes('kill_node')) {
      const parts = line.trim().split(/\s+/);
      const pid = parts[parts.length - 1];
      if (pid && !isNaN(pid)) {
        console.log(`Killing project node process PID: ${pid}`);
        try {
          execSync(`taskkill /F /PID ${pid}`);
        } catch (e) {}
      }
    }
  }
} catch (e) {
  console.log("No other project node processes found.");
}
