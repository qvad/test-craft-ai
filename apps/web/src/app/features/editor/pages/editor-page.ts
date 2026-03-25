import { Component, inject, signal, HostListener, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { TextareaModule } from 'primeng/textarea';
import { FormsModule } from '@angular/forms';
import { SelectModule } from 'primeng/select';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { CheckboxModule } from 'primeng/checkbox';
import { AppShellComponent } from '../components/app-shell/app-shell';
import { TopToolbarComponent } from '../components/top-toolbar/top-toolbar';
import { TreePanelComponent } from '../components/tree-panel/tree-panel';
import { NodeConfigPanelComponent } from '../components/node-config/node-config-panel';
import { ExecutionPanelComponent } from '../components/execution-panel/execution-panel';
import { TestPlanStore } from '../../../core/services/state';
import { SettingsService, AIProvider } from '../../../core/services/settings';
import { TreeNode } from '../../../shared/models';

@Component({
  selector: 'app-editor-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    DialogModule,
    ButtonModule,
    TextareaModule,
    SelectModule,
    InputTextModule,
    InputNumberModule,
    CheckboxModule,
    AppShellComponent,
    TopToolbarComponent,
    TreePanelComponent,
    NodeConfigPanelComponent,
    ExecutionPanelComponent
  ],
  template: `
    <app-shell
      [leftPanelSize]="leftPanelSize()"
      [bottomPanelSize]="bottomPanelSize()"
      (leftPanelSizeChange)="leftPanelSize.set($event)"
      (bottomPanelSizeChange)="bottomPanelSize.set($event)"
    >
      <app-top-toolbar
        toolbar
        (importRequested)="showImportDialog = true"
        (exportRequested)="onExport()"
        (settingsRequested)="showSettingsDialog = true"
        (dependenciesRequested)="showDependenciesDialog = true"
      ></app-top-toolbar>

      <app-tree-panel leftPanel></app-tree-panel>

      <app-node-config-panel centerPanel></app-node-config-panel>

      <app-execution-panel bottomPanel></app-execution-panel>
    </app-shell>

    <!-- Import Dialog -->
    <p-dialog
      header="Import HOCON"
      [(visible)]="showImportDialog"
      [modal]="true"
      [style]="{ width: '600px' }"
      [draggable]="false"
      [resizable]="false"
    >
      <div class="import-dialog">
        <p class="import-dialog__description">
          Paste your HOCON configuration below or upload a file.
        </p>
        <textarea
          pTextarea
          [(ngModel)]="importContent"
          [rows]="15"
          placeholder="Paste HOCON content here..."
          class="import-dialog__textarea"
        ></textarea>
        <div class="import-dialog__upload">
          <input
            type="file"
            accept=".conf,.hocon,.json"
            (change)="onFileUpload($event)"
            #fileInput
            style="display: none"
          />
          <p-button
            icon="pi pi-upload"
            label="Upload File"
            [text]="true"
            (onClick)="fileInput.click()"
          ></p-button>
        </div>
      </div>
      <ng-template pTemplate="footer">
        <p-button
          label="Cancel"
          [text]="true"
          (onClick)="showImportDialog = false"
        ></p-button>
        <p-button
          label="Import"
          icon="pi pi-download"
          [disabled]="!importContent"
          (onClick)="onImport()"
        ></p-button>
      </ng-template>
    </p-dialog>

    <!-- Export Dialog -->
    <p-dialog
      header="Export HOCON"
      [(visible)]="showExportDialog"
      [modal]="true"
      [style]="{ width: '600px' }"
      [draggable]="false"
      [resizable]="false"
    >
      <div class="export-dialog">
        <p class="export-dialog__description">
          Your test plan has been exported to HOCON format.
        </p>
        <textarea
          pTextarea
          [ngModel]="exportContent"
          [rows]="15"
          [readonly]="true"
          class="export-dialog__textarea"
        ></textarea>
      </div>
      <ng-template pTemplate="footer">
        <p-button
          label="Copy"
          icon="pi pi-copy"
          [text]="true"
          (onClick)="onCopyExport()"
        ></p-button>
        <p-button
          label="Download"
          icon="pi pi-download"
          (onClick)="onDownloadExport()"
        ></p-button>
      </ng-template>
    </p-dialog>

    <!-- Settings Dialog -->
    <p-dialog
      header="Settings"
      [(visible)]="showSettingsDialog"
      [modal]="true"
      [style]="{ width: '550px' }"
      [draggable]="false"
      [resizable]="false"
    >
      <div class="settings-dialog">
        <div class="settings-section">
          <h4>General</h4>
          <div class="settings-item">
            <label>Default Timeout (ms)</label>
            <p-inputNumber
              [(ngModel)]="generalSettings.defaultTimeout"
              [min]="1000"
              [max]="300000"
              [step]="1000"
            />
          </div>
          <div class="settings-item">
            <label>Auto-save Interval (seconds)</label>
            <p-inputNumber
              [(ngModel)]="generalSettings.autoSaveInterval"
              [min]="10"
              [max]="600"
            />
          </div>
        </div>

        <div class="settings-section">
          <h4>AI Provider</h4>
          <div class="settings-item">
            <label>Provider</label>
            <p-select
              [options]="aiProviderOptions"
              [(ngModel)]="aiSettings.provider"
              optionLabel="label"
              optionValue="value"
              [style]="{ width: '200px' }"
            />
          </div>

          <!-- LM Studio Settings -->
          @if (aiSettings.provider === 'lm-studio') {
            <div class="settings-item">
              <label>Endpoint URL</label>
              <input
                type="text"
                pInputText
                [(ngModel)]="aiSettings.lmStudio.endpoint"
                placeholder="http://localhost:1234/v1/chat/completions"
              />
            </div>
            <div class="settings-item">
              <label>Model Name (optional)</label>
              <input
                type="text"
                pInputText
                [(ngModel)]="aiSettings.lmStudio.model"
                placeholder="local-model"
              />
            </div>
            <div class="provider-hint">
              <i class="pi pi-info-circle"></i>
              <span>Make sure LM Studio is running with a model loaded and API server enabled.</span>
            </div>
          }

          <!-- Anthropic Settings -->
          @if (aiSettings.provider === 'anthropic') {
            <div class="settings-item">
              <label>API Key</label>
              <input
                type="password"
                pInputText
                [(ngModel)]="aiSettings.anthropic.apiKey"
                placeholder="sk-ant-..."
              />
            </div>
            <div class="settings-item">
              <label>Model</label>
              <p-select
                [options]="anthropicModels"
                [(ngModel)]="aiSettings.anthropic.model"
                optionLabel="label"
                optionValue="value"
                [style]="{ width: '200px' }"
              />
            </div>
          }

          <!-- OpenAI Settings -->
          @if (aiSettings.provider === 'openai') {
            <div class="settings-item">
              <label>API Key</label>
              <input
                type="password"
                pInputText
                [(ngModel)]="aiSettings.openai.apiKey"
                placeholder="sk-..."
              />
            </div>
            <div class="settings-item">
              <label>Model</label>
              <p-select
                [options]="openaiModels"
                [(ngModel)]="aiSettings.openai.model"
                optionLabel="label"
                optionValue="value"
                [style]="{ width: '200px' }"
              />
            </div>
          }

          <!-- Ollama Settings -->
          @if (aiSettings.provider === 'ollama') {
            <div class="settings-item">
              <label>Endpoint URL</label>
              <input
                type="text"
                pInputText
                [(ngModel)]="aiSettings.ollama.endpoint"
                placeholder="http://localhost:11434/api/generate"
              />
            </div>
            <div class="settings-item">
              <label>Model Name</label>
              <input
                type="text"
                pInputText
                [(ngModel)]="aiSettings.ollama.model"
                placeholder="llama2"
              />
            </div>
            <div class="provider-hint">
              <i class="pi pi-info-circle"></i>
              <span>Make sure Ollama is running and the model is pulled.</span>
            </div>
          }

          <div class="settings-item">
            <label>Temperature</label>
            <p-inputNumber
              [(ngModel)]="aiSettings.temperature"
              [min]="0"
              [max]="2"
              [step]="0.1"
              [minFractionDigits]="1"
              [maxFractionDigits]="1"
            />
          </div>
          <div class="settings-item">
            <label>Max Tokens</label>
            <p-inputNumber
              [(ngModel)]="aiSettings.maxTokens"
              [min]="256"
              [max]="8192"
              [step]="256"
            />
          </div>
        </div>

        <div class="settings-section">
          <h4>Execution</h4>
          <div class="settings-item">
            <label>Max Concurrent Threads</label>
            <p-inputNumber
              [(ngModel)]="executionSettings.maxThreads"
              [min]="1"
              [max]="100"
            />
          </div>
          <div class="settings-item settings-item--checkbox">
            <p-checkbox
              [(ngModel)]="executionSettings.stopOnFailure"
              [binary]="true"
              inputId="stopOnFailure"
            />
            <label for="stopOnFailure">Stop on First Failure</label>
          </div>
        </div>
      </div>
      <ng-template pTemplate="footer">
        <p-button
          label="Reset to Defaults"
          [text]="true"
          severity="secondary"
          (onClick)="resetSettings()"
        ></p-button>
        <p-button
          label="Close"
          icon="pi pi-check"
          (onClick)="showSettingsDialog = false"
        ></p-button>
      </ng-template>
    </p-dialog>

    <!-- Dependencies Dialog -->
    <p-dialog
      header="Plan Dependencies"
      [(visible)]="showDependenciesDialog"
      [modal]="true"
      [style]="{ width: '800px', height: '85vh' }"
      [contentStyle]="{ height: 'calc(85vh - 120px)', overflow: 'auto', padding: '0' }"
      [draggable]="false"
      [resizable]="false"
      (onShow)="loadPlanDependencies()"
    >
      <div class="dependencies-dialog">
        <p class="dependencies-description">
          Configure language-specific dependencies for this test plan. Click on a language to expand/collapse. Dependencies will be installed in runner containers before code execution.
        </p>

        <div class="dependencies-grid">
          <!-- Python -->
          <div class="lang-section" [class.expanded]="expandedLangs['python']">
            <div class="lang-header" (click)="toggleLang('python')">
              <div class="lang-header-left">
                <i class="pi" [class.pi-chevron-right]="!expandedLangs['python']" [class.pi-chevron-down]="expandedLangs['python']"></i>
                <span class="lang-icon" style="background: #3776AB;">Py</span>
                <span class="lang-name">Python</span>
              </div>
              <span class="lang-count" *ngIf="planDependencies.python.packagesText">
                {{ countLines(planDependencies.python.packagesText) }} packages
              </span>
            </div>
            @if (expandedLangs['python']) {
              <div class="lang-content">
                <label>Packages (pip install)</label>
                <textarea
                  pTextarea
                  [(ngModel)]="planDependencies.python.packagesText"
                  [autoResize]="true"
                  [rows]="5"
                  placeholder="requests==2.31.0&#10;sqlalchemy>=2.0&#10;psycopg2-binary&#10;pandas&#10;numpy"
                  class="lang-textarea"
                ></textarea>
                <small>One package per line. Supports version specifiers (==, >=, ~=, <)</small>
              </div>
            }
          </div>

          <!-- JavaScript/TypeScript -->
          <div class="lang-section" [class.expanded]="expandedLangs['javascript']">
            <div class="lang-header" (click)="toggleLang('javascript')">
              <div class="lang-header-left">
                <i class="pi" [class.pi-chevron-right]="!expandedLangs['javascript']" [class.pi-chevron-down]="expandedLangs['javascript']"></i>
                <span class="lang-icon" style="background: #F7DF1E; color: #000;">JS</span>
                <span class="lang-name">JavaScript / TypeScript</span>
              </div>
              <span class="lang-count" *ngIf="planDependencies.javascript.packagesText">
                {{ countLines(planDependencies.javascript.packagesText) }} packages
              </span>
            </div>
            @if (expandedLangs['javascript']) {
              <div class="lang-content">
                <label>Packages (npm install)</label>
                <textarea
                  pTextarea
                  [(ngModel)]="planDependencies.javascript.packagesText"
                  [autoResize]="true"
                  [rows]="5"
                  placeholder="axios@1.6.0&#10;lodash&#10;pg@8.11.3&#10;express&#10;typescript"
                  class="lang-textarea"
                ></textarea>
                <small>One package per line. Format: package or package@version</small>
              </div>
            }
          </div>

          <!-- Java -->
          <div class="lang-section" [class.expanded]="expandedLangs['java']">
            <div class="lang-header" (click)="toggleLang('java')">
              <div class="lang-header-left">
                <i class="pi" [class.pi-chevron-right]="!expandedLangs['java']" [class.pi-chevron-down]="expandedLangs['java']"></i>
                <span class="lang-icon" style="background: #ED8B00;">Jv</span>
                <span class="lang-name">Java / Kotlin</span>
              </div>
              <span class="lang-count" *ngIf="planDependencies.java.mavenText || planDependencies.java.jarsText">
                {{ countLines(planDependencies.java.mavenText) + countLines(planDependencies.java.jarsText) }} deps
              </span>
            </div>
            @if (expandedLangs['java']) {
              <div class="lang-content">
                <label>Maven Dependencies</label>
                <textarea
                  pTextarea
                  [(ngModel)]="planDependencies.java.mavenText"
                  [autoResize]="true"
                  [rows]="4"
                  placeholder="com.oracle.database.jdbc:ojdbc11:23.3.0.23.09&#10;org.postgresql:postgresql:42.7.1&#10;com.google.code.gson:gson:2.10.1"
                  class="lang-textarea"
                ></textarea>
                <small>Format: groupId:artifactId:version</small>
                <label style="margin-top: 12px;">JAR URLs (optional)</label>
                <textarea
                  pTextarea
                  [(ngModel)]="planDependencies.java.jarsText"
                  [autoResize]="true"
                  [rows]="2"
                  placeholder="https://example.com/custom-driver.jar"
                  class="lang-textarea"
                ></textarea>
                <small>Direct URLs to JAR files (HTTP, HTTPS, S3)</small>
              </div>
            }
          </div>

          <!-- C# -->
          <div class="lang-section" [class.expanded]="expandedLangs['csharp']">
            <div class="lang-header" (click)="toggleLang('csharp')">
              <div class="lang-header-left">
                <i class="pi" [class.pi-chevron-right]="!expandedLangs['csharp']" [class.pi-chevron-down]="expandedLangs['csharp']"></i>
                <span class="lang-icon" style="background: #512BD4;">C#</span>
                <span class="lang-name">C# / .NET</span>
              </div>
              <span class="lang-count" *ngIf="planDependencies.csharp.packagesText">
                {{ countLines(planDependencies.csharp.packagesText) }} packages
              </span>
            </div>
            @if (expandedLangs['csharp']) {
              <div class="lang-content">
                <label>NuGet Packages</label>
                <textarea
                  pTextarea
                  [(ngModel)]="planDependencies.csharp.packagesText"
                  [autoResize]="true"
                  [rows]="5"
                  placeholder="Newtonsoft.Json@13.0.3&#10;Dapper&#10;Npgsql@8.0.1&#10;Microsoft.Extensions.Logging"
                  class="lang-textarea"
                ></textarea>
                <small>Format: Package or Package@version</small>
              </div>
            }
          </div>

          <!-- Go -->
          <div class="lang-section" [class.expanded]="expandedLangs['go']">
            <div class="lang-header" (click)="toggleLang('go')">
              <div class="lang-header-left">
                <i class="pi" [class.pi-chevron-right]="!expandedLangs['go']" [class.pi-chevron-down]="expandedLangs['go']"></i>
                <span class="lang-icon" style="background: #00ADD8;">Go</span>
                <span class="lang-name">Go</span>
              </div>
              <span class="lang-count" *ngIf="planDependencies.go.modulesText">
                {{ countLines(planDependencies.go.modulesText) }} modules
              </span>
            </div>
            @if (expandedLangs['go']) {
              <div class="lang-content">
                <label>Modules (go get)</label>
                <textarea
                  pTextarea
                  [(ngModel)]="planDependencies.go.modulesText"
                  [autoResize]="true"
                  [rows]="5"
                  placeholder="github.com/lib/pq@v1.10.9&#10;github.com/go-redis/redis/v8&#10;github.com/gin-gonic/gin"
                  class="lang-textarea"
                ></textarea>
                <small>Format: module@version or module (latest)</small>
              </div>
            }
          </div>

          <!-- Ruby -->
          <div class="lang-section" [class.expanded]="expandedLangs['ruby']">
            <div class="lang-header" (click)="toggleLang('ruby')">
              <div class="lang-header-left">
                <i class="pi" [class.pi-chevron-right]="!expandedLangs['ruby']" [class.pi-chevron-down]="expandedLangs['ruby']"></i>
                <span class="lang-icon" style="background: #CC342D;">Rb</span>
                <span class="lang-name">Ruby</span>
              </div>
              <span class="lang-count" *ngIf="planDependencies.ruby.gemsText">
                {{ countLines(planDependencies.ruby.gemsText) }} gems
              </span>
            </div>
            @if (expandedLangs['ruby']) {
              <div class="lang-content">
                <label>Gems</label>
                <textarea
                  pTextarea
                  [(ngModel)]="planDependencies.ruby.gemsText"
                  [autoResize]="true"
                  [rows]="5"
                  placeholder="pg:1.5.4&#10;redis&#10;httparty:0.21.0&#10;rails"
                  class="lang-textarea"
                ></textarea>
                <small>Format: gem or gem:version</small>
              </div>
            }
          </div>

          <!-- Rust -->
          <div class="lang-section" [class.expanded]="expandedLangs['rust']">
            <div class="lang-header" (click)="toggleLang('rust')">
              <div class="lang-header-left">
                <i class="pi" [class.pi-chevron-right]="!expandedLangs['rust']" [class.pi-chevron-down]="expandedLangs['rust']"></i>
                <span class="lang-icon" style="background: #DEA584; color: #000;">Rs</span>
                <span class="lang-name">Rust</span>
              </div>
              <span class="lang-count" *ngIf="planDependencies.rust.cratesText">
                {{ countLines(planDependencies.rust.cratesText) }} crates
              </span>
            </div>
            @if (expandedLangs['rust']) {
              <div class="lang-content">
                <label>Crates</label>
                <textarea
                  pTextarea
                  [(ngModel)]="planDependencies.rust.cratesText"
                  [autoResize]="true"
                  [rows]="5"
                  placeholder="tokio@1.35&#10;serde@1.0&#10;reqwest&#10;actix-web"
                  class="lang-textarea"
                ></textarea>
                <small>Format: crate or crate@version</small>
              </div>
            }
          </div>

          <!-- PHP -->
          <div class="lang-section" [class.expanded]="expandedLangs['php']">
            <div class="lang-header" (click)="toggleLang('php')">
              <div class="lang-header-left">
                <i class="pi" [class.pi-chevron-right]="!expandedLangs['php']" [class.pi-chevron-down]="expandedLangs['php']"></i>
                <span class="lang-icon" style="background: #777BB4;">Ph</span>
                <span class="lang-name">PHP</span>
              </div>
              <span class="lang-count" *ngIf="planDependencies.php.packagesText">
                {{ countLines(planDependencies.php.packagesText) }} packages
              </span>
            </div>
            @if (expandedLangs['php']) {
              <div class="lang-content">
                <label>Composer Packages</label>
                <textarea
                  pTextarea
                  [(ngModel)]="planDependencies.php.packagesText"
                  [autoResize]="true"
                  [rows]="5"
                  placeholder="guzzlehttp/guzzle:^7.0&#10;monolog/monolog&#10;symfony/http-client"
                  class="lang-textarea"
                ></textarea>
                <small>Format: vendor/package or vendor/package:version</small>
              </div>
            }
          </div>
        </div>
      </div>
      <ng-template pTemplate="footer">
        <div class="dependencies-footer">
          <p-button
            label="Expand All"
            [text]="true"
            size="small"
            (onClick)="expandAllLangs()"
          ></p-button>
          <p-button
            label="Collapse All"
            [text]="true"
            size="small"
            (onClick)="collapseAllLangs()"
          ></p-button>
          <div class="footer-spacer"></div>
          <p-button
            label="Cancel"
            [text]="true"
            (onClick)="showDependenciesDialog = false"
          ></p-button>
          <p-button
            label="Save"
            icon="pi pi-check"
            (onClick)="savePlanDependencies()"
          ></p-button>
        </div>
      </ng-template>
    </p-dialog>
  `,
  styles: [`
    :host {
      display: block;
      height: 100%;
    }

    .import-dialog,
    .export-dialog {
      display: flex;
      flex-direction: column;
      gap: var(--tc-spacing-md);
    }

    .import-dialog__description,
    .export-dialog__description {
      color: var(--tc-text-secondary);
      font-size: 13px;
    }

    .import-dialog__textarea,
    .export-dialog__textarea {
      width: 100%;
      font-family: var(--tc-font-mono);
      font-size: 12px;
    }

    .import-dialog__upload {
      display: flex;
      justify-content: center;
    }

    .settings-dialog {
      display: flex;
      flex-direction: column;
      gap: var(--tc-spacing-lg);
    }

    .settings-section h4 {
      margin: 0 0 var(--tc-spacing-md) 0;
      font-size: 14px;
      font-weight: 600;
      color: var(--tc-text-primary);
      padding-bottom: var(--tc-spacing-xs);
      border-bottom: 1px solid var(--tc-border);
    }

    .settings-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: var(--tc-spacing-sm) 0;
    }

    .settings-item label {
      font-size: 13px;
      color: var(--tc-text-secondary);
    }

    .settings-item input[type="number"],
    .settings-item input[type="password"],
    .settings-item select {
      width: 200px;
      padding: var(--tc-spacing-xs) var(--tc-spacing-sm);
      background: var(--tc-bg-tertiary);
      border: 1px solid var(--tc-border);
      border-radius: var(--tc-radius-sm);
      color: var(--tc-text-primary);
    }

    .settings-item input[type="checkbox"] {
      width: 18px;
      height: 18px;
    }

    .settings-item--checkbox {
      justify-content: flex-start;
      gap: var(--tc-spacing-sm);
    }

    .settings-item--checkbox label {
      cursor: pointer;
    }

    .provider-hint {
      display: flex;
      align-items: flex-start;
      gap: var(--tc-spacing-xs);
      padding: var(--tc-spacing-sm);
      background: var(--tc-bg-tertiary);
      border-radius: var(--tc-radius-sm);
      font-size: 12px;
      color: var(--tc-text-muted);
      margin-top: var(--tc-spacing-xs);
    }

    .provider-hint i {
      color: var(--tc-info);
      margin-top: 2px;
    }

    .dependencies-dialog {
      display: flex;
      flex-direction: column;
      gap: 0;
      padding: var(--tc-spacing-md);
    }

    .dependencies-description {
      color: var(--tc-text-secondary);
      font-size: 13px;
      margin: 0 0 var(--tc-spacing-md) 0;
      padding-bottom: var(--tc-spacing-md);
      border-bottom: 1px solid var(--tc-border);
    }

    .dependencies-grid {
      display: flex;
      flex-direction: column;
      gap: var(--tc-spacing-sm);
    }

    .lang-section {
      border: 1px solid var(--tc-border);
      border-radius: var(--tc-radius-md);
      overflow: hidden;
      transition: all 0.2s ease;
    }

    .lang-section.expanded {
      border-color: var(--tc-primary);
    }

    .lang-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: var(--tc-spacing-sm) var(--tc-spacing-md);
      background: var(--tc-bg-tertiary);
      cursor: pointer;
      user-select: none;
      transition: background 0.2s ease;
    }

    .lang-header:hover {
      background: var(--tc-bg-hover);
    }

    .lang-header-left {
      display: flex;
      align-items: center;
      gap: var(--tc-spacing-sm);
    }

    .lang-header-left > i {
      font-size: 12px;
      color: var(--tc-text-muted);
      width: 16px;
    }

    .lang-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 20px;
      border-radius: 4px;
      font-size: 10px;
      font-weight: 700;
      color: white;
    }

    .lang-name {
      font-weight: 500;
      font-size: 13px;
      color: var(--tc-text-primary);
    }

    .lang-count {
      font-size: 11px;
      color: var(--tc-text-muted);
      padding: 2px 8px;
      background: var(--tc-bg-secondary);
      border-radius: 10px;
    }

    .lang-content {
      padding: var(--tc-spacing-md);
      display: flex;
      flex-direction: column;
      gap: var(--tc-spacing-xs);
      background: var(--tc-bg-secondary);
      border-top: 1px solid var(--tc-border);
    }

    .lang-content label {
      font-size: 12px;
      color: var(--tc-text-secondary);
      font-weight: 500;
    }

    .lang-content .lang-textarea {
      font-family: var(--tc-font-mono);
      font-size: 12px;
      min-height: 100px;
      width: 100%;
      resize: vertical;
    }

    .lang-content small {
      font-size: 11px;
      color: var(--tc-text-muted);
    }

    .dependencies-footer {
      display: flex;
      align-items: center;
      gap: var(--tc-spacing-sm);
    }

    .footer-spacer {
      flex: 1;
    }
  `]
})
export class EditorPageComponent {
  private readonly planStore = inject(TestPlanStore);
  private readonly settingsService = inject(SettingsService);

