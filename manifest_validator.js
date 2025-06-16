/**
 * MANIFEST.JSON VALIDATOR AND FIXER
 * Checks for common issues that prevent extension loading
 * Run this in Node.js or browser console
 */

console.log('🔍 MANIFEST.JSON VALIDATION STARTING...');

// Read and parse manifest
const fs = require('fs');
const path = require('path');

try {
    const manifestPath = path.join(__dirname, 'manifest.json');
    const manifestContent = fs.readFileSync(manifestPath, 'utf8');
    
    console.log('📄 Manifest file found and readable');
    console.log('📏 File size:', manifestContent.length, 'bytes');
    
    // Check for BOM or hidden characters
    const firstChar = manifestContent.charCodeAt(0);
    if (firstChar === 0xFEFF) {
        console.log('⚠️  BOM detected - this can cause parsing issues');
    } else {
        console.log('✅ No BOM detected');
    }
    
    // Parse JSON
    let manifest;
    try {
        manifest = JSON.parse(manifestContent);
        console.log('✅ JSON parsing successful');
    } catch (parseError) {
        console.log('❌ JSON PARSING ERROR:', parseError.message);
        console.log('💡 This is likely the cause of extension loading failure');
        return;
    }
    
    // Validate required fields
    console.log('\n🔍 VALIDATING REQUIRED FIELDS:');
    const requiredFields = ['manifest_version', 'name', 'version'];
    
    requiredFields.forEach(field => {
        if (manifest[field]) {
            console.log(`✅ ${field}:`, manifest[field]);
        } else {
            console.log(`❌ Missing required field: ${field}`);
        }
    });
    
    // Validate manifest version
    if (manifest.manifest_version === 3) {
        console.log('✅ Manifest V3 detected');
    } else {
        console.log('⚠️  Unexpected manifest version:', manifest.manifest_version);
    }
    
    // Check file references
    console.log('\n🔍 VALIDATING FILE REFERENCES:');
    
    const filesToCheck = [];
    
    // Background script
    if (manifest.background?.service_worker) {
        filesToCheck.push(manifest.background.service_worker);
    }
    
    // Content scripts
    if (manifest.content_scripts) {
        manifest.content_scripts.forEach(script => {
            if (script.js) filesToCheck.push(...script.js);
            if (script.css) filesToCheck.push(...script.css);
        });
    }
    
    // Icons
    if (manifest.icons) {
        Object.values(manifest.icons).forEach(icon => {
            filesToCheck.push(icon);
        });
    }
    
    // Check if files exist
    filesToCheck.forEach(file => {
        const filePath = path.join(__dirname, file);
        if (fs.existsSync(filePath)) {
            const stats = fs.statSync(filePath);
            console.log(`✅ ${file} (${stats.size} bytes)`);
        } else {
            console.log(`❌ Missing file: ${file}`);
        }
    });
    
    // Validate permissions
    console.log('\n🔍 VALIDATING PERMISSIONS:');
    if (manifest.permissions) {
        console.log('✅ Permissions:', manifest.permissions.join(', '));
    }
    
    if (manifest.host_permissions) {
        console.log('✅ Host permissions:', manifest.host_permissions.join(', '));
    }
    
    // Check content script matches
    console.log('\n🔍 VALIDATING CONTENT SCRIPTS:');
    if (manifest.content_scripts) {
        manifest.content_scripts.forEach((script, index) => {
            console.log(`Content Script ${index + 1}:`);
            console.log(`  Matches: ${script.matches.join(', ')}`);
            console.log(`  JS files: ${script.js?.join(', ') || 'none'}`);
            console.log(`  CSS files: ${script.css?.join(', ') || 'none'}`);
            console.log(`  Run at: ${script.run_at || 'document_idle'}`);
        });
    }
    
    // OAuth validation
    console.log('\n🔍 VALIDATING OAUTH CONFIGURATION:');
    if (manifest.oauth2) {
        console.log('✅ OAuth2 client_id:', manifest.oauth2.client_id);
        console.log('✅ OAuth2 scopes:', manifest.oauth2.scopes.join(', '));
    }
    
    // CSP validation
    console.log('\n🔍 VALIDATING CONTENT SECURITY POLICY:');
    if (manifest.content_security_policy) {
        console.log('✅ CSP defined:', manifest.content_security_policy.extension_pages);
    }
    
    console.log('\n📊 VALIDATION SUMMARY:');
    console.log('✅ Manifest appears to be valid');
    console.log('💡 If extension still not loading, try:');
    console.log('   1. Check Chrome DevTools > Extensions for errors');
    console.log('   2. Look for console errors during extension load');
    console.log('   3. Verify all file paths are correct');
    
} catch (error) {
    console.log('❌ Error reading manifest file:', error.message);
    console.log('💡 Make sure you are running this from the extension directory');
}

// Create a clean manifest (removes any potential hidden characters)
function createCleanManifest() {
    console.log('\n🧹 CREATING CLEAN MANIFEST...');
    
    const cleanManifest = {
        "manifest_version": 3,
        "name": "Automail",
        "version": "1.0",
        "description": "AI-powered Gmail automation extension for reading, labeling, moving, and composing emails",
        "permissions": [
            "storage",
            "identity",
            "scripting",
            "tabs",
            "activeTab"
        ],
        "host_permissions": [
            "https://mail.google.com/*",
            "https://gmail.googleapis.com/*",
            "https://people.googleapis.com/*",
            "http://localhost:5000/*",
            "http://127.0.0.1:5000/*"
        ],
        "background": {
            "service_worker": "background.js"
        },
        "action": {
            "default_title": "Automail - Toggle Sidebar"
        },
        "content_scripts": [
            {
                "matches": ["https://mail.google.com/*"],
                "js": ["content.js"],
                "css": ["sidebar.css"],
                "run_at": "document_end",
                "all_frames": false
            }
        ],
        "icons": {
            "16": "icon16.png",
            "48": "icon48.png",
            "128": "icon128.png"
        },
        "oauth2": {
            "client_id": "506990861082-8dss8jehi5ijek4sfg2p1srj439hk6vh.apps.googleusercontent.com",
            "scopes": [
                "https://www.googleapis.com/auth/gmail.modify",
                "https://www.googleapis.com/auth/gmail.readonly",
                "https://www.googleapis.com/auth/contacts"
            ]
        },
        "content_security_policy": {
            "extension_pages": "script-src 'self'; object-src 'self'; connect-src 'self' http://localhost:5000 http://127.0.0.1:5000 https://googleapis.com https://*.googleapis.com https://accounts.google.com"
        }
    };
    
    try {
        const cleanManifestJson = JSON.stringify(cleanManifest, null, 2);
        fs.writeFileSync('manifest_clean.json', cleanManifestJson, 'utf8');
        console.log('✅ Clean manifest created as manifest_clean.json');
        console.log('💡 You can replace your manifest.json with this clean version');
    } catch (error) {
        console.log('❌ Error creating clean manifest:', error.message);
    }
}

createCleanManifest(); 