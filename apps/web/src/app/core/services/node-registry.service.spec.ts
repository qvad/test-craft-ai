import { TestBed } from '@angular/core/testing';
import { NodeRegistryService, NodeCategory } from './node-registry.service';
import { NodeType } from '../../shared/models';

describe('NodeRegistryService', () => {
  let service: NodeRegistryService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(NodeRegistryService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('Node Registration', () => {
    it('should register all expected node types', () => {
      const allNodes = service.getAll();
      // Currently 44 node types registered (including AI and infrastructure nodes)
      expect(allNodes.length).toBeGreaterThan(40);
    });

    it('should have root node type', () => {
      const root = service.get('root');
      expect(root).toBeDefined();
      expect(root?.label).toBe('Test Plan');
      expect(root?.category).toBe('test-plan');
      expect(root?.canHaveChildren).toBe(true);
    });

    it('should have thread-group node type', () => {
      const threadGroup = service.get('thread-group');
      expect(threadGroup).toBeDefined();
      expect(threadGroup?.label).toBe('Thread Group');
      expect(threadGroup?.category).toBe('thread-group');
    });

    it('should have http-request node type', () => {
      const httpRequest = service.get('http-request');
      expect(httpRequest).toBeDefined();
      expect(httpRequest?.label).toBe('HTTP Request');
      expect(httpRequest?.category).toBe('sampler');
    });

    it('should have jdbc-request node type', () => {
      const jdbcRequest = service.get('jdbc-request');
      expect(jdbcRequest).toBeDefined();
      expect(jdbcRequest?.category).toBe('sampler');
    });

    it('should have script node type', () => {
      const script = service.get('script');
      expect(script).toBeDefined();
      expect(script?.category).toBe('sampler');
    });
  });

  describe('AI Node Types', () => {
    it('should have ai-task node type', () => {
      const aiTask = service.get('ai-task');
      expect(aiTask).toBeDefined();
      expect(aiTask?.label).toBe('AI Task');
      expect(aiTask?.category).toBe('ai');
    });

    it('should have lm-studio node type', () => {
      const lmStudio = service.get('lm-studio');
      expect(lmStudio).toBeDefined();
      expect(lmStudio?.label).toBe('LM Studio');
      expect(lmStudio?.category).toBe('ai');
      expect(lmStudio?.defaultConfig).toHaveProperty('endpoint');
      expect(lmStudio?.defaultConfig).toHaveProperty('model');
      expect(lmStudio?.defaultConfig).toHaveProperty('temperature');
    });

    it('should have poe-ai node type', () => {
      const poeAi = service.get('poe-ai');
      expect(poeAi).toBeDefined();
      expect(poeAi?.label).toBe('Poe AI');
      expect(poeAi?.category).toBe('ai');
      expect(poeAi?.defaultConfig).toHaveProperty('botName');
      expect(poeAi?.defaultConfig).toHaveProperty('apiKey');
    });
  });

  describe('Infrastructure Node Types', () => {
    it('should have docker-run node type', () => {
      const dockerRun = service.get('docker-run');
      expect(dockerRun).toBeDefined();
      expect(dockerRun?.label).toBe('Docker Run');
      expect(dockerRun?.category).toBe('infrastructure');
      expect(dockerRun?.defaultConfig).toHaveProperty('imageName');
      expect(dockerRun?.defaultConfig).toHaveProperty('imageTag');
      expect(dockerRun?.defaultConfig).toHaveProperty('pullPolicy');
    });

    it('should have k8s-deploy node type', () => {
      const k8sDeploy = service.get('k8s-deploy');
      expect(k8sDeploy).toBeDefined();
      expect(k8sDeploy?.label).toBe('K8s Deploy');
      expect(k8sDeploy?.category).toBe('infrastructure');
      expect(k8sDeploy?.defaultConfig).toHaveProperty('namespace');
      expect(k8sDeploy?.defaultConfig).toHaveProperty('deploymentType');
      expect(k8sDeploy?.defaultConfig).toHaveProperty('replicas');
    });

    it('should have github-release node type', () => {
      const githubRelease = service.get('github-release');
      expect(githubRelease).toBeDefined();
      expect(githubRelease?.label).toBe('GitHub Release');
      expect(githubRelease?.category).toBe('infrastructure');
      expect(githubRelease?.defaultConfig).toHaveProperty('repository');
      expect(githubRelease?.defaultConfig).toHaveProperty('releaseTag');
    });
  });

  describe('Controller Node Types', () => {
    const controllerTypes: NodeType[] = [
      'loop-controller',
      'if-controller',
      'while-controller',
      'foreach-controller',
      'transaction-controller',
      'simple-controller'
    ];

    controllerTypes.forEach((type) => {
      it(`should have ${type} node type`, () => {
        const controller = service.get(type);
        expect(controller).toBeDefined();
        expect(controller?.category).toBe('logic-controller');
        expect(controller?.canHaveChildren).toBe(true);
      });
    });
  });

  describe('Timer Node Types', () => {
    const timerTypes: NodeType[] = [
      'constant-timer',
      'uniform-random-timer',
      'gaussian-random-timer'
    ];

    timerTypes.forEach((type) => {
      it(`should have ${type} node type`, () => {
        const timer = service.get(type);
        expect(timer).toBeDefined();
        expect(timer?.category).toBe('timer');
        expect(timer?.canHaveChildren).toBe(false);
      });
    });
  });

  describe('Assertion Node Types', () => {
    const assertionTypes: NodeType[] = [
      'response-assertion',
      'json-assertion',
      'duration-assertion'
    ];

    assertionTypes.forEach((type) => {
      it(`should have ${type} node type`, () => {
        const assertion = service.get(type);
        expect(assertion).toBeDefined();
        expect(assertion?.category).toBe('assertion');
      });
    });
  });

  describe('Extractor Node Types', () => {
    const extractorTypes: NodeType[] = [
      'json-extractor',
      'regex-extractor',
      'css-extractor'
    ];

    extractorTypes.forEach((type) => {
      it(`should have ${type} node type`, () => {
        const extractor = service.get(type);
        expect(extractor).toBeDefined();
        expect(extractor?.category).toBe('post-processor');
      });
    });
  });

  describe('Categories', () => {
    it('should return all categories', () => {
      const categories = service.getCategories();
      expect(categories).toContain('test-plan');
      expect(categories).toContain('thread-group');
      expect(categories).toContain('sampler');
      expect(categories).toContain('logic-controller');
      expect(categories).toContain('timer');
      expect(categories).toContain('assertion');
      expect(categories).toContain('ai');
      expect(categories).toContain('infrastructure');
    });

    it('should return correct category labels', () => {
      expect(service.getCategoryLabel('test-plan')).toBe('Test Plan');
      expect(service.getCategoryLabel('thread-group')).toBe('Thread Groups');
      expect(service.getCategoryLabel('sampler')).toBe('Samplers');
      expect(service.getCategoryLabel('ai')).toBe('AI');
      expect(service.getCategoryLabel('infrastructure')).toBe('Infrastructure');
    });

    it('should get nodes by category', () => {
      const samplers = service.getByCategory('sampler');
      expect(samplers.length).toBeGreaterThan(0);
      expect(samplers.every((s) => s.category === 'sampler')).toBe(true);

      const aiNodes = service.getByCategory('ai');
      expect(aiNodes.length).toBeGreaterThanOrEqual(3);
      expect(aiNodes.some((n) => n.type === 'lm-studio')).toBe(true);
      expect(aiNodes.some((n) => n.type === 'poe-ai')).toBe(true);

      const infraNodes = service.getByCategory('infrastructure');
      expect(infraNodes.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('Parent-Child Relationships', () => {
    it('should allow thread-group as child of root', () => {
      const root = service.get('root');
      expect(root?.allowedChildren).toContain('thread-group');
    });

    it('should allow http-request as child of thread-group', () => {
      const threadGroup = service.get('thread-group');
      expect(threadGroup?.allowedChildren).toContain('http-request');
    });

    it('should allow new AI nodes as children of thread-group', () => {
      const threadGroup = service.get('thread-group');
      expect(threadGroup?.allowedChildren).toContain('lm-studio');
      expect(threadGroup?.allowedChildren).toContain('poe-ai');
    });

    it('should allow infrastructure nodes as children of thread-group', () => {
      const threadGroup = service.get('thread-group');
      expect(threadGroup?.allowedChildren).toContain('docker-run');
      expect(threadGroup?.allowedChildren).toContain('k8s-deploy');
      expect(threadGroup?.allowedChildren).toContain('github-release');
    });

    it('should return allowed children for a parent type', () => {
      const children = service.getAllowedChildren('thread-group');
      expect(children.length).toBeGreaterThan(0);
      expect(children.some((c) => c.type === 'http-request')).toBe(true);
    });

    it('should check if child can be added to parent', () => {
      expect(service.canAddChild('thread-group', 'http-request')).toBe(true);
      expect(service.canAddChild('root', 'thread-group')).toBe(true);
      expect(service.canAddChild('http-request', 'thread-group')).toBe(false);
    });
  });

  describe('Default Configs', () => {
    it('should return default config for http-request', () => {
      const config = service.getDefaultConfig('http-request');
      expect(config).toHaveProperty('method');
      expect(config).toHaveProperty('protocol');
      expect(config).toHaveProperty('serverName');
      expect(config).toHaveProperty('timeout');
    });

    it('should return default config for thread-group', () => {
      const config = service.getDefaultConfig('thread-group');
      expect(config).toHaveProperty('numThreads');
      expect(config).toHaveProperty('rampUp');
      expect(config).toHaveProperty('loops');
    });

    it('should return default config for docker-run', () => {
      const config = service.getDefaultConfig('docker-run');
      expect(config).toHaveProperty('imageName');
      expect(config).toHaveProperty('imageTag');
      expect((config as any).imageTag).toBe('latest');
      expect(config).toHaveProperty('pullPolicy');
      expect((config as any).pullPolicy).toBe('ifNotPresent');
    });

    it('should return default config for k8s-deploy', () => {
      const config = service.getDefaultConfig('k8s-deploy');
      expect(config).toHaveProperty('namespace');
      expect((config as any).namespace).toBe('default');
      expect(config).toHaveProperty('replicas');
      expect((config as any).replicas).toBe(1);
    });

    it('should return default config for lm-studio', () => {
      const config = service.getDefaultConfig('lm-studio');
      expect(config).toHaveProperty('endpoint');
      expect((config as any).endpoint).toContain('localhost:1234');
      expect(config).toHaveProperty('temperature');
      expect((config as any).temperature).toBe(0.7);
    });

    it('should return base config for unknown type', () => {
      const config = service.getDefaultConfig('unknown-type' as NodeType);
      expect(config).toHaveProperty('timeout');
      expect(config).toHaveProperty('retryCount');
    });
  });
});
