import { Component, inject, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Tabs, TabList, Tab, TabPanels, TabPanel } from 'primeng/tabs';
import { InputText } from 'primeng/inputtext';
import { Textarea } from 'primeng/textarea';
import { Select } from 'primeng/select';
import { InputNumber } from 'primeng/inputnumber';
import { Checkbox } from 'primeng/checkbox';
import { Button } from 'primeng/button';
import { ToggleSwitch } from 'primeng/toggleswitch';
import { Tooltip } from 'primeng/tooltip';
import { Chip } from 'primeng/chip';
import { TestPlanStore, TreeSelectionStore } from '../../../../core/services/state';
import { NodeRegistryService } from '../../../../core/services/node-registry.service';
import { PromptImprovementService, ImprovedPrompt } from '../../../../core/services/ai';
import { NodeTypeIconComponent } from '../../../../shared/components/node-type-icon';
import { CodeEditorComponent } from '../../../../shared/components/code-editor';
import { AutoFillDialogComponent, ApplyEvent } from '../auto-fill-dialog/auto-fill-dialog';
import { Variable, NodeConfig } from '../../../../shared/models';
import {
  HTTP_METHODS,
  PROTOCOLS,
  QUERY_TYPES,
  SCRIPT_LANGUAGES,
  TEST_FIELDS,
  TEST_TYPES,
  POE_BOTS,
  PULL_POLICIES,
  DEPLOYMENT_TYPES
} from '../../../../shared/config';

