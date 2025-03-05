import { z } from "zod";
import { isWebUri } from "valid-url";

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
    const text = z.string().safeParse(value);
    if (text.success) node.characters = text.data;
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

    const hexColorRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
    if (hexColorRegex.test(fill.data)) {
      node.fills = [figma.util.solidPaint(fill.data)];
    }
  },
};
