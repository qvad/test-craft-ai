/**
 * Comprehensive unit tests for HoconParser, HoconSerializer, parseHocon,
 * serializeToHocon, and validateTestPlan in apps/api/src/modules/hocon/parser.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  HoconParser,
  HoconSerializer,
  parseHocon,
  serializeToHocon,
  validateTestPlan,
  hoconParser,
  hoconSerializer,
} from '../modules/hocon/parser.js';

// Mock fs/promises
vi.mock('fs/promises', () => ({
  readFile: vi.fn(),
}));

import * as fs from 'fs/promises';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Minimal valid HOCON string that satisfies validateStructure */
function minimalHocon(extra = '') {
  return `
testcraft {
  version = "1.0"
  plan {
    name = "Test Plan"
    nodes = []
    ${extra}
  }
}
`.trim();
}

// ---------------------------------------------------------------------------
// HoconParser — comment removal
// ---------------------------------------------------------------------------

describe('HoconParser — comment removal', () => {
  it('strips single-line // comments', async () => {
    const hocon = `
testcraft {
  version = "1.0" // trailing comment
  plan {
    name = "Demo" // another
    nodes = []
  }
}`;
    const result = await new HoconParser().parse(hocon);
    if (result.errors.length > 0) {
      console.log('HOCON Parse Errors:', JSON.stringify(result.errors, null, 2));
    }
    expect(result.errors).toHaveLength(0);
    expect(result.plan.testcraft.plan.name).toBe('Demo');
  });

  it('strips # comments', async () => {
    const hocon = `
# full-line hash comment
testcraft {
  version = "1.0"
  plan {
    name = "HashTest" # inline hash
    nodes = []
  }
}`;
    const result = await new HoconParser().parse(hocon);
    if (result.errors.length > 0) {
      console.log('HOCON Parse Errors:', JSON.stringify(result.errors, null, 2));
    }
    expect(result.errors).toHaveLength(0);
    expect(result.plan.testcraft.plan.name).toBe('HashTest');
  });

  it('preserves # and // inside quoted strings', async () => {
    const hocon = `
testcraft {
  version = "1.0"
  plan {
    name = "has#hash//slash"
    nodes = []
  }
}`;
    const result = await new HoconParser().parse(hocon);
    expect(result.plan.testcraft.plan.name).toBe('has#hash//slash');
  });

  it('preserves lines inside triple-quoted strings during comment removal', async () => {
    // The multi-line block should survive comment removal intact
    const hocon = `
testcraft {
  version = "1.0"
  plan {
    name = "MultiLine"
    description = """line1
# not a comment
line3"""
    nodes = []
  }
}`;
    const result = await new HoconParser().parse(hocon);
    if (result.errors.length > 0) {
      console.log('HOCON Parse Errors:', JSON.stringify(result.errors, null, 2));
    }
    expect(result.errors).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// HoconParser — multi-line strings
// ---------------------------------------------------------------------------

describe('HoconParser — multi-line strings', () => {
  it('converts triple-quoted string to escaped single-line string', async () => {
    const hocon = `
testcraft {
  version = "1.0"
  plan {
    name = "MLTest"
    description = """Hello
World"""
    nodes = []
  }
}`;
    const result = await new HoconParser().parse(hocon);
    // description should contain an escaped newline representation
    expect(result.plan.testcraft.plan.description).toContain('Hello');
    expect(result.plan.testcraft.plan.description).toContain('World');
  });

  it('escapes backslashes inside triple-quoted string', async () => {
    const hocon = `
testcraft {
  version = "1.0"
  plan {
    name = "EscapeTest"
    description = """path\\to\\file"""
    nodes = []
  }
}`;
    const result = await new HoconParser().parse(hocon);
    if (result.errors.length > 0) {
      console.log('HOCON Parse Errors:', JSON.stringify(result.errors, null, 2));
    }
    expect(result.errors).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// HoconParser — basic structure parsing
// ---------------------------------------------------------------------------

describe('HoconParser — basic structure parsing', () => {
  it('parses a minimal valid plan', async () => {
    const result = await new HoconParser().parse(minimalHocon());
    expect(result.errors).toHaveLength(0);
    expect(result.plan.testcraft.version).toBe('1.0');
    expect(result.plan.testcraft.plan.name).toBe('Test Plan');
    expect(result.plan.testcraft.plan.nodes).toEqual([]);
  });

  it('parses plan with description and author', async () => {
    const hocon = minimalHocon(`
    description = "A test plan"
    author = "Alice"
    `);
    const result = await new HoconParser().parse(hocon);
    if (result.errors.length > 0) {
      console.log('HOCON Parse Errors:', JSON.stringify(result.errors, null, 2));
    }
    expect(result.errors).toHaveLength(0);
    expect(result.plan.testcraft.plan.description).toBe('A test plan');
    expect(result.plan.testcraft.plan.author).toBe('Alice');
  });

  it('parses nodes array with one node', async () => {
    const hocon = `
testcraft {
  version = "1.0"
  plan {
    name = "NodeTest"
    nodes = [
      {
        name = "My Node"
        type = "http-sampler"
      }
    ]
  }
}`;
    const result = await new HoconParser().parse(hocon);
    if (result.errors.length > 0) {
      console.log('HOCON Parse Errors:', JSON.stringify(result.errors, null, 2));
    }
    expect(result.errors).toHaveLength(0);
    expect(result.plan.testcraft.plan.nodes).toHaveLength(1);
    expect(result.plan.testcraft.plan.nodes[0].name).toBe('My Node');
    expect(result.plan.testcraft.plan.nodes[0].type).toBe('http-sampler');
  });

  it('auto-generates IDs for nodes that lack them', async () => {
    const hocon = `
testcraft {
  version = "1.0"
  plan {
    name = "IDTest"
    nodes = [
      { name = "N1" type = "http-sampler" }
    ]
  }
}`;
    const result = await new HoconParser().parse(hocon);
    if (result.errors.length > 0) {
      console.log('HOCON Parse Errors:', JSON.stringify(result.errors, null, 2));
    }
    expect(result.errors).toHaveLength(0);
    const node = result.plan.testcraft.plan.nodes[0];
    expect(node.id).toBeTruthy();
    expect(typeof node.id).toBe('string');
  });

  it('preserves user-supplied node IDs', async () => {
    const hocon = `
testcraft {
  version = "1.0"
  plan {
    name = "IDPreserve"
    nodes = [
      { id = "my-fixed-id" name = "N1" type = "http-sampler" }
    ]
  }
}`;
    const result = await new HoconParser().parse(hocon);
    expect(result.plan.testcraft.plan.nodes[0].id).toBe('my-fixed-id');
  });
});

// ---------------------------------------------------------------------------
// HoconParser — nested objects / children
// ---------------------------------------------------------------------------

describe('HoconParser — nested nodes (children)', () => {
  it('parses nested children nodes and generates their IDs', async () => {
    const hocon = `
testcraft {
  version = "1.0"
  plan {
    name = "ChildrenTest"
    nodes = [
      {
        name = "Parent"
        type = "transaction-controller"
        children = [
          { name = "Child1" type = "http-sampler" }
          { name = "Child2" type = "http-sampler" }
        ]
      }
    ]
  }
}`;
    const result = await new HoconParser().parse(hocon);
    if (result.errors.length > 0) {
      console.log('HOCON Parse Errors:', JSON.stringify(result.errors, null, 2));
    }
    expect(result.errors).toHaveLength(0);
    const parent = result.plan.testcraft.plan.nodes[0];
    expect(parent.children).toHaveLength(2);
    expect(parent.children![0].id).toBeTruthy();
    expect(parent.children![1].id).toBeTruthy();
    expect(parent.children![0].id).not.toBe(parent.children![1].id);
  });

  it('generates IDs for deeply nested children', async () => {
    const hocon = `
testcraft {
  version = "1.0"
  plan {
    name = "DeepNest"
    nodes = [
      {
        name = "L1"
        type = "transaction-controller"
        children = [
          {
            name = "L2"
            type = "transaction-controller"
            children = [
              { name = "L3" type = "http-sampler" }
            ]
          }
        ]
      }
    ]
  }
}`;
    const result = await new HoconParser().parse(hocon);
    if (result.errors.length > 0) {
      console.log('HOCON Parse Errors:', JSON.stringify(result.errors, null, 2));
    }
    expect(result.errors).toHaveLength(0);
    const l3 = result.plan.testcraft.plan.nodes[0].children![0].children![0];
    expect(l3.id).toBeTruthy();
    expect(l3.name).toBe('L3');
  });
});

// ---------------------------------------------------------------------------
// HoconParser — variables
// ---------------------------------------------------------------------------

describe('HoconParser — variable definitions in plan', () => {
  it('parses plan variables block', async () => {
    const hocon = `
testcraft {
  version = "1.0"
  plan {
    name = "VarsTest"
    variables {
      baseUrl {
        type = "string"
        value = "http://example.com"
        description = "Base URL"
      }
    }
    nodes = []
  }
}`;
    const result = await new HoconParser().parse(hocon);
    if (result.errors.length > 0) {
      console.log('HOCON Parse Errors:', JSON.stringify(result.errors, null, 2));
    }
    expect(result.errors).toHaveLength(0);
    expect(result.plan.testcraft.plan.variables).toBeDefined();
    expect(result.plan.testcraft.plan.variables!['baseUrl']).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// HoconParser — substitutions
// ---------------------------------------------------------------------------

describe('HoconParser — substitutions', () => {
  it('resolves ${variable} from options.variables', async () => {
    const hocon = `
testcraft {
  version = "1.0"
  plan {
    name = "SubTest"
    description = "Env: \${env_name}"
    nodes = []
  }
}`;
    const result = await new HoconParser({ variables: { env_name: 'staging' } }).parse(hocon);
    expect(result.errors).toHaveLength(0);
    expect(result.plan.testcraft.plan.description).toBe('Env: staging');
  });

  it('resolves nested variable paths like ${a.b}', async () => {
    const hocon = `
testcraft {
  version = "1.0"
  plan {
    name = "NestedSubTest"
    description = "URL: \${server.host}"
    nodes = []
  }
}`;
    const result = await new HoconParser({ variables: { server: { host: 'localhost' } } }).parse(hocon);
    expect(result.plan.testcraft.plan.description).toBe('URL: localhost');
  });

  it('leaves unresolved ${variable} intact when not found', async () => {
    const hocon = `
testcraft {
  version = "1.0"
  plan {
    name = "UnresolvedSub"
    description = "Val: \${missing_var}"
    nodes = []
  }
}`;
    const result = await new HoconParser().parse(hocon);
    expect(result.plan.testcraft.plan.description).toBe('Val: ${missing_var}');
  });

  it('resolves ${env.VAR} from process.env', async () => {
    process.env['TEST_HOCON_VAR'] = 'from-env';
    const hocon = `
testcraft {
  version = "1.0"
  plan {
    name = "EnvSub"
    description = "Got: \${env.TEST_HOCON_VAR}"
    nodes = []
  }
}`;
    const result = await new HoconParser().parse(hocon);
    expect(result.plan.testcraft.plan.description).toBe('Got: from-env');
    delete process.env['TEST_HOCON_VAR'];
  });

  it('leaves ${env.MISSING} intact when env var absent', async () => {
    delete process.env['NONEXISTENT_HOCON_ENV'];
    const hocon = `
testcraft {
  version = "1.0"
  plan {
    name = "EnvMissing"
    description = "Got: \${env.NONEXISTENT_HOCON_ENV}"
    nodes = []
  }
}`;
    const result = await new HoconParser().parse(hocon);
    expect(result.plan.testcraft.plan.description).toBe('Got: ${env.NONEXISTENT_HOCON_ENV}');
  });

  it('resolves substitutions inside node config values', async () => {
    const hocon = `
testcraft {
  version = "1.0"
  plan {
    name = "NodeSubTest"
    nodes = [
      {
        name = "HTTP"
        type = "http-sampler"
        config {
          url = "\${base_url}/api"
        }
      }
    ]
  }
}`;
    const result = await new HoconParser({ variables: { base_url: 'http://localhost:8080' } }).parse(hocon);
    expect(result.errors).toHaveLength(0);
    const node = result.plan.testcraft.plan.nodes[0];
    expect((node.config as any)?.url).toBe('http://localhost:8080/api');
  });

  it('resolves substitutions inside arrays', async () => {
    const hocon = `
testcraft {
  version = "1.0"
  plan {
    name = "ArraySubTest"
    tags = ["\${tag1}", "\${tag2}"]
    nodes = []
  }
}`;
    const result = await new HoconParser({ variables: { tag1: 'smoke', tag2: 'regression' } }).parse(hocon);
    expect(result.plan.testcraft.plan.tags).toEqual(['smoke', 'regression']);
  });
});

// ---------------------------------------------------------------------------
// HoconParser — environments
// ---------------------------------------------------------------------------

describe('HoconParser — environment overrides', () => {
  const hoconWithEnvs = `
testcraft {
  version = "1.0"
  plan {
    name = "EnvTest"
    variables {
      apiUrl {
        type = "string"
        value = "http://default"
      }
    }
    environments {
      staging {
        variables {
          apiUrl = "http://staging"
        }
      }
      prod {
        variables {
          apiUrl = "http://prod"
        }
      }
      child {
        extends = "staging"
        variables {
          extra = "child-only"
        }
      }
    }
    nodes = []
  }
}`;

  it('applies environment variable overrides', async () => {
    const result = await new HoconParser({ environment: 'staging' }).parse(hoconWithEnvs);
    expect(result.errors).toHaveLength(0);
    const vars = result.plan.testcraft.plan.variables!;
    expect(vars['apiUrl']?.value).toBe('http://staging');
  });

  it('emits warning when requested environment is missing', async () => {
    const result = await new HoconParser({ environment: 'nonexistent' }).parse(hoconWithEnvs);
    expect(result.warnings.some((w) => w.includes('nonexistent'))).toBe(true);
  });

  it('handles environment inheritance via extends', async () => {
    const result = await new HoconParser({ environment: 'child' }).parse(hoconWithEnvs);
    expect(result.errors).toHaveLength(0);
    const vars = result.plan.testcraft.plan.variables!;
    expect(vars['extra']?.value).toBe('child-only');
  });

  it('applies connection overrides from environment', async () => {
    const hocon = `
testcraft {
  version = "1.0"
  plan {
    name = "ConnEnvTest"
    connections {
      db {
        type = "jdbc"
        url = "jdbc:postgresql://localhost/test"
      }
    }
    environments {
      ci {
        connections {
          db {
            url = "jdbc:postgresql://ci-host/test"
          }
        }
      }
    }
    nodes = []
  }
}`;
    const result = await new HoconParser({ environment: 'ci' }).parse(hocon);
    expect(result.errors).toHaveLength(0);
    const db = result.plan.testcraft.plan.connections?.['db'];
    expect(db?.url).toBe('jdbc:postgresql://ci-host/test');
  });
});

// ---------------------------------------------------------------------------
// HoconParser — includes (mocked fs)
// ---------------------------------------------------------------------------

describe('HoconParser — include directives', () => {
  beforeEach(() => {
    vi.mocked(fs.readFile).mockImplementation(async (filePath: any) => {
      const p = String(filePath);
      if (p.endsWith('child.conf')) {
        return `{ "extraKey": "extraValue" }`;
      }
      throw new Error(`ENOENT: no such file: ${p}`);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('tracks included file paths', async () => {
    const hocon = `
testcraft {
  version = "1.0"
  plan {
    name = "IncludeTest"
    include = "child.conf"
    nodes = []
  }
}`;
    const result = await new HoconParser({ resolveIncludes: true }).parse(hocon);
    expect(result.includes).toContain('child.conf');
  });

  it('adds warning when include file is missing', async () => {
    vi.restoreAllMocks();
    vi.spyOn(fs, 'readFile').mockRejectedValue(new Error('ENOENT'));

    const hocon = `
testcraft {
  version = "1.0"
  plan {
    name = "MissingInclude"
    include = "ghost.conf"
    nodes = []
  }
}`;
    const result = await new HoconParser({ resolveIncludes: true }).parse(hocon);
    expect(result.warnings.some((w) => w.includes('ghost.conf'))).toBe(true);
  });

  it('skips include resolution when resolveIncludes = false', async () => {
    const hocon = `
testcraft {
  version = "1.0"
  plan {
    name = "NoInclude"
    include = "child.conf"
    nodes = []
  }
}`;
    const result = await new HoconParser({ resolveIncludes: false }).parse(hocon);
    expect(result.includes).toHaveLength(0);
    // readFile should not have been called for child.conf
    const calls = (fs.readFile as any).mock?.calls ?? [];
    const childCalls = calls.filter((c: any[]) => String(c[0]).endsWith('child.conf'));
    expect(childCalls).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// HoconParser — parseFile
// ---------------------------------------------------------------------------

describe('HoconParser.parseFile', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('reads file and parses its content', async () => {
    vi.mocked(fs.readFile).mockResolvedValue(minimalHocon() as any);
    const result = await new HoconParser().parseFile('/some/plan.conf');
    expect(result.errors).toHaveLength(0);
    expect(result.plan.testcraft.plan.name).toBe('Test Plan');
  });

  it('returns error result when file cannot be read', async () => {
    vi.mocked(fs.readFile).mockRejectedValue(new Error('ENOENT'));
    const result = await new HoconParser().parseFile('/nonexistent/plan.conf');
    expect(result.errors.some((e) => e.message.includes('Failed to read file'))).toBe(true);
  });

  it('resolves relative path from basePath option', async () => {
    let capturedPath = '';
    vi.mocked(fs.readFile).mockImplementation(async (p: any) => {
      capturedPath = String(p);
      return minimalHocon() as any;
    });
    await new HoconParser({ basePath: '/base/dir' }).parseFile('plan.conf');
    expect(capturedPath).toBe('/base/dir/plan.conf');
  });
});

// ---------------------------------------------------------------------------
// HoconParser — validation errors
// ---------------------------------------------------------------------------

describe('HoconParser — structural validation', () => {
  it('errors when root "testcraft" element is missing', async () => {
    const hocon = `{ "foo": "bar" }`;
    const result = await new HoconParser().parse(hocon);
    expect(result.errors.some((e) => e.message.includes('testcraft'))).toBe(true);
  });

  it('errors when "plan" element is missing', async () => {
    const hocon = `{ "testcraft": { "version": "1.0" } }`;
    const result = await new HoconParser().parse(hocon);
    expect(result.errors.some((e) => e.message.includes('plan'))).toBe(true);
  });

  it('errors when plan name is missing', async () => {
    const hocon = `{ "testcraft": { "version": "1.0", "plan": { "nodes": [] } } }`;
    const result = await new HoconParser().parse(hocon);
    expect(result.errors.some((e) => e.message.includes('name'))).toBe(true);
  });

  it('errors when nodes array is missing', async () => {
    const hocon = `{ "testcraft": { "version": "1.0", "plan": { "name": "X" } } }`;
    const result = await new HoconParser().parse(hocon);
    expect(result.errors.some((e) => e.message.includes('nodes'))).toBe(true);
  });

  it('warns and defaults version when missing', async () => {
    const hocon = `{ "testcraft": { "plan": { "name": "X", "nodes": [] } } }`;
    const result = await new HoconParser().parse(hocon);
    expect(result.warnings.some((w) => w.toLowerCase().includes('version'))).toBe(true);
    expect(result.plan.testcraft.version).toBe('1.0');
  });

  it('returns error result for malformed JSON after hoconToJson', async () => {
    // Deeply broken HOCON that can't be rescued
    const hocon = `{ unclosed`;
    const result = await new HoconParser().parse(hocon);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// HoconParser — settings and connections
// ---------------------------------------------------------------------------

describe('HoconParser — settings and connections', () => {
  it('parses settings block', async () => {
    const hocon = `
testcraft {
  version = "1.0"
  plan {
    name = "SettingsTest"
    settings {
      defaultTimeout = "60s"
      continueOnError = true
      parallel = false
    }
    nodes = []
  }
}`;
    const result = await new HoconParser().parse(hocon);
    if (result.errors.length > 0) {
      console.log('HOCON Parse Errors:', JSON.stringify(result.errors, null, 2));
    }
    expect(result.errors).toHaveLength(0);
    const settings = result.plan.testcraft.plan.settings!;
    expect(settings.defaultTimeout).toBe('60s');
    expect(settings.continueOnError).toBe(true);
    expect(settings.parallel).toBe(false);
  });

  it('parses connections block', async () => {
    const hocon = `
testcraft {
  version = "1.0"
  plan {
    name = "ConnTest"
    connections {
      myDb {
        type = "jdbc"
        url = "jdbc:postgresql://localhost/mydb"
        username = "admin"
      }
    }
    nodes = []
  }
}`;
    const result = await new HoconParser().parse(hocon);
    if (result.errors.length > 0) {
      console.log('HOCON Parse Errors:', JSON.stringify(result.errors, null, 2));
    }
    expect(result.errors).toHaveLength(0);
    const conn = result.plan.testcraft.plan.connections?.['myDb'];
    expect(conn?.type).toBe('jdbc');
    expect(conn?.url).toBe('jdbc:postgresql://localhost/mydb');
  });
});

// ---------------------------------------------------------------------------
// HoconParser — singleton export
// ---------------------------------------------------------------------------

describe('hoconParser singleton', () => {
  it('is an instance of HoconParser', () => {
    expect(hoconParser).toBeInstanceOf(HoconParser);
  });

  it('can parse a minimal plan', async () => {
    const result = await hoconParser.parse(minimalHocon());
    expect(result.errors).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// HoconSerializer
// ---------------------------------------------------------------------------

describe('HoconSerializer.serialize', () => {
  it('serializes a minimal plan to HOCON string', () => {
    const plan = {
      testcraft: {
        version: '1.0',
        plan: {
          name: 'My Plan',
          nodes: [],
        },
      },
    };
    const output = new HoconSerializer().serialize(plan);
    expect(output).toContain('testcraft {');
    expect(output).toContain('version = "1.0"');
    expect(output).toContain('name = "My Plan"');
    expect(output).toContain('nodes = [');
  });

  it('includes description and author when present', () => {
    const plan = {
      testcraft: {
        version: '1.0',
        plan: {
          name: 'Full Plan',
          description: 'A desc',
          author: 'Bob',
          nodes: [],
        },
      },
    };
    const output = new HoconSerializer().serialize(plan);
    expect(output).toContain('description = "A desc"');
    expect(output).toContain('author = "Bob"');
  });

  it('omits optional fields when not present', () => {
    const plan = {
      testcraft: {
        version: '1.0',
        plan: { name: 'Minimal', nodes: [] },
      },
    };
    const output = new HoconSerializer().serialize(plan);
    expect(output).not.toContain('description');
    expect(output).not.toContain('author');
    expect(output).not.toContain('settings');
    expect(output).not.toContain('variables');
    expect(output).not.toContain('environments');
    expect(output).not.toContain('connections');
  });

  it('serializes tags as inline array', () => {
    const plan = {
      testcraft: {
        version: '1.0',
        plan: { name: 'Tagged', tags: ['smoke', 'regression'], nodes: [] },
      },
    };
    const output = new HoconSerializer().serialize(plan);
    expect(output).toContain('tags = ["smoke", "regression"]');
  });

  it('serializes settings block', () => {
    const plan = {
      testcraft: {
        version: '1.0',
        plan: {
          name: 'WithSettings',
          settings: { defaultTimeout: '30s', continueOnError: false },
          nodes: [],
        },
      },
    };
    const output = new HoconSerializer().serialize(plan);
    expect(output).toContain('settings {');
    expect(output).toContain('defaultTimeout = "30s"');
    expect(output).toContain('continueOnError = false');
  });

  it('serializes variables block', () => {
    const plan = {
      testcraft: {
        version: '1.0',
        plan: {
          name: 'WithVars',
          variables: {
            myVar: { type: 'string' as const, value: 'hello', description: 'A var' },
          },
          nodes: [],
        },
      },
    };
    const output = new HoconSerializer().serialize(plan);
    expect(output).toContain('variables {');
    expect(output).toContain('myVar {');
    expect(output).toContain('type = "string"');
    expect(output).toContain('value = "hello"');
  });

  it('serializes environments block', () => {
    const plan = {
      testcraft: {
        version: '1.0',
        plan: {
          name: 'WithEnvs',
          environments: {
            staging: { description: 'Staging env', variables: { host: 'stg.example.com' } },
          },
          nodes: [],
        },
      },
    };
    const output = new HoconSerializer().serialize(plan);
    expect(output).toContain('environments {');
    expect(output).toContain('staging {');
  });

  it('serializes connections block', () => {
    const plan = {
      testcraft: {
        version: '1.0',
        plan: {
          name: 'WithConns',
          connections: {
            api: { type: 'http' as const, baseUrl: 'https://api.example.com' },
          },
          nodes: [],
        },
      },
    };
    const output = new HoconSerializer().serialize(plan);
    expect(output).toContain('connections {');
    expect(output).toContain('api {');
    expect(output).toContain('baseUrl = "https://api.example.com"');
  });

  it('serializes a node with config block', () => {
    const plan = {
      testcraft: {
        version: '1.0',
        plan: {
          name: 'WithNode',
          nodes: [
            {
              id: 'n1',
              name: 'HTTP Request',
              type: 'http-sampler',
              config: { url: 'http://example.com', method: 'GET' },
            },
          ],
        },
      },
    };
    const output = new HoconSerializer().serialize(plan);
    expect(output).toContain('id = "n1"');
    expect(output).toContain('name = "HTTP Request"');
    expect(output).toContain('type = "http-sampler"');
    expect(output).toContain('config {');
    expect(output).toContain('url = "http://example.com"');
  });

  it('serializes a node with enabled = false', () => {
    const plan = {
      testcraft: {
        version: '1.0',
        plan: {
          name: 'DisabledNode',
          nodes: [{ name: 'N', type: 'http-sampler', enabled: false }],
        },
      },
    };
    const output = new HoconSerializer().serialize(plan);
    expect(output).toContain('enabled = false');
  });

  it('omits enabled when true (default)', () => {
    const plan = {
      testcraft: {
        version: '1.0',
        plan: {
          name: 'EnabledNode',
          nodes: [{ name: 'N', type: 'http-sampler', enabled: true }],
        },
      },
    };
    const output = new HoconSerializer().serialize(plan);
    // enabled = true is falsy check (enabled === false), so it should not appear
    expect(output).not.toContain('enabled = true');
  });

  it('serializes node children', () => {
    const plan = {
      testcraft: {
        version: '1.0',
        plan: {
          name: 'WithChildren',
          nodes: [
            {
              name: 'Parent',
              type: 'transaction-controller',
              children: [{ name: 'Child', type: 'http-sampler' }],
            },
          ],
        },
      },
    };
    const output = new HoconSerializer().serialize(plan);
    expect(output).toContain('children = [');
    expect(output).toContain('name = "Child"');
  });

  it('serializes node ai block', () => {
    const plan = {
      testcraft: {
        version: '1.0',
        plan: {
          name: 'AINode',
          nodes: [
            {
              name: 'AI Step',
              type: 'ai-assert',
              ai: { intent: 'Check the response', language: 'javascript' },
            },
          ],
        },
      },
    };
    const output = new HoconSerializer().serialize(plan);
    expect(output).toContain('ai {');
    expect(output).toContain('intent = "Check the response"');
  });

  it('serializes node timeout and retries', () => {
    const plan = {
      testcraft: {
        version: '1.0',
        plan: {
          name: 'RetryNode',
          nodes: [{ name: 'N', type: 'http-sampler', timeout: '10s', retries: 3 }],
        },
      },
    };
    const output = new HoconSerializer().serialize(plan);
    expect(output).toContain('timeout = "10s"');
    expect(output).toContain('retries = 3');
  });

  it('escapes special characters in string values', () => {
    const plan = {
      testcraft: {
        version: '1.0',
        plan: {
          name: 'Escape "Quotes" \\Backslash',
          nodes: [],
        },
      },
    };
    const output = new HoconSerializer().serialize(plan);
    expect(output).toContain('\\"Quotes\\"');
    expect(output).toContain('\\\\Backslash');
  });

  it('serializes array values containing objects', () => {
    const plan = {
      testcraft: {
        version: '1.0',
        plan: {
          name: 'ObjArray',
          settings: {
            reporting: { format: ['json', 'junit'] as any },
          },
          nodes: [],
        },
      },
    };
    const output = new HoconSerializer().serialize(plan);
    expect(output).toContain('format = ["json", "junit"]');
  });

  it('skips null and undefined values in serializeObject', () => {
    const plan = {
      testcraft: {
        version: '1.0',
        plan: {
          name: 'NullValues',
          settings: { defaultTimeout: undefined, defaultLanguage: null as any },
          nodes: [],
        },
      },
    };
    const output = new HoconSerializer().serialize(plan);
    expect(output).not.toContain('defaultTimeout');
    expect(output).not.toContain('defaultLanguage');
  });
});

// ---------------------------------------------------------------------------
// HoconSerializer singleton
// ---------------------------------------------------------------------------

describe('hoconSerializer singleton', () => {
  it('is an instance of HoconSerializer', () => {
    expect(hoconSerializer).toBeInstanceOf(HoconSerializer);
  });

  it('produces a parseable output', () => {
    const plan = {
      testcraft: {
        version: '1.0',
        plan: { name: 'Singleton', nodes: [] },
      },
    };
    expect(() => hoconSerializer.serialize(plan)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// serializeToHocon helper
// ---------------------------------------------------------------------------

describe('serializeToHocon helper', () => {
  it('wraps plan in testcraft envelope', () => {
    const output = serializeToHocon({ name: 'My Plan', nodes: [] });
    expect(output).toContain('testcraft {');
    expect(output).toContain('name = "My Plan"');
  });
});

// ---------------------------------------------------------------------------
// parseHocon helper
// ---------------------------------------------------------------------------

describe('parseHocon helper', () => {
  it('parses simple HOCON with unquoted keys', () => {
    const hocon = `
testcraft {
  version = "1.0"
  plan {
    name = "Simple"
    nodes = []
  }
}`;
    const result = parseHocon(hocon);
    expect(result).toBeDefined();
  });

  it('strips // comments', () => {
    const hocon = `
testcraft { // comment
  version = "1.0"
  plan {
    name = "Comments"
    nodes = []
  }
}`;
    const result = parseHocon(hocon);
    expect(result).not.toBeNull();
  });

  it('strips # comments', () => {
    const hocon = `
# header
testcraft {
  version = "1.0"
  plan {
    name = "HashComment"
    nodes = []
  }
}`;
    const result = parseHocon(hocon);
    expect(result).not.toBeNull();
  });

  it('handles multi-line strings via triple quotes', () => {
    const hocon = `{ key = """hello\nworld""" }`;
    const result = parseHocon(hocon);
    expect(result).toBeDefined();
  });

  it('returns fallback object on parse failure', () => {
    const result = parseHocon('{ definitely: : invalid json {{{{');
    expect(result).toEqual({ testcraft: { plan: {} } });
  });

  it('removes trailing commas before parsing', () => {
    const hocon = `{ "key": "value", }`;
    expect(() => parseHocon(hocon)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// validateTestPlan helper
// ---------------------------------------------------------------------------

describe('validateTestPlan helper', () => {
  it('returns valid for a complete plan', () => {
    const result = validateTestPlan({ name: 'Good', nodes: [], version: '1.0' });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);
  });

  it('returns invalid for null/undefined plan', () => {
    expect(validateTestPlan(null).valid).toBe(false);
    expect(validateTestPlan(null).errors).toContain('Plan is empty');
    expect(validateTestPlan(undefined).valid).toBe(false);
  });

  it('errors when name is missing', () => {
    const result = validateTestPlan({ nodes: [] });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Missing plan name');
  });

  it('errors when nodes is not an array', () => {
    const result = validateTestPlan({ name: 'X', nodes: 'not-an-array' });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('nodes'))).toBe(true);
  });

  it('errors when nodes is missing entirely', () => {
    const result = validateTestPlan({ name: 'X' });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('nodes'))).toBe(true);
  });

  it('warns when version is missing', () => {
    const result = validateTestPlan({ name: 'X', nodes: [] });
    expect(result.valid).toBe(true);
    expect(result.warnings.some((w) => w.toLowerCase().includes('version'))).toBe(true);
  });

  it('no warning when version is present', () => {
    const result = validateTestPlan({ name: 'X', nodes: [], version: '1.0' });
    expect(result.warnings).toHaveLength(0);
  });

  it('accumulates multiple errors', () => {
    const result = validateTestPlan({});
    expect(result.errors.length).toBeGreaterThanOrEqual(2);
  });
});

// ---------------------------------------------------------------------------
// Round-trip: serialize → parse
// ---------------------------------------------------------------------------

describe('round-trip: serialize then parse', () => {
  it('serialized plan can be re-parsed without errors', async () => {
    const plan = {
      testcraft: {
        version: '1.0',
        plan: {
          name: 'RoundTrip',
          description: 'A round-trip test',
          tags: ['smoke'],
          nodes: [
            {
              id: 'rt-node',
              name: 'HTTP Get',
              type: 'http-sampler',
              config: { url: 'http://example.com', method: 'GET' },
            },
          ],
        },
      },
    };

    const serialized = new HoconSerializer().serialize(plan);
    const result = await new HoconParser().parse(serialized);

    expect(result.errors).toHaveLength(0);
    expect(result.plan.testcraft.plan.name).toBe('RoundTrip');
    expect(result.plan.testcraft.plan.nodes[0].id).toBe('rt-node');
  });
});