  leftPanelSize = signal(20);
  bottomPanelSize = signal(25);

  showImportDialog = false;
  showExportDialog = false;
  showSettingsDialog = false;
  showDependenciesDialog = false;

  // Plan dependencies (synced with plan store)
  planDependencies = this.getDefaultDependencies();

  // Track which language sections are expanded
  expandedLangs: Record<string, boolean> = {
    python: true,
    javascript: false,
    java: false,
    csharp: false,
    go: false,
    ruby: false,
    rust: false,
    php: false
  };

  importContent = '';
  exportContent = '';

  // Local copies for editing in the dialog (auto-saves via SettingsService)
  generalSettings = { ...this.settingsService.generalSettings() };
  aiSettings = { ...this.settingsService.aiSettings() };
  executionSettings = { ...this.settingsService.executionSettings() };

  // AI Provider dropdown options
  readonly aiProviderOptions = [
    { label: 'LM Studio (Local)', value: 'lm-studio' as AIProvider },
    { label: 'Ollama (Local)', value: 'ollama' as AIProvider },
    { label: 'Anthropic (Claude)', value: 'anthropic' as AIProvider },
    { label: 'OpenAI', value: 'openai' as AIProvider }
  ];

  readonly anthropicModels = [
    { label: 'Claude Sonnet 4', value: 'claude-sonnet-4-20250514' },
    { label: 'Claude Opus 4', value: 'claude-opus-4-20250514' },
    { label: 'Claude 3.5 Sonnet', value: 'claude-3-5-sonnet-20241022' }
  ];

