/**
 * Helpers for 2D affine transforms used with node.relativeTransform.
 * Figma uses 2x3 row-major: [[m00, m01, tx], [m10, m11, ty]].
 * Translation = (tx, ty); linear part = (m00, m01; m10, m11) (unit axes, no scale in matrix).
 */

export function getEffectiveTransform(node: SceneNode): Transform {
  return [...node.relativeTransform.map((row) => [...row])] as Transform;
}

export interface PivotLocal {
  px: number;
  py: number;
}

/**
 * Pivot in node-local coordinates from constraints.
 * MIN -> 0; CENTER -> width/2, height/2; MAX -> width, height.
 */
export function getConstraintPivotLocal(node: SceneNode): PivotLocal {
  const w = node.width;
  const h = node.height;
  let px = 0;
  let py = 0;
  if ("constraints" in node) {
    const { horizontal, vertical } = node.constraints;
    if (horizontal === "MAX") px = w;
    else if (horizontal === "CENTER") px = w / 2;
    if (vertical === "MAX") py = h;
    else if (vertical === "CENTER") py = h / 2;
  }
  return { px, py };
}

/**
 * Pivot in parent space: transform * (pivotLocal.px, pivotLocal.py).
 */
export function getConstraintPivotParent(
  transform: Transform,
  pivotLocal: PivotLocal
): { x: number; y: number } {
  const { px, py } = pivotLocal;
  const [[m00, m01, tx], [m10, m11, ty]] = transform;
  return {
    x: tx + m00 * px + m01 * py,
    y: ty + m10 * px + m11 * py,
  };
}

/**
 * Multiply two 2x3 affine transforms (treat as 3x3 with row [0,0,1]).
 * Result = A * B (apply B first, then A).
 */
export function transformMultiply(A: Transform, B: Transform): Transform {
  const [
    [a00, a01, atx],
    [a10, a11, aty],
  ] = A;
  const [
    [b00, b01, btx],
    [b10, b11, bty],
  ] = B;
  return [
    [
      a00 * b00 + a01 * b10,
      a00 * b01 + a01 * b11,
      a00 * btx + a01 * bty + atx,
    ],
    [
      a10 * b00 + a11 * b10,
      a10 * b01 + a11 * b11,
      a10 * btx + a11 * bty + aty,
    ],
  ];
}

/**
 * New transform with same linear part and given translation.
 */
export function setTranslation(
  transform: Transform,
  tx: number,
  ty: number
): Transform {
  const [[m00, m01], [m10, m11]] = transform;
  return [
    [m00, m01, tx],
    [m10, m11, ty],
  ];
}

/**
 * Build rotation matrix (degrees) so that pivot in parent stays at pivotParent.
 * R * pivotLocal = pivotParent => translation = pivotParent - R_linear * pivotLocal.
 * Use when R is the full node transform (replace mode).
 */
export function buildRotationMatrix(
  degrees: number,
  pivotParent: { x: number; y: number },
  pivotLocal: PivotLocal
): Transform {
  const theta = degrees * (Math.PI / 180);
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  const { px, py } = pivotLocal;
  const tx = pivotParent.x - (c * px + s * py);
  const ty = pivotParent.y - (-s * px + c * py);
  return [
    [c, s, tx],
    [-s, c, ty],
  ];
}

/**
 * Build rotation matrix that rotates around a point in parent space.
 * So R * point = point (point stays fixed). Use when composing: (R * current) * pivotLocal = R * pivotParent = pivotParent.
 */
export function buildRotationAroundPoint(
  degrees: number,
  pointParent: { x: number; y: number }
): Transform {
  const theta = degrees * (Math.PI / 180);
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  const { x, y } = pointParent;
  const tx = x - (c * x + s * y);
  const ty = y - (-s * x + c * y);
  return [
    [c, s, tx],
    [-s, c, ty],
  ];
}

/**
 * True if transform is identity (translation-only with no rotation/skew).
 * Used to decide whether tx/ty should update node.x/node.y or the matrix.
 */
export function isIdentityTransform(transform: Transform): boolean {
  const [[m00, m01], [m10, m11]] = transform;
  return m00 === 1 && m01 === 0 && m10 === 0 && m11 === 1;
}
