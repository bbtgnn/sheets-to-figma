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

  height: async (node, value) => {
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

  rotation: async (node, value) => {
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
