import type { Ast } from './ast.js';

export interface SyntaxError extends Error {
  name: 'SyntaxError';
  expected: unknown[];
  found: string | null;
  location: {
    source: string;
    start: { offset: number; line: number; column: number };
    end: { offset: number; line: number; column: number };
  };
  format(sources: Array<{ source: string; text: string }>): string;
}

export interface ParseOptions {
  grammarSource?: string;
  startRule?: string;
}

export function parse(input: string, options?: ParseOptions): Ast;

export const StartRules: readonly string[];
