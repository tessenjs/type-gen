# @tessen/type-gen

A TypeScript type generation module for Tessen localization. This module analyzes Tessen instances and generates TypeScript declarations for type-safe localization usage.

## Features

- 🔍 **Smart Parameter Detection**: Automatically detects parameters in localization strings
- 🏷️ **Named Parameters**: Supports both indexed (`{0}`, `{1}`) and named (`{0:user}`, `{1:role}`) parameters
- 🔗 **Multi-Client Support**: Generate types for multiple Tessen instances
- 📁 **Nested Structures**: Handles nested localization objects
- 💾 **File Output**: Write generated types directly to TypeScript declaration files

## Installation

```bash
npm install @tessen/type-gen
# or
pnpm add @tessen/type-gen
# or
yarn add @tessen/type-gen
```

## Usage

### CLI Usage (npx/Deno)

The module supports CLI usage for easy integration into build processes and development workflows. It works with both Node.js (via npx) and Deno (via npm: specifier).

#### Basic CLI Usage

Generate types once:
```bash
# Using npx (Node.js)
npx @tessen/type-gen --tessenImport ./src/tessen.ts

# Using Deno
deno run --allow-read --allow-write npm:@tessen/type-gen --tessenImport ./src/tessen.ts
```

Watch for changes and regenerate automatically:
```bash
# Using npx (Node.js)
npx @tessen/type-gen --tessenImport ./src/tessen.ts --watch

# Using Deno
deno run --allow-read --allow-write npm:@tessen/type-gen --tessenImport ./src/tessen.ts --watch
```

#### CLI Options

- `--tessenImport <path>` (required): Path to import Tessen instances from
- `--out <path>`: Output path for generated types (default: `./src/locales.d.ts`)
- `--listenPath <path>`: Path to watch for changes (default: `./src/i18n`)
- `--watch, -w`: Watch for file changes and regenerate types automatically

#### CLI Examples

```bash
# Basic usage with default output (Node.js)
npx @tessen/type-gen --tessenImport ./src/tessen.ts

# Basic usage with default output (Deno)
deno run --allow-read --allow-write npm:@tessen/type-gen --tessenImport ./src/tessen.ts

# Custom output path (Node.js)
npx @tessen/type-gen --tessenImport ./src/tessen.ts --out ./types/locales.d.ts

# Custom output path (Deno)
deno run --allow-read --allow-write npm:@tessen/type-gen --tessenImport ./src/tessen.ts --out ./types/locales.d.ts

# Watch mode with custom listen path (Node.js)
npx @tessen/type-gen --tessenImport ./src/tessen.ts --watch --listenPath ./locales

# Watch mode with custom listen path (Deno)
deno run --allow-read --allow-write npm:@tessen/type-gen --tessenImport ./src/tessen.ts --watch --listenPath ./locales

# All options combined (Node.js)
npx @tessen/type-gen --listenPath ./src/i18n --out ./src/locales.d.ts --tessenImport ./src/tessen.ts --watch

# All options combined (Deno)
deno run --allow-read --allow-write npm:@tessen/type-gen --listenPath ./src/i18n --out ./src/locales.d.ts --tessenImport ./src/tessen.ts --watch
```

The CLI automatically:
- 🔍 **Detects Tessen instances** by constructor name from any export in the target file
- 🔄 **Clears module cache** when regenerating in watch mode for fresh imports
- ⚡ **Debounces file changes** to avoid excessive regeneration
- 🎯 **Supports both ESM and CommonJS** module formats
- 🦕 **Works with Deno** using npm: specifier (requires `--allow-read` and `--allow-write` permissions)

### Programmatic Usage

```typescript
import { generateLocalizationTypes, createTypeGenerationConfig } from '@tessen/type-gen';
import { Tessen } from 'tessen';

// Create your Tessen instance
const tessen = new Tessen({
  id: 'my-bot',
  clients: [{
    id: 'main-client',
    token: 'your-bot-token',
    options: { intents: [] }
  }]
});

// Generate types
const config = createTypeGenerationConfig(tessen);
const types = generateLocalizationTypes(config);

console.log(types);
```

### Multiple Clients

```typescript
import { generateLocalizationTypes, createTypeGenerationConfig } from '@tessen/type-gen';

const config = createTypeGenerationConfig([tessen1, tessen2, tessen3]);
const types = generateLocalizationTypes(config);
```

### Write to File

```typescript
import { writeLocalizationTypes } from '@tessen/type-gen';

// Option 1: Use default output path (process.cwd()/localization.d.ts)
const config = createTypeGenerationConfig(tessen);
await writeLocalizationTypes(config);

// Option 2: Specify custom output path in config
const configWithPath = createTypeGenerationConfig(tessen, './types/localization.d.ts');
await writeLocalizationTypes(configWithPath);
```

## Parameter Detection Examples

The module automatically detects and converts localization parameters:

### Indexed Parameters
```
Input:  "{0} is now a {1}"
Output: (_0: string, _1: string) => string
```

### Named Parameters
```
Input:  "{0:user} is now a {1:role}"
Output: (user: string, role: string) => string
```

### No Parameters
```
Input:  "Hello, world!"
Output: () => string
```

## Generated Output Example

For a Tessen instance with localization data, the module generates:

```typescript
declare global {
    namespace Tessen {
        interface Localization {
            hello: () => string;
            welcome: (username: string) => string;
            userJoined: (user: string, server: string) => string;
            nested: {
                commands: {
                    help: () => string;
                    ping: (target: string) => string;
                };
                messages: {
                    error: (errorMessage: string) => string;
                    success: () => string;
                };
            };
        }
    }
}
```

## Multi-Client Output

When multiple Tessen instances are provided:

```typescript
declare global { // Client 1
    namespace Tessen {
        interface Localization {
            hello: () => string;
            world: (exampleParam: string) => string;
        }
    }
}

declare global { // Client 2
    namespace Tessen {
        interface Localization {
            secondClientHello: () => string;
        }
    }
}
```

## API Reference

### `generateLocalizationTypes(config: TypeGenerationConfig): string`

Generates TypeScript declaration strings from Tessen instances.

**Parameters:**
- `config`: Configuration object containing Tessen instances

**Returns:** Generated TypeScript declaration string

### `createTypeGenerationConfig(tessens: Tessen | Tessen[], outputPath?: string): TypeGenerationConfig`

Creates a configuration object for type generation.

**Parameters:**
- `tessens`: Single Tessen instance or array of instances
- `outputPath`: Optional custom output path (defaults to `process.cwd()/localization.d.ts`)

**Returns:** Configuration object

### `writeLocalizationTypes(config: TypeGenerationConfig): Promise<void>`

Writes generated types to a file using the output path from the configuration.

**Parameters:**
- `config`: Configuration object (containing tessens and optional outputPath)

## Types

### `TypeGenerationConfig`

```typescript
interface TypeGenerationConfig {
  tessens: Tessen[];
  outputPath?: string;
}
```

### `ExtractedParameter`

```typescript
interface ExtractedParameter {
  name: string;
  type: string;
}
```

## Contributing

This module is part of the Tessen ecosystem and is currently in development. It is not yet ready for production use.

## License

LGPL-3.0-or-later

## Authors

- Kıraç Armağan Önal
- Erdem Göksel
