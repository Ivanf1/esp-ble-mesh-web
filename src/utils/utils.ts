import { BigInteger } from "big-integer";

const hexToBytes = (hexString: string): number[] => {
  const result = [];

  while (hexString.length >= 2) {
    result.push(parseInt(hexString.substring(0, 2), 16));
    hexString = hexString.substring(2, hexString.length);
  }

  return result;
};

const bytesToHex = (bytes: number[]): string => {
  const hex = [];

  for (let i = 0; i < bytes.length; i++) {
    hex.push((bytes[i] >>> 4).toString(16));
    hex.push((bytes[i] & 0xf).toString(16));
  }

  return hex.join("");
};

const bigIntegerToHexString = (bigInteger: BigInteger): string => {
  return bigInteger.toString(16);
};

const toAsciiCodes = (text: string) => {
  const bytes = [];

  for (let i = 0; i < text.length; i++) {
    bytes.push(text.charCodeAt(i));
  }

  return bytes;
};

const toHex = (intNumber: number, octets: number): string => {
  let hex = Number(intNumber).toString(16);

  if (hex.length % 2 == 1) {
    hex = "0" + hex;
  }

  const octetCount = hex.length / 2;
  if (octetCount < octets) {
    const paddingOctetsToAdd = octets - octetCount;
    for (let i = 0; i < paddingOctetsToAdd; i++) {
      hex = "00" + hex;
    }
  } else if (octetCount > octets) {
    hex = hex.substring(hex.length - 2);
  }

  return hex;
};

const hexToU8A = (hexString: string): Uint8Array => {
  if (hexString.length % 2 != 0) {
    console.log(
      "ERROR: hex string must be even number in length and contain nothing but hex chars"
    );
    return new Uint8Array([]);
  }

  const bytes = [];
  for (let i = 0; i < hexString.length; i = i + 2) {
    bytes.push(parseInt(hexString.substring(i, i + 2), 16));
  }

  return new Uint8Array(bytes);
};

const u8AToHexString = (u8a: Uint8Array): string => {
  let hex = "";

  for (let i = 0; i < u8a.length; i++) {
    let hexPair = "0" + u8a[i].toString(16);
    if (hexPair.length == 3) {
      hexPair = hexPair.substring(1, 3);
    }
    hex = hex + hexPair;
  }

  return hex;
};

// Convert an integer to a hex string, padded with a leading zero if required
const intToHex = (number: number): string => {
  const hex = "00" + number.toString(16);
  return hex.substring(hex.length - 2);
};

const xorU8Array = (bytes1: Uint8Array, bytes2: Uint8Array): Uint8Array => {
  // Uint8Arrays in and out
  if (bytes1.length != bytes2.length) {
    console.log("ERROR in xorU8Array: operands must be the same length");
    return new Uint8Array([]);
  }

  const xorBytes = [];
  for (let i = 0; i < bytes1.length; i++) {
    xorBytes.push(bytes1[i] ^ bytes2[i]);
  }

  return new Uint8Array(xorBytes);
};

const leastSignificantBit = (number: number): number => {
  return number & 1;
};

const U8ArrayToInt = (array: Uint8Array) => {
  const view = new DataView(array.buffer, 0);
  return view.getUint32(0, true);
};

function arrayBufferToHex(buffer: ArrayBuffer) {
  // buffer is an ArrayBuffer
  return [...new Uint8Array(buffer)].map((x) => x.toString(16).padStart(2, "0")).join("");
}

const utils = {
  hexToBytes,
  bytesToHex,
  bigIntegerToHexString,
  toAsciiCodes,
  toHex,
  hexToU8A,
  u8AToHexString,
  intToHex,
  xorU8Array,
  leastSignificantBit,
  U8ArrayToInt,
  arrayBufferToHex,
};

export default utils;