@Component({
  selector: 'app-node-config-panel',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    Tabs,
    TabList,
    Tab,
    TabPanels,
    TabPanel,
    InputText,
    Textarea,
    Select,
    InputNumber,
    Checkbox,
    Button,
    ToggleSwitch,
    Tooltip,
    Chip,
    NodeTypeIconComponent,
    CodeEditorComponent,
    AutoFillDialogComponent
  ],
  template: `
    @if (selectedNode()) {
      <div class="config-panel">
        <div class="config-panel__header">
          <div class="config-panel__title">
            <app-node-type-icon [type]="selectedNode()!.type" [size]="20"></app-node-type-icon>
            <input
              type="text"
              pInputText
              [ngModel]="selectedNode()!.name"
              (ngModelChange)="updateNodeName($event)"
              class="config-panel__name-input"
            />
          </div>
          <div class="config-panel__actions">
            <p-button
              icon="pi pi-bolt"
              label="AI Auto-Fill"
              severity="secondary"
              [outlined]="true"
              size="small"
              (onClick)="showAutoFillDialog.set(true)"
              pTooltip="Use AI to fill configuration fields"
            />
            <p-toggleswitch
              [ngModel]="selectedNode()!.enabled"
              (ngModelChange)="updateNodeEnabled($event)"
              pTooltip="Enable/Disable"
            />
            <span class="config-panel__type-label">{{ nodeMetadata()?.label }}</span>
          </div>
        </div>

        <app-auto-fill-dialog
          [visible]="showAutoFillDialog()"
          (visibleChange)="showAutoFillDialog.set($event)"
          [nodeType]="selectedNode()!.type"
          [nodeId]="selectedNode()!.id"
          [currentConfig]="selectedNode()!.config"
          (apply)="applyAutoFillSuggestions($event)"
        />

        <p-tabs value="0" styleClass="config-panel__tabs">
          <p-tablist>
            <p-tab value="0">Configuration</p-tab>
            <p-tab value="1">Advanced</p-tab>
            @if (selectedNode()!.generatedCode) {
              <p-tab value="2">Code</p-tab>
            }
          </p-tablist>
          <p-tabpanels>
            <p-tabpanel value="0">
              <div class="config-form">
                <div class="form-field">
                  <label>Description</label>
                  <textarea
                    pTextarea
                    [rows]="2"
                    [ngModel]="getConfigValue('description')"
                    (ngModelChange)="updateConfig('description', $event)"
                    placeholder="Describe what this node does..."
                  ></textarea>
                </div>

                @switch (selectedNode()!.type) {
                  @case ('thread-group') {
                    <div class="form-row">
                      <div class="form-field">
                        <label>Number of Threads</label>
                        <p-inputnumber
                          [ngModel]="getConfigValue('numThreads')"
                          (ngModelChange)="updateConfig('numThreads', $event)"
                          [min]="1"
                          [max]="1000"
                        />
                      </div>
                      <div class="form-field">
                        <label>Ramp-up Period (s)</label>
                        <p-inputnumber
                          [ngModel]="getConfigValue('rampUp')"
                          (ngModelChange)="updateConfig('rampUp', $event)"
                          [min]="0"
                        />
                      </div>
                    </div>
                    <div class="form-row">
                      <div class="form-field">
                        <label>Loop Count</label>
                        <p-inputnumber
                          [ngModel]="getConfigValue('loops')"
                          (ngModelChange)="updateConfig('loops', $event)"
                          [min]="1"
                        />
                      </div>
                      <div class="form-field">
                        <label>Delay (ms)</label>
                        <p-inputnumber
                          [ngModel]="getConfigValue('delay')"
                          (ngModelChange)="updateConfig('delay', $event)"
                          [min]="0"
                        />
                      </div>
                    </div>
                  }
                  @case ('http-request') {
                    <div class="form-row">
                      <div class="form-field" style="flex: 0 0 120px;">
                        <label>Method</label>
                        <p-select
                          [options]="httpMethods"
                          [ngModel]="getConfigValue('method')"
                          (ngModelChange)="updateConfig('method', $event)"
                        />
                      </div>
                      <div class="form-field" style="flex: 0 0 100px;">
                        <label>Protocol</label>
                        <p-select
                          [options]="protocols"
                          [ngModel]="getConfigValue('protocol')"
                          (ngModelChange)="updateConfig('protocol', $event)"
                        />
                      </div>
                      <div class="form-field">
                        <label>Server Name</label>
                        <input
                          type="text"
                          pInputText
                          [ngModel]="getConfigValue('serverName')"
                          (ngModelChange)="updateConfig('serverName', $event)"
                          placeholder="api.example.com"
                        />
                      </div>
                    </div>
                    <div class="form-field">
                      <label>Path</label>
                      <input
                        type="text"
                        pInputText
                        [ngModel]="getConfigValue('path')"
                        (ngModelChange)="updateConfig('path', $event)"
                        placeholder="/api/endpoint"
                      />
                    </div>
                    @if (getConfigValue('method') !== 'GET') {
                      <div class="form-field">
                        <label>Request Body</label>
                        <app-code-editor
                          language="json"
                          [ngModel]="getConfigValue('bodyData')"
                          (ngModelChange)="updateConfig('bodyData', $event)"
                          [rows]="6"
                          placeholder='{"key": "value"}'
                        />
                      </div>
                    }
                  }
                  @case ('jdbc-request') {
                    <div class="form-row">
                      <div class="form-field">
                        <label>Connection Reference</label>
                        <input
                          type="text"
                          pInputText
                          [ngModel]="getConfigValue('connectionRef')"
                          (ngModelChange)="updateConfig('connectionRef', $event)"
                          placeholder="db.connection"
                        />
                      </div>
                      <div class="form-field">
                        <label>Query Type</label>
                        <p-select
                          [options]="queryTypes"
                          [ngModel]="getConfigValue('queryType')"
                          (ngModelChange)="updateConfig('queryType', $event)"
                        />
                      </div>
                    </div>
                    <div class="form-field">
                      <label>Query</label>
                      <app-code-editor
                        language="sql"
                        [ngModel]="getConfigValue('query')"
                        (ngModelChange)="updateConfig('query', $event)"
                        [rows]="6"
                        placeholder="SELECT * FROM users WHERE id = ?"
                      />
                    </div>
                    <div class="form-field">
                      <label>Result Variable</label>
                      <input
                        type="text"
                        pInputText
                        [ngModel]="getConfigValue('resultVariable')"
                        (ngModelChange)="updateConfig('resultVariable', $event)"
                        placeholder="queryResult"
                      />
                    </div>
                  }
                  @case ('script') {
                    <div class="form-field">
                      <label>Language</label>
                      <p-select
                        [options]="scriptLanguages"
                        [ngModel]="getConfigValue('language')"
                        (ngModelChange)="updateConfig('language', $event)"
                      />
                    </div>
                    <div class="form-field">
                      <label>Script</label>
                      <app-code-editor
                        [language]="getConfigString('language') || 'groovy'"
                        [ngModel]="getConfigValue('script')"
                        (ngModelChange)="updateConfig('script', $event)"
                        [rows]="12"
                        placeholder="// Enter your script here"
                      />
                    </div>
                  }
                  @case ('ai-task') {
                    <div class="form-field">
                      <div class="form-field__header">
                        <label>Intent (Natural Language)</label>
                        <p-button
                          icon="pi pi-magic"
                          label="Improve Request"
                          [text]="true"
                          size="small"
                          [loading]="promptService.isImproving()"
                          (onClick)="improveAiPrompt()"
                          pTooltip="AI will enhance your request for better understanding"
                        />
                      </div>
                      <textarea
                        pTextarea
                        [rows]="4"
                        [ngModel]="getConfigValue('intent')"
                        (ngModelChange)="updateConfig('intent', $event)"
                        placeholder="Describe what this task should do..."
                      ></textarea>
                      @if (lastImprovement()) {
                        <div class="improvement-suggestions">
                          <div class="improvement-suggestions__header">
                            <i class="pi pi-lightbulb"></i>
                            <span>Suggestions</span>
                          </div>
                          @for (suggestion of lastImprovement()!.suggestions; track $index) {
                            <div class="suggestion-item">
                              <i class="pi pi-chevron-right"></i>
                              {{ suggestion }}
                            </div>
                          }
                        </div>
                      }
                    </div>
                    <div class="form-field">
                      <label>Context Variables</label>
                      <div class="context-vars-list">
                        @for (variable of planStore.plan()?.variables || []; track variable.id) {
                          <p-chip
                            [label]="variable.name"
                            styleClass="context-var-chip"
                            (click)="insertVariable(variable.name, 'intent')"
                            pTooltip="Click to insert \${{'{'}}{{variable.name}}{{'}'}} - {{variable.description || variable.type}}"
                          />
                        }
                        @if ((planStore.plan()?.variables || []).length === 0) {
                          <span class="no-vars-hint">No variables defined. Add them in Plan Settings.</span>
                        }
                      </div>
                    </div>
                    <div class="form-field">
                      <label>Input Variables</label>
                      <input
                        type="text"
                        pInputText
                        [ngModel]="getInputVarsJoined()"
                        (ngModelChange)="updateInputVars($event)"
                        placeholder="var1, var2, var3"
                      />
                      <small class="field-hint">Comma-separated list of variables this task will read</small>
                    </div>
                    <div class="form-field">
                      <label>Output Variables</label>
                      <input
                        type="text"
                        pInputText
                        [ngModel]="getOutputVarsJoined()"
                        (ngModelChange)="updateOutputVars($event)"
                        placeholder="result1, result2"
                      />
                      <small class="field-hint">Comma-separated list of variables this task will produce</small>
                    </div>
                    <div class="form-field">
                      <label>Target Language</label>
                      <p-select
                        [options]="scriptLanguages"
                        [ngModel]="getConfigValue('language')"
                        (ngModelChange)="updateConfig('language', $event)"
                      />
                    </div>
                    <div class="form-actions">
                      <p-button icon="pi pi-sparkles" label="Generate Code" severity="primary" />
                    </div>
                  }
                  @case ('constant-timer') {
                    <div class="form-field">
                      <label>Delay (ms)</label>
                      <p-inputnumber
                        [ngModel]="getConfigValue('delay')"
                        (ngModelChange)="updateConfig('delay', $event)"
                        [min]="0"
                      />
                    </div>
                  }
                  @case ('response-assertion') {
                    <div class="form-row">
                      <div class="form-field">
                        <label>Test Field</label>
                        <p-select
                          [options]="testFields"
                          [ngModel]="getConfigValue('testField')"
                          (ngModelChange)="updateConfig('testField', $event)"
                        />
                      </div>
                      <div class="form-field">
                        <label>Test Type</label>
                        <p-select
                          [options]="testTypes"
                          [ngModel]="getConfigValue('testType')"
                          (ngModelChange)="updateConfig('testType', $event)"
                        />
                      </div>
                    </div>
                    <div class="form-field">
                      <label>Test Strings (one per line)</label>
                      <textarea
                        pTextarea
                        [rows]="3"
                        [ngModel]="getTestStringsJoined()"
                        (ngModelChange)="updateTestStrings($event)"
                        placeholder="Expected values..."
                      ></textarea>
                    </div>
                  }
                  @case ('json-extractor') {
                    <div class="form-row">
                      <div class="form-field">
                        <label>Reference Name</label>
                        <input
                          type="text"
                          pInputText
                          [ngModel]="getConfigValue('refName')"
                          (ngModelChange)="updateConfig('refName', $event)"
                          placeholder="extractedValue"
                        />
                      </div>
                      <div class="form-field">
                        <label>Match Number</label>
                        <p-inputnumber
                          [ngModel]="getConfigValue('matchNumber')"
                          (ngModelChange)="updateConfig('matchNumber', $event)"
                          [min]="-1"
                        />
                      </div>
                    </div>
                    <div class="form-field">
                      <label>JSONPath Expression</label>
                      <input
                        type="text"
                        pInputText
                        [ngModel]="getConfigValue('expression')"
                        (ngModelChange)="updateConfig('expression', $event)"
                        placeholder="$.data.items[*].id"
                      />
                    </div>
                  }
                  @case ('lm-studio') {
                    <div class="form-field">
                      <div class="form-field__header">
                        <label>Prompt</label>
                        <p-button
                          icon="pi pi-magic"
                          label="Improve"
                          [text]="true"
                          size="small"
                          [loading]="promptService.isImproving()"
                          (onClick)="improveAiPrompt()"
                        />
                      </div>
                      <textarea
                        pTextarea
                        [rows]="4"
                        [ngModel]="getConfigValue('prompt')"
                        (ngModelChange)="updateConfig('prompt', $event)"
                        placeholder="Enter your prompt..."
                      ></textarea>
                    </div>
                    <div class="form-row">
                      <div class="form-field">
                        <label>Endpoint</label>
                        <input
                          type="text"
                          pInputText
                          [ngModel]="getConfigValue('endpoint')"
                          (ngModelChange)="updateConfig('endpoint', $event)"
                          placeholder="http://localhost:1234/v1/chat/completions"
                        />
                      </div>
                      <div class="form-field">
                        <label>Model</label>
                        <input
                          type="text"
                          pInputText
                          [ngModel]="getConfigValue('model')"
                          (ngModelChange)="updateConfig('model', $event)"
                          placeholder="local-model"
                        />
                      </div>
                    </div>
                    <div class="form-row">
                      <div class="form-field">
                        <label>Temperature</label>
                        <p-inputnumber
                          [ngModel]="getConfigValue('temperature')"
                          (ngModelChange)="updateConfig('temperature', $event)"
                          [min]="0"
                          [max]="2"
                          [step]="0.1"
                        />
                      </div>
                      <div class="form-field">
                        <label>Max Tokens</label>
                        <p-inputnumber
                          [ngModel]="getConfigValue('maxTokens')"
                          (ngModelChange)="updateConfig('maxTokens', $event)"
                          [min]="1"
                          [max]="32000"
                        />
                      </div>
                    </div>
                    <div class="form-field">
                      <label>System Prompt</label>
                      <textarea
                        pTextarea
                        [rows]="2"
                        [ngModel]="getConfigValue('systemPrompt')"
                        (ngModelChange)="updateConfig('systemPrompt', $event)"
                        placeholder="You are a helpful assistant..."
                      ></textarea>
                    </div>
                    <div class="form-field">
                      <label>Context Variables</label>
                      <div class="context-vars-list">
                        @for (variable of getAvailableVariables(); track variable.id) {
                          <p-chip
                            [label]="variable.name"
                            styleClass="context-var-chip"
                            (click)="insertVariable(variable.name, 'prompt')"
                            pTooltip="Click to insert"
                          />
                        }
                      </div>
                    </div>
                    <div class="form-field">
                      <label>Response Variable</label>
                      <input
                        type="text"
                        pInputText
                        [ngModel]="getConfigValue('responseVariable')"
                        (ngModelChange)="updateConfig('responseVariable', $event)"
                        placeholder="aiResponse"
                      />
                    </div>
                  }
                  @case ('poe-ai') {
                    <div class="form-field">
                      <div class="form-field__header">
                        <label>Prompt</label>
                        <p-button
                          icon="pi pi-magic"
                          label="Improve"
                          [text]="true"
                          size="small"
                          [loading]="promptService.isImproving()"
                          (onClick)="improveAiPrompt()"
                        />
                      </div>
                      <textarea
                        pTextarea
                        [rows]="4"
                        [ngModel]="getConfigValue('prompt')"
                        (ngModelChange)="updateConfig('prompt', $event)"
                        placeholder="Enter your prompt..."
                      ></textarea>
                    </div>
                    <div class="form-row">
                      <div class="form-field">
                        <label>Bot Name</label>
                        <p-select
                          [options]="poeBots"
                          [ngModel]="getConfigValue('botName')"
                          (ngModelChange)="updateConfig('botName', $event)"
                        />
                      </div>
                      <div class="form-field">
                        <label>API Key</label>
                        <input
                          type="password"
                          pInputText
                          [ngModel]="getConfigValue('apiKey')"
                          (ngModelChange)="updateConfig('apiKey', $event)"
                          placeholder="Enter API key"
                        />
                      </div>
                    </div>
                    <div class="form-field">
                      <label>System Prompt</label>
                      <textarea
                        pTextarea
                        [rows]="2"
                        [ngModel]="getConfigValue('systemPrompt')"
                        (ngModelChange)="updateConfig('systemPrompt', $event)"
                        placeholder="Optional system prompt..."
                      ></textarea>
                    </div>
                    <div class="form-field">
                      <label>Context Variables</label>
                      <div class="context-vars-list">
                        @for (variable of getAvailableVariables(); track variable.id) {
                          <p-chip
                            [label]="variable.name"
                            styleClass="context-var-chip"
                            (click)="insertVariable(variable.name, 'prompt')"
                            pTooltip="Click to insert"
                          />
                        }
                      </div>
                    </div>
                    <div class="form-row">
                      <div class="form-field">
                        <label>Response Variable</label>
                        <input
                          type="text"
                          pInputText
                          [ngModel]="getConfigValue('responseVariable')"
                          (ngModelChange)="updateConfig('responseVariable', $event)"
                          placeholder="poeResponse"
                        />
                      </div>
                      <div class="form-field form-field--checkbox">
                        <p-checkbox
                          [ngModel]="getConfigValue('streamResponse')"
                          (ngModelChange)="updateConfig('streamResponse', $event)"
                          [binary]="true"
                          inputId="streamResponse"
                        />
                        <label for="streamResponse">Stream Response</label>
                      </div>
                    </div>
                  }
                  @case ('docker-run') {
                    <div class="form-row">
                      <div class="form-field">
                        <label>Image Name</label>
                        <input
                          type="text"
                          pInputText
                          [ngModel]="getConfigValue('imageName')"
                          (ngModelChange)="updateConfig('imageName', $event)"
                          placeholder="nginx"
                        />
                      </div>
                      <div class="form-field">
                        <label>Image Tag</label>
                        <input
                          type="text"
                          pInputText
                          [ngModel]="getConfigValue('imageTag')"
                          (ngModelChange)="updateConfig('imageTag', $event)"
                          placeholder="latest"
                        />
                      </div>
                    </div>
                    <div class="form-row">
                      <div class="form-field">
                        <label>Registry URL</label>
                        <input
                          type="text"
                          pInputText
                          [ngModel]="getConfigValue('registryUrl')"
                          (ngModelChange)="updateConfig('registryUrl', $event)"
                          placeholder="docker.io"
                        />
                      </div>
                      <div class="form-field">
                        <label>Pull Policy</label>
                        <p-select
                          [options]="pullPolicies"
                          [ngModel]="getConfigValue('pullPolicy')"
                          (ngModelChange)="updateConfig('pullPolicy', $event)"
                        />
                      </div>
                    </div>
                    <div class="form-field">
                      <label>Port Mappings</label>
                      <div class="ports-list">
                        @for (port of getPortMappings(); track $index) {
                          <div class="port-item">
                            <p-inputnumber
                              [ngModel]="port.hostPort"
                              (ngModelChange)="updatePortMapping($index, 'hostPort', $event)"
                              placeholder="Host"
                              [min]="1"
                              [max]="65535"
                            />
                            <span class="port-separator">:</span>
                            <p-inputnumber
                              [ngModel]="port.containerPort"
                              (ngModelChange)="updatePortMapping($index, 'containerPort', $event)"
                              placeholder="Container"
                              [min]="1"
                              [max]="65535"
                            />
                            <p-button
                              icon="pi pi-trash"
                              [text]="true"
                              size="small"
                              severity="danger"
                              (onClick)="removePortMapping($index)"
                            />
                          </div>
                        }
                        @if (getPortMappings().length === 0) {
                          <div class="empty-list">
                            <i class="pi pi-share-alt"></i>
                            <span>No port mappings - container ports won't be accessible</span>
                          </div>
                        }
                      </div>
                      <p-button
                        icon="pi pi-plus"
                        label="Add Port"
                        [outlined]="true"
                        size="small"
                        (onClick)="addPortMapping()"
                      />
                      <small class="field-hint">Map container ports to host ports (e.g., 5432:5432 for PostgreSQL)</small>
                    </div>
                    <div class="form-field">
                      <label>Command</label>
                      <input
                        type="text"
                        pInputText
                        [ngModel]="getConfigValue('command')"
                        (ngModelChange)="updateConfig('command', $event)"
                        placeholder="/bin/sh -c"
                      />
                    </div>
                    <div class="form-field">
                      <label>Environment Variables</label>
                      <app-code-editor
                        language="json"
                        [ngModel]="getEnvVarsJson()"
                        (ngModelChange)="updateEnvVars($event)"
                        [rows]="4"
                        placeholder='{"KEY": "value"}'
                      />
                    </div>
                    <div class="form-row">
                      <div class="form-field">
                        <label>CPU Limit</label>
                        <input
                          type="text"
                          pInputText
                          [ngModel]="getConfigValue('cpuLimit')"
                          (ngModelChange)="updateConfig('cpuLimit', $event)"
                          placeholder="1.0"
                        />
                      </div>
                      <div class="form-field">
                        <label>Memory Limit</label>
                        <input
                          type="text"
                          pInputText
                          [ngModel]="getConfigValue('memoryLimit')"
                          (ngModelChange)="updateConfig('memoryLimit', $event)"
                          placeholder="512m"
                        />
                      </div>
                    </div>
                    <div class="form-row">
                      <div class="form-field form-field--checkbox">
                        <p-checkbox
                          [ngModel]="getConfigValue('detach')"
                          (ngModelChange)="updateConfig('detach', $event)"
                          [binary]="true"
                          inputId="detach"
                        />
                        <label for="detach">Detached Mode</label>
                      </div>
                      <div class="form-field form-field--checkbox">
                        <p-checkbox
                          [ngModel]="getConfigValue('removeAfterRun')"
                          (ngModelChange)="updateConfig('removeAfterRun', $event)"
                          [binary]="true"
                          inputId="removeAfterRun"
                        />
                        <label for="removeAfterRun">Remove After Run</label>
                      </div>
                    </div>
                    <div class="form-row">
                      <div class="form-field form-field--checkbox">
                        <p-checkbox
                          [ngModel]="getConfigValue('waitForHealthy')"
                          (ngModelChange)="updateConfig('waitForHealthy', $event)"
                          [binary]="true"
                          inputId="waitForHealthy"
                        />
                        <label for="waitForHealthy">Wait for Healthy</label>
                      </div>
                      <div class="form-field">
                        <label>Health Check Timeout (ms)</label>
                        <p-inputnumber
                          [ngModel]="getConfigValue('healthCheckTimeout')"
                          (ngModelChange)="updateConfig('healthCheckTimeout', $event)"
                          [min]="1000"
                          [max]="300000"
                          [step]="1000"
                        />
                      </div>
                    </div>
                  }
                  @case ('k8s-deploy') {
                    <div class="form-row">
                      <div class="form-field">
                        <label>Namespace</label>
                        <input
                          type="text"
                          pInputText
                          [ngModel]="getConfigValue('namespace')"
                          (ngModelChange)="updateConfig('namespace', $event)"
                          placeholder="default"
                        />
                      </div>
                      <div class="form-field">
                        <label>Deployment Type</label>
                        <p-select
                          [options]="deploymentTypes"
                          [ngModel]="getConfigValue('deploymentType')"
                          (ngModelChange)="updateConfig('deploymentType', $event)"
                        />
                      </div>
                    </div>
                    <div class="form-row">
                      <div class="form-field">
                        <label>Image Name</label>
                        <input
                          type="text"
                          pInputText
                          [ngModel]="getConfigValue('imageName')"
                          (ngModelChange)="updateConfig('imageName', $event)"
                          placeholder="myapp"
                        />
                      </div>
                      <div class="form-field">
                        <label>Image Tag</label>
                        <input
                          type="text"
                          pInputText
                          [ngModel]="getConfigValue('imageTag')"
                          (ngModelChange)="updateConfig('imageTag', $event)"
                          placeholder="latest"
                        />
                      </div>
                    </div>
                    <div class="form-field">
                      <label>Replicas</label>
                      <p-inputnumber
                        [ngModel]="getConfigValue('replicas')"
                        (ngModelChange)="updateConfig('replicas', $event)"
                        [min]="0"
                        [max]="100"
                      />
                    </div>
                    <div class="form-field">
                      <label>Manifest YAML</label>
                      <app-code-editor
                        language="yaml"
                        [ngModel]="getConfigValue('manifestYaml')"
                        (ngModelChange)="updateConfig('manifestYaml', $event)"
                        [rows]="8"
                        placeholder="apiVersion: apps/v1
kind: Deployment
..."
                      />
                    </div>
                    <div class="form-row">
                      <div class="form-field form-field--checkbox">
                        <p-checkbox
                          [ngModel]="getConfigValue('waitForReady')"
                          (ngModelChange)="updateConfig('waitForReady', $event)"
                          [binary]="true"
                          inputId="waitForReady"
                        />
                        <label for="waitForReady">Wait for Ready</label>
                      </div>
                      <div class="form-field form-field--checkbox">
                        <p-checkbox
                          [ngModel]="getConfigValue('rollbackOnFailure')"
                          (ngModelChange)="updateConfig('rollbackOnFailure', $event)"
                          [binary]="true"
                          inputId="rollbackOnFailure"
                        />
                        <label for="rollbackOnFailure">Rollback on Failure</label>
                      </div>
                    </div>
                  }
                  @case ('github-release') {
                    <div class="form-field">
                      <label>Repository</label>
                      <input
                        type="text"
                        pInputText
                        [ngModel]="getConfigValue('repository')"
                        (ngModelChange)="updateConfig('repository', $event)"
                        placeholder="owner/repo"
                      />
                    </div>
                    <div class="form-row">
                      <div class="form-field">
                        <label>Release Tag</label>
                        <input
                          type="text"
                          pInputText
                          [ngModel]="getConfigValue('releaseTag')"
                          (ngModelChange)="updateConfig('releaseTag', $event)"
                          placeholder="v1.0.0 or latest"
                        />
                      </div>
                      <div class="form-field">
                        <label>Asset Pattern</label>
                        <input
                          type="text"
                          pInputText
                          [ngModel]="getConfigValue('assetPattern')"
                          (ngModelChange)="updateConfig('assetPattern', $event)"
                          placeholder="*.tar.gz"
                        />
                      </div>
                    </div>
                    <div class="form-field">
                      <label>GitHub Token</label>
                      <input
                        type="password"
                        pInputText
                        [ngModel]="getConfigValue('githubToken')"
                        (ngModelChange)="updateConfig('githubToken', $event)"
                        placeholder="ghp_xxxx or use variable \${GITHUB_TOKEN}"
                      />
                    </div>
                    <div class="form-row">
                      <div class="form-field">
                        <label>Download Path</label>
                        <input
                          type="text"
                          pInputText
                          [ngModel]="getConfigValue('downloadPath')"
                          (ngModelChange)="updateConfig('downloadPath', $event)"
                          placeholder="/tmp/downloads"
                        />
                      </div>
                      <div class="form-field">
                        <label>Output Variable</label>
                        <input
                          type="text"
                          pInputText
                          [ngModel]="getConfigValue('outputVariable')"
                          (ngModelChange)="updateConfig('outputVariable', $event)"
                          placeholder="downloadedPath"
                        />
                      </div>
                    </div>
                    <div class="form-row">
                      <div class="form-field form-field--checkbox">
                        <p-checkbox
                          [ngModel]="getConfigValue('extractArchive')"
                          (ngModelChange)="updateConfig('extractArchive', $event)"
                          [binary]="true"
                          inputId="extractArchive"
                        />
                        <label for="extractArchive">Extract Archive</label>
                      </div>
                      <div class="form-field form-field--checkbox">
                        <p-checkbox
                          [ngModel]="getConfigValue('preRelease')"
                          (ngModelChange)="updateConfig('preRelease', $event)"
                          [binary]="true"
                          inputId="preRelease"
                        />
                        <label for="preRelease">Include Pre-releases</label>
                      </div>
                    </div>
                  }
                  @case ('context-setup') {
                    <div class="form-field">
                      <label>Database Connections</label>
                      <div class="connections-list">
                        @for (conn of getConnections(); track $index) {
                          <div class="connection-item">
                            <div class="connection-item__header">
                              <span class="connection-item__name">{{ conn.name || 'Unnamed Connection' }}</span>
                              <span class="connection-item__type">{{ conn.type }}</span>
                              <p-button
                                icon="pi pi-trash"
                                [text]="true"
                                size="small"
                                severity="danger"
                                (onClick)="removeConnection($index)"
                              />
                            </div>
                            <div class="connection-item__fields">
                              <div class="form-row">
                                <div class="form-field">
                                  <label>Name (Reference)</label>
                                  <input
                                    type="text"
                                    pInputText
                                    [ngModel]="conn.name"
                                    (ngModelChange)="updateConnection($index, 'name', $event)"
                                    placeholder="primary_db"
                                  />
                                </div>
                                <div class="form-field">
                                  <label>Database Type</label>
                                  <p-select
                                    [options]="dbTypes"
                                    [ngModel]="conn.type"
                                    (ngModelChange)="updateConnection($index, 'type', $event)"
                                  />
                                </div>
                              </div>
                              <div class="form-row">
                                <div class="form-field">
                                  <label>Host</label>
                                  <input
                                    type="text"
                                    pInputText
                                    [ngModel]="conn.host"
                                    (ngModelChange)="updateConnection($index, 'host', $event)"
                                    placeholder="localhost"
                                  />
                                </div>
                                <div class="form-field" style="flex: 0 0 100px;">
                                  <label>Port</label>
                                  <p-inputnumber
                                    [ngModel]="conn.port"
                                    (ngModelChange)="updateConnection($index, 'port', $event)"
                                    [min]="1"
                                    [max]="65535"
                                  />
                                </div>
                              </div>
                              <div class="form-row">
                                <div class="form-field">
                                  <label>Database</label>
                                  <input
                                    type="text"
                                    pInputText
                                    [ngModel]="conn.database"
                                    (ngModelChange)="updateConnection($index, 'database', $event)"
                                    placeholder="mydb"
                                  />
                                </div>
                              </div>
                              <div class="form-row">
                                <div class="form-field">
                                  <label>Username</label>
                                  <input
                                    type="text"
                                    pInputText
                                    [ngModel]="conn.username"
                                    (ngModelChange)="updateConnection($index, 'username', $event)"
                                    placeholder="postgres"
                                  />
                                </div>
                                <div class="form-field">
                                  <label>Password</label>
                                  <input
                                    type="password"
                                    pInputText
                                    [ngModel]="conn.password"
                                    (ngModelChange)="updateConnection($index, 'password', $event)"
                                    placeholder="Use variable: \${db_password}"
                                  />
                                </div>
                              </div>
                            </div>
                          </div>
                        }
                        @if (getConnections().length === 0) {
                          <div class="empty-list">
                            <i class="pi pi-database"></i>
                            <span>No connections configured</span>
                          </div>
                        }
                      </div>
                      <p-button
                        icon="pi pi-plus"
                        label="Add Connection"
                        [outlined]="true"
                        size="small"
                        (onClick)="addConnection()"
                      />
                    </div>
                    <div class="form-field">
                      <label>Context Variables</label>
                      <div class="variables-list">
                        @for (variable of getContextVariables(); track $index) {
                          <div class="variable-item">
                            <input
                              type="text"
                              pInputText
                              [ngModel]="variable.name"
                              (ngModelChange)="updateContextVariable($index, 'name', $event)"
                              placeholder="Variable name"
                            />
                            <input
                              type="text"
                              pInputText
                              [ngModel]="variable.value"
                              (ngModelChange)="updateContextVariable($index, 'value', $event)"
                              placeholder="Value"
                            />
                            <p-button
                              icon="pi pi-trash"
                              [text]="true"
                              size="small"
                              severity="danger"
                              (onClick)="removeContextVariable($index)"
                            />
                          </div>
                        }
                        @if (getContextVariables().length === 0) {
                          <div class="empty-list">
                            <i class="pi pi-dollar"></i>
                            <span>No variables configured</span>
                          </div>
                        }
                      </div>
                      <p-button
                        icon="pi pi-plus"
                        label="Add Variable"
                        [outlined]="true"
                        size="small"
                        (onClick)="addContextVariable()"
                      />
                    </div>
                    <div class="form-info">
                      <i class="pi pi-info-circle"></i>
                      <span>The "Name (Reference)" field is used as the connectionRef in JDBC Request nodes.</span>
                    </div>
                  }
                  @default {
                    <div class="form-info">
                      <i class="pi pi-info-circle"></i>
                      <span>Configure this node using the options above.</span>
                    </div>
                  }
                }
              </div>
            </p-tabpanel>

            <p-tabpanel value="1">
              <div class="config-form">
                <div class="form-row">
                  <div class="form-field">
                    <label>Timeout (ms)</label>
                    <p-inputnumber
                      [ngModel]="getConfigValue('timeout')"
                      (ngModelChange)="updateConfig('timeout', $event)"
                      [min]="0"
                      [max]="300000"
                      [step]="1000"
                    />
                  </div>
                  <div class="form-field">
                    <label>Retry Count</label>
                    <p-inputnumber
                      [ngModel]="getConfigValue('retryCount')"
                      (ngModelChange)="updateConfig('retryCount', $event)"
                      [min]="0"
                      [max]="10"
                    />
                  </div>
                </div>
                <div class="form-field form-field--checkbox">
                  <p-checkbox
                    [ngModel]="getConfigValue('continueOnError')"
                    (ngModelChange)="updateConfig('continueOnError', $event)"
                    [binary]="true"
                    inputId="continueOnError"
                  />
                  <label for="continueOnError">Continue on Error</label>
                </div>
              </div>
            </p-tabpanel>

            @if (selectedNode()!.generatedCode) {
              <p-tabpanel value="2">
                <div class="code-panel">
                  <div class="code-panel__header">
                    <span class="code-panel__status" [class]="'code-panel__status--' + selectedNode()!.validationStatus">
                      {{ selectedNode()!.validationStatus }}
                    </span>
                    <p-button icon="pi pi-refresh" label="Regenerate" [text]="true" size="small" />
                  </div>
                  <app-code-editor
                    [language]="selectedNode()!.generatedCode!.language"
                    [ngModel]="selectedNode()!.generatedCode!.code"
                    [readonly]="true"
                    [rows]="15"
                  />
                </div>
              </p-tabpanel>
            }
          </p-tabpanels>
        </p-tabs>
      </div>
    } @else {
      <div class="config-panel config-panel--empty">
        <div class="empty-state">
          <i class="pi pi-box empty-state__icon"></i>
          <h3>No Node Selected</h3>
          <p>Select a node from the tree to configure it</p>
        </div>
      </div>
    }
  `,
  styles: [`
    .config-panel {
      display: flex;
      flex-direction: column;
      height: 100%;
      min-height: 0;
      overflow: hidden;
      background: var(--tc-bg-secondary);
    }

    .config-panel--empty {
      align-items: center;
      justify-content: center;
    }

    .config-panel__header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: var(--tc-spacing-md);
      border-bottom: 1px solid var(--tc-border);
      gap: var(--tc-spacing-md);
    }

    .config-panel__title {
      display: flex;
      align-items: center;
      gap: var(--tc-spacing-sm);
      flex: 1;
    }

    .config-panel__name-input {
      flex: 1;
      font-size: 16px;
      font-weight: 500;
      background: transparent;
      border: 1px solid transparent;
      padding: var(--tc-spacing-xs) var(--tc-spacing-sm);
      border-radius: var(--tc-radius-sm);
      color: var(--tc-text-primary);
    }

    .config-panel__name-input:hover {
      border-color: var(--tc-border);
    }

    .config-panel__name-input:focus {
      border-color: var(--tc-primary);
      background: var(--tc-bg-tertiary);
    }

    .config-panel__actions {
      display: flex;
      align-items: center;
      gap: var(--tc-spacing-md);
    }

    .config-panel__type-label {
      font-size: 12px;
      color: var(--tc-text-muted);
      background: var(--tc-bg-tertiary);
      padding: 4px 8px;
      border-radius: var(--tc-radius-sm);
    }

    :host ::ng-deep .config-panel__tabs {
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      min-height: 0;
    }

    :host ::ng-deep .config-panel__tabs .p-tablist {
      flex-shrink: 0;
    }

    :host ::ng-deep .config-panel__tabs .p-tabpanels {
      flex: 1;
      position: relative;
      min-height: 0;
    }

    :host ::ng-deep .config-panel__tabs .p-tabpanel {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      overflow: auto;
    }

    :host ::ng-deep .config-panel__tabs .p-tabpanel-content {
      height: auto;
    }

    .config-form {
      display: flex;
      flex-direction: column;
      gap: var(--tc-spacing-md);
      padding: var(--tc-spacing-md);
    }

    .form-field {
      display: flex;
      flex-direction: column;
      gap: var(--tc-spacing-xs);
    }

    .form-field label {
      font-size: 12px;
      font-weight: 500;
      color: var(--tc-text-secondary);
    }

    .form-field--checkbox {
      flex-direction: row;
      align-items: center;
      gap: var(--tc-spacing-sm);
    }

    .form-field--checkbox label {
      font-size: 13px;
      color: var(--tc-text-primary);
    }

    .form-row {
      display: flex;
      gap: var(--tc-spacing-md);
    }

    .form-row .form-field {
      flex: 1;
    }

    .form-actions {
      display: flex;
      justify-content: flex-end;
      padding-top: var(--tc-spacing-sm);
    }

    .form-info {
      display: flex;
      align-items: center;
      gap: var(--tc-spacing-sm);
      padding: var(--tc-spacing-md);
      background: var(--tc-bg-tertiary);
      border-radius: var(--tc-radius-md);
      color: var(--tc-text-secondary);
    }

    .form-info i {
      color: var(--tc-info);
    }

    .form-field__header {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .context-vars-list {
      display: flex;
      flex-wrap: wrap;
      gap: var(--tc-spacing-xs);
    }

    :host ::ng-deep .context-var-chip {
      cursor: pointer;
      transition: all 0.15s ease;
    }

    :host ::ng-deep .context-var-chip:hover {
      background: var(--tc-primary);
      color: white;
    }

    .no-vars-hint {
      font-size: 12px;
      color: var(--tc-text-muted);
      font-style: italic;
    }

    .field-hint {
      font-size: 11px;
      color: var(--tc-text-muted);
      margin-top: 4px;
    }

    .improvement-suggestions {
      margin-top: var(--tc-spacing-sm);
      padding: var(--tc-spacing-sm);
      background: var(--tc-bg-tertiary);
      border-radius: var(--tc-radius-sm);
      border-left: 3px solid var(--tc-warning);
    }

    .improvement-suggestions__header {
      display: flex;
      align-items: center;
      gap: var(--tc-spacing-xs);
      font-size: 12px;
      font-weight: 600;
      color: var(--tc-warning);
      margin-bottom: var(--tc-spacing-xs);
    }

    .suggestion-item {
      display: flex;
      align-items: flex-start;
      gap: var(--tc-spacing-xs);
      font-size: 12px;
      color: var(--tc-text-secondary);
      padding: 2px 0;
    }

    .suggestion-item i {
      font-size: 10px;
      margin-top: 3px;
      color: var(--tc-text-muted);
    }

    .code-panel {
      display: flex;
      flex-direction: column;
      gap: var(--tc-spacing-sm);
      padding: var(--tc-spacing-md);
    }

    .code-panel__header {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .code-panel__status {
      font-size: 11px;
      padding: 4px 8px;
      border-radius: var(--tc-radius-sm);
      text-transform: uppercase;
      font-weight: 600;
    }

    .code-panel__status--pending {
      background: var(--tc-bg-tertiary);
      color: var(--tc-text-muted);
    }

    .code-panel__status--valid {
      background: rgba(34, 197, 94, 0.1);
      color: var(--tc-success);
    }

    .code-panel__status--invalid {
      background: rgba(239, 68, 68, 0.1);
      color: var(--tc-danger);
    }

    .code-panel__status--warning {
      background: rgba(245, 158, 11, 0.1);
      color: var(--tc-warning);
    }

    .empty-state {
      text-align: center;
      color: var(--tc-text-muted);
    }

    .empty-state__icon {
      font-size: 48px;
      margin-bottom: var(--tc-spacing-md);
      opacity: 0.5;
    }

    .empty-state h3 {
      margin-bottom: var(--tc-spacing-xs);
      color: var(--tc-text-secondary);
    }

    .empty-state p {
      font-size: 13px;
    }

    .connections-list,
    .variables-list {
      display: flex;
      flex-direction: column;
      gap: var(--tc-spacing-sm);
      margin-bottom: var(--tc-spacing-sm);
    }

    .connection-item {
      border: 1px solid var(--tc-border);
      border-radius: var(--tc-radius-md);
      background: var(--tc-bg-tertiary);
      overflow: hidden;
    }

    .connection-item__header {
      display: flex;
      align-items: center;
      gap: var(--tc-spacing-sm);
      padding: var(--tc-spacing-sm);
      background: var(--tc-bg-primary);
      border-bottom: 1px solid var(--tc-border);
    }

    .connection-item__name {
      font-weight: 500;
      flex: 1;
    }

    .connection-item__type {
      font-size: 11px;
      padding: 2px 6px;
      background: var(--tc-primary);
      color: white;
      border-radius: var(--tc-radius-sm);
      text-transform: uppercase;
    }

    .connection-item__fields {
      padding: var(--tc-spacing-sm);
      display: flex;
      flex-direction: column;
      gap: var(--tc-spacing-sm);
    }

    .variable-item {
      display: flex;
      gap: var(--tc-spacing-sm);
      align-items: center;
    }

    .variable-item input {
      flex: 1;
    }

    .empty-list {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: var(--tc-spacing-sm);
      padding: var(--tc-spacing-lg);
      background: var(--tc-bg-tertiary);
      border-radius: var(--tc-radius-md);
      color: var(--tc-text-muted);
      font-size: 13px;
    }

    .empty-list i {
      font-size: 16px;
      opacity: 0.5;
    }

    .ports-list {
      display: flex;
      flex-direction: column;
      gap: var(--tc-spacing-sm);
      margin-bottom: var(--tc-spacing-sm);
    }

    .port-item {
      display: flex;
      align-items: center;
      gap: var(--tc-spacing-sm);
    }

    .port-item :host ::ng-deep p-inputnumber {
      flex: 1;
    }

    .port-separator {
      font-weight: bold;
      color: var(--tc-text-muted);
    }
  `]
})
export class NodeConfigPanelComponent {
  protected readonly planStore = inject(TestPlanStore);
  protected readonly selectionStore = inject(TreeSelectionStore);
  protected readonly nodeRegistry = inject(NodeRegistryService);
  protected readonly promptService = inject(PromptImprovementService);

