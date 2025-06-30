import { Tessen, ContentValue, PlainLocaleData } from 'tessen';

// Interface for parameter extraction from localized strings
interface ExtractedParameter {
  name: string;
  type: string;
}

// Configuration for type generation
interface TypeGenerationConfig {
  tessens: Tessen[];
  outputPath?: string;
}

/**
 * Extracts parameter information from a localized string
 * Examples:
 * "{0} is now a {1}" -> [{ name: "_0", type: "string" }, { name: "_1", type: "string" }]
 * "{0:user} is now a {1:role}" -> [{ name: "user", type: "string" }, { name: "role", type: "string" }]
 */
function extractParameters(value: string): ExtractedParameter[] {
  const parameters: ExtractedParameter[] = [];
  const paramRegex = /\{(\d+)(?::([^}]+))?\}/g;
  let match;

  while ((match = paramRegex.exec(value)) !== null) {
    const index = match[1];
    const paramName = match[2] || `_${index}`;
    
    parameters.push({
      name: paramName,
      type: 'string' // For now, we assume all parameters are strings
    });
  }

  return parameters.sort((a, b) => {
    // Sort by index if using default naming (_0, _1, etc.)
    if (a.name.startsWith('_') && b.name.startsWith('_')) {
      const aIndex = parseInt(a.name.substring(1));
      const bIndex = parseInt(b.name.substring(1));
      return aIndex - bIndex;
    }
    // Otherwise, maintain original order
    return 0;
  });
}

/**
 * Generates a TypeScript function signature from a localized string
 */
function generateFunctionSignature(value: string): string {
  const parameters = extractParameters(value);
  
  if (parameters.length === 0) {
    return '() => string';
  }

  const paramStrings = parameters.map(param => `${param.name}: ${param.type}`);
  return `(${paramStrings.join(', ')}) => string`;
}

/**
 * Recursively processes locale data to generate TypeScript interface properties
 */
function processLocaleData(data: PlainLocaleData, depth = 0): string {
  const lines: string[] = [];
  const indent = '  '.repeat(depth + 3); // Base indent for interface content

  for (const [key, value] of Object.entries(data)) {
    if (typeof value === 'string') {
      const signature = generateFunctionSignature(value);
      lines.push(`${indent}${key}: ${signature};`);
    } else if (typeof value === 'object' && value !== null) {
      lines.push(`${indent}${key}: {`);
      lines.push(processLocaleData(value, depth + 1));
      lines.push(`${indent}};`);
    }
  }

  return lines.join('\n');
}

/**
 * Merges multiple locale data objects into a single structure
 */
function mergeLocaleData(...localeDataArray: PlainLocaleData[]): PlainLocaleData {
  const merged: PlainLocaleData = {};

  for (const localeData of localeDataArray) {
    deepMerge(merged, localeData);
  }

  return merged;
}

/**
 * Deep merge utility function
 */
function deepMerge(target: PlainLocaleData, source: PlainLocaleData): void {
  for (const [key, value] of Object.entries(source)) {
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      if (!(key in target) || typeof target[key] !== 'object') {
        target[key] = {};
      }
      deepMerge(target[key] as PlainLocaleData, value);
    } else {
      target[key] = value;
    }
  }
}

/**
 * Extracts locale data from Tessen's cache and converts it to plain data structure
 * This is the key function that processes the actual Tessen cache data
 */
function extractPlainLocaleDataFromTessen(tessen: Tessen): PlainLocaleData {
  const mergedData: PlainLocaleData = {};

  // Process all cached locales from Tessen.cache.locales
  for (const [localeId, cacheData] of tessen.cache.locales) {
    const locale = cacheData.data;
    
    // Get content from the first available language
    // We use the first language as the structure template
    for (const [language, contentValue] of locale.content) {
      const plainData = extractPlainDataFromContentValue(contentValue);
      if (typeof plainData === 'object' && plainData !== null) {
        deepMerge(mergedData, plainData);
      }
      break; // Use first language as the structural template
    }
  }

  return mergedData;
}

/**
 * Recursively extracts plain data from ContentValue objects
 * This handles the nested structure of locale data
 */
function extractPlainDataFromContentValue(value: any): PlainLocaleData | string {
  if (typeof value === 'string') {
    return value;
  }
  
  if (typeof value === 'function') {
    // For functions, we need to extract parameter information
    // Since we can't get the original template string easily,
    // we'll analyze the function to determine parameters
    return extractParametersFromFunction(value);
  }
  
  if (typeof value === 'object' && value !== null) {
    const result: PlainLocaleData = {};
    
    for (const [key, subValue] of Object.entries(value)) {
      if (key === 'length' || key === 'name' || key === 'prototype') {
        // Skip function properties
        continue;
      }
      
      const extracted = extractPlainDataFromContentValue(subValue);
      if (extracted !== null && extracted !== undefined) {
        result[key] = extracted;
      }
    }
    
    return result;
  }
  
  return '';
}

/**
 * Attempts to extract parameter information from a localization function
 * This is a heuristic approach since we don't have direct access to the template
 */
function extractParametersFromFunction(func: Function): string {
  // Check function length to determine parameter count
  const paramCount = func.length;
  
  if (paramCount === 0) {
    return ''; // No parameters
  }
  
  // Generate a default template with numbered parameters
  const params = Array.from({ length: paramCount }, (_, i) => `{${i}}`);
  return params.join(' ');
}

/**
 * Generates TypeScript declaration for a single Tessen instance
 */
function generateTessenDeclaration(tessen: Tessen, clientIndex?: number): string {
  const localeData = extractPlainLocaleDataFromTessen(tessen);
  const interfaceContent = processLocaleData(localeData);
  
  const clientSuffix = clientIndex !== undefined ? ` // Client ${clientIndex + 1}` : '';

  return `declare global {${clientSuffix}
    namespace Tessen {
        interface Localization {
${interfaceContent}
        }
    }
}`;
}

/**
 * Main function to generate TypeScript declarations from multiple Tessen instances
 */
export function generateLocalizationTypes(config: TypeGenerationConfig): string {
  const declarations: string[] = [];

  for (let i = 0; i < config.tessens.length; i++) {
    const tessen = config.tessens[i];
    const declaration = generateTessenDeclaration(tessen, config.tessens.length > 1 ? i : undefined);
    declarations.push(declaration);
  }

  return declarations.join('\n\n');
}

/**
 * Utility function to create a type generation configuration
 */
export function createTypeGenerationConfig(tessens: Tessen | Tessen[]): TypeGenerationConfig {
  return {
    tessens: Array.isArray(tessens) ? tessens : [tessens]
  };
}

/**
 * Helper function to write generated types to a file (Node.js environment)
 */
export async function writeLocalizationTypes(config: TypeGenerationConfig, outputPath: string): Promise<void> {
  const { writeFile } = await import('fs/promises');
  const generatedTypes = generateLocalizationTypes(config);
  await writeFile(outputPath, generatedTypes, 'utf-8');
}

// Re-export types for convenience
export type { TypeGenerationConfig, ExtractedParameter };