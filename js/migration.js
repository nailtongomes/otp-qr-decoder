(function (root) {
  const OtpTool = root.OtpTool || (root.OtpTool = {});

  function fail() {
    throw OtpTool.codeError("badOtp");
  }

  function readVarint(buf, offset) {
    let value = 0n;
    let shift = 0n;
    let pos = offset;
    for (let i = 0; i < 10; i += 1) {
      if (pos >= buf.length) fail();
      const byte = buf[pos];
      pos += 1;
      value |= BigInt(byte & 0x7f) << shift;
      if ((byte & 0x80) === 0) return { value: value, next: pos };
      shift += 7n;
    }
    fail();
  }

  function takeLength(buf, offset) {
    const len = readVarint(buf, offset);
    const size = Number(len.value);
    if (!Number.isInteger(size) || size < 0 || len.next + size > buf.length) fail();
    return { bytes: buf.subarray(len.next, len.next + size), next: len.next + size };
  }

  function decodeFields(buf, onField) {
    let pos = 0;
    while (pos < buf.length) {
      const key = readVarint(buf, pos);
      pos = key.next;
      const field = Number(key.value >> 3n);
      const wire = Number(key.value & 7n);
      if (wire === 0) {
        const body = readVarint(buf, pos);
        pos = body.next;
        onField(field, wire, body.value);
      } else if (wire === 2) {
        const body = takeLength(buf, pos);
        pos = body.next;
        onField(field, wire, body.bytes);
      } else if (wire === 5) {
        if (pos + 4 > buf.length) fail();
        pos += 4;
      } else if (wire === 1) {
        if (pos + 8 > buf.length) fail();
        pos += 8;
      } else {
        fail();
      }
    }
  }

  function decodeOtpParameters(buf) {
    const record = {
      secret: new Uint8Array(),
      name: "",
      issuer: "",
      algorithm: 0,
      digits: 0,
      type: 0,
      counter: 0n,
    };
    const utf8 = new TextDecoder();
    decodeFields(buf, function (field, wire, value) {
      if (wire === 2 && field === 1) record.secret = new Uint8Array(value);
      else if (wire === 2 && field === 2) record.name = utf8.decode(value);
      else if (wire === 2 && field === 3) record.issuer = utf8.decode(value);
      else if (wire === 0 && field === 4) record.algorithm = Number(value);
      else if (wire === 0 && field === 5) record.digits = Number(value);
      else if (wire === 0 && field === 6) record.type = Number(value);
      else if (wire === 0 && field === 7) record.counter = value;
    });
    return record;
  }

  function decodeMigration(buf) {
    const records = [];
    decodeFields(buf, function (field, wire, value) {
      if (wire === 2 && field === 1) records.push(decodeOtpParameters(value));
    });
    return records;
  }

  OtpTool.decodeMigration = decodeMigration;
})(typeof globalThis !== "undefined" ? globalThis : window);
