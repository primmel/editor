import type { languages } from 'monaco-editor';

export const primmelLanguageDefinition: languages.IMonarchLanguage = {
  defaultToken: '',
  tokenPostfix: '.prl',

  keywords: [
    'root', 'version', 'metadata', 'schema', 'title', 'namespace',
    'edition', 'author', 'shortname',
    'role', 'process', 'canvas', 'parent',
    'start_event', 'end_event', 'timer_event', 'signal_catch_event',
    'exclusive_gateway', 'parallel_gateway',
    'provision', 'validate_provision', 'validate_measurement',
    'actor', 'modality', 'measure',
    'output', 'reference_data_registry', 'input',
    'class', 'enum', 'data_registry', 'variable',
    'reference', 'approval', 'approve_by',
    'map_profile', 'view_profile',
    'form', 'subform', 'symbol', 'calculation', 'state_machine',
    'term', 'note', 'table', 'figure', 'link',
    'elements', 'process_flow', 'data',
    'from', 'to', 'name', 'condition', 'description',
    'SHALL', 'SHOULD', 'MAY', 'SHALL_NOT',
  ],

  typeKeywords: [
    'string', 'int', 'real', 'boolean', 'date', 'time', 'datetime',
  ],

  operators: [],

  symbols: /[=><!~?:&|+\-*\/\^%]+/,

  tokenizer: {
    root: [
      [/"([^"\\]|\\.)*$/, 'string.invalid'],
      [/"/, 'string', '@string'],
      [/#.*$/, 'comment'],
      [/[{}]/, '@brackets'],
      [/[[\]]/, '@brackets'],
      [/[()]/, '@brackets'],
      [/@[a-zA-Z_]\w*/, 'tag'],
      [/[a-zA-Z_]\w*/, {
        cases: {
          '@keywords': 'keyword',
          '@typeKeywords': 'type',
          '@default': 'identifier',
        },
      }],
      [/\d+(\.\d+)?/, 'number'],
      [/\bx\d+\b/, 'number.hex'],
      [/[;,.]/, 'delimiter'],
      [/[^\s{}[\]()"#$;,.a-zA-Z_0-9]/, 'operator'],
    ],

    string: [
      [/[^\\"]+/, 'string'],
      [/\\./, 'string.escape'],
      [/"/, 'string', '@pop'],
    ],
  },
};
