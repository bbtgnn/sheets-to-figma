/**
 * BigInt polyfill using the big-integer library
 * This provides a comprehensive BigInt implementation for environments
 * that don't support BigInt natively
 */

import bigInt from "big-integer";

// Only apply the polyfill if BigInt is not natively supported
if (typeof globalThis.BigInt === "undefined") {
  // Create a polyfill function that mimics the native BigInt constructor
  const BigIntPolyfill = function (
    value: number | string | boolean | bigInt.BigInteger
  ): any {
    // If it's already a bigInt instance, return it
    if (typeof value === "object" && value !== null && "toString" in value) {
      return value;
    }

    // Otherwise create a new bigInt instance
    return bigInt(value as any);
  };

  // Add the required static methods to match BigIntConstructor interface
  BigIntPolyfill.asIntN = function (bits: number, int: bigint): bigint {
    return BigIntPolyfill(
      bigInt(int).and(bigInt(2).pow(bits).minus(1)).toString()
    );
  };

  BigIntPolyfill.asUintN = function (bits: number, int: bigint): bigint {
    return BigIntPolyfill(
      bigInt(int).and(bigInt(2).pow(bits).minus(1)).toString()
    );
  };

  // Assign our polyfill to the global scope
  (globalThis.BigInt as any) = BigIntPolyfill;
}

export default bigInt;
