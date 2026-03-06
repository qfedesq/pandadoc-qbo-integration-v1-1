import { getPublicError, isDatabaseUnavailableError } from "@/lib/utils/errors";

describe("database availability errors", () => {
  it("detects closed PostgreSQL connections as database unavailability", () => {
    const error = new Error(
      "Error in PostgreSQL connection: Error { kind: Closed, cause: None }",
    );

    expect(isDatabaseUnavailableError(error)).toBe(true);
    expect(getPublicError(error)).toEqual({
      message:
        "Service temporarily unavailable. The application database is not reachable.",
      statusCode: 503,
      code: "DATABASE_UNAVAILABLE",
    });
  });

  it("keeps unrelated exceptions classified as internal server errors", () => {
    const error = new Error("Unexpected failure");

    expect(isDatabaseUnavailableError(error)).toBe(false);
    expect(getPublicError(error)).toEqual({
      message: "Internal server error.",
      statusCode: 500,
      code: "INTERNAL_SERVER_ERROR",
    });
  });
});
