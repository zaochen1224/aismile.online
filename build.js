#!/usr/bin/env node

/**
 * Build script for Cloudflare Pages
 * Injects environment variables into HTML files
 */

const fs = require('fs');
const path = require('path');

// Get environment variables
const AILABTOOLS_API_KEY = process.env.AILABTOOLS_API_KEY || '';

console.log('🔧 Building AI Smile Generator...');
console.log('📋 Environment variables:');
console.log(`   AILABTOOLS_API_KEY: ${AILABTOOLS_API_KEY ? '✅ Set' : '❌ Not set'}`);

// Files to process
const filesToProcess = [
    'index.html',
    'index-en.html',
    'seo-optimized.html'
];

// Process each HTML file
filesToProcess.forEach(filename => {
    const filePath = path.join(__dirname, filename);
    
    if (fs.existsSync(filePath)) {
        console.log(`📝 Processing ${filename}...`);
        
        let content = fs.readFileSync(filePath, 'utf8');
        
        // Replace placeholder with actual API key
        content = content.replace(/\{\{AILABTOOLS_API_KEY\}\}/g, AILABTOOLS_API_KEY);
        
        // Write back to file
        fs.writeFileSync(filePath, content, 'utf8');
        
        console.log(`✅ ${filename} processed successfully`);
    } else {
        console.log(`⚠️  ${filename} not found, skipping...`);
    }
});

console.log('🎉 Build completed successfully!'); 