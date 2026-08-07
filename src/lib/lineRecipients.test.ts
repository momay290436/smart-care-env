import { describe, expect, it } from "vitest";
import { appendDefaultLineGroupRecipients, DEFAULT_LINE_GROUP_ID } from "./lineRecipients";

describe("appendDefaultLineGroupRecipients", () => {
  it("adds the configured LINE group ID to the recipient list", () => {
    expect(appendDefaultLineGroupRecipients(["U123456", "U654321"])).toEqual([
      "U123456",
      "U654321",
      DEFAULT_LINE_GROUP_ID,
    ]);
  });

  it("does not duplicate the configured LINE group ID when it already exists", () => {
    expect(appendDefaultLineGroupRecipients([DEFAULT_LINE_GROUP_ID, "U123456"])).toEqual([
      DEFAULT_LINE_GROUP_ID,
      "U123456",
    ]);
  });
});
