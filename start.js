const os = require('os');
const { exec } = require('child_process');
const qrcode = require('qrcode-terminal');

function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const devName in interfaces) {
    const iface = interfaces[devName];
    for (let i = 0; i < iface.length; i++) {
      const alias = iface[i];
      // Check for IPv4 and ensure it's not a loopback interface
      if (alias.family === 'IPv4' && !alias.internal) {
        return alias.address;
      }
    }
  }
  return 'localhost';
}

const localIP = getLocalIP();
const port = 3000;
const devUrl = `http://${localIP}:${port}`;

console.log(`\n================================================================`);
console.log(`   AEGIS VANGUARD: CHRONICLES OF THE ION VOID - LAUNCHER`);
console.log(`================================================================`);
console.log(`\nTo play and test the game on your mobile device (on the same Wi-Fi),`);
console.log(`please scan the QR code below using your mobile camera:\n`);

qrcode.generate(devUrl, { small: true });

console.log(`\nMobile Connection URL: \x1b[36m${devUrl}\x1b[0m`);
console.log(`Local Browser URL:     \x1b[36mhttp://localhost:${port}\x1b[0m`);
console.log(`================================================================\n`);

// Start the Vite dev server
const server = exec('npx vite --host --port 3000');

server.stdout.on('data', (data) => {
  process.stdout.write(data);
});

server.stderr.on('data', (data) => {
  process.stderr.write(data);
});

// Auto-open browser
const openCmd = process.platform === 'darwin' ? 'open' : (process.platform === 'win32' ? 'start' : 'xdg-open');
setTimeout(() => {
  console.log('Launching browser...');
  exec(`${openCmd} http://localhost:${port}`, (err) => {
    if (err) {
      // Fallback if browser command fails on headless envs
      console.log(`Dev server is running. Access it at http://localhost:${port}`);
    }
  });
}, 1500);
