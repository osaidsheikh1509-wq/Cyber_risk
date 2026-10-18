const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const inFrontend = !fs.existsSync('frontend') && fs.existsSync('src');
const frontendDir = inFrontend ? '.' : 'frontend';

console.log(`Building frontend in ${frontendDir}...`);
execSync('npm run build', { cwd: frontendDir, stdio: 'inherit' });

if (!inFrontend) {
  const srcDist = path.join('frontend', 'dist');
  const targetDist = 'dist';
  if (fs.existsSync(srcDist)) {
    fs.cpSync(srcDist, targetDist, { recursive: true });
    console.log(`Copied build output to ${targetDist}/`);
  }
}