  readonly openaiModels = [
    { label: 'GPT-4o', value: 'gpt-4o' },
    { label: 'GPT-4 Turbo', value: 'gpt-4-turbo' },
    { label: 'GPT-3.5 Turbo', value: 'gpt-3.5-turbo' }
  ];

  @HostListener('window:keydown', ['$event'])
  onKeyDown(event: KeyboardEvent): void {
    // Ctrl+S to save
    if (event.ctrlKey && event.key === 's') {
      event.preventDefault();
      this.planStore.savePlan();
    }
  }

  onExport(): void {
    // Generate mock HOCON export
    const plan = this.planStore.plan();
    const nodes = this.planStore.nodes();

    if (!plan) {
      return;
    }

    this.exportContent = this.generateHocon(plan, nodes);
    this.showExportDialog = true;
  }

  private generateHocon(plan: { name: string; description: string }, nodes: TreeNode[]): string {
    // Build a lookup map for nodes by ID
    const nodeMap = new Map<string, TreeNode>();
    nodes.forEach(n => nodeMap.set(n.id, n));

    // Find root nodes (nodes with no parent or with parent 'root')
    const rootNodes = nodes.filter(n =>
      n.parentId === null || n.parentId === 'root' || !nodeMap.has(n.parentId)
    );

    // Sort by order
    rootNodes.sort((a, b) => a.order - b.order);

    // Recursive function to serialize a node with its children
    const serializeNode = (node: TreeNode, indent: number): string => {
      const pad = ' '.repeat(indent);
      const childPad = ' '.repeat(indent + 2);

      // Get child nodes
      const childNodes = node.children
        .map(childId => nodeMap.get(childId))
        .filter((n): n is TreeNode => n !== undefined)
        .sort((a, b) => a.order - b.order);

      let result = `${pad}{\n`;
      result += `${childPad}type = "${node.type}"\n`;
      result += `${childPad}name = "${node.name}"\n`;
      result += `${childPad}config = ${JSON.stringify(node.config, null, indent + 4).split('\n').join('\n' + childPad)}\n`;

      // Add children if any
      if (childNodes.length > 0) {
        result += `${childPad}children = [\n`;
        result += childNodes.map(child => serializeNode(child, indent + 4)).join(',\n');
        result += `\n${childPad}]\n`;
      }

      result += `${pad}}`;
      return result;
    };

    // Generate the HOCON output
    const nodesHocon = rootNodes.map(n => serializeNode(n, 4)).join(',\n');

    return `# TestCraft AI - Test Plan Export
# Generated: ${new Date().toISOString()}

testPlan {
  name = "${plan.name}"
  description = "${plan.description}"

  nodes = [
${nodesHocon}
  ]
}
`;
  }