  readonly selectedNode = this.selectionStore.selectedNode;
  readonly nodeMetadata = computed(() => {
    const node = this.selectedNode();
    return node ? this.nodeRegistry.get(node.type) : null;
  });
  readonly lastImprovement = signal<ImprovedPrompt | null>(null);
  readonly showAutoFillDialog = signal(false);

  // Form field options - imported from shared config
  readonly httpMethods = HTTP_METHODS;
  readonly protocols = PROTOCOLS;
  readonly queryTypes = QUERY_TYPES;
  readonly scriptLanguages = SCRIPT_LANGUAGES;
  readonly testFields = TEST_FIELDS;
  readonly testTypes = TEST_TYPES;
  readonly poeBots = POE_BOTS;
  readonly pullPolicies = PULL_POLICIES;
  readonly deploymentTypes = DEPLOYMENT_TYPES;
  readonly dbTypes = [
    { label: 'PostgreSQL', value: 'postgresql' },
    { label: 'MySQL', value: 'mysql' },
    { label: 'MongoDB', value: 'mongodb' },
    { label: 'Redis', value: 'redis' },
    { label: 'YugaByte', value: 'yugabyte' }
  ];

  getTestStringsJoined(): string {
    const strings = this.getConfigValue('testStrings');
    return Array.isArray(strings) ? strings.join('\n') : '';
  }

