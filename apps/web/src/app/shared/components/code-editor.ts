import { Component, Input, Output, EventEmitter, signal, forwardRef } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR, FormsModule } from '@angular/forms';
import { TextareaModule } from 'primeng/textarea';

@Component({
  selector: 'app-code-editor',
  standalone: true,
  imports: [FormsModule, TextareaModule],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => CodeEditorComponent),
      multi: true
    }
  ],
  template: `
    <div class="code-editor">
      <div class="code-editor__header">
        <span class="code-editor__language">{{ language }}</span>
        @if (readonly) {
          <span class="code-editor__readonly">Read Only</span>
        }
      </div>
      <textarea
        pTextarea
        [rows]="rows"
        [readonly]="readonly"
        [ngModel]="value()"
        (ngModelChange)="onValueChange($event)"
        class="code-editor__textarea"
        [placeholder]="placeholder"
        spellcheck="false"
      ></textarea>
    </div>
  `,
  styles: [`
    .code-editor {
      display: flex;
      flex-direction: column;
      border: 1px solid var(--tc-border);
      border-radius: var(--tc-radius-md);
      overflow: hidden;
    }

    .code-editor__header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: var(--tc-spacing-xs) var(--tc-spacing-sm);
      background: var(--tc-bg-tertiary);
      border-bottom: 1px solid var(--tc-border);
    }

    .code-editor__language {
      font-size: 11px;
      color: var(--tc-text-secondary);
      text-transform: uppercase;
      font-weight: 600;
    }

    .code-editor__readonly {
      font-size: 10px;
      color: var(--tc-warning);
      background: rgba(245, 158, 11, 0.1);
      padding: 2px 6px;
      border-radius: 4px;
    }

    .code-editor__textarea {
      width: 100%;
      min-height: 200px;
      resize: vertical;
      font-family: var(--tc-font-mono);
      font-size: 13px;
      line-height: 1.6;
      padding: var(--tc-spacing-md);
      background: var(--tc-bg-primary);
      color: var(--tc-text-primary);
      border: none;
      border-radius: 0;
    }

    .code-editor__textarea:focus {
      outline: none;
      box-shadow: none;
    }

    .code-editor__textarea::placeholder {
      color: var(--tc-text-muted);
    }

    .code-editor__textarea:read-only {
      cursor: default;
      background: var(--tc-bg-secondary);
    }
  `]
})
export class CodeEditorComponent implements ControlValueAccessor {
  @Input() language = 'groovy';
  @Input() placeholder = 'Enter code...';
  @Input() rows = 10;
  @Input() readonly = false;

  @Output() valueChange = new EventEmitter<string>();

  readonly value = signal('');

  private onChange: (value: string) => void = () => {};
  private onTouched: () => void = () => {};

  onValueChange(newValue: string): void {
    this.value.set(newValue);
    this.onChange(newValue);
    this.valueChange.emit(newValue);
  }

  writeValue(value: string): void {
    this.value.set(value ?? '');
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.readonly = isDisabled;
  }
}
