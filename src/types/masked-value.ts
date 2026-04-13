/**
 * A value sourced from an ENV.* variable that must be masked in all output.
 */
export interface MaskedValue {
  readonly __masked: true;
  readonly value: string;
}

export function createMaskedValue(value: string): MaskedValue {
  return { __masked: true, value };
}

export function isMaskedValue(v: unknown): v is MaskedValue {
  return typeof v === 'object' && v !== null && '__masked' in v && (v as MaskedValue).__masked === true;
}

export function maskDisplay(_v: MaskedValue): string {
  return '████████';
}