  getConfigValue(key: string): unknown {
    const node = this.selectedNode();
    if (!node) return undefined;
    return (node.config as unknown as Record<string, unknown>)[key];
  }

  getConfigString(key: string): string {
    const value = this.getConfigValue(key);
    return typeof value === 'string' ? value : '';
  }

  updateNodeName(name: string): void {
    const node = this.selectedNode();
    if (node) {
      this.planStore.updateNode(node.id, { name });
    }
  }

  updateNodeEnabled(enabled: boolean): void {
    const node = this.selectedNode();
    if (node) {
      this.planStore.updateNode(node.id, { enabled });
    }
  }

  updateConfig(key: string, value: unknown): void {
    const node = this.selectedNode();
    if (node) {
      const newConfig = { ...node.config, [key]: value };
      this.planStore.updateNode(node.id, { config: newConfig });
    }
  }

  updateTestStrings(value: string): void {
    const strings = value.split('\n').filter((s) => s);
    this.updateConfig('testStrings', strings);
  }

  getInputVarsJoined(): string {
    const vars = this.getConfigValue('inputVariables');
    return Array.isArray(vars) ? vars.join(', ') : '';
  }

  getOutputVarsJoined(): string {
    const vars = this.getConfigValue('outputVariables');
    return Array.isArray(vars) ? vars.join(', ') : '';
  }

