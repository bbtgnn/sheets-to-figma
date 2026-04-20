import { z } from "zod";
import type { ZodType } from "zod";
import { isWebUri } from "valid-url";
import {
  buildRotationAroundPoint,
  getConstraintPivotLocal,
  getConstraintPivotParent,
  getEffectiveTransform,
  isIdentityTransform,
  setTranslation,
  transformMultiply,
} from "./transform";
import {
  clone,
  isHexColor,
  parseSolidPaintFromValue,
  replaceOrAppendSolidPaint,
} from "./utils";
import * as Result from "true-myth/result";

export interface PropertyDefinition<T, Ctx = void> {
  schema: ZodType<T>;
  preload?: (edits: { node: SceneNode; value: T }[]) => Promise<Ctx>;
  apply: (node: SceneNode, value: T, ctx?: Ctx) => void;
}

export function property<T, Ctx = void>(
  def: PropertyDefinition<T, Ctx>,
): PropertyDefinition<T, Ctx> {
  return def;
}

export type EditItem = {
  node: SceneNode;
  propertyName: string;
  propertyValue: unknown;
};

const _propertyDefinitions = {
  x: property({
    schema: z.number(),
    apply: (node, value) => {
      node.x = value;
    },
  }),

  y: property({
    schema: z.number(),
    apply: (node, value) => {
      node.y = value;
    },
  }),

  tx: property({
    schema: z.number(),
    apply: (node, value) => {
      const t = getEffectiveTransform(node);
      if (isIdentityTransform(t)) {
        node.x = node.x + value;
      } else {
        node.relativeTransform = setTranslation(t, t[0][2] + value, t[1][2]);
      }
    },
  }),

  ty: property({
    schema: z.number(),
    apply: (node, value) => {
      const t = getEffectiveTransform(node);
      if (isIdentityTransform(t)) {
        node.y = node.y + value;
      } else {
        node.relativeTransform = setTranslation(t, t[0][2], t[1][2] + value);
      }
    },
  }),

  width: property({
    schema: z.number(),
    apply: (node, value) => {
      if (!("resize" in node)) return;
      const delta = node.width - value;
      node.resize(value, node.height);
      if (!("constraints" in node)) return;
      const { horizontal } = node.constraints;
      if (
        horizontal === "CENTER" ||
        horizontal === "STRETCH" ||
        horizontal === "SCALE"
      )
        node.x = node.x + delta / 2;
      else if (horizontal === "MAX") node.x = node.x + delta;
    },
  }),

  height: property({
    schema: z.number(),
    apply: (node, value) => {
      if (!("resize" in node)) return;
      const delta = node.height - value;
      node.resize(node.width, value);
      if (!("constraints" in node)) return;
      const { vertical } = node.constraints;
      if (
        vertical === "CENTER" ||
        vertical === "STRETCH" ||
        vertical === "SCALE"
      )
        node.y = node.y + delta / 2;
      else if (vertical === "MAX") node.y = node.y + delta;
    },
  }),

  rotation: property({
    schema: z.number(),
    apply: (node, value) => {
      const transform = getEffectiveTransform(node);
      const pivotLocal = getConstraintPivotLocal(node);
      const pivotParent = getConstraintPivotParent(transform, pivotLocal);
      const R = buildRotationAroundPoint(value, pivotParent);
      node.relativeTransform = transformMultiply(R, transform);
    },
  }),

  scale: property({
    schema: z.number(),
    apply: (node, value) => {
      if (!("resize" in node)) return;
      const transform = getEffectiveTransform(node);
      const pivotLocal = getConstraintPivotLocal(node);
      const pivotParent = getConstraintPivotParent(transform, pivotLocal);
      node.resize(node.width * value, node.height * value);
      const newPivotLocal = getConstraintPivotLocal(node);
      const [[m00, m01], [m10, m11]] = transform;
      const newTx =
        pivotParent.x - (m00 * newPivotLocal.px + m01 * newPivotLocal.py);
      const newTy =
        pivotParent.y - (m10 * newPivotLocal.px + m11 * newPivotLocal.py);
      node.relativeTransform = setTranslation(transform, newTx, newTy);
    },
  }),

  text: property({
    schema: z.coerce.string(),
    preload: async (edits) => {
      const fontNames: FontName[] = [];
      const seen = new Set<string>();
      for (const { node } of edits) {
        if (!("characters" in node)) continue;
        const textNode = node as TextNode;
        const fonts =
          textNode.fontName === figma.mixed
            ? textNode.getRangeAllFontNames(0, textNode.characters.length)
            : [textNode.fontName];
        for (const font of fonts) {
          const key = `${font.family}-${font.style}`;
          if (!seen.has(key)) {
            seen.add(key);
            fontNames.push(font);
          }
        }
      }
      await Promise.all(fontNames.map((font) => figma.loadFontAsync(font)));
    },
    apply: (node, value) => {
      if (!("characters" in node)) return;
      node.characters = value;
    },
  }),

  fill: property({
    schema: z.string(),
    preload: async (edits) => {
      const urls = new Set<string>();
      for (const { value } of edits) {
        if (!isWebUri(value)) continue;
        urls.add(value);
      }
      const imageMap = new Map<string, Image>();
      await Promise.all(
        Array.from(urls).map(async (url) => {
          try {
            const image = await figma.createImageAsync(url);
            imageMap.set(url, image);
          } catch (error) {
            console.error(url, error);
          }
        }),
      );
      return imageMap;
    },
    apply: (node, value, ctx) => {
      if (!("fills" in node)) return;
      const imageMap = ctx;

      if (isWebUri(value)) {
        const image = imageMap?.get(value);
        if (image) {
          node.fills = [
            { type: "IMAGE", imageHash: image.hash, scaleMode: "FILL" },
          ];
        } else {
          console.warn(`Fill image not preloaded: ${value}`);
        }
        return;
      }

      const nodeFills = node.fills == figma.mixed ? [] : node.fills;
      const paint = parseSolidPaintFromValue(value);
      if (paint) node.fills = replaceOrAppendSolidPaint(nodeFills, paint);
    },
  }),

  stroke_color: property({
    schema: z.string(),
    apply: (node, value) => {
      if (!("strokeWeight" in node)) return;
      const paint = parseSolidPaintFromValue(value);
      if (!paint) return;
      if (node.strokes.length == 0) node.strokeWeight = 2;
      node.strokes = replaceOrAppendSolidPaint(node.strokes, paint);
    },
  }),

  stroke_weight: property({
    schema: z.number(),
    apply: (node, value) => {
      if (!("strokeWeight" in node)) return;
      if (node.strokes.length == 0) {
        node.strokes = [figma.util.solidPaint("black")];
      }
      node.strokeWeight = value;
    },
  }),

  instance: property({
    schema: z.string(),
    apply: (node, value) => {
      if (node.type !== "INSTANCE") return;
      const componentNode = figma.currentPage.findOne(
        (n) => n.name == value && n.type == "COMPONENT",
      );
      if (componentNode?.type !== "COMPONENT") return;
      node.swapComponent(componentNode);
    },
  }),

  component: property({
    schema: z.coerce.string(),
    apply: (node, value) => {
      if (node.type !== "INSTANCE") return;
      const componentNode = figma.currentPage.findOne(
        (n) => n.name == value && n.type == "COMPONENT",
      );
      if (componentNode?.type !== "COMPONENT") return;
      node.swapComponent(componentNode);
    },
  }),

  hidden: property({
    schema: z.boolean(),
    apply: (node, value) => {
      node.visible = value ?? false;
    },
  }),

  visible: property({
    schema: z.boolean(),
    apply: (node, value) => {
      node.visible = value ?? true;
    },
  }),
};

