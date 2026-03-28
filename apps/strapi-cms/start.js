const path = require('path');
const { createStrapi } = require('@strapi/core');

const appDir = process.cwd();
const distDir = path.resolve(appDir, 'dist');

createStrapi({ appDir, distDir }).start();
