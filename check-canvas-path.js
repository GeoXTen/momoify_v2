// Check where Node.js is looking for canvas module
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

console.log('Current directory:', process.cwd());
console.log('Script directory:', __dirname);
console.log('Node.js version:', process.version);
console.log('');

// Try to find canvas
try {
    const canvasPath = await import.meta.resolve('canvas');
    console.log('✅ Canvas module found at:', canvasPath);
} catch (error) {
    console.log('❌ Canvas module not found:', error.message);
}

console.log('');

// Try to import canvas
try {
    const { createCanvas } = await import('canvas');
    console.log('✅ Canvas imports successfully');
    console.log('   createCanvas type:', typeof createCanvas);
} catch (error) {
    console.log('❌ Canvas import failed:', error.message);
    console.log('   Error code:', error.code);
}
