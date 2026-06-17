const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// 1. Find and kill process on port 3000
try {
  console.log("Checking port 3000...");
  const output = execSync('netstat -ano | findstr :3000').toString();
  const lines = output.split('\n');
  const pids = new Set();
  for (const line of lines) {
    const parts = line.trim().split(/\s+/);
    if (parts.length >= 5) {
      const pid = parts[parts.length - 1];
      if (pid && pid !== '0' && !isNaN(pid)) {
        pids.add(pid);
      }
    }
  }
  for (const pid of pids) {
    console.log(`Killing process with PID: ${pid}`);
    try {
      execSync(`taskkill /F /PID ${pid}`);
    } catch (e) {
      // Ignore if already dead
    }
  }
} catch (err) {
  console.log("No active process found on port 3000.");
}

// 2. Delete .next folder
const nextPath = path.join(__dirname, '..', '.next');
if (fs.existsSync(nextPath)) {
  console.log("Deleting .next cache directory...");
  try {
    fs.rmSync(nextPath, { recursive: true, force: true });
    console.log("Deleted .next folder successfully.");
  } catch (err) {
    console.error("Failed to delete .next folder:", err.message);
  }
}

// 3. Start npm run dev
console.log("Starting npm run dev...");
const child = spawn('npm', ['run', 'dev'], {
  cwd: path.join(__dirname, '..'),
  stdio: 'inherit',
  shell: true
});

child.on('error', (err) => {
  console.error("Failed to start npm run dev:", err);
});
