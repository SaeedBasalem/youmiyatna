// يومياتنا — a ZIP reader small enough to ship.
//
// A WhatsApp export with media is a .zip, and a build-free app has no bundler
// to pull a library through. Browsers already contain an inflater: this walks
// the central directory by hand and hands the compressed bytes to
// DecompressionStream, which Safari has had since 16.4.
//
// Only what an export actually uses is supported: stored (0) and deflated (8)
// entries, with Zip64 sizes read when a file is large enough to need them.
const SIG_EOCD = 0x06054b50, SIG_EOCD64_LOC = 0x07064b50, SIG_EOCD64 = 0x06064b50, SIG_CD = 0x02014b50;
const U32 = 0xffffffff;

export function zipSupported() {
  return typeof DecompressionStream === "function";
}

const slice = (file, a, b) => file.slice(a, b).arrayBuffer();

export async function readZip(file) {
  const size = file.size;
  // the end-of-central-directory record lives in the last 64KB, after a
  // comment nobody sets; scan backwards for its signature
  const tailLen = Math.min(size, 66560);
  const tail = new DataView(await slice(file, size - tailLen, size));
  let eocd = -1;
  for (let i = tail.byteLength - 22; i >= 0; i--) {
    if (tail.getUint32(i, true) === SIG_EOCD) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error("not_a_zip");

  let cdSize = tail.getUint32(eocd + 12, true);
  let cdOff = tail.getUint32(eocd + 16, true);
  let count = tail.getUint16(eocd + 10, true);

  if (cdOff === U32 || cdSize === U32 || count === 0xffff) {
    let loc = -1;
    for (let i = eocd - 20; i >= 0; i--) {
      if (tail.getUint32(i, true) === SIG_EOCD64_LOC) { loc = i; break; }
    }
    if (loc < 0) throw new Error("zip64_missing");
    const at = Number(tail.getBigUint64(loc + 8, true));
    const rec = new DataView(await slice(file, at, at + 56));
    if (rec.getUint32(0, true) !== SIG_EOCD64) throw new Error("zip64_bad");
    count = Number(rec.getBigUint64(32, true));
    cdSize = Number(rec.getBigUint64(40, true));
    cdOff = Number(rec.getBigUint64(48, true));
  }

  const cd = new DataView(await slice(file, cdOff, cdOff + cdSize));
  const names = new TextDecoder("utf-8");
  const entries = [];
  let p = 0;
  for (let n = 0; n < count && p + 46 <= cd.byteLength; n++) {
    if (cd.getUint32(p, true) !== SIG_CD) break;
    const method = cd.getUint16(p + 10, true);
    let compSize = cd.getUint32(p + 20, true);
    let rawSize = cd.getUint32(p + 24, true);
    const nameLen = cd.getUint16(p + 28, true);
    const extraLen = cd.getUint16(p + 30, true);
    const cmtLen = cd.getUint16(p + 32, true);
    let local = cd.getUint32(p + 42, true);
    const name = names.decode(new Uint8Array(cd.buffer, cd.byteOffset + p + 46, nameLen));

    // Zip64 extended information, when any of the three fields overflowed
    if (rawSize === U32 || compSize === U32 || local === U32) {
      let e = p + 46 + nameLen;
      const end = e + extraLen;
      while (e + 4 <= end) {
        const id = cd.getUint16(e, true), len = cd.getUint16(e + 2, true);
        if (id === 0x0001) {
          let q = e + 4;
          if (rawSize === U32) { rawSize = Number(cd.getBigUint64(q, true)); q += 8; }
          if (compSize === U32) { compSize = Number(cd.getBigUint64(q, true)); q += 8; }
          if (local === U32) { local = Number(cd.getBigUint64(q, true)); q += 8; }
          break;
        }
        e += 4 + len;
      }
    }
    p += 46 + nameLen + extraLen + cmtLen;
    if (name.endsWith("/")) continue;                        // a directory entry
    entries.push({ name, method, compSize, size: rawSize, local });
  }

  // The local header repeats the name and may carry a different extra field,
  // so the data offset can only be computed by reading it.
  async function bytes(entry) {
    const head = new DataView(await slice(file, entry.local, entry.local + 30));
    const start = entry.local + 30 + head.getUint16(26, true) + head.getUint16(28, true);
    const raw = file.slice(start, start + entry.compSize);
    if (entry.method === 0) return raw;
    if (entry.method !== 8) throw new Error("unsupported_method");
    const out = raw.stream().pipeThrough(new DecompressionStream("deflate-raw"));
    return await new Response(out).blob();
  }

  return {
    entries,
    bytes,
    async text(entry) { return await (await bytes(entry)).text(); },
    find(re) { return entries.find((e) => re.test(e.name)); },
  };
}
