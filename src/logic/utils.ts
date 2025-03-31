import { cloneDeep } from "lodash";

const hexColorRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;

export function isHexColor(color: string): boolean {
  return hexColorRegex.test(color);
}

export function clone<T>(
  val: T
): T extends ReadonlyArray<infer U> ? Array<U> : T {
  return cloneDeep(val) as any;
}

export function changeSolidPaintColor(
  paint: SolidPaint,
  color: string
): SolidPaint {
  const { blendMode, opacity, visible } = paint;
  // Somehow, opacity override does not work with figma.util.solidPaint
  const { color: newColor } = figma.util.solidPaint(color);
  return figma.util.solidPaint(
    {
      ...newColor,
      a: opacity,
    },
    {
      blendMode,
      visible,
    }
  );
}