  updateInputVars(value: string): void {
    const vars = value.split(',').map((v) => v.trim()).filter((v) => v);
    this.updateConfig('inputVariables', vars);
  }

  updateOutputVars(value: string): void {
    const vars = value.split(',').map((v) => v.trim()).filter((v) => v);
    this.updateConfig('outputVariables', vars);
  }

  async improveAiPrompt(): Promise<void> {
    const node = this.selectedNode();
    if (!node) return;

    const intent = this.getConfigString('intent');
    if (!intent) return;

    const variables = this.planStore.plan()?.variables || [];
    const improvement = await this.promptService.improvePrompt(intent, variables, node.type);

    this.lastImprovement.set(improvement);
    this.updateConfig('intent', improvement.improved);
  }

  insertVariable(varName: string, field: string): void {
    const node = this.selectedNode();
    if (!node) return;

    const currentValue = this.getConfigString(field);
    const insertion = `\${${varName}}`;

    // Insert at cursor position or append
    const newValue = currentValue ? `${currentValue} ${insertion}` : insertion;
    this.updateConfig(field, newValue);
  }

  getAvailableVariables(): Variable[] {
    return this.planStore.plan()?.variables || [];
  }

  getEnvVarsJson(): string {
    const envVars = this.getConfigValue('environment');
    if (!envVars || typeof envVars !== 'object') return '{}';
    try {
      return JSON.stringify(envVars, null, 2);
    } catch {
      return '{}';
    }
  }