  onImport(): void {
    // Parse and import HOCON content
    console.log('Importing:', this.importContent);
    this.showImportDialog = false;
    this.importContent = '';
  }

  onFileUpload(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        this.importContent = e.target?.result as string;
      };
      reader.readAsText(file);
    }
  }

  onCopyExport(): void {
    navigator.clipboard.writeText(this.exportContent);
  }

  onDownloadExport(): void {
    const plan = this.planStore.plan();
    const blob = new Blob([this.exportContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${plan?.name ?? 'test-plan'}.hocon`;
    a.click();
    URL.revokeObjectURL(url);
  }

  resetSettings(): void {
    this.settingsService.resetToDefaults();
    this.syncSettingsFromService();
  }

  ngOnInit(): void {
    // Sync local settings copies with service
    this.syncSettingsFromService();
  }

  /**
   * Syncs local settings copies from the service.
   */
  private syncSettingsFromService(): void {
    this.generalSettings = { ...this.settingsService.generalSettings() };
    this.aiSettings = {
      ...this.settingsService.aiSettings(),
      lmStudio: { ...this.settingsService.aiSettings().lmStudio },
      anthropic: { ...this.settingsService.aiSettings().anthropic },
      openai: { ...this.settingsService.aiSettings().openai },
      ollama: { ...this.settingsService.aiSettings().ollama }
    };
    this.executionSettings = { ...this.settingsService.executionSettings() };
  }

  /**
   * Saves settings when the settings dialog is closed.
   */
  saveSettings(): void {
    this.settingsService.updateGeneralSettings(this.generalSettings);
    this.settingsService.updateAISettings({
      provider: this.aiSettings.provider,
      temperature: this.aiSettings.temperature,
      maxTokens: this.aiSettings.maxTokens
    });
    this.settingsService.updateLMStudioSettings(this.aiSettings.lmStudio);
    this.settingsService.updateAnthropicSettings(this.aiSettings.anthropic);
    this.settingsService.updateOpenAISettings(this.aiSettings.openai);
    this.settingsService.updateOllamaSettings(this.aiSettings.ollama);
    this.settingsService.updateExecutionSettings(this.executionSettings);
    this.showSettingsDialog = false;
  }

  /**
   * Toggles a language section expanded/collapsed.
   */
  toggleLang(lang: string): void {
    this.expandedLangs[lang] = !this.expandedLangs[lang];
  }

  /**
   * Expands all language sections.
   */
  expandAllLangs(): void {
    Object.keys(this.expandedLangs).forEach(lang => {
      this.expandedLangs[lang] = true;
    });
  }

  /**
   * Collapses all language sections.
   */
  collapseAllLangs(): void {
    Object.keys(this.expandedLangs).forEach(lang => {
      this.expandedLangs[lang] = false;
    });
  }

  /**
   * Counts non-empty lines in a text string.
   */
  countLines(text: string): number {
    if (!text) return 0;
    return text.split('\n').filter(line => line.trim().length > 0).length;
  }

  /**
   * Gets default dependencies structure for editing.
   */
  getDefaultDependencies() {
    return {
      python: { packagesText: '' },
      javascript: { packagesText: '' },
      java: { mavenText: '', jarsText: '' },
      csharp: { packagesText: '' },
      go: { modulesText: '' },
      ruby: { gemsText: '' },
      rust: { cratesText: '' },
      php: { packagesText: '' }
    };
  }

  /**
   * Loads dependencies from plan into editable format.
   */
  loadPlanDependencies(): void {
    const plan = this.planStore.plan();
    const deps = plan?.dependencies;

    this.planDependencies = this.getDefaultDependencies();

    if (deps) {
      if (deps.python?.packages) {
        this.planDependencies.python.packagesText = deps.python.packages.join('\n');
      }
      if (deps.javascript?.packages) {
        this.planDependencies.javascript.packagesText = deps.javascript.packages.join('\n');
      }
      if (deps.java?.maven) {
        this.planDependencies.java.mavenText = deps.java.maven.join('\n');
      }
      if (deps.java?.jars) {
        this.planDependencies.java.jarsText = deps.java.jars.join('\n');
      }
      if (deps.csharp?.packages) {
        this.planDependencies.csharp.packagesText = deps.csharp.packages.join('\n');
      }
      if (deps.go?.modules) {
        this.planDependencies.go.modulesText = deps.go.modules.join('\n');
      }
      if (deps.ruby?.gems) {
        this.planDependencies.ruby.gemsText = deps.ruby.gems.join('\n');
      }
      if (deps.rust?.crates) {
        this.planDependencies.rust.cratesText = deps.rust.crates.join('\n');
      }
      if (deps.php?.packages) {
        this.planDependencies.php.packagesText = deps.php.packages.join('\n');
      }
    }
  }

  /**
   * Saves dependencies to the plan.
   */
  savePlanDependencies(): void {
    const parseLines = (text: string): string[] =>
      text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

    const dependencies: import('../../../shared/models').LanguageDependencies = {};

    // Python
    const pythonPackages = parseLines(this.planDependencies.python.packagesText);
    if (pythonPackages.length > 0) {
      dependencies.python = { packages: pythonPackages };
    }

    // JavaScript
    const jsPackages = parseLines(this.planDependencies.javascript.packagesText);
    if (jsPackages.length > 0) {
      dependencies.javascript = { packages: jsPackages };
    }

    // Java
    const javaMaven = parseLines(this.planDependencies.java.mavenText);
    const javaJars = parseLines(this.planDependencies.java.jarsText);
    if (javaMaven.length > 0 || javaJars.length > 0) {
      dependencies.java = {};
      if (javaMaven.length > 0) dependencies.java.maven = javaMaven;
      if (javaJars.length > 0) dependencies.java.jars = javaJars;
    }

    // C#
    const csharpPackages = parseLines(this.planDependencies.csharp.packagesText);
    if (csharpPackages.length > 0) {
      dependencies.csharp = { packages: csharpPackages };
    }

    // Go
    const goModules = parseLines(this.planDependencies.go.modulesText);
    if (goModules.length > 0) {
      dependencies.go = { modules: goModules };
    }

    // Ruby
    const rubyGems = parseLines(this.planDependencies.ruby.gemsText);
    if (rubyGems.length > 0) {
      dependencies.ruby = { gems: rubyGems };
    }

    // Rust
    const rustCrates = parseLines(this.planDependencies.rust.cratesText);
    if (rustCrates.length > 0) {
      dependencies.rust = { crates: rustCrates };
    }

    // PHP
    const phpPackages = parseLines(this.planDependencies.php.packagesText);
    if (phpPackages.length > 0) {
      dependencies.php = { packages: phpPackages };
    }

    // Update the plan with dependencies
    this.planStore.updatePlanDependencies(dependencies);
    this.showDependenciesDialog = false;
  }
}
