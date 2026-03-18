import { cloneDeep } from "lodash";

const hexColorRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;

export function isHexColor(color: string): boolean {
  return hexColorRegex.test(color);
}

export function clone<T>(
  val: T,
): T extends ReadonlyArray<infer U> ? Array<U> : T {
  return cloneDeep(val) as any;
}

/**
 * Merge two solid paints picking:
 * - basePaint: blendMode, opacity, visible
 * - newPaint: color
 * @param basePaint - The base paint to merge with the new paint.
 * @param newPaint - The new paint to merge with the base paint.
 * @returns The merged paint.
 */
function mergeSolidPaints(
  basePaint: SolidPaint,
  overridePaint?: SolidPaint,
): SolidPaint {
  const { blendMode, opacity, visible } = basePaint;
  return figma.util.solidPaint(
    {
      ...basePaint.color,
      a: overridePaint?.opacity ?? opacity,
    },
    {
      blendMode: overridePaint?.blendMode ?? blendMode,
      visible: overridePaint?.visible ?? visible,
    },
  );
}

export function replaceOrAppendSolidPaint(
  paints: ReadonlyArray<Paint>,
  paint: SolidPaint,
): Paint[] {
  const clonedPaints = clone(paints);
  const firstSolidPaint = clonedPaints.find(
    (paint): paint is SolidPaint => paint.type === "SOLID",
  );
  if (firstSolidPaint) {
    const i = clonedPaints.indexOf(firstSolidPaint);
    return [
      ...clonedPaints.slice(0, i),
      mergeSolidPaints(paint, firstSolidPaint),
      ...clonedPaints.slice(i + 1),
    ];
  } else {
    return [...clonedPaints, paint];
  }
}

export function parseSolidPaintFromValue(
  color: string,
): SolidPaint | undefined {
  if (isHexColor(color)) {
    return figma.util.solidPaint(color);
  }
  const rgb = parseRgb255Triplet(color);
  if (rgb) {
    return figma.util.solidPaint({
      r: rgb.r / 255,
      g: rgb.g / 255,
      b: rgb.b / 255,
    });
  }
  return undefined;
}

function parseRgb255Triplet(
  value: string,
): { r: number; g: number; b: number } | null {
  const m = value.match(/^\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*$/);
  if (!m) return null;
  const clamp = (n: number) => Math.max(0, Math.min(255, n));
  return {
    r: clamp(Number(m[1])),
    g: clamp(Number(m[2])),
    b: clamp(Number(m[3])),
  };
}
