import { describe, it, expect } from "vitest";
import { csvCell, toCsv } from "./csv";

describe("CSV escaping", () => {
  it("leaves plain values alone", () => expect(csvCell("hello")).toBe("hello"));
  it("quotes commas", () => expect(csvCell("a,b")).toBe('"a,b"'));
  it("doubles quotes", () => expect(csvCell('say "hi"')).toBe('"say ""hi"""'));
  it("quotes newlines", () => expect(csvCell("a\nb")).toBe('"a\nb"'));
  it("renders null and undefined as empty", () => {
    expect(csvCell(null)).toBe("");
    expect(csvCell(undefined)).toBe("");
  });
  it("keeps numbers as-is", () => expect(csvCell(42)).toBe("42"));
  it('neutralises spreadsheet formulas in text, not negative numbers', () => {
    expect(csvCell('=1+1')).toBe("'=1+1");
    expect(csvCell('  @SUM(A1)')).toBe("'  @SUM(A1)");
    expect(csvCell('-2')).toBe("'-2");
    expect(csvCell(-2)).toBe('-2');
  });
});

describe("toCsv", () => {
  it("starts with a UTF-8 BOM and uses CRLF", () => {
    const csv = toCsv(["a", "b"], [[1, 2]]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toBe("﻿a,b\r\n1,2\r\n");
  });
  it("escapes cells inside rows", () => {
    expect(toCsv(["n"], [["x,y"]])).toContain('"x,y"');
  });
});
