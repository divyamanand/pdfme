import type { TextSchema } from '../text/types.js';

export interface MultiVariableTextSchema extends TextSchema {
  text?: string;       // Template text. Absent/empty = static plain text mode
  variables?: string[]; // Variable names extracted from template. Absent/empty = no variables
}
