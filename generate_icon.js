const pngToIco = require('png-to-ico').default || require('png-to-ico');
const fs = require('fs');
const path = require('path');

const inputPath = path.join(__dirname, 'public', 'app_icon.png');
const outputPath = path.join(__dirname, 'build', 'icon.ico');

const buildDir = path.join(__dirname, 'build');
if (!fs.existsSync(buildDir)) {
  fs.mkdirSync(buildDir, { recursive: true });
}

pngToIco(inputPath)
  .then(buf => {
    fs.writeFileSync(outputPath, buf);
    console.log('Successfully generated build/icon.ico!');
  })
  .catch(err => {
    console.error('Error generating ico file:', err);
  });
