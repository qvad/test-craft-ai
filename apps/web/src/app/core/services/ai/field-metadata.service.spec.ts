import { TestBed } from '@angular/core/testing';
import { FieldMetadataService, FieldMetadata, FieldDataType } from './field-metadata.service';
import { NodeType } from '../../../shared/models';

describe('FieldMetadataService', () => {
  let service: FieldMetadataService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(FieldMetadataService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('getFields', () => {
    it('should return fields for http-request', () => {
      const fields = service.getFields('http-request');

      expect(fields.length).toBeGreaterThan(0);

      const methodField = fields.find(f => f.key === 'method');
      expect(methodField).toBeDefined();
      expect(methodField?.dataType).toBe('enum');
      expect(methodField?.allowedValues).toContain('GET');
      expect(methodField?.allowedValues).toContain('POST');
      expect(methodField?.required).toBe(true);

      const serverNameField = fields.find(f => f.key === 'serverName');
      expect(serverNameField).toBeDefined();
      expect(serverNameField?.dataType).toBe('string');
      expect(serverNameField?.supportsVariables).toBe(true);

      const pathField = fields.find(f => f.key === 'path');
      expect(pathField).toBeDefined();
      expect(pathField?.required).toBe(true);

      const bodyDataField = fields.find(f => f.key === 'bodyData');
      expect(bodyDataField).toBeDefined();
      expect(bodyDataField?.dataType).toBe('json');
    });

    it('should return fields for jdbc-request', () => {
      const fields = service.getFields('jdbc-request');

      const connectionRefField = fields.find(f => f.key === 'connectionRef');
      expect(connectionRefField).toBeDefined();
      expect(connectionRefField?.required).toBe(true);

      const queryTypeField = fields.find(f => f.key === 'queryType');
      expect(queryTypeField).toBeDefined();
      expect(queryTypeField?.dataType).toBe('enum');
      expect(queryTypeField?.allowedValues).toContain('select');
      expect(queryTypeField?.allowedValues).toContain('update');

      const queryField = fields.find(f => f.key === 'query');
      expect(queryField).toBeDefined();
      expect(queryField?.dataType).toBe('code');
    });

    it('should return fields for script', () => {
      const fields = service.getFields('script');

      const languageField = fields.find(f => f.key === 'language');
      expect(languageField).toBeDefined();
      expect(languageField?.dataType).toBe('enum');
      expect(languageField?.allowedValues).toContain('groovy');
      expect(languageField?.allowedValues).toContain('javascript');

      const scriptField = fields.find(f => f.key === 'script');
      expect(scriptField).toBeDefined();
      expect(scriptField?.dataType).toBe('code');
      expect(scriptField?.required).toBe(true);
    });

    it('should return fields for thread-group', () => {
      const fields = service.getFields('thread-group');

      const numThreadsField = fields.find(f => f.key === 'numThreads');
      expect(numThreadsField).toBeDefined();
      expect(numThreadsField?.dataType).toBe('number');
      expect(numThreadsField?.required).toBe(true);

      const rampUpField = fields.find(f => f.key === 'rampUp');
      expect(rampUpField).toBeDefined();

      const loopsField = fields.find(f => f.key === 'loops');
      expect(loopsField).toBeDefined();
    });

    it('should return fields for ai-task', () => {
      const fields = service.getFields('ai-task');

      const intentField = fields.find(f => f.key === 'intent');
      expect(intentField).toBeDefined();
      expect(intentField?.required).toBe(true);

      const languageField = fields.find(f => f.key === 'language');
      expect(languageField).toBeDefined();
      expect(languageField?.dataType).toBe('enum');

      const inputVariablesField = fields.find(f => f.key === 'inputVariables');
      expect(inputVariablesField).toBeDefined();
      expect(inputVariablesField?.dataType).toBe('array');

      const outputVariablesField = fields.find(f => f.key === 'outputVariables');
      expect(outputVariablesField).toBeDefined();
    });

    it('should return fields for docker-run', () => {
      const fields = service.getFields('docker-run');

      const imageNameField = fields.find(f => f.key === 'imageName');
      expect(imageNameField).toBeDefined();
      expect(imageNameField?.required).toBe(true);

      const imageTagField = fields.find(f => f.key === 'imageTag');
      expect(imageTagField).toBeDefined();
      expect(imageTagField?.defaultValue).toBe('latest');

      const pullPolicyField = fields.find(f => f.key === 'pullPolicy');
      expect(pullPolicyField).toBeDefined();
      expect(pullPolicyField?.dataType).toBe('enum');
      expect(pullPolicyField?.allowedValues).toContain('always');
      expect(pullPolicyField?.allowedValues).toContain('ifNotPresent');

      const environmentField = fields.find(f => f.key === 'environment');
      expect(environmentField).toBeDefined();
      expect(environmentField?.dataType).toBe('object');
    });

    it('should return fields for k8s-deploy', () => {
      const fields = service.getFields('k8s-deploy');

      const namespaceField = fields.find(f => f.key === 'namespace');
      expect(namespaceField).toBeDefined();
      expect(namespaceField?.defaultValue).toBe('default');

      const deploymentTypeField = fields.find(f => f.key === 'deploymentType');
      expect(deploymentTypeField).toBeDefined();
      expect(deploymentTypeField?.dataType).toBe('enum');
      expect(deploymentTypeField?.allowedValues).toContain('deployment');
      expect(deploymentTypeField?.allowedValues).toContain('statefulset');

      const replicasField = fields.find(f => f.key === 'replicas');
      expect(replicasField).toBeDefined();
      expect(replicasField?.dataType).toBe('number');

      const manifestYamlField = fields.find(f => f.key === 'manifestYaml');
      expect(manifestYamlField).toBeDefined();
      expect(manifestYamlField?.dataType).toBe('code');
    });

    it('should return fields for lm-studio', () => {
      const fields = service.getFields('lm-studio');

      const endpointField = fields.find(f => f.key === 'endpoint');
      expect(endpointField).toBeDefined();
      expect(endpointField?.required).toBe(true);
      expect(endpointField?.defaultValue).toContain('localhost:1234');

      const promptField = fields.find(f => f.key === 'prompt');
      expect(promptField).toBeDefined();
      expect(promptField?.required).toBe(true);

      const temperatureField = fields.find(f => f.key === 'temperature');
      expect(temperatureField).toBeDefined();
      expect(temperatureField?.dataType).toBe('number');
    });

    it('should return fields for response-assertion', () => {
      const fields = service.getFields('response-assertion');

      const testFieldField = fields.find(f => f.key === 'testField');
      expect(testFieldField).toBeDefined();
      expect(testFieldField?.dataType).toBe('enum');
      expect(testFieldField?.allowedValues).toContain('response-data');
      expect(testFieldField?.allowedValues).toContain('response-code');

      const testTypeField = fields.find(f => f.key === 'testType');
      expect(testTypeField).toBeDefined();
      expect(testTypeField?.allowedValues).toContain('contains');
      expect(testTypeField?.allowedValues).toContain('equals');

      const testStringsField = fields.find(f => f.key === 'testStrings');
      expect(testStringsField).toBeDefined();
      expect(testStringsField?.dataType).toBe('array');
    });

    it('should return fields for json-extractor', () => {
      const fields = service.getFields('json-extractor');

      const refNameField = fields.find(f => f.key === 'refName');
      expect(refNameField).toBeDefined();
      expect(refNameField?.required).toBe(true);

      const expressionField = fields.find(f => f.key === 'expression');
      expect(expressionField).toBeDefined();
      expect(expressionField?.required).toBe(true);

      const matchNumberField = fields.find(f => f.key === 'matchNumber');
      expect(matchNumberField).toBeDefined();
      expect(matchNumberField?.dataType).toBe('number');
    });

    it('should return fields for constant-timer', () => {
      const fields = service.getFields('constant-timer');

      const delayField = fields.find(f => f.key === 'delay');
      expect(delayField).toBeDefined();
      expect(delayField?.dataType).toBe('number');
      expect(delayField?.required).toBe(true);
    });

    it('should return fields for github-release', () => {
      const fields = service.getFields('github-release');

      const repositoryField = fields.find(f => f.key === 'repository');
      expect(repositoryField).toBeDefined();
      expect(repositoryField?.required).toBe(true);

      const releaseTagField = fields.find(f => f.key === 'releaseTag');
      expect(releaseTagField).toBeDefined();
      expect(releaseTagField?.defaultValue).toBe('latest');

      const extractArchiveField = fields.find(f => f.key === 'extractArchive');
      expect(extractArchiveField).toBeDefined();
      expect(extractArchiveField?.dataType).toBe('boolean');
    });

    it('should return base fields for unknown node types', () => {
      const fields = service.getFields('unknown-type' as NodeType);

      expect(fields.length).toBeGreaterThan(0);

      const descriptionField = fields.find(f => f.key === 'description');
      expect(descriptionField).toBeDefined();

      const timeoutField = fields.find(f => f.key === 'timeout');
      expect(timeoutField).toBeDefined();
    });
  });

  describe('getAllFields', () => {
    it('should return a map of all field definitions', () => {
      const allFields = service.getAllFields();

      expect(allFields).toBeInstanceOf(Map);
      expect(allFields.size).toBeGreaterThan(0);
      expect(allFields.has('http-request')).toBe(true);
      expect(allFields.has('jdbc-request')).toBe(true);
      expect(allFields.has('docker-run')).toBe(true);
    });
  });

  describe('base fields', () => {
    it('should include base fields in all node types', () => {
      const httpFields = service.getFields('http-request');
      const jdbcFields = service.getFields('jdbc-request');
      const dockerFields = service.getFields('docker-run');

      // All should have timeout field
      expect(httpFields.find(f => f.key === 'timeout')).toBeDefined();
      expect(jdbcFields.find(f => f.key === 'timeout')).toBeDefined();
      expect(dockerFields.find(f => f.key === 'timeout')).toBeDefined();

      // All should have description field
      expect(httpFields.find(f => f.key === 'description')).toBeDefined();
      expect(jdbcFields.find(f => f.key === 'description')).toBeDefined();
      expect(dockerFields.find(f => f.key === 'description')).toBeDefined();
    });
  });

  describe('field metadata structure', () => {
    it('should have required properties on all fields', () => {
      const fields = service.getFields('http-request');

      fields.forEach(field => {
        expect(field.key).toBeDefined();
        expect(typeof field.key).toBe('string');
        expect(field.label).toBeDefined();
        expect(typeof field.label).toBe('string');
        expect(field.description).toBeDefined();
        expect(typeof field.description).toBe('string');
        expect(field.dataType).toBeDefined();
        expect(['string', 'number', 'boolean', 'enum', 'json', 'code', 'array', 'object']).toContain(field.dataType);
        expect(typeof field.required).toBe('boolean');
        expect(typeof field.supportsVariables).toBe('boolean');
        expect(Array.isArray(field.semanticHints)).toBe(true);
      });
    });

    it('should have allowedValues for enum fields', () => {
      const fields = service.getFields('http-request');
      const enumFields = fields.filter(f => f.dataType === 'enum');

      enumFields.forEach(field => {
        expect(field.allowedValues).toBeDefined();
        expect(Array.isArray(field.allowedValues)).toBe(true);
        expect(field.allowedValues!.length).toBeGreaterThan(0);
      });
    });

    it('should have semantic hints for better AI understanding', () => {
      const fields = service.getFields('http-request');
      const methodField = fields.find(f => f.key === 'method');

      expect(methodField?.semanticHints.length).toBeGreaterThan(0);
      expect(methodField?.semanticHints.some(h => h.toLowerCase().includes('get'))).toBe(true);
      expect(methodField?.semanticHints.some(h => h.toLowerCase().includes('post'))).toBe(true);
    });
  });

  describe('simple node types', () => {
    const simpleNodeTypes: NodeType[] = [
      'loop-controller',
      'if-controller',
      'while-controller',
      'foreach-controller',
      'transaction-controller',
      'simple-controller',
      'uniform-random-timer',
      'gaussian-random-timer'
    ];

    simpleNodeTypes.forEach(nodeType => {
      it(`should return fields for ${nodeType}`, () => {
        const fields = service.getFields(nodeType);
        expect(fields.length).toBeGreaterThan(0);
        // Should at least have base fields
        expect(fields.find(f => f.key === 'description')).toBeDefined();
      });
    });
  });
});
