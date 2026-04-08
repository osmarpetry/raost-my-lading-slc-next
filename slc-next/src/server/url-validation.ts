import { lookup as lookupDns } from "node:dns/promises";
import { isIP } from "node:net";

const allowedPorts = new Set(["", "80", "443", "8080", "8443"]);

function ipv4ToInt(address: string) {
  return address
    .split(".")
    .map((segment) => Number.parseInt(segment, 10))
    .reduce((accumulator, value) => (accumulator << 8) + value, 0) >>> 0;
}

function isPrivateIpv4(address: string) {
  const value = ipv4ToInt(address);

  const ranges = [
    ["0.0.0.0", "0.255.255.255"],
    ["10.0.0.0", "10.255.255.255"],
    ["100.64.0.0", "100.127.255.255"],
    ["127.0.0.0", "127.255.255.255"],
    ["169.254.0.0", "169.254.255.255"],
    ["172.16.0.0", "172.31.255.255"],
    ["192.168.0.0", "192.168.255.255"],
  ] as const;

  return ranges.some(([start, end]) => {
    const lower = ipv4ToInt(start);
    const upper = ipv4ToInt(end);
    return value >= lower && value <= upper;
  });
}

function isPrivateIpv6(address: string) {
  const normalized = address.toLowerCase();
  return (
    normalized === "::1" ||
    normalized === "::" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe8") ||
    normalized.startsWith("fe9") ||
    normalized.startsWith("fea") ||
    normalized.startsWith("feb")
  );
}

function isPrivateAddress(address: string) {
  const version = isIP(address);
  if (version === 4) {
    return isPrivateIpv4(address);
  }

  if (version === 6) {
    return isPrivateIpv6(address);
  }

  return false;
}

export async function normalizeAndValidateUrl(
  rawUrl: string,
  deps: {
    lookup?: typeof lookupDns;
  } = {},
) {
  const value = rawUrl.trim();
  if (!value) {
    throw new Error("enter a URL before starting the scan");
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("that does not look like a valid absolute URL");
  }

  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("only http and https URLs are supported in this phase");
  }

  if (url.username || url.password) {
    throw new Error("embedded credentials are not allowed");
  }

  if (!allowedPorts.has(url.port)) {
    throw new Error("only public web ports are allowed");
  }

  const lookup = deps.lookup ?? lookupDns;
  const directIpVersion = isIP(url.hostname);

  if (directIpVersion > 0) {
    if (isPrivateAddress(url.hostname)) {
      throw new Error("private, loopback, and metadata hosts are blocked");
    }
  } else {
    const addresses = await lookup(url.hostname, { all: true });
    if (addresses.some((entry) => isPrivateAddress(entry.address))) {
      throw new Error("private, loopback, and metadata hosts are blocked");
    }
  }

  url.hash = "";

  if (!url.pathname) {
    url.pathname = "/";
  }

  return url.toString();
}
