#!/usr/bin/env node

import { existsSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { Command } from 'commander';
import { watch } from 'chokidar';
import { generateLocalizationTypes, createTypeGenerationConfig } from './index.js';

const program = new Command();

// Cache to store module paths for clearing
const moduleCache = new Set<string>();

function clearModuleCache() {
  // Clear ES module cache by deleting from import.meta.resolve cache
  // Note: This is a best-effort approach as ES modules don't have a direct cache clearing mechanism
  for (const modulePath of moduleCache) {
    try {
      // For Node.js versions that support it, we can try to invalidate the cache
      if (typeof process !== 'undefined' && process.versions && process.versions.node) {
        // Clear from require cache if available (for CommonJS interop)
        delete require.cache[modulePath];
        
        // Also try to clear any registered modules
        const Module = require('module');
        if (Module._cache) {
          delete Module._cache[modulePath];
        }
      }
    } catch (error) {
      // Silently ignore cache clearing errors
    }
  }
  moduleCache.clear();
}

async function loadTessenInstances(importPath: string): Promise<any[]> {
  try {
    const absolutePath = resolve(importPath);
    
    if (!existsSync(absolutePath)) {
      console.error(`Error: Tessen import file not found: ${absolutePath}`);
      process.exit(1);
    }

    // Add to cache tracking
    moduleCache.add(absolutePath);

    // Dynamic import to load the Tessen instances
    let module;
    try {
      // Add cache busting by appending timestamp
      const cacheBuster = `?t=${Date.now()}`;
      module = await import(absolutePath + cacheBuster);
    } catch (importError) {
      // If ES module import fails, try require for CommonJS
      try {
        const { pathToFileURL } = await import('url');
        const cacheBuster = `?t=${Date.now()}`;
        module = await import(pathToFileURL(absolutePath).href + cacheBuster);
      } catch (requireError) {
        console.error(`Error importing ${importPath}:`, importError);
        process.exit(1);
      }
    }
    
    // Try to find Tessen instances in the module
    const tessens = [];
    
    // Helper function to check if an object is a Tessen instance
    function isTessenInstance(obj: any): boolean {
      if (!obj || typeof obj !== 'object') return false;
      
      // Check constructor name
      if (obj.constructor && obj.constructor.name === 'Tessen') {
        return true;
      }
      
      // Fallback: Check for typical Tessen properties
      return obj.cache && obj.cache.locales;
    }
    
    // Helper function to recursively search for Tessen instances
    function findTessenInstances(obj: any, visited = new Set()): any[] {
      if (!obj || typeof obj !== 'object' || visited.has(obj)) {
        return [];
      }
      
      visited.add(obj);
      const found: any[] = [];
      
      // Check if current object is a Tessen instance
      if (isTessenInstance(obj)) {
        found.push(obj);
        return found; // Don't search deeper if we found a Tessen instance
      }
      
      // If it's an array, check each element
      if (Array.isArray(obj)) {
        for (const item of obj) {
          found.push(...findTessenInstances(item, visited));
        }
      } else {
        // Search through object properties
        for (const [key, value] of Object.entries(obj)) {
          // Skip common non-Tessen properties
          if (key === 'length' || key === 'name' || key === 'prototype' || key === '__proto__') {
            continue;
          }
          found.push(...findTessenInstances(value, visited));
        }
      }
      
      return found;
    }
    
    // Search through all module exports
    tessens.push(...findTessenInstances(module));
    
    if (tessens.length === 0) {
      console.error(`Error: No Tessen instances found in ${importPath}`);
      console.error('Make sure to export your Tessen instances from the file.');
      console.error('Available exports:', Object.keys(module));
      process.exit(1);
    }
    
    return tessens;
  } catch (error) {
    console.error(`Error loading Tessen instances from ${importPath}:`, error);
    process.exit(1);
  }
}

function ensureDirectoryExists(filePath: string) {
  const dir = dirname(filePath);
  try {
    const fs = require('fs');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  } catch (error) {
    console.error(`Error creating directory ${dir}:`, error);
    process.exit(1);
  }
}

async function generateTypes(options: any) {
  await performTypeGeneration(options);
  
  // If watch mode is enabled, start watching
  if (options.watch) {
    console.log(`👀 Watching ${options.listenPath || './src/i18n'} for changes...`);
    console.log('Press Ctrl+C to stop watching');
    
    const watcher = watch(options.listenPath || './src/i18n', {
      ignored: /(^|[\/\\])\../, // ignore dotfiles
      persistent: true,
      ignoreInitial: true
    });
    
    // Debounce function to avoid multiple rapid regenerations
    let regenerateTimeout: NodeJS.Timeout | null = null;
    
    watcher.on('all', (event, filePath) => {
      console.log(`📁 File ${event}: ${filePath}`);
      
      // Clear any existing timeout
      if (regenerateTimeout) {
        clearTimeout(regenerateTimeout);
      }
      
      // Set a new timeout to regenerate after 300ms of no changes
      regenerateTimeout = setTimeout(async () => {
        console.log('🔄 Regenerating types due to file changes...');
        clearModuleCache();
        await performTypeGeneration(options);
        console.log('👀 Continuing to watch for changes...');
      }, 300);
    });
    
    // Handle graceful shutdown
    process.on('SIGINT', () => {
      console.log('\n🛑 Stopping file watcher...');
      watcher.close();
      process.exit(0);
    });
    
    // Keep the process alive
    process.stdin.resume();
  }
}

async function performTypeGeneration(options: any) {
  const listenPath = options.listenPath || './src/i18n';
  const outputPath = options.out || './src/locales.d.ts';
  const tessenImportPath = options.tessenImport;
  
  if (!tessenImportPath) {
    console.error('Error: --tessenImport is required');
    process.exit(1);
  }
  
  try {
    console.log('🔍 Loading Tessen instances...');
    const tessens = await loadTessenInstances(tessenImportPath);
    console.log(`✅ Found ${tessens.length} Tessen instance(s)`);
    
    console.log('🔧 Generating TypeScript types...');
    const config = createTypeGenerationConfig(tessens, outputPath);
    const generatedTypes = generateLocalizationTypes(config);
    
    console.log('📁 Writing types to file...');
    const absoluteOutputPath = resolve(outputPath);
    ensureDirectoryExists(absoluteOutputPath);
    
    writeFileSync(absoluteOutputPath, generatedTypes, 'utf-8');
    console.log(`✅ Types generated successfully: ${absoluteOutputPath}`);
    console.log('🎉 Type generation complete!');
  } catch (error) {
    console.error(`❌ Error during type generation:`, error);
    if (!options.watch) {
      process.exit(1);
    }
  }
}

// Configure the CLI program
program
  .name('@tessen/type-gen')
  .description('TypeScript type generator for Tessen localization')
  .version('0.0.2-dev.9')
  .option('--listenPath <path>', 'Path to watch for Tessen files', './src/i18n')
  .option('--out <path>', 'Output path for generated types', './src/locales.d.ts')
  .option('--watch, -w', 'Watch for file changes and regenerate types automatically')
  .requiredOption('--tessenImport <path>', 'Path to import Tessen instances from')
  .action(generateTypes);

// Add examples to help
program.addHelpText('after', `
Examples:
  $ npx @tessen/type-gen --listenPath ./src/i18n --out ./src/locales.d.ts --tessenImport ./src/tessen.ts
  $ npx @tessen/type-gen --tessenImport ./src/tessen.ts
  $ npx @tessen/type-gen --tessenImport ./src/tessen.ts --watch
  $ npx @tessen/type-gen --tessenImport ./src/tessen.ts -w --listenPath ./locales
`);

// Parse command line arguments
program.parse();
