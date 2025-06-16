import { z } from "zod";
import { isWebUri } from "valid-url";
import { changeSolidPaintColor, clone, isHexColor } from "./utils";
import { Array, Record } from "effect";

export const propertiesHandlers: Record<
  string,
  (node: SceneNode, value: unknown) => Promise<void>
> = {
  x: async (node, value) => {
    const x = z.number().safeParse(value);
    if (x.success) node.x = x.data;
  },
  y: async (node, value) => {
    const y = z.number().safeParse(value);
    if (y.success) node.y = y.data;
  },

  width: async (node, value) => {
    const width = z.number().safeParse(value);
    if (width.success && "resize" in node) node.resize(width.data, node.height);
  },
  height: async (node, value) => {
    const height = z.number().safeParse(value);
    if (height.success && "resize" in node)
      node.resize(node.width, height.data);
  },

  rotation: async (node, value) => {
    const rotation = z.number().safeParse(value);
    if (rotation.success && "rotation" in node) node.rotation = rotation.data;
  },

  text: async (node, value) => {
    if (!("characters" in node)) return;
    await figma.loadFontAsync(node.fontName as FontName);

    let text: string;
    if (typeof value === "string") {
      text = value;
    } else {
      text = JSON.stringify(value);
    }
    node.characters = text;
  },

  fill: async (node, value) => {
    if (!("fills" in node)) return;
    const fill = z.string().safeParse(value);
    if (!fill.success) return;

    if (isWebUri(fill.data)) {
      try {
        const image = await figma.createImageAsync(fill.data);
        node.fills = [
          { type: "IMAGE", imageHash: image.hash, scaleMode: "FILL" },
        ];
      } catch (error) {
        console.error(error);
      }
    }

    const nodeFills = node.fills == figma.mixed ? [] : clone(node.fills);

    if (isHexColor(fill.data)) {
      const firstSolidPaint = nodeFills.find((f) => f.type == "SOLID");
      if (firstSolidPaint) {
        node.fills = Array.replace(
          nodeFills,
          nodeFills.indexOf(firstSolidPaint),
          changeSolidPaintColor(firstSolidPaint, fill.data)
        );
      } else {
        nodeFills.push(figma.util.solidPaint(fill.data));
        node.fills = nodeFills;
      }
    }
  },

  stroke_color: async (node, value) => {
    if (!("strokeWeight" in node)) return;
    const strokeColor = z.string().safeParse(value);
    if (!strokeColor.success) return;
    if (!isHexColor(strokeColor.data)) return;

    if (node.strokes.length == 0) node.strokeWeight = 2;

    const nodeStrokes = clone(node.strokes);

    const firstSolidPaint = nodeStrokes.find((s) => s.type == "SOLID");
    if (firstSolidPaint) {
      node.strokes = Array.replace(
        nodeStrokes,
        nodeStrokes.indexOf(firstSolidPaint),
        changeSolidPaintColor(firstSolidPaint, strokeColor.data)
      );
    } else {
      nodeStrokes.push(figma.util.solidPaint(strokeColor.data));
      node.strokes = nodeStrokes;
    }
  },

  stroke_weight: async (node, value) => {
    if (!("strokeWeight" in node)) return;
    const strokeWeight = z.number().safeParse(value);
    if (!strokeWeight.success) return;

    if (node.strokes.length == 0) {
      node.strokes = [figma.util.solidPaint("black")];
    }

    node.strokeWeight = strokeWeight.data;
  },

  instance: async (node, value) => {
    if (!(node.type == "INSTANCE")) return;
    const componentName = z.string().safeParse(value);
    if (!componentName.success) return;
    const componentNode = figma.currentPage.findOne(
      (node) => node.name == componentName.data && node.type == "COMPONENT"
    );
    if (!(componentNode?.type == "COMPONENT")) return;
    node.swapComponent(componentNode);
  },

  hidden: async (node, value) => {
    const v = z.boolean().safeParse(value);
    node.visible = v.data ?? false;
  },

  visible: async (node, value) => {
    const v = z.boolean().safeParse(value);
    node.visible = v.data ?? true;
  },
};
