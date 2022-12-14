const normaliseHex = (raw: any) => {
  const value = raw.replace(/\s/g, "");
  return value.toUpperCase();
};

// const byteArrayToWordArray = (byteArray: any) => {
//   const wordArray: any[] = [];

//   for (let i = 0; i < byteArray.length; i++) {
//     wordArray[(i / 4) | 0] |= byteArray[i] << (24 - 8 * i);
//   }

//   return CryptoJS.lib.WordArray.create(wordArray, byteArray.length);
// };

const hexToBytes = (hexString: string): number[] => {
  const result = [];

  while (hexString.length >= 2) {
    result.push(parseInt(hexString.substring(0, 2), 16));
    hexString = hexString.substring(2, hexString.length);
  }

  return result;
};

const bytesToHex = (bytes: any): string => {
  const hex = [];
  for (let i = 0; i < bytes.length; i++) {
    hex.push((bytes[i] >>> 4).toString(16));
    hex.push((bytes[i] & 0xf).toString(16));
  }

  return hex.join("");
};

const bigIntegerToHexString = (bigInteger: any): string => {
  return bigInteger.toString(16);
};

const toAsciiCodes = (text: any) => {
  const bytes = [];

  for (let i = 0; i < text.length; i++) {
    bytes.push(text.charCodeAt(i));
  }

  return bytes;
};

const toHexDated = (number: number, octets: any): string => {
  let hex = ("0" + Number(number).toString(16)).toUpperCase();

  if (hex.length % 2 == 1) {
    hex = "0" + hex;
  }

  const octet_count = hex.length / 2;
  if (octet_count < octets) {
    const added_zeroes = octets - octet_count;
    for (let i = 0; i < added_zeroes; i++) {
      hex = "00" + hex;
    }
  } else if (octet_count > octets) {
    // hex = hex.substring((octet_count - octets) * 2, hex_chars.length);
  }

  return hex;
};

const toHex = (intNumber: number, octets: number): string => {
  let hex = Number(intNumber).toString(16);

  if (hex.length % 2 == 1) {
    hex = "0" + hex;
  }

  const octetCount = hex.length / 2;
  const paddingOctetsToAdd = octets - octetCount;
  for (let i = 0; i < paddingOctetsToAdd; i++) {
    hex = "00" + hex;
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
    let hex_pair = "0" + u8a[i].toString(16);
    if (hex_pair.length == 3) {
      hex_pair = hex_pair.substring(1, 3);
    }
    hex = hex + hex_pair;
  }

  return hex;
};

// Convert an integer to a hex string, padded with a leading zero if required;
const intToHex = (number: number): string => {
  const hex = "00" + number.toString(16);
  return hex.substring(hex.length - 2);
};

const xorU8Array = (bytes1: any, bytes2: any): Uint8Array => {
  // Uint8Arrays in and out
  if (bytes1.length != bytes2.length) {
    console.log("ERROR in xorU8Array: operands must be the same length");
    return new Uint8Array([]);
  }

  const xor_bytes = [];
  for (let i = 0; i < bytes1.length; i++) {
    xor_bytes.push(bytes1[i] ^ bytes2[i]);
  }

  return new Uint8Array(xor_bytes);
};

const leastSignificantBit = (number: number): number => {
  return number & 1;
};

const utils = {
  normaliseHex,
  // byteArrayToWordArray,
  hexToBytes,
  bytesToHex,
  bigIntegerToHexString,
  toAsciiCodes,
  toHexDated,
  toHex,
  hexToU8A,
  u8AToHexString,
  intToHex,
  xorU8Array,
  leastSignificantBit,
};

export default utils;