export const propertyDefinitions = _propertyDefinitions as Record<
  string,
  PropertyDefinition<unknown, unknown>
>;

export async function runPreloaders(
  editItems: EditItem[],
  definitions: Record<string, PropertyDefinition<unknown, unknown>>,
): Promise<Record<string, unknown>> {
  const byProperty = new Map<
    string,
    { node: SceneNode; value: unknown; parsed: unknown }[]
  >();

  for (const { node, propertyName, propertyValue } of editItems) {
    const def = definitions[propertyName];
    if (!def?.preload) continue;
    const parsed = def.schema.safeParse(propertyValue);
    if (!parsed.success) continue;
    const list = byProperty.get(propertyName) ?? [];
    list.push({ node, value: propertyValue, parsed: parsed.data });
    byProperty.set(propertyName, list);
  }

  const context: Record<string, unknown> = {};
  await Promise.all(
    Array.from(byProperty.entries()).map(async ([propName, items]) => {
      const def = definitions[propName];
      if (!def?.preload) return;
      const edits = items.map(({ node, parsed }) => ({ node, value: parsed }));
      context[propName] = await def.preload(edits);
    }),
  );
  return context;
}

export function applyEdit(
  node: SceneNode,
  propertyName: string,
  value: unknown,
  context: Record<string, unknown>,
): Result.Result<void, Error> {
  const def = propertyDefinitions[propertyName];
  if (!def) {
    return Result.err(new Error(`No handler for property "${propertyName}"`));
  }
  const parsed = def.schema.safeParse(value);
  if (!parsed.success) {
    return Result.err(
      new Error(`${node.name}: Invalid value for property "${propertyName}"`),
    );
  }
  try {
    def.apply(node, parsed.data, context[propertyName]);
    return Result.ok(undefined);
  } catch (e) {
    console.warn(
      `Error setting property "${propertyName}" on node "${node.name}"`,
      def,
      e,
    );
    return Result.err(
      new Error(
        `${node.name}: Error setting property "${propertyName}"`,
      ) as Error,
    );
  }
}
