export class SourceResolutionError extends Error {
  constructor({ code, message, details = [], statusCode = 422 }) {
    super(message);
    this.name = "SourceResolutionError";
    this.code = code;
    this.details = details;
    this.statusCode = statusCode;
  }
}

export function normalizeEnvValue(value) {
  return typeof value === "string" ? value.trim() : "";
}

export function buildSourceStatus({
  provider,
  enabled,
  mode,
  missingEnv = [],
  ...extra
}) {
  return {
    enabled,
    provider,
    mode,
    missingEnv,
    ...extra
  };
}

export function createUnavailableLawSource({
  provider,
  reason,
  missingEnv = []
}) {
  const status = buildSourceStatus({
    provider,
    enabled: false,
    mode: "adapter",
    missingEnv
  });

  return {
    getSourceStatus() {
      return status;
    },
    async resolveRegulationPair() {
      if (reason === "missing_env") {
        throw new SourceResolutionError({
          code: "SOURCE_PROVIDER_MISCONFIGURED",
          message: "Source provider is missing required environment variables.",
          details: missingEnv.map((name) => ({
            path: `env.${name}`,
            message: "is required"
          }))
        });
      }

      if (reason === "not_implemented") {
        throw new SourceResolutionError({
          code: "SOURCE_PROVIDER_NOT_IMPLEMENTED",
          message: "Source provider adapter exists but data fetching is not implemented yet."
        });
      }

      throw new SourceResolutionError({
        code: "SOURCE_PROVIDER_UNSUPPORTED",
        message: "Requested source provider is not supported."
      });
    }
  };
}
