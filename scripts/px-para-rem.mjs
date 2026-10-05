import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const stylesheet = new URL("../src/styles.css", import.meta.url);
const lengthPattern = /(?<![\w.-])[+-]?(?:\d*\.\d+|\d+\.?\d*)(?:e[+-]?\d+)?px(?![\w-])/gi;
const numberToken = /[+-]?(?:\d*\.\d+|\d+\.?\d*)(?:e[+-]?\d+)?px(?![\w-])/iy;
const identifierToken = /(?:--|-?[a-z_\u0080-\uffff])(?:[\w\u0080-\uffff-]|\\[^\r\n])*/iy;

// A small lexer keeps CSS strings, comments, URLs and conditional preludes intact.
// It does not resolve units: only px dimensions are changed, including in functions.
export function convertCss(css) {
  let cursor = 0, line = 1, converted = 0;
  const output = [], left = [];
  const record = (start, end, reason) => {
    const text = css.slice(start, end);
    for (const match of text.matchAll(lengthPattern)) {
      left.push({ line: line + (text.slice(0, match.index).match(/\n/g) || []).length,
        value: match[0], reason });
    }
  };
  const emit = (end, replacement = css.slice(cursor, end)) => {
    output.push(replacement);
    line += (css.slice(cursor, end).match(/\n/g) || []).length;
    cursor = end;
  };
  const commentEnd = (start) => {
    const end = css.indexOf("*/", start + 2);
    return end < 0 ? css.length : end + 2;
  };
  const stringEnd = (start) => {
    const quote = css[start];
    let end = start + 1;
    while (end < css.length) {
      if (css[end] === "\\") end += 2;
      else if (css[end++] === quote) break;
    }
    return Math.min(end, css.length);
  };
  const preludeEnd = (start) => {
    let end = start, depth = 0;
    while (end < css.length) {
      if (css.startsWith("/*", end)) end = commentEnd(end);
      else if (css[end] === '"' || css[end] === "'") end = stringEnd(end);
      else if (css[end] === "\\") end += 2;
      else if (depth === 0 && (css[end] === "{" || css[end] === ";")) break;
      else {
        if (css[end] === "(" || css[end] === "[") depth++;
        else if (css[end] === ")" || css[end] === "]") depth--;
        end++;
      }
    }
    return Math.min(end, css.length);
  };
  const urlEnd = (start) => {
    let end = start, depth = 0;
    while (end < css.length) {
      if (css[end] === '"' || css[end] === "'") end = stringEnd(end);
      else if (css[end] === "\\") end += 2;
      else {
        if (css[end] === "(") depth++;
        if (css[end] === ")" && --depth === 0) return end + 1;
        end++;
      }
    }
    return css.length;
  };

  while (cursor < css.length) {
    if (css.startsWith("/*", cursor)) {
      const end = commentEnd(cursor);
      record(cursor, end, "comment");
      emit(end);
      continue;
    }
    if (css[cursor] === '"' || css[cursor] === "'") {
      const end = stringEnd(cursor);
      record(cursor, end, "string");
      emit(end);
      continue;
    }
    if (css[cursor] === "@") {
      const atRule = /^@(media|container|supports)\b/i.exec(css.slice(cursor));
      if (atRule) {
        const end = preludeEnd(cursor + atRule[0].length);
        record(cursor, end, "media");
        emit(end);
        continue;
      }
    }
    const url = /^url\(/i.exec(css.slice(cursor));
    if (url) {
      const end = urlEnd(cursor + url[0].length - 1);
      record(cursor, end, "url");
      emit(end);
      continue;
    }
    if (/^data:/i.test(css.slice(cursor))) {
      // Also preserve bare data URIs; normal CSS puts these in url() or strings.
      const tail = css.slice(cursor).search(/[\s)"'}]/);
      const end = tail < 0 ? css.length : cursor + tail;
      record(cursor, end, "url");
      emit(end);
      continue;
    }
    numberToken.lastIndex = cursor;
    const dimension = !/[\w.]/.test(css[cursor - 1] || "") && numberToken.exec(css);
    if (dimension) {
      const value = Number(dimension[0].slice(0, -2));
      const reason = value === 0 ? "0px" : value === 1 ? "1px" : value === 0.5 ? "0.5px" : null;
      if (reason) {
        left.push({ line, value: dimension[0], reason });
        emit(numberToken.lastIndex);
      } else {
        const rem = (value / 16).toFixed(4).replace(/\.?0+$/, "");
        emit(numberToken.lastIndex, rem + "rem");
        converted++;
      }
      continue;
    }
    // Consume complete names so --w-12px and class/identifier suffixes are safe.
    identifierToken.lastIndex = cursor;
    const identifier = identifierToken.exec(css);
    if (identifier) emit(identifierToken.lastIndex);
    else if (css[cursor] === "\\") emit(Math.min(cursor + 2, css.length));
    else emit(cursor + 1);
  }
  return { css: output.join(""), converted, left };
}

function lineRanges(lines) {
  const numbers = [...new Set(lines)].sort((a, b) => a - b);
  const ranges = [];
  for (let i = 0; i < numbers.length; i++) {
    const start = numbers[i];
    let end = start;
    while (numbers[i + 1] === end + 1) end = numbers[++i];
    ranges.push(start === end ? String(start) : `${start}-${end}`);
  }
  return ranges.join(", ");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const original = readFileSync(stylesheet, "utf8");
  const result = convertCss(original);
  if (result.css !== original) writeFileSync(stylesheet, result.css, "utf8");
  console.log(`src/styles.css: ${result.converted} converted; ${result.left.length} left (input line numbers).`);
  for (const reason of ["1px", "0px", "0.5px", "media", "url", "string", "comment"]) {
    const entries = result.left.filter((entry) => entry.reason === reason);
    console.log(`  ${reason}: ${entries.length}${entries.length ? `; lines ${lineRanges(entries.map((entry) => entry.line))}` : ""}`);
  }
}