  updateEnvVars(jsonString: string): void {
    try {
      const parsed = JSON.parse(jsonString);
      this.updateConfig('environment', parsed);
    } catch {
      // Invalid JSON, don't update
    }
  }

  applyAutoFillSuggestions(event: ApplyEvent): void {
    const node = this.selectedNode();
    if (!node) return;

    // Merge the AI-generated values with current config
    const newConfig: NodeConfig = { ...node.config, ...event.values } as NodeConfig;
    this.planStore.updateNode(node.id, { config: newConfig });
  }

  // Context Setup helpers
  getConnections(): { name: string; type: string; host: string; port: number; database: string; username: string; password: string }[] {
    const connections = this.getConfigValue('connections');
    return Array.isArray(connections) ? connections : [];
  }

  addConnection(): void {
    const connections = this.getConnections();
    connections.push({
      name: '',
      type: 'postgresql',
      host: 'localhost',
      port: 5432,
      database: '',
      username: '',
      password: ''
    });
    this.updateConfig('connections', connections);
  }

  removeConnection(index: number): void {
    const connections = this.getConnections();
    connections.splice(index, 1);
    this.updateConfig('connections', [...connections]);
  }

  updateConnection(index: number, field: string, value: unknown): void {
    const connections = this.getConnections();
    if (connections[index]) {
      (connections[index] as Record<string, unknown>)[field] = value;
      this.updateConfig('connections', [...connections]);
    }
  }

