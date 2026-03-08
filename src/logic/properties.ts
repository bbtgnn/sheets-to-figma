import { z } from "zod";
import { isWebUri } from "valid-url";
import { changeSolidPaintColor, clone, isHexColor } from "./utils";

export type ApplyContext = {
  imageMap?: Map<string, Image>;
};

/** Preload all fill image URLs from "fill" edits; returns URL → Image for use in apply context. */
export async function preloadFillImages(
  edits: { property: string; value: unknown }[]
): Promise<Map<string, Image>> {
  const urls = new Set<string>();
  for (const e of edits) {
    if (e.property !== "fill") continue;
    const parsed = z.string().safeParse(e.value);
    if (!parsed.success || !isWebUri(parsed.data)) continue;
    urls.add(parsed.data);
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
    })
  );
  return imageMap;
}

/** Load all fonts used by "text" edits once, before applying any properties. */
export async function preloadFontsForTextProperties(
  edits: { node: SceneNode; property: string }[]
): Promise<void> {
  const textEdits = edits.filter(
    (e) => e.property === "text" && "characters" in e.node
  );
  const fontNames: FontName[] = [];
  const seen = new Set<string>();

  for (const { node } of textEdits) {
    const textNode = node as TextNode;
    let fonts: FontName[];

    if (textNode.fontName === figma.mixed) {
      fonts = textNode.getRangeAllFontNames(0, textNode.characters.length);
    } else {
      fonts = [textNode.fontName];
    }

    for (const font of fonts) {
      const key = `${font.family}-${font.style}`;
      if (!seen.has(key)) {
        seen.add(key);
        fontNames.push(font);
      }
    }
  }

  await Promise.all(fontNames.map((font) => figma.loadFontAsync(font)));
}

export const propertiesHandlers: Record<
  string,
  (node: SceneNode, value: unknown, context?: ApplyContext) => void
> = {
  x: (node, value) => {
    const x = z.number().safeParse(value);
    if (x.success) node.x = x.data;
  },
  y: (node, value) => {
    const y = z.number().safeParse(value);
    if (y.success) node.y = y.data;
  },

  width: (node, value) => {
    const width = z.number().safeParse(value);
    if (!(width.success && "resize" in node)) return;
    const delta = node.width - width.data;
    node.resize(width.data, node.height);
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

  height: (node, value) => {
    const height = z.number().safeParse(value);
    if (!(height.success && "resize" in node)) return;
    const delta = node.height - height.data;
    node.resize(node.width, height.data);
    if (!("constraints" in node)) return;
    const { vertical } = node.constraints;
    if (vertical === "CENTER" || vertical === "STRETCH" || vertical === "SCALE")
      node.y = node.y + delta / 2;
    else if (vertical === "MAX") node.y = node.y + delta;
  },

  rotation: (node, value) => {
    const rotation = z.number().safeParse(value);
    if (!rotation.success) return;

    // https://gist.github.com/LukeFinch/d3c93d79a9dcd6970358be1d17838318

    let angle = rotation.data;
    let theta = angle * (Math.PI / 180); //radians

    let cx = node.x;
    let cy = node.y;

    if ("constraints" in node) {
      const { horizontal, vertical } = node.constraints;
      if (horizontal === "MAX") {
        cx = node.x + node.width;
      } else if (horizontal === "CENTER") {
        cx = node.x + node.width / 2;
      }
      if (vertical === "MAX") {
        cy = node.y + node.height;
      } else if (vertical === "CENTER") {
        cy = node.y + node.height / 2;
      }
    }

    let newx =
      Math.cos(theta) * node.x +
      node.y * Math.sin(theta) -
      cy * Math.sin(theta) -
      cx * Math.cos(theta) +
      cx;
    let newy =
      -Math.sin(theta) * node.x +
      cx * Math.sin(theta) +
      node.y * Math.cos(theta) -
      cy * Math.cos(theta) +
      cy;

    node.relativeTransform = [
      [Math.cos(theta), Math.sin(theta), newx],
      [-Math.sin(theta), Math.cos(theta), newy],
    ];
  },

  text: (node, value) => {
    if (!("characters" in node)) return;
    // Font is loaded once before applying properties via preloadFontsForTextProperties

    let text: string;
    if (typeof value === "string") {
      text = value;
    } else {
      text = JSON.stringify(value);
    }
    node.characters = text;
  },

  fill: (node, value, context) => {
    if (!("fills" in node)) return;
    const fill = z.string().safeParse(value);
    if (!fill.success) return;

    if (isWebUri(fill.data)) {
      const image = context?.imageMap?.get(fill.data);
      if (image) {
        node.fills = [
          { type: "IMAGE", imageHash: image.hash, scaleMode: "FILL" },
        ];
      } else {
        console.warn(`Fill image not preloaded: ${fill.data}`);
      }
    }

    const nodeFills = node.fills == figma.mixed ? [] : clone(node.fills);

    if (isHexColor(fill.data)) {
      const firstSolidPaint = nodeFills.find((f) => f.type == "SOLID");
      if (firstSolidPaint) {
        const i = nodeFills.indexOf(firstSolidPaint);
        node.fills = [
          ...nodeFills.slice(0, i),
          changeSolidPaintColor(firstSolidPaint, fill.data),
          ...nodeFills.slice(i + 1),
        ];
      } else {
        nodeFills.push(figma.util.solidPaint(fill.data));
        node.fills = nodeFills;
      }
    }
  },

  stroke_color: (node, value) => {
    if (!("strokeWeight" in node)) return;
    const strokeColor = z.string().safeParse(value);
    if (!strokeColor.success) return;
    if (!isHexColor(strokeColor.data)) return;

    if (node.strokes.length == 0) node.strokeWeight = 2;

    const nodeStrokes = clone(node.strokes);

    const firstSolidPaint = nodeStrokes.find((s) => s.type == "SOLID");
    if (firstSolidPaint) {
      const i = nodeStrokes.indexOf(firstSolidPaint);
      node.strokes = [
        ...nodeStrokes.slice(0, i),
        changeSolidPaintColor(firstSolidPaint, strokeColor.data),
        ...nodeStrokes.slice(i + 1),
      ];
    } else {
      nodeStrokes.push(figma.util.solidPaint(strokeColor.data));
      node.strokes = nodeStrokes;
    }
  },

  stroke_weight: (node, value) => {
    if (!("strokeWeight" in node)) return;
    const strokeWeight = z.number().safeParse(value);
    if (!strokeWeight.success) return;

    if (node.strokes.length == 0) {
      node.strokes = [figma.util.solidPaint("black")];
    }

    node.strokeWeight = strokeWeight.data;
  },

  instance: (node, value) => {
    if (!(node.type == "INSTANCE")) return;
    const componentName = z.string().safeParse(value);
    if (!componentName.success) return;
    const componentNode = figma.currentPage.findOne(
      (node) => node.name == componentName.data && node.type == "COMPONENT"
    );
    if (!(componentNode?.type == "COMPONENT")) return;
    node.swapComponent(componentNode);
  },

  hidden: (node, value) => {
    const v = z.boolean().safeParse(value);
    node.visible = v.data ?? false;
  },

  visible: (node, value) => {
    const v = z.boolean().safeParse(value);
    node.visible = v.data ?? true;
  },
};
