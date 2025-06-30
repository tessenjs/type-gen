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

### Basic Usage

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

await writeLocalizationTypes(config, './types/localization.d.ts');
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

### `createTypeGenerationConfig(tessens: Tessen | Tessen[]): TypeGenerationConfig`

Creates a configuration object for type generation.

**Parameters:**
- `tessens`: Single Tessen instance or array of instances

**Returns:** Configuration object

### `writeLocalizationTypes(config: TypeGenerationConfig, outputPath: string): Promise<void>`

Writes generated types to a file.

**Parameters:**
- `config`: Configuration object
- `outputPath`: Path where the TypeScript declaration file should be written

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
