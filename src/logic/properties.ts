import { z } from "zod";

export const propertiesHandlers: Record<
  string,
  (node: SceneNode, value: unknown) => void | Promise<void>
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
    if (width.success && "resize" in node) node.resize(width.data, node.height);
  },
  height: (node, value) => {
    const height = z.number().safeParse(value);
    if (height.success && "resize" in node)
      node.resize(node.width, height.data);
  },
  rotation: (node, value) => {
    const rotation = z.number().safeParse(value);
    if (rotation.success && "rotation" in node) node.rotation = rotation.data;
  },
  fill: async (node, value) => {
    if (!("fills" in node)) return;
    // TODO - somehow it doesn't work, check better
    const fill = z.string().safeParse(value); //.url().safeParse(value);
    console.log(fill.data);
    if (fill.data?.startsWith("http")) {
      try {
        const image = await figma.createImageAsync(fill.data);
        node.fills = [
          { type: "IMAGE", imageHash: image.hash, scaleMode: "FILL" },
        ];
      } catch (error) {
        console.error(error);
      }
    }
  },
};
