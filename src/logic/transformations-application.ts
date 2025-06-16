import type { SheetCsv } from "./data-fetch";
import {
  propertyUpdaters,
  propertyUpdates,
  type PropertyUpdater,
} from "./transformations-registry";
import { Effect as _, pipe, String } from "effect";

//

function makeCopies(
  node: SceneNode,
  count: number,
  options: { spaceBetweenItems?: boolean } = {}
): _.Effect<SceneNode[], Error> {
  const parentNode = node.parent;
  if (!parentNode) return _.fail(new Error("Node has no parent"));

  const parentHasAutoLayout =
    parentNode.type == "FRAME" && Boolean(parentNode.inferredAutoLayout);

  const copies: SceneNode[] = [];

  for (let i = 0; i < count; i++) {
    const copy = node.clone();
    parentNode.appendChild(copy);
    copies.push(copy);
    if (!parentHasAutoLayout && options.spaceBetweenItems) {
      const increaseX = node.width + 20;
      const startX = node.x + increaseX;
      const startY = node.y;
      copy.x = startX + i * increaseX;
      copy.y = startY;
    }
  }

  return _.succeed(copies);
}

//

type TransformationHeader = {
  propertyName: string;
  targetNodeName: string;
  columnIndex: number;
};

function getTransformationHeaders(
  tableHeaders: string[]
): TransformationHeader[] {
  const validHeaders: TransformationHeader[] = [];

  for (let i = 0; i < tableHeaders.length; i++) {
    const header = tableHeaders[i];
    const headerParts = header.trim().split(".").map(String.trim);
    if (headerParts.length !== 2) continue;
    const [targetNodeName, propertyName] = headerParts;
    validHeaders.push({ targetNodeName, propertyName, columnIndex: i });
  }
  return validHeaders;
}

//

type TransformationPayload = {
  value: string;
  nodes: SceneNode[];
  property: string;
};

function getTransformationsPayload(
  csv: SheetCsv,
  nodes: SceneNode[]
): _.Effect<TransformationPayload[], Error> {
  if (csv.length - 1 != nodes.length)
    return _.fail(
      new Error(
        "The number of nodes and the number of rows in the CSV must be the same"
      )
    );

  const [tableHeaders, ...tableBody] = csv;

  const headers = getTransformationHeaders(tableHeaders);
  headers.map((header) => {
    const values = tableBody.map((row) => row[header.columnIndex]);
  });

  for (let i = 0; i < tableHeaders.length; i++) {
    const [targetName, propertyName] = headerParts;

    const rootNode = nodes[i];
    const nodesToTransform = getNodesByName(rootNode, targetName);
    const values = tableBody.map((row) => row[i]);

    payloads.push({
      property: propertyName,
      value: values[0],
      nodes: nodesToTransform,
    });
  }

  return _.succeed(payloads);
}

//

async function processTransformationPayload(
  payload: TransformationPayload
): _.Effect<void, Error> {
  return _.gen(function* () {
    const propertyUpdater = yield* getPropertyUpdater(payload.property);
  });
  for (const [node, value] of payload.entries) {
    const nodeToTransform = findNodesByName(node, payload.nodeName);
    if (nodeToTransform.length == 0) continue;
    const propertyHandler = getPropertyHandler(payload.property);
    await propertyHandler(node, value);
  }
}

function getPropertyUpdater(
  property: string
): _.Effect<PropertyUpdater, Error> {
  return _.fromNullable(propertyUpdaters[property]);
}

function getNodesByName(rootNode: SceneNode, name: string): SceneNode[] {
  const nodes: SceneNode[] = [];
  if (rootNode.name == name) {
    nodes.push(rootNode);
  }
  if ("findAll" in rootNode) {
    nodes.push(...rootNode.findAll((node) => node.name == name));
  }
  return nodes;
}