  getContextVariables(): { name: string; value: string }[] {
    const variables = this.getConfigValue('variables');
    return Array.isArray(variables) ? variables : [];
  }

  addContextVariable(): void {
    const variables = this.getContextVariables();
    variables.push({ name: '', value: '' });
    this.updateConfig('variables', variables);
  }

  removeContextVariable(index: number): void {
    const variables = this.getContextVariables();
    variables.splice(index, 1);
    this.updateConfig('variables', [...variables]);
  }

  updateContextVariable(index: number, field: string, value: string): void {
    const variables = this.getContextVariables();
    if (variables[index]) {
      (variables[index] as Record<string, string>)[field] = value;
      this.updateConfig('variables', [...variables]);
    }
  }

  // Docker port mapping helpers
  getPortMappings(): { hostPort: number; containerPort: number }[] {
    const ports = this.getConfigValue('ports');
    if (!Array.isArray(ports)) return [];
    return ports.map(p => {
      if (typeof p === 'string') {
        const [host, container] = p.includes(':') ? p.split(':').map(Number) : [Number(p), Number(p)];
        return { hostPort: host, containerPort: container };
      }
      if (typeof p === 'object' && p !== null) {
        return { hostPort: p.hostPort || 0, containerPort: p.containerPort || 0 };
      }
      return { hostPort: 0, containerPort: 0 };
    });
  }

  addPortMapping(): void {
    const ports = this.getPortMappings();
    ports.push({ hostPort: 0, containerPort: 0 });
    this.updateConfig('ports', ports);
  }

  removePortMapping(index: number): void {
    const ports = this.getPortMappings();
    ports.splice(index, 1);
    this.updateConfig('ports', [...ports]);
  }

  updatePortMapping(index: number, field: 'hostPort' | 'containerPort', value: number): void {
    const ports = this.getPortMappings();
    if (ports[index]) {
      ports[index][field] = value;
      this.updateConfig('ports', [...ports]);
    }
  }
}
